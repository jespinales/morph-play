import { useCallback, useEffect, useMemo, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import { BaseItemDto } from '../../../shared/types/jellyfin';

export type CatalogMode = 'movies' | 'series' | 'collections' | 'playlists' | 'favorites' | 'search';

const CATALOG_PAGE_SIZE = 48;

interface UseCatalogQueryParams {
  mode: CatalogMode;
  sortBy: string;
  sortOrder: 'Ascending' | 'Descending';
  selectedGenre: string;
  selectedTag: string;
  selectedYear: number | undefined;
  selectedLibraryId: string;
  searchTerm: string;
  locale: string;
  serverUrl: string;
  accessToken: string | null;
  userId?: string;
  refreshSignal: number;
  mutatedItems: Record<string, BaseItemDto>;
}

function resolveIncludeTypes(mode: CatalogMode): string {
  switch (mode) {
    case 'movies':
      return 'Movie';
    case 'series':
      return 'Series';
    case 'collections':
      return 'BoxSet';
    case 'playlists':
      return 'Playlist';
    default:
      return 'Movie,Series';
  }
}

export function useCatalogQuery({
  mode,
  sortBy,
  sortOrder,
  selectedGenre,
  selectedTag,
  selectedYear,
  selectedLibraryId,
  searchTerm,
  locale,
  serverUrl,
  accessToken,
  userId,
  refreshSignal,
  mutatedItems,
}: UseCatalogQueryParams) {
  const [items, setItems] = useState<BaseItemDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverGenres, setServerGenres] = useState<string[]>([]);
  const [serverTags, setServerTags] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allViews, setAllViews] = useState<BaseItemDto[]>([]);

  // Fetch user views (libraries) once per session/refresh
  useEffect(() => {
    let active = true;
    async function loadViews() {
      if (!serverUrl || !accessToken || !userId) return;
      try {
        const views = await jellyfinApi.getUserViews(serverUrl, accessToken, userId);
        if (active) setAllViews(views);
      } catch {
        if (active) setAllViews([]);
      }
    }
    loadViews();
    return () => {
      active = false;
    };
  }, [serverUrl, accessToken, userId, refreshSignal]);

  // Fetch authoritative genres, tags (/Items/Filters2), and years (/Years)
  useEffect(() => {
    let active = true;
    async function loadFilters() {
      if (!serverUrl || !accessToken || !userId || mode === 'collections' || mode === 'playlists') {
        setServerGenres([]);
        setServerTags([]);
        setAvailableYears([]);
        return;
      }
      try {
        const filterParams = {
          includeItemTypes: resolveIncludeTypes(mode),
          parentId: selectedLibraryId || undefined,
        };
        const [genresList, filters2, yearsList] = await Promise.all([
          jellyfinApi.getGenres(serverUrl, accessToken, userId, filterParams).catch(() => []),
          jellyfinApi.getFilters2(serverUrl, accessToken, userId, filterParams),
          jellyfinApi.getYears(serverUrl, accessToken, userId, filterParams),
        ]);
        if (!active) return;
        const mergedGenres = genresList.length > 0 ? genresList : (filters2.Genres ?? []);
        setServerGenres(mergedGenres);
        setServerTags(filters2.Tags ?? []);
        setAvailableYears(yearsList);
      } catch {
        if (active) {
          setServerGenres([]);
          setServerTags([]);
          setAvailableYears([]);
        }
      }
    }
    loadFilters();
    return () => {
      active = false;
    };
  }, [mode, selectedLibraryId, serverUrl, accessToken, userId, refreshSignal]);

  const [localRefresh, setLocalRefresh] = useState(0);
  const triggerReload = useCallback(() => setLocalRefresh((n) => n + 1), []);

  // Fetch initial page whenever query parameters change
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      async () => {
        if (!serverUrl || !accessToken || !userId) return;
        setLoading(true);
        try {
          if (mode === 'playlists') {
            const list = await jellyfinApi.getPlaylists(serverUrl, accessToken, userId);
            if (!active) return;
            setItems(list);
            setTotalCount(list.length);
            return;
          }
          const res = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            includeItemTypes: resolveIncludeTypes(mode),
            sortBy,
            sortOrder,
            filters: mode === 'favorites' ? 'IsFavorite' : undefined,
            genres: selectedGenre || undefined,
            tags: selectedTag || undefined,
            years: selectedYear,
            parentId: selectedLibraryId || undefined,
            searchTerm: mode === 'search' ? searchTerm.trim() || undefined : undefined,
            startIndex: 0,
            limit: CATALOG_PAGE_SIZE,
          });

          if (!active) return;
          setItems(res.Items);
          setTotalCount(res.TotalRecordCount);
        } finally {
          if (active) setLoading(false);
        }
      },
      mode === 'search' ? 220 : 0
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    mode,
    sortBy,
    sortOrder,
    selectedGenre,
    selectedTag,
    selectedYear,
    selectedLibraryId,
    searchTerm,
    serverUrl,
    accessToken,
    userId,
    refreshSignal,
    localRefresh,
  ]);

  const hasMore = items.length < totalCount;

  const loadMore = useCallback(async () => {
    if (!serverUrl || !accessToken || !userId || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
        includeItemTypes: resolveIncludeTypes(mode),
        sortBy,
        sortOrder,
        filters: mode === 'favorites' ? 'IsFavorite' : undefined,
        genres: selectedGenre || undefined,
        tags: selectedTag || undefined,
        years: selectedYear,
        parentId: selectedLibraryId || undefined,
        searchTerm: mode === 'search' ? searchTerm.trim() || undefined : undefined,
        startIndex: items.length,
        limit: CATALOG_PAGE_SIZE,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.Id));
        return [...prev, ...res.Items.filter((i) => !seen.has(i.Id))];
      });
      setTotalCount(res.TotalRecordCount);
    } finally {
      setLoadingMore(false);
    }
  }, [
    serverUrl,
    accessToken,
    userId,
    loading,
    loadingMore,
    hasMore,
    mode,
    sortBy,
    sortOrder,
    selectedGenre,
    selectedTag,
    selectedYear,
    selectedLibraryId,
    searchTerm,
    items.length,
  ]);

  const hydratedItems = useMemo(() => {
    const merged = items.map((item) =>
      mutatedItems[item.Id] ? { ...item, ...mutatedItems[item.Id] } : item
    );
    if (mode === 'favorites') {
      return merged.filter((item) => item.UserData?.IsFavorite);
    }
    return merged;
  }, [items, mutatedItems, mode]);

  const availableLibraries = useMemo(() => {
    return allViews.filter((v) => {
      const colType = v.CollectionType?.toLowerCase();
      if (mode === 'movies') return colType === 'movies';
      if (mode === 'series') return colType === 'tvshows';
      if (mode === 'collections') return colType === 'boxsets';
      return colType === 'movies' || colType === 'tvshows' || !colType;
    });
  }, [allViews, mode]);

  const availableGenres = useMemo(() => {
    const source = serverGenres.length > 0 ? serverGenres : items.flatMap((i) => i.Genres ?? []);
    return Array.from(new Set(source)).sort((a, b) => a.localeCompare(b, locale));
  }, [serverGenres, items, locale]);

  return {
    loading,
    loadingMore,
    hasMore,
    totalCount,
    hydratedItems,
    availableGenres,
    availableTags: serverTags,
    availableYears,
    availableLibraries,
    loadMore,
    triggerReload,
  };
}
