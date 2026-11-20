import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEMO_ACCESS_TOKEN, DEMO_SERVER_URL } from '../../shared/api/demo/demoData';
import { isDemoServer } from '../../shared/api/demo/demoStore';
import { jellyfinApi } from '../../shared/api/jellyfin';
import { PublicSystemInfo, UserConfiguration, UserDto } from '../../shared/types/jellyfin';
import { getEnvConfiguredServerUrl } from '../../shared/utils/brand';
import {
  safeGetStorageItem,
  safeGetStorageJson,
  safeRemoveStorageItem,
  safeSetStorageItem,
  safeSetStorageJson,
} from '../../shared/utils/storage';
import { normalizeServerUrl } from '../../shared/utils/url';
import { usePreferences } from './PreferencesProvider';

const STORAGE_SERVER_KEY = 'jellyfin_server_url';
const STORAGE_TOKEN_KEY = 'jellyfin_access_token';
const STORAGE_USER_KEY = 'jellyfin_user';
const STORAGE_SAVED_PROFILES_KEY = 'jellyfin_saved_profiles';

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
  connectToServer: (url: string) => Promise<PublicSystemInfo>;
  enableDemoMode: () => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithQuickConnect: (secret: string) => Promise<void>;
  loginWithSavedProfile: (userId: string) => Promise<boolean>;
  updateUserConfig: (patch: Partial<UserConfiguration>) => Promise<void>;
  removeSavedProfile: (userId: string) => void;
  switchProfile: () => void;
  logoutSession: () => Promise<void>;
  disconnectServer: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSavedProfiles(): SavedProfile[] {
  const parsed = safeGetStorageJson<unknown>(STORAGE_SAVED_PROFILES_KEY, []);
  return Array.isArray(parsed) ? (parsed as SavedProfile[]) : [];
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setServerBrand } = usePreferences();
  const envServerUrl = getEnvConfiguredServerUrl();
  const [serverUrl, setServerUrl] = useState<string>(
    () => envServerUrl || safeGetStorageItem(STORAGE_SERVER_KEY) || ''
  );
  const [serverInfo, setServerInfo] = useState<PublicSystemInfo | null>(null);
  const [user, setUser] = useState<UserDto | null>(() =>
    safeGetStorageJson<UserDto | null>(STORAGE_USER_KEY, null)
  );
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    safeGetStorageItem(STORAGE_TOKEN_KEY)
  );
  const [allSavedProfiles, setAllSavedProfiles] = useState<SavedProfile[]>(() => loadSavedProfiles());
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
        safeSetStorageJson(STORAGE_SAVED_PROFILES_KEY, next);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const targetUrl = envServerUrl || safeGetStorageItem(STORAGE_SERVER_KEY) || '';
      if (!targetUrl) {
        if (active) setIsInitializing(false);
        return;
      }

      try {
        const [info, remoteBrand] = await Promise.all([
          jellyfinApi.getPublicSystemInfo(targetUrl),
          jellyfinApi.getServerBrand(targetUrl),
        ]);
        if (!active) return;
        setServerUrl(targetUrl);
        setServerInfo(info);
        setServerBrand(remoteBrand);
        safeSetStorageItem(STORAGE_SERVER_KEY, targetUrl);

        // Verify saved session token is still valid
        const savedToken = safeGetStorageItem(STORAGE_TOKEN_KEY);
        const savedUser = safeGetStorageJson<UserDto | null>(STORAGE_USER_KEY, null);
        if (savedToken && savedUser) {
          try {
            const refreshedUser = await jellyfinApi.getUserById(targetUrl, savedToken, savedUser.Id);
            if (!active) return;
            setUser(refreshedUser);
            setAccessToken(savedToken);
            safeSetStorageJson(STORAGE_USER_KEY, refreshedUser);
            upsertSavedProfile(targetUrl, refreshedUser, savedToken);
          } catch {
            // Token expired or invalid: keep server connected and clear active user
            if (!active) return;
            safeRemoveStorageItem(STORAGE_TOKEN_KEY);
            safeRemoveStorageItem(STORAGE_USER_KEY);
            setUser(null);
            setAccessToken(null);
          }
        }
      } catch {
        // Keep environment-configured server URL on initial boot errors so diagnostics remain possible
        if (active && !envServerUrl) {
          safeRemoveStorageItem(STORAGE_SERVER_KEY);
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
  }, [envServerUrl, upsertSavedProfile, setServerBrand]);

  const connectToServer = useCallback(async (rawUrl: string): Promise<PublicSystemInfo> => {
    const normalized = normalizeServerUrl(rawUrl);
    if (!normalized) {
      throw new Error('Please enter a valid Jellyfin server URL.');
    }
    const [info, remoteBrand] = await Promise.all([
      jellyfinApi.getPublicSystemInfo(normalized),
      jellyfinApi.getServerBrand(normalized),
    ]);
    setServerUrl(normalized);
    setServerInfo(info);
    setServerBrand(remoteBrand);
    setUser(null);
    setAccessToken(null);
    safeSetStorageItem(STORAGE_SERVER_KEY, normalized);
    safeRemoveStorageItem(STORAGE_TOKEN_KEY);
    safeRemoveStorageItem(STORAGE_USER_KEY);
    return info;
  }, [setServerBrand]);

  const enableDemoMode = useCallback(async () => {
    const info = await jellyfinApi.getPublicSystemInfo(DEMO_SERVER_URL);
    setServerUrl(DEMO_SERVER_URL);
    setServerInfo(info);
    setServerBrand(null);
    safeSetStorageItem(STORAGE_SERVER_KEY, DEMO_SERVER_URL);

    // Open profile selector in demo mode
    safeRemoveStorageItem(STORAGE_TOKEN_KEY);
    safeRemoveStorageItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const applyAuthSession = useCallback(
    (targetServerUrl: string, authUser: UserDto, rawToken: string) => {
      const token = isDemoServer(targetServerUrl) ? DEMO_ACCESS_TOKEN : rawToken;
      setUser(authUser);
      setAccessToken(token);
      safeSetStorageItem(STORAGE_TOKEN_KEY, token);
      safeSetStorageJson(STORAGE_USER_KEY, authUser);
      upsertSavedProfile(targetServerUrl, authUser, token);
    },
    [upsertSavedProfile]
  );

  const loginWithCredentials = useCallback(
    async (username: string, password: string) => {
      if (!serverUrl) {
        throw new Error('No Jellyfin server is connected.');
      }
      const auth = await jellyfinApi.authenticateByName(serverUrl, username, password);
      applyAuthSession(serverUrl, auth.User, auth.AccessToken);
    },
    [serverUrl, applyAuthSession]
  );

  const loginWithQuickConnect = useCallback(
    async (secret: string) => {
      if (!serverUrl) {
        throw new Error('No Jellyfin server is connected.');
      }
      const auth = await jellyfinApi.authenticateWithQuickConnect(serverUrl, secret);
      applyAuthSession(serverUrl, auth.User, auth.AccessToken);
    },
    [serverUrl, applyAuthSession]
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
        applyAuthSession(serverUrl, refreshedUser, entry.accessToken);
        return true;
      } catch {
        // Token expired or revoked: keep profile card without token so password can be prompted
        setAllSavedProfiles((prev) => {
          const next = prev.map((p) =>
            p.serverUrl === serverUrl && p.user.Id === userId ? { ...p, accessToken: '' } : p
          );
          safeSetStorageJson(STORAGE_SAVED_PROFILES_KEY, next);
          return next;
        });
        return false;
      }
    },
    [serverUrl, allSavedProfiles, applyAuthSession]
  );

  const updateUserConfig = useCallback(
    async (patch: Partial<UserConfiguration>) => {
      if (!serverUrl || !accessToken || !user) return;
      const mergedConfig: UserConfiguration = {
        ...user.Configuration,
        ...patch,
      };
      const updatedUser: UserDto = {
        ...user,
        Configuration: mergedConfig,
      };
      setUser(updatedUser);
      safeSetStorageJson(STORAGE_USER_KEY, updatedUser);
      upsertSavedProfile(serverUrl, updatedUser, accessToken);
      try {
        await jellyfinApi.updateUserConfiguration(serverUrl, accessToken, user.Id, mergedConfig);
      } catch {
        // Ignore network errors while persisting server configuration
      }
    },
    [serverUrl, accessToken, user, upsertSavedProfile]
  );

  const removeSavedProfile = useCallback(
    (userId: string) => {
      if (!serverUrl) return;
      const removed = allSavedProfiles.find(
        (p) => p.serverUrl === serverUrl && p.user.Id === userId
      );
      if (removed?.accessToken) {
        void jellyfinApi.logout(serverUrl, removed.accessToken).catch(() => {});
      }
      setAllSavedProfiles((prev) => {
        const next = prev.filter((p) => !(p.serverUrl === serverUrl && p.user.Id === userId));
        safeSetStorageJson(STORAGE_SAVED_PROFILES_KEY, next);
        return next;
      });
    },
    [serverUrl, allSavedProfiles]
  );

  const switchProfile = useCallback(() => {
    safeRemoveStorageItem(STORAGE_TOKEN_KEY);
    safeRemoveStorageItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  const logoutSession = useCallback(async () => {
    const activeToken = accessToken;
    const activeUserId = user?.Id;
    if (serverUrl && activeToken) {
      await jellyfinApi.logout(serverUrl, activeToken).catch(() => {});
    }
    if (serverUrl && activeUserId) {
      setAllSavedProfiles((prev) => {
        const next = prev.map((p) =>
          p.serverUrl === serverUrl && p.user.Id === activeUserId ? { ...p, accessToken: '' } : p
        );
        safeSetStorageJson(STORAGE_SAVED_PROFILES_KEY, next);
        return next;
      });
    }
    safeRemoveStorageItem(STORAGE_TOKEN_KEY);
    safeRemoveStorageItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
  }, [serverUrl, accessToken, user?.Id]);

  const disconnectServer = useCallback(() => {
    if (serverUrl && accessToken) {
      void jellyfinApi.logout(serverUrl, accessToken).catch(() => {});
    }
    safeRemoveStorageItem(STORAGE_TOKEN_KEY);
    safeRemoveStorageItem(STORAGE_USER_KEY);
    setUser(null);
    setAccessToken(null);
    if (!isEnvServerLocked) {
      safeRemoveStorageItem(STORAGE_SERVER_KEY);
      setServerUrl('');
      setServerInfo(null);
      setServerBrand(null);
    }
  }, [serverUrl, accessToken, isEnvServerLocked, setServerBrand]);

  const savedProfiles = useMemo(
    () => allSavedProfiles.filter((entry) => entry.serverUrl === serverUrl),
    [allSavedProfiles, serverUrl]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      serverUrl,
      isEnvServerLocked,
      serverInfo,
      user,
      accessToken,
      savedProfiles,
      isAuthenticated: Boolean(serverUrl && user && accessToken),
      isDemo: isDemoServer(serverUrl),
      isInitializing,
      connectToServer,
      enableDemoMode,
      loginWithCredentials,
      loginWithQuickConnect,
      loginWithSavedProfile,
      updateUserConfig,
      removeSavedProfile,
      switchProfile,
      logoutSession,
      disconnectServer,
    }),
    [
      serverUrl,
      isEnvServerLocked,
      serverInfo,
      user,
      accessToken,
      savedProfiles,
      isInitializing,
      connectToServer,
      enableDemoMode,
      loginWithCredentials,
      loginWithQuickConnect,
      loginWithSavedProfile,
      updateUserConfig,
      removeSavedProfile,
      switchProfile,
      logoutSession,
      disconnectServer,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return ctx;
}
