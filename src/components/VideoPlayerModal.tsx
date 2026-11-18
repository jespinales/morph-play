import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  ArrowLeft,
  Captions,
  FastForward,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
  AudioLines,
  X,
} from 'lucide-react';
import {
  BaseItemDto,
  MediaSegmentDto,
  MediaSourceInfo,
  MediaStream,
} from '../types/jellyfin';
import { useAuth } from '../context/AuthContext';
import {
  buildPlaybackStream,
  BuiltPlaybackStream,
  formatPlayerTime,
  getItemImageUrl,
  getTrickplayFrame,
  jellyfinApi,
  qualityToBitrate,
  secondsToTicks,
  selectTrickplayInfo,
  ticksToSeconds,
  TrickplaySelection,
} from '../services/jellyfinApi';

/**
 * Strips basic ASS/VTT tags from a subtitle cue and splits into visible lines.
 */
function parseCueLines(rawText: string): string[] {
  return rawText
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<[^>]+>/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

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
  const { serverUrl, accessToken, user, preferences, t } = useAuth();
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
  const [queue, setQueue] = useState<BaseItemDto[]>(episodeQueue ?? []);
  const [activeItem, setActiveItem] = useState<BaseItemDto>(item);
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
  const [openMenu, setOpenMenu] = useState<'audio' | 'subtitles' | 'speed' | null>(null);
  const [autoSkippedId, setAutoSkippedId] = useState<string | null>(null);
  const [trickplay, setTrickplay] = useState<TrickplaySelection | null>(null);
  const [seekPreview, setSeekPreview] = useState<{ time: number; percent: number } | null>(null);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);
  const [seekFeedback, setSeekFeedback] = useState<{ delta: number; key: number } | null>(null);

  useEffect(() => {
    setRootItem(item);
  }, [item]);

  // Resolve initial episode and full multi-season episode queue
  useEffect(() => {
    let active = true;
    async function resolvePlayableItem() {
      if (!serverUrl || !accessToken || !user) return;
      if (rootItem.Type !== 'Series') {
        setActiveItem(rootItem);
        const initialQueue =
          rootItem.Id === item.Id && episodeQueue?.length ? episodeQueue : [];
        setQueue(initialQueue);

        // If launched from a single episode (e.g. Continue Watching / Next Up) or a single-season queue,
        // load all episodes across the series so continuous playback works across seasons.
        if (rootItem.Type === 'Episode' && rootItem.SeriesId) {
          try {
            const allEps = await jellyfinApi.getEpisodes(
              serverUrl,
              accessToken,
              user.Id,
              rootItem.SeriesId
            );
            if (active && allEps.length > 0) {
              setQueue(allEps);
            }
          } catch {
            // Keep initial queue if background load fails
          }
        }
        return;
      }

      setLoadingStream(true);
      try {
        let eps = await jellyfinApi.getEpisodes(serverUrl, accessToken, user.Id, rootItem.Id);
        if (!active) return;
        if (eps.length === 0) {
          const seasons = await jellyfinApi.getSeasons(serverUrl, accessToken, user.Id, rootItem.Id);
          if (!active || seasons.length === 0) return;
          eps = await jellyfinApi.getEpisodes(
            serverUrl,
            accessToken,
            user.Id,
            rootItem.Id,
            seasons[0].Id
          );
        }
        if (!active || eps.length === 0) return;
        const chosen =
          eps.find((ep) => (ep.UserData?.PlaybackPositionTicks ?? 0) > 0) ??
          eps.find((ep) => !ep.UserData?.Played) ??
          eps[0];
        setQueue(eps);
        setActiveItem(chosen);
      } catch {
        if (active) setStreamError(tRef.current.player.loadEpisodeError);
      }
    }

    resolvePlayableItem();
    return () => {
      active = false;
    };
  }, [rootItem, item.Id, episodeQueue, serverUrl, accessToken, user]);

  // Compute next episode in the series queue
  const nextEpisode = useMemo(() => {
    if (activeItem.Type !== 'Episode' || queue.length === 0) return null;
    const idx = queue.findIndex((ep) => ep.Id === activeItem.Id);
    if (idx === -1 || idx + 1 >= queue.length) return null;
    return queue[idx + 1];
  }, [activeItem, queue]);

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

  // Temporarily reveal controls on pointer or touch activity
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

  // Read subtitle cues in hidden mode for custom cinema-style positioning
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !builtStream || selectedSubtitleIndex === -1) {
      setSubtitleLines([]);
      if (video) {
        const tracks = video.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
      }
      return;
    }

    const readActiveCues = () => {
      const tracks = video.textTracks;
      const lines: string[] = [];
      for (let i = 0; i < tracks.length; i++) {
        const active = tracks[i].activeCues;
        if (!active) continue;
        for (let j = 0; j < active.length; j++) {
          const cue = active[j] as VTTCue;
          if (typeof cue.text === 'string' && cue.text.trim()) {
            lines.push(...parseCueLines(cue.text));
          }
        }
      }
      setSubtitleLines(lines);
    };

    const attachedTracks = new Set<TextTrack>();
    const syncTracks = () => {
      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        track.mode = 'hidden';
        if (!attachedTracks.has(track)) {
          track.addEventListener('cuechange', readActiveCues);
          attachedTracks.add(track);
        }
      }
      readActiveCues();
    };

    syncTracks();
    const t = window.setTimeout(syncTracks, 250);
    video.textTracks.addEventListener('addtrack', syncTracks);

    return () => {
      window.clearTimeout(t);
      video.textTracks.removeEventListener('addtrack', syncTracks);
      attachedTracks.forEach((track) => {
        track.removeEventListener('cuechange', readActiveCues);
      });
      setSubtitleLines([]);
    };
  }, [selectedSubtitleIndex, builtStream]);

  // Report playback progress every 10s and on close
  useEffect(() => {
    if (!serverUrl || !accessToken || !mediaSource || !builtStream) return;

    const sendProgress = (paused: boolean) => {
      const video = videoRef.current;
      if (!video) return;
      const ticks = secondsToTicks(video.currentTime);
      lastReportedTicksRef.current = ticks;
      jellyfinApi.reportPlaybackProgress(serverUrl, accessToken, {
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
    };

    progressTimer.current = window.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        sendProgress(false);
      }
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

    if (video) {
      video.pause();
    }
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
        if (video?.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      });
      return;
    }

    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
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

  // Player keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openMenu) {
          setOpenMenu(null);
        } else {
          handleClosePlayer();
        }
        return;
      }
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          seekBy(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          seekBy(10);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          setIsMuted(false);
          bumpControls();
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          bumpControls();
          break;
        case 'm':
          video.muted = !video.muted;
          setIsMuted(video.muted);
          bumpControls();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMenu, handleClosePlayer, togglePlayPause, seekBy, bumpControls, toggleFullscreen]);

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
  }, [nextEpisode, serverUrl, accessToken, mediaSource, activeItem.Id, playSessionId, duration, onProgressUpdated]);

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

  const handlePlaySimilar = useCallback((target: BaseItemDto) => {
    setHasEnded(false);
    setNextCountdown(null);
    setQueue([]);
    setRootItem(target);
  }, []);

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
    return getTrickplayFrame(serverUrl, accessToken, activeItem.Id, trickplay, seekPreview.time);
  }, [seekPreview, trickplay, serverUrl, accessToken, activeItem.Id]);

  const updateSeekPreviewFromClientX = useCallback(
    (clientX: number) => {
      const el = seekBarRef.current;
      if (!el || duration <= 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setSeekPreview({
        time: ratio * duration,
        percent: ratio * 100,
      });
    },
    [duration]
  );

  const titleDisplay = activeItem.SeriesName
    ? `${activeItem.SeriesName}`
    : activeItem.Name;
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
          if (!e.currentTarget.paused) {
            scheduleBuffering();
          }
        }}
        onLoadedData={(e) => {
          if (!e.currentTarget.paused && e.currentTarget.readyState >= 2) {
            clearBuffering();
          }
        }}
        onSeeking={() => {
          scheduleBuffering();
        }}
        onSeeked={() => {
          pendingSeekTargetRef.current = null;
          clearBuffering();
        }}
        onCanPlay={clearBuffering}
        onCanPlayThrough={clearBuffering}
        onLoadedMetadata={(e) => {
          const vid = e.currentTarget;
          if (Number.isFinite(vid.duration) && vid.duration > 0) {
            setDuration(vid.duration);
          }
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

          if (nextEpisode && preferences.autoPlayNextEpisode) {
            setNextCountdown(5);
          } else {
            setNextCountdown(null);
          }
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

      {/* Pre-end floating card: Next episode */}
      {showNextEpisodePrompt && nextEpisode && !streamError && (() => {
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
                  onClick={() => setDismissedPromptId(activeItem.Id)}
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
                    onClick={() => setDismissedPromptId(activeItem.Id)}
                    aria-label={t.player.hideNextPromptAria}
                    className="w-8 h-8 -mt-1 -mr-1 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePlayNextEpisode}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black font-bold text-xs hover:bg-white/90 active:scale-[0.98] transition-all"
              >
                <SkipForward className="w-4 h-4 fill-black" />
                {t.player.playNow}
              </button>
            </div>
          </div>
        );
      })()}

      {/* End-of-playback overlay when episode or movie finishes */}
      {hasEnded && !streamError && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center p-4 sm:p-8 pb-24 sm:pb-28 overflow-y-auto bg-[#0a0a0e]/92">
          {(() => {
            const bgUrl =
              getItemImageUrl(serverUrl, nextEpisode ?? activeItem, 'Backdrop', 1280) ||
              getItemImageUrl(serverUrl, activeItem, 'Primary', 800);
            return bgUrl ? (
              <img
                src={bgUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover opacity-25 blur-sm scale-105 pointer-events-none"
              />
            ) : null;
          })()}
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
                      onClick={handlePlayNextEpisode}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      {t.player.playNow}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNextCountdown(null)}
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
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    {titleDisplay}
                  </h3>
                  {subtitleDisplay && (
                    <p className="text-sm text-zinc-300">{subtitleDisplay}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {nextEpisode && (
                    <button
                      type="button"
                      onClick={handlePlayNextEpisode}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-bold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
                    >
                      <SkipForward className="w-4 h-4 fill-black" />
                      {t.player.nextShortLabel(
                        nextEpisode.ParentIndexNumber,
                        nextEpisode.IndexNumber
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReplay}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t.player.watchAgain}
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePlayer}
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
                            onClick={() => handlePlaySimilar(sim)}
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
                            <p className="p-2 text-xs font-semibold text-white truncate">
                              {sim.Name}
                            </p>
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
      )}

      {/* Top bar */}
      <div
        className={`absolute top-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 flex items-center justify-between gap-4 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClosePlayer}
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
      </div>

      {/* Center touch quick controls */}
      <div
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center gap-8 sm:gap-14 pointer-events-none transition-opacity duration-300 ${
          showControls && !loadingStream && !streamError && !hasEnded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={() => seekBy(-10)}
          aria-label={t.player.rewind10Aria}
          className="pointer-events-auto p-3.5 rounded-full bg-black/45 hover:bg-black/75 text-white/90 backdrop-blur-sm transition-transform active:scale-90 sm:hidden [@media(hover:none)]:inline-flex"
        >
          <RotateCcw className="w-7 h-7" />
        </button>

        <button
          type="button"
          onClick={togglePlayPause}
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
          onClick={() => seekBy(10)}
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
              bumpControls();
              updateSeekPreviewFromClientX(e.clientX);
            }}
            onPointerMove={(e) => updateSeekPreviewFromClientX(e.clientX)}
            onPointerUp={() => setSeekPreview(null)}
            onPointerCancel={() => setSeekPreview(null)}
            onPointerLeave={() => setSeekPreview(null)}
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
                      onError={() =>
                        setFailedTiles((prev) => ({ ...prev, [trickplayFrame.url]: true }))
                      }
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
              onChange={(e) => {
                const next = Number(e.target.value);
                if (videoRef.current) videoRef.current.currentTime = next;
                setCurrentTime(next);
                if (duration > 0) {
                  setSeekPreview({ time: next, percent: (next / duration) * 100 });
                }
              }}
              onPointerUp={() => setSeekPreview(null)}
              onPointerCancel={() => setSeekPreview(null)}
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
              onClick={togglePlayPause}
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
              onClick={() => seekBy(-10)}
              title={t.player.rewind10Title}
              aria-label={t.player.rewind10Aria}
              className="hidden sm:inline-flex p-2 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-all active:scale-90"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
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
                onClick={() => {
                  if (!videoRef.current) return;
                  videoRef.current.muted = !videoRef.current.muted;
                  setIsMuted(videoRef.current.muted);
                }}
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    videoRef.current.muted = v === 0;
                  }
                  setVolume(v);
                  setIsMuted(v === 0);
                }}
                className="w-20 h-9 accent-[#00A4DC] cursor-pointer"
              />
            </div>
          </div>

          {/* Right controls: Next episode, Audio, Subtitles, Speed, Fullscreen */}
          <div ref={menusContainerRef} className="relative flex items-center gap-1 sm:gap-2">
            {nextEpisode && (
              <button
                type="button"
                onClick={handlePlayNextEpisode}
                title={t.player.nextEpisodeTitle}
                aria-label={t.player.nextEpisodeTitle}
                className="inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[38px] px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden md:inline">{t.player.nextShortBtn}</span>
              </button>
            )}

            {/* Audio track selector */}
            {audioStreams.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu((m) => (m === 'audio' ? null : 'audio'))}
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
                        onClick={() => handleSwitchAudio(audio.Index)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs sm:text-sm transition-colors ${
                          selectedAudioIndex === audio.Index
                            ? 'bg-[#00A4DC]/25 text-[#7dd3fc] font-semibold'
                            : 'text-zinc-200 hover:bg-white/10'
                        }`}
                      >
                        {audio.DisplayTitle || audio.Title || audio.Language || t.player.trackFallback(audio.Index)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitle selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'subtitles' ? null : 'subtitles'))}
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
                    onClick={() => {
                      setSelectedSubtitleIndex(-1);
                      setOpenMenu(null);
                    }}
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
                      onClick={() => {
                        setSelectedSubtitleIndex(track.index);
                        setOpenMenu(null);
                      }}
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
                    <p className="px-3 py-1.5 text-xs text-zinc-500">
                      {t.player.noExternalSubtitles}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Playback speed */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((m) => (m === 'speed' ? null : 'speed'))}
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
                      onClick={() => {
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                        setOpenMenu(null);
                      }}
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

            <button
              type="button"
              onClick={toggleFullscreen}
              title={t.player.fullscreenTitle}
              aria-label={t.player.fullscreenAria}
              className="p-2.5 rounded-lg text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
