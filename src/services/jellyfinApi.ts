import {
  AuthenticationResult,
  BaseItemDto,
  BrandConfig,
  DEFAULT_BRAND_CONFIG,
  ItemsResult,
  MediaSegmentDto,
  MediaSegmentQueryResult,
  MediaSourceInfo,
  PlaybackInfoResponse,
  PublicSystemInfo,
  StreamingQuality,
  TrickplayInfoDto,
  UserDto,
} from '../types/jellyfin';
import {
  buildDemoPlaybackInfo,
  DEMO_ACCESS_TOKEN,
  DEMO_EPISODES,
  DEMO_HLS_STREAM,
  DEMO_ITEMS,
  DEMO_MP4_FALLBACK,
  DEMO_SEASONS,
  DEMO_SEGMENTS,
  DEMO_SERVER_URL,
  DEMO_SYSTEM_INFO,
  DEMO_USERS,
  getDemoImageUrl,
} from './demoData';

const DEVICE_ID_KEY = 'jellyfin_device_id';
const CLIENT_NAME = 'MorphPlay';
const CLIENT_VERSION = '1.0.0';

// In-memory state for interactive mutations in Demo Mode
const demoFavoriteOverrides = new Map<string, boolean>();
const demoPlayedOverrides = new Map<string, boolean>();
const demoProgressOverrides = new Map<string, number>();
const demoRemovedNextUp = new Set<string>();

export function isDemoServer(serverUrl: string | null | undefined): boolean {
  return serverUrl === DEMO_SERVER_URL;
}

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `jf-web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function normalizeServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed === DEMO_SERVER_URL) return DEMO_SERVER_URL;
  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `http://${withProtocol}`;
  }
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Reads the Jellyfin server URL configured via runtime environment (Docker / Vite).
 * Returns an empty string when not preconfigured.
 */
export function getEnvConfiguredServerUrl(): string {
  const runtimeUrl = window.__ENV__?.JELLYFIN_SERVER_URL?.trim();
  if (runtimeUrl && !runtimeUrl.includes('__JELLYFIN_SERVER_URL__')) {
    return normalizeServerUrl(runtimeUrl);
  }
  const viteUrl = (import.meta.env.VITE_JELLYFIN_SERVER_URL as string | undefined)?.trim();
  if (viteUrl) {
    return normalizeServerUrl(viteUrl);
  }
  return '';
}

export function isSafeLogoUrl(rawUrl: string | undefined | null): boolean {
  const url = rawUrl?.trim() ?? '';
  if (!url) return false;
  if (/^\/(?!\/)/.test(url)) return true;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);/i.test(url)) {
    return true;
  }
  return false;
}

/**
 * Reads the brand name and logo URL configured via runtime environment (Docker / Vite).
 */
export function getEnvConfiguredBrand(): BrandConfig {
  const runtimeName = window.__ENV__?.APP_NAME?.trim();
  const viteName = (import.meta.env.VITE_APP_NAME as string | undefined)?.trim();
  const appName =
    (runtimeName && !runtimeName.includes('__APP_NAME__') ? runtimeName : '') ||
    viteName ||
    DEFAULT_BRAND_CONFIG.appName;

  const runtimeLogo = window.__ENV__?.APP_LOGO_URL?.trim();
  const viteLogo = (import.meta.env.VITE_APP_LOGO_URL as string | undefined)?.trim();
  const rawLogo =
    (runtimeLogo && !runtimeLogo.includes('__APP_LOGO_URL__') ? runtimeLogo : '') ||
    viteLogo ||
    DEFAULT_BRAND_CONFIG.logoUrl;

  return {
    appName,
    logoUrl: isSafeLogoUrl(rawLogo) ? rawLogo : '',
  };
}

export function buildAuthHeader(token?: string | null): string {
  const deviceId = getOrCreateDeviceId();
  const base = `MediaBrowser Client="${CLIENT_NAME}", Device="Web Browser", DeviceId="${deviceId}", Version="${CLIENT_VERSION}"`;
  return token ? `${base}, Token="${token}"` : base;
}

