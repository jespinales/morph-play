import React from 'react';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider';
import { BuiltPlaybackStream } from '../../../shared/api/playback';
import {
  BaseItemDto,
  ChapterInfo,
  GroupRepeatMode,
  GroupShuffleMode,
  MediaSourceInfo,
  MediaStream,
  PlaystateCommandData,
  RemoteSubtitleInfo,
  SessionInfoDto,
  SyncPlayGroupDto,
} from '../../../shared/types/jellyfin';
import { formatPlayerTime, ticksToSeconds } from '../../../shared/utils/time';
import { TrickplayFrame } from '../../../shared/utils/trickplay';
import { PlayerMenuKind, TrackMenus } from './TrackMenus';

interface PlayerControlsProps {
  showControls: boolean;
  loadingStream: boolean;
  streamError: string | null;
  hasEnded: boolean;
  titleDisplay: string;
  subtitleDisplay: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bufferedPercent: number;
  progressPercent: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  playbackRate: number;
  openMenu: PlayerMenuKind;
  serverUrl: string;
  itemId: string;
  chapters: ChapterInfo[];
  mediaSources: MediaSourceInfo[];
  selectedMediaSourceId: string | undefined;
  castSessions: SessionInfoDto[];
  activeCastSession: SessionInfoDto | null;
  castMessageInput: string;
  castStatusMessage: string | null;
  syncPlayGroups: SyncPlayGroupDto[];
  activeSyncPlayGroup: SyncPlayGroupDto | null;
  syncPlayGroupInput: string;
  syncPlayRepeatMode: GroupRepeatMode;
  syncPlayShuffleMode: GroupShuffleMode;
  syncPlayIgnoreWait: boolean;
  nextEpisode: BaseItemDto | null;
  audioStreams: MediaStream[];
  selectedAudioIndex: number | undefined;
  builtStream: BuiltPlaybackStream | null;
  selectedSubtitleIndex: number;
  deletableSubtitleIndices: number[];
  remoteSubLang: string;
  remoteSubResults: RemoteSubtitleInfo[];
  remoteSubSearching: boolean;
  seekBarRef: React.RefObject<HTMLDivElement>;
  menusContainerRef: React.RefObject<HTMLDivElement>;
  seekPreview: { time: number; percent: number } | null;
  trickplayFrame: TrickplayFrame | null;
  failedTiles: Record<string, boolean>;
  onClosePlayer: () => void;
  onTogglePlayPause: () => void;
  onSeekBy: (delta: number) => void;
  onSeekTo: (nextTime: number) => void;
  onUpdateSeekPreviewFromClientX: (clientX: number) => void;
  onClearSeekPreview: () => void;
  onTileError: (url: string) => void;
  onBumpControls: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onPlayNextEpisode: () => void;
  onToggleMenu: (menu: Exclude<PlayerMenuKind, null>) => void;
  onSelectChapter: (startSeconds: number) => void;
  onSelectMediaSource: (source: MediaSourceInfo) => void;
  onCastToSession: (session: SessionInfoDto) => void;
  onRemotePlaystate: (command: NonNullable<PlaystateCommandData['Command']>) => void;
  onCastMessageInputChange: (val: string) => void;
  onSendCastMessage: (e: React.FormEvent) => void;
  onSyncPlayGroupInputChange: (value: string) => void;
  onCreateSyncPlayGroup: (e: React.FormEvent) => void;
  onJoinSyncPlayGroup: (group: SyncPlayGroupDto) => void;
  onLeaveSyncPlayGroup: () => void;
  onSyncPlayRepeatChange: (mode: GroupRepeatMode) => void;
  onSyncPlayShuffleToggle: () => void;
  onSyncPlayIgnoreWaitToggle: () => void;
  onSyncPlayQueueStep: (dir: 'next' | 'prev' | 'stop') => void;
  onSelectAudio: (audioIdx: number) => void;
  onSelectSubtitle: (subIdx: number) => void;
  onRemoteSubLangChange: (lang: string) => void;
  onSearchRemoteSubtitles: () => void;
  onDownloadRemoteSubtitle: (subtitleId: string) => void;
  onUploadSubtitleFile: (file: File) => void;
  onDeleteSubtitle: (index: number) => void;
  onSelectPlaybackRate: (rate: number) => void;
  onToggleFullscreen: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  showControls,
  loadingStream,
  streamError,
  hasEnded,
  titleDisplay,
  subtitleDisplay,
  isPlaying,
  currentTime,
  duration,
  bufferedPercent,
  progressPercent,
  volume,
  isMuted,
  isFullscreen,
  playbackRate,
  openMenu,
  serverUrl,
  itemId,
  chapters,
  mediaSources,
  selectedMediaSourceId,
  castSessions,
  activeCastSession,
  castMessageInput,
  castStatusMessage,
  syncPlayGroups,
  activeSyncPlayGroup,
  syncPlayGroupInput,
  syncPlayRepeatMode,
  syncPlayShuffleMode,
  syncPlayIgnoreWait,
  nextEpisode,
  audioStreams,
  selectedAudioIndex,
  builtStream,
  selectedSubtitleIndex,
  deletableSubtitleIndices,
  remoteSubLang,
  remoteSubResults,
  remoteSubSearching,
  seekBarRef,
  menusContainerRef,
  seekPreview,
  trickplayFrame,
  failedTiles,
  onClosePlayer,
  onTogglePlayPause,
  onSeekBy,
  onSeekTo,
  onUpdateSeekPreviewFromClientX,
  onClearSeekPreview,
  onTileError,
  onBumpControls,
  onToggleMute,
  onVolumeChange,
  onPlayNextEpisode,
  onToggleMenu,
  onSelectChapter,
  onSelectMediaSource,
  onCastToSession,
  onRemotePlaystate,
  onCastMessageInputChange,
  onSendCastMessage,
  onSyncPlayGroupInputChange,
  onCreateSyncPlayGroup,
  onJoinSyncPlayGroup,
  onLeaveSyncPlayGroup,
  onSyncPlayRepeatChange,
  onSyncPlayShuffleToggle,
  onSyncPlayIgnoreWaitToggle,
  onSyncPlayQueueStep,
  onSelectAudio,
  onSelectSubtitle,
  onRemoteSubLangChange,
  onSearchRemoteSubtitles,
  onDownloadRemoteSubtitle,
  onUploadSubtitleFile,
  onDeleteSubtitle,
  onSelectPlaybackRate,
  onToggleFullscreen,
}) => {
  const { t } = usePreferences();

  return (
    <>
      {/* Top bar */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 flex items-center justify-between gap-4 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClosePlayer}
            aria-label={t.player.backAria}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">{titleDisplay}</h2>
            {subtitleDisplay && (
              <p className="text-xs sm:text-sm text-zinc-300 truncate">{subtitleDisplay}</p>
            )}
          </div>
        </div>
        {activeSyncPlayGroup && (
          <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00A4DC]/20 border border-[#00A4DC]/40 text-xs font-semibold text-[#7dd3fc]">
            {t.player.syncPlayJoined(activeSyncPlayGroup.GroupName)}
          </span>
        )}
      </div>

      {/* Center touch quick controls */}
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center gap-8 sm:gap-14 pointer-events-none transition-opacity duration-300 ${
          showControls && !loadingStream && !streamError && !hasEnded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => onSeekBy(-10)}
          aria-label={t.player.rewind10Aria}
          className="pointer-events-auto p-3.5 rounded-full bg-black/45 hover:bg-black/75 text-white/90 backdrop-blur-sm transition-transform active:scale-90 sm:hidden [@media(hover:none)]:inline-flex"
        >
          <RotateCcw className="w-7 h-7" />
        </button>

        <button
          type="button"
          onClick={onTogglePlayPause}
          aria-label={isPlaying ? t.player.pauseAria : t.player.playAria}
          className="pointer-events-auto w-16 h-16 rounded-full bg-black/55 hover:bg-black/80 text-white border border-white/20 backdrop-blur-md flex items-center justify-center transition-transform active:scale-90 md:hidden [@media(hover:none)]:flex"
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 fill-white" />
          ) : (
            <Play className="w-8 h-8 fill-white ml-1" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onSeekBy(10)}
          aria-label={t.player.forward10Aria}
          className="pointer-events-auto p-3.5 rounded-full bg-black/45 hover:bg-black/75 text-white/90 backdrop-blur-sm transition-transform active:scale-90 sm:hidden [@media(hover:none)]:inline-flex"
        >
          <RotateCw className="w-7 h-7" />
        </button>
      </div>

      {/* Bottom control bar */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 px-4 sm:px-8 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6 pt-12 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek bar */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-200 w-12 text-right shrink-0">
            {formatPlayerTime(currentTime)}
          </span>

          <div
            ref={seekBarRef}
            onPointerDown={(e) => {
              onBumpControls();
              onUpdateSeekPreviewFromClientX(e.clientX);
            }}
            onPointerMove={(e) => onUpdateSeekPreviewFromClientX(e.clientX)}
            onPointerUp={onClearSeekPreview}
            onPointerCancel={onClearSeekPreview}
            onPointerLeave={onClearSeekPreview}
            className="relative flex-1 group/seek flex items-center h-9 [@media(hover:hover)]:sm:h-7 touch-none cursor-pointer"
          >
            {/* Floating Trickplay + timestamp preview */}
            {seekPreview && duration > 0 && (
              <div
                className="pointer-events-none absolute bottom-8 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5"
                style={{ left: `${Math.min(92, Math.max(8, seekPreview.percent))}%` }}
              >
                {trickplayFrame && !failedTiles[trickplayFrame.url] && (
                  <div
                    className="rounded-lg overflow-hidden border border-white/25 shadow-2xl bg-black"
                    style={{
                      width: `${trickplayFrame.displayWidth}px`,
                      height: `${trickplayFrame.displayHeight}px`,
                      backgroundImage: `url(${trickplayFrame.url})`,
                      backgroundSize: `${trickplayFrame.tileWidth * trickplayFrame.displayWidth}px ${
                        trickplayFrame.tileHeight * trickplayFrame.displayHeight
                      }px`,
                      backgroundPosition: `-${trickplayFrame.col * trickplayFrame.displayWidth}px -${
                        trickplayFrame.row * trickplayFrame.displayHeight
                      }px`,
                      backgroundRepeat: 'no-repeat',
                    }}
                  >
                    <img
                      src={trickplayFrame.url}
                      alt=""
                      className="hidden"
                      onError={() => onTileError(trickplayFrame.url)}
                    />
                  </div>
                )}
                <span className="px-2.5 py-1 rounded-md bg-[#12131a]/95 border border-white/20 text-xs font-mono font-semibold text-white shadow-xl">
                  {formatPlayerTime(seekPreview.time)}
                </span>
              </div>
            )}

            <div className="w-full h-1.5 group-hover/seek:h-2 transition-all bg-white/20 rounded-full overflow-hidden relative">
              <div
                className="absolute inset-y-0 left-0 bg-white/30"
                style={{ width: `${bufferedPercent}%` }}
              />
              {seekPreview && (
                <div
                  className="absolute inset-y-0 left-0 bg-white/25"
                  style={{ width: `${seekPreview.percent}%` }}
                />
              )}
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]"
                style={{ width: `${progressPercent}%` }}
              />
              {duration > 0 &&
                chapters.map((ch, idx) => {
                  const pct = (ticksToSeconds(ch.StartPositionTicks) / duration) * 100;
                  if (pct <= 0.5 || pct >= 99.5) return null;
                  return (
                    <span
                      key={`chap-mark-${idx}`}
                      className="absolute inset-y-0 w-0.5 bg-white/55 pointer-events-none"
                      style={{ left: `${pct}%` }}
                    />
                  );
                })}
            </div>
            <input
              id="player-seek-slider"
              name="seek"
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              aria-label={t.player.seekPositionAria}
              onChange={(e) => onSeekTo(Number(e.target.value))}
              onPointerUp={onClearSeekPreview}
              onPointerCancel={onClearSeekPreview}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer touch-none"
            />
          </div>

          <span className="text-xs font-mono text-zinc-400 w-12 shrink-0">
            {formatPlayerTime(duration)}
          </span>
        </div>

        {/* Playback control buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? t.player.pauseAria : t.player.playAria}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSeekBy(-10)}
              title={t.player.rewind10Title}
              aria-label={t.player.rewind10Aria}
              className="hidden sm:inline-flex p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onSeekBy(10)}
              title={t.player.forward10Title}
              aria-label={t.player.forward10Aria}
              className="hidden sm:inline-flex p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume controls */}
            <div className="hidden sm:flex items-center gap-2 group/vol">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? t.player.unmuteAria : t.player.muteAria}
                className="p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                id="player-volume-slider"
                name="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                aria-label={t.player.volumeAria}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-20 h-9 accent-[#00A4DC] cursor-pointer"
              />
            </div>
          </div>

          {/* Right controls */}
          <div ref={menusContainerRef} className="relative flex items-center gap-1 sm:gap-2">
            {nextEpisode && (
              <button
                type="button"
                onClick={onPlayNextEpisode}
                title={t.player.nextEpisodeTitle}
                aria-label={t.player.nextEpisodeTitle}
                className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[38px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden md:inline">{t.player.nextShortBtn}</span>
              </button>
            )}

            <TrackMenus
              openMenu={openMenu}
              onToggleMenu={onToggleMenu}
              serverUrl={serverUrl}
              itemId={itemId}
              chapters={chapters}
              currentTime={currentTime}
              onSelectChapter={onSelectChapter}
              mediaSources={mediaSources}
              selectedMediaSourceId={selectedMediaSourceId}
              onSelectMediaSource={onSelectMediaSource}
              audioStreams={audioStreams}
              selectedAudioIndex={selectedAudioIndex}
              onSelectAudio={onSelectAudio}
              builtStream={builtStream}
              selectedSubtitleIndex={selectedSubtitleIndex}
              onSelectSubtitle={onSelectSubtitle}
              deletableSubtitleIndices={deletableSubtitleIndices}
              remoteSubLang={remoteSubLang}
              onRemoteSubLangChange={onRemoteSubLangChange}
              remoteSubResults={remoteSubResults}
              remoteSubSearching={remoteSubSearching}
              onSearchRemoteSubtitles={onSearchRemoteSubtitles}
              onDownloadRemoteSubtitle={onDownloadRemoteSubtitle}
              onUploadSubtitleFile={onUploadSubtitleFile}
              onDeleteSubtitle={onDeleteSubtitle}
              playbackRate={playbackRate}
              onSelectPlaybackRate={onSelectPlaybackRate}
              castSessions={castSessions}
              activeCastSession={activeCastSession}
              onCastToSession={onCastToSession}
              onRemotePlaystate={onRemotePlaystate}
              castMessageInput={castMessageInput}
              onCastMessageInputChange={onCastMessageInputChange}
              onSendCastMessage={onSendCastMessage}
              castStatusMessage={castStatusMessage}
              syncPlayGroups={syncPlayGroups}
              activeSyncPlayGroup={activeSyncPlayGroup}
              syncPlayGroupInput={syncPlayGroupInput}
              onSyncPlayGroupInputChange={onSyncPlayGroupInputChange}
              onCreateSyncPlayGroup={onCreateSyncPlayGroup}
              onJoinSyncPlayGroup={onJoinSyncPlayGroup}
              onLeaveSyncPlayGroup={onLeaveSyncPlayGroup}
              syncPlayRepeatMode={syncPlayRepeatMode}
              syncPlayShuffleMode={syncPlayShuffleMode}
              syncPlayIgnoreWait={syncPlayIgnoreWait}
              onSyncPlayRepeatChange={onSyncPlayRepeatChange}
              onSyncPlayShuffleToggle={onSyncPlayShuffleToggle}
              onSyncPlayIgnoreWaitToggle={onSyncPlayIgnoreWaitToggle}
              onSyncPlayQueueStep={onSyncPlayQueueStep}
            />

            <button
              type="button"
              onClick={onToggleFullscreen}
              title={t.player.fullscreenTitle}
              aria-label={t.player.fullscreenAria}
              className="p-2.5 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
