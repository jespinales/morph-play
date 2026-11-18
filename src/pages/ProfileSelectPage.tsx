import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  PlusCircle,
  RefreshCw,
  Server,
  User as UserIcon,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';
import { UserDto } from '../types/jellyfin';
import { getUserAvatarUrl, jellyfinApi } from '../services/jellyfinApi';

export const ProfileSelectPage: React.FC = () => {
  const {
    serverUrl,
    serverInfo,
    isEnvServerLocked,
    isDemo,
    savedProfiles,
    brand,
    t,
    loginWithCredentials,
    loginWithSavedProfile,
    removeSavedProfile,
    disconnectServer,
  } = useAuth();

  const [publicUsers, setPublicUsers] = useState<UserDto[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadPublicUsers = async () => {
    if (!serverUrl) return;
    setLoadingUsers(true);
    setFetchError(null);
    try {
      const users = await jellyfinApi.getPublicUsers(serverUrl);
      setPublicUsers(users);
      // Only open manual sign-in automatically when no local profiles are remembered
      if (users.length === 0 && savedProfiles.length === 0) {
        setManualModalOpen(true);
      }
    } catch {
      setFetchError(t.profiles.fetchError);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadPublicUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl]);

  const savedProfileMap = useMemo(() => {
    const map = new Map<string, (typeof savedProfiles)[number]>();
    savedProfiles.forEach((entry) => map.set(entry.user.Id, entry));
    return map;
  }, [savedProfiles]);

  const displayedProfiles = useMemo(() => {
    const merged = new Map<string, UserDto>();
    savedProfiles.forEach((entry) => merged.set(entry.user.Id, entry.user));
    publicUsers.forEach((pubUser) => {
      if (!merged.has(pubUser.Id)) {
        merged.set(pubUser.Id, pubUser);
      }
    });
    return Array.from(merged.values());
  }, [savedProfiles, publicUsers]);

  const handleProfileClick = async (profile: UserDto) => {
    setAuthError(null);
    setPassword('');

    const savedEntry = savedProfileMap.get(profile.Id);
    if (savedEntry?.accessToken) {
      setAuthLoading(true);
      try {
        const loggedIn = await loginWithSavedProfile(profile.Id);
        if (loggedIn) return;
      } finally {
        setAuthLoading(false);
      }
    }

    const needsPassword = Boolean(profile.HasPassword || profile.HasConfiguredPassword);

    if (!needsPassword) {
      setAuthLoading(true);
      try {
        await loginWithCredentials(profile.Name, '');
      } catch {
        // Open password modal if the server still requires credentials despite HasPassword=false
        setSelectedUser(profile);
        setUsername(profile.Name);
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    setSelectedUser(profile);
    setUsername(profile.Name);
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = selectedUser?.Name ?? username.trim();
    if (!targetUser) {
      setAuthError(t.profiles.emptyUsernameError);
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    try {
      await loginWithCredentials(targetUser, password);
    } catch {
      setAuthError(t.profiles.invalidCredentials);
    } finally {
      setAuthLoading(false);
    }
  };

  const closeModals = () => {
    setSelectedUser(null);
    setManualModalOpen(false);
    setPassword('');
    setAuthError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0e] relative flex flex-col justify-between px-4 sm:px-8 py-8">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4">
        <BrandLogo iconSize={32} />

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300">
            <Server className="w-3.5 h-3.5 text-[#00A4DC]" />
            <span>{serverInfo?.ServerName ?? serverUrl}</span>
            {isDemo && <span className="text-[#7dd3fc] font-semibold">· {t.common.demoShort}</span>}
          </div>

          <LanguageSwitcher compact />

          {!isEnvServerLocked && (
            <button
              type="button"
              onClick={disconnectServer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm text-zinc-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.profiles.changeServer}
            </button>
          )}
        </div>
      </header>

      {/* Center profile selector */}
      <main className="max-w-4xl w-full mx-auto my-auto py-12 text-center space-y-10 animate-fadeIn">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {t.profiles.whoIsWatching}
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">{t.profiles.subtitle}</p>
        </div>

        {loadingUsers && displayedProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-10 h-10 text-[#00A4DC] animate-spin" />
            <p className="text-sm text-zinc-400">{t.profiles.loadingProfiles}</p>
          </div>
        ) : fetchError && displayedProfiles.length === 0 ? (
          <div className="max-w-md mx-auto rounded-2xl bg-[#12131a] border border-rose-500/30 p-6 space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-sm text-zinc-300">{fetchError}</p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={loadPublicUsers}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-semibold text-white"
              >
                <RefreshCw className="w-4 h-4" />
                {t.profiles.retry}
              </button>
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-sm font-semibold text-white"
              >
                {t.profiles.manualLogin}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-9">
            {displayedProfiles.map((profile) => {
              const avatar = getUserAvatarUrl(serverUrl, profile);
              const savedEntry = savedProfileMap.get(profile.Id);
              const isSavedLocally = Boolean(savedEntry);
              const hasLock =
                !savedEntry?.accessToken &&
                Boolean(profile.HasPassword || profile.HasConfiguredPassword);

              return (
                <div key={profile.Id} className="group relative w-28 sm:w-36 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => handleProfileClick(profile)}
                    disabled={authLoading}
                    className="flex flex-col items-center gap-3 w-full focus:outline-none"
                  >
                    <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-[#181a24] ring-2 ring-transparent group-hover:ring-white group-focus-visible:ring-[#00A4DC] transition-all duration-200 [@media(hover:hover)]:group-hover:scale-105 shadow-2xl">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={profile.Name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#AA5CC3]/80 to-[#00A4DC]/80 flex items-center justify-center text-3xl sm:text-4xl font-black text-white">
                          {profile.Name[0]?.toUpperCase()}
                        </div>
                      )}

                      {hasLock && (
                        <span
                          title={t.profiles.requiresPassword}
                          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/75 backdrop-blur-sm border border-white/15 flex items-center justify-center text-zinc-200"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    <span className="text-sm sm:text-base font-medium text-zinc-300 group-hover:text-white transition-colors truncate w-full">
                      {profile.Name}
                    </span>
                  </button>

                  {isSavedLocally && (
                    <button
                      type="button"
                      onClick={() => removeSavedProfile(profile.Id)}
                      aria-label={t.profiles.forgetProfileAria(profile.Name)}
                      title={t.profiles.forgetProfileTitle}
                      className="absolute top-1.5 right-1.5 z-10 w-8 h-8 rounded-full bg-black/70 hover:bg-rose-600/90 text-white/85 hover:text-white border border-white/15 backdrop-blur-sm flex items-center justify-center opacity-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 focus-visible:opacity-100 transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Manual login option */}
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null);
                setUsername('');
                setPassword('');
                setAuthError(null);
                setManualModalOpen(true);
              }}
              className="group flex flex-col items-center gap-3 w-28 sm:w-36 focus:outline-none"
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border-2 border-dashed border-white/20 group-hover:border-white/50 flex items-center justify-center transition-all duration-200 group-hover:scale-105">
                <PlusCircle className="w-10 h-10 text-zinc-400 group-hover:text-white transition-colors" />
              </div>
              <span className="text-sm sm:text-base font-medium text-zinc-400 group-hover:text-white transition-colors">
                {t.profiles.otherAccount}
              </span>
            </button>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-zinc-500">
        {serverInfo?.Version
          ? `${brand.appName} · Jellyfin Server v${serverInfo.Version}`
          : brand.appName}
      </footer>

      {/* Password / manual sign-in modal */}
      {(selectedUser || manualModalOpen) && (
        <div
          onClick={closeModals}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#12131a] border border-white/15 p-6 shadow-2xl space-y-5 animate-scaleIn relative"
          >
            <button
              type="button"
              onClick={closeModals}
              aria-label={t.profiles.closeAria}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">
                {selectedUser ? t.profiles.helloUser(selectedUser.Name) : t.profiles.signIn}
              </h2>
              <p className="text-xs text-zinc-400">
                {selectedUser ? t.profiles.enterProfilePassword : t.profiles.enterRegisteredUser}
              </p>
            </div>

            <form onSubmit={handleCredentialSubmit} className="space-y-4">
              {!selectedUser && (
                <div className="space-y-1.5">
                  <label htmlFor="manual-user" className="text-xs font-medium text-zinc-300">
                    {t.profiles.usernameLabel}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="manual-user"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t.profiles.usernamePlaceholder}
                      autoFocus
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#0a0a0e] border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="profile-pw" className="text-xs font-medium text-zinc-300">
                  {t.profiles.passwordLabel}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="profile-pw"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.profiles.passwordPlaceholder}
                    autoFocus={Boolean(selectedUser)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#0a0a0e] border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                  />
                </div>
              </div>

              {authError && (
                <p className="text-xs text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white font-bold text-sm hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.profiles.verifying}
                  </>
                ) : (
                  t.profiles.enter
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
