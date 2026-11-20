import React, { useEffect, useState } from 'react';
import {
  Activity,
  Globe,
  KeyRound,
  LogOut,
  Palette,
  QrCode,
  RotateCcw,
  Server,
  Sliders,
  Users,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { jellyfinApi } from '../../shared/api/jellyfin';
import { getUserAvatarUrl } from '../../shared/api/playback';
import { BrandLogo } from '../../shared/components/BrandLogo';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { StreamingQuality, UserPreferences } from '../../shared/types/jellyfin';
import { isSafeLogoUrl } from '../../shared/utils/url';

export const ProfileSettingsPage: React.FC = () => {
  const {
    user,
    serverUrl,
    accessToken,
    serverInfo,
    isEnvServerLocked,
    isDemo,
    switchProfile,
    logoutSession,
    disconnectServer,
    updateUserConfig,
  } = useAuth();
  const {
    preferences,
    brand,
    serverBrand,
    brandOverride,
    locale,
    setLocale,
    t,
    updatePreferences,
    setServerBrand,
    updateBrand,
    resetBrand,
  } = usePreferences();

  const [qcAuthCode, setQcAuthCode] = useState('');
  const [qcAuthBusy, setQcAuthBusy] = useState(false);
  const [qcAuthStatus, setQcAuthStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [bitrateTesting, setBitrateTesting] = useState(false);
  const [bitrateSummary, setBitrateSummary] = useState<string | null>(null);
  const [bitrateError, setBitrateError] = useState(false);
  const [draftAppName, setDraftAppName] = useState(
    () => serverBrand?.appName ?? brandOverride.appName ?? ''
  );
  const [draftLogoUrl, setDraftLogoUrl] = useState(
    () => serverBrand?.logoUrl ?? brandOverride.logoUrl ?? ''
  );
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandStatus, setBrandStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setDraftAppName(serverBrand?.appName ?? brandOverride.appName ?? '');
    setDraftLogoUrl(serverBrand?.logoUrl ?? brandOverride.logoUrl ?? '');
  }, [serverBrand?.appName, serverBrand?.logoUrl, brandOverride.appName, brandOverride.logoUrl]);

  const handlePreferenceChange = (patch: Partial<UserPreferences>) => {
    updatePreferences(patch);
    const configPatch: Record<string, unknown> = {};
    if (patch.preferredAudioLang !== undefined) {
      configPatch.AudioLanguagePreference = patch.preferredAudioLang;
    }
    if (patch.preferredSubtitleLang !== undefined) {
      configPatch.SubtitleLanguagePreference =
        patch.preferredSubtitleLang === 'none' ? '' : patch.preferredSubtitleLang;
      configPatch.SubtitleMode = patch.preferredSubtitleLang === 'none' ? 'None' : 'Default';
    }
    if (patch.autoPlayNextEpisode !== undefined) {
      configPatch.EnableNextEpisodeAutoPlay = patch.autoPlayNextEpisode;
    }
    if (Object.keys(configPatch).length > 0) {
      void updateUserConfig(configPatch);
    }
  };

  const handleAuthorizeQuickConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !qcAuthCode.trim()) return;
    setQcAuthBusy(true);
    setQcAuthStatus('idle');
    try {
      const ok = await jellyfinApi.authorizeQuickConnect(serverUrl, accessToken, qcAuthCode);
      setQcAuthStatus(ok ? 'success' : 'error');
      if (ok) setQcAuthCode('');
    } catch {
      setQcAuthStatus('error');
    } finally {
      setQcAuthBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !user || !newPassword) return;
    setPasswordBusy(true);
    setPasswordStatus('idle');
    try {
      await jellyfinApi.updateUserPassword(
        serverUrl,
        accessToken,
        user.Id,
        currentPassword,
        newPassword
      );
      setPasswordStatus('success');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPasswordStatus('error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleRunBitrateTest = async () => {
    if (!serverUrl || !accessToken) return;
    setBitrateTesting(true);
    setBitrateError(false);
    try {
      const mbps = await jellyfinApi.measureBitrateMbps(serverUrl, accessToken);
      const recommended: StreamingQuality =
        mbps >= 25 ? 'auto' : mbps >= 12 ? '1080p' : mbps >= 5 ? '720p' : '480p';
      updatePreferences({ quality: recommended });
      setBitrateSummary(t.settings.bitrateTestResult(mbps, recommended));
    } catch {
      setBitrateError(true);
    } finally {
      setBitrateTesting(false);
    }
  };

  const qualityOptions: Array<{ value: StreamingQuality; label: string; desc: string }> = [
    { value: 'auto', label: t.settings.qualityAutoLabel, desc: t.settings.qualityAutoDesc },
    { value: '1080p', label: t.settings.quality1080Label, desc: t.settings.quality1080Desc },
    { value: '720p', label: t.settings.quality720Label, desc: t.settings.quality720Desc },
    { value: '480p', label: t.settings.quality480Label, desc: t.settings.quality480Desc },
    { value: '360p', label: t.settings.quality360Label, desc: t.settings.quality360Desc },
  ];

  const avatar = user && serverUrl ? getUserAvatarUrl(serverUrl, user) : null;
  const isAdmin = Boolean(user?.Policy?.IsAdministrator);
  const hasInvalidDraftLogo = Boolean(draftLogoUrl.trim()) && !isSafeLogoUrl(draftLogoUrl.trim());
  const previewAppName = draftAppName.trim() || brand.appName;
  const previewLogoUrl =
    draftLogoUrl.trim() === ''
      ? serverBrand?.logoUrl !== undefined || brandOverride.logoUrl !== undefined
        ? ''
        : brand.logoUrl
      : isSafeLogoUrl(draftLogoUrl.trim())
        ? draftLogoUrl.trim()
        : brand.logoUrl;

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInvalidDraftLogo) return;
    const trimmedName = draftAppName.trim();
    const trimmedLogo = draftLogoUrl.trim();
    const nextBrand =
      trimmedName || trimmedLogo
        ? {
            ...(trimmedName ? { appName: trimmedName } : {}),
            ...(trimmedLogo ? { logoUrl: trimmedLogo } : {}),
          }
        : null;

    setBrandBusy(true);
    setBrandStatus('idle');
    try {
      if (!isDemo && serverUrl && accessToken) {
        const saved = await jellyfinApi.updateServerBrand(serverUrl, accessToken, nextBrand);
        setServerBrand(saved);
        resetBrand();
      } else if (nextBrand) {
        updateBrand(nextBrand);
      } else {
        resetBrand();
      }
      setBrandStatus('saved');
    } catch {
      setBrandStatus('error');
    } finally {
      setBrandBusy(false);
    }
  };

  const handleResetBrand = async () => {
    setBrandBusy(true);
    setBrandStatus('idle');
    try {
      if (!isDemo && serverUrl && accessToken) {
        await jellyfinApi.updateServerBrand(serverUrl, accessToken, null);
        setServerBrand(null);
      }
      resetBrand();
      setDraftAppName('');
      setDraftLogoUrl('');
    } catch {
      setBrandStatus('error');
    } finally {
      setBrandBusy(false);
    }
  };

  return (
    <main className="min-h-screen pt-24 pb-24 md:pb-16 max-w-4xl mx-auto px-4 sm:px-6 space-y-8 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl bg-[#12131a] border border-white/10 p-6">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={user?.Name ?? t.settings.defaultUser}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-white/15"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#AA5CC3] to-[#00A4DC] flex items-center justify-center text-2xl font-black text-white">
              {user?.Name?.[0]?.toUpperCase() ?? 'M'}
            </div>
          )}

          <div>
            <h1 className="text-2xl font-bold text-white">{user?.Name}</h1>
            <p className="text-sm text-zinc-400 flex items-center gap-1.5 mt-1">
              <Server className="w-4 h-4 text-[#00A4DC]" />
              {serverInfo?.ServerName ?? serverUrl}
              {isDemo && t.settings.demoSuffix}
            </p>
            {serverInfo?.Version && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Jellyfin Server v{serverInfo.Version}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={switchProfile}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white transition-colors"
          >
            <Users className="w-4 h-4" />
            {t.settings.switchProfile}
          </button>

          <button
            type="button"
            onClick={() => void logoutSession()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {t.settings.logoutSession}
          </button>

          {!isEnvServerLocked && (
            <button
              type="button"
              onClick={disconnectServer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-sm font-semibold text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t.settings.disconnect}
            </button>
          )}
        </div>
      </div>

      {/* Interface language selector */}
      <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-[#00A4DC] shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-white">{t.settings.interfaceLanguageTitle}</h2>
            <p className="text-xs text-zinc-400">{t.settings.interfaceLanguageDesc}</p>
          </div>
        </div>
        <LanguageSwitcher
          locale={locale}
          onChange={setLocale}
          ariaLabel={t.language.switcherAria}
          labels={{ es: t.language.spanish, en: t.language.english }}
        />
      </section>

      {/* Playback preferences */}
      <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-[#00A4DC]" />
          <h2 className="text-lg font-bold text-white">{t.settings.playbackPreferences}</h2>
        </div>

        {/* Streaming quality */}
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-zinc-200">
            {t.settings.preferredQuality}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {qualityOptions.map((opt) => {
              const selected = preferences.quality === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updatePreferences({ quality: opt.value })}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    selected
                      ? 'bg-[#00A4DC]/15 border-[#00A4DC] text-white'
                      : 'bg-[#0a0a0e]/70 border-white/10 text-zinc-300 hover:border-white/25'
                  }`}
                >
                  <p className="text-sm font-bold">{opt.label}</p>
                  <p className="text-xs text-zinc-400 mt-1">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Boolean toggles */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <label className="flex items-center justify-between gap-4 cursor-pointer py-2">
            <div>
              <p className="text-sm font-semibold text-white">{t.settings.autoPlayNextTitle}</p>
              <p className="text-xs text-zinc-400">{t.settings.autoPlayNextDesc}</p>
            </div>
            <input
              id="pref-autoplay-next"
              name="autoPlayNextEpisode"
              type="checkbox"
              checked={preferences.autoPlayNextEpisode}
              onChange={(e) => handlePreferenceChange({ autoPlayNextEpisode: e.target.checked })}
              className="w-5 h-5 accent-[#00A4DC] rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer py-2">
            <div>
              <p className="text-sm font-semibold text-white">{t.settings.autoSkipIntroTitle}</p>
              <p className="text-xs text-zinc-400">{t.settings.autoSkipIntroDesc}</p>
            </div>
            <input
              id="pref-autoskip-intro"
              name="autoSkipIntro"
              type="checkbox"
              checked={preferences.autoSkipIntro}
              onChange={(e) => updatePreferences({ autoSkipIntro: e.target.checked })}
              className="w-5 h-5 accent-[#00A4DC] rounded cursor-pointer"
            />
          </label>
        </div>

        {/* Preferred audio/subtitle languages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
          <div className="space-y-1.5">
            <label htmlFor="audio-lang" className="text-sm font-semibold text-zinc-200">
              {t.settings.preferredAudioLang}
            </label>
            <select
              id="audio-lang"
              value={preferences.preferredAudioLang}
              onChange={(e) => handlePreferenceChange({ preferredAudioLang: e.target.value })}
              className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00A4DC]"
            >
              <option value="spa">{t.settings.langSpa}</option>
              <option value="eng">{t.settings.langEng}</option>
              <option value="jpn">{t.settings.langJpn}</option>
              <option value="kor">{t.settings.langKor}</option>
              <option value="fra">{t.settings.langFra}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sub-lang" className="text-sm font-semibold text-zinc-200">
              {t.settings.preferredSubtitleLang}
            </label>
            <select
              id="sub-lang"
              value={preferences.preferredSubtitleLang}
              onChange={(e) => handlePreferenceChange({ preferredSubtitleLang: e.target.value })}
              className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00A4DC]"
            >
              <option value="spa">{t.settings.langSpa}</option>
              <option value="eng">{t.settings.langEng}</option>
              <option value="none">{t.settings.subtitlesOffByDefault}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Authorize Quick Connect */}
      <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <QrCode className="w-5 h-5 text-[#00A4DC] shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-white">{t.settings.quickConnectAuthTitle}</h2>
            <p className="text-xs text-zinc-400">{t.settings.quickConnectAuthDesc}</p>
          </div>
        </div>

        <form onSubmit={handleAuthorizeQuickConnect} className="flex flex-col sm:flex-row gap-3">
          <input
            id="qc-authorize-code"
            name="qcCode"
            type="text"
            inputMode="numeric"
            value={qcAuthCode}
            onChange={(e) => {
              setQcAuthCode(e.target.value);
              if (qcAuthStatus !== 'idle') setQcAuthStatus('idle');
            }}
            placeholder={t.settings.quickConnectCodePlaceholder}
            className="flex-1 bg-[#0a0a0e] border border-white/15 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
          />
          <button
            type="submit"
            disabled={qcAuthBusy || !qcAuthCode.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {t.settings.authorizeBtn}
          </button>
        </form>

        {qcAuthStatus === 'success' && (
          <p className="text-xs text-emerald-400 font-medium">{t.settings.authorizeSuccess}</p>
        )}
        {qcAuthStatus === 'error' && (
          <p className="text-xs text-rose-400 font-medium">{t.settings.authorizeError}</p>
        )}
      </section>

      {/* Server speed test */}
      <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#00A4DC] shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">{t.settings.bitrateTestTitle}</h2>
              <p className="text-xs text-zinc-400">{t.settings.bitrateTestDesc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleRunBitrateTest()}
            disabled={bitrateTesting}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold text-white disabled:opacity-50 transition-colors shrink-0"
          >
            {bitrateTesting ? t.settings.bitrateTestRunning : t.settings.bitrateTestBtn}
          </button>
        </div>
        {bitrateSummary && <p className="text-xs text-emerald-400 font-medium">{bitrateSummary}</p>}
        {bitrateError && <p className="text-xs text-rose-400 font-medium">{t.settings.bitrateTestError}</p>}
      </section>

      {/* Password update (real Jellyfin accounts only) */}
      {!isDemo && (
        <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-[#00A4DC] shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-white">{t.settings.passwordTitle}</h2>
              <p className="text-xs text-zinc-400">{t.settings.passwordDesc}</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t.settings.currentPasswordPlaceholder}
              autoComplete="current-password"
              className="bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t.settings.newPasswordPlaceholder}
              autoComplete="new-password"
              className="bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
            />
            <button
              type="submit"
              disabled={passwordBusy || !newPassword}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white font-semibold text-sm disabled:opacity-50"
            >
              {t.settings.updatePasswordBtn}
            </button>
          </form>

          {passwordStatus === 'success' && (
            <p className="text-xs text-emerald-400 font-medium">{t.settings.passwordUpdated}</p>
          )}
          {passwordStatus === 'error' && (
            <p className="text-xs text-rose-400 font-medium">{t.settings.passwordError}</p>
          )}
        </section>
      )}

      {/* Custom branding (administrator profiles only) */}
      {isAdmin && (
        <section className="rounded-2xl bg-[#12131a] border border-white/10 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Palette className="w-5 h-5 text-[#AA5CC3]" />
              <div>
                <h2 className="text-lg font-bold text-white">{t.settings.brandTitle}</h2>
                <p className="text-xs text-zinc-400">
                  {t.settings.brandDescPrefix}{' '}
                  <code className="text-zinc-300">APP_NAME</code> {t.settings.brandDescAnd}{' '}
                  <code className="text-zinc-300">APP_LOGO_URL</code> {t.settings.brandDescSuffix}
                </p>
              </div>
            </div>

            {(serverBrand !== null ||
              brandOverride.appName !== undefined ||
              brandOverride.logoUrl !== undefined) && (
              <button
                type="button"
                disabled={brandBusy}
                onClick={() => void handleResetBrand()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {t.settings.restoreDefault}
              </button>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-xl bg-[#0a0a0e] border border-white/10 px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-zinc-400">{t.settings.preview}</span>
            <BrandLogo
              appName={previewAppName}
              logoUrl={previewLogoUrl}
              iconSize={30}
              textClassName="text-lg font-extrabold tracking-tight text-white"
            />
          </div>

          <form onSubmit={handleSaveBrand} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="brand-app-name" className="text-sm font-semibold text-zinc-200">
                  {t.settings.appNameLabel}
                </label>
                <input
                  id="brand-app-name"
                  name="appName"
                  type="text"
                  value={draftAppName}
                  onChange={(e) => {
                    setDraftAppName(e.target.value);
                    if (brandStatus !== 'idle') setBrandStatus('idle');
                  }}
                  placeholder={brand.appName}
                  className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="brand-logo-url" className="text-sm font-semibold text-zinc-200">
                  {t.settings.logoUrlLabel}
                </label>
                <input
                  id="brand-logo-url"
                  name="logoUrl"
                  type="text"
                  value={draftLogoUrl}
                  onChange={(e) => {
                    setDraftLogoUrl(e.target.value);
                    if (brandStatus !== 'idle') setBrandStatus('idle');
                  }}
                  placeholder={t.settings.logoUrlPlaceholder}
                  className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                />
                {hasInvalidDraftLogo && (
                  <p className="text-xs text-amber-400">{t.settings.logoUrlInvalidHint}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {brandStatus === 'saved' && (
                  <p className="text-xs text-emerald-400 font-medium">{t.settings.brandSavedServer}</p>
                )}
                {brandStatus === 'error' && (
                  <p className="text-xs text-rose-400 font-medium">{t.settings.brandSaveError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={brandBusy || hasInvalidDraftLogo}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white font-semibold text-sm hover:opacity-95 disabled:opacity-50 transition-opacity"
              >
                {brandBusy ? t.settings.savingBrandBtn : t.settings.saveBrandBtn}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
};
