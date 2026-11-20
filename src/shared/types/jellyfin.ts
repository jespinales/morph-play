export interface RuntimeEnvConfig {
  JELLYFIN_SERVER_URL?: string;
  APP_NAME?: string;
  APP_LOGO_URL?: string;
}

export interface BrandConfig {
  appName: string;
  logoUrl: string;
}

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  appName: 'MorphPlay',
  logoUrl: '',
};

declare global {
  interface Window {
    __ENV__?: RuntimeEnvConfig;
  }
}

export interface PublicSystemInfo {
  LocalAddress?: string;
  ServerName: string;
  Version: string;
  ProductName?: string;
  OperatingSystem?: string;
  Id: string;
  StartupWizardCompleted?: boolean;
}

export interface UserPolicy {
  IsAdministrator?: boolean;
  IsHidden?: boolean;
  IsDisabled?: boolean;
}

export interface UserConfiguration {
  AudioLanguagePreference?: string;
  SubtitleLanguagePreference?: string;
  PlayDefaultAudioTrack?: boolean;
  SubtitleMode?: string;
  EnableNextEpisodeAutoPlay?: boolean;
  [key: string]: unknown;
}

export interface QuickConnectResult {
  Secret: string;
  Code: string;
  Authenticated?: boolean;
  DateAdded?: string;
}

export interface SessionInfoDto {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  ApplicationVersion?: string;
  SupportsRemoteControl?: boolean;
  IsActive?: boolean;
  NowPlayingItem?: BaseItemDto;
  PlayState?: {
    PositionTicks?: number;
    IsPaused?: boolean;
  };
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  HasPassword?: boolean;
  HasConfiguredPassword?: boolean;
  PrimaryImageTag?: string;
  Policy?: UserPolicy;
  Configuration?: UserConfiguration;
}

export interface AuthenticationResult {
  User: UserDto;
  AccessToken: string;
  ServerId: string;
}

export type MediaStreamType = 'Video' | 'Audio' | 'Subtitle' | 'EmbeddedImage' | 'Data' | 'Lyric';

export interface MediaStream {
  Codec?: string;
  Language?: string;
  Title?: string;
  DisplayTitle?: string;
  Type: MediaStreamType;
  Index: number;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  SupportsExternalStream?: boolean;
  DeliveryMethod?: string;
  DeliveryUrl?: string;
  Width?: number;
  Height?: number;
  VideoRangeType?: string;
  BitRate?: number;
  Channels?: number;
}

export interface MediaAttachment {
  Codec?: string;
  CodecTag?: string;
  Comment?: string;
  Index: number;
  FileName?: string;
  MimeType?: string;
  DeliveryUrl?: string;
}

export interface MediaSourceInfo {
  Protocol?: string;
  Id: string;
  Path?: string;
  Type?: string;
  Container?: string;
  Size?: number;
  Name?: string;
  RunTimeTicks?: number;
  SupportsTranscoding?: boolean;
  SupportsDirectStream?: boolean;
  SupportsDirectPlay?: boolean;
  TranscodingUrl?: string;
  MediaStreams?: MediaStream[];
  MediaAttachments?: MediaAttachment[];
  Bitrate?: number;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
  HasSegments?: boolean;
}

export interface UserItemDataDto {
  PlaybackPositionTicks?: number;
  PlayCount?: number;
  IsFavorite?: boolean;
  Likes?: boolean;
  Played?: boolean;
  PlayedPercentage?: number;
  UnplayedItemCount?: number;
  Key?: string;
  LastPlayedDate?: string;
}

export interface BaseItemPerson {
  Name: string;
  Id: string;
  Role?: string;
  Type?: string;
  PrimaryImageTag?: string;
}

export interface ChapterInfo {
  StartPositionTicks?: number;
  Name?: string;
  ImageTag?: string;
}

export interface NameGuidPair {
  Name: string;
  Id: string;
}

export type BaseItemKind =
  | 'Movie'
  | 'Series'
  | 'Season'
  | 'Episode'
  | 'BoxSet'
  | 'Playlist'
  | 'Person'
  | 'Trailer'
  | 'Video'
  | 'CollectionFolder'
  | 'Folder'
  | string;

export interface TrickplayInfoDto {
  Width: number;
  Height: number;
  TileWidth: number;
  TileHeight: number;
  ThumbnailCount: number;
  Interval: number;
  Bandwidth?: number;
}

export interface RemoteTrailerDto {
  Name?: string;
  Url?: string;
}

export interface BaseItemDto {
  Id: string;
  Name: string;
  OriginalTitle?: string;
  ServerId?: string;
  Type: BaseItemKind;
  Overview?: string;
  Taglines?: string[];
  ProductionYear?: number;
  PremiereDate?: string;
  CommunityRating?: number;
  CriticRating?: number;
  OfficialRating?: string;
  RunTimeTicks?: number;
  Genres?: string[];
  People?: BaseItemPerson[];
  Studios?: NameGuidPair[];
  ImageTags?: {
    Primary?: string;
    Logo?: string;
    Thumb?: string;
    Banner?: string;
    Art?: string;
  };
  BackdropImageTags?: string[];
  ParentBackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  ParentLogoImageTag?: string;
  ParentLogoItemId?: string;
  SeriesName?: string;
  SeriesId?: string;
  SeasonName?: string;
  SeasonId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  UserData?: UserItemDataDto;
  MediaSources?: MediaSourceInfo[];
  MediaStreams?: MediaStream[];
  Chapters?: ChapterInfo[];
  Trickplay?: Record<string, Record<string, TrickplayInfoDto>>;
  ChildCount?: number;
  RecursiveItemCount?: number;
  CollectionType?: string;
  DateCreated?: string;
  PlaylistItemId?: string;
  RemoteTrailers?: RemoteTrailerDto[];
  CanDownload?: boolean;
  ExternalUrls?: Array<{ Name?: string; Url?: string }>;
}

