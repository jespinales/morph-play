import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BaseItemDto } from '../types/jellyfin';
import { MediaCard, MediaCardVariant } from './MediaCard';

interface MediaRowProps {
  title: string;
  items: BaseItemDto[];
  variant?: MediaCardVariant;
  seeAllTo?: string;
  removeLabel?: string;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => void;
  onRemove?: (item: BaseItemDto) => void;
}

export const MediaRow: React.FC<MediaRowProps> = ({
  title,
  items,
  variant = 'poster',
  seeAllTo,
  removeLabel,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onRemove,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items.length) return null;

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = Math.max(el.clientWidth * 0.78, 320);
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="relative group/row py-3 sm:py-4">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {seeAllTo ? (
            <Link
              to={seeAllTo}
              className="group/title inline-flex items-center gap-1.5 text-lg sm:text-xl font-bold text-white hover:text-[#00A4DC] transition-colors"
            >
              <span>{title}</span>
              <ChevronRight className="w-5 h-5 text-zinc-400 group-hover/title:text-[#00A4DC] group-hover/title:translate-x-0.5 transition-all" />
            </Link>
          ) : (
            <h2 className="text-lg sm:text-xl font-bold text-white">{title}</h2>
          )}
        </div>
      </div>

      <div className="relative max-w-[1920px] mx-auto">
        {/* Botón Izquierdo */}
        <button
          type="button"
          onClick={() => scrollByAmount('left')}
          aria-label={`Desplazar ${title} a la izquierda`}
          className="hidden [@media(hover:hover)]:md:flex absolute left-2 top-1/2 -translate-y-1/2 z-30 w-10 h-20 items-center justify-center rounded-xl bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 backdrop-blur-sm border border-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Contenedor horizontal */}
        <div
          ref={scrollRef}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto touch-pan-x no-scrollbar scroll-smooth px-4 sm:px-6 lg:px-12 py-3"
        >
          {items.map((item, idx) => (
            <MediaCard
              key={item.Id}
              item={item}
              variant={variant}
              rank={variant === 'top10' ? idx + 1 : undefined}
              removeLabel={removeLabel}
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              onToggleFavorite={onToggleFavorite}
              onRemove={onRemove}
            />
          ))}
        </div>

        {/* Botón Derecho */}
        <button
          type="button"
          onClick={() => scrollByAmount('right')}
          aria-label={`Desplazar ${title} a la derecha`}
          className="hidden [@media(hover:hover)]:md:flex absolute right-2 top-1/2 -translate-y-1/2 z-30 w-10 h-20 items-center justify-center rounded-xl bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 backdrop-blur-sm border border-white/10"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </section>
  );
};
