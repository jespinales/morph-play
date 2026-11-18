import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Film, Layers, Search, SlidersHorizontal, Tv } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { BaseItemDto } from '../../shared/types/jellyfin';
import { MediaCard } from './components/MediaCard';
import { CatalogMode, useCatalogQuery } from './hooks/useCatalogQuery';

export type { CatalogMode };

interface CatalogPageProps {
  mode: CatalogMode;
  refreshSignal: number;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => Promise<void>;
  mutatedItems: Record<string, BaseItemDto>;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({
  mode,
  refreshSignal,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  mutatedItems,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const { locale, t } = usePreferences();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [localSearch, setLocalSearch] = useState(urlQuery);
  const [sortBy, setSortBy] = useState('DateCreated');
  const [selectedGenre, setSelectedGenre] = useState('');

  const sortOptions = useMemo(
    () => [
      { value: 'DateCreated', label: t.catalog.sortRecent, order: 'Descending' as const },
      { value: 'CommunityRating', label: t.catalog.sortTopRated, order: 'Descending' as const },
      { value: 'ProductionYear', label: t.catalog.sortReleaseYear, order: 'Descending' as const },
      { value: 'SortName', label: t.catalog.sortAlpha, order: 'Ascending' as const },
    ],
    [t]
  );

  const sortCfg = sortOptions.find((s) => s.value === sortBy) ?? sortOptions[0];

  useEffect(() => {
    setLocalSearch(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    setSelectedGenre('');
  }, [mode]);

  const { loading, hydratedItems, availableGenres } = useCatalogQuery({
    mode,
    sortBy: sortCfg.value,
    sortOrder: sortCfg.order,
    selectedGenre,
    searchTerm: localSearch,
    locale,
    serverUrl,
    accessToken,
    userId: user?.Id,
    refreshSignal,
    mutatedItems,
  });

  const meta = {
    movies: { title: t.catalog.movies, icon: Film, empty: t.catalog.emptyMovies },
    series: { title: t.catalog.series, icon: Tv, empty: t.catalog.emptySeries },
    collections: {
      title: t.catalog.collections,
      icon: Layers,
      empty: t.catalog.emptyCollections,
    },
    favorites: {
      title: t.catalog.favorites,
      icon: Bookmark,
      empty: t.catalog.emptyFavorites,
    },
    search: {
      title: localSearch.trim() ? t.catalog.searchResultsFor(localSearch.trim()) : t.catalog.searchTitle,
      icon: Search,
      empty: t.catalog.emptySearch,
    },
  }[mode];

  const HeaderIcon = meta.icon;

  return (
    <main className="min-h-screen pt-24 pb-24 md:pb-16 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 space-y-6 animate-fadeIn">
      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#AA5CC3]/25 to-[#00A4DC]/25 border border-white/10 flex items-center justify-center text-[#00A4DC]">
            <HeaderIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {meta.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              {loading ? t.catalog.loadingTitles : t.catalog.availableTitles(hydratedItems.length)}
            </p>
          </div>
        </div>

        {/* Sort and genre controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {mode === 'search' && (
            <div className="relative w-full sm:w-64 lg:hidden">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="catalog-search-input"
                name="q"
                type="text"
                value={localSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setLocalSearch(val);
                  setSearchParams(val ? { q: val } : {}, { replace: true });
                }}
                placeholder={t.catalog.searchInputPlaceholder}
                aria-label={t.catalog.searchInputAria}
                className="w-full pl-9 pr-3 py-2 min-h-[38px] rounded-xl bg-[#12131a] border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
              />
            </div>
          )}

          {availableGenres.length > 0 && mode !== 'collections' && (
            <div className="relative flex items-center">
              <SlidersHorizontal className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
              <select
                id="catalog-genre-filter"
                name="genre"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                aria-label={t.catalog.filterGenreAria}
                className="bg-[#12131a] border border-white/10 rounded-xl pl-9 pr-3 py-2 min-h-[38px] text-xs sm:text-sm text-white focus:outline-none focus:border-[#00A4DC] cursor-pointer"
              >
                <option value="" className="bg-[#12131a]">
                  {t.catalog.allGenres}
                </option>
                {availableGenres.map((genre) => (
                  <option key={genre} value={genre} className="bg-[#12131a]">
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <select
            id="catalog-sort-order"
            name="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label={t.catalog.sortCatalogAria}
            className="bg-[#12131a] border border-white/10 rounded-xl px-3 py-2 min-h-[38px] text-xs sm:text-sm text-white focus:outline-none focus:border-[#00A4DC] cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#12131a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : hydratedItems.length === 0 ? (
        <div className="rounded-2xl bg-[#12131a]/60 border border-white/10 p-12 text-center space-y-2">
          <HeaderIcon className="w-10 h-10 text-zinc-500 mx-auto" />
          <p className="text-base font-semibold text-zinc-200">{meta.empty}</p>
          {selectedGenre && (
            <button
              type="button"
              onClick={() => setSelectedGenre('')}
              className="mt-2 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
            >
              {t.catalog.clearGenreFilter}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4 lg:gap-5">
          {hydratedItems.map((item) => (
            <MediaCard
              key={item.Id}
              item={item}
              fullWidth
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </main>
  );
};