async function apiRequest<T>(
  serverUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', token, body, signal, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const combinedSignal = signal;
  if (combinedSignal) {
    combinedSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const headers: Record<string, string> = {
      Authorization: buildAuthHeader(token),
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `HTTP error ${response.status}`;
      try {
        const text = await response.text();
        if (text) detail = text;
      } catch {
        // Ignore errors while reading error response body
      }
      throw new Error(detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function applyDemoOverrides(item: BaseItemDto): BaseItemDto {
  const fav = demoFavoriteOverrides.get(item.Id);
  const played = demoPlayedOverrides.get(item.Id);
  const pos = demoProgressOverrides.get(item.Id);
  if (fav === undefined && played === undefined && pos === undefined) {
    return item;
  }
  const duration = item.RunTimeTicks ?? 0;
  const newTicks = pos !== undefined ? pos : item.UserData?.PlaybackPositionTicks ?? 0;
  const percentage =
    duration > 0 && newTicks > 0 ? Math.min(100, Math.round((newTicks / duration) * 100)) : item.UserData?.PlayedPercentage;

  return {
    ...item,
    UserData: {
      ...item.UserData,
      IsFavorite: fav ?? item.UserData?.IsFavorite ?? false,
      Played: played ?? item.UserData?.Played ?? false,
      PlaybackPositionTicks: newTicks,
      PlayedPercentage: percentage,
    },
  };
}

export const jellyfinApi = {
  async getPublicSystemInfo(serverUrl: string): Promise<PublicSystemInfo> {
    if (isDemoServer(serverUrl)) return DEMO_SYSTEM_INFO;
    return apiRequest<PublicSystemInfo>(serverUrl, '/System/Info/Public', { timeoutMs: 8000 });
  },

  async getPublicUsers(serverUrl: string): Promise<UserDto[]> {
    if (isDemoServer(serverUrl)) return DEMO_USERS;
    return apiRequest<UserDto[]>(serverUrl, '/Users/Public');
  },

  async authenticateByName(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<AuthenticationResult> {
    if (isDemoServer(serverUrl)) {
      const matched =
        DEMO_USERS.find((u) => u.Name.toLowerCase() === username.toLowerCase()) ?? DEMO_USERS[0];
      return {
        User: matched,
        AccessToken: DEMO_ACCESS_TOKEN,
        ServerId: DEMO_SYSTEM_INFO.Id,
      };
    }

    return apiRequest<AuthenticationResult>(serverUrl, '/Users/AuthenticateByName', {
      method: 'POST',
      body: {
        Username: username,
        Pw: password,
      },
    });
  },

  async getUserById(serverUrl: string, token: string, userId: string): Promise<UserDto> {
    if (isDemoServer(serverUrl)) {
      return DEMO_USERS.find((u) => u.Id === userId) ?? DEMO_USERS[0];
    }
    return apiRequest<UserDto>(serverUrl, `/Users/${userId}`, { token });
  },

  async getUserViews(serverUrl: string, token: string, userId: string): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return [
        { Id: 'view-movies', Name: 'Movies', Type: 'CollectionFolder', CollectionType: 'movies' },
        { Id: 'view-series', Name: 'Series', Type: 'CollectionFolder', CollectionType: 'tvshows' },
        { Id: 'view-boxsets', Name: 'Collections', Type: 'CollectionFolder', CollectionType: 'boxsets' },
      ];
    }
    const res = await apiRequest<ItemsResult>(serverUrl, `/Users/${userId}/Views`, { token });
    return res.Items ?? [];
  },

  async getResumeItems(serverUrl: string, token: string, userId: string): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return [DEMO_EPISODES[0]]
        .map(applyDemoOverrides)
        .filter((item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0);
    }
    const query = new URLSearchParams({
      Limit: '16',
      Recursive: 'true',
      Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,MediaSources,Overview,Genres,DateCreated',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb,Logo',
      MediaTypes: 'Video',
    });
    const res = await apiRequest<ItemsResult>(
      serverUrl,
      `/Users/${userId}/Items/Resume?${query.toString()}`,
      { token }
    );
    return res.Items ?? [];
  },

  async getNextUpItems(serverUrl: string, token: string, userId: string): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return [DEMO_EPISODES[1]]
        .filter((item) => !demoRemovedNextUp.has(item.Id))
        .map(applyDemoOverrides);
    }
    const query = new URLSearchParams({
      UserId: userId,
      Limit: '16',
      Fields: 'PrimaryImageAspectRatio,Overview,MediaSources,Genres',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb,Logo',
    });
    const res = await apiRequest<ItemsResult>(serverUrl, `/Shows/NextUp?${query.toString()}`, {
      token,
    });
    return res.Items ?? [];
  },

  async getLatestItems(
    serverUrl: string,
    token: string,
    userId: string,
    includeItemTypes: 'Movie' | 'Series' | undefined,
    limit = 16
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return DEMO_ITEMS.filter((item) =>
        includeItemTypes ? item.Type === includeItemTypes : item.Type === 'Movie' || item.Type === 'Series'
      )
        .slice(0, limit)
        .map(applyDemoOverrides);
    }
    const query = new URLSearchParams({
      Limit: String(limit),
      Fields:
        'PrimaryImageAspectRatio,Overview,Genres,CommunityRating,OfficialRating,ProductionYear,DateCreated',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb,Logo',
    });
    if (includeItemTypes) {
      query.set('IncludeItemTypes', includeItemTypes);
    }
    return apiRequest<BaseItemDto[]>(serverUrl, `/Users/${userId}/Items/Latest?${query.toString()}`, {
      token,
    });
  },

  async getItems(
    serverUrl: string,
    token: string,
    userId: string,
    params: {
      includeItemTypes?: string;
      sortBy?: string;
      sortOrder?: 'Ascending' | 'Descending';
      filters?: string;
      genres?: string;
      searchTerm?: string;
      limit?: number;
      startIndex?: number;
      parentId?: string;
    } = {}
  ): Promise<ItemsResult> {
    if (isDemoServer(serverUrl)) {
      let pool = [...DEMO_ITEMS, ...DEMO_EPISODES];
      if (params.includeItemTypes) {
        const types = params.includeItemTypes.split(',');
        pool = pool.filter((item) => types.includes(item.Type));
      } else {
        pool = pool.filter((item) => item.Type === 'Movie' || item.Type === 'Series');
      }

      pool = pool.map(applyDemoOverrides);

      if (params.filters?.includes('IsFavorite')) {
        pool = pool.filter((item) => item.UserData?.IsFavorite);
      }

      if (params.genres) {
        const g = params.genres.toLowerCase();
        pool = pool.filter((item) => item.Genres?.some((x) => x.toLowerCase() === g));
      }

      if (params.searchTerm) {
        const q = params.searchTerm.toLowerCase();
        pool = pool.filter(
          (item) =>
            item.Name.toLowerCase().includes(q) ||
            item.Overview?.toLowerCase().includes(q) ||
            item.Genres?.some((g) => g.toLowerCase().includes(q))
        );
      }

      if (params.sortBy === 'CommunityRating') {
        pool.sort((a, b) => (b.CommunityRating ?? 0) - (a.CommunityRating ?? 0));
      } else if (params.sortBy === 'ProductionYear') {
        pool.sort((a, b) => (b.ProductionYear ?? 0) - (a.ProductionYear ?? 0));
      } else if (params.sortBy === 'SortName') {
        pool.sort((a, b) => a.Name.localeCompare(b.Name, 'es'));
      }

      const start = params.startIndex ?? 0;
      const limit = params.limit ?? 50;
      const sliced = pool.slice(start, start + limit);
      return {
        Items: sliced,
        TotalRecordCount: pool.length,
        StartIndex: start,
      };
    }

    const query = new URLSearchParams({
      Recursive: 'true',
      Fields:
        'PrimaryImageAspectRatio,Overview,Genres,People,MediaStreams,MediaSources,CommunityRating,OfficialRating,ProductionYear,Taglines,DateCreated',
      ImageTypeLimit: '1',
      EnableImageTypes: 'Primary,Backdrop,Thumb,Logo',
      Limit: String(params.limit ?? 50),
      StartIndex: String(params.startIndex ?? 0),
    });

    if (params.includeItemTypes) query.set('IncludeItemTypes', params.includeItemTypes);
    if (params.sortBy) query.set('SortBy', params.sortBy);
    if (params.sortOrder) query.set('SortOrder', params.sortOrder);
    if (params.filters) query.set('Filters', params.filters);
    if (params.genres) query.set('Genres', params.genres);
    if (params.searchTerm) query.set('SearchTerm', params.searchTerm);
    if (params.parentId) query.set('ParentId', params.parentId);

    return apiRequest<ItemsResult>(serverUrl, `/Users/${userId}/Items?${query.toString()}`, {
      token,
    });
  },

  async getItemDetail(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto> {
    if (isDemoServer(serverUrl)) {
      const found =
        DEMO_ITEMS.find((i) => i.Id === itemId) ??
        DEMO_EPISODES.find((e) => e.Id === itemId) ??
        DEMO_ITEMS[0];
      return applyDemoOverrides(found);
    }
    return apiRequest<BaseItemDto>(serverUrl, `/Users/${userId}/Items/${itemId}`, { token });
  },

  async getSeasons(
    serverUrl: string,
    token: string,
    userId: string,
    seriesId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      if (seriesId === 'demo-squid') return DEMO_SEASONS;
      return [
        {
          Id: `${seriesId}-s1`,
          Name: 'Temporada 1',
          SeriesId: seriesId,
          Type: 'Season',
          IndexNumber: 1,
          ChildCount: 2,
        },
      ];
    }
    const query = new URLSearchParams({
      userId,
      Fields: 'ItemCounts,PrimaryImageAspectRatio,Overview',
    });
    const res = await apiRequest<ItemsResult>(
      serverUrl,
      `/Shows/${seriesId}/Seasons?${query.toString()}`,
      { token }
    );
    return res.Items ?? [];
  },

  async getEpisodes(
    serverUrl: string,
    token: string,
    userId: string,
    seriesId: string,
    seasonId?: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      if (seriesId === 'demo-squid') {
        return DEMO_EPISODES.map(applyDemoOverrides);
      }
      const parent = DEMO_ITEMS.find((i) => i.Id === seriesId);
      return [1, 2, 3].map((epNum) =>
        applyDemoOverrides({
          Id: `${seriesId}-e${epNum}`,
          Name: `Episode ${epNum}`,
          SeriesName: parent?.Name ?? 'Series',
          SeriesId: seriesId,
          SeasonId: seasonId ?? `${seriesId}-s1`,
          Type: 'Episode',
          IndexNumber: epNum,
          ParentIndexNumber: 1,
          RunTimeTicks: 27_000_000_000,
          Overview: parent?.Overview,
          UserData: { Played: false, PlaybackPositionTicks: 0 },
        })
      );
    }

    const query = new URLSearchParams({
      userId,
      Fields: 'Overview,MediaSources,MediaStreams,PrimaryImageAspectRatio',
    });
    if (seasonId) query.set('seasonId', seasonId);
    const res = await apiRequest<ItemsResult>(
      serverUrl,
      `/Shows/${seriesId}/Episodes?${query.toString()}`,
      { token }
    );
    return res.Items ?? [];
  },

  async getSimilarItems(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string,
    limit = 12
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return DEMO_ITEMS.filter(
        (item) => item.Id !== itemId && (item.Type === 'Movie' || item.Type === 'Series')
      )
        .slice(0, limit)
        .map(applyDemoOverrides);
    }
    const query = new URLSearchParams({
      userId,
      limit: String(limit),
      Fields: 'PrimaryImageAspectRatio,Overview,ProductionYear,CommunityRating,OfficialRating',
    });
    const res = await apiRequest<ItemsResult>(
      serverUrl,
      `/Items/${itemId}/Similar?${query.toString()}`,
      { token }
    );
    return res.Items ?? [];
  },

  async toggleFavorite(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string,
    makeFavorite: boolean
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoFavoriteOverrides.set(itemId, makeFavorite);
      return;
    }
    await apiRequest(serverUrl, `/Users/${userId}/FavoriteItems/${itemId}`, {
      method: makeFavorite ? 'POST' : 'DELETE',
      token,
    });
  },

  async togglePlayed(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string,
    markPlayed: boolean
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoPlayedOverrides.set(itemId, markPlayed);
      if (markPlayed) demoProgressOverrides.set(itemId, 0);
      return;
    }
    await apiRequest(serverUrl, `/Users/${userId}/PlayedItems/${itemId}`, {
      method: markPlayed ? 'POST' : 'DELETE',
      token,
    });
  },

  async removeFromResume(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoProgressOverrides.set(itemId, 0);
      return;
    }
    await apiRequest(
      serverUrl,
      `/UserItems/${itemId}/UserData?userId=${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        token,
        body: {
          PlaybackPositionTicks: 0,
        },
      }
    );
  },

  async removeFromNextUp(
    serverUrl: string,
    token: string,
    userId: string,
    item: Pick<BaseItemDto, 'Id' | 'SeriesId'>
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoProgressOverrides.set(item.Id, 0);
      demoRemovedNextUp.add(item.Id);
      return;
    }
    // 1. Clear partial playback progress for the current episode
    await apiRequest(
      serverUrl,
      `/UserItems/${item.Id}/UserData?userId=${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        token,
        body: {
          PlaybackPositionTicks: 0,
          Played: false,
        },
      }
    );
    // 2. If it belongs to a series, reset its played state to remove it from Next Up
    if (item.SeriesId) {
      await apiRequest(
        serverUrl,
        `/UserPlayedItems/${item.SeriesId}?userId=${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          token,
        }
      );
    }
  },

  async getPlaybackInfo(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string,
    options: {
      maxStreamingBitrate?: number;
      audioStreamIndex?: number;
      subtitleStreamIndex?: number;
      startTimeTicks?: number;
    } = {}
  ): Promise<PlaybackInfoResponse> {
    if (isDemoServer(serverUrl)) {
      return buildDemoPlaybackInfo(itemId);
    }

    const body = {
      UserId: userId,
      MaxStreamingBitrate: options.maxStreamingBitrate ?? 120_000_000,
      StartTimeTicks: options.startTimeTicks ?? 0,
      AudioStreamIndex: options.audioStreamIndex,
      SubtitleStreamIndex: options.subtitleStreamIndex,
      EnableDirectPlay: true,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
      AutoOpenLiveStream: true,
      DeviceProfile: {
        MaxStreamingBitrate: options.maxStreamingBitrate ?? 120_000_000,
        MaxStaticBitrate: 100_000_000,
        MusicStreamingTranscodingBitrate: 384_000,
        DirectPlayProfiles: [
          {
            Container: 'mp4,m4v,webm',
            Type: 'Video',
            VideoCodec: 'h264,hevc,vp9,av1',
            AudioCodec: 'aac,mp3,opus,flac,vorbis',
          },
        ],
        TranscodingProfiles: [
          {
            Container: 'ts',
            Type: 'Video',
            VideoCodec: 'h264',
            AudioCodec: 'aac,mp3',
            Protocol: 'hls',
            Context: 'Streaming',
            MaxAudioChannels: '2',
            MinSegments: 1,
            BreakOnNonKeyFrames: true,
          },
        ],
        SubtitleProfiles: [
          { Format: 'vtt', Method: 'External' },
          { Format: 'srt', Method: 'External' },
        ],
      },
    };

    return apiRequest<PlaybackInfoResponse>(
      serverUrl,
      `/Items/${itemId}/PlaybackInfo?UserId=${encodeURIComponent(userId)}`,
      {
        method: 'POST',
        token,
        body,
      }
    );
  },

  async getMediaSegments(
    serverUrl: string,
    token: string,
    itemId: string
  ): Promise<MediaSegmentDto[]> {
    if (isDemoServer(serverUrl)) {
      if (itemId === 'demo-squid-e3') return DEMO_SEGMENTS;
      return [
        {
          Id: `seg-demo-${itemId}`,
          ItemId: itemId,
          Type: 'Intro',
          StartTicks: 5 * 10_000_000,
          EndTicks: 22 * 10_000_000,
        },
      ];
    }
    try {
      const res = await apiRequest<MediaSegmentQueryResult>(
        serverUrl,
        `/MediaSegments/${itemId}`,
        { token, timeoutMs: 5000 }
      );
      return res.Items ?? [];
    } catch {
      // Silently ignore on Jellyfin servers older than 10.10 or items without segments
      return [];
    }
  },

  async reportPlaybackStart(
    serverUrl: string,
    token: string,
    payload: {
      ItemId: string;
      MediaSourceId: string;
      PlaySessionId?: string;
      PositionTicks: number;
      AudioStreamIndex?: number;
      SubtitleStreamIndex?: number;
      PlayMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
    }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    try {
      await apiRequest(serverUrl, '/Sessions/Playing', {
        method: 'POST',
        token,
        body: {
          CanSeek: true,
          IsPaused: false,
          IsMuted: false,
          ...payload,
        },
      });
    } catch {
      // Do not interrupt playback if telemetry reporting fails
    }
  },

  async reportPlaybackProgress(
    serverUrl: string,
    token: string,
    payload: {
      ItemId: string;
      MediaSourceId: string;
      PlaySessionId?: string;
      PositionTicks: number;
      IsPaused: boolean;
      IsMuted: boolean;
      VolumeLevel: number;
      AudioStreamIndex?: number;
      SubtitleStreamIndex?: number;
      PlayMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
    }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoProgressOverrides.set(payload.ItemId, payload.PositionTicks);
      return;
    }
    try {
      await apiRequest(serverUrl, '/Sessions/Playing/Progress', {
        method: 'POST',
        token,
        body: {
          CanSeek: true,
          ...payload,
        },
      });
    } catch {
      // Ignore telemetry failures
    }
  },

  async reportPlaybackStopped(
    serverUrl: string,
    token: string,
    payload: {
      ItemId: string;
      MediaSourceId: string;
      PlaySessionId?: string;
      PositionTicks: number;
    }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoProgressOverrides.set(payload.ItemId, payload.PositionTicks);
      return;
    }
    try {
      await apiRequest(serverUrl, '/Sessions/Playing/Stopped', {
        method: 'POST',
        token,
        body: payload,
      });
    } catch {
      // Ignore telemetry failures
    }
  },
};

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

export interface BuiltPlaybackStream {
  streamUrl: string;
  fallbackUrl?: string;
  isHls: boolean;
  playMethod: 'DirectPlay' | 'DirectStream' | 'Transcode';
  subtitleTracks: Array<{
    index: number;
    label: string;
    language: string;
    src: string;
    isDefault: boolean;
  }>;
}

export function buildPlaybackStream(
  serverUrl: string,
  token: string,
  itemId: string,
  mediaSource: MediaSourceInfo,
  playSessionId: string | undefined,
  audioStreamIndex: number | undefined,
  quality: StreamingQuality
): BuiltPlaybackStream {
  if (isDemoServer(serverUrl)) {
    return {
      streamUrl: DEMO_HLS_STREAM,
      fallbackUrl: DEMO_MP4_FALLBACK,
      isHls: true,
      playMethod: 'Transcode',
      subtitleTracks: [],
    };
  }

  const base = normalizeServerUrl(serverUrl);
  const subtitleTracks = (mediaSource.MediaStreams ?? [])
    .filter((s) => s.Type === 'Subtitle' && (s.SupportsExternalStream || s.IsExternal || s.Codec === 'subrip' || s.Codec === 'srt' || s.Codec === 'vtt'))
    .map((s) => ({
      index: s.Index,
      label: s.DisplayTitle || s.Title || s.Language || `Subtitle ${s.Index}`,
      language: s.Language || 'en',
      src: `${base}/Videos/${itemId}/${mediaSource.Id}/Subtitles/${s.Index}/0/Stream.vtt?api_key=${encodeURIComponent(token)}`,
      isDefault: Boolean(s.IsDefault),
    }));

  const maxBitrate = qualityToBitrate(quality);
  const canDirectPlay =
    mediaSource.SupportsDirectPlay &&
    quality === 'auto' &&
    ['mp4', 'm4v', 'webm'].includes((mediaSource.Container ?? '').toLowerCase()) &&
    (audioStreamIndex === undefined || audioStreamIndex === mediaSource.DefaultAudioStreamIndex);

  if (canDirectPlay) {
    return {
      streamUrl: `${base}/Videos/${itemId}/stream?Static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&api_key=${encodeURIComponent(token)}`,
      isHls: false,
      playMethod: 'DirectPlay',
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

  const streamUrl = mediaSource.TranscodingUrl
    ? `${base}${mediaSource.TranscodingUrl}`
    : `${base}/Videos/${itemId}/master.m3u8?${hlsParams.toString()}`;

  return {
    streamUrl,
    fallbackUrl: `${base}/Videos/${itemId}/stream?Static=true&mediaSourceId=${encodeURIComponent(mediaSource.Id)}&api_key=${encodeURIComponent(token)}`,
    isHls: true,
    playMethod: 'Transcode',
    subtitleTracks,
  };
}

export function ticksToSeconds(ticks?: number): number {
  if (!ticks || ticks <= 0) return 0;
  return ticks / 10_000_000;
}

export function secondsToTicks(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * 10_000_000);
}

export function formatDurationFromTicks(ticks?: number): string {
  const totalMinutes = Math.round(ticksToSeconds(ticks) / 60);
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const paddedSecs = secs.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${paddedSecs}`;
  }
  return `${mins}:${paddedSecs}`;
}

