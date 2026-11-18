import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Info, Play, Plus, Star } from 'lucide-react';
import { BaseItemDto } from '../types/jellyfin';
import { useAuth } from '../context/AuthContext';
import { formatDurationFromTicks, getItemImageUrl } from '../services/jellyfinApi';

interface HeroBannerProps {
  items: BaseItemDto[];
  isPaused?: boolean;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  isPaused = false,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
}) => {
  const { serverUrl } = useAuth();
  const [activeIndex, setActiveIndex] = useState(0);
  const [logoFailed, setLogoFailed] = useState<Record<string, boolean>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(0);
    }
  }, [items.length, activeIndex]);

  useEffect(() => {
    if (items.length <= 1 || isPaused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [items.length, isPaused]);

  if (!items.length) {
    return (
      <section className="relative h-[60vh] md:h-[78vh] w-full bg-[#12131a] animate-pulse" />
    );
  }

  const current = items[activeIndex] ?? items[0];
  const backdropUrl = getItemImageUrl(serverUrl, current, 'Backdrop', 1920);
  const logoUrl = !logoFailed[current.Id] ? getItemImageUrl(serverUrl, current, 'Logo', 700) : null;
  const durationLabel = formatDurationFromTicks(current.RunTimeTicks);
  const isFavorite = Boolean(current.UserData?.IsFavorite);
  const hasResume = (current.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const is4k = current.MediaStreams?.some((s) => s.Type === 'Video' && (s.Width ?? 0) >= 3800);

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % items.length);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    const t = e.touches[0];
    if (t) touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    if (!touchStartRef.current || items.length <= 1) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  return (
    <section
      aria-label="Destacados"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-[570px] sm:h-[690px] lg:h-[82vh] lg:min-h-[540px] lg:max-h-[820px] bg-[#0a0a0e] overflow-hidden select-none"
    >
      {/* Encuadre cinematográfico: alto fijo del banner en móvil/tablet para evitar saltos al cambiar de título */}
      <div className="absolute inset-x-0 top-0 pt-12 sm:pt-14 lg:pt-0 lg:inset-0 overflow-hidden bg-[#0a0a0e]">
        <div className="relative w-full aspect-video lg:ml-auto lg:w-auto lg:h-full lg:aspect-video lg:max-w-[78vw]">
          {backdropUrl ? (
            <img
              key={current.Id}
              src={backdropUrl}
              alt={current.Name}
              className="hero-backdrop-mask w-full h-full object-cover object-center transition-opacity duration-700 animate-fadeIn"
            />
          ) : (
            <div className="hero-backdrop-mask w-full h-full bg-gradient-to-br from-[#2d1a3e] via-[#121826] to-[#0a0a0e]" />
          )}

          {/* Fundidos suaves desde los bordes de la imagen hacia el lienzo #0a0a0e (escritorio) */}
          <div className="hidden lg:block absolute inset-y-0 -left-px w-[48%] bg-gradient-to-r from-[#0a0a0e] via-[#0a0a0e]/70 to-transparent" />
          <div className="hidden lg:block absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0a0a0e]/55 to-transparent" />
          <div className="hidden lg:block absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0a0a0e] via-[#0a0a0e]/50 to-transparent" />
          <div className="hidden lg:block absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0a0a0e]/75 to-transparent" />
        </div>
      </div>

      {/* Contenido principal del Hero */}
      <div className="relative z-10 w-full h-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-16 flex flex-col justify-end pb-16 sm:pb-20 lg:pb-24">
        <div className="max-w-2xl space-y-3 sm:space-y-4">
          {/* Etiqueta de tipo */}
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200">
            <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]" />
            {current.Type === 'Series' ? 'Serie destacada' : 'Película destacada'}
          </div>

          {/* Logo oficial del título (en caja de alto estable) o tipografía display */}
          <div className="h-20 sm:h-28 md:h-32 flex items-end">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={current.Name}
                onError={() => setLogoFailed((prev) => ({ ...prev, [current.Id]: true }))}
                className="max-h-full max-w-[85%] object-contain object-left [filter:drop-shadow(0_0_1px_rgba(255,255,255,0.45))_drop-shadow(0_6px_24px_rgba(0,0,0,0.85))]"
              />
            ) : (
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] leading-[1.06] line-clamp-2">
                {current.Name}
              </h1>
            )}
          </div>

          {/* Metadatos */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-zinc-200 font-medium">
            {current.CommunityRating && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                <Star className="w-4 h-4 fill-emerald-400" />
                {current.CommunityRating.toFixed(1)}
              </span>
            )}
            {current.ProductionYear && <span>{current.ProductionYear}</span>}
            {current.OfficialRating && (
              <span className="px-1.5 py-0.5 rounded border border-white/30 bg-white/5 text-[11px] font-semibold">
                {current.OfficialRating}
              </span>
            )}
            {durationLabel && <span>{durationLabel}</span>}
            {is4k && (
              <span className="px-1.5 py-0.5 rounded bg-white/15 text-[11px] font-bold tracking-wider">
                4K
              </span>
            )}
            {current.Genres && current.Genres.length > 0 && (
              <span className="text-zinc-300 hidden sm:inline">
                • {current.Genres.slice(0, 3).join(' · ')}
              </span>
            )}
          </div>

          {/* Sinopsis */}
          {current.Overview && (
            <p className="text-sm sm:text-base text-zinc-200/90 line-clamp-3 leading-relaxed max-w-xl drop-shadow">
              {current.Overview}
            </p>
          )}

          {/* Botones de acción */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onPlay(current)}
              className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 rounded-lg bg-white text-black font-bold text-sm sm:text-base hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
            >
              <Play className="w-5 h-5 fill-black" />
              {hasResume ? 'Reanudar' : 'Reproducir'}
            </button>

            <button
              type="button"
              onClick={() => onOpenDetail(current)}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-white/15 backdrop-blur-md text-white font-semibold text-sm sm:text-base hover:bg-white/25 active:scale-[0.98] transition-all border border-white/10"
            >
              <Info className="w-5 h-5" />
              Más información
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(current)}
              title={isFavorite ? 'Quitar de Mi lista' : 'Agregar a Mi lista'}
              aria-label={isFavorite ? 'Quitar de Mi lista' : 'Agregar a Mi lista'}
              className={`p-3 rounded-full border transition-all active:scale-95 ${
                isFavorite
                  ? 'bg-[#00A4DC]/20 border-[#00A4DC] text-[#00A4DC]'
                  : 'bg-white/10 border-white/25 text-white hover:bg-white/20'
              }`}
            >
              {isFavorite ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Controles del carrusel destacado */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Destacado anterior"
            className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/35 hover:bg-black/65 text-white/80 hover:text-white backdrop-blur-sm transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Siguiente destacado"
            className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 items-center justify-center rounded-full bg-black/35 hover:bg-black/65 text-white/80 hover:text-white backdrop-blur-sm transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-6 sm:bottom-10 lg:bottom-6 right-4 sm:right-8 lg:right-12 z-20 flex items-center">
            {items.map((item, idx) => (
              <button
                key={item.Id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Ver destacado ${idx + 1}: ${item.Name}`}
                className="min-w-[28px] min-h-[36px] py-2.5 px-1.5 flex items-center justify-center focus:outline-none"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeIndex
                      ? 'w-7 bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]'
                      : 'w-2.5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
