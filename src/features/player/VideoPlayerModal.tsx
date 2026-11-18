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
} from '../../shared/api/playback';
import { BaseItemDto, MediaSegmentDto, MediaSourceInfo, MediaStream } from '../../shared/types/jellyfin';
import { secondsToTicks, ticksToSeconds } from '../../shared/utils/time';
import { getTrickplayFrame, selectTrickplayInfo, TrickplaySelection } from '../../shared/utils/trickplay';
import { NextEpisodeCard } from './components/NextEpisodeCard';
import { PlayerControls } from './components/PlayerControls';
import { PlayerEndScreen } from './components/PlayerEndScreen';
import { PlayerMenuKind } from './components/TrackMenus';
import { useEpisodeQueue } from './hooks/useEpisodeQueue';
import { usePlayerKeyboard } from './hooks/usePlayerKeyboard';
import { useSubtitles } from './hooks/useSubtitles';

interface VideoPlayerModalProps {
  item: BaseItemDto;
  episodeQueue?: BaseItemDto[];
  onClose: () => void;
  onProgressUpdated?: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  item,
  episodeQueue,
  onClose,
  onProgressUpdated,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const { preferences, t } = usePreferences();
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

  const [mediaSource, setMediaSource] = useState<MediaSourceInfo | null>(null);
  const [playSessionId, setPlaySessionId] = useState<string | undefined>(undefined);
  const [builtStream, setBuiltStream] = useState<BuiltPlaybackStream | null>(null);
  const [segments, setSegments] = useState<MediaSegmentDto[]>([]);
  const [audioStreams, setAudioStreams] = useState<MediaStream[]>([]);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState<number | undefined>(undefined);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number | -1>(-1);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [bufferedPercent, setBufferedPercent] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [openMenu, setOpenMenu] = useState<PlayerMenuKind>(null);
  const [autoSkippedId, setAutoSkippedId] = useState<string | null>(null);
  const [trickplay, setTrickplay] = useState<TrickplaySelection | null>(null);
  const [seekPreview, setSeekPreview] = useState<{ time: number; percent: number } | null>(null);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});
  const [seekFeedback, setSeekFeedback] = useState<{ delta: number; key: number } | null>(null);

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

  const subtitleLines = useSubtitles(videoRef, builtStream, selectedSubtitleIndex);

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
      if (!openMenu) {
        setShowControls(false);
      }
    }, 3200);
  }, [openMenu]);

  // Load PlaybackInfo + MediaSegments whenever activeItem changes
  useEffect(() => {
    let active = true;
    if (!serverUrl || !accessToken || !user || activeItem.Type === 'Series') return;

    async function loadPlayback() {
      setLoadingStream(true);
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
        const similarTargetId = activeItem.SeriesId || activeItem.Id;
        const [playbackInfo, itemSegments, itemDetail, related] = await Promise.all([
          jellyfinApi.getPlaybackInfo(serverUrl, accessToken!, user!.Id, activeItem.Id, {
            maxStreamingBitrate: qualityToBitrate(preferences.quality),
            startTimeTicks: activeItem.UserData?.PlaybackPositionTicks ?? 0,
          }),
          jellyfinApi.getMediaSegments(serverUrl, accessToken!, activeItem.Id),
          jellyfinApi.getItemDetail(serverUrl, accessToken!, user!.Id, activeItem.Id).catch(() => null),
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

        const stream = buildPlaybackStream(
          serverUrl,
          accessToken!,
          activeItem.Id,
          source,
          playbackInfo.PlaySessionId,
          preferredAudio?.Index,
          preferences.quality
        );

        setMediaSource(source);
        setPlaySessionId(playbackInfo.PlaySessionId);
        setAudioStreams(audios);
        setSelectedAudioIndex(preferredAudio?.Index);
        setSelectedSubtitleIndex(preferredSub?.Index ?? -1);
        setSegments(itemSegments);
        setSimilarItems(related);
        setTrickplay(selectTrickplayInfo(itemDetail ?? activeItem, source.Id));
        setBuiltStream(stream);
        setDuration(ticksToSeconds(source.RunTimeTicks ?? activeItem.RunTimeTicks));
        setLoadingStream(false);

        jellyfinApi.reportPlaybackStart(serverUrl, accessToken!, {
          ItemId: activeItem.Id,
          MediaSourceId: source.Id,
          PlaySessionId: playbackInfo.PlaySessionId,
          PositionTicks: activeItem.UserData?.PlaybackPositionTicks ?? 0,
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
  }, [activeItem, serverUrl, accessToken, user, preferences.quality, preferences.preferredAudioLang, preferences.preferredSubtitleLang]);

  // Attach HLS or direct stream to the <video> element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !builtStream) return;

    lastTimeUpdateRef.current = -1;
    setIsBuffering(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const startSeconds = ticksToSeconds(activeItem.UserData?.PlaybackPositionTicks);
    let appliedResume = false;

    const applyStartOffset = () => {
      if (appliedResume) return;
      appliedResume = true;
      if (startSeconds > 5 && Number.isFinite(video.duration) && startSeconds < video.duration - 10) {
        video.currentTime = startSeconds;
      }
      video.play().catch(() => {
        // Browser may require explicit user interaction if playback wasn't triggered by a direct gesture
      });
    };

    if (builtStream.isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 120,
      });
      hlsRef.current = hls;
      hls.loadSource(builtStream.streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, applyStartOffset);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (builtStream.fallbackUrl && video.src !== builtStream.fallbackUrl) {
            hls.destroy();
            hlsRef.current = null;
            video.src = builtStream.fallbackUrl;
            video.addEventListener('loadedmetadata', applyStartOffset, { once: true });
          } else {
            setStreamError(tRef.current.player.hlsLoadError);
          }
        }
      });
    } else {
      video.src = builtStream.streamUrl;
      video.addEventListener('loadedmetadata', applyStartOffset, { once: true });
    }

    return () => {
      pendingSeekTargetRef.current = null;
      if (seekFeedbackTimerRef.current) {
        window.clearTimeout(seekFeedbackTimerRef.current);
        seekFeedbackTimerRef.current = null;
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

  // Report playback progress every 10s
  useEffect(() => {
    if (!serverUrl || !accessToken || !mediaSource || !builtStream) return;

    progressTimer.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused) return;
      const ticks = secondsToTicks(video.currentTime);
      lastReportedTicksRef.current = ticks;
      jellyfinApi.reportPlaybackProgress(serverUrl, accessToken, {
        ItemId: activeItem.Id,
        MediaSourceId: mediaSource.Id,
        PlaySessionId: playSessionId,
        PositionTicks: ticks,
        IsPaused: false,
        IsMuted: video.muted,
        VolumeLevel: Math.round(video.volume * 100),
        AudioStreamIndex: selectedAudioIndex,
        SubtitleStreamIndex: selectedSubtitleIndex === -1 ? undefined : selectedSubtitleIndex,
        PlayMethod: builtStream.playMethod,
      });
    }, 10000);

    return () => {
      if (progressTimer.current) {
        window.clearInterval(progressTimer.current);
      }
    };
  }, [
    serverUrl,
    accessToken,
    mediaSource,
    builtStream,
    activeItem.Id,
    playSessionId,
    selectedAudioIndex,
    selectedSubtitleIndex,
  ]);

  const handleClosePlayer = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    const video = videoRef.current;
    const finalTicks = video ? secondsToTicks(video.currentTime) : lastReportedTicksRef.current;

    if (video) video.pause();
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    onClose();

    if (serverUrl && accessToken && mediaSource) {
      void jellyfinApi
        .reportPlaybackStopped(serverUrl, accessToken, {
          ItemId: activeItem.Id,
          MediaSourceId: mediaSource.Id,
          PlaySessionId: playSessionId,
          PositionTicks: finalTicks,
        })
        .catch(() => {})
        .finally(() => {
          onProgressUpdated?.();
        });
    } else {
      onProgressUpdated?.();
    }
  }, [serverUrl, accessToken, mediaSource, activeItem.Id, playSessionId, onProgressUpdated, onClose]);

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
    document.addEventListener('fullscreenchange', onFsChange);
    video?.addEventListener('webkitbeginfullscreen', onWebkitBegin);
    video?.addEventListener('webkitendfullscreen', onWebkitEnd);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      video?.removeEventListener('webkitbeginfullscreen', onWebkitBegin);
      video?.removeEventListener('webkitendfullscreen', onWebkitEnd);
    };
  }, []);

  // Lock document scroll while fullscreen player is open
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, []);

  usePlayerKeyboard({
    videoRef,
    hasOpenMenu: Boolean(openMenu),
    onCloseMenu: () => setOpenMenu(null),
    onClosePlayer: handleClosePlayer,
    onTogglePlayPause: togglePlayPause,
    onSeekBy: seekBy,
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

  const handleSwitchAudio = (audioIdx: number) => {
    if (!serverUrl || !accessToken || !mediaSource) return;
    const savedTime = videoRef.current?.currentTime ?? 0;
    setSelectedAudioIndex(audioIdx);
    setOpenMenu(null);
    const updatedStream = buildPlaybackStream(
      serverUrl,
      accessToken,
      activeItem.Id,
      mediaSource,
      playSessionId,
      audioIdx,
      preferences.quality
    );
    setBuiltStream(updatedStream);
    // Restore timestamp after reloading audio source
    window.setTimeout(() => {
      if (videoRef.current && savedTime > 0) {
        videoRef.current.currentTime = savedTime;
      }
    }, 350);
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
        showControls ? 'cursor-default' : 'cursor-none'
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
        onPlay={() => setIsPlaying(true)}
        onPlaying={() => {
          setIsPlaying(true);
          clearBuffering();
        }}
        onPause={() => {
          setIsPlaying(false);
          clearBuffering();
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
          .filter((track) => track.index === selectedSubtitleIndex)
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
      {subtitleLines.length > 0 && selectedSubtitleIndex !== -1 && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-1 px-4 sm:px-10 transition-all duration-200 ${
            showControls ? 'bottom-24 sm:bottom-28' : 'bottom-10 sm:bottom-14'
          }`}
        >
          <div className="max-w-4xl rounded-lg bg-black/75 px-3.5 py-1 text-center shadow-lg">
            {subtitleLines.map((line, idx) => (
              <p
                key={`${idx}-${line}`}
                className="text-base sm:text-xl md:text-2xl lg:text-[28px] font-semibold leading-snug text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.95)]"
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
      {(loadingStream || isBuffering) && !streamError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
          <Loader2 className="w-12 h-12 text-[#00A4DC] animate-spin" />
          {loadingStream && (
            <p className="text-sm text-zinc-300 font-medium">{t.player.preparing}</p>
          )}
        </div>
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

      <PlayerControls
        showControls={showControls}
        loadingStream={loadingStream}
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
        isFullscreen={isFullscreen}
        playbackRate={playbackRate}
        openMenu={openMenu}
        nextEpisode={nextEpisode}
        audioStreams={audioStreams}
        selectedAudioIndex={selectedAudioIndex}
        builtStream={builtStream}
        selectedSubtitleIndex={selectedSubtitleIndex}
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
          }
        }}
        onUpdateSeekPreviewFromClientX={updateSeekPreviewFromClientX}
        onClearSeekPreview={() => setSeekPreview(null)}
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
        onSelectAudio={handleSwitchAudio}
        onSelectSubtitle={(subIdx) => {
          setSelectedSubtitleIndex(subIdx);
          setOpenMenu(null);
        }}
        onSelectPlaybackRate={(rate) => {
          setPlaybackRate(rate);
          if (videoRef.current) videoRef.current.playbackRate = rate;
          setOpenMenu(null);
        }}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
};
