import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getInitialLocale,
  Locale,
  STORAGE_LOCALE_KEY,
  TranslationDictionary,
  translations,
} from '../../shared/i18n/translations';
import {
  BrandConfig,
  DEFAULT_BRAND_CONFIG,
  DEFAULT_USER_PREFERENCES,
  UserPreferences,
} from '../../shared/types/jellyfin';
import { getEnvConfiguredBrand } from '../../shared/utils/brand';
import {
  safeGetStorageJson,
  safeRemoveStorageItem,
  safeSetStorageItem,
  safeSetStorageJson,
} from '../../shared/utils/storage';
import { isSafeLogoUrl } from '../../shared/utils/url';

const STORAGE_PREFS_KEY = 'jellyfin_user_preferences';
const STORAGE_BRAND_KEY = 'morphplay_brand_override';

interface PreferencesContextValue {
  preferences: UserPreferences;
  brand: BrandConfig;
  serverBrand: Partial<BrandConfig> | null;
  brandOverride: Partial<BrandConfig>;
  locale: Locale;
  t: TranslationDictionary;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  setServerBrand: (brand: Partial<BrandConfig> | null) => void;
  updateBrand: (patch: Partial<BrandConfig>) => void;
  resetBrand: () => void;
  setLocale: (next: Locale) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function loadStoredPreferences(): UserPreferences {
  const localeDefaultLang = getInitialLocale() === 'es' ? 'spa' : 'eng';
  const baseDefaults: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    preferredAudioLang: localeDefaultLang,
    preferredSubtitleLang: localeDefaultLang,
  };
  const stored = safeGetStorageJson<Partial<UserPreferences> | null>(STORAGE_PREFS_KEY, null);
  return stored ? { ...baseDefaults, ...stored } : baseDefaults;
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envBrand = useMemo(() => getEnvConfiguredBrand(), []);
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadStoredPreferences());
  const [serverBrand, setServerBrand] = useState<Partial<BrandConfig> | null>(null);
  const [brandOverride, setBrandOverride] = useState<Partial<BrandConfig>>(() =>
    safeGetStorageJson<Partial<BrandConfig>>(STORAGE_BRAND_KEY, {})
  );
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      safeSetStorageJson(STORAGE_PREFS_KEY, next);
      return next;
    });
  }, []);

  const updateBrand = useCallback((patch: Partial<BrandConfig>) => {
    setBrandOverride((prev) => {
      const next = { ...prev, ...patch };
      safeSetStorageJson(STORAGE_BRAND_KEY, next);
      return next;
    });
  }, []);

  const resetBrand = useCallback(() => {
    safeRemoveStorageItem(STORAGE_BRAND_KEY);
    setBrandOverride({});
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    safeSetStorageItem(STORAGE_LOCALE_KEY, next);
  }, []);

  const brand = useMemo<BrandConfig>(() => {
    const serverName = serverBrand?.appName?.trim();
    const serverLogo =
      serverBrand?.logoUrl !== undefined ? serverBrand.logoUrl.trim() : undefined;
    const customName = brandOverride.appName?.trim();
    const customLogo =
      brandOverride.logoUrl !== undefined ? brandOverride.logoUrl.trim() : undefined;

    const resolvedLogo =
      serverLogo !== undefined
        ? isSafeLogoUrl(serverLogo)
          ? serverLogo
          : ''
        : customLogo !== undefined
          ? isSafeLogoUrl(customLogo)
            ? customLogo
            : ''
          : envBrand.logoUrl;

    return {
      appName: serverName || customName || envBrand.appName || DEFAULT_BRAND_CONFIG.appName,
      logoUrl: resolvedLogo,
    };
  }, [serverBrand, brandOverride, envBrand]);

  // Synchronize document title and favicon with active branding
  useEffect(() => {
    document.title = brand.appName;
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (iconLink) {
      iconLink.href = brand.logoUrl || '/favicon.svg';
    }
  }, [brand.appName, brand.logoUrl]);

  // Synchronize <html lang="..."> with selected interface locale
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = translations[locale];

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      brand,
      serverBrand,
      brandOverride,
      locale,
      t,
      updatePreferences,
      setServerBrand,
      updateBrand,
      resetBrand,
      setLocale,
    }),
    [
      preferences,
      brand,
      serverBrand,
      brandOverride,
      locale,
      t,
      updatePreferences,
      updateBrand,
      resetBrand,
      setLocale,
    ]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within PreferencesProvider.');
  }
  return ctx;
}
