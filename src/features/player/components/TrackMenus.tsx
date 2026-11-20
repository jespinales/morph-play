import React from 'react';
import {
  AudioLines,
  Bookmark,
  Captions,
  Cast,
  Layers,
  Loader2,
  Pause,
  Play,
  Repeat,
  Search,
  Send,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { BuiltPlaybackStream, getChapterImageUrl } from '../../../shared/api/playback';
import {
  ChapterInfo,
  GroupRepeatMode,
  GroupShuffleMode,
  MediaSourceInfo,
  MediaStream,
  PlaystateCommandData,
  RemoteSubtitleInfo,
  SessionInfoDto,
  StreamingQuality,
  SyncPlayGroupDto,
} from '../../../shared/types/jellyfin';
import { formatPlayerTime, ticksToSeconds } from '../../../shared/utils/time';

export type PlayerMenuKind =
  | 'chapters'
  | 'versions'
  | 'audio'
  | 'subtitles'
  | 'quality'
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
  activePlayMethod?: 'DirectPlay' | 'DirectStream' | 'Transcode';
  selectedSubtitleIndex: number;
  onSelectSubtitle: (subIdx: number) => void;
  deletableSubtitleIndices: number[];
  remoteSubLang: string;
  onRemoteSubLangChange: (lang: string) => void;
  remoteSubResults: RemoteSubtitleInfo[];
  remoteSubSearching: boolean;
  onSearchRemoteSubtitles: () => void;
  onDownloadRemoteSubtitle: (subtitleId: string) => void;
  onUploadSubtitleFile: (file: File) => void;
  onDeleteSubtitle: (index: number) => void;
  selectedQuality: StreamingQuality;
  onSelectQuality: (quality: StreamingQuality) => void;
  playbackRate: number;
  onSelectPlaybackRate: (rate: number) => void;
  castSessions: SessionInfoDto[];
  activeCastSession: SessionInfoDto | null;
  onCastToSession: (session: SessionInfoDto) => void;
  onRemotePlaystate: (command: NonNullable<PlaystateCommandData['Command']>) => void;
  castMessageInput: string;
  onCastMessageInputChange: (val: string) => void;
  onSendCastMessage: (e: React.FormEvent) => void;
  castStatusMessage: string | null;
  syncPlayGroups: SyncPlayGroupDto[];
  activeSyncPlayGroup: SyncPlayGroupDto | null;
  syncPlayGroupInput: string;
  onSyncPlayGroupInputChange: (value: string) => void;
  onCreateSyncPlayGroup: (e: React.FormEvent) => void;
  onJoinSyncPlayGroup: (group: SyncPlayGroupDto) => void;
  onLeaveSyncPlayGroup: () => void;
  syncPlayRepeatMode: GroupRepeatMode;
  syncPlayShuffleMode: GroupShuffleMode;
  syncPlayIgnoreWait: boolean;
  onSyncPlayRepeatChange: (mode: GroupRepeatMode) => void;
  onSyncPlayShuffleToggle: () => void;
  onSyncPlayIgnoreWaitToggle: () => void;
  onSyncPlayQueueStep: (dir: 'next' | 'prev' | 'stop') => void;
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
  activePlayMethod,
  selectedSubtitleIndex,
  onSelectSubtitle,
  deletableSubtitleIndices,
  remoteSubLang,
  onRemoteSubLangChange,
  remoteSubResults,
  remoteSubSearching,
  onSearchRemoteSubtitles,
  onDownloadRemoteSubtitle,
  onUploadSubtitleFile,
  onDeleteSubtitle,
  selectedQuality,
  onSelectQuality,
  playbackRate,
  onSelectPlaybackRate,
  castSessions,
  activeCastSession,
  onCastToSession,
  onRemotePlaystate,
  castMessageInput,
  onCastMessageInputChange,
  onSendCastMessage,
  castStatusMessage,
  syncPlayGroups,
  activeSyncPlayGroup,
  syncPlayGroupInput,
  onSyncPlayGroupInputChange,
  onCreateSyncPlayGroup,
  onJoinSyncPlayGroup,
  onLeaveSyncPlayGroup,
  syncPlayRepeatMode,
  syncPlayShuffleMode,
  syncPlayIgnoreWait,
  onSyncPlayRepeatChange,
  onSyncPlayShuffleToggle,
  onSyncPlayIgnoreWaitToggle,
  onSyncPlayQueueStep,
}) => {
  const { t } = usePreferences();
  const effectivePlayMethod = activePlayMethod ?? builtStream?.playMethod;

  return (
    <>
      {chapters.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => onToggleMenu('chapters')}
            title={t.player.chaptersTitle}
            aria-label={t.player.chaptersSelectAria}
            className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
              openMenu === 'chapters'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bookmark className="w-5 h-5" />
          </button>
          {openMenu === 'chapters' && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-72 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
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
            className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
              openMenu === 'versions'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-5 h-5" />
          </button>
          {openMenu === 'versions' && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-72 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
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
            className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
              openMenu === 'audio'
                ? 'bg-white/20 text-white'
                : 'text-zinc-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <AudioLines className="w-5 h-5" />
          </button>
          {openMenu === 'audio' && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-80 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
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
                  <span className="line-clamp-2 leading-snug">
                    {audio.DisplayTitle ||
                      audio.Title ||
                      audio.Language ||
                      t.player.trackFallback(audio.Index)}
                  </span>
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
          className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
            selectedSubtitleIndex !== -1 || openMenu === 'subtitles'
              ? 'bg-white/20 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Captions className="w-5 h-5" />
        </button>
        {openMenu === 'subtitles' && (
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-96 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2.5 shadow-2xl space-y-1.5">
            <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.subtitlesHeading}
            </p>
            <button
              type="button"
              onClick={() => onSelectSubtitle(-1)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                selectedSubtitleIndex === -1
                  ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                  : 'text-zinc-200 hover:bg-white/10'
              }`}
            >
              {t.player.subtitlesOff}
            </button>
            {builtStream?.allSubtitles.map((track) => {
              const canDelete = deletableSubtitleIndices.includes(track.index);
              return (
                <div key={track.index} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSubtitle(track.index)}
                    className={`flex-1 min-w-0 flex items-center justify-between gap-2 text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                      selectedSubtitleIndex === track.index
                        ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                        : 'text-zinc-200 hover:bg-white/10'
                    }`}
                  >
                    <span className="line-clamp-2 leading-snug">{track.label}</span>
                    {track.delivery === 'encode' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                        {t.player.subtitleBurnInBadge}
                      </span>
                    )}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteSubtitle(track.index)}
                      title={t.player.deleteSubtitleAria}
                      aria-label={t.player.deleteSubtitleAria}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/10 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {(!builtStream || builtStream.allSubtitles.length === 0) && (
              <p className="px-3 py-1 text-xs text-zinc-500">{t.player.noExternalSubtitles}</p>
            )}

            {/* Remote subtitle search + local upload */}
            <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-1.5">
                <select
                  id="player-remote-sub-lang"
                  name="remoteSubLang"
                  aria-label={t.player.remoteSubtitlesLangLabel}
                  value={remoteSubLang}
                  onChange={(e) => onRemoteSubLangChange(e.target.value)}
                  className="bg-[#0a0a0e] border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="spa">ES</option>
                  <option value="eng">EN</option>
                  <option value="jpn">JP</option>
                  <option value="fra">FR</option>
                  <option value="por">PT</option>
                </select>
                <button
                  type="button"
                  onClick={onSearchRemoteSubtitles}
                  disabled={remoteSubSearching}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {remoteSubSearching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">
                    {remoteSubSearching
                      ? t.player.remoteSubtitlesSearching
                      : t.player.remoteSubtitlesSearchBtn}
                  </span>
                </button>
              </div>

              {remoteSubResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {remoteSubResults.slice(0, 8).map((sub) => (
                    <div
                      key={sub.Id ?? sub.Name}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white/5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-zinc-200 font-medium">{sub.Name}</p>
                        <p className="text-[10px] text-zinc-400 truncate">
                          {[sub.ProviderName, sub.Format, sub.IsHashMatch ? 'Hash' : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {sub.Id && (
                        <button
                          type="button"
                          onClick={() => onDownloadRemoteSubtitle(sub.Id!)}
                          className="px-2 py-1 rounded bg-[#00A4DC] text-black font-bold text-[11px] shrink-0"
                        >
                          {t.player.remoteSubtitlesDownloadBtn}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <label className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-zinc-300 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{t.player.uploadSubtitleBtn}</span>
                <input
                  id="player-subtitle-upload"
                  name="subtitleFile"
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.sub"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadSubtitleFile(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('syncplay')}
          title={t.player.syncPlayTitle}
          aria-label={t.player.syncPlaySelectAria}
          className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
            activeSyncPlayGroup || openMenu === 'syncplay'
              ? 'bg-[#00A4DC]/25 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-5 h-5" />
        </button>
        {openMenu === 'syncplay' && (
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-72 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.syncPlayHeading}
            </p>

            {activeSyncPlayGroup ? (
              <div className="space-y-2.5">
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

                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSyncPlayQueueStep('prev')}
                    title={t.player.syncPlayPrevQueue}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSyncPlayQueueStep('next')}
                    title={t.player.syncPlayNextQueue}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSyncPlayQueueStep('stop')}
                    title={t.player.syncPlayStopRoom}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white flex items-center justify-center"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const order: GroupRepeatMode[] = ['RepeatNone', 'RepeatAll', 'RepeatOne'];
                      const next = order[(order.indexOf(syncPlayRepeatMode) + 1) % order.length];
                      onSyncPlayRepeatChange(next);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border ${
                      syncPlayRepeatMode !== 'RepeatNone'
                        ? 'bg-[#00A4DC]/20 border-[#00A4DC] text-[#7dd3fc]'
                        : 'bg-white/5 border-white/10 text-zinc-300'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {t.player.syncPlayRepeatLabel}
                      {syncPlayRepeatMode === 'RepeatOne'
                        ? ' 1'
                        : syncPlayRepeatMode === 'RepeatAll'
                          ? ' ∞'
                          : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onSyncPlayShuffleToggle}
                    className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border ${
                      syncPlayShuffleMode === 'Shuffle'
                        ? 'bg-[#00A4DC]/20 border-[#00A4DC] text-[#7dd3fc]'
                        : 'bg-white/5 border-white/10 text-zinc-300'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span className="truncate">{t.player.syncPlayShuffleLabel}</span>
                  </button>
                </div>

                <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer px-1">
                  <span>{t.player.syncPlayIgnoreWait}</span>
                  <input
                    type="checkbox"
                    checked={syncPlayIgnoreWait}
                    onChange={onSyncPlayIgnoreWaitToggle}
                    className="w-4 h-4 accent-[#00A4DC]"
                  />
                </label>
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
                    id="player-syncplay-group-name"
                    name="syncPlayGroupName"
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
          className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
            openMenu === 'cast'
              ? 'bg-white/20 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Cast className="w-5 h-5" />
        </button>
        {openMenu === 'cast' && (
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-72 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2.5 shadow-2xl space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wider text-zinc-400">
              {t.player.castHeading}
            </p>
            {castStatusMessage && (
              <p className="px-1 text-xs font-medium text-emerald-400">
                {castStatusMessage}
              </p>
            )}
            {castSessions.length === 0 ? (
              <p className="px-1 py-1.5 text-xs text-zinc-500">{t.player.castEmpty}</p>
            ) : (
              <div className="space-y-1">
                {castSessions.map((session) => {
                  const selected = activeCastSession?.Id === session.Id;
                  return (
                    <button
                      key={session.Id}
                      type="button"
                      onClick={() => onCastToSession(session)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                        selected
                          ? 'bg-[#00A4DC]/20 text-[#7dd3fc] font-semibold'
                          : 'text-zinc-200 hover:bg-white/10'
                      }`}
                    >
                      <p className="font-medium truncate">
                        {session.DeviceName || session.Client || session.Id}
                      </p>
                      {session.Client && session.DeviceName && (
                        <p className="text-[11px] text-zinc-400 truncate">{session.Client}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {activeCastSession && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  {t.player.castControlsHeading}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onRemotePlaystate('PreviousTrack')}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemotePlaystate('Unpause')}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemotePlaystate('Pause')}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemotePlaystate('Stop')}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white flex items-center justify-center"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemotePlaystate('NextTrack')}
                    className="flex-1 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={onSendCastMessage} className="flex gap-1.5">
                  <input
                    id="player-cast-message"
                    name="castMessage"
                    type="text"
                    value={castMessageInput}
                    onChange={(e) => onCastMessageInputChange(e.target.value)}
                    placeholder={t.player.castSendMessagePlaceholder}
                    className="flex-1 min-w-0 bg-[#0a0a0e] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                  />
                  <button
                    type="submit"
                    disabled={!castMessageInput.trim()}
                    title={t.player.castSendMessageBtn}
                    className="px-2.5 py-1.5 rounded-lg bg-[#00A4DC] text-black font-bold text-xs disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('quality')}
          title={t.player.qualityTitle}
          aria-label={t.player.qualitySelectAria}
          className={`p-2 sm:p-2.5 rounded-lg transition-colors ${
            selectedQuality !== 'auto' || openMenu === 'quality'
              ? 'bg-white/20 text-[#7dd3fc]'
              : 'text-zinc-200 hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings className="w-5 h-5" />
        </button>
        {openMenu === 'quality' && (
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-72 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-2 shadow-2xl space-y-1">
            <div className="px-2.5 py-1 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                {t.player.qualityHeading}
              </p>
              {effectivePlayMethod && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 shrink-0 whitespace-nowrap">
                  {effectivePlayMethod === 'DirectPlay'
                    ? t.player.playMethodDirect
                    : t.player.playMethodTranscode}
                </span>
              )}
            </div>
            {(
              [
                { value: 'auto', label: t.player.qualityAutoOption },
                { value: '1080p', label: t.player.quality1080Option },
                { value: '720p', label: t.player.quality720Option },
                { value: '480p', label: t.player.quality480Option },
                { value: '360p', label: t.player.quality360Option },
              ] as Array<{ value: StreamingQuality; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelectQuality(opt.value)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                  selectedQuality === opt.value
                    ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleMenu('speed')}
          aria-label={t.player.playbackSpeedAria}
          className="min-w-[36px] sm:min-w-[40px] min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold text-zinc-200 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center justify-center"
        >
          {playbackRate}x
        </button>
        {openMenu === 'speed' && (
          <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 bottom-28 sm:bottom-24 z-40 sm:w-32 max-h-[48vh] overflow-y-auto overscroll-contain rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-1.5 shadow-2xl space-y-1">
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
