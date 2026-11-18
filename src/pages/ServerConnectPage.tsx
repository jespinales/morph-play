import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, PlayCircle, Server } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAuth } from '../context/AuthContext';

export const ServerConnectPage: React.FC = () => {
  const { connectToServer, enableDemoMode, t } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setError(t.connect.emptyUrlError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await connectToServer(urlInput);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg && !msg.includes('Failed to fetch')
          ? `${t.connect.connectFailedPrefix} ${msg}`
          : t.connect.unreachableError
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0e] relative flex flex-col justify-center items-center px-4 py-12 overflow-hidden">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[460px] rounded-full bg-gradient-to-tr from-[#AA5CC3]/20 via-[#00A4DC]/15 to-transparent blur-3xl pointer-events-none"
      />

      <div className="absolute top-5 right-5 z-20">
        <LanguageSwitcher compact />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8 animate-fadeIn">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo iconSize={52} textClassName="text-3xl font-black tracking-tight text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t.connect.title}
          </h1>
          <p className="text-sm text-zinc-400">{t.connect.subtitle}</p>
        </div>

        <div className="rounded-2xl bg-[#12131a]/90 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="server-url" className="block text-sm font-medium text-zinc-200">
                {t.connect.serverUrlLabel}
              </label>
              <div className="relative">
                <Server className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="server-url"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={t.connect.serverUrlPlaceholder}
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a0a0e] border border-white/15 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#00A4DC] focus:ring-1 focus:ring-[#00A4DC] transition-colors"
                />
              </div>
              <p className="text-xs text-zinc-500">
                {t.connect.hintPrefix}{' '}
                <code className="text-zinc-300">JELLYFIN_SERVER_URL</code> {t.connect.hintIn}{' '}
                <code className="text-zinc-300">docker-compose.yml</code> {t.connect.hintSuffix}
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs sm:text-sm text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white font-bold text-sm sm:text-base hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-[#00A4DC]/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.connect.connecting}
                </>
              ) : (
                <>
                  {t.connect.connectButton}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/10" />
            <span className="shrink-0 px-3 text-xs text-zinc-500 uppercase tracking-wider">
              {t.connect.or}
            </span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <button
            type="button"
            onClick={enableDemoMode}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-[#00A4DC]" />
            {t.connect.tryDemo}
          </button>
        </div>
      </div>
    </div>
  );
};
