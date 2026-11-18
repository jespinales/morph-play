import React from 'react';
import { ArrowLeft, Play, RotateCcw, SkipForward } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { getItemImageUrl } from '../../../shared/api/playback';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface PlayerEndScreenProps {
  serverUrl: string;
  activeItem: BaseItemDto;
  nextEpisode: BaseItemDto | null;
  nextCountdown: number | null;
  similarItems: BaseItemDto[];
  titleDisplay: string;
  subtitleDisplay: string;
  onPlayNextEpisode: () => void;
  onCancelCountdown: () => void;
  onReplay: () => void;
  onClosePlayer: () => void;
  onPlaySimilar: (target: BaseItemDto) => void;
}

export const PlayerEndScreen: React.FC<PlayerEndScreenProps> = ({
  serverUrl,
  activeItem,
  nextEpisode,
  nextCountdown,
  similarItems,
  titleDisplay,
  subtitleDisplay,
  onPlayNextEpisode,
  onCancelCountdown,
  onReplay,
  onClosePlayer,
  onPlaySimilar,
}) => {
  const { t } = usePreferences();

  const bgUrl =
    getItemImageUrl(serverUrl, nextEpisode ?? activeItem, 'Backdrop', 1280) ||
    getItemImageUrl(serverUrl, activeItem, 'Primary', 800);

  return (
    <div className="absolute inset-0 z-[25] flex items-center justify-center p-4 sm:p-8 pb-24 sm:pb-28 overflow-y-auto bg-[#0a0a0e]/92">
      {bgUrl && (
        <img
          src={bgUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm scale-105 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/60 pointer-events-none" />

      <div className="relative z-10 w-full max-w-3xl space-y-6 animate-fadeIn">
        {nextEpisode && nextCountdown !== null ? (
          <div className="rounded-2xl bg-[#141620]/90 backdrop-blur-xl border border-white/15 p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row gap-5 items-center">
            {getItemImageUrl(serverUrl, nextEpisode, 'Primary', 480) && (
              <img
                src={getItemImageUrl(serverUrl, nextEpisode, 'Primary', 480)!}
                alt={nextEpisode.Name}
                className="w-full sm:w-56 aspect-video object-cover rounded-xl ring-1 ring-white/15 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-[#00A4DC]">
                {t.player.nextEpisodeCountdown(nextCountdown)}
              </p>
              <h3 className="text-lg sm:text-xl font-extrabold text-white truncate">
                {t.common.episodeCode(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber)} ·{' '}
                {nextEpisode.Name}
              </h3>
              {nextEpisode.Overview && (
                <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 leading-relaxed">
                  {nextEpisode.Overview}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onPlayNextEpisode}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  <Play className="w-4 h-4 fill-black" />
                  {t.player.playNow}
                </button>
                <button
                  type="button"
                  onClick={onCancelCountdown}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#141620]/90 backdrop-blur-xl border border-white/15 p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[#00A4DC]">
                {activeItem.Type === 'Episode'
                  ? nextEpisode
                    ? t.player.pausedBetweenEpisodes
                    : t.player.seriesFinished
                  : t.player.movieFinished}
              </p>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">{titleDisplay}</h3>
              {subtitleDisplay && <p className="text-sm text-zinc-300">{subtitleDisplay}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {nextEpisode && (
                <button
                  type="button"
                  onClick={onPlayNextEpisode}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
                >
                  <SkipForward className="w-4 h-4 fill-black" />
                  {t.player.nextShortLabel(nextEpisode.ParentIndexNumber, nextEpisode.IndexNumber)}
                </button>
              )}
              <button
                type="button"
                onClick={onReplay}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                {t.player.watchAgain}
              </button>
              <button
                type="button"
                onClick={onClosePlayer}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.player.backToCatalog}
              </button>
            </div>

            {similarItems.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {t.player.youMightAlsoLike}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {similarItems.slice(0, 4).map((sim) => {
                    const simThumb =
                      getItemImageUrl(serverUrl, sim, 'Backdrop', 420) ||
                      getItemImageUrl(serverUrl, sim, 'Primary', 320);
                    return (
                      <button
                        key={sim.Id}
                        type="button"
                        onClick={() => onPlaySimilar(sim)}
                        className="group text-left rounded-xl overflow-hidden bg-black/50 border border-white/10 hover:border-[#00A4DC]/60 transition-all"
                      >
                        <div className="aspect-video w-full bg-[#1a1c28] overflow-hidden">
                          {simThumb ? (
                            <img
                              src={simThumb}
                              alt={sim.Name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : null}
                        </div>
                        <p className="p-2 text-xs font-semibold text-white truncate">{sim.Name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
