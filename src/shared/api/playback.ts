import { BaseItemDto, MediaSourceInfo, StreamingQuality, UserDto } from '../types/jellyfin';
import { normalizeServerUrl } from '../utils/url';
import { DEMO_HLS_STREAM, DEMO_MP4_FALLBACK, getDemoImageUrl } from './demo/demoData';
import { isDemoServer } from './demo/demoStore';

export function getItemImageUrl(
  serverUrl: string,
  item: Pick<
    BaseItemDto,
    | 'Id'
    | 'Name'
    | 'ImageTags'
    | 'BackdropImageTags'
    | 'ParentBackdropImageTags'
    | 'ParentBackdropItemId'
    | 'ParentLogoImageTag'
    | 'ParentLogoItemId'
    | 'SeriesId'
  >,
  type: 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' = 'Primary',
  maxWidth = 800
): string | null {
  if (isDemoServer(serverUrl)) {
    if (type === 'Logo') return null; // In demo mode we render the typographic title in HeroBanner
    if (type === 'Backdrop' && item.SeriesId && !item.BackdropImageTags?.length) {
      return getDemoImageUrl(item.Id, 'Backdrop', item.Name);
    }
    return getDemoImageUrl(item.Id, type, item.Name);
  }

  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;

  if (type === 'Backdrop') {
    if (item.BackdropImageTags?.length) {
      return `${base}/Items/${item.Id}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=90&tag=${item.BackdropImageTags[0]}`;
    }
    if (item.ParentBackdropItemId && item.ParentBackdropImageTags?.length) {
      return `${base}/Items/${item.ParentBackdropItemId}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=90&tag=${item.ParentBackdropImageTags[0]}`;
    }
    if (item.SeriesId) {
      return `${base}/Items/${item.SeriesId}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=90`;
    }
    if (item.ImageTags?.Thumb) {
      return `${base}/Items/${item.Id}/Images/Thumb?maxWidth=${maxWidth}&quality=90&tag=${item.ImageTags.Thumb}`;
    }
    if (item.ImageTags?.Primary) {
      return `${base}/Items/${item.Id}/Images/Primary?maxWidth=${maxWidth}&quality=90&tag=${item.ImageTags.Primary}`;
    }
    return null;
  }

  if (type === 'Logo') {
    if (item.ImageTags?.Logo) {
      return `${base}/Items/${item.Id}/Images/Logo?maxWidth=${maxWidth}&tag=${item.ImageTags.Logo}`;
    }
    if (item.ParentLogoItemId && item.ParentLogoImageTag) {
      return `${base}/Items/${item.ParentLogoItemId}/Images/Logo?maxWidth=${maxWidth}&tag=${item.ParentLogoImageTag}`;
    }
    return null;
  }

  if (type === 'Thumb') {
    if (item.ImageTags?.Thumb) {
      return `${base}/Items/${item.Id}/Images/Thumb?maxWidth=${maxWidth}&quality=90&tag=${item.ImageTags.Thumb}`;
    }
    return getItemImageUrl(serverUrl, item, 'Backdrop', maxWidth);
  }

  if (item.ImageTags?.Primary) {
    return `${base}/Items/${item.Id}/Images/Primary?maxWidth=${maxWidth}&quality=90&tag=${item.ImageTags.Primary}`;
  }
  if (item.SeriesId) {
    return `${base}/Items/${item.SeriesId}/Images/Primary?maxWidth=${maxWidth}&quality=90`;
  }
  return null;
}

export function getUserAvatarUrl(serverUrl: string, user: UserDto): string | null {
  if (isDemoServer(serverUrl)) {
    return getDemoImageUrl(user.Id, 'User', user.Name);
  }
  if (!user.PrimaryImageTag) return null;
  const query = new URLSearchParams({
    userId: user.Id,
    tag: user.PrimaryImageTag,
  });
  return `${normalizeServerUrl(serverUrl)}/UserImage?${query.toString()}`;
}

export function getPersonImageUrl(
  serverUrl: string,
  personId: string,
  primaryImageTag?: string
): string | null {
  if (isDemoServer(serverUrl)) {
    return getDemoImageUrl(personId, 'User', personId);
  }
  if (!primaryImageTag) return null;
  return `${normalizeServerUrl(serverUrl)}/Items/${personId}/Images/Primary?maxWidth=240&quality=85&tag=${primaryImageTag}`;
}

export function getChapterImageUrl(
  serverUrl: string,
  itemId: string,
  chapterIndex: number,
  imageTag?: string,
  maxWidth = 360
): string | null {
  if (isDemoServer(serverUrl) || !imageTag) return null;
  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;
  return `${base}/Items/${itemId}/Images/Chapter/${chapterIndex}?maxWidth=${maxWidth}&quality=85&tag=${encodeURIComponent(imageTag)}`;
}

export function getItemDownloadUrl(serverUrl: string, itemId: string, token: string): string | null {
  if (isDemoServer(serverUrl) || !token) return null;
  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;
  return `${base}/Items/${encodeURIComponent(itemId)}/Download?ApiKey=${encodeURIComponent(token)}`;
}

