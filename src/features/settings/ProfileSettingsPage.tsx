import React from 'react';
import { Globe, LogOut, Palette, RotateCcw, Server, Sliders, Users } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { getUserAvatarUrl } from '../../shared/api/playback';
import { BrandLogo } from '../../shared/components/BrandLogo';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { StreamingQuality } from '../../shared/types/jellyfin';
import { isSafeLogoUrl } from '../../shared/utils/url';

export const ProfileSettingsPage: React.FC = () => {
  const { user, serverUrl, serverInfo, isEnvServerLocked, isDemo, switchProfile, disconnectServer } =
    useAuth();
  const {
    preferences,
    brand,
    brandOverride,
    locale,
    setLocale,
    t,
    updatePreferences,
    updateBrand,
    resetBrand,
  } = usePreferences();

  const qualityOptions: Array<{ value: StreamingQuality; label: string; desc: string }> = [
    { value: 'auto', label: t.settings.qualityAutoLabel, desc: t.settings.qualityAutoDesc },
    { value: '1080p', label: t.settings.quality1080Label, desc: t.settings.quality1080Desc },
    { value: '720p', label: t.settings.quality720Label, desc: t.settings.quality720Desc },
    { value: '480p', label: t.settings.quality480Label, desc: t.settings.quality480Desc },
  ];

  const avatar = user && serverUrl ? getUserAvatarUrl(serverUrl, user) : null;

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
              onChange={(e) => updatePreferences({ autoPlayNextEpisode: e.target.checked })}
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
              onChange={(e) => updatePreferences({ preferredAudioLang: e.target.value })}
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
              onChange={(e) => updatePreferences({ preferredSubtitleLang: e.target.value })}
              className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00A4DC]"
            >
              <option value="spa">{t.settings.langSpa}</option>
              <option value="eng">{t.settings.langEng}</option>
              <option value="none">{t.settings.subtitlesOffByDefault}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Custom branding (app name and logo) */}
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

          {(brandOverride.appName !== undefined || brandOverride.logoUrl !== undefined) && (
            <button
              type="button"
              onClick={resetBrand}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
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
            appName={brand.appName}
            logoUrl={brand.logoUrl}
            iconSize={30}
            textClassName="text-lg font-extrabold tracking-tight text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="brand-app-name" className="text-sm font-semibold text-zinc-200">
              {t.settings.appNameLabel}
            </label>
            <input
              id="brand-app-name"
              name="appName"
              type="text"
              value={brandOverride.appName ?? ''}
              onChange={(e) => updateBrand({ appName: e.target.value })}
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
              value={brandOverride.logoUrl ?? ''}
              onChange={(e) => updateBrand({ logoUrl: e.target.value })}
              placeholder={t.settings.logoUrlPlaceholder}
              className="w-full bg-[#0a0a0e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
            />
            {brandOverride.logoUrl && !isSafeLogoUrl(brandOverride.logoUrl) && (
              <p className="text-xs text-amber-400">{t.settings.logoUrlInvalidHint}</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};
