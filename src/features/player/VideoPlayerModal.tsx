import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, FastForward, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { isDemoServer } from '../../shared/api/demo/demoStore';
import { jellyfinApi } from '../../shared/api/jellyfin';
import {
  buildPlaybackStream,
  BuiltPlaybackStream,
  qualityToBitrate,
  qualityToMaxHeight,
} from '../../shared/api/playback';
import {
  BaseItemDto,
  ChapterInfo,
  GroupRepeatMode,
  GroupShuffleMode,
  MediaSegmentDto,
  MediaSourceInfo,
  MediaStream,
  PlaystateCommandData,
  RemoteSubtitleInfo,
  SessionInfoDto,
  StreamingQuality,
  SyncPlayCommandData,
  SyncPlayGroupDto,
} from '../../shared/types/jellyfin';
import { resolveResumeStartSeconds, secondsToTicks, ticksToSeconds } from '../../shared/utils/time';
import { getTrickplayFrame, selectTrickplayInfo, TrickplaySelection } from '../../shared/utils/trickplay';
import { NextEpisodeCard } from './components/NextEpisodeCard';
import { PlayerControls } from './components/PlayerControls';
import { PlayerEndScreen } from './components/PlayerEndScreen';
import { ResumePromptOverlay } from './components/ResumePromptOverlay';
import { PlayerMenuKind } from './components/TrackMenus';
import { useAssSubtitles } from './hooks/useAssSubtitles';
import { useEpisodeQueue } from './hooks/useEpisodeQueue';
import { useMediaSession } from './hooks/useMediaSession';
import { usePlayerKeyboard } from './hooks/usePlayerKeyboard';
import { useSubtitles } from './hooks/useSubtitles';

export interface PlayerRemoteHandlers {
  onPlaystate: (cmd: PlaystateCommandData) => void;
  onSyncPlayCommand: (cmd: SyncPlayCommandData) => void;
  onSyncPlayGroupUpdate: (data: unknown) => void;
}

