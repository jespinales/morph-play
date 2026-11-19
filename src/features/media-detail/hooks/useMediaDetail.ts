import { useEffect, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import {
  AllThemeMediaResult,
  BaseItemDto,
  ExternalIdInfo,
  PlaylistDto,
  PlaylistUserPermissions,
  UserDto,
} from '../../../shared/types/jellyfin';

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
  const [additionalParts, setAdditionalParts] = useState<BaseItemDto[]>([]);
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);
  const [externalIds, setExternalIds] = useState<ExternalIdInfo[]>([]);
  const [itemCollections, setItemCollections] = useState<BaseItemDto[]>([]);
  const [ancestors, setAncestors] = useState<BaseItemDto[]>([]);
  const [themeSongs, setThemeSongs] = useState<BaseItemDto[]>([]);
  const [playlistMeta, setPlaylistMeta] = useState<PlaylistDto | null>(null);
  const [playlistUsers, setPlaylistUsers] = useState<PlaylistUserPermissions[]>([]);
  const [publicUsers, setPublicUsers] = useState<UserDto[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingDetail(true);
    setDetail(item);
    setSeasons([]);
    setEpisodes([]);
    setCollectionItems([]);
    setPersonCredits([]);
    setTrailers([]);
    setSpecialFeatures([]);
    setAdditionalParts([]);
    setSimilar([]);
    setExternalIds([]);
    setItemCollections([]);
    setAncestors([]);
    setThemeSongs([]);
    setPlaylistMeta(null);
    setPlaylistUsers([]);

    async function load() {
      if (!serverUrl || !accessToken || !userId) {
        if (active) setLoadingDetail(false);
        return;
      }
      try {
        const isPerson = item.Type === 'Person';
        const isBoxSet = item.Type === 'BoxSet';
        const isPlaylist = item.Type === 'Playlist';
        const skipExtras = isPerson || isBoxSet || isPlaylist;

        const [
          fullDetail,
          sim,
          localTrailers,
          extras,
          extIds,
          cols,
          ancList,
          parts,
          themes,
        ] = await Promise.all([
          jellyfinApi.getItemDetail(serverUrl, accessToken, userId, item.Id),
          skipExtras
            ? Promise.resolve([])
            : jellyfinApi.getSimilarItems(serverUrl, accessToken, userId, item.Id, 9),
          skipExtras
            ? Promise.resolve([])
            : jellyfinApi.getLocalTrailers(serverUrl, accessToken, userId, item.Id),
          skipExtras
            ? Promise.resolve([])
            : jellyfinApi.getSpecialFeatures(serverUrl, accessToken, userId, item.Id),
          isBoxSet || isPlaylist
            ? Promise.resolve([])
            : jellyfinApi.getExternalIdInfos(serverUrl, accessToken, item.Id),
          skipExtras
            ? Promise.resolve([])
            : jellyfinApi.getItemCollections(serverUrl, accessToken, userId, item.Id),
          isPerson
            ? Promise.resolve([])
            : jellyfinApi.getItemAncestors(serverUrl, accessToken, userId, item.Id),
          skipExtras
            ? Promise.resolve([])
            : jellyfinApi.getAdditionalParts(serverUrl, accessToken, userId, item.Id),
          skipExtras
            ? Promise.resolve<AllThemeMediaResult>({})
            : jellyfinApi.getThemeMedia(serverUrl, accessToken, userId, item.Id),
        ]);
        if (!active) return;

        let nextSeasons: BaseItemDto[] = [];
        let nextSelectedSeasonId = '';
        let nextEpisodes: BaseItemDto[] = [];
        let nextCollectionItems: BaseItemDto[] = [];
        let nextPersonCredits: BaseItemDto[] = [];
        let nextPlaylistMeta: PlaylistDto | null = null;
        let nextPlaylistUsers: PlaylistUserPermissions[] = [];
        let nextPublicUsers: UserDto[] = [];

        if (fullDetail.Type === 'Person') {
          const credits = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            includeItemTypes: 'Movie,Series',
            personIds: fullDetail.Id,
            sortBy: 'ProductionYear',
            sortOrder: 'Descending',
            limit: 60,
          });
          nextPersonCredits = credits.Items;
        } else if (fullDetail.Type === 'Series') {
          nextSeasons = await jellyfinApi.getSeasons(serverUrl, accessToken, userId, fullDetail.Id);
          const firstSeason = nextSeasons[0];
          if (firstSeason) {
            nextSelectedSeasonId = firstSeason.Id;
            nextEpisodes = await jellyfinApi.getEpisodes(
              serverUrl,
              accessToken,
              userId,
              fullDetail.Id,
              firstSeason.Id
            );
          }
        } else if (fullDetail.Type === 'BoxSet') {
          const children = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            parentId: fullDetail.Id,
            sortBy: 'ProductionYear',
            sortOrder: 'Ascending',
          });
          nextCollectionItems = children.Items;
        } else if (fullDetail.Type === 'Playlist') {
          const [entries, plMeta, plUsers, pubUsers] = await Promise.all([
            jellyfinApi.getPlaylistItems(serverUrl, accessToken, userId, fullDetail.Id),
            jellyfinApi.getPlaylist(serverUrl, accessToken, fullDetail.Id),
            jellyfinApi.getPlaylistUsers(serverUrl, accessToken, fullDetail.Id),
            jellyfinApi.getPublicUsers(serverUrl).catch(() => []),
          ]);
          nextCollectionItems = entries;
          nextPlaylistMeta = plMeta;
          nextPlaylistUsers = plUsers;
          nextPublicUsers = pubUsers;
        }

        if (!active) return;

        // Commit all hydrated detail state together to avoid incremental height jumps
        setDetail(fullDetail);
        setSimilar(sim);
        setTrailers(localTrailers);
        setSpecialFeatures(extras);
        setExternalIds(extIds);
        setItemCollections(cols);
        setAncestors(ancList);
        setAdditionalParts(parts);
        setThemeSongs(themes.ThemeSongsResult?.Items ?? []);
        setSeasons(nextSeasons);
        setSelectedSeasonId(nextSelectedSeasonId);
        setEpisodes(nextEpisodes);
        setCollectionItems(nextCollectionItems);
        setPersonCredits(nextPersonCredits);
        setPlaylistMeta(nextPlaylistMeta);
        setPlaylistUsers(nextPlaylistUsers);
        setPublicUsers(nextPublicUsers);
      } catch {
        // Keep fallback summary item visible if detail fetch fails
      } finally {
        if (active) {
          setLoadingDetail(false);
          setLoadingEpisodes(false);
        }
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
    await jellyfinApi.removeFromPlaylist(serverUrl, accessToken, detail.Id, [
      entry.PlaylistItemId,
    ]);
    setCollectionItems((prev) => prev.filter((itemEntry) => itemEntry.PlaylistItemId !== entry.PlaylistItemId));
  };

  const handleSetRating = async (nextLikes: boolean | null) => {
    if (!serverUrl || !accessToken || !userId) return;
    const currentLikes = detail.UserData?.Likes;
    const targetLikes = currentLikes === nextLikes ? null : nextLikes;
    const updated: BaseItemDto = {
      ...detail,
      UserData: { ...detail.UserData, Likes: targetLikes === null ? undefined : targetLikes },
    };
    setDetail(updated);
    onItemMutated(updated);
    await jellyfinApi.updateUserRating(serverUrl, accessToken, userId, detail.Id, targetLikes);
  };

  const handleMovePlaylistItem = async (entry: BaseItemDto, newIndex: number) => {
    if (!serverUrl || !accessToken || !entry.PlaylistItemId) return;
    if (newIndex < 0 || newIndex >= collectionItems.length) return;
    const oldIndex = collectionItems.findIndex((i) => i.PlaylistItemId === entry.PlaylistItemId);
    if (oldIndex < 0 || oldIndex === newIndex) return;
    const reordered = [...collectionItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setCollectionItems(reordered);
    await jellyfinApi.movePlaylistItem(
      serverUrl,
      accessToken,
      detail.Id,
      entry.PlaylistItemId,
      newIndex
    );
  };

  const handleUpdatePlaylist = async (name: string, isPublic: boolean) => {
    if (!serverUrl || !accessToken || !name.trim()) return;
    await jellyfinApi.updatePlaylist(serverUrl, accessToken, detail.Id, {
      Name: name.trim(),
      IsPublic: isPublic,
    });
    const updated: BaseItemDto = { ...detail, Name: name.trim() };
    setDetail(updated);
    onItemMutated(updated);
    setPlaylistMeta((prev) => ({ ...(prev ?? {}), OpenAccess: isPublic }));
  };

  const handleSetPlaylistUser = async (targetUserId: string, canEdit: boolean) => {
    if (!serverUrl || !accessToken || !targetUserId) return;
    await jellyfinApi.setPlaylistUserAccess(serverUrl, accessToken, detail.Id, targetUserId, canEdit);
    const updated = await jellyfinApi.getPlaylistUsers(serverUrl, accessToken, detail.Id);
    setPlaylistUsers(updated);
  };

  const handleRemovePlaylistUser = async (targetUserId: string) => {
    if (!serverUrl || !accessToken || !targetUserId) return;
    await jellyfinApi.removePlaylistUser(serverUrl, accessToken, detail.Id, targetUserId);
    setPlaylistUsers((prev) => prev.filter((u) => u.UserId !== targetUserId));
  };

  const handleRemoveFromCollection = async (entry: BaseItemDto) => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.removeFromCollection(serverUrl, accessToken, detail.Id, [entry.Id]);
    setCollectionItems((prev) => prev.filter((i) => i.Id !== entry.Id));
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
    additionalParts,
    similar,
    externalIds,
    itemCollections,
    ancestors,
    themeSongs,
    playlistMeta,
    playlistUsers,
    publicUsers,
    loadingDetail,
    loadingEpisodes,
    handleSeasonChange,
    handleToggleFavorite,
    handleTogglePlayed,
    handleSetRating,
    handleRemoveFromPlaylist,
    handleMovePlaylistItem,
    handleUpdatePlaylist,
    handleSetPlaylistUser,
    handleRemovePlaylistUser,
    handleRemoveFromCollection,
  };
}