export interface TrickplaySelection {
  mediaSourceId: string;
  info: TrickplayInfoDto;
}

export interface TrickplayFrame {
  url: string;
  col: number;
  row: number;
  tileWidth: number;
  tileHeight: number;
  displayWidth: number;
  displayHeight: number;
}

export function selectTrickplayInfo(
  item: BaseItemDto | null | undefined,
  preferredMediaSourceId?: string
): TrickplaySelection | null {
  const manifest = item?.Trickplay;
  if (!manifest) return null;

  const entries = Object.entries(manifest).filter(
    ([, widths]) => widths && Object.keys(widths).length > 0
  );
  if (entries.length === 0) return null;

  const matchedEntry =
    (preferredMediaSourceId ? entries.find(([id]) => id === preferredMediaSourceId) : undefined) ??
    entries[0];

  const [mediaSourceId, widthMap] = matchedEntry;
  const candidates = Object.values(widthMap).filter(
    (info) =>
      info.Width > 0 &&
      info.Height > 0 &&
      info.TileWidth > 0 &&
      info.TileHeight > 0 &&
      info.ThumbnailCount > 0
  );
  if (candidates.length === 0) return null;

  // Pick the width closest to 320px to balance sharpness and tile load speed
  candidates.sort((a, b) => Math.abs(a.Width - 320) - Math.abs(b.Width - 320));
  return {
    mediaSourceId,
    info: candidates[0],
  };
}

