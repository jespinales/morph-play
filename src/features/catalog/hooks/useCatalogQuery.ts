import { useEffect, useMemo, useState } from 'react';
import { jellyfinApi } from '../../../shared/api/jellyfin';
import { BaseItemDto } from '../../../shared/types/jellyfin';

export type CatalogMode = 'movies' | 'series' | 'collections' | 'favorites' | 'search';

interface UseCatalogQueryParams {
  mode: CatalogMode;
  sortBy: string;
  sortOrder: 'Ascending' | 'Descending';
  selectedGenre: string;
  searchTerm: string;
  locale: string;
  serverUrl: string;
  accessToken: string | null;
  userId?: string;
  refreshSignal: number;
  mutatedItems: Record<string, BaseItemDto>;
}

export function useCatalogQuery({
  mode,
  sortBy,
  sortOrder,
  selectedGenre,
  searchTerm,
  locale,
  serverUrl,
  accessToken,
  userId,
  refreshSignal,
  mutatedItems,
}: UseCatalogQueryParams) {
  const [items, setItems] = useState<BaseItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      async () => {
        if (!serverUrl || !accessToken || !userId) return;
        setLoading(true);
        try {
          const includeItemTypes =
            mode === 'movies'
              ? 'Movie'
              : mode === 'series'
                ? 'Series'
                : mode === 'collections'
                  ? 'BoxSet'
                  : 'Movie,Series';

          const res = await jellyfinApi.getItems(serverUrl, accessToken, userId, {
            includeItemTypes,
            sortBy,
            sortOrder,
            filters: mode === 'favorites' ? 'IsFavorite' : undefined,
            genres: selectedGenre || undefined,
            searchTerm: mode === 'search' ? searchTerm.trim() || undefined : undefined,
            limit: 120,
          });

          if (!active) return;
          setItems(res.Items);
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
  }, [mode, sortBy, sortOrder, selectedGenre, searchTerm, serverUrl, accessToken, userId, refreshSignal]);

  const hydratedItems = useMemo(() => {
    const merged = items.map((item) =>
      mutatedItems[item.Id] ? { ...item, ...mutatedItems[item.Id] } : item
    );
    if (mode === 'favorites') {
      return merged.filter((item) => item.UserData?.IsFavorite);
    }
    return merged;
  }, [items, mutatedItems, mode]);

  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => item.Genres?.forEach((g) => set.add(g)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, locale));
  }, [items, locale]);

  return {
    loading,
    hydratedItems,
    availableGenres,
  };
}
