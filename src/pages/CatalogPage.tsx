import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Film, Layers, Search, SlidersHorizontal, Tv } from 'lucide-react';
import { BaseItemDto } from '../types/jellyfin';
import { useAuth } from '../context/AuthContext';
import { jellyfinApi } from '../services/jellyfinApi';
import { MediaCard } from '../components/MediaCard';

export type CatalogMode = 'movies' | 'series' | 'collections' | 'favorites' | 'search';

interface CatalogPageProps {
  mode: CatalogMode;
  refreshSignal: number;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => Promise<void>;
  mutatedItems: Record<string, BaseItemDto>;
}

const SORT_OPTIONS = [
  { value: 'DateCreated', label: 'Recientes primero', order: 'Descending' as const },
  { value: 'CommunityRating', label: 'Mejor valoradas', order: 'Descending' as const },
  { value: 'ProductionYear', label: 'Año de estreno', order: 'Descending' as const },
  { value: 'SortName', label: 'Alfabético (A–Z)', order: 'Ascending' as const },
];

export const CatalogPage: React.FC<CatalogPageProps> = ({
  mode,
  refreshSignal,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  mutatedItems,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';

  const [localSearch, setLocalSearch] = useState(urlQuery);
  const [sortBy, setSortBy] = useState('DateCreated');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [items, setItems] = useState<BaseItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLocalSearch(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    setSelectedGenre('');
  }, [mode]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(
      async () => {
        if (!serverUrl || !accessToken || !user) return;
        setLoading(true);
        try {
          const sortCfg = SORT_OPTIONS.find((s) => s.value === sortBy) ?? SORT_OPTIONS[0];
          const includeItemTypes =
            mode === 'movies'
              ? 'Movie'
              : mode === 'series'
                ? 'Series'
                : mode === 'collections'
                  ? 'BoxSet'
                  : 'Movie,Series';

          const res = await jellyfinApi.getItems(serverUrl, accessToken, user.Id, {
            includeItemTypes,
            sortBy: sortCfg.value,
            sortOrder: sortCfg.order,
            filters: mode === 'favorites' ? 'IsFavorite' : undefined,
            genres: selectedGenre || undefined,
            searchTerm: mode === 'search' ? localSearch.trim() || undefined : undefined,
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
  }, [mode, sortBy, selectedGenre, localSearch, serverUrl, accessToken, user, refreshSignal]);

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
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [items]);

  const meta = {
    movies: { title: 'Películas', icon: Film, empty: 'No se encontraron películas.' },
    series: { title: 'Series', icon: Tv, empty: 'No se encontraron series.' },
    collections: {
      title: 'Colecciones',
      icon: Layers,
      empty: 'No hay colecciones configuradas en el servidor.',
    },
    favorites: {
      title: 'Mi lista',
      icon: Bookmark,
      empty: 'Aún no has agregado títulos a Mi lista.',
    },
    search: {
      title: localSearch.trim() ? `Resultados para “${localSearch.trim()}”` : 'Explorar catálogo',
      icon: Search,
      empty: 'No hay coincidencias para tu búsqueda.',
    },
  }[mode];

  const HeaderIcon = meta.icon;

  return (
    <main className="min-h-screen pt-24 pb-24 md:pb-16 max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 space-y-6 animate-fadeIn">
      {/* Cabecera y Filtros */}
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
              {loading ? 'Cargando títulos…' : `${hydratedItems.length} títulos disponibles`}
            </p>
          </div>
        </div>

        {/* Controles de orden y género */}
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
                placeholder="Buscar película, serie o género…"
                aria-label="Buscar película, serie o género"
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
                aria-label="Filtrar por género"
                className="bg-[#12131a] border border-white/10 rounded-xl pl-9 pr-3 py-2 min-h-[38px] text-xs sm:text-sm text-white focus:outline-none focus:border-[#00A4DC] cursor-pointer"
              >
                <option value="" className="bg-[#12131a]">
                  Todos los géneros
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
            aria-label="Ordenar catálogo"
            className="bg-[#12131a] border border-white/10 rounded-xl px-3 py-2 min-h-[38px] text-xs sm:text-sm text-white focus:outline-none focus:border-[#00A4DC] cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#12131a]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cuadrícula adaptable */}
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
              Limpiar filtro de género
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
