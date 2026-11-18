import { useEffect, useState } from 'react';
import { BuiltPlaybackStream } from '../../../shared/api/playback';
import { parseCueLines } from '../../../shared/utils/subtitles';

export function useSubtitles(
  videoRef: React.RefObject<HTMLVideoElement>,
  builtStream: BuiltPlaybackStream | null,
  selectedSubtitleIndex: number
): string[] {
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);

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
    const timer = window.setTimeout(syncTracks, 250);
    video.textTracks.addEventListener('addtrack', syncTracks);

    return () => {
      window.clearTimeout(timer);
      video.textTracks.removeEventListener('addtrack', syncTracks);
      attachedTracks.forEach((track) => {
        track.removeEventListener('cuechange', readActiveCues);
      });
      setSubtitleLines([]);
    };
  }, [videoRef, selectedSubtitleIndex, builtStream]);

  return subtitleLines;
}
