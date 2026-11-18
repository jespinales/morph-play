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
  Bitrate?: number;
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
  HasSegments?: boolean;
}

export interface UserItemDataDto {
  PlaybackPositionTicks?: number;
  PlayCount?: number;
  IsFavorite?: boolean;
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

export type StreamingQuality = 'auto' | '1080p' | '720p' | '480p';

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
