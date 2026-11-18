import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BrandConfig,
  DEFAULT_BRAND_CONFIG,
  DEFAULT_USER_PREFERENCES,
  PublicSystemInfo,
  UserDto,
  UserPreferences,
} from '../types/jellyfin';
import {
  getEnvConfiguredBrand,
  getEnvConfiguredServerUrl,
  isDemoServer,
  isSafeLogoUrl,
  jellyfinApi,
  normalizeServerUrl,
} from '../services/jellyfinApi';
import { DEMO_ACCESS_TOKEN, DEMO_SERVER_URL } from '../services/demoData';

const STORAGE_SERVER_KEY = 'jellyfin_server_url';
const STORAGE_TOKEN_KEY = 'jellyfin_access_token';
const STORAGE_USER_KEY = 'jellyfin_user';
const STORAGE_PREFS_KEY = 'jellyfin_user_preferences';
const STORAGE_SAVED_PROFILES_KEY = 'jellyfin_saved_profiles';
const STORAGE_BRAND_KEY = 'morphplay_brand_override';

export interface SavedProfile {
  serverUrl: string;
  user: UserDto;
  accessToken: string;
  lastUsedAt: number;
}

interface AuthContextValue {
  serverUrl: string;
  isEnvServerLocked: boolean;
  serverInfo: PublicSystemInfo | null;
  user: UserDto | null;
  accessToken: string | null;
  savedProfiles: SavedProfile[];
  isAuthenticated: boolean;
  isDemo: boolean;
  isInitializing: boolean;
  preferences: UserPreferences;
  brand: BrandConfig;
  brandOverride: Partial<BrandConfig>;
  connectToServer: (url: string) => Promise<PublicSystemInfo>;
  enableDemoMode: () => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithSavedProfile: (userId: string) => Promise<boolean>;
  removeSavedProfile: (userId: string) => void;
  switchProfile: () => void;
  disconnectServer: () => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  updateBrand: (patch: Partial<BrandConfig>) => void;
  resetBrand: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): UserDto | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? (JSON.parse(raw) as UserDto) : null;
  } catch {
    return null;
  }
}

function loadStoredPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    return { ...DEFAULT_USER_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

function loadSavedProfiles(): SavedProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_SAVED_PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedProfile[]) : [];
  } catch {
    return [];
  }
}

