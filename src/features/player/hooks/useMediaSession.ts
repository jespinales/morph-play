import { useEffect, useRef } from 'react';
import { getItemImageUrl } from '../../../shared/api/playback';
import { BaseItemDto } from '../../../shared/types/jellyfin';

interface UseMediaSessionParams {
  serverUrl: string;
  activeItem: BaseItemDto;
  titleDisplay: string;
  subtitleDisplay: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  hasNextEpisode: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onSeekTo: (seconds: number) => void;
  onNextTrack: () => void;
  onStop: () => void;
}

/**
 * Syncs playback metadata, position state, and OS/hardware media keys via the Media Session API.
 */
export function useMediaSession({
  serverUrl,
  activeItem,
  titleDisplay,
  subtitleDisplay,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  hasNextEpisode,
  onPlay,
  onPause,
  onSeekBy,
  onSeekTo,
  onNextTrack,
  onStop,
}: UseMediaSessionParams): void {
  const callbacksRef = useRef({
    onPlay,
    onPause,
    onSeekBy,
    onSeekTo,
    onNextTrack,
    onStop,
  });
  callbacksRef.current = {
    onPlay,
    onPause,
    onSeekBy,
    onSeekTo,
    onNextTrack,
    onStop,
  };

  const lastSyncedSecondRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const artwork: MediaImage[] = [];
    const primaryUrl = getItemImageUrl(serverUrl, activeItem, 'Primary', 512);
    if (primaryUrl) {
      artwork.push({ src: primaryUrl, sizes: '512x512', type: 'image/jpeg' });
    }
    const backdropUrl = getItemImageUrl(serverUrl, activeItem, 'Backdrop', 800);
    if (backdropUrl && backdropUrl !== primaryUrl) {
      artwork.push({ src: backdropUrl, sizes: '800x450', type: 'image/jpeg' });
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: titleDisplay,
        artist: subtitleDisplay || (activeItem.ProductionYear ? String(activeItem.ProductionYear) : 'MorphPlay'),
        album: activeItem.SeriesName || 'MorphPlay',
        artwork,
      });
    } catch {
      // Ignore browsers that reject MediaMetadata construction
    }
  }, [serverUrl, activeItem, titleDisplay, subtitleDisplay]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (typeof navigator.mediaSession.setPositionState !== 'function') return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const clampedPos = Math.max(0, Math.min(duration, currentTime));
    const roundedBucket = Math.floor(clampedPos / 5);
    if (roundedBucket === lastSyncedSecondRef.current && isPlaying) return;
    lastSyncedSecondRef.current = roundedBucket;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: playbackRate > 0 ? playbackRate : 1,
        position: clampedPos,
      });
    } catch {
      // Ignore out-of-range position state updates during stream transitions
    }
  }, [currentTime, duration, playbackRate, isPlaying]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    const register = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        // Ignore unsupported actions in older browsers
      }
    };

    register('play', () => callbacksRef.current.onPlay());
    register('pause', () => callbacksRef.current.onPause());
    register('seekbackward', (details) => {
      callbacksRef.current.onSeekBy(-(details.seekOffset ?? 10));
    });
    register('seekforward', (details) => {
      callbacksRef.current.onSeekBy(details.seekOffset ?? 10);
    });
    register('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        callbacksRef.current.onSeekTo(details.seekTime);
      }
    });
    register('previoustrack', () => callbacksRef.current.onSeekTo(0));
    register('nexttrack', hasNextEpisode ? () => callbacksRef.current.onNextTrack() : null);
    register('stop', () => callbacksRef.current.onStop());

    return () => {
      const actions: MediaSessionAction[] = [
        'play',
        'pause',
        'seekbackward',
        'seekforward',
        'seekto',
        'previoustrack',
        'nexttrack',
        'stop',
      ];
      actions.forEach((action) => register(action, null));
      try {
        ms.playbackState = 'none';
        ms.metadata = null;
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [hasNextEpisode]);
}
