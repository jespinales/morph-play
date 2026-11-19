import { BaseItemDto, TrickplayInfoDto } from '../types/jellyfin';
import { normalizeServerUrl } from './url';

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
  timeSeconds: number,
  isDemo = false
): TrickplayFrame | null {
  if (isDemo) return null;
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
    api_key: token,
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