export function getTrickplayFrame(
  serverUrl: string,
  token: string,
  itemId: string,
  selection: TrickplaySelection,
  timeSeconds: number
): TrickplayFrame | null {
  if (isDemoServer(serverUrl)) return null;
  const base = normalizeServerUrl(serverUrl);
  if (!base) return null;

  const { mediaSourceId, info } = selection;
  const intervalMs = info.Interval > 0 ? info.Interval : 10_000;
  const rawIndex = Math.floor((Math.max(0, timeSeconds) * 1000) / intervalMs);
  const thumbIndex = Math.min(Math.max(0, rawIndex), info.ThumbnailCount - 1);

  const thumbsPerTile = info.TileWidth * info.TileHeight;
  const tileIndex = Math.floor(thumbIndex / thumbsPerTile);
  const offsetInTile = thumbIndex % thumbsPerTile;
  const col = offsetInTile % info.TileWidth;
  const row = Math.floor(offsetInTile / info.TileWidth);

  const displayWidth = Math.min(224, Math.max(160, info.Width));
  const displayHeight = Math.max(90, Math.round((displayWidth * info.Height) / info.Width));

  const query = new URLSearchParams({
    mediaSourceId,
    ApiKey: token,
  });

  return {
    url: `${base}/Videos/${itemId}/Trickplay/${info.Width}/${tileIndex}.jpg?${query.toString()}`,
    col,
    row,
    tileWidth: info.TileWidth,
    tileHeight: info.TileHeight,
    displayWidth,
    displayHeight,
  };
}
