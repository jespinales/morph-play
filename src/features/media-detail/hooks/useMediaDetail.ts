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
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(item);
    setSeasons([]);
    setEpisodes([]);
    setCollectionItems([]);
    setSimilar([]);

    async function load() {
      if (!serverUrl || !accessToken || !userId) return;
      try {
        const [fullDetail, sim] = await Promise.all([
          jellyfinApi.getItemDetail(serverUrl, accessToken, userId, item.Id),
          item.Type === 'BoxSet'
            ? Promise.resolve([])
            : jellyfinApi.getSimilarItems(serverUrl, accessToken, userId, item.Id, 9),
        ]);
        if (!active) return;
        setDetail(fullDetail);
        setSimilar(sim);

        if (fullDetail.Type === 'Series') {
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

  return {
    detail,
    seasons,
    selectedSeasonId,
    episodes,
    collectionItems,
    similar,
    loadingEpisodes,
    handleSeasonChange,
    handleToggleFavorite,
    handleTogglePlayed,
  };
}
