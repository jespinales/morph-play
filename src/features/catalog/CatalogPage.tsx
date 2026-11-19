import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpDown,
  Bookmark,
  Calendar,
  Film,
  FolderOpen,
  Layers,
  ListVideo,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Tv,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { jellyfinApi } from '../../shared/api/jellyfin';
import { FilterSelect } from '../../shared/components/FilterSelect';
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [localSearch, setLocalSearch] = useState(urlQuery);
  const [sortBy, setSortBy] = useState('DateCreated');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

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
    setSelectedTag('');
    setSelectedYear(undefined);
    setSelectedLibraryId('');
  }, [mode]);

  // Hydrate catalog sort preference from Jellyfin DisplayPreferences
  useEffect(() => {
    let active = true;
    async function loadDisplayPrefs() {
      if (!serverUrl || !accessToken || !user?.Id || mode === 'playlists') return;
      const prefs = await jellyfinApi.getDisplayPreferences(
        serverUrl,
        accessToken,
        `morphplay-${mode}`,
        user.Id
      );
      if (active && prefs?.SortBy && sortOptions.some((s) => s.value === prefs.SortBy)) {
        setSortBy(prefs.SortBy);
      }
    }
    loadDisplayPrefs();
    return () => {
      active = false;
    };
  }, [mode, serverUrl, accessToken, user?.Id, sortOptions]);

  const handleSortChange = (nextSortBy: string) => {
    setSortBy(nextSortBy);
    if (!serverUrl || !accessToken || !user?.Id || mode === 'playlists') return;
    const cfg = sortOptions.find((s) => s.value === nextSortBy);
    void jellyfinApi.updateDisplayPreferences(serverUrl, accessToken, `morphplay-${mode}`, user.Id, {
      SortBy: nextSortBy,
      SortOrder: cfg?.order ?? 'Descending',
    });
  };

  const {
    loading,
    loadingMore,
    hasMore,
    totalCount,
    hydratedItems,
    availableGenres,
    availableTags,
    availableYears,
    availableLibraries,
    loadMore,
    triggerReload,
  } = useCatalogQuery({
    mode,
    sortBy: sortCfg.value,
    sortOrder: sortCfg.order,
    selectedGenre,
    selectedTag,
    selectedYear,
    selectedLibraryId,
    searchTerm: localSearch,
    locale,
    serverUrl,
    accessToken,
    userId: user?.Id,
    refreshSignal,
    mutatedItems,
  });

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  const meta = {
    movies: { title: t.catalog.movies, icon: Film, empty: t.catalog.emptyMovies },
    series: { title: t.catalog.series, icon: Tv, empty: t.catalog.emptySeries },
    collections: {
      title: t.catalog.collections,
      icon: Layers,
      empty: t.catalog.emptyCollections,
    },
    playlists: {
      title: t.catalog.playlists,
      icon: ListVideo,
      empty: t.catalog.emptyPlaylists,
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

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !user || !newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    try {
      await jellyfinApi.createPlaylist(serverUrl, accessToken, user.Id, newPlaylistName.trim());
      setNewPlaylistName('');
      triggerReload();
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !newCollectionName.trim()) return;
    setCreatingCollection(true);
    try {
      await jellyfinApi.createCollection(serverUrl, accessToken, newCollectionName.trim());
      setNewCollectionName('');
      triggerReload();
    } finally {
      setCreatingCollection(false);
    }
  };

  return (
    <main className="min-h-screen pt-24 pb-24 md:pb-16 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 space-y-6 animate-fadeIn">
      {/* Header and filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#AA5CC3]/25 to-[#00A4DC]/25 border border-white/10 flex items-center justify-center text-[#00A4DC]">
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {meta.title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                {loading
                  ? t.catalog.loadingTitles
                  : totalCount > hydratedItems.length
                    ? t.catalog.showingCount(hydratedItems.length, totalCount)
                    : t.catalog.availableTitles(hydratedItems.length)}
              </p>
            </div>
          </div>

          {(mode === 'collections' || mode === 'playlists') && (
            <div className="inline-flex rounded-xl bg-[#12131a] border border-white/10 p-1">
              <button
                type="button"
                onClick={() => navigate('/collections')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'collections'
                    ? 'bg-white/15 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.catalog.collections}
              </button>
              <button
                type="button"
                onClick={() => navigate('/playlists')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  mode === 'playlists'
                    ? 'bg-white/15 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.catalog.playlists}
              </button>
            </div>
          )}
        </div>

        {/* Sort and genre controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {mode === 'playlists' && (
            <form onSubmit={handleCreatePlaylist} className="flex items-center gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder={t.catalog.createPlaylistPlaceholder}
                aria-label={t.catalog.newPlaylist}
                className="bg-[#12131a] border border-white/15 rounded-xl px-3 py-2 min-h-[38px] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
              />
              <button
                type="submit"
                disabled={creatingPlaylist || !newPlaylistName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-xs sm:text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{t.catalog.createPlaylistBtn}</span>
              </button>
            </form>
          )}
          {mode === 'collections' && (
            <form onSubmit={handleCreateCollection} className="flex items-center gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder={t.catalog.createCollectionPlaceholder}
                aria-label={t.catalog.newCollection}
                className="bg-[#12131a] border border-white/15 rounded-xl px-3 py-2 min-h-[38px] text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
              />
              <button
                type="submit"
                disabled={creatingCollection || !newCollectionName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-xs sm:text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{t.catalog.createCollectionBtn}</span>
              </button>
            </form>
          )}
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

          {(availableLibraries.length > 1 || (mode === 'search' && availableLibraries.length > 0)) && (
            <FilterSelect
              id="catalog-library-filter"
              value={selectedLibraryId}
              onChange={setSelectedLibraryId}
              ariaLabel={t.catalog.filterLibraryAria}
              icon={<FolderOpen className="w-4 h-4" />}
              options={[
                { value: '', label: t.catalog.allLibraries },
                ...availableLibraries.map((lib) => ({ value: lib.Id, label: lib.Name })),
              ]}
            />
          )}

          {availableGenres.length > 0 && mode !== 'collections' && mode !== 'playlists' && (
            <FilterSelect
              id="catalog-genre-filter"
              value={selectedGenre}
              onChange={setSelectedGenre}
              ariaLabel={t.catalog.filterGenreAria}
              icon={<SlidersHorizontal className="w-4 h-4" />}
              options={[
                { value: '', label: t.catalog.allGenres },
                ...availableGenres.map((genre) => ({ value: genre, label: genre })),
              ]}
            />
          )}

          {availableTags.length > 0 && mode !== 'collections' && mode !== 'playlists' && (
            <FilterSelect
              id="catalog-tag-filter"
              value={selectedTag}
              onChange={setSelectedTag}
              ariaLabel={t.catalog.filterTagAria}
              icon={<Tag className="w-4 h-4" />}
              options={[
                { value: '', label: t.catalog.allTags },
                ...availableTags.map((tag) => ({ value: tag, label: tag })),
              ]}
            />
          )}

          {availableYears.length > 0 && mode !== 'collections' && mode !== 'playlists' && (
            <FilterSelect
              id="catalog-year-filter"
              value={selectedYear !== undefined ? String(selectedYear) : ''}
              onChange={(val) =>
                setSelectedYear(val ? Number.parseInt(val, 10) : undefined)
              }
              ariaLabel={t.catalog.filterYearAria}
              icon={<Calendar className="w-4 h-4" />}
              options={[
                { value: '', label: t.catalog.allYears },
                ...availableYears.map((yr) => ({ value: String(yr), label: String(yr) })),
              ]}
            />
          )}

          {mode !== 'playlists' && (
            <FilterSelect
              id="catalog-sort-order"
              value={sortBy}
              onChange={handleSortChange}
              ariaLabel={t.catalog.sortCatalogAria}
              icon={<ArrowUpDown className="w-4 h-4" />}
              highlightActive={false}
              options={sortOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
            />
          )}
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
        <div className="space-y-6">
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

          {hasMore && (
            <div ref={loadMoreSentinelRef} className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin text-[#00A4DC]" />}
                <span>{loadingMore ? t.catalog.loadingMore : t.catalog.loadMore}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
};