export function getThemeAudioUrl(serverUrl: string, itemId: string, token: string): string | null {
  if (isDemoServer(serverUrl) || !token) return null;
  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;
  return `${base}/Audio/${encodeURIComponent(itemId)}/stream?static=true&ApiKey=${encodeURIComponent(token)}`;
}

export function getAttachmentUrl(
  serverUrl: string,
  videoId: string,
  mediaSourceId: string,
  attachmentIndex: number,
  token: string
): string | null {
  if (isDemoServer(serverUrl) || !token) return null;
  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;
  return `${base}/Videos/${encodeURIComponent(videoId)}/${encodeURIComponent(mediaSourceId)}/Attachments/${attachmentIndex}?ApiKey=${encodeURIComponent(token)}`;
}

export function qualityToBitrate(quality: StreamingQuality): number {
  switch (quality) {
    case '1080p':
      return 20_000_000;
    case '720p':
      return 8_000_000;
    case '480p':
      return 3_000_000;
    case '360p':
      return 1_500_000;
    case 'auto':
    default:
      return 120_000_000;
  }
}

export function qualityToMaxHeight(quality: StreamingQuality): number | undefined {
  switch (quality) {
    case '1080p':
      return 1080;
    case '720p':
      return 720;
    case '480p':
      return 480;
    case '360p':
      return 360;
    case 'auto':
    default:
      return undefined;
  }
}

export interface PlayerSubtitleOption {
  index: number;
  label: string;
  language: string;
  delivery: 'external' | 'ass' | 'encode';
  src?: string;
  fallbackVttSrc?: string;
  isDefault: boolean;
}

export interface BuiltPlaybackStream {
  streamUrl: string;
  fallbackUrl?: string;
  isHls: boolean;
  playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
  startSeconds?: number;
  durationSeconds?: number;
  encodedSubtitleIndex?: number;
  allSubtitles: PlayerSubtitleOption[];
  subtitleTracks: Array<{
    index: number;
    label: string;
    language: string;
    src: string;
    isDefault: boolean;
  }>;
}

const IMAGE_SUBTITLE_CODECS = new Set(['pgssub', 'pgs', 'dvdsub', 'dvbsub', 'vobsub', 'xsub']);
const ASS_SUBTITLE_CODECS = new Set(['ass', 'ssa']);
const FONT_MIME_HINTS = ['font', 'truetype', 'opentype', 'sfnt', 'woff'];

/**
 * Resolve URLs for font attachments bundled in a media source so client-side ASS renderers can load them.
 */
export function getSubtitleFontAttachments(
  serverUrl: string,
  itemId: string,
  mediaSource: MediaSourceInfo,
  token: string
): string[] {
  if (isDemoServer(serverUrl) || !token) return [];
  const base = normalizeServerUrl(serverUrl);
  if (!base) return [];

  const urls: string[] = [];
  for (const att of mediaSource.MediaAttachments ?? []) {
    const mime = (att.MimeType ?? '').toLowerCase();
    const file = (att.FileName ?? '').toLowerCase();
    const codec = (att.Codec ?? '').toLowerCase();
    const isFont =
      FONT_MIME_HINTS.some((hint) => mime.includes(hint)) ||
      /\.(ttf|otf|woff2?|ttc)$/i.test(file) ||
      ['ttf', 'otf', 'woff', 'woff2'].includes(codec);
    if (!isFont) continue;

    if (att.DeliveryUrl) {
      const resolved = att.DeliveryUrl.startsWith('/') ? `${base}${att.DeliveryUrl}` : `${base}/${att.DeliveryUrl}`;
      urls.push(
        resolved.includes('ApiKey=') || resolved.includes('api_key=')
          ? resolved
          : `${resolved}${resolved.includes('?') ? '&' : '?'}ApiKey=${encodeURIComponent(token)}`
      );
    } else {
      const url = getAttachmentUrl(serverUrl, itemId, mediaSource.Id, att.Index, token);
      if (url) urls.push(url);
    }
  }
  return urls;
}

