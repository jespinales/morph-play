import { BaseItemDto } from '../../types/jellyfin';
import { DEMO_SERVER_URL } from './demoData';

export const demoFavoriteOverrides = new Map<string, boolean>();
export const demoPlayedOverrides = new Map<string, boolean>();
export const demoProgressOverrides = new Map<string, number>();
export const demoRemovedNextUp = new Set<string>();
export const demoPlaylists = new Map<string, { name: string; itemIds: string[] }>();

export function isDemoServer(serverUrl: string | null | undefined): boolean {
  return serverUrl === DEMO_SERVER_URL;
}

export function applyDemoOverrides(item: BaseItemDto): BaseItemDto {
  const fav = demoFavoriteOverrides.get(item.Id);
  const played = demoPlayedOverrides.get(item.Id);
  const pos = demoProgressOverrides.get(item.Id);
  if (fav === undefined && played === undefined && pos === undefined) {
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
      Played: played ?? item.UserData?.Played ?? false,
      PlaybackPositionTicks: newTicks,
      PlayedPercentage: percentage,
    },
  };
}