export interface SearchHintDto {
  Id: string;
  ItemId?: string;
  Name: string;
  Type: BaseItemKind;
  ProductionYear?: number;
  PrimaryImageTag?: string;
  ThumbImageTag?: string;
  Series?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
}

export interface SearchHintsResult {
  SearchHints: SearchHintDto[];
  TotalRecordCount: number;
}

export interface SyncPlayGroupDto {
  GroupId: string;
  GroupName: string;
  State?: string;
  Participants?: string[];
  LastUpdatedAt?: string;
}

export interface PlaystateCommandData {
  Command?: 'Pause' | 'Unpause' | 'PlayPause' | 'Stop' | 'Seek' | 'NextTrack' | 'PreviousTrack' | string;
  SeekPositionTicks?: number;
}

export interface SyncPlayCommandData {
  GroupId?: string;
  PlaylistItemId?: string;
  When?: string;
  PositionTicks?: number;
  Command?: 'Unpause' | 'Pause' | 'Stop' | 'Seek' | string;
}

export interface ItemsResult {
  Items: BaseItemDto[];
  TotalRecordCount: number;
  StartIndex?: number;
}

export type MediaSegmentType =
  | 'Unknown'
  | 'Commercial'
  | 'Preview'
  | 'Recap'
  | 'Outro'
  | 'Intro';

export interface MediaSegmentDto {
  Id: string;
  ItemId: string;
  Type: MediaSegmentType;
  StartTicks: number;
  EndTicks: number;
}

export interface MediaSegmentQueryResult {
  Items: MediaSegmentDto[];
  TotalRecordCount: number;
}

export interface PlaybackInfoResponse {
  MediaSources: MediaSourceInfo[];
  PlaySessionId?: string;
  ErrorCode?: string;
}

export type StreamingQuality = 'auto' | '1080p' | '720p' | '480p' | '360p';

export interface UserPreferences {
  quality: StreamingQuality;
  autoPlayNextEpisode: boolean;
  autoSkipIntro: boolean;
  preferredAudioLang: string;
  preferredSubtitleLang: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  quality: 'auto',
  autoPlayNextEpisode: true,
  autoSkipIntro: false,
  preferredAudioLang: 'eng',
  preferredSubtitleLang: 'eng',
};

export interface RemoteSubtitleInfo {
  ThreeLetterISOLanguageName?: string;
  Id?: string;
  ProviderName?: string;
  Name?: string;
  Format?: string;
  Author?: string;
  Comment?: string;
  DateCreated?: string;
  CommunityRating?: number;
  FrameRate?: number;
  DownloadCount?: number;
  IsHashMatch?: boolean;
  AiTranslated?: boolean;
  MachineTranslated?: boolean;
  Forced?: boolean;
  HearingImpaired?: boolean;
}

export interface UploadSubtitleDto {
  Language: string;
  Format: string;
  IsForced: boolean;
  IsHearingImpaired?: boolean;
  Data: string;
}

export interface QueryFilters {
  Genres?: string[];
  Tags?: string[];
  AudioLanguages?: string[];
  SubtitleLanguages?: string[];
}

export interface RecommendationDto {
  Items?: BaseItemDto[];
  RecommendationType?: string;
  BaselineItemName?: string;
  CategoryId?: string;
}

export interface ExternalIdInfo {
  Name?: string;
  Key?: string;
  Type?: string;
}

export interface PlaylistUserPermissions {
  UserId: string;
  CanEdit: boolean;
}

export interface PlaylistDto {
  OpenAccess?: boolean;
  Shares?: PlaylistUserPermissions[];
  ItemIds?: string[];
}

export interface DisplayPreferencesDto {
  Id?: string;
  ViewType?: string;
  SortBy?: string;
  IndexBy?: string;
  RememberIndexing?: boolean;
  PrimaryImageHeight?: number;
  PrimaryImageWidth?: number;
  CustomPrefs?: Record<string, string | null>;
  ScrollDirection?: string;
  ShowBackdrop?: boolean;
  RememberSorting?: boolean;
  SortOrder?: 'Ascending' | 'Descending' | string;
  ShowSidebar?: boolean;
  Client?: string;
}

export interface BrandingOptionsDto {
  LoginDisclaimer?: string;
  CustomCss?: string;
  SplashscreenEnabled?: boolean;
}

export interface ThemeMediaResult {
  Items?: BaseItemDto[];
  TotalRecordCount?: number;
  OwnerId?: string;
}

export interface AllThemeMediaResult {
  ThemeVideosResult?: ThemeMediaResult;
  ThemeSongsResult?: ThemeMediaResult;
  SoundtrackSongsResult?: ThemeMediaResult;
}

export type GroupQueueMode = 'Queue' | 'QueueNext';
export type GroupRepeatMode = 'RepeatOne' | 'RepeatAll' | 'RepeatNone';
export type GroupShuffleMode = 'Sorted' | 'Shuffle';
