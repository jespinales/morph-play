import { useEffect } from 'react';

interface UsePlayerKeyboardParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasOpenMenu: boolean;
  suspendPlaybackShortcuts?: boolean;
  onCloseMenu: () => void;
  onClosePlayer: () => void;
  onTogglePlayPause: () => void;
  onSeekBy: (deltaSeconds: number) => void;
  onTogglePiP?: () => void;
  onToggleFullscreen: () => void;
  onVolumeChange: (volume: number, muted: boolean) => void;
  onMuteToggle: (muted: boolean) => void;
}

export function usePlayerKeyboard({
  videoRef,
  hasOpenMenu,
  suspendPlaybackShortcuts = false,
  onCloseMenu,
  onClosePlayer,
  onTogglePlayPause,
  onSeekBy,
  onTogglePiP,
  onToggleFullscreen,
  onVolumeChange,
  onMuteToggle,
}: UsePlayerKeyboardParams): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasOpenMenu) {
          onCloseMenu();
        } else {
          onClosePlayer();
        }
        return;
      }

      if (suspendPlaybackShortcuts) return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          onTogglePlayPause();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          onSeekBy(-10);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          onSeekBy(10);
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          onVolumeChange(video.volume, false);
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          onVolumeChange(video.volume, video.muted);
          break;
        case 'm':
          video.muted = !video.muted;
          onMuteToggle(video.muted);
          break;
        case 'p':
          onTogglePiP?.();
          break;
        case 'f':
          onToggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    videoRef,
    hasOpenMenu,
    suspendPlaybackShortcuts,
    onCloseMenu,
    onClosePlayer,
    onTogglePlayPause,
    onSeekBy,
    onTogglePiP,
    onToggleFullscreen,
    onVolumeChange,
    onMuteToggle,
  ]);
}