function loadBrandOverride(): Partial<BrandConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_BRAND_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<BrandConfig>;
  } catch {
    return {};
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const envServerUrl = getEnvConfiguredServerUrl();
  const envBrand = getEnvConfiguredBrand();
  const [serverUrl, setServerUrl] = useState<string>(() => {
    return envServerUrl || localStorage.getItem(STORAGE_SERVER_KEY) || '';
  });
  const [serverInfo, setServerInfo] = useState<PublicSystemInfo | null>(null);
  const [user, setUser] = useState<UserDto | null>(() => loadStoredUser());
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem(STORAGE_TOKEN_KEY)
  );
  const [allSavedProfiles, setAllSavedProfiles] = useState<SavedProfile[]>(() => loadSavedProfiles());
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadStoredPreferences());
  const [brandOverride, setBrandOverride] = useState<Partial<BrandConfig>>(() => loadBrandOverride());
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const isEnvServerLocked = Boolean(envServerUrl);

  const upsertSavedProfile = useCallback(
    (targetServerUrl: string, profileUser: UserDto, token: string) => {
      setAllSavedProfiles((prev) => {
        const filtered = prev.filter(
          (p) => !(p.serverUrl === targetServerUrl && p.user.Id === profileUser.Id)
        );
        const next: SavedProfile[] = [
          { serverUrl: targetServerUrl, user: profileUser, accessToken: token, lastUsedAt: Date.now() },
          ...filtered,
        ];
        localStorage.setItem(STORAGE_SAVED_PROFILES_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const targetUrl = envServerUrl || localStorage.getItem(STORAGE_SERVER_KEY) || '';
      if (!targetUrl) {
        if (active) setIsInitializing(false);
        return;
      }

      try {
        const info = await jellyfinApi.getPublicSystemInfo(targetUrl);
        if (!active) return;
        setServerUrl(targetUrl);
        setServerInfo(info);
        localStorage.setItem(STORAGE_SERVER_KEY, targetUrl);

        // Verificar si la sesión guardada sigue activa
        const savedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
        const savedUser = loadStoredUser();
        if (savedToken && savedUser) {
          try {
            const refreshedUser = await jellyfinApi.getUserById(targetUrl, savedToken, savedUser.Id);
            if (!active) return;
            setUser(refreshedUser);
            setAccessToken(savedToken);
            localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(refreshedUser));
            upsertSavedProfile(targetUrl, refreshedUser, savedToken);
          } catch {
            // Token expirado o inválido -> mantener servidor conectado, limpiar usuario
            if (!active) return;
            localStorage.removeItem(STORAGE_TOKEN_KEY);
            localStorage.removeItem(STORAGE_USER_KEY);
            setUser(null);
            setAccessToken(null);
          }
        }
      } catch {
        // Si la URL preconfigurada por entorno falla en primer arranque, conservar la URL pero permitir diagnóstico
        if (active && !envServerUrl) {
          localStorage.removeItem(STORAGE_SERVER_KEY);
          setServerUrl('');
        }
      } finally {
        if (active) setIsInitializing(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [envServerUrl, upsertSavedProfile]);

  const connectToServer = useCallback(async (rawUrl: string): Promise<PublicSystemInfo> => {
    const normalized = normalizeServerUrl(rawUrl);
    if (!normalized) {
      throw new Error('Introduce una dirección URL válida del servidor Jellyfin.');
    }
    const info = await jellyfinApi.getPublicSystemInfo(normalized);
    setServerUrl(normalized);
    setServerInfo(info);
    setUser(null);
    setAccessToken(null);
    localStorage.setItem(STORAGE_SERVER_KEY, normalized);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    return info;
  }, []);

  const enableDemoMode = useCallback(async () => {
    const info = await jellyfinApi.getPublicSystemInfo(DEMO_SERVER_URL);
    setServerUrl(DEMO_SERVER_URL);
    setServerInfo(info);
    localStorage.setItem(STORAGE_SERVER_KEY, DEMO_SERVER_URL);

    // Entrar al selector de perfiles en modo demo
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const loginWithCredentials = useCallback(
    async (username: string, password: string) => {
      if (!serverUrl) {
        throw new Error('No hay ningún servidor Jellyfin conectado.');
      }
      const auth = await jellyfinApi.authenticateByName(serverUrl, username, password);
      const token = isDemoServer(serverUrl) ? DEMO_ACCESS_TOKEN : auth.AccessToken;
      setUser(auth.User);
      setAccessToken(token);
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(auth.User));
      upsertSavedProfile(serverUrl, auth.User, token);
    },
    [serverUrl, upsertSavedProfile]
  );

  const loginWithSavedProfile = useCallback(
    async (userId: string): Promise<boolean> => {
      if (!serverUrl) return false;
      const entry = allSavedProfiles.find(
        (p) => p.serverUrl === serverUrl && p.user.Id === userId
      );
      if (!entry || !entry.accessToken) return false;

      try {
        const refreshedUser = await jellyfinApi.getUserById(
          serverUrl,
          entry.accessToken,
          entry.user.Id
        );
        setUser(refreshedUser);
        setAccessToken(entry.accessToken);
        localStorage.setItem(STORAGE_TOKEN_KEY, entry.accessToken);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(refreshedUser));
        upsertSavedProfile(serverUrl, refreshedUser, entry.accessToken);
        return true;
      } catch {
        // Token expirado o revocado: conservar perfil en la lista sin token para pedir contraseña
        setAllSavedProfiles((prev) => {
          const next = prev.map((p) =>
            p.serverUrl === serverUrl && p.user.Id === userId ? { ...p, accessToken: '' } : p
          );
          localStorage.setItem(STORAGE_SAVED_PROFILES_KEY, JSON.stringify(next));
          return next;
        });
        return false;
      }
    },
    [serverUrl, allSavedProfiles, upsertSavedProfile]
  );

  const removeSavedProfile = useCallback(
    (userId: string) => {
      if (!serverUrl) return;
      setAllSavedProfiles((prev) => {
        const next = prev.filter((p) => !(p.serverUrl === serverUrl && p.user.Id === userId));
        localStorage.setItem(STORAGE_SAVED_PROFILES_KEY, JSON.stringify(next));
        return next;
      });
    },
    [serverUrl]
  );

  const switchProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const disconnectServer = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
    if (!isEnvServerLocked) {
      localStorage.removeItem(STORAGE_SERVER_KEY);
      setServerUrl('');
      setServerInfo(null);
    }
  }, [isEnvServerLocked]);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateBrand = useCallback((patch: Partial<BrandConfig>) => {
    setBrandOverride((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_BRAND_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetBrand = useCallback(() => {
    localStorage.removeItem(STORAGE_BRAND_KEY);
    setBrandOverride({});
  }, []);

  const brand = useMemo<BrandConfig>(() => {
    const customName = brandOverride.appName?.trim();
    const customLogo =
      brandOverride.logoUrl !== undefined ? brandOverride.logoUrl.trim() : undefined;
    const resolvedLogo =
      customLogo !== undefined
        ? isSafeLogoUrl(customLogo)
          ? customLogo
          : ''
        : envBrand.logoUrl;

    return {
      appName: customName || envBrand.appName || DEFAULT_BRAND_CONFIG.appName,
      logoUrl: resolvedLogo,
    };
  }, [brandOverride, envBrand]);

  // Sincronizar título de la pestaña y favicon con la marca activa
  useEffect(() => {
    document.title = brand.appName;
    const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (iconLink) {
      iconLink.href = brand.logoUrl || '/favicon.svg';
    }
  }, [brand.appName, brand.logoUrl]);

  const savedProfiles = allSavedProfiles.filter((entry) => entry.serverUrl === serverUrl);

  return (
    <AuthContext.Provider
      value={{
        serverUrl,
        isEnvServerLocked,
        serverInfo,
        user,
        accessToken,
        savedProfiles,
        isAuthenticated: Boolean(serverUrl && user && accessToken),
        isDemo: isDemoServer(serverUrl),
        isInitializing,
        preferences,
        brand,
        brandOverride,
        connectToServer,
        enableDemoMode,
        loginWithCredentials,
        loginWithSavedProfile,
        removeSavedProfile,
        switchProfile,
        disconnectServer,
        updatePreferences,
        updateBrand,
        resetBrand,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  }
  return ctx;
}
