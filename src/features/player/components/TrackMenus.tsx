import React from 'react';
import { AudioLines, Bookmark, Captions, Cast, Layers, Users } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { BuiltPlaybackStream, getChapterImageUrl } from '../../../shared/api/playback';
import {
  ChapterInfo,
  MediaSourceInfo,
  MediaStream,
  SessionInfoDto,
  SyncPlayGroupDto,
} from '../../../shared/types/jellyfin';
import { formatPlayerTime, ticksToSeconds } from '../../../shared/utils/time';

export type PlayerMenuKind =
  | 'chapters'
  | 'versions'
  | 'audio'
  | 'subtitles'
  | 'speed'
  | 'cast'
  | 'syncplay'
  | null;

interface TrackMenusProps {
  openMenu: PlayerMenuKind;
  onToggleMenu: (menu: Exclude<PlayerMenuKind, null>) => void;
  serverUrl: string;
  itemId: string;
  chapters: ChapterInfo[];
  currentTime: number;
  onSelectChapter: (startSeconds: number) => void;
  mediaSources: MediaSourceInfo[];
  selectedMediaSourceId: string | undefined;
  onSelectMediaSource: (source: MediaSourceInfo) => void;
  audioStreams: MediaStream[];
  selectedAudioIndex: number | undefined;
  onSelectAudio: (audioIdx: number) => void;
  builtStream: BuiltPlaybackStream | null;
  selectedSubtitleIndex: number;
  onSelectSubtitle: (subIdx: number) => void;
  playbackRate: number;
  onSelectPlaybackRate: (rate: number) => void;
  castSessions: SessionInfoDto[];
  onCastToSession: (session: SessionInfoDto) => void;
  castStatusMessage: string | null;
  syncPlayGroups: SyncPlayGroupDto[];
  activeSyncPlayGroup: SyncPlayGroupDto | null;
  syncPlayGroupInput: string;
  onSyncPlayGroupInputChange: (value: string) => void;
  onCreateSyncPlayGroup: (e: React.FormEvent) => void;
  onJoinSyncPlayGroup: (group: SyncPlayGroupDto) => void;
  onLeaveSyncPlayGroup: () => void;
}

function formatMediaSourceLabel(source: MediaSourceInfo): string {
  const video = source.MediaStreams?.find((s) => s.Type === 'Video');
  const height = video?.Height;
  const resBadge = height
    ? height >= 2000
      ? '4K'
      : height >= 1000
        ? '1080p'
        : height >= 700
          ? '720p'
          : `${height}p`
    : '';
  const baseName = source.Name || source.Container?.toUpperCase() || source.Id;
  return resBadge && !baseName.includes(resBadge) ? `${baseName} (${resBadge})` : baseName;
}

