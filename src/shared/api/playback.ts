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
  return `${normalizeServerUrl(serverUrl)}/Users/${user.Id}/Images/Primary?quality=90&maxWidth=300&tag=${user.PrimaryImageTag}`;
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

export function qualityToBitrate(quality: StreamingQuality): number {
  switch (quality) {
    case '1080p':
      return 20_000_000;
    case '720p':
      return 8_000_000;
    case '480p':
      return 3_000_000;
    case 'auto':
    default:
      return 120_000_000;
  }
}

export interface PlayerSubtitleOption {
  index: number;
  label: string;
  language: string;
  delivery: 'external' | 'encode';
  src?: string;
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
      const canServeTextVtt =
        !IMAGE_SUBTITLE_CODECS.has(codec) &&
        (Boolean(s.SupportsExternalStream) ||
          Boolean(s.IsExternal) ||
          codec === 'subrip' ||
          codec === 'srt' ||
          codec === 'vtt');
      return {
        index: s.Index,
        label: s.DisplayTitle || s.Title || s.Language || `Subtitle ${s.Index}`,
        language: s.Language || 'en',
        delivery: canServeTextVtt ? ('external' as const) : ('encode' as const),
        src: canServeTextVtt
          ? `${base}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/0/Stream.vtt?api_key=${encodeURIComponent(token)}`
          : undefined,
        isDefault: Boolean(s.IsDefault),
      };
    });

  const subtitleTracks = allSubtitles
    .filter((s): s is PlayerSubtitleOption & { src: string } => s.delivery === 'external' && Boolean(s.src))
    .map(({ index, label, language, src, isDefault }) => ({
      index,
      label,
      language,
      src,
      isDefault,
    }));

  const encodedSub =
    subtitleStreamIndex !== undefined && subtitleStreamIndex !== -1
      ? allSubtitles.find((s) => s.index === subtitleStreamIndex && s.delivery === 'encode')
      : undefined;

  const maxBitrate = qualityToBitrate(quality);
  const canDirectPlay =
    !encodedSub &&
    mediaSource.SupportsDirectPlay &&
    quality === 'auto' &&
    ['mp4', 'm4v', 'webm'].includes((mediaSource.Container ?? '').toLowerCase()) &&
    (audioStreamIndex === undefined || audioStreamIndex === mediaSource.DefaultAudioStreamIndex);

  if (canDirectPlay) {
    return {
      streamUrl: `${base}/Videos/${itemId}/stream?Static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&api_key=${encodeURIComponent(token)}`,
      isHls: false,
      playMethod: 'DirectPlay',
      allSubtitles,
      subtitleTracks,
    };
  }

  const hlsParams = new URLSearchParams({
    MediaSourceId: mediaSource.Id,
    api_key: token,
    VideoCodec: 'h264',
    AudioCodec: 'aac,mp3',
    TranscodingMaxAudioChannels: '2',
    SegmentContainer: 'ts',
    MinSegments: '1',
    BreakOnNonKeyFrames: 'True',
    VideoBitrate: String(maxBitrate),
  });
  if (playSessionId) hlsParams.set('PlaySessionId', playSessionId);
  if (audioStreamIndex !== undefined) hlsParams.set('AudioStreamIndex', String(audioStreamIndex));
  if (encodedSub) {
    hlsParams.set('SubtitleStreamIndex', String(encodedSub.index));
    hlsParams.set('SubtitleMethod', 'Encode');
  }

  // Build explicit master.m3u8 URL when burning graphical subtitles so FFmpeg encodes them
  const streamUrl =
    !encodedSub && mediaSource.TranscodingUrl
      ? `${base}${mediaSource.TranscodingUrl}`
      : `${base}/Videos/${itemId}/master.m3u8?${hlsParams.toString()}`;

  return {
    streamUrl,
    fallbackUrl: `${base}/Videos/${itemId}/stream?Static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&api_key=${encodeURIComponent(token)}`,
    isHls: true,
    playMethod: 'Transcode',
    encodedSubtitleIndex: encodedSub?.index,
    allSubtitles,
    subtitleTracks,
  };
}
