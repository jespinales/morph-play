import { BaseItemDto, DisplayPreferencesDto } from '../../types/jellyfin';
import { DEMO_SERVER_URL } from './demoData';

export const demoFavoriteOverrides = new Map<string, boolean>();
export const demoPlayedOverrides = new Map<string, boolean>();
export const demoLikesOverrides = new Map<string, boolean | undefined>();
export const demoProgressOverrides = new Map<string, number>();
export const demoRemovedNextUp = new Set<string>();
export const demoPlaylists = new Map<
  string,
  { name: string; itemIds: string[]; openAccess?: boolean }
>();
export const demoCollections = new Map<string, { name: string; itemIds: string[] }>();
export const demoDisplayPrefs = new Map<string, DisplayPreferencesDto>();

export function isDemoServer(serverUrl: string | null | undefined): boolean {
  return serverUrl === DEMO_SERVER_URL;
}

export function applyDemoOverrides(item: BaseItemDto): BaseItemDto {
  const fav = demoFavoriteOverrides.get(item.Id);
  const played = demoPlayedOverrides.get(item.Id);
  const hasLike = demoLikesOverrides.has(item.Id);
  const likes = hasLike ? demoLikesOverrides.get(item.Id) : item.UserData?.Likes;
  const pos = demoProgressOverrides.get(item.Id);
  if (fav === undefined && played === undefined && !hasLike && pos === undefined) {
    return item;
  }

  const duration = item.RunTimeTicks ?? 0;
  const newTicks = pos !== undefined ? pos : (item.UserData?.PlaybackPositionTicks ?? 0);
  const percentage =
    duration > 0 && newTicks > 0
      ? Math.min(100, Math.round((newTicks / duration) * 100))
      : item.UserData?.PlayedPercentage;

  return {
    ...item,
    UserData: {
      ...item.UserData,
      IsFavorite: fav ?? item.UserData?.IsFavorite ?? false,
      Likes: likes,
      Played: played ?? item.UserData?.Played ?? false,
      PlaybackPositionTicks: newTicks,
      PlayedPercentage: percentage,
    },
  };
}
