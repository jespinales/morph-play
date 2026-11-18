import React from 'react';
import { SkipForward, X } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { getItemImageUrl } from '../../../shared/api/playback';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface NextEpisodeCardProps {
  serverUrl: string;
  nextEpisode: BaseItemDto;
  onPlayNow: () => void;
  onDismiss: () => void;
}

export const NextEpisodeCard: React.FC<NextEpisodeCardProps> = ({
  serverUrl,
  nextEpisode,
  onPlayNow,
  onDismiss,
}) => {
  const { t } = usePreferences();
  const nextThumb =
    getItemImageUrl(serverUrl, nextEpisode, 'Primary', 480) ||
    getItemImageUrl(serverUrl, nextEpisode, 'Backdrop', 480);

  return (
    <div className="absolute right-4 sm:right-10 bottom-36 sm:bottom-44 z-30 bg-[#141620]/95 backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-2xl w-[calc(100vw-2rem)] max-w-[300px] animate-fadeIn">
      {nextThumb && (
        <div className="relative aspect-video w-full overflow-hidden bg-black/50">
          <img
            src={nextThumb}
            alt={nextEpisode.Name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141620] via-transparent to-black/35 pointer-events-none" />
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.player.hideNextPromptAria}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 hover:bg-black/90 border border-white/15 flex items-center justify-center text-white/90 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className={nextThumb ? 'p-3.5 pt-2' : 'p-4'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00A4DC]">
              {t.player.nextEpisode}
            </p>
            <p className="text-sm font-bold text-white mt-0.5 truncate">
              {t.common.episodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber)} ·{' '}
              {nextEpisode.Name}
            </p>
          </div>
          {!nextThumb && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t.player.hideNextPromptAria}
              className="w-8 h-8 -mt-1 -mr-1 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onPlayNow}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-[0.98] transition-all"
        >
          <SkipForward className="w-4 h-4 fill-black" />
          {t.player.playNow}
        </button>
      </div>
    </div>
  );
};
