import React from 'react';
import { Play, RotateCcw, X } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { getItemImageUrl } from '../../../shared/api/playback';
import { BaseItemDto } from '../../../shared/types/jellyfin';
import { formatPlayerTime } from '../../../shared/utils/time';

interface ResumePromptOverlayProps {
  serverUrl: string;
  item: BaseItemDto;
  titleDisplay: string;
  subtitleDisplay: string;
  resumeSeconds: number;
  durationSeconds: number;
  onResume: () => void;
  onStartFromBeginning: () => void;
  onCancel: () => void;
}

export const ResumePromptOverlay: React.FC<ResumePromptOverlayProps> = ({
  serverUrl,
  item,
  titleDisplay,
  subtitleDisplay,
  resumeSeconds,
  durationSeconds,
  onResume,
  onStartFromBeginning,
  onCancel,
}) => {
  const { t } = usePreferences();
  const backdropUrl = getItemImageUrl(serverUrl, item, 'Backdrop', 1600);
  const formattedResume = formatPlayerTime(resumeSeconds);
  const formattedTotal = durationSeconds > 0 ? formatPlayerTime(durationSeconds) : undefined;
  const progressPercent =
    durationSeconds > 0 ? Math.min(100, Math.max(2, (resumeSeconds / durationSeconds) * 100)) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-prompt-title"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/95 p-5 sm:p-8 animate-fadeIn"
    >
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/60 pointer-events-none" />

      <button
        type="button"
        onClick={onCancel}
        aria-label={t.player.backAria}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-[#12131a]/90 p-6 sm:p-7 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#00A4DC]">
            {t.player.resumePromptTitle}
          </p>
          <h2 id="resume-prompt-title" className="text-xl sm:text-2xl font-bold text-white leading-tight">
            {titleDisplay}
          </h2>
          {subtitleDisplay && <p className="text-sm text-zinc-300">{subtitleDisplay}</p>}
        </div>

        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-zinc-300">
            {t.player.savedProgressLabel(formattedResume, formattedTotal)}
          </p>
          {progressPercent > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            autoFocus
            onClick={onResume}
            className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm sm:text-base font-bold text-black shadow-lg hover:bg-white/90 active:scale-[0.99] transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-black" />
            <span>{t.player.resumeFromTime(formattedResume)}</span>
          </button>

          <button
            type="button"
            onClick={onStartFromBeginning}
            className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm sm:text-base font-semibold text-white hover:bg-white/20 active:scale-[0.99] transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.player.startFromBeginning}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