export function buildPlaybackStream(
  serverUrl: string,
  token: string,
  itemId: string,
  mediaSource: MediaSourceInfo,
  playSessionId: string | undefined,
  audioStreamIndex: number | undefined,
  quality: StreamingQuality,
  subtitleStreamIndex?: number
): BuiltPlaybackStream {
  if (isDemoServer(serverUrl)) {
    return {
      streamUrl: DEMO_HLS_STREAM,
      fallbackUrl: DEMO_MP4_FALLBACK,
      isHls: true,
      playMethod: 'Transcode',
      allSubtitles: [],
      subtitleTracks: [],
    };
  }

  const base = normalizeServerUrl(serverUrl);
  const allSubtitles: PlayerSubtitleOption[] = (mediaSource.MediaStreams ?? [])
    .filter((s) => s.Type === 'Subtitle')
    .map((s) => {
      const codec = (s.Codec ?? '').toLowerCase();
      const isAss = ASS_SUBTITLE_CODECS.has(codec);
      const canServeExternal =
        !IMAGE_SUBTITLE_CODECS.has(codec) &&
        (Boolean(s.SupportsExternalStream) ||
          Boolean(s.IsExternal) ||
          isAss ||
          codec === 'subrip' ||
          codec === 'srt' ||
          codec === 'vtt');
      if (isAss && canServeExternal) {
        return {
          index: s.Index,
          label: s.DisplayTitle || s.Title || s.Language || `Subtitle ${s.Index}`,
          language: s.Language || 'en',
          delivery: 'ass' as const,
          src: `${base}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/0/Stream.${codec}?ApiKey=${encodeURIComponent(token)}`,
          fallbackVttSrc: `${base}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/0/Stream.vtt?ApiKey=${encodeURIComponent(token)}`,
          isDefault: Boolean(s.IsDefault),
        };
      }
      return {
        index: s.Index,
        label: s.DisplayTitle || s.Title || s.Language || `Subtitle ${s.Index}`,
        language: s.Language || 'en',
        delivery: canServeExternal ? ('external' as const) : ('encode' as const),
        src: canServeExternal
          ? `${base}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/0/Stream.vtt?ApiKey=${encodeURIComponent(token)}`
          : undefined,
        isDefault: Boolean(s.IsDefault),
      };
    });

  const subtitleTracks = allSubtitles
    .filter(
      (s): s is PlayerSubtitleOption & { src: string } =>
        (s.delivery === 'external' || s.delivery === 'ass') && Boolean(s.src)
    )
    .map(({ index, label, language, src, fallbackVttSrc, isDefault }) => ({
      index,
      label,
      language,
      src: fallbackVttSrc ?? src,
      isDefault,
    }));

  const encodedSub =
    subtitleStreamIndex !== undefined && subtitleStreamIndex !== -1
      ? allSubtitles.find((s) => s.index === subtitleStreamIndex && s.delivery === 'encode')
      : undefined;

  const maxBitrate = qualityToBitrate(quality);
  const maxHeight = qualityToMaxHeight(quality);
  const videoStream = (mediaSource.MediaStreams ?? []).find((s) => s.Type === 'Video');
  const withinMaxHeight = !maxHeight || !videoStream?.Height || videoStream.Height <= maxHeight;
  const withinMaxBitrate = Boolean(mediaSource.Bitrate) && mediaSource.Bitrate! <= maxBitrate;
  const canDirectPlay =
    !encodedSub &&
    mediaSource.SupportsDirectPlay &&
    (quality === 'auto' || (withinMaxHeight && withinMaxBitrate)) &&
    ['mp4', 'm4v', 'webm'].includes((mediaSource.Container ?? '').toLowerCase()) &&
    (audioStreamIndex === undefined || audioStreamIndex === mediaSource.DefaultAudioStreamIndex);

  if (canDirectPlay) {
    return {
      streamUrl: `${base}/Videos/${itemId}/stream?static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&ApiKey=${encodeURIComponent(token)}`,
      isHls: false,
      playMethod: 'DirectPlay',
      allSubtitles,
      subtitleTracks,
    };
  }

  const normalizedTranscodingUrl = mediaSource.TranscodingUrl
    ? mediaSource.TranscodingUrl.startsWith('/')
      ? `${base}${mediaSource.TranscodingUrl}`
      : `${base}/${mediaSource.TranscodingUrl}`
    : undefined;

  const transcodingMatchesEncodedSub =
    encodedSub !== undefined &&
    Boolean(normalizedTranscodingUrl) &&
    normalizedTranscodingUrl!.includes('SubtitleMethod=Encode') &&
    normalizedTranscodingUrl!.includes(`SubtitleStreamIndex=${encodedSub.index}`);

  const hlsParams = new URLSearchParams({
    MediaSourceId: mediaSource.Id,
    ApiKey: token,
    VideoCodec: 'h264',
    AudioCodec: 'aac,mp3',
    TranscodingMaxAudioChannels: '2',
    SegmentContainer: 'ts',
    MinSegments: '1',
    VideoBitrate: String(maxBitrate),
  });
  if (playSessionId) hlsParams.set('PlaySessionId', playSessionId);
  if (audioStreamIndex !== undefined) hlsParams.set('AudioStreamIndex', String(audioStreamIndex));
  if (maxHeight) hlsParams.set('MaxHeight', String(maxHeight));
  if (encodedSub) {
    hlsParams.set('SubtitleStreamIndex', String(encodedSub.index));
    hlsParams.set('SubtitleMethod', 'Encode');
  }

  // Prefer server-negotiated TranscodingUrl from PlaybackInfo when available
  const streamUrl =
    normalizedTranscodingUrl && (!encodedSub || transcodingMatchesEncodedSub)
      ? normalizedTranscodingUrl
      : `${base}/Videos/${itemId}/master.m3u8?${hlsParams.toString()}`;

  return {
    streamUrl,
    fallbackUrl: `${base}/Videos/${itemId}/stream?static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&ApiKey=${encodeURIComponent(token)}`,
    isHls: true,
    playMethod: 'Transcode',
    encodedSubtitleIndex: encodedSub?.index,
    allSubtitles,
    subtitleTracks,
  };
}
