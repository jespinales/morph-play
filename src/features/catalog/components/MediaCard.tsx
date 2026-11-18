import React, { useState } from 'react';
import { Check, Info, Play, Plus, Star, X } from 'lucide-react';
import { useAuth } from '../../../app/providers/AuthProvider';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { getItemImageUrl } from '../../../shared/api/playback';
import { BaseItemDto } from '../../../shared/types/jellyfin';

export type MediaCardVariant = 'poster' | 'continue' | 'top10';

interface MediaCardProps {
  item: BaseItemDto;
  variant?: MediaCardVariant;
  rank?: number;
  fullWidth?: boolean;
  removeLabel?: string;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => void;
  onRemove?: (item: BaseItemDto) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  variant = 'poster',
  rank,
  fullWidth = false,
  removeLabel,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onRemove,
}) => {
  const { serverUrl } = useAuth();
  const { t } = usePreferences();
  const [imgError, setImgError] = useState(false);

  const effectiveRemoveLabel = removeLabel ?? t.card.defaultRemove;
  const isContinue = variant === 'continue';
  const imageUrl = !imgError
    ? getItemImageUrl(serverUrl, item, isContinue ? 'Backdrop' : 'Primary', isContinue ? 640 : 420)
    : null;

  const isFavorite = Boolean(item.UserData?.IsFavorite);
  const unplayedCount = item.UserData?.UnplayedItemCount;
  const isPlayed = Boolean(item.UserData?.Played);

  // Compute progress percentage for Continue Watching cards
  const progressPercent = (() => {
    if (typeof item.UserData?.PlayedPercentage === 'number') {
      return Math.min(100, Math.max(0, item.UserData.PlayedPercentage));
    }
    const pos = item.UserData?.PlaybackPositionTicks ?? 0;
    const total = item.RunTimeTicks ?? 0;
    if (pos > 0 && total > 0) {
      return Math.min(100, Math.round((pos / total) * 100));
    }
    return 0;
  })();

  if (isContinue) {
    const episodeLabel =
      item.Type === 'Episode' && item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined
        ? `${t.common.episodeCode(item.ParentIndexNumber, item.IndexNumber)} · ${item.Name}`
        : item.ProductionYear
          ? `${item.ProductionYear}`
          : '';

    const displayTitle = item.SeriesName || item.Name;

    return (
      <article className="group relative flex-shrink-0 w-[260px] sm:w-[300px] lg:w-[330px] rounded-xl overflow-hidden bg-[#12131a] ring-1 ring-white/10 hover:ring-white/30 transition-all duration-300 [@media(hover:hover)]:hover:scale-[1.03] shadow-lg">
        <div className="relative aspect-video w-full overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={displayTitle}
              loading="lazy"
              draggable={false}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#272038] to-[#121826] flex items-center justify-center p-4 text-center">
              <span className="text-sm font-bold text-white/80">{displayTitle}</span>
            </div>
          )}

          {/* Bottom gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent pointer-events-none" />

          {/* Primary tap/click trigger for playback (sibling of secondary icon buttons) */}
          <button
            type="button"
            onClick={() => onPlay(item)}
            aria-label={t.card.playAria(displayTitle)}
            className="absolute inset-0 z-10 w-full h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00A4DC]"
          />

          {/* Discrete remove button for Continue Watching / Next Up */}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`${effectiveRemoveLabel}: ${displayTitle}`}
              title={effectiveRemoveLabel}
              className="absolute top-2 right-2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-rose-600/90 active:scale-95 text-white/85 hover:text-white border border-white/15 backdrop-blur-sm opacity-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Centered play icon */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none opacity-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200">
            <div className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center shadow-2xl transform [@media(hover:hover)]:group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 fill-black ml-0.5" />
            </div>
          </div>

          {/* Title and episode label */}
          <div className="absolute bottom-3 left-3 right-12 z-10 pointer-events-none">
            <h3 className="text-sm font-bold text-white truncate drop-shadow">{displayTitle}</h3>
            {episodeLabel && (
              <p className="text-xs text-zinc-300 truncate mt-0.5 drop-shadow">{episodeLabel}</p>
            )}
          </div>

          {/* Quick details button */}
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            aria-label={t.card.detailsAria(displayTitle)}
            title={t.card.moreInfo}
            className="absolute bottom-2 right-2 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-white/25 active:scale-95 text-white/90 border border-white/15 transition-all"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Progress bar */}
          {progressPercent > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-10 pointer-events-none">
              <div
                className="h-full bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </article>
    );
  }

  const cardInner = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDetail(item);
        }
      }}
      className="group relative aspect-[2/3] w-full rounded-lg overflow-hidden bg-[#12131a] ring-1 ring-white/10 hover:ring-white/35 transition-all duration-300 [@media(hover:hover)]:md:hover:scale-[1.06] [@media(hover:hover)]:md:hover:z-20 active:scale-[0.98] shadow-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC]"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={item.Name}
          loading="lazy"
          draggable={false}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#2a1f3d] via-[#172133] to-[#0e1018] flex flex-col items-center justify-center p-4 text-center">
          <span className="text-sm sm:text-base font-bold text-white line-clamp-3">{item.Name}</span>
          {item.ProductionYear && (
            <span className="text-xs text-zinc-400 mt-1.5">{item.ProductionYear}</span>
          )}
        </div>
      )}

      {/* Subtle top status badges */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 pointer-events-none">
        {typeof unplayedCount === 'number' && unplayedCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-md bg-[#00A4DC] text-white text-[11px] font-bold shadow">
            {unplayedCount}
          </span>
        )}
        {isPlayed && !unplayedCount && (
          <span
            title={t.card.watched}
            className="w-5 h-5 rounded-full bg-emerald-500/90 text-black flex items-center justify-center shadow"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Action overlay: always visible & actionable on touch devices; revealed on hover for pointer devices */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent [@media(hover:hover)]:via-black/45 opacity-100 pointer-events-auto [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto group-focus-visible:opacity-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200 flex flex-col justify-end p-2.5 sm:p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(item);
            }}
            aria-label={t.card.playAria(item.Name)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center shadow transition-transform active:scale-95"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black ml-0.5" />
          </button>

          {item.Type !== 'BoxSet' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item);
              }}
              aria-label={isFavorite ? t.card.removeFromList : t.card.addToList}
              title={isFavorite ? t.card.removeFromList : t.card.addToList}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'bg-[#00A4DC]/25 border-[#00A4DC] text-[#00A4DC]'
                  : 'bg-black/50 border-white/35 text-white hover:border-white'
              }`}
            >
              {isFavorite ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(item);
            }}
            aria-label={t.card.moreInfoAria(item.Name)}
            className="ml-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/50 border border-white/35 text-white hover:border-white flex items-center justify-center transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
          {item.Name}
        </h3>

        <div className="flex items-center gap-2 text-[11px] text-zinc-300 mt-1">
          {item.CommunityRating && (
            <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold">
              <Star className="w-3 h-3 fill-emerald-400" />
              {item.CommunityRating.toFixed(1)}
            </span>
          )}
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="px-1 rounded border border-white/25 text-[10px]">
              {item.OfficialRating}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === 'top10' && rank !== undefined) {
    return (
      <article className="relative flex-shrink-0 flex items-end pl-10 sm:pl-14 w-[200px] sm:w-[235px] lg:w-[255px]">
        <span
          aria-hidden="true"
          className="top-rank-number absolute left-0 bottom-0 text-[125px] sm:text-[155px] lg:text-[175px] pointer-events-none z-0"
        >
          {rank}
        </span>
        <div className="relative z-10 w-full">{cardInner}</div>
      </article>
    );
  }

  return (
    <article className={fullWidth ? 'w-full' : 'flex-shrink-0 w-[142px] sm:w-[168px] lg:w-[192px]'}>
      {cardInner}
    </article>
  );
};
