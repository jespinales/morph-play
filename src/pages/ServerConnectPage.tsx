import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Loader2, PlayCircle, Server } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';

export const ServerConnectPage: React.FC = () => {
  const { connectToServer, enableDemoMode } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setError('Introduce la dirección de tu servidor Jellyfin.');
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
          ? `No se pudo conectar: ${msg}`
          : 'No se pudo alcanzar el servidor Jellyfin. Verifica la URL, el puerto (ej. 8096) y que el servidor permita conexiones desde este navegador.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0e] relative flex flex-col justify-center items-center px-4 py-12 overflow-hidden">
      {/* Iluminación ambiental */}
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[460px] rounded-full bg-gradient-to-tr from-[#AA5CC3]/20 via-[#00A4DC]/15 to-transparent blur-3xl pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-md space-y-8 animate-fadeIn">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandLogo iconSize={52} textClassName="text-3xl font-black tracking-tight text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Conecta tu servidor
          </h1>
          <p className="text-sm text-zinc-400">
            Ingresa la dirección de tu servidor Jellyfin para comenzar a explorar tu biblioteca.
          </p>
        </div>

        <div className="rounded-2xl bg-[#12131a]/90 backdrop-blur-xl border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="server-url" className="block text-sm font-medium text-zinc-200">
                Dirección del servidor
              </label>
              <div className="relative">
                <Server className="w-5 h-5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="server-url"
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://jellyfin.tudominio.com o 192.168.1.50:8096"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a0a0e] border border-white/15 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#00A4DC] focus:ring-1 focus:ring-[#00A4DC] transition-colors"
                />
              </div>
              <p className="text-xs text-zinc-500">
                También puedes definir <code className="text-zinc-300">JELLYFIN_SERVER_URL</code> en{' '}
                <code className="text-zinc-300">docker-compose.yml</code> para omitir este paso.
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
                  Conectando…
                </>
              ) : (
                <>
                  Conectar al servidor
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-white/10" />
            <span className="shrink-0 px-3 text-xs text-zinc-500 uppercase tracking-wider">o</span>
            <div className="flex-grow border-t border-white/10" />
          </div>

          <button
            type="button"
            onClick={enableDemoMode}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-200 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-4 h-4 text-[#00A4DC]" />
            Probar modo demostración
          </button>
        </div>
      </div>
    </div>
  );
};
