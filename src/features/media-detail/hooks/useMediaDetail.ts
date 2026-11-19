import { useEffect, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface UseMediaDetailParams {
  item: BaseItemDto;
  serverUrl: string;
  accessToken: string | null;
  userId?: string;
  onItemMutated: (updated: BaseItemDto) => void;
}

export function useMediaDetail({
  item,
  serverUrl,
  accessToken,
  userId,
  onItemMutated,
}: UseMediaDetailParams) {
  const [detail, setDetail] = useState<BaseItemDto>(item);
  const [seasons, setSeasons] = useState<BaseItemDto[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [episodes, setEpisodes] = useState<BaseItemDto[]>([]);
  const [collectionItems, setCollectionItems] = useState<BaseItemDto[]>([]);
  const [personCredits, setPersonCredits] = useState<BaseItemDto[]>([]);
  const [trailers, setTrailers] = useState<BaseItemDto[]>([]);
  const [specialFeatures, setSpecialFeatures] = useState<BaseItemDto[]>([]);
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(item);
    setSeasons([]);
    setEpisodes([]);
    setCollectionItems([]);
    setPersonCredits([]);
    setTrailers([]);
    setSpecialFeatures([]);
    setSimilar([]);

    async function load() {
      if (!serverUrl || !accessToken || !userId) return;
      try {
        const isPerson = item.Type === 'Person';
        const isBoxSet = item.Type === 'BoxSet';
        const isPlaylist = item.Type === 'Playlist';

        const [fullDetail, sim, localTrailers, extras] = await Promise.all([
          jellyfinApi.getItemDetail(serverUrl, accessToken, userId, item.Id),
          isPerson || isBoxSet || isPlaylist
            ? Promise.resolve([])
            : jellyfinApi.getSimilarItems(serverUrl, accessToken, userId, item.Id, 9),
          isPerson || isBoxSet || isPlaylist
            ? Promise.resolve([])
            : jellyfinApi.getLocalTrailers(serverUrl, accessToken, userId, item.Id),
          isPerson || isBoxSet || isPlaylist
            ? Promise.resolve([])
            : jellyfinApi.getSpecialFeatures(serverUrl, accessToken, userId, item.Id),
        ]);
        if (!active) return;
        setDetail(fullDetail);
        setSimilar(sim);
        setTrailers(localTrailers);
        setSpecialFeatures(extras);

        if (fullDetail.Type === 'Person') {
          const credits = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            includeItemTypes: 'Movie,Series',
            personIds: fullDetail.Id,
            sortBy: 'ProductionYear',
            sortOrder: 'Descending',
            limit: 60,
          });
          if (!active) return;
          setPersonCredits(credits.Items);
        } else if (fullDetail.Type === 'Series') {
          setLoadingEpisodes(true);
          const sList = await jellyfinApi.getSeasons(serverUrl, accessToken, userId, fullDetail.Id);
          if (!active) return;
          setSeasons(sList);
          const firstSeason = sList[0];
          if (firstSeason) {
            setSelectedSeasonId(firstSeason.Id);
            const eps = await jellyfinApi.getEpisodes(
              serverUrl,
              accessToken,
              userId,
              fullDetail.Id,
              firstSeason.Id
            );
            if (!active) return;
            setEpisodes(eps);
          }
          setLoadingEpisodes(false);
        } else if (fullDetail.Type === 'BoxSet') {
          const children = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            parentId: fullDetail.Id,
            sortBy: 'ProductionYear',
            sortOrder: 'Ascending',
          });
          if (!active) return;
          setCollectionItems(children.Items);
        } else if (fullDetail.Type === 'Playlist') {
          const entries = await jellyfinApi.getPlaylistItems(
            serverUrl,
            accessToken,
            userId,
            fullDetail.Id
          );
          if (!active) return;
          setCollectionItems(entries);
        }
      } catch {
        setLoadingEpisodes(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [item, serverUrl, accessToken, userId]);

  const handleSeasonChange = async (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    if (!serverUrl || !accessToken || !userId) return;
    setLoadingEpisodes(true);
    try {
      const eps = await jellyfinApi.getEpisodes(
        serverUrl,
        accessToken,
        userId,
        detail.Id,
        seasonId
      );
      setEpisodes(eps);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!serverUrl || !accessToken || !userId) return;
    const next = !Boolean(detail.UserData?.IsFavorite);
    const updated: BaseItemDto = {
      ...detail,
      UserData: { ...detail.UserData, IsFavorite: next },
    };
    setDetail(updated);
    onItemMutated(updated);
    await jellyfinApi.toggleFavorite(serverUrl, accessToken, userId, detail.Id, next);
  };

  const handleTogglePlayed = async () => {
    if (!serverUrl || !accessToken || !userId) return;
    const next = !Boolean(detail.UserData?.Played);
    const updated: BaseItemDto = {
      ...detail,
      UserData: { ...detail.UserData, Played: next },
    };
    setDetail(updated);
    onItemMutated(updated);
    await jellyfinApi.togglePlayed(serverUrl, accessToken, userId, detail.Id, next);
  };

  const handleRemoveFromPlaylist = async (entry: BaseItemDto) => {
    if (!serverUrl || !accessToken || !userId || !entry.PlaylistItemId) return;
    await jellyfinApi.removeFromPlaylist(serverUrl, accessToken, userId, detail.Id, [
      entry.PlaylistItemId,
    ]);
    setCollectionItems((prev) => prev.filter((itemEntry) => itemEntry.PlaylistItemId !== entry.PlaylistItemId));
  };

  return {
    detail,
    seasons,
    selectedSeasonId,
    episodes,
    collectionItems,
    personCredits,
    trailers,
    specialFeatures,
    similar,
    loadingEpisodes,
    handleSeasonChange,
    handleToggleFavorite,
    handleTogglePlayed,
    handleRemoveFromPlaylist,
  };
}
