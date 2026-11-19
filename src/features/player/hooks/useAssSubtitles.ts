import { useEffect, useState } from 'react';
import type JASSUB from 'jassub';
import { BuiltPlaybackStream, getSubtitleFontAttachments } from '../../../shared/api/playback';
import { MediaSourceInfo } from '../../../shared/types/jellyfin';

interface UseAssSubtitlesParams {
  videoRef: React.RefObject<HTMLVideoElement>;
  serverUrl: string;
  accessToken: string | null;
  itemId: string;
  mediaSource: MediaSourceInfo | null;
  builtStream: BuiltPlaybackStream | null;
  selectedSubtitleIndex: number;
}

/**
 * Renders ASS/SSA subtitles client-side via JASSUB (libass WebAssembly) with bundled font attachments,
 * falling back to WebVTT cues when JASSUB cannot initialize.
 */
export function useAssSubtitles({
  videoRef,
  serverUrl,
  accessToken,
  itemId,
  mediaSource,
  builtStream,
  selectedSubtitleIndex,
}: UseAssSubtitlesParams): { isAssActive: boolean } {
  const [assFailed, setAssFailed] = useState(false);

  const activeAssOption =
    builtStream?.allSubtitles.find(
      (s) => s.index === selectedSubtitleIndex && s.delivery === 'ass' && Boolean(s.src)
    ) ?? null;

  const activeAssSrc = activeAssOption?.src ?? null;

  useEffect(() => {
    setAssFailed(false);
  }, [activeAssSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeAssSrc || !mediaSource || !accessToken || assFailed) {
      return;
    }

    let disposed = false;
    let instance: JASSUB | null = null;
    const fonts = getSubtitleFontAttachments(serverUrl, itemId, mediaSource, accessToken);

    async function mountJassub() {
      try {
        const { default: JassubCtor } = await import('jassub');
        if (disposed || !video) return;

        instance = new JassubCtor({
          video,
          subUrl: activeAssSrc!,
          fonts,
          queryFonts: false,
        });

        await instance.ready;
        if (disposed) {
          await instance.destroy();
          instance = null;
        }
      } catch {
        if (!disposed) {
          setAssFailed(true);
        }
        if (instance) {
          void instance.destroy().catch(() => {});
          instance = null;
        }
      }
    }

    void mountJassub();

    return () => {
      disposed = true;
      if (instance) {
        void instance.destroy().catch(() => {});
        instance = null;
      }
    };
  }, [videoRef, serverUrl, accessToken, itemId, mediaSource, activeAssSrc, assFailed]);

  return { isAssActive: Boolean(activeAssSrc) && !assFailed };
}
