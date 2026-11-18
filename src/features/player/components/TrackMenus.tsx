import React from 'react';
import { AudioLines, Captions } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { BuiltPlaybackStream } from '../../../shared/api/playback';
import { MediaStream } from '../../../shared/types/jellyfin';

export type PlayerMenuKind = 'audio' | 'subtitles' | 'speed' | null;

interface TrackMenusProps {
  openMenu: PlayerMenuKind;
  onToggleMenu: (menu: Exclude<PlayerMenuKind, null>) => void;
  audioStreams: MediaStream[];
  selectedAudioIndex: number | undefined;
  onSelectAudio: (audioIdx: number) => void;
  builtStream: BuiltPlaybackStream | null;
  selectedSubtitleIndex: number;
  onSelectSubtitle: (subIdx: number) => void;
  playbackRate: number;
  onSelectPlaybackRate: (rate: number) => void;
}

export const TrackMenus: React.FC<TrackMenusProps> = ({
  openMenu,
  onToggleMenu,
  audioStreams,
  selectedAudioIndex,
  onSelectAudio,
  builtStream,
  selectedSubtitleIndex,
  onSelectSubtitle,
  playbackRate,
  onSelectPlaybackRate,
}) => {
  const { t } = usePreferences();

  return (
    <>
      {audioStreams.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => onToggleMenu('audio')}
            title={t.player.audioTracksTitle}
            aria-label={t.player.audioSelectAria}
            className={`p-2.5 rounded-lg transition-colors ${
              openMenu === 'audio'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <AudioLines className="w-5 h-5" />
          </button>
          {openMenu === 'audio' && (
            <div className="absolute right-0 bottom-12 w-60 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
              <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t.player.audioHeading}
              </p>
              {audioStreams.map((audio) => (
                <button
                  key={audio.Index}
                  type="button"
                  onClick={() => onSelectAudio(audio.Index)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                    selectedAudioIndex === audio.Index
                      ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {audio.DisplayTitle ||
                    audio.Title ||
                    audio.Language ||
                    t.player.trackFallback(audio.Index)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('subtitles')}
          title={t.player.subtitlesTitle}
          aria-label={t.player.subtitlesSelectAria}
          className={`p-2.5 rounded-lg transition-colors ${
            selectedSubtitleIndex !== -1 || openMenu === 'subtitles'
              ? 'bg-white/20 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Captions className="w-5 h-5" />
        </button>
        {openMenu === 'subtitles' && (
          <div className="absolute right-0 bottom-12 w-56 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
            <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.subtitlesHeading}
            </p>
            <button
              type="button"
              onClick={() => onSelectSubtitle(-1)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                selectedSubtitleIndex === -1
                  ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                  : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              {t.player.subtitlesOff}
            </button>
            {builtStream?.subtitleTracks.map((track) => (
              <button
                key={track.index}
                type="button"
                onClick={() => onSelectSubtitle(track.index)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  selectedSubtitleIndex === track.index
                    ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                {track.label}
              </button>
            ))}
            {(!builtStream || builtStream.subtitleTracks.length === 0) && (
              <p className="px-3 py-1.5 text-xs text-zinc-500">{t.player.noExternalSubtitles}</p>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('speed')}
          aria-label={t.player.playbackSpeedAria}
          className="min-w-[40px] min-h-[38px] px-2.5 py-2 rounded-lg text-xs font-bold text-zinc-200 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center justify-center"
        >
          {playbackRate}x
        </button>
        {openMenu === 'speed' && (
          <div className="absolute right-0 bottom-12 w-32 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-1.5 shadow-2xl space-y-1">
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => onSelectPlaybackRate(rate)}
                className={`w-full text-left px-3 py-2.5 min-h-[38px] rounded-lg text-xs font-semibold ${
                  playbackRate === rate
                    ? 'bg-[#00A4DC]/25 text-[#7dd3fc]'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