interface VideoPlayerModalProps {
  item: BaseItemDto;
  episodeQueue?: BaseItemDto[];
  onClose: () => void;
  onSyncProgress?: () => Promise<void>;
  onProgressUpdated?: () => void;
  onRegisterRemoteHandlers?: (handlers: PlayerRemoteHandlers | null) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  item,
  episodeQueue,
  onClose,
  onSyncProgress,
  onProgressUpdated,
  onRegisterRemoteHandlers,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const { preferences, updatePreferences, t } = usePreferences();
  const tRef = useRef(t);
  tRef.current = t;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimer = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);
  const bufferingTimerRef = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef<number>(-1);
  const lastReportedTicksRef = useRef<number>(0);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const isClosingRef = useRef<boolean>(false);
  const pendingSeekTargetRef = useRef<number | null>(null);
  const seekFeedbackTimerRef = useRef<number | null>(null);
  const seekPreviewTimerRef = useRef<number | null>(null);
  const seekSyncTimerRef = useRef<number | null>(null);
  const ignoreNextSeekSyncRef = useRef<boolean>(false);
  const suppressSyncBroadcastRef = useRef<boolean>(false);
  const menusContainerRef = useRef<HTMLDivElement>(null);
  const lastPointerTypeRef = useRef<string>('mouse');
  const suppressNextVideoClickRef = useRef<boolean>(false);

  const [rootItem, setRootItem] = useState<BaseItemDto>(item);
  const [loadingStream, setLoadingStream] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [hasEnded, setHasEnded] = useState<boolean>(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [similarItems, setSimilarItems] = useState<BaseItemDto[]>([]);
  const [dismissedPromptId, setDismissedPromptId] = useState<string | null>(null);

  const [mediaSources, setMediaSources] = useState<MediaSourceInfo[]>([]);
  const [mediaSource, setMediaSource] = useState<MediaSourceInfo | null>(null);
  const [chapters, setChapters] = useState<ChapterInfo[]>([]);
  const [playSessionId, setPlaySessionId] = useState<string | undefined>(undefined);
  const [builtStream, setBuiltStream] = useState<BuiltPlaybackStream | null>(null);
  const [activePlayMethodOverride, setActivePlayMethodOverride] = useState<'DirectPlay' | null>(null);
  const [segments, setSegments] = useState<MediaSegmentDto[]>([]);
  const [audioStreams, setAudioStreams] = useState<MediaStream[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | -1>(-1);
  const [castSessions, setCastSessions] = useState<SessionInfoDto[]>([]);
  const [activeCastSession, setActiveCastSession] = useState<SessionInfoDto | null>(null);
  const [castMessageInput, setCastMessageInput] = useState('');
  const [castStatusMessage, setCastStatusMessage] = useState<string | null>(null);
  const [syncPlayGroups, setSyncPlayGroups] = useState<SyncPlayGroupDto[]>([]);
  const [activeSyncPlayGroup, setActiveSyncPlayGroup] = useState<SyncPlayGroupDto | null>(null);
  const [syncPlayGroupInput, setSyncPlayGroupInput] = useState<string>('');
  const [syncPlayRepeatMode, setSyncPlayRepeatMode] = useState<GroupRepeatMode>('RepeatNone');
  const [syncPlayShuffleMode, setSyncPlayShuffleMode] = useState<GroupShuffleMode>('Sorted');
  const [syncPlayIgnoreWait, setSyncPlayIgnoreWait] = useState<boolean>(false);
  const [remoteSubLang, setRemoteSubLang] = useState<string>(
    preferences.preferredSubtitleLang !== 'none' ? preferences.preferredSubtitleLang : 'eng'
  );
  const [remoteSubResults, setRemoteSubResults] = useState<RemoteSubtitleInfo[]>([]);
  const [remoteSubSearching, setRemoteSubSearching] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  isPlayingRef.current = isPlaying;
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [selectedQuality, setSelectedQuality] = useState<StreamingQuality>(preferences.quality);
  const selectedQualityRef = useRef<StreamingQuality>(selectedQuality);
  selectedQualityRef.current = selectedQuality;
  const [isPiP, setIsPiP] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const supportsPiP =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    Boolean(document.pictureInPictureEnabled);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [openMenu, setOpenMenu] = useState<PlayerMenuKind>(null);
  const openMenuRef = useRef<PlayerMenuKind>(openMenu);
  openMenuRef.current = openMenu;
  const [autoSkippedId, setAutoSkippedId] = useState<string | null>(null);
  const [trickplay, setTrickplay] = useState<TrickplaySelection | null>(null);
  const [seekPreview, setSeekPreview] = useState<{ time: number; percent: number } | null>(null);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});
  const [seekFeedback, setSeekFeedback] = useState<{ delta: number; key: number } | null>(null);
  const [resumeDecision, setResumeDecision] = useState<{
    itemId: string;
    startTicks: number;
  } | null>(null);
  const [resumePrompt, setResumePrompt] = useState<{
    item: BaseItemDto;
    resumeTicks: number;
    resumeSeconds: number;
    durationSeconds: number;
  } | null>(null);

  useEffect(() => {
    setRootItem(item);
  }, [item]);

  const handleQueueLoadingStart = useCallback(() => setLoadingStream(true), []);
  const { activeItem, setActiveItem, setQueue, nextEpisode } = useEpisodeQueue({
    rootItem,
    initialItemId: item.Id,
    initialQueue: episodeQueue,
    serverUrl,
    accessToken,
    userId: user?.Id,
    loadEpisodeErrorText: tRef.current.player.loadEpisodeError,
    onError: setStreamError,
    onLoadingStart: handleQueueLoadingStart,
  });

  const { isAssActive } = useAssSubtitles({
    videoRef,
    serverUrl,
    accessToken,
    itemId: activeItem.Id,
    mediaSource,
    builtStream,
    selectedSubtitleIndex,
  });

  const subtitleLines = useSubtitles(
    videoRef,
    builtStream,
    isAssActive ? -1 : selectedSubtitleIndex
  );

  const clearBuffering = useCallback(() => {
    if (bufferingTimerRef.current) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsBuffering(false);
  }, []);

  const scheduleBuffering = useCallback(() => {
    if (bufferingTimerRef.current) {
      window.clearTimeout(bufferingTimerRef.current);
    }
    bufferingTimerRef.current = window.setTimeout(() => {
      bufferingTimerRef.current = null;
      setIsBuffering(true);
    }, 250);
  }, []);

  const bumpControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      window.clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = window.setTimeout(() => {
      if (!openMenuRef.current && isPlayingRef.current) {
        setShowControls(false);
      }
    }, 3200);
  }, []);

  useEffect(() => {
    if (openMenu || !isPlaying) {
      setShowControls(true);
      if (hideControlsTimer.current) {
        window.clearTimeout(hideControlsTimer.current);
        hideControlsTimer.current = null;
      }
    } else {
      bumpControls();
    }
  }, [openMenu, isPlaying, bumpControls]);

  // Load PlaybackInfo + MediaSegments whenever activeItem or resumeDecision changes
  useEffect(() => {
    let active = true;
    if (!serverUrl || !accessToken || !user || activeItem.Type === 'Series') return;

    async function loadPlayback() {
      setLoadingStream(true);
      setBuiltStream(null);
      setMediaSources([]);
      setMediaSource(null);
      setChapters([]);
      setCastStatusMessage(null);
      setResumePrompt(null);
      setStreamError(null);
      setOpenMenu(null);
      setAutoSkippedId(null);
      setHasEnded(false);
      setNextCountdown(null);
      setDismissedPromptId(null);
      setTrickplay(null);
      setSeekPreview(null);
      setFailedTiles({});

      try {
        let resolvedDetail: BaseItemDto | null = null;
        let effectiveStartTicks = 0;

        if (resumeDecision?.itemId === activeItem.Id) {
          effectiveStartTicks = resumeDecision.startTicks;
        } else {
          const inlineTicks = activeItem.UserData?.PlaybackPositionTicks ?? 0;
          const inlineSeconds = resolveResumeStartSeconds(inlineTicks, activeItem.RunTimeTicks);
          if (inlineSeconds > 0) {
            setResumePrompt({
              item: activeItem,
              resumeTicks: inlineTicks,
              resumeSeconds: inlineSeconds,
              durationSeconds: ticksToSeconds(activeItem.RunTimeTicks),
            });
            setLoadingStream(false);
            return;
          }

          resolvedDetail = await jellyfinApi
            .getItemDetail(serverUrl, accessToken!, user!.Id, activeItem.Id)
            .catch(() => null);
          if (!active) return;

          const detailTicks = resolvedDetail?.UserData?.PlaybackPositionTicks ?? 0;
          const runtimeTicks = resolvedDetail?.RunTimeTicks ?? activeItem.RunTimeTicks;
          const detailSeconds = resolveResumeStartSeconds(detailTicks, runtimeTicks);
          if (detailSeconds > 0) {
            setResumePrompt({
              item: resolvedDetail ?? activeItem,
              resumeTicks: detailTicks,
              resumeSeconds: detailSeconds,
              durationSeconds: ticksToSeconds(runtimeTicks),
            });
            setLoadingStream(false);
            return;
          }
        }

        const activeQuality = selectedQualityRef.current;
        const similarTargetId = activeItem.SeriesId || activeItem.Id;
        const [playbackInfo, itemSegments, itemDetail, related] = await Promise.all([
          jellyfinApi.getPlaybackInfo(serverUrl, accessToken!, user!.Id, activeItem.Id, {
            maxStreamingBitrate: qualityToBitrate(activeQuality),
            maxHeight: qualityToMaxHeight(activeQuality),
            startTimeTicks: effectiveStartTicks,
          }),
          jellyfinApi.getMediaSegments(serverUrl, accessToken!, activeItem.Id),
          resolvedDetail
            ? Promise.resolve(resolvedDetail)
            : jellyfinApi.getItemDetail(serverUrl, accessToken!, user!.Id, activeItem.Id).catch(() => null),
          jellyfinApi.getSimilarItems(serverUrl, accessToken!, user!.Id, similarTargetId, 6).catch(() => []),
        ]);

        if (!active) return;
        const source = playbackInfo.MediaSources?.[0];
        if (!source) {
          setStreamError(tRef.current.player.noPlaybackSources);
          setLoadingStream(false);
          return;
        }

        const audios = (source.MediaStreams ?? []).filter((s) => s.Type === 'Audio');
        const preferredAudio =
          audios.find((a) => a.Language?.toLowerCase() === preferences.preferredAudioLang) ??
          audios.find((a) => a.Index === source.DefaultAudioStreamIndex) ??
          audios[0];

        const subtitles = (source.MediaStreams ?? []).filter((s) => s.Type === 'Subtitle');
        const preferredSub =
          preferences.preferredSubtitleLang === 'none'
            ? undefined
            : subtitles.find((s) => s.Language?.toLowerCase() === preferences.preferredSubtitleLang) ??
              subtitles.find((s) => s.Index === source.DefaultSubtitleStreamIndex);

        const runtimeTicks =
          source.RunTimeTicks ?? itemDetail?.RunTimeTicks ?? activeItem.RunTimeTicks;
        const startSeconds =
          effectiveStartTicks > 0 ? resolveResumeStartSeconds(effectiveStartTicks, runtimeTicks) : 0;
        const totalDuration = ticksToSeconds(runtimeTicks);

        let activeSource = source;
        let activePlaySessionId = playbackInfo.PlaySessionId;
        const previewStream = buildPlaybackStream(
          serverUrl,
          accessToken!,
          activeItem.Id,
          activeSource,
          activePlaySessionId,
          preferredAudio?.Index,
          activeQuality,
          preferredSub?.Index
        );

        // Renegotiate via PlaybackInfo when an encoded subtitle or non-default transcoding track needs server TranscodingUrl
        if (
          previewStream.encodedSubtitleIndex !== undefined &&
          !activeSource.TranscodingUrl?.includes('SubtitleMethod=Encode')
        ) {
          const renegotiated = await jellyfinApi
            .getPlaybackInfo(serverUrl, accessToken!, user!.Id, activeItem.Id, {
              maxStreamingBitrate: qualityToBitrate(activeQuality),
              maxHeight: qualityToMaxHeight(activeQuality),
              startTimeTicks: effectiveStartTicks,
              mediaSourceId: activeSource.Id,
              audioStreamIndex: preferredAudio?.Index,
              subtitleStreamIndex: preferredSub?.Index,
              alwaysBurnInSubtitleWhenTranscoding: true,
            })
            .catch(() => null);
          if (!active) return;
          const nextMatched =
            renegotiated?.MediaSources?.find((s) => s.Id === activeSource.Id) ??
            renegotiated?.MediaSources?.[0];
          if (nextMatched) {
            activeSource = nextMatched;
            activePlaySessionId = renegotiated?.PlaySessionId ?? activePlaySessionId;
          }
        }

        const stream: BuiltPlaybackStream = {
          ...buildPlaybackStream(
            serverUrl,
            accessToken!,
            activeItem.Id,
            activeSource,
            activePlaySessionId,
            preferredAudio?.Index,
            activeQuality,
            preferredSub?.Index
          ),
          startSeconds,
          durationSeconds: totalDuration,
        };

        setMediaSources(playbackInfo.MediaSources ?? [activeSource]);
        setMediaSource(activeSource);
        setChapters(itemDetail?.Chapters ?? activeItem.Chapters ?? []);
        setPlaySessionId(activePlaySessionId);
        setAudioStreams(audios);
        setSelectedAudioIndex(preferredAudio?.Index);
        setSelectedSubtitleIndex(preferredSub?.Index ?? -1);
        setSegments(itemSegments);
        setSimilarItems(related);
        setTrickplay(selectTrickplayInfo(itemDetail ?? activeItem, activeSource.Id));
        setBuiltStream(stream);
        setDuration(totalDuration);
        setLoadingStream(false);

        jellyfinApi.reportPlaybackStart(serverUrl, accessToken!, {
          ItemId: activeItem.Id,
          MediaSourceId: activeSource.Id,
          PlaySessionId: activePlaySessionId,
          PositionTicks: effectiveStartTicks,
          AudioStreamIndex: preferredAudio?.Index,
          SubtitleStreamIndex: preferredSub?.Index,
          PlayMethod: stream.playMethod,
        });
      } catch (err) {
        if (!active) return;
        setStreamError(
          err instanceof Error ? err.message : tRef.current.player.playbackInitError
        );
        setLoadingStream(false);
      }
    }

    loadPlayback();
    return () => {
      active = false;
    };
  }, [
    activeItem,
    resumeDecision,
    serverUrl,
    accessToken,
    user,
    preferences.preferredAudioLang,
    preferences.preferredSubtitleLang,
  ]);

  // Attach HLS or direct stream to the <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !builtStream) return;

    lastTimeUpdateRef.current = -1;
    ignoreNextSeekSyncRef.current = false;
    setActivePlayMethodOverride(null);
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const startSeconds = builtStream.startSeconds ?? 0;
    const knownDuration = builtStream.durationSeconds ?? 0;
    let appliedResume = startSeconds <= 0;
    let detachMetadataListener: (() => void) | null = null;

    const applyResumePosition = () => {
      if (appliedResume) return;
      const effectiveDuration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : knownDuration;
      if (effectiveDuration > 0 && startSeconds >= effectiveDuration - 5) {
        appliedResume = true;
        return;
      }
      // Wait for HAVE_METADATA so setting currentTime persists across MSE/native initialization
      if (video.readyState < 1) return;
      if (Math.abs(video.currentTime - startSeconds) > 2) {
        ignoreNextSeekSyncRef.current = true;
        video.currentTime = startSeconds;
        setCurrentTime(startSeconds);
      }
      appliedResume = true;
    };

    const tryAutoPlay = () => {
      video.play().catch(() => {
        // Browser may require explicit user interaction if playback wasn't triggered by a direct gesture
      });
    };

    const listenForMetadata = (autoPlayOnMetadata: boolean) => {
      detachMetadataListener?.();
      const onLoadedMetadata = () => {
        applyResumePosition();
        if (autoPlayOnMetadata) {
          tryAutoPlay();
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
      detachMetadataListener = () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    };

    if (builtStream.isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 120,
        ...(startSeconds > 0 ? { startPosition: startSeconds } : {}),
      });
      hlsRef.current = hls;
      listenForMetadata(false);
      hls.loadSource(builtStream.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyResumePosition();
        tryAutoPlay();
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (builtStream.fallbackUrl && video.src !== builtStream.fallbackUrl) {
            hls.destroy();
            hlsRef.current = null;
            appliedResume = startSeconds <= 0;
            setActivePlayMethodOverride('DirectPlay');
            listenForMetadata(true);
            video.src = builtStream.fallbackUrl;
          } else {
            setStreamError(tRef.current.player.hlsLoadError);
          }
        }
      });
    } else {
      listenForMetadata(true);
      video.src = builtStream.streamUrl;
    }

    return () => {
      detachMetadataListener?.();
      pendingSeekTargetRef.current = null;
      if (seekFeedbackTimerRef.current) {
        window.clearTimeout(seekFeedbackTimerRef.current);
        seekFeedbackTimerRef.current = null;
      }
      if (seekPreviewTimerRef.current) {
        window.clearTimeout(seekPreviewTimerRef.current);
        seekPreviewTimerRef.current = null;
      }
      if (seekSyncTimerRef.current) {
        window.clearTimeout(seekSyncTimerRef.current);
        seekSyncTimerRef.current = null;
      }
      if (bufferingTimerRef.current) {
        window.clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [builtStream, activeItem.Id]);

  const syncPlaybackProgress = useCallback(
    async (paused: boolean, refreshHomeAfter: boolean) => {
      const video = videoRef.current;
      if (!video || !serverUrl || !accessToken || !mediaSource || !builtStream || isClosingRef.current) {
        return;
      }
      const ticks = secondsToTicks(video.currentTime);
      lastReportedTicksRef.current = ticks;
      await jellyfinApi.reportPlaybackProgress(serverUrl, accessToken, {
        ItemId: activeItem.Id,
        MediaSourceId: mediaSource.Id,
        PlaySessionId: playSessionId,
        PositionTicks: ticks,
        IsPaused: paused,
        IsMuted: video.muted,
        VolumeLevel: Math.round(video.volume * 100),
        AudioStreamIndex: selectedAudioIndex,
        SubtitleStreamIndex: selectedSubtitleIndex === -1 ? undefined : selectedSubtitleIndex,
        PlayMethod: builtStream.playMethod,
      });
      if (refreshHomeAfter && !isClosingRef.current) {
        void onSyncProgress?.();
      }
    },
    [
      serverUrl,
      accessToken,
      mediaSource,
      builtStream,
      activeItem.Id,
      playSessionId,
      selectedAudioIndex,
      selectedSubtitleIndex,
      onSyncProgress,
    ]
  );

  // Report playback progress every 10s and keep Home resume/next-up rows updated in the background
  useEffect(() => {
    if (!serverUrl || !accessToken || !mediaSource || !builtStream) return;

    progressTimer.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      void syncPlaybackProgress(false, true);
    }, 10000);

    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
      }
    };
  }, [serverUrl, accessToken, mediaSource, builtStream, syncPlaybackProgress]);

  // Keep transcode session alive during long pauses via /Sessions/Playing/Ping
  useEffect(() => {
    if (!serverUrl || !accessToken || !playSessionId || builtStream?.playMethod !== 'Transcode') {
      return;
    }
    const pingTimer = window.setInterval(() => {
      if (videoRef.current?.paused && !isClosingRef.current) {
        void jellyfinApi.pingPlaybackSession(serverUrl, accessToken, playSessionId);
      }
    }, 25000);
    return () => window.clearInterval(pingTimer);
  }, [serverUrl, accessToken, playSessionId, builtStream?.playMethod]);

  // Periodically ping SyncPlay latency while inside a room
  useEffect(() => {
    if (!serverUrl || !accessToken || !activeSyncPlayGroup) return;
    const pingSync = async () => {
      const start = performance.now();
      await jellyfinApi.getSyncPlayGroup(serverUrl, accessToken, activeSyncPlayGroup.GroupId);
      const rtt = performance.now() - start;
      await jellyfinApi.syncPlayPing(serverUrl, accessToken, rtt);
    };
    void pingSync();
    const timer = window.setInterval(() => void pingSync(), 15000);
    return () => window.clearInterval(timer);
  }, [serverUrl, accessToken, activeSyncPlayGroup]);

  const handleClosePlayer = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (resumePrompt || !mediaSource) {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      }
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      onClose();
      return;
    }

    const video = videoRef.current;
    const fallbackStartSeconds = builtStream?.startSeconds ?? 0;
    const preserveUnloadedResume =
      video && video.readyState < 1 && video.currentTime === 0 && fallbackStartSeconds > 0;
    const finalTicks = preserveUnloadedResume
      ? secondsToTicks(fallbackStartSeconds)
      : video
        ? secondsToTicks(video.currentTime)
        : lastReportedTicksRef.current;

    if (video) video.pause();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    if (seekSyncTimerRef.current) {
      window.clearTimeout(seekSyncTimerRef.current);
      seekSyncTimerRef.current = null;
    }
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    const syncBeforeClose = (async () => {
      if (serverUrl && accessToken && activeSyncPlayGroup) {
        await jellyfinApi.leaveSyncPlayGroup(serverUrl, accessToken).catch(() => {});
      }
      if (serverUrl && accessToken && mediaSource) {
        await jellyfinApi
          .reportPlaybackStopped(serverUrl, accessToken, {
            ItemId: activeItem.Id,
            MediaSourceId: mediaSource.Id,
            PlaySessionId: playSessionId,
            PositionTicks: finalTicks,
          })
          .catch(() => {});
      }
      await onSyncProgress?.().catch(() => {});
    })();

    // Wait briefly so Home rows update before closing the overlay (capped to avoid UI lag)
    await Promise.race([
      syncBeforeClose,
      new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
    ]);

    onClose();
    void syncBeforeClose.finally(() => {
      onProgressUpdated?.();
    });
  }, [
    serverUrl,
    accessToken,
    mediaSource,
    activeItem.Id,
    playSessionId,
    builtStream?.startSeconds,
    resumePrompt,
    activeSyncPlayGroup,
    onSyncProgress,
    onProgressUpdated,
    onClose,
  ]);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    bumpControls();
  }, [bumpControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      setHasEnded(false);
      setNextCountdown(null);
      const baseTime =
        pendingSeekTargetRef.current !== null && video.seeking
          ? pendingSeekTargetRef.current
          : video.currentTime;
      const maxDuration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration;
      const target = Math.max(0, Math.min(maxDuration, baseTime + delta));
      pendingSeekTargetRef.current = target;
      video.currentTime = target;
      setCurrentTime(target);
      setSeekFeedback({ delta, key: Date.now() });
      if (seekFeedbackTimerRef.current) {
        window.clearTimeout(seekFeedbackTimerRef.current);
      }
      seekFeedbackTimerRef.current = window.setTimeout(() => {
        setSeekFeedback(null);
        seekFeedbackTimerRef.current = null;
      }, 650);
      bumpControls();
    },
    [duration, bumpControls]
  );

  const togglePictureInPicture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !supportsPiP) return;
    if (document.pictureInPictureElement === video) {
      document.exitPictureInPicture().catch(() => {});
      return;
    }
    if (video.readyState >= 1 && !video.disablePictureInPicture) {
      video.requestPictureInPicture().catch(() => {});
    }
  }, [supportsPiP]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    const video = videoRef.current as
      | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
      | null;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (el && typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
      return;
    }
    video?.webkitEnterFullscreen?.();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    const onWebkitBegin = () => setIsFullscreen(true);
    const onWebkitEnd = () => setIsFullscreen(false);
    const onEnterPiP = () => setIsPiP(true);
    const onLeavePiP = () => setIsPiP(false);
    document.addEventListener('fullscreenchange', onFsChange);
    video?.addEventListener('webkitbeginfullscreen', onWebkitBegin);
    video?.addEventListener('webkitendfullscreen', onWebkitEnd);
    video?.addEventListener('enterpictureinpicture', onEnterPiP);
    video?.addEventListener('leavepictureinpicture', onLeavePiP);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      video?.removeEventListener('webkitbeginfullscreen', onWebkitBegin);
      video?.removeEventListener('webkitendfullscreen', onWebkitEnd);
      video?.removeEventListener('enterpictureinpicture', onEnterPiP);
      video?.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, []);

  // Lock document scroll while fullscreen player is open and allow full 100vw coverage
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevScrollbarGutter = html.style.scrollbarGutter;
    html.style.overflow = 'hidden';
    html.style.scrollbarGutter = 'auto';
    return () => {
      html.style.overflow = prevOverflow;
      html.style.scrollbarGutter = prevScrollbarGutter;
    };
  }, []);

  usePlayerKeyboard({
    videoRef,
    hasOpenMenu: Boolean(openMenu),
    suspendPlaybackShortcuts: Boolean(resumePrompt),
    onCloseMenu: () => setOpenMenu(null),
    onClosePlayer: handleClosePlayer,
    onTogglePlayPause: togglePlayPause,
    onSeekBy: seekBy,
    onTogglePiP: togglePictureInPicture,
    onToggleFullscreen: toggleFullscreen,
    onVolumeChange: (vol, muted) => {
      setVolume(vol);
      setIsMuted(muted);
      bumpControls();
    },
    onMuteToggle: (muted) => {
      setIsMuted(muted);
      bumpControls();
    },
  });

  // Active MediaSegment ("Skip intro" / "Skip credits")
  const activeSegment = useMemo(() => {
    const currentTicks = secondsToTicks(currentTime);
    return segments.find(
      (seg) =>
        (seg.Type === 'Intro' || seg.Type === 'Recap' || seg.Type === 'Outro') &&
        currentTicks >= seg.StartTicks &&
        currentTicks < seg.EndTicks - 5_000_000
    );
  }, [segments, currentTime]);

  // Auto-skip intro if enabled in user preferences
  useEffect(() => {
    if (
      preferences.autoSkipIntro &&
      activeSegment?.Type === 'Intro' &&
      autoSkippedId !== activeSegment.Id &&
      videoRef.current
    ) {
      setAutoSkippedId(activeSegment.Id);
      videoRef.current.currentTime = ticksToSeconds(activeSegment.EndTicks);
    }
  }, [preferences.autoSkipIntro, activeSegment, autoSkippedId]);

  const handleSkipSegment = () => {
    if (!activeSegment || !videoRef.current) return;
    videoRef.current.currentTime = ticksToSeconds(activeSegment.EndTicks);
    bumpControls();
  };

  // Load remote controllable sessions when Cast menu opens
  useEffect(() => {
    if (openMenu !== 'cast' || !serverUrl || !accessToken || !user) return;
    let active = true;
    setCastStatusMessage(null);
    void jellyfinApi.getControllableSessions(serverUrl, accessToken, user.Id).then((sessions) => {
      if (active) setCastSessions(sessions);
    });
    return () => {
      active = false;
    };
  }, [openMenu, serverUrl, accessToken, user]);

  // Load SyncPlay rooms when SyncPlay menu opens
  useEffect(() => {
    if (openMenu !== 'syncplay' || !serverUrl || !accessToken) return;
    let active = true;
    void jellyfinApi.getSyncPlayGroups(serverUrl, accessToken).then((groups) => {
      if (active) setSyncPlayGroups(groups);
    });
    return () => {
      active = false;
    };
  }, [openMenu, serverUrl, accessToken]);

  const handleCreateSyncPlayGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken) return;
    const roomName = syncPlayGroupInput.trim() || `${titleDisplay}`;
    const createdGroup = await jellyfinApi.createSyncPlayGroup(serverUrl, accessToken, roomName);
    const groups = await jellyfinApi.getSyncPlayGroups(serverUrl, accessToken);
    setSyncPlayGroups(groups);
    const resolved =
      createdGroup ??
      groups.find((g) => g.GroupName === roomName) ??
      groups[0] ?? { GroupId: 'active', GroupName: roomName };
    setActiveSyncPlayGroup(resolved);
    setSyncPlayGroupInput('');
    await jellyfinApi.setSyncPlayQueue(
      serverUrl,
      accessToken,
      [activeItem.Id],
      0,
      secondsToTicks(videoRef.current?.currentTime ?? currentTime)
    );
    setOpenMenu(null);
  };

  const handleJoinSyncPlayGroup = async (group: SyncPlayGroupDto) => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.joinSyncPlayGroup(serverUrl, accessToken, group.GroupId);
    setActiveSyncPlayGroup(group);
    setOpenMenu(null);
    await jellyfinApi.syncPlayReady(serverUrl, accessToken, {
      When: new Date().toISOString(),
      PositionTicks: secondsToTicks(videoRef.current?.currentTime ?? currentTime),
      IsPlaying: !videoRef.current?.paused,
    });
  };

  const handleLeaveSyncPlayGroup = async () => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.leaveSyncPlayGroup(serverUrl, accessToken).catch(() => {});
    setActiveSyncPlayGroup(null);
    setOpenMenu(null);
  };

  // Report playback stopped with keepalive if the browser tab is closed abruptly
  useEffect(() => {
    if (!serverUrl || !accessToken || !mediaSource || !builtStream) return;
    const onPageHide = () => {
      if (isClosingRef.current) return;
      const vid = videoRef.current;
      const ticks =
        vid && (vid.readyState >= 1 || vid.currentTime > 0)
          ? secondsToTicks(vid.currentTime)
          : lastReportedTicksRef.current;
      jellyfinApi.reportPlaybackStoppedKeepalive(serverUrl, accessToken, {
        ItemId: activeItem.Id,
        MediaSourceId: mediaSource.Id,
        PlaySessionId: playSessionId,
        PositionTicks: ticks,
      });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [serverUrl, accessToken, mediaSource, builtStream, activeItem.Id, playSessionId]);

  const applyNegotiatedStream = async (
    targetSource: MediaSourceInfo,
    nextAudioIdx: number | undefined,
    nextSubIdx: number | undefined,
    savedTime: number,
    totalDurationSeconds: number,
    needsBurnIn: boolean,
    qualityOverride?: StreamingQuality
  ) => {
    if (!serverUrl || !accessToken || !user?.Id) return;
    const targetQuality = qualityOverride ?? selectedQuality;
    let resolvedSource = targetSource;
    let resolvedSessionId = playSessionId;

    const preview = buildPlaybackStream(
      serverUrl,
      accessToken,
      activeItem.Id,
      resolvedSource,
      resolvedSessionId,
      nextAudioIdx,
      targetQuality,
      nextSubIdx
    );

    if (preview.playMethod === 'Transcode' || qualityOverride !== undefined) {
      const renegotiated = await jellyfinApi
        .getPlaybackInfo(serverUrl, accessToken, user.Id, activeItem.Id, {
          maxStreamingBitrate: qualityToBitrate(targetQuality),
          maxHeight: qualityToMaxHeight(targetQuality),
          startTimeTicks: secondsToTicks(savedTime),
          mediaSourceId: targetSource.Id,
          audioStreamIndex: nextAudioIdx,
          subtitleStreamIndex: nextSubIdx !== undefined && nextSubIdx >= 0 ? nextSubIdx : undefined,
          alwaysBurnInSubtitleWhenTranscoding: needsBurnIn,
        })
        .catch(() => null);
      const matched =
        renegotiated?.MediaSources?.find((s) => s.Id === targetSource.Id) ??
        renegotiated?.MediaSources?.[0];
      if (matched) {
        resolvedSource = matched;
        resolvedSessionId = renegotiated?.PlaySessionId ?? resolvedSessionId;
        setMediaSource(matched);
        setPlaySessionId(resolvedSessionId);
      }
    }

    setBuiltStream({
      ...buildPlaybackStream(
        serverUrl,
        accessToken,
        activeItem.Id,
        resolvedSource,
        resolvedSessionId,
        nextAudioIdx,
        targetQuality,
        nextSubIdx
      ),
      startSeconds: savedTime > 0 ? savedTime : 0,
      durationSeconds: totalDurationSeconds,
    });
  };

  const handleSelectQuality = async (nextQuality: StreamingQuality) => {
    if (!serverUrl || !accessToken || !mediaSource) return;
    setOpenMenu(null);
    if (nextQuality === selectedQuality) return;

    const savedTime = videoRef.current?.currentTime ?? currentTime;
    const subNeedsBurnIn = builtStream?.encodedSubtitleIndex !== undefined;
    setSelectedQuality(nextQuality);
    updatePreferences({ quality: nextQuality });

    await applyNegotiatedStream(
      mediaSource,
      selectedAudioIndex,
      selectedSubtitleIndex,
      savedTime,
      builtStream?.durationSeconds ?? duration,
      subNeedsBurnIn,
      nextQuality
    );
  };

  const handleSwitchAudio = async (audioIdx: number) => {
    if (!serverUrl || !accessToken || !mediaSource) return;
    const savedTime = videoRef.current?.currentTime ?? 0;
    const subNeedsBurnIn = builtStream?.encodedSubtitleIndex !== undefined;
    setSelectedAudioIndex(audioIdx);
    setOpenMenu(null);
    await applyNegotiatedStream(
      mediaSource,
      audioIdx,
      selectedSubtitleIndex,
      savedTime,
      builtStream?.durationSeconds ?? duration,
      subNeedsBurnIn
    );
  };

  const handleSelectMediaSource = async (nextSource: MediaSourceInfo) => {
    if (!serverUrl || !accessToken || nextSource.Id === mediaSource?.Id) {
      setOpenMenu(null);
      return;
    }
    const savedTime = videoRef.current?.currentTime ?? 0;
    const audios = (nextSource.MediaStreams ?? []).filter((s) => s.Type === 'Audio');
    const nextAudio =
      audios.find((a) => a.Language?.toLowerCase() === preferences.preferredAudioLang) ??
      audios.find((a) => a.Index === nextSource.DefaultAudioStreamIndex) ??
      audios[0];
    const subs = (nextSource.MediaStreams ?? []).filter((s) => s.Type === 'Subtitle');
    const nextSub =
      preferences.preferredSubtitleLang === 'none'
        ? undefined
        : subs.find((s) => s.Language?.toLowerCase() === preferences.preferredSubtitleLang) ??
          subs.find((s) => s.Index === nextSource.DefaultSubtitleStreamIndex);

    const nextDuration = ticksToSeconds(nextSource.RunTimeTicks ?? activeItem.RunTimeTicks);
    setMediaSource(nextSource);
    setAudioStreams(audios);
    setSelectedAudioIndex(nextAudio?.Index);
    setSelectedSubtitleIndex(nextSub?.Index ?? -1);
    setTrickplay(selectTrickplayInfo(activeItem, nextSource.Id));
    setDuration(nextDuration);
    setOpenMenu(null);
    const nextNeedsEncode = Boolean(
      nextSub &&
        buildPlaybackStream(
          serverUrl,
          accessToken,
          activeItem.Id,
          nextSource,
          playSessionId,
          nextAudio?.Index,
          selectedQuality,
          nextSub.Index
        ).encodedSubtitleIndex !== undefined
    );
    await applyNegotiatedStream(
      nextSource,
      nextAudio?.Index,
      nextSub?.Index,
      savedTime,
      nextDuration,
      nextNeedsEncode
    );
  };

  const handleSelectSubtitle = async (subIdx: number) => {
    const prevWasEncoded = builtStream?.encodedSubtitleIndex !== undefined;
    const nextOption = builtStream?.allSubtitles.find((s) => s.index === subIdx);
    const nextNeedsEncode = nextOption?.delivery === 'encode';

    setSelectedSubtitleIndex(subIdx);
    setOpenMenu(null);

    if ((prevWasEncoded || nextNeedsEncode) && serverUrl && accessToken && mediaSource) {
      const savedTime = videoRef.current?.currentTime ?? 0;
      await applyNegotiatedStream(
        mediaSource,
        selectedAudioIndex,
        subIdx,
        savedTime,
        builtStream?.durationSeconds ?? duration,
        nextNeedsEncode
      );
    }
  };

  const handleSelectChapter = (startSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = startSeconds;
    }
    setCurrentTime(startSeconds);
    setOpenMenu(null);
    bumpControls();
  };

  const handleCastToSession = async (session: SessionInfoDto) => {
    if (!serverUrl || !accessToken) return;
    try {
      const startTicks = secondsToTicks(videoRef.current?.currentTime ?? currentTime);
      await jellyfinApi.sendRemotePlayCommand(
        serverUrl,
        accessToken,
        session.Id,
        [activeItem.Id],
        startTicks
      );
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setActiveCastSession(session);
      setCastStatusMessage(t.player.castSent(session.DeviceName || session.Client || session.Id));
    } catch {
      // Keep UI interactive if remote command fails
    }
  };

  const handleRemotePlaystate = async (command: NonNullable<PlaystateCommandData['Command']>) => {
    if (!serverUrl || !accessToken || !activeCastSession) return;
    await jellyfinApi
      .sendRemotePlaystateCommand(serverUrl, accessToken, activeCastSession.Id, command, user?.Id)
      .catch(() => {});
  };

  const handleSendCastMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !activeCastSession || !castMessageInput.trim()) return;
    await jellyfinApi
      .sendSessionMessage(serverUrl, accessToken, activeCastSession.Id, 'MorphPlay', castMessageInput)
      .catch(() => {});
    setCastMessageInput('');
    setCastStatusMessage(t.player.castMessageSent);
  };

  const refreshMediaStreams = async () => {
    if (!serverUrl || !accessToken || !user?.Id || !mediaSource) return;
    const savedTime = videoRef.current?.currentTime ?? currentTime;
    const info = await jellyfinApi
      .getPlaybackInfo(serverUrl, accessToken, user.Id, activeItem.Id, {
        maxStreamingBitrate: qualityToBitrate(selectedQuality),
        maxHeight: qualityToMaxHeight(selectedQuality),
        startTimeTicks: secondsToTicks(savedTime),
        mediaSourceId: mediaSource.Id,
        audioStreamIndex: selectedAudioIndex,
        subtitleStreamIndex: selectedSubtitleIndex >= 0 ? selectedSubtitleIndex : undefined,
        alwaysBurnInSubtitleWhenTranscoding: builtStream?.encodedSubtitleIndex !== undefined,
      })
      .catch(() => null);
    const updatedSource =
      info?.MediaSources?.find((s) => s.Id === mediaSource.Id) ?? info?.MediaSources?.[0];
    if (updatedSource) {
      setMediaSource(updatedSource);
      setPlaySessionId(info?.PlaySessionId ?? playSessionId);
      setBuiltStream({
        ...buildPlaybackStream(
          serverUrl,
          accessToken,
          activeItem.Id,
          updatedSource,
          info?.PlaySessionId ?? playSessionId,
          selectedAudioIndex,
          selectedQuality,
          selectedSubtitleIndex
        ),
        startSeconds: savedTime > 0 ? savedTime : 0,
        durationSeconds: builtStream?.durationSeconds ?? duration,
      });
    }
  };

  const handleSearchRemoteSubtitles = async () => {
    if (!serverUrl || !accessToken) return;
    setRemoteSubSearching(true);
    try {
      const results = await jellyfinApi.searchRemoteSubtitles(
        serverUrl,
        accessToken,
        activeItem.Id,
        remoteSubLang
      );
      setRemoteSubResults(results);
    } catch {
      setRemoteSubResults([]);
    } finally {
      setRemoteSubSearching(false);
    }
  };

  const handleDownloadRemoteSubtitle = async (subtitleId: string) => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.downloadRemoteSubtitles(serverUrl, accessToken, activeItem.Id, subtitleId);
    setRemoteSubResults([]);
    await refreshMediaStreams();
  };

  const handleUploadSubtitleFile = async (file: File) => {
    if (!serverUrl || !accessToken) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'srt';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : '';
    if (!base64) return;
    await jellyfinApi.uploadSubtitle(serverUrl, accessToken, activeItem.Id, {
      Language: remoteSubLang,
      Format: ext,
      IsForced: false,
      Data: base64,
    });
    await refreshMediaStreams();
  };

  const handleDeleteSubtitle = async (index: number) => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.deleteSubtitle(serverUrl, accessToken, activeItem.Id, index);
    if (selectedSubtitleIndex === index) setSelectedSubtitleIndex(-1);
    await refreshMediaStreams();
  };

  const handleSyncPlayRepeatChange = async (mode: GroupRepeatMode) => {
    if (!serverUrl || !accessToken) return;
    setSyncPlayRepeatMode(mode);
    await jellyfinApi.syncPlaySetRepeatMode(serverUrl, accessToken, mode).catch(() => {});
  };

  const handleSyncPlayShuffleToggle = async () => {
    if (!serverUrl || !accessToken) return;
    const next: GroupShuffleMode = syncPlayShuffleMode === 'Shuffle' ? 'Sorted' : 'Shuffle';
    setSyncPlayShuffleMode(next);
    await jellyfinApi.syncPlaySetShuffleMode(serverUrl, accessToken, next).catch(() => {});
  };

  const handleSyncPlayIgnoreWaitToggle = async () => {
    if (!serverUrl || !accessToken) return;
    const next = !syncPlayIgnoreWait;
    setSyncPlayIgnoreWait(next);
    await jellyfinApi.syncPlaySetIgnoreWait(serverUrl, accessToken, next).catch(() => {});
  };

  const handleSyncPlayQueueStep = async (dir: 'next' | 'prev' | 'stop') => {
    if (!serverUrl || !accessToken) return;
    if (dir === 'stop') {
      await jellyfinApi.syncPlayStop(serverUrl, accessToken).catch(() => {});
      return;
    }
    const plId = activeItem.PlaylistItemId ?? activeItem.Id;
    if (dir === 'next') {
      await jellyfinApi.syncPlayNextItem(serverUrl, accessToken, plId).catch(() => {});
    } else {
      await jellyfinApi.syncPlayPreviousItem(serverUrl, accessToken, plId).catch(() => {});
    }
  };

  const handlePlayNextEpisode = useCallback(() => {
    if (!nextEpisode) return;
    setHasEnded(false);
    setNextCountdown(null);
    if (serverUrl && accessToken && mediaSource) {
      void jellyfinApi
        .reportPlaybackStopped(serverUrl, accessToken, {
          ItemId: activeItem.Id,
          MediaSourceId: mediaSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: secondsToTicks(videoRef.current?.currentTime ?? duration),
        })
        .catch(() => {})
        .finally(() => {
          onProgressUpdated?.();
        });
    }
    setActiveItem(nextEpisode);
  }, [nextEpisode, serverUrl, accessToken, mediaSource, activeItem.Id, playSessionId, duration, onProgressUpdated, setActiveItem]);

  // Register WebSocket Playstate & SyncPlay handlers while player is mounted
  useEffect(() => {
    if (!onRegisterRemoteHandlers) return;

    const runSuppressed = (fn: () => void) => {
      suppressSyncBroadcastRef.current = true;
      try {
        fn();
      } finally {
        window.setTimeout(() => {
          suppressSyncBroadcastRef.current = false;
        }, 350);
      }
    };

    onRegisterRemoteHandlers({
      onPlaystate: (cmd) => {
        const video = videoRef.current;
        if (!video) return;
        switch (cmd.Command) {
          case 'Pause':
            video.pause();
            break;
          case 'Unpause':
            video.play().catch(() => {});
            break;
          case 'PlayPause':
            if (video.paused) video.play().catch(() => {});
            else video.pause();
            break;
          case 'Seek':
            if (typeof cmd.SeekPositionTicks === 'number') {
              const target = ticksToSeconds(cmd.SeekPositionTicks);
              video.currentTime = target;
              setCurrentTime(target);
            }
            break;
          case 'Stop':
            void handleClosePlayer();
            break;
          case 'NextTrack':
            handlePlayNextEpisode();
            break;
        }
      },
      onSyncPlayCommand: (cmd) => {
        const video = videoRef.current;
        if (!video) return;
        runSuppressed(() => {
          if (typeof cmd.PositionTicks === 'number') {
            const target = ticksToSeconds(cmd.PositionTicks);
            if (Math.abs(video.currentTime - target) > 1.5) {
              video.currentTime = target;
              setCurrentTime(target);
            }
          }
          if (cmd.Command === 'Pause') {
            video.pause();
          } else if (cmd.Command === 'Unpause') {
            video.play().catch(() => {});
          } else if (cmd.Command === 'Stop') {
            void handleClosePlayer();
          }
        });
      },
      onSyncPlayGroupUpdate: (data) => {
        if (!data || typeof data !== 'object') return;
        const payload = data as { Type?: string; GroupId?: string };
        if (payload.Type === 'UserLeft' || payload.Type === 'GroupLeft') {
          setActiveSyncPlayGroup(null);
        } else if (serverUrl && accessToken && openMenu === 'syncplay') {
          void jellyfinApi.getSyncPlayGroups(serverUrl, accessToken).then(setSyncPlayGroups);
        }
      },
    });

    return () => {
      onRegisterRemoteHandlers(null);
    };
  }, [onRegisterRemoteHandlers, serverUrl, accessToken, openMenu, handleClosePlayer, handlePlayNextEpisode]);

  const handleReplay = useCallback(() => {
    setHasEnded(false);
    setNextCountdown(null);
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
      video.play().catch(() => {});
    }
  }, []);

  const handlePlaySimilar = useCallback(
    (target: BaseItemDto) => {
      setHasEnded(false);
      setNextCountdown(null);
      setQueue([]);
      setRootItem(target);
    },
    [setQueue]
  );

  useEffect(() => {
    if (!hasEnded || nextCountdown === null || !nextEpisode) return;
    if (nextCountdown <= 0) {
      handlePlayNextEpisode();
      return;
    }
    const timer = window.setTimeout(() => {
      setNextCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [hasEnded, nextCountdown, nextEpisode, handlePlayNextEpisode]);

  const showNextEpisodePrompt =
    !hasEnded &&
    dismissedPromptId !== activeItem.Id &&
    Boolean(nextEpisode) &&
    ((duration > 60 && currentTime >= duration - 25) || activeSegment?.Type === 'Outro');

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const trickplayFrame = useMemo(() => {
    if (!seekPreview || !trickplay || !serverUrl || !accessToken) return null;
    return getTrickplayFrame(
      serverUrl,
      accessToken,
      activeItem.Id,
      trickplay,
      seekPreview.time,
      isDemoServer(serverUrl)
    );
  }, [seekPreview, trickplay, serverUrl, accessToken, activeItem.Id]);

  const updateSeekPreviewFromClientX = useCallback(
    (clientX: number) => {
      const el = seekBarRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setSeekPreview({ time: ratio * duration, percent: ratio * 100 });
    },
    [duration]
  );

  const titleDisplay = activeItem.SeriesName ? activeItem.SeriesName : activeItem.Name;
  const subtitleDisplay =
    activeItem.Type === 'Episode' && activeItem.ParentIndexNumber !== undefined
      ? `${t.common.episodeCode(activeItem.ParentIndexNumber, activeItem.IndexNumber)} · ${activeItem.Name}`
      : activeItem.ProductionYear
        ? `${activeItem.ProductionYear}`
        : '';

  useMediaSession({
    serverUrl,
    activeItem,
    titleDisplay,
    subtitleDisplay,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    hasNextEpisode: Boolean(nextEpisode),
    onPlay: () => {
      videoRef.current?.play().catch(() => {});
    },
    onPause: () => {
      videoRef.current?.pause();
    },
    onSeekBy: seekBy,
    onSeekTo: (next) => {
      if (videoRef.current) videoRef.current.currentTime = next;
      setCurrentTime(next);
    },
    onNextTrack: handlePlayNextEpisode,
    onStop: () => {
      void handleClosePlayer();
    },
  });

  return (
    <div
      ref={containerRef}
      onMouseMove={bumpControls}
      onPointerDown={(e) => {
        lastPointerTypeRef.current = e.pointerType;
        if (
          openMenu &&
          menusContainerRef.current &&
          !menusContainerRef.current.contains(e.target as Node)
        ) {
          setOpenMenu(null);
          suppressNextVideoClickRef.current = true;
        }
        if (e.pointerType !== 'mouse') {
          if (!showControls) {
            suppressNextVideoClickRef.current = true;
            bumpControls();
          } else {
            bumpControls();
          }
        }
      }}
      className={`fixed inset-0 z-[60] overflow-hidden bg-black select-none ${
        showControls || resumePrompt ? 'cursor-default' : 'cursor-none'
      }`}
    >
      {/* HTML5 video element */}
      <video
        ref={videoRef}
        playsInline
        crossOrigin="anonymous"
        onClick={() => {
          if (suppressNextVideoClickRef.current) {
            suppressNextVideoClickRef.current = false;
            return;
          }
          if (lastPointerTypeRef.current !== 'mouse') {
            setShowControls((prev) => {
              if (prev) return false;
              bumpControls();
              return true;
            });
            return;
          }
          togglePlayPause();
        }}
        onDoubleClick={() => {
          if (lastPointerTypeRef.current === 'mouse') {
            toggleFullscreen();
          }
        }}
        onPlay={() => {
          setIsPlaying(true);
          if (activeSyncPlayGroup && !suppressSyncBroadcastRef.current && serverUrl && accessToken) {
            void jellyfinApi.syncPlayUnpause(serverUrl, accessToken).catch(() => {});
          }
        }}
        onPlaying={() => {
          setIsPlaying(true);
          clearBuffering();
        }}
        onPause={(e) => {
          setIsPlaying(false);
          clearBuffering();
          if (!isClosingRef.current && e.currentTarget.readyState >= 1) {
            void syncPlaybackProgress(true, true);
            if (activeSyncPlayGroup && !suppressSyncBroadcastRef.current && serverUrl && accessToken) {
              void jellyfinApi.syncPlayPause(serverUrl, accessToken).catch(() => {});
            }
          }
        }}
        onWaiting={(e) => {
          if (!e.currentTarget.paused) scheduleBuffering();
        }}
        onLoadedData={(e) => {
          if (!e.currentTarget.paused && e.currentTarget.readyState >= 2) clearBuffering();
        }}
        onSeeking={scheduleBuffering}
        onSeeked={() => {
          pendingSeekTargetRef.current = null;
          clearBuffering();
          if (ignoreNextSeekSyncRef.current) {
            ignoreNextSeekSyncRef.current = false;
            return;
          }
          if (isClosingRef.current) return;
          if (activeSyncPlayGroup && !suppressSyncBroadcastRef.current && serverUrl && accessToken && videoRef.current) {
            void jellyfinApi
              .syncPlaySeek(serverUrl, accessToken, secondsToTicks(videoRef.current.currentTime))
              .catch(() => {});
          }
          if (seekSyncTimerRef.current) {
            window.clearTimeout(seekSyncTimerRef.current);
          }
          seekSyncTimerRef.current = window.setTimeout(() => {
            seekSyncTimerRef.current = null;
            const vid = videoRef.current;
            if (vid) {
              void syncPlaybackProgress(vid.paused, true);
            }
          }, 350);
        }}
        onCanPlay={clearBuffering}
        onCanPlayThrough={clearBuffering}
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          if (Number.isFinite(vid.duration) && vid.duration > 0) setDuration(vid.duration);
        }}
        onTimeUpdate={(e) => {
          const vid = e.currentTarget;
          setCurrentTime(vid.currentTime);
          if (!vid.paused && vid.currentTime !== lastTimeUpdateRef.current) {
            lastTimeUpdateRef.current = vid.currentTime;
            clearBuffering();
          }
          if (vid.buffered.length > 0 && vid.duration > 0) {
            const end = vid.buffered.end(vid.buffered.length - 1);
            setBufferedPercent(Math.min(100, (end / vid.duration) * 100));
          }
        }}
        onEnded={(e) => {
          const vid = e.currentTarget;
          setIsPlaying(false);
          clearBuffering();
          setHasEnded(true);
          setShowControls(true);

          if (serverUrl && accessToken && mediaSource) {
            void jellyfinApi
              .reportPlaybackStopped(serverUrl, accessToken, {
                ItemId: activeItem.Id,
                MediaSourceId: mediaSource.Id,
                PlaySessionId: playSessionId,
                PositionTicks: secondsToTicks(vid.duration || duration),
              })
              .catch(() => {})
              .finally(() => {
                onProgressUpdated?.();
              });
          }

          setNextCountdown(nextEpisode && preferences.autoPlayNextEpisode ? 5 : null);
        }}
        className="w-full h-full object-contain"
        // Keeping opacity < 1 avoids buggy Windows DWM MPO hardware overlay promotion when controls hide
        style={{ opacity: 0.995 }}
      >
        {builtStream?.subtitleTracks
          .filter((track) => !isAssActive && track.index === selectedSubtitleIndex)
          .map((track) => (
            <track
              key={track.index}
              kind="subtitles"
              src={track.src}
              srcLang={track.language}
              label={track.label}
            />
          ))}
      </video>

      {/* Cinema-positioned subtitle overlay */}
      {!isAssActive && subtitleLines.length > 0 && selectedSubtitleIndex !== -1 && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 px-4 sm:px-10 transition-all duration-200 ${
            showControls ? 'bottom-28 sm:bottom-[11.5%]' : 'bottom-[5.5%]'
          }`}
        >
          <div className="max-w-4xl bg-transparent px-3.5 py-1 text-center">
            {subtitleLines.map((line, idx) => (
              <p
                key={`${idx}-${line}`}
                className="text-base sm:text-xl md:text-2xl lg:text-[28px] font-semibold leading-snug text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.95),1px_1px_0_rgba(0,0,0,0.9),-1px_-1px_0_rgba(0,0,0,0.9),1px_-1px_0_rgba(0,0,0,0.9),-1px_1px_0_rgba(0,0,0,0.9)]"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Instant seek feedback pill */}
      {seekFeedback && !streamError && (
        <div
          key={seekFeedback.key}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-2 rounded-full bg-black/75 border border-white/15 px-4 py-2 text-sm font-bold text-white shadow-2xl backdrop-blur-md animate-fadeIn"
        >
          {seekFeedback.delta < 0 ? (
            <RotateCcw className="w-4 h-4 text-[#00A4DC]" />
          ) : (
            <RotateCw className="w-4 h-4 text-[#00A4DC]" />
          )}
          <span>{seekFeedback.delta > 0 ? `+${seekFeedback.delta} s` : `${seekFeedback.delta} s`}</span>
        </div>
      )}

      {/* Loading / buffering spinner */}
      {(loadingStream || isBuffering) && !streamError && !resumePrompt && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
          <Loader2 className="w-12 h-12 text-[#00A4DC] animate-spin" />
          {loadingStream && (
            <p className="text-sm text-zinc-300 font-medium">{t.player.preparing}</p>
          )}
        </div>
      )}

      {/* Resume vs start over prompt */}
      {resumePrompt && !streamError && (
        <ResumePromptOverlay
          serverUrl={serverUrl}
          item={resumePrompt.item}
          titleDisplay={titleDisplay}
          subtitleDisplay={subtitleDisplay}
          resumeSeconds={resumePrompt.resumeSeconds}
          durationSeconds={resumePrompt.durationSeconds}
          onResume={() => {
            setResumePrompt(null);
            setResumeDecision({
              itemId: activeItem.Id,
              startTicks: resumePrompt.resumeTicks,
            });
          }}
          onStartFromBeginning={() => {
            setResumePrompt(null);
            setResumeDecision({
              itemId: activeItem.Id,
              startTicks: 0,
            });
          }}
          onCancel={handleClosePlayer}
        />
      )}

      {/* Stream error screen */}
      {streamError && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center gap-4 z-30">
          <AlertCircle className="w-12 h-12 text-rose-400" />
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-white">{t.player.playbackFailed}</h3>
            <p className="text-sm text-zinc-400">{streamError}</p>
          </div>
          <button
            type="button"
            onClick={handleClosePlayer}
            className="px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90"
          >
            {t.player.backToCatalog}
          </button>
        </div>
      )}

      {/* Floating button: Skip intro / credits */}
      {activeSegment && !streamError && (
        <button
          type="button"
          onClick={handleSkipSegment}
          className="absolute right-5 sm:right-10 bottom-28 sm:bottom-32 z-30 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/95 hover:bg-white text-black font-bold text-sm shadow-2xl transition-transform active:scale-95 animate-fadeIn"
        >
          <FastForward className="w-4 h-4 fill-black" />
          {activeSegment.Type === 'Outro'
            ? t.player.skipCredits
            : activeSegment.Type === 'Recap'
              ? t.player.skipRecap
              : t.player.skipIntro}
        </button>
      )}

      {showNextEpisodePrompt && nextEpisode && !streamError && (
        <NextEpisodeCard
          serverUrl={serverUrl}
          nextEpisode={nextEpisode}
          onPlayNow={handlePlayNextEpisode}
          onDismiss={() => setDismissedPromptId(activeItem.Id)}
        />
      )}

      {hasEnded && !streamError && (
        <PlayerEndScreen
          serverUrl={serverUrl}
          activeItem={activeItem}
          nextEpisode={nextEpisode}
          nextCountdown={nextCountdown}
          similarItems={similarItems}
          titleDisplay={titleDisplay}
          subtitleDisplay={subtitleDisplay}
          onPlayNextEpisode={handlePlayNextEpisode}
          onCancelCountdown={() => setNextCountdown(null)}
          onReplay={handleReplay}
          onClosePlayer={handleClosePlayer}
          onPlaySimilar={handlePlaySimilar}
        />
      )}

      {!resumePrompt && (
        <PlayerControls
          showControls={showControls}
          loadingStream={loadingStream}
          isBuffering={isBuffering}
          streamError={streamError}
          hasEnded={hasEnded}
          titleDisplay={titleDisplay}
          subtitleDisplay={subtitleDisplay}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          bufferedPercent={bufferedPercent}
          progressPercent={progressPercent}
          volume={volume}
          isMuted={isMuted}
          selectedQuality={selectedQuality}
          supportsPiP={supportsPiP}
          isPiP={isPiP}
          isFullscreen={isFullscreen}
          playbackRate={playbackRate}
          openMenu={openMenu}
          serverUrl={serverUrl}
          itemId={activeItem.Id}
          chapters={chapters}
          mediaSources={mediaSources}
          selectedMediaSourceId={mediaSource?.Id}
          castSessions={castSessions}
          activeCastSession={activeCastSession}
          castMessageInput={castMessageInput}
          castStatusMessage={castStatusMessage}
          syncPlayGroups={syncPlayGroups}
          activeSyncPlayGroup={activeSyncPlayGroup}
          syncPlayGroupInput={syncPlayGroupInput}
          syncPlayRepeatMode={syncPlayRepeatMode}
          syncPlayShuffleMode={syncPlayShuffleMode}
          syncPlayIgnoreWait={syncPlayIgnoreWait}
          nextEpisode={nextEpisode}
          audioStreams={audioStreams}
          selectedAudioIndex={selectedAudioIndex}
          builtStream={builtStream}
          activePlayMethod={activePlayMethodOverride ?? builtStream?.playMethod}
          selectedSubtitleIndex={selectedSubtitleIndex}
          deletableSubtitleIndices={(mediaSource?.MediaStreams ?? [])
            .filter((s) => s.Type === 'Subtitle' && s.IsExternal)
            .map((s) => s.Index)}
          remoteSubLang={remoteSubLang}
          remoteSubResults={remoteSubResults}
          remoteSubSearching={remoteSubSearching}
          seekBarRef={seekBarRef}
          menusContainerRef={menusContainerRef}
          seekPreview={seekPreview}
          trickplayFrame={trickplayFrame}
          failedTiles={failedTiles}
          onClosePlayer={handleClosePlayer}
          onTogglePlayPause={togglePlayPause}
          onSeekBy={seekBy}
          onSeekTo={(next) => {
            if (videoRef.current) videoRef.current.currentTime = next;
            setCurrentTime(next);
            if (duration > 0) {
              setSeekPreview({ time: next, percent: (next / duration) * 100 });
              if (seekPreviewTimerRef.current) {
                window.clearTimeout(seekPreviewTimerRef.current);
              }
              seekPreviewTimerRef.current = window.setTimeout(() => {
                setSeekPreview(null);
                seekPreviewTimerRef.current = null;
              }, 900);
            }
          }}
          onUpdateSeekPreviewFromClientX={updateSeekPreviewFromClientX}
          onClearSeekPreview={() => {
            if (seekPreviewTimerRef.current) {
              window.clearTimeout(seekPreviewTimerRef.current);
              seekPreviewTimerRef.current = null;
            }
            setSeekPreview(null);
          }}
          onTileError={(url) => setFailedTiles((prev) => ({ ...prev, [url]: true }))}
          onBumpControls={bumpControls}
          onToggleMute={() => {
            if (!videoRef.current) return;
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
          }}
          onVolumeChange={(v) => {
            if (videoRef.current) {
              videoRef.current.volume = v;
              videoRef.current.muted = v === 0;
            }
            setVolume(v);
            setIsMuted(v === 0);
          }}
          onPlayNextEpisode={handlePlayNextEpisode}
          onToggleMenu={(menu) => setOpenMenu((m) => (m === menu ? null : menu))}
          onSelectChapter={handleSelectChapter}
          onSelectMediaSource={handleSelectMediaSource}
          onCastToSession={handleCastToSession}
          onRemotePlaystate={handleRemotePlaystate}
          onCastMessageInputChange={setCastMessageInput}
          onSendCastMessage={handleSendCastMessage}
          onSyncPlayGroupInputChange={setSyncPlayGroupInput}
          onCreateSyncPlayGroup={handleCreateSyncPlayGroup}
          onJoinSyncPlayGroup={handleJoinSyncPlayGroup}
          onLeaveSyncPlayGroup={handleLeaveSyncPlayGroup}
          onSyncPlayRepeatChange={handleSyncPlayRepeatChange}
          onSyncPlayShuffleToggle={handleSyncPlayShuffleToggle}
          onSyncPlayIgnoreWaitToggle={handleSyncPlayIgnoreWaitToggle}
          onSyncPlayQueueStep={handleSyncPlayQueueStep}
          onSelectAudio={handleSwitchAudio}
          onSelectSubtitle={handleSelectSubtitle}
          onRemoteSubLangChange={setRemoteSubLang}
          onSearchRemoteSubtitles={() => void handleSearchRemoteSubtitles()}
          onDownloadRemoteSubtitle={(subId) => void handleDownloadRemoteSubtitle(subId)}
          onUploadSubtitleFile={(file) => void handleUploadSubtitleFile(file)}
          onDeleteSubtitle={(idx) => void handleDeleteSubtitle(idx)}
          onSelectQuality={(q) => void handleSelectQuality(q)}
          onSelectPlaybackRate={(rate) => {
            setPlaybackRate(rate);
            if (videoRef.current) videoRef.current.playbackRate = rate;
            setOpenMenu(null);
          }}
          onTogglePiP={togglePictureInPicture}
          onToggleFullscreen={toggleFullscreen}
        />
      )}
    </div>
  );
};

export default VideoPlayerModal;
