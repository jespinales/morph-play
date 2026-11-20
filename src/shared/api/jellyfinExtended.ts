import {
  AllThemeMediaResult,
  BaseItemDto,
  BrandConfig,
  BrandingOptionsDto,
  DisplayPreferencesDto,
  ExternalIdInfo,
  GroupQueueMode,
  GroupRepeatMode,
  GroupShuffleMode,
  ItemsResult,
  PlaystateCommandData,
  PlaylistDto,
  PlaylistUserPermissions,
  QueryFilters,
  RecommendationDto,
  RemoteSubtitleInfo,
  SyncPlayGroupDto,
  UploadSubtitleDto,
  UserItemDataDto,
} from '../types/jellyfin';
import { parseServerBrandFromCss, upsertServerBrandInCss } from '../utils/brand';
import { normalizeServerUrl } from '../utils/url';
import { apiRequest, buildAuthHeader } from './client';
import { DEMO_ITEMS } from './demo/demoData';
import {
  applyDemoOverrides,
  demoCollections,
  demoDisplayPrefs,
  demoLikesOverrides,
  demoPlaylists,
  isDemoServer,
} from './demo/demoStore';

const CLIENT_DISPLAY_NAME = 'MorphPlay';

export const jellyfinExtendedApi = {
  // --- SyncPlay full suite ---
  async getSyncPlayGroup(
    serverUrl: string,
    token: string,
    groupId: string
  ): Promise<SyncPlayGroupDto | null> {
    if (isDemoServer(serverUrl)) return null;
    try {
      return await apiRequest<SyncPlayGroupDto>(
        serverUrl,
        `/SyncPlay/${encodeURIComponent(groupId)}`,
        { token, timeoutMs: 6000 }
      );
    } catch {
      return null;
    }
  },

  async syncPlayPing(serverUrl: string, token: string, pingMs: number): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    try {
      await apiRequest(serverUrl, '/SyncPlay/Ping', {
        method: 'POST',
        token,
        timeoutMs: 4000,
        body: { Ping: Math.max(0, Math.round(pingMs)) },
      });
    } catch {
      // Ignore transient ping errors
    }
  },

  async syncPlayQueue(
    serverUrl: string,
    token: string,
    itemIds: string[],
    mode: GroupQueueMode = 'Queue'
  ): Promise<void> {
    if (isDemoServer(serverUrl) || itemIds.length === 0) return;
    await apiRequest(serverUrl, '/SyncPlay/Queue', {
      method: 'POST',
      token,
      body: { ItemIds: itemIds, Mode: mode },
    });
  },

  async syncPlayNextItem(
    serverUrl: string,
    token: string,
    playlistItemId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/NextItem', {
      method: 'POST',
      token,
      body: { PlaylistItemId: playlistItemId },
    });
  },

  async syncPlayPreviousItem(
    serverUrl: string,
    token: string,
    playlistItemId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/PreviousItem', {
      method: 'POST',
      token,
      body: { PlaylistItemId: playlistItemId },
    });
  },

  async syncPlaySetPlaylistItem(
    serverUrl: string,
    token: string,
    playlistItemId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/SetPlaylistItem', {
      method: 'POST',
      token,
      body: { PlaylistItemId: playlistItemId },
    });
  },

  async syncPlayMovePlaylistItem(
    serverUrl: string,
    token: string,
    playlistItemId: string,
    newIndex: number
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/MovePlaylistItem', {
      method: 'POST',
      token,
      body: { PlaylistItemId: playlistItemId, NewIndex: newIndex },
    });
  },

  async syncPlayRemoveFromPlaylist(
    serverUrl: string,
    token: string,
    playlistItemIds: string[],
    clearPlaylist = false,
    clearPlayingItem = false
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/RemoveFromPlaylist', {
      method: 'POST',
      token,
      body: {
        PlaylistItemIds: playlistItemIds,
        ClearPlaylist: clearPlaylist,
        ClearPlayingItem: clearPlayingItem,
      },
    });
  },

  async syncPlaySetRepeatMode(
    serverUrl: string,
    token: string,
    mode: GroupRepeatMode
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/SetRepeatMode', {
      method: 'POST',
      token,
      body: { Mode: mode },
    });
  },

  async syncPlaySetShuffleMode(
    serverUrl: string,
    token: string,
    mode: GroupShuffleMode
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/SetShuffleMode', {
      method: 'POST',
      token,
      body: { Mode: mode },
    });
  },

  async syncPlayStop(serverUrl: string, token: string): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/Stop', { method: 'POST', token });
  },

  async syncPlaySetIgnoreWait(
    serverUrl: string,
    token: string,
    ignoreWait: boolean
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/SyncPlay/SetIgnoreWait', {
      method: 'POST',
      token,
      body: { IgnoreWait: ignoreWait },
    });
  },

  // --- Remote & local subtitle management ---
  async searchRemoteSubtitles(
    serverUrl: string,
    token: string,
    itemId: string,
    language: string,
    isPerfectMatch?: boolean
  ): Promise<RemoteSubtitleInfo[]> {
    if (isDemoServer(serverUrl)) {
      return [
        {
          Id: `demo-sub-${language}`,
          Name: `Demo (${language.toUpperCase()})`,
          Format: 'srt',
          ProviderName: 'DemoSub',
          ThreeLetterISOLanguageName: language,
          IsHashMatch: true,
        },
      ];
    }
    const query = new URLSearchParams();
    if (isPerfectMatch !== undefined) query.set('isPerfectMatch', String(isPerfectMatch));
    const qs = query.toString();
    return apiRequest<RemoteSubtitleInfo[]>(
      serverUrl,
      `/Items/${encodeURIComponent(itemId)}/RemoteSearch/Subtitles/${encodeURIComponent(language)}${qs ? `?${qs}` : ''}`,
      { token, timeoutMs: 12000 }
    );
  },

  async downloadRemoteSubtitles(
    serverUrl: string,
    token: string,
    itemId: string,
    subtitleId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(
      serverUrl,
      `/Items/${encodeURIComponent(itemId)}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`,
      { method: 'POST', token }
    );
  },

  async uploadSubtitle(
    serverUrl: string,
    token: string,
    itemId: string,
    dto: UploadSubtitleDto
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, `/Videos/${encodeURIComponent(itemId)}/Subtitles`, {
      method: 'POST',
      token,
      body: dto,
    });
  },

  async deleteSubtitle(
    serverUrl: string,
    token: string,
    itemId: string,
    index: number
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, `/Videos/${encodeURIComponent(itemId)}/Subtitles/${index}`, {
      method: 'DELETE',
      token,
    });
  },

  // --- Catalog filters, years, recommendations & upcoming ---
  async getFilters2(
    serverUrl: string,
    token: string,
    userId: string,
    params: { includeItemTypes?: string; parentId?: string } = {}
  ): Promise<QueryFilters> {
    if (isDemoServer(serverUrl)) {
      const types = params.includeItemTypes?.split(',');
      const genres = new Set<string>();
      DEMO_ITEMS.filter((i) => !types || types.includes(i.Type)).forEach((i) =>
        i.Genres?.forEach((g) => genres.add(g))
      );
      return { Genres: Array.from(genres).sort(), Tags: [] };
    }
    const query = new URLSearchParams({ userId, recursive: 'true' });
    if (params.includeItemTypes) query.set('includeItemTypes', params.includeItemTypes);
    if (params.parentId) query.set('parentId', params.parentId);
    try {
      return await apiRequest<QueryFilters>(serverUrl, `/Items/Filters2?${query.toString()}`, {
        token,
      });
    } catch {
      return {};
    }
  },

  async getYears(
    serverUrl: string,
    token: string,
    userId: string,
    params: { includeItemTypes?: string; parentId?: string } = {}
  ): Promise<number[]> {
    if (isDemoServer(serverUrl)) {
      const years = new Set<number>();
      DEMO_ITEMS.forEach((i) => {
        if (i.ProductionYear) years.add(i.ProductionYear);
      });
      return Array.from(years).sort((a, b) => b - a);
    }
    const query = new URLSearchParams({
      userId,
      recursive: 'true',
      sortBy: 'SortName',
      sortOrder: 'Descending',
    });
    if (params.includeItemTypes) query.set('includeItemTypes', params.includeItemTypes);
    if (params.parentId) query.set('parentId', params.parentId);
    try {
      const res = await apiRequest<ItemsResult>(serverUrl, `/Years?${query.toString()}`, { token });
      return (res.Items ?? [])
        .map((y) => Number.parseInt(y.Name, 10))
        .filter((y) => Number.isFinite(y));
    } catch {
      return [];
    }
  },

  async getMovieRecommendations(
    serverUrl: string,
    token: string,
    userId: string,
    categoryLimit = 3,
    itemLimit = 12
  ): Promise<RecommendationDto[]> {
    if (isDemoServer(serverUrl)) return [];
    const query = new URLSearchParams({
      userId,
      categoryLimit: String(categoryLimit),
      itemLimit: String(itemLimit),
      fields: 'PrimaryImageAspectRatio,Overview,Genres',
    });
    try {
      return await apiRequest<RecommendationDto[]>(
        serverUrl,
        `/Movies/Recommendations?${query.toString()}`,
        { token, timeoutMs: 8000 }
      );
    } catch {
      return [];
    }
  },

  async getUpcomingEpisodes(
    serverUrl: string,
    token: string,
    userId: string,
    limit = 16
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    const query = new URLSearchParams({
      userId,
      limit: String(limit),
      fields: 'PrimaryImageAspectRatio,Overview',
      imageTypeLimit: '1',
      enableImageTypes: 'Primary,Backdrop,Thumb',
    });
    try {
      const res = await apiRequest<ItemsResult>(
        serverUrl,
        `/Shows/Upcoming?${query.toString()}`,
        { token, timeoutMs: 8000 }
      );
      return res.Items ?? [];
    } catch {
      return [];
    }
  },

  // --- Collections (BoxSet) & Item hierarchy ---
  async getItemCollections(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      const res = await apiRequest<ItemsResult>(
        serverUrl,
        `/Items/${encodeURIComponent(itemId)}/Collections?userId=${encodeURIComponent(userId)}`,
        { token, timeoutMs: 6000 }
      );
      return res.Items ?? [];
    } catch {
      return [];
    }
  },

  async getItemAncestors(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<BaseItemDto[]>(
        serverUrl,
        `/Items/${encodeURIComponent(itemId)}/Ancestors?userId=${encodeURIComponent(userId)}`,
        { token, timeoutMs: 6000 }
      );
    } catch {
      return [];
    }
  },

  async createCollection(
    serverUrl: string,
    token: string,
    name: string,
    itemIds: string[] = [],
    isLocked = false
  ): Promise<{ Id: string }> {
    if (isDemoServer(serverUrl)) {
      const id = `demo-col-${Date.now()}`;
      demoCollections.set(id, { name: name.trim(), itemIds: [...itemIds] });
      return { Id: id };
    }
    const query = new URLSearchParams({
      name: name.trim(),
      isLocked: String(isLocked),
    });
    if (itemIds.length > 0) query.set('ids', itemIds.join(','));
    return apiRequest<{ Id: string }>(serverUrl, `/Collections?${query.toString()}`, {
      method: 'POST',
      token,
    });
  },

  async addToCollection(
    serverUrl: string,
    token: string,
    collectionId: string,
    itemIds: string[]
  ): Promise<void> {
    if (itemIds.length === 0) return;
    if (isDemoServer(serverUrl)) {
      const col = demoCollections.get(collectionId);
      if (col) col.itemIds.push(...itemIds);
      return;
    }
    const query = new URLSearchParams({ ids: itemIds.join(',') });
    await apiRequest(
      serverUrl,
      `/Collections/${encodeURIComponent(collectionId)}/Items?${query.toString()}`,
      { method: 'POST', token }
    );
  },

  async removeFromCollection(
    serverUrl: string,
    token: string,
    collectionId: string,
    itemIds: string[]
  ): Promise<void> {
    if (itemIds.length === 0) return;
    if (isDemoServer(serverUrl)) {
      const col = demoCollections.get(collectionId);
      if (col) col.itemIds = col.itemIds.filter((id) => !itemIds.includes(id));
      return;
    }
    const query = new URLSearchParams({ ids: itemIds.join(',') });
    await apiRequest(
      serverUrl,
      `/Collections/${encodeURIComponent(collectionId)}/Items?${query.toString()}`,
      { method: 'DELETE', token }
    );
  },

  // --- Media extras: Intros, ThemeMedia, AdditionalParts, ExternalIds, Rating ---
  async getItemIntros(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      const res = await apiRequest<ItemsResult>(
        serverUrl,
        `/Items/${encodeURIComponent(itemId)}/Intros?userId=${encodeURIComponent(userId)}`,
        { token, timeoutMs: 5000 }
      );
      return res.Items ?? [];
    } catch {
      return [];
    }
  },

  async getThemeMedia(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<AllThemeMediaResult> {
    if (isDemoServer(serverUrl)) return {};
    try {
      return await apiRequest<AllThemeMediaResult>(
        serverUrl,
        `/Items/${encodeURIComponent(itemId)}/ThemeMedia?userId=${encodeURIComponent(userId)}&inheritFromParent=true`,
        { token, timeoutMs: 5000 }
      );
    } catch {
      return {};
    }
  },

  async getAdditionalParts(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string
  ): Promise<BaseItemDto[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      const res = await apiRequest<ItemsResult>(
        serverUrl,
        `/Videos/${encodeURIComponent(itemId)}/AdditionalParts?userId=${encodeURIComponent(userId)}`,
        { token, timeoutMs: 5000 }
      );
      return res.Items ?? [];
    } catch {
      return [];
    }
  },

  async getExternalIdInfos(
    serverUrl: string,
    token: string,
    itemId: string
  ): Promise<ExternalIdInfo[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<ExternalIdInfo[]>(
        serverUrl,
        `/Items/${encodeURIComponent(itemId)}/ExternalIdInfos`,
        { token, timeoutMs: 5000 }
      );
    } catch {
      return [];
    }
  },

  async updateUserRating(
    serverUrl: string,
    token: string,
    userId: string,
    itemId: string,
    likes: boolean | null
  ): Promise<UserItemDataDto> {
    if (isDemoServer(serverUrl)) {
      demoLikesOverrides.set(itemId, likes === null ? undefined : likes);
      return { Likes: likes === null ? undefined : likes };
    }
    const query = new URLSearchParams({ userId });
    if (likes !== null) query.set('likes', String(likes));
    return apiRequest<UserItemDataDto>(
      serverUrl,
      `/UserItems/${encodeURIComponent(itemId)}/Rating?${query.toString()}`,
      { method: likes === null ? 'DELETE' : 'POST', token }
    );
  },

  // --- Advanced playlist management ---
  async getPlaylist(
    serverUrl: string,
    token: string,
    playlistId: string
  ): Promise<PlaylistDto | null> {
    if (isDemoServer(serverUrl)) {
      const pl = demoPlaylists.get(playlistId);
      return pl ? { OpenAccess: pl.openAccess ?? false, ItemIds: pl.itemIds, Shares: [] } : null;
    }
    try {
      return await apiRequest<PlaylistDto>(
        serverUrl,
        `/Playlists/${encodeURIComponent(playlistId)}`,
        { token }
      );
    } catch {
      return null;
    }
  },

  async updatePlaylist(
    serverUrl: string,
    token: string,
    playlistId: string,
    patch: { Name?: string; IsPublic?: boolean }
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      const pl = demoPlaylists.get(playlistId);
      if (pl) {
        if (patch.Name !== undefined) pl.name = patch.Name;
        if (patch.IsPublic !== undefined) pl.openAccess = patch.IsPublic;
      }
      return;
    }
    await apiRequest(serverUrl, `/Playlists/${encodeURIComponent(playlistId)}`, {
      method: 'POST',
      token,
      body: patch,
    });
  },

  async movePlaylistItem(
    serverUrl: string,
    token: string,
    playlistId: string,
    playlistItemId: string,
    newIndex: number
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Items/${encodeURIComponent(playlistItemId)}/Move/${newIndex}`,
      { method: 'POST', token }
    );
  },

  async getPlaylistUsers(
    serverUrl: string,
    token: string,
    playlistId: string
  ): Promise<PlaylistUserPermissions[]> {
    if (isDemoServer(serverUrl)) return [];
    try {
      return await apiRequest<PlaylistUserPermissions[]>(
        serverUrl,
        `/Playlists/${encodeURIComponent(playlistId)}/Users`,
        { token }
      );
    } catch {
      return [];
    }
  },

  async setPlaylistUserAccess(
    serverUrl: string,
    token: string,
    playlistId: string,
    userId: string,
    canEdit: boolean
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Users/${encodeURIComponent(userId)}`,
      { method: 'POST', token, body: { CanEdit: canEdit } }
    );
  },

  async removePlaylistUser(
    serverUrl: string,
    token: string,
    playlistId: string,
    userId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(
      serverUrl,
      `/Playlists/${encodeURIComponent(playlistId)}/Users/${encodeURIComponent(userId)}`,
      { method: 'DELETE', token }
    );
  },

  // --- Remote session playback/message & keepalive ping ---
  async sendRemotePlaystateCommand(
    serverUrl: string,
    token: string,
    targetSessionId: string,
    command: NonNullable<PlaystateCommandData['Command']>,
    controllingUserId?: string,
    seekPositionTicks?: number
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    const query = new URLSearchParams();
    if (controllingUserId) query.set('controllingUserId', controllingUserId);
    if (seekPositionTicks !== undefined) {
      query.set('seekPositionTicks', String(Math.max(0, Math.round(seekPositionTicks))));
    }
    const qs = query.toString();
    await apiRequest(
      serverUrl,
      `/Sessions/${encodeURIComponent(targetSessionId)}/Playing/${encodeURIComponent(command)}${qs ? `?${qs}` : ''}`,
      { method: 'POST', token }
    );
  },

  async sendSessionMessage(
    serverUrl: string,
    token: string,
    targetSessionId: string,
    header: string,
    text: string,
    timeoutMs = 5000
  ): Promise<void> {
    if (isDemoServer(serverUrl) || !text.trim()) return;
    await apiRequest(
      serverUrl,
      `/Sessions/${encodeURIComponent(targetSessionId)}/Message`,
      {
        method: 'POST',
        token,
        body: { Header: header, Text: text.trim(), TimeoutMs: timeoutMs },
      }
    );
  },

  async pingPlaybackSession(
    serverUrl: string,
    token: string,
    playSessionId: string
  ): Promise<void> {
    if (isDemoServer(serverUrl) || !playSessionId) return;
    try {
      await apiRequest(
        serverUrl,
        `/Sessions/Playing/Ping?playSessionId=${encodeURIComponent(playSessionId)}`,
        { method: 'POST', token, timeoutMs: 5000 }
      );
    } catch {
      // Ignore keepalive ping errors
    }
  },

  // --- DisplayPreferences, Password, BitrateTest, Branding ---
  async getDisplayPreferences(
    serverUrl: string,
    token: string,
    displayPreferencesId: string,
    userId: string
  ): Promise<DisplayPreferencesDto | null> {
    if (isDemoServer(serverUrl)) {
      return demoDisplayPrefs.get(displayPreferencesId) ?? null;
    }
    const query = new URLSearchParams({ userId, client: CLIENT_DISPLAY_NAME });
    try {
      return await apiRequest<DisplayPreferencesDto>(
        serverUrl,
        `/DisplayPreferences/${encodeURIComponent(displayPreferencesId)}?${query.toString()}`,
        { token, timeoutMs: 5000 }
      );
    } catch {
      return null;
    }
  },

  async updateDisplayPreferences(
    serverUrl: string,
    token: string,
    displayPreferencesId: string,
    userId: string,
    prefs: DisplayPreferencesDto
  ): Promise<void> {
    if (isDemoServer(serverUrl)) {
      demoDisplayPrefs.set(displayPreferencesId, prefs);
      return;
    }
    const query = new URLSearchParams({ userId, client: CLIENT_DISPLAY_NAME });
    try {
      await apiRequest(
        serverUrl,
        `/DisplayPreferences/${encodeURIComponent(displayPreferencesId)}?${query.toString()}`,
        {
          method: 'POST',
          token,
          body: {
            Id: displayPreferencesId,
            Client: CLIENT_DISPLAY_NAME,
            ...prefs,
          },
        }
      );
    } catch {
      // Non-critical server UI sync
    }
  },

  async updateUserPassword(
    serverUrl: string,
    token: string,
    userId: string,
    currentPw: string,
    newPw: string
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, `/Users/Password?userId=${encodeURIComponent(userId)}`, {
      method: 'POST',
      token,
      body: { CurrentPw: currentPw, NewPw: newPw },
    });
  },

  async getBrandingConfiguration(serverUrl: string): Promise<BrandingOptionsDto | null> {
    if (isDemoServer(serverUrl)) return null;
    try {
      return await apiRequest<BrandingOptionsDto>(serverUrl, '/Branding/Configuration', {
        timeoutMs: 5000,
      });
    } catch {
      return null;
    }
  },

  async updateBrandingConfiguration(
    serverUrl: string,
    token: string,
    branding: BrandingOptionsDto
  ): Promise<void> {
    if (isDemoServer(serverUrl)) return;
    await apiRequest(serverUrl, '/System/Configuration/Branding', {
      method: 'POST',
      token,
      body: branding,
    });
  },

  async getServerBrand(serverUrl: string): Promise<Partial<BrandConfig> | null> {
    const branding = await this.getBrandingConfiguration(serverUrl);
    return parseServerBrandFromCss(branding?.CustomCss);
  },

  async updateServerBrand(
    serverUrl: string,
    token: string,
    brand: Partial<BrandConfig> | null
  ): Promise<Partial<BrandConfig> | null> {
    if (isDemoServer(serverUrl)) return brand;
    const current = await apiRequest<BrandingOptionsDto>(serverUrl, '/Branding/Configuration', {
      token,
      timeoutMs: 5000,
    });
    const nextCss = upsertServerBrandInCss(current?.CustomCss, brand);
    await this.updateBrandingConfiguration(serverUrl, token, {
      LoginDisclaimer: current?.LoginDisclaimer ?? '',
      CustomCss: nextCss,
      SplashscreenEnabled: current?.SplashscreenEnabled ?? true,
    });
    return parseServerBrandFromCss(nextCss);
  },

  async measureBitrateMbps(
    serverUrl: string,
    token: string,
    byteSize = 2_000_000
  ): Promise<number> {
    if (isDemoServer(serverUrl)) return 48.5;
    const base = normalizeServerUrl(serverUrl);
    const start = performance.now();
    const res = await fetch(`${base}/Playback/BitrateTest?size=${byteSize}`, {
      headers: { Authorization: buildAuthHeader(token) },
    });
    if (!res.ok) throw new Error(`Bitrate test failed (${res.status})`);
    const buf = await res.arrayBuffer();
    const elapsedSeconds = Math.max(0.01, (performance.now() - start) / 1000);
    return Number((((buf.byteLength || byteSize) * 8) / elapsedSeconds / 1_000_000).toFixed(1));
  },

  getCollectionItemsDemoPool(): BaseItemDto[] {
    return Array.from(demoCollections.entries()).map(([id, col]) =>
      applyDemoOverrides({
        Id: id,
        Name: col.name,
        Type: 'BoxSet',
        ChildCount: col.itemIds.length,
      })
    );
  },
};
