import {
  AuthenticationResult,
  BaseItemDto,
  ItemsResult,
  MediaSegmentDto,
  MediaSegmentQueryResult,
  PlaybackInfoResponse,
  PublicSystemInfo,
  QuickConnectResult,
  SearchHintDto,
  SearchHintsResult,
  SessionInfoDto,
  SyncPlayGroupDto,
  UserConfiguration,
  UserDto,
} from '../types/jellyfin';
import { apiKeepalivePost, apiRequest, getOrCreateDeviceId } from './client';
import {
  buildDemoPlaybackInfo,
  DEMO_ACCESS_TOKEN,
  DEMO_EPISODES,
  DEMO_ITEMS,
  DEMO_SEASONS,
  DEMO_SEGMENTS,
  DEMO_SYSTEM_INFO,
  DEMO_USERS,
} from './demo/demoData';
import {
  applyDemoOverrides,
  demoFavoriteOverrides,
  demoPlayedOverrides,
  demoPlaylists,
  demoProgressOverrides,
  demoRemovedNextUp,
  isDemoServer,
} from './demo/demoStore';

function parseLastPlayedTimestamp(item: BaseItemDto): number {
  const raw = item.UserData?.LastPlayedDate;
  if (!raw) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * Keep at most one resumable entry per series (selecting the most recently played item).
 */
export function dedupeResumeItemsBySeries(items: BaseItemDto[], limit = 16): BaseItemDto[] {
  const bestByKey = new Map<string, { item: BaseItemDto; index: number; timestamp: number }>();

  items.forEach((item, index) => {
    const key = item.SeriesId ? `series:${item.SeriesId}` : `item:${item.Id}`;
    const timestamp = parseLastPlayedTimestamp(item);
    const existing = bestByKey.get(key);
    if (!existing || timestamp > existing.timestamp) {
      bestByKey.set(key, { item, index, timestamp });
    }
  });

  return Array.from(bestByKey.values())
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp > b.timestamp ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item)
    .slice(0, limit);
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

  async logout(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl) || !token) return;
    await apiRequest(serverUrl, '/Sessions/Logout', {
      method: 'POST',
      token,
      timeoutMs: 5000,
    });
  },

  async isQuickConnectEnabled(serverUrl: string): Promise<boolean> {
    if (isDemoServer(serverUrl)) return true;
    try {
      const result = await apiRequest<boolean>(serverUrl, '/QuickConnect/Enabled', {
        timeoutMs: 5000,
      });
      return Boolean(result);
    } catch {
      return false;
    }
  },

  async initiateQuickConnect(serverUrl: string): Promise<QuickConnectResult> {
    if (isDemoServer(serverUrl)) {
      return { Code: '482910', Secret: 'demo-qc-secret', Authenticated: false };
    }
    return apiRequest<QuickConnectResult>(serverUrl, '/QuickConnect/Initiate', {
      method: 'POST',
      body: {},
    });
  },

  async connectQuickConnect(serverUrl: string, secret: string): Promise<QuickConnectResult> {
    if (isDemoServer(serverUrl)) {
      return { Code: '482910', Secret: secret, Authenticated: true };
    }
    return apiRequest<QuickConnectResult>(
      serverUrl,
      `/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`,
      { timeoutMs: 8000 }
    );
  },

  async authenticateWithQuickConnect(
    serverUrl: string,
    secret: string
  ): Promise<AuthenticationResult> {
    if (isDemoServer(serverUrl)) {
      return {
        User: DEMO_USERS[0],
        AccessToken: DEMO_ACCESS_TOKEN,
        ServerId: DEMO_SYSTEM_INFO.Id,
      };
    }
    return apiRequest<AuthenticationResult>(serverUrl, '/Users/AuthenticateWithQuickConnect', {
      method: 'POST',
      body: { Secret: secret },
    });
  },

  async authorizeQuickConnect(serverUrl: string, token: string, code: string): Promise<boolean> {
    if (isDemoServer(serverUrl)) return true;
    return apiRequest<boolean>(
      serverUrl,
      `/QuickConnect/Authorize?code=${encodeURIComponent(code.trim())}`,
      { method: 'POST', token }
    );
  },

  async updateUserConfiguration(
    serverUrl: string,
    token: string,
    userId: string,
    config: UserConfiguration
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, `/Users/${userId}/Configuration`, {
      method: 'POST',
      token,
      body: config,
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
      return dedupeResumeItemsBySeries(
        [DEMO_EPISODES[0]]
          .map(applyDemoOverrides)
          .filter((item) => (item.UserData?.PlaybackPositionTicks ?? 0) > 0)
      );
    }
    const query = new URLSearchParams({
      Limit: '32',
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
    return dedupeResumeItemsBySeries(res.Items ?? [], 16);
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
      personIds?: string;
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

      if (params.personIds) {
        pool = pool.filter((item) => item.People?.some((p) => p.Id === params.personIds));
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
        pool.sort((a, b) => a.Name.localeCompare(b.Name, 'en'));
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
    if (params.personIds) query.set('PersonIds', params.personIds);

    return apiRequest<ItemsResult>(serverUrl, `/Users/${userId}/Items?${query.toString()}`, {
      token,
    });
  },

  async getGenres(
    serverUrl: string,
    token: string,
    userId: string,
    params: { includeItemTypes?: string; parentId?: string } = {}
  ): Promise<string[]> {
    if (isDemoServer(serverUrl)) {
      const types = params.includeItemTypes?.split(',');
      const set = new Set<string>();
      DEMO_ITEMS.filter((i) => !types || types.includes(i.Type)).forEach((i) =>
        i.Genres?.forEach((g) => set.add(g))
      );
      return Array.from(set).sort();
    }
    const query = new URLSearchParams({ UserId: userId });
    if (params.includeItemTypes) query.set('IncludeItemTypes', params.includeItemTypes);
    if (params.parentId) query.set('ParentId', params.parentId);
    const res = await apiRequest<ItemsResult>(serverUrl, `/Genres?${query.toString()}`, { token });
    return (res.Items ?? []).map((g) => g.Name).filter(Boolean);
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
        DEMO_EPISODES.find((e) => e.Id === itemId);
      if (found) return applyDemoOverrides(found);
      const personMatch = DEMO_ITEMS.flatMap((i) => i.People ?? []).find((p) => p.Id === itemId);
      if (personMatch) {
        return {
          Id: personMatch.Id,
          Name: personMatch.Name,
          Type: 'Person',
          ImageTags: personMatch.PrimaryImageTag ? { Primary: personMatch.PrimaryImageTag } : undefined,
        };
      }
      return applyDemoOverrides(DEMO_ITEMS[0]);
    }
    return apiRequest<BaseItemDto>(serverUrl, `/Users/${userId}/Items/${itemId}`, { token });
  },

  async getLocalTrailers(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<BaseItemDto[]>(
        serverUrl,
        `/Users/${userId}/Items/${itemId}/LocalTrailers`,
        { token, timeoutMs: 6000 }
      );
    } catch {
      return [];
    }
  },

  async getSpecialFeatures(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<BaseItemDto[]>(
        serverUrl,
        `/Users/${userId}/Items/${itemId}/SpecialFeatures`,
        { token, timeoutMs: 6000 }
      );
    } catch {
      return [];
    }
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
          Name: 'Season 1',
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

  reportPlaybackStoppedKeepalive(
    serverUrl: string,
    token: string,
    payload: {
      ItemId: string;
      MediaSourceId: string;
      PlaySessionId?: string;
      PositionTicks: number;
    }
  ): void {
    if (isDemoServer(serverUrl)) {
      demoProgressOverrides.set(payload.ItemId, payload.PositionTicks);
      return;
    }
    apiKeepalivePost(serverUrl, '/Sessions/Playing/Stopped', token, payload);
  },

  async getControllableSessions(
    serverUrl: string,
    token: string,
    userId: string
  ): Promise<SessionInfoDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      const currentDeviceId = getOrCreateDeviceId();
      const sessions = await apiRequest<SessionInfoDto[]>(
        serverUrl,
        `/Sessions?ControllableByUserId=${encodeURIComponent(userId)}`,
        { token, timeoutMs: 6000 }
      );
      return (sessions ?? []).filter(
        (s) => s.SupportsRemoteControl && s.DeviceId !== currentDeviceId
      );
    } catch {
      return [];
    }
  },

  async sendRemotePlayCommand(
    serverUrl: string,
    token: string,
    targetSessionId: string,
    itemIds: string[],
    startPositionTicks = 0
  ): Promise<void> {
    if (isDemoServer(serverUrl) || itemIds.length === 0) return;
    const query = new URLSearchParams({
      PlayCommand: 'PlayNow',
      ItemIds: itemIds.join(','),
      StartPositionTicks: String(Math.max(0, Math.round(startPositionTicks))),
    });
    await apiRequest(
      serverUrl,
      `/Sessions/${encodeURIComponent(targetSessionId)}/Playing?${query.toString()}`,
      { method: 'POST', token }
    );
  },

  async reportSessionCapabilities(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl) || !token) return;
    try {
      await apiRequest(serverUrl, '/Sessions/Capabilities/Full', {
        method: 'POST',
        token,
        timeoutMs: 6000,
        body: {
          SupportsMediaControl: true,
          PlayableMediaTypes: ['Video'],
          SupportedCommands: [
            'Play',
            'PlayState',
            'Pause',
            'Unpause',
            'PlayPause',
            'Seek',
            'Stop',
            'PlayNext',
            'DisplayMessage',
          ],
          SupportsPersistentIdentifier: true,
        },
      });
    } catch {
      // Ignore capability reporting failures on restricted servers
    }
  },

  async getSuggestions(
    serverUrl: string,
    token: string,
    userId: string,
    limit = 16
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return DEMO_ITEMS.filter((i) => i.Type === 'Movie' || i.Type === 'Series')
        .slice(-limit)
        .reverse()
        .map(applyDemoOverrides);
    }
    const query = new URLSearchParams({
      userId,
      type: 'Movie,Series',
      mediaTypes: 'Video',
      limit: String(limit),
      enableUserData: 'true',
    });
    try {
      const res = await apiRequest<ItemsResult>(
        serverUrl,
        `/Items/Suggestions?${query.toString()}`,
        { token, timeoutMs: 8000 }
      );
      return res.Items ?? [];
    } catch {
      return [];
    }
  },

  async getSearchHints(
    serverUrl: string,
    token: string,
    userId: string,
    searchTerm: string,
    limit = 8
  ): Promise<SearchHintDto[]> {
    const trimmed = searchTerm.trim();
    if (!trimmed) return [];
    if (isDemoServer(serverUrl)) {
      const q = trimmed.toLowerCase();
      return [...DEMO_ITEMS, ...DEMO_EPISODES]
        .filter((i) => i.Name.toLowerCase().includes(q) || i.SeriesName?.toLowerCase().includes(q))
        .slice(0, limit)
        .map((i) => ({
          Id: i.Id,
          ItemId: i.Id,
          Name: i.Name,
          Type: i.Type,
          ProductionYear: i.ProductionYear,
          PrimaryImageTag: i.ImageTags?.Primary,
          Series: i.SeriesName,
          IndexNumber: i.IndexNumber,
          ParentIndexNumber: i.ParentIndexNumber,
        }));
    }
    try {
      const query = new URLSearchParams({
        userId,
        searchTerm: trimmed,
        includeItemTypes: 'Movie,Series,Episode,Person',
        limit: String(limit),
      });
      const res = await apiRequest<SearchHintsResult>(
        serverUrl,
        `/Search/Hints?${query.toString()}`,
        { token, timeoutMs: 5000 }
      );
      return res.SearchHints ?? [];
    } catch {
      return [];
    }
  },

  async getPlaylists(serverUrl: string, token: string, userId: string): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      return Array.from(demoPlaylists.entries()).map(([id, pl]) => ({
        Id: id,
        Name: pl.name,
        Type: 'Playlist',
        ChildCount: pl.itemIds.length,
      }));
    }
    const res = await this.getItems(serverUrl, token, userId, {
      includeItemTypes: 'Playlist',
      sortBy: 'SortName',
      sortOrder: 'Ascending',
      limit: 100,
    });
    return res.Items;
  },

  async getPlaylistItems(
    serverUrl: string,
    token: string,
    userId: string,
    playlistId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) {
      const pl = demoPlaylists.get(playlistId);
      if (!pl) return [];
      const pool = [...DEMO_ITEMS, ...DEMO_EPISODES];
      return pl.itemIds
        .map((id, idx): BaseItemDto | null => {
          const found = pool.find((entry) => entry.Id === id);
          return found ? { ...applyDemoOverrides(found), PlaylistItemId: `${playlistId}-${idx}` } : null;
        })
        .filter((x): x is BaseItemDto => x !== null);
    }
    const query = new URLSearchParams({
      userId,
      Fields: 'PrimaryImageAspectRatio,Overview,MediaSources,RunTimeTicks,ProductionYear',
    });
    const res = await apiRequest<ItemsResult>(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Items?${query.toString()}`,
      { token }
    );
    return res.Items ?? [];
  },

  async createPlaylist(
    serverUrl: string,
    token: string,
    userId: string,
    name: string,
    itemIds: string[] = []
  ): Promise<{ Id: string }> {
    if (isDemoServer(serverUrl)) {
      const id = `demo-pl-${Date.now()}`;
      demoPlaylists.set(id, { name: name.trim(), itemIds: [...itemIds] });
      return { Id: id };
    }
    return apiRequest<{ Id: string }>(serverUrl, '/Playlists', {
      method: 'POST',
      token,
      body: {
        Name: name.trim(),
        Ids: itemIds,
        UserId: userId,
        MediaType: 'Video',
      },
    });
  },

  async addToPlaylist(
    serverUrl: string,
    token: string,
    userId: string,
    playlistId: string,
    itemIds: string[]
  ): Promise<void> {
    if (itemIds.length === 0) return;
    if (isDemoServer(serverUrl)) {
      const pl = demoPlaylists.get(playlistId);
      if (pl) {
        pl.itemIds.push(...itemIds);
      }
      return;
    }
    const query = new URLSearchParams({
      ids: itemIds.join(','),
      userId,
    });
    await apiRequest(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Items?${query.toString()}`,
      { method: 'POST', token }
    );
  },

  async removeFromPlaylist(
    serverUrl: string,
    token: string,
    userId: string,
    playlistId: string,
    entryIds: string[]
  ): Promise<void> {
    if (entryIds.length === 0) return;
    if (isDemoServer(serverUrl)) {
      const pl = demoPlaylists.get(playlistId);
      if (pl) {
        pl.itemIds = pl.itemIds.filter((_, idx) => !entryIds.includes(`${playlistId}-${idx}`));
      }
      return;
    }
    const query = new URLSearchParams({
      entryIds: entryIds.join(','),
      userId,
    });
    await apiRequest(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Items?${query.toString()}`,
      { method: 'DELETE', token }
    );
  },

  async getSyncPlayGroups(serverUrl: string, token: string): Promise<SyncPlayGroupDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<SyncPlayGroupDto[]>(serverUrl, '/SyncPlay/List', {
        token,
        timeoutMs: 6000,
      });
    } catch {
      return [];
    }
  },

  async createSyncPlayGroup(serverUrl: string, token: string, groupName: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/New', {
      method: 'POST',
      token,
      body: { GroupName: groupName.trim() || 'MorphPlay Watch Party' },
    });
  },

  async joinSyncPlayGroup(serverUrl: string, token: string, groupId: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Join', {
      method: 'POST',
      token,
      body: { GroupId: groupId },
    });
  },

  async leaveSyncPlayGroup(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Leave', {
      method: 'POST',
      token,
    });
  },

  async setSyncPlayQueue(
    serverUrl: string,
    token: string,
    playingQueue: string[],
    playingItemPosition = 0,
    startPositionTicks = 0
  ): Promise<void> {
    if (isDemoServer(serverUrl) || playingQueue.length === 0) return;
    await apiRequest(serverUrl, '/SyncPlay/SetNewQueue', {
      method: 'POST',
      token,
      body: {
        PlayingQueue: playingQueue,
        PlayingItemPosition: playingItemPosition,
        StartPositionTicks: Math.max(0, Math.round(startPositionTicks)),
      },
    });
  },

  async syncPlayPause(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Pause', { method: 'POST', token });
  },

  async syncPlayUnpause(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Unpause', { method: 'POST', token });
  },

  async syncPlaySeek(serverUrl: string, token: string, positionTicks: number): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Seek', {
      method: 'POST',
      token,
      body: { PositionTicks: Math.max(0, Math.round(positionTicks)) },
    });
  },

  async syncPlayReady(
    serverUrl: string,
    token: string,
    payload: {
      When: string;
      PositionTicks: number;
      IsPlaying: boolean;
      PlaylistItemId?: string;
    }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Ready', {
      method: 'POST',
      token,
      body: payload,
    });
  },

  async syncPlayBuffering(
    serverUrl: string,
    token: string,
    payload: {
      When: string;
      PositionTicks: number;
      IsPlaying: boolean;
      PlaylistItemId?: string;
    }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Buffering', {
      method: 'POST',
      token,
      body: payload,
    });
  },
};
