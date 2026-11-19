import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface UseHomeCatalogParams {
  serverUrl: string;
  accessToken: string | null;
  userId?: string;
  refreshSignal: number;
}

export function useHomeCatalog({
  serverUrl,
  accessToken,
  userId,
  refreshSignal,
}: UseHomeCatalogParams) {
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<BaseItemDto[]>([]);
  const [resumeItems, setResumeItems] = useState<BaseItemDto[]>([]);
  const [nextUpItems, setNextUpItems] = useState<BaseItemDto[]>([]);
  const [latestMovies, setLatestMovies] = useState<BaseItemDto[]>([]);
  const [latestSeries, setLatestSeries] = useState<BaseItemDto[]>([]);
  const [topRated, setTopRated] = useState<BaseItemDto[]>([]);
  const [favorites, setFavorites] = useState<BaseItemDto[]>([]);
  const [suggestions, setSuggestions] = useState<BaseItemDto[]>([]);
  const [actionMovies, setActionMovies] = useState<BaseItemDto[]>([]);
  const loadedContextRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshResumeAndNextUp = useCallback(async () => {
    if (!serverUrl || !accessToken || !userId) return;
    const [resume, nextUp] = await Promise.all([
      jellyfinApi.getResumeItems(serverUrl, accessToken, userId).catch(() => null),
      jellyfinApi.getNextUpItems(serverUrl, accessToken, userId).catch(() => null),
    ]);
    if (!isMountedRef.current) return;
    if (resume) setResumeItems(resume);
    if (nextUp) setNextUpItems(nextUp);
  }, [serverUrl, accessToken, userId]);

  useEffect(() => {
    let active = true;
    async function fetchHomeData() {
      if (!serverUrl || !accessToken || !userId) return;
      const contextKey = `${serverUrl}|${userId}`;
      if (refreshSignal > 0 && loadedContextRef.current === contextKey) {
        await refreshResumeAndNextUp();
        return;
      }

      try {
        const [resume, nextUp, movies, series, top, favs, suggested, actionPrimary] = await Promise.all([
          jellyfinApi.getResumeItems(serverUrl, accessToken, userId).catch(() => []),
          jellyfinApi.getNextUpItems(serverUrl, accessToken, userId).catch(() => []),
          jellyfinApi.getLatestItems(serverUrl, accessToken, userId, 'Movie', 16).catch(() => []),
          jellyfinApi.getLatestItems(serverUrl, accessToken, userId, 'Series', 16).catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, userId, {
              includeItemTypes: 'Movie,Series',
              sortBy: 'CommunityRating',
              sortOrder: 'Descending',
              limit: 10,
            })
            .then((r) => r.Items)
            .catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, userId, {
              includeItemTypes: 'Movie,Series',
              filters: 'IsFavorite',
              limit: 16,
            })
            .then((r) => r.Items)
            .catch(() => []),
          jellyfinApi.getSuggestions(serverUrl, accessToken, userId, 16).catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, userId, {
              includeItemTypes: 'Movie',
              genres: 'Action',
              limit: 16,
            })
            .then((r) => r.Items)
            .catch(() => []),
        ]);

        // Fallback to Spanish genre tag for libraries configured with Spanish metadata
        const action =
          actionPrimary.length > 0
            ? actionPrimary
            : await jellyfinApi
                .getItems(serverUrl, accessToken, userId, {
                  includeItemTypes: 'Movie',
                  genres: 'Acción',
                  limit: 16,
                })
                .then((r) => r.Items)
                .catch(() => []);

        if (!active) return;

        // Pick top candidates for HeroBanner
        const heroPool = [...top, ...movies, ...series].filter(
          (item, index, arr) =>
            arr.findIndex((x) => x.Id === item.Id) === index &&
            (item.BackdropImageTags?.length || item.Overview)
        );

        setFeatured(heroPool.slice(0, 5));
        setResumeItems(resume);
        setNextUpItems(nextUp);
        setLatestMovies(movies);
        setLatestSeries(series);
        setTopRated(top);
        setFavorites(favs);
        setSuggestions(suggested);
        setActionMovies(action);
        loadedContextRef.current = contextKey;
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchHomeData();
    return () => {
      active = false;
    };
  }, [serverUrl, accessToken, userId, refreshSignal, refreshResumeAndNextUp]);

  const handleRemoveFromResume = async (item: BaseItemDto) => {
    if (!serverUrl || !accessToken || !userId) return;
    const prevResume = resumeItems;
    const prevNextUp = nextUpItems;
    setResumeItems((list) => list.filter((i) => i.Id !== item.Id));
    try {
      await jellyfinApi.removeFromResume(serverUrl, accessToken, userId, item.Id);
      const updatedNextUp = await jellyfinApi
        .getNextUpItems(serverUrl, accessToken, userId)
        .catch(() => prevNextUp);
      setNextUpItems(updatedNextUp);
    } catch {
      setResumeItems(prevResume);
      setNextUpItems(prevNextUp);
    }
  };

  const handleRemoveFromNextUp = async (item: BaseItemDto) => {
    if (!serverUrl || !accessToken || !userId) return;
    const prevNextUp = nextUpItems;
    const prevResume = resumeItems;
    setNextUpItems((list) =>
      list.filter((i) => i.Id !== item.Id && (!item.SeriesId || i.SeriesId !== item.SeriesId))
    );
    setResumeItems((list) => list.filter((i) => i.Id !== item.Id));
    try {
      await jellyfinApi.removeFromNextUp(serverUrl, accessToken, userId, item);
    } catch {
      setNextUpItems(prevNextUp);
      setResumeItems(prevResume);
    }
  };

  const dedupedNextUpItems = useMemo(() => {
    const resumeIds = new Set(resumeItems.map((entry) => entry.Id));
    const resumeSeriesIds = new Set(
      resumeItems.map((entry) => entry.SeriesId).filter((id): id is string => Boolean(id))
    );
    return nextUpItems.filter(
      (entry) =>
        !resumeIds.has(entry.Id) && (!entry.SeriesId || !resumeSeriesIds.has(entry.SeriesId))
    );
  }, [resumeItems, nextUpItems]);

  return {
    loading,
    featured,
    resumeItems,
    dedupedNextUpItems,
    latestMovies,
    latestSeries,
    topRated,
    favorites,
    suggestions,
    actionMovies,
    refreshResumeAndNextUp,
    handleRemoveFromResume,
    handleRemoveFromNextUp,
  };
}
