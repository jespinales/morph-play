export const DEMO_SERVER_PROTOCOL_URL = 'demo://jellyfin.local';

/**
 * Normalizes a user-entered server URL (adds http:// when missing and strips trailing slashes).
 */
export function normalizeServerUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed === DEMO_SERVER_PROTOCOL_URL) return DEMO_SERVER_PROTOCOL_URL;
  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `http://${withProtocol}`;
  }
  return withProtocol.replace(/\/+$/, '');
}

/**
 * Validates that a custom logo URL uses an allowed relative path, http(s) origin, or image data URI.
 */
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
