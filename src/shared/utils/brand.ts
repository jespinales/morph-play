import { BrandConfig, DEFAULT_BRAND_CONFIG } from '../types/jellyfin';
import { isSafeLogoUrl, normalizeServerUrl } from './url';

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

const BRAND_MARKER_REGEX = /\/\*\s*morphplay-brand:(\{[\s\S]*?\})\s*\*\//;
const BRAND_MARKER_GLOBAL_REGEX = /\/\*\s*morphplay-brand:\{[\s\S]*?\}\s*\*\/\s*/g;

/**
 * Extracts MorphPlay app name and logo URL stored inside Jellyfin server CustomCss.
 */
export function parseServerBrandFromCss(customCss?: string | null): Partial<BrandConfig> | null {
  if (!customCss) return null;
  const match = customCss.match(BRAND_MARKER_REGEX);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]) as { appName?: unknown; logoUrl?: unknown };
    const result: Partial<BrandConfig> = {};
    if (typeof parsed.appName === 'string' && parsed.appName.trim()) {
      result.appName = parsed.appName.trim();
    }
    if (typeof parsed.logoUrl === 'string') {
      const trimmed = parsed.logoUrl.trim();
      if (trimmed === '') {
        result.logoUrl = '';
      } else if (isSafeLogoUrl(trimmed)) {
        result.logoUrl = trimmed;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

/**
 * Inserts, updates, or removes the MorphPlay branding metadata comment inside server CustomCss
 * without altering any unrelated administrator CSS rules.
 */
export function upsertServerBrandInCss(
  existingCss: string | undefined | null,
  brand: Partial<BrandConfig> | null
): string {
  const cleaned = (existingCss ?? '').replace(BRAND_MARKER_GLOBAL_REGEX, '').trim();
  if (!brand) return cleaned;

  const payload: { appName?: string; logoUrl?: string } = {};
  if (brand.appName?.trim()) {
    payload.appName = brand.appName.trim();
  }
  if (brand.logoUrl !== undefined) {
    const trimmedLogo = brand.logoUrl.trim();
    if (trimmedLogo === '') {
      payload.logoUrl = '';
    } else if (isSafeLogoUrl(trimmedLogo)) {
      payload.logoUrl = trimmedLogo;
    }
  }

  if (Object.keys(payload).length === 0) return cleaned;

  const serialized = JSON.stringify(payload).replace(/\*\//g, '*\\/');
  const comment = `/* morphplay-brand:${serialized} */`;
  return cleaned ? `${cleaned}\n${comment}` : comment;
}
