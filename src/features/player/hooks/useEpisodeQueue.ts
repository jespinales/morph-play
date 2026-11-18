import { useEffect, useMemo, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface UseEpisodeQueueParams {
  rootItem: BaseItemDto;
  initialItemId: string;
  initialQueue?: BaseItemDto[];
  serverUrl: string;
  accessToken: string | null;
  userId?: string;
  loadEpisodeErrorText: string;
  onError: (msg: string) => void;
  onLoadingStart: () => void;
}

export function useEpisodeQueue({
  rootItem,
  initialItemId,
  initialQueue,
  serverUrl,
  accessToken,
  userId,
  loadEpisodeErrorText,
  onError,
  onLoadingStart,
}: UseEpisodeQueueParams) {
  const [queue, setQueue] = useState<BaseItemDto[]>(initialQueue ?? []);
  const [activeItem, setActiveItem] = useState<BaseItemDto>(rootItem);

  useEffect(() => {
    let active = true;
    async function resolvePlayableItem() {
      if (!serverUrl || !accessToken || !userId) return;
      if (rootItem.Type !== 'Series') {
        setActiveItem(rootItem);
        const seedQueue =
          rootItem.Id === initialItemId && initialQueue?.length ? initialQueue : [];
        setQueue(seedQueue);

        // If launched from a single episode (e.g. Continue Watching / Next Up) or a single-season queue,
        // load all episodes across the series so continuous playback works across seasons.
        if (rootItem.Type === 'Episode' && rootItem.SeriesId) {
          try {
            const allEps = await jellyfinApi.getEpisodes(
              serverUrl,
              accessToken,
              userId,
              rootItem.SeriesId
            );
            if (active && allEps.length > 0) {
              setQueue(allEps);
            }
          } catch {
            // Keep initial queue if background load fails
          }
        }
        return;
      }

      onLoadingStart();
      try {
        let eps = await jellyfinApi.getEpisodes(serverUrl, accessToken, userId, rootItem.Id);
        if (!active) return;
        if (eps.length === 0) {
          const seasons = await jellyfinApi.getSeasons(serverUrl, accessToken, userId, rootItem.Id);
          if (!active || seasons.length === 0) return;
          eps = await jellyfinApi.getEpisodes(
            serverUrl,
            accessToken,
            userId,
            rootItem.Id,
            seasons[0].Id
          );
        }
        if (!active || eps.length === 0) return;
        const chosen =
          eps.find((ep) => (ep.UserData?.PlaybackPositionTicks ?? 0) > 0) ??
          eps.find((ep) => !ep.UserData?.Played) ??
          eps[0];
        setQueue(eps);
        setActiveItem(chosen);
      } catch {
        if (active) onError(loadEpisodeErrorText);
      }
    }

    resolvePlayableItem();
    return () => {
      active = false;
    };
  }, [rootItem, initialItemId, initialQueue, serverUrl, accessToken, userId, loadEpisodeErrorText, onError, onLoadingStart]);

  const nextEpisode = useMemo(() => {
    if (activeItem.Type !== 'Episode' || queue.length === 0) return null;
    const idx = queue.findIndex((ep) => ep.Id === activeItem.Id);
    if (idx === -1 || idx + 1 >= queue.length) return null;
    return queue[idx + 1];
  }, [activeItem, queue]);

  return {
    activeItem,
    setActiveItem,
    setQueue,
    nextEpisode,
  };
}
