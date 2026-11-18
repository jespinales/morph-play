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