export const TrackMenus: React.FC<TrackMenusProps> = ({
  openMenu,
  onToggleMenu,
  serverUrl,
  itemId,
  chapters,
  currentTime,
  onSelectChapter,
  mediaSources,
  selectedMediaSourceId,
  onSelectMediaSource,
  audioStreams,
  selectedAudioIndex,
  onSelectAudio,
  builtStream,
  selectedSubtitleIndex,
  onSelectSubtitle,
  playbackRate,
  onSelectPlaybackRate,
  castSessions,
  onCastToSession,
  castStatusMessage,
  syncPlayGroups,
  activeSyncPlayGroup,
  syncPlayGroupInput,
  onSyncPlayGroupInputChange,
  onCreateSyncPlayGroup,
  onJoinSyncPlayGroup,
  onLeaveSyncPlayGroup,
}) => {
  const { t } = usePreferences();

  return (
    <>
      {chapters.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => onToggleMenu('chapters')}
            title={t.player.chaptersTitle}
            aria-label={t.player.chaptersSelectAria}
            className={`p-2.5 rounded-lg transition-colors ${
              openMenu === 'chapters'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>
          {openMenu === 'chapters' && (
            <div className="absolute right-0 bottom-12 w-72 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
              <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t.player.chaptersHeading}
              </p>
              {chapters.map((chapter, idx) => {
                const startSec = ticksToSeconds(chapter.StartPositionTicks);
                const nextSec =
                  idx + 1 < chapters.length
                    ? ticksToSeconds(chapters[idx + 1].StartPositionTicks)
                    : Number.POSITIVE_INFINITY;
                const isActive = currentTime >= startSec && currentTime < nextSec;
                const thumbUrl = getChapterImageUrl(serverUrl, itemId, idx, chapter.ImageTag, 240);

                return (
                  <button
                    key={`${idx}-${chapter.Name ?? startSec}`}
                    type="button"
                    onClick={() => onSelectChapter(startSec)}
                    className={`w-full flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                      isActive
                        ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                        : 'text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt=""
                        loading="lazy"
                        className="w-14 aspect-video rounded object-cover shrink-0 bg-black/50"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{chapter.Name || t.player.chapterFallback(idx)}</p>
                      <p className="text-[11px] font-mono text-zinc-400">
                        {formatPlayerTime(startSec)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mediaSources.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => onToggleMenu('versions')}
            title={t.player.versionsTitle}
            aria-label={t.player.versionsSelectAria}
            className={`p-2.5 rounded-lg transition-colors ${
              openMenu === 'versions'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-5 h-5" />
          </button>
          {openMenu === 'versions' && (
            <div className="absolute right-0 bottom-12 w-64 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
              <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
                {t.player.versionsHeading}
              </p>
              {mediaSources.map((src) => (
                <button
                  key={src.Id}
                  type="button"
                  onClick={() => onSelectMediaSource(src)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                    selectedMediaSourceId === src.Id
                      ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                      : 'text-zinc-200 hover:bg-white/10'
                  }`}
                >
                  {formatMediaSourceLabel(src)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
            {builtStream?.allSubtitles.map((track) => (
              <button
                key={track.index}
                type="button"
                onClick={() => onSelectSubtitle(track.index)}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                  selectedSubtitleIndex === track.index
                    ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <span className="truncate">{track.label}</span>
                {track.delivery === 'encode' && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                    {t.player.subtitleBurnInBadge}
                  </span>
                )}
              </button>
            ))}
            {(!builtStream || builtStream.allSubtitles.length === 0) && (
              <p className="px-3 py-1.5 text-xs text-zinc-500">{t.player.noExternalSubtitles}</p>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('syncplay')}
          title={t.player.syncPlayTitle}
          aria-label={t.player.syncPlaySelectAria}
          className={`p-2.5 rounded-lg transition-colors ${
            activeSyncPlayGroup || openMenu === 'syncplay'
              ? 'bg-[#00A4DC]/25 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-5 h-5" />
        </button>
        {openMenu === 'syncplay' && (
          <div className="absolute right-0 bottom-12 w-72 max-w-[calc(100vw-2rem)] max-h-[55vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.syncPlayHeading}
            </p>

            {activeSyncPlayGroup ? (
              <div className="rounded-lg bg-[#00A4DC]/15 border border-[#00A4DC]/40 p-2.5 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#7dd3fc] truncate">
                  {t.player.syncPlayJoined(activeSyncPlayGroup.GroupName)}
                </span>
                <button
                  type="button"
                  onClick={onLeaveSyncPlayGroup}
                  className="shrink-0 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 text-xs font-semibold text-rose-200"
                >
                  {t.player.syncPlayLeave}
                </button>
              </div>
            ) : (
              <>
                {syncPlayGroups.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t.player.syncPlayEmpty}</p>
                ) : (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {syncPlayGroups.map((group) => (
                      <button
                        key={group.GroupId}
                        type="button"
                        onClick={() => onJoinSyncPlayGroup(group)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-medium">{group.GroupName}</span>
                        {group.Participants && (
                          <span className="text-[11px] text-zinc-400 shrink-0">
                            {group.Participants.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={onCreateSyncPlayGroup} className="flex gap-1.5 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={syncPlayGroupInput}
                    onChange={(e) => onSyncPlayGroupInputChange(e.target.value)}
                    placeholder={t.player.syncPlayGroupPlaceholder}
                    className="flex-1 min-w-0 bg-[#0a0a0e] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-[#00A4DC] text-black font-bold text-xs shrink-0"
                  >
                    {t.player.syncPlayCreateBtn}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('cast')}
          title={t.player.castTitle}
          aria-label={t.player.castSelectAria}
          className={`p-2.5 rounded-lg transition-colors ${
            openMenu === 'cast'
              ? 'bg-white/20 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Cast className="w-5 h-5" />
        </button>
        {openMenu === 'cast' && (
          <div className="absolute right-0 bottom-12 w-60 max-w-[calc(100vw-2rem)] max-h-[52vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
            <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.castHeading}
            </p>
            {castStatusMessage && (
              <p className="px-2.5 py-1.5 text-xs font-medium text-emerald-400">
                {castStatusMessage}
              </p>
            )}
            {castSessions.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-zinc-500">{t.player.castEmpty}</p>
            ) : (
              castSessions.map((session) => (
                <button
                  key={session.Id}
                  type="button"
                  onClick={() => onCastToSession(session)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm text-zinc-200 hover:bg-white/10 transition-colors"
                >
                  <p className="font-medium truncate">{session.DeviceName || session.Client || session.Id}</p>
                  {session.Client && session.DeviceName && (
                    <p className="text-[11px] text-zinc-400 truncate">{session.Client}</p>
                  )}
                </button>
              ))
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
