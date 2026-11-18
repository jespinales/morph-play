import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  ChevronDown,
  Film,
  Home,
  Layers,
  LogOut,
  Search,
  Server,
  Settings,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { getUserAvatarUrl } from '../services/jellyfinApi';

const NAV_LINKS = [
  { to: '/', label: 'Inicio', icon: Home },
  { to: '/peliculas', label: 'Películas', icon: Film },
  { to: '/series', label: 'Series', icon: Tv },
  { to: '/colecciones', label: 'Colecciones', icon: Layers },
  { to: '/mi-lista', label: 'Mi lista', icon: Bookmark },
];

export const Navbar: React.FC = () => {
  const { user, serverUrl, serverInfo, isEnvServerLocked, isDemo, switchProfile, disconnectServer } =
    useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    if (location.pathname === '/buscar') {
      const q = new URLSearchParams(location.search).get('q') ?? '';
      setSearchQuery(q);
      setSearchOpen(true);
    }
  }, [location.pathname, location.search]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      navigate(`/buscar?q=${encodeURIComponent(value)}`, { replace: location.pathname === '/buscar' });
    } else if (location.pathname === '/buscar') {
      navigate('/buscar', { replace: true });
    }
  };

  const avatarUrl = user && serverUrl ? getUserAvatarUrl(serverUrl, user) : null;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-[#0a0a0e]/85 via-[#0a0a0e]/35 to-transparent">
        {/* Capa sólida con blur separada para interpolar únicamente opacity sin destellos de borde ni saltos de gradiente */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 bg-[#0a0a0e]/95 backdrop-blur-md border-b border-white/10 shadow-2xl transition-opacity duration-500 ease-out ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 h-16 md:h-[72px] flex items-center justify-between gap-3">
          {/* Logo + Enlaces principales */}
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC] rounded-lg"
            >
              <BrandLogo iconSize={30} textClassName="text-lg md:text-xl font-extrabold tracking-tight text-white" />
            </Link>

            <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1 lg:gap-2">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-2.5 lg:px-3 py-2 min-h-[36px] inline-flex items-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-white bg-white/10 font-semibold'
                        : 'text-zinc-300 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Búsqueda y Menú de Perfil */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isDemo && (
              <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-[#AA5CC3]/25 to-[#00A4DC]/25 border border-[#00A4DC]/40 text-[#7dd3fc]">
                Modo Demo
              </span>
            )}

            {/* Barra de búsqueda expandible (overlay ancho completo en < lg para evitar desborde en móvil/tablet) */}
            <div className="relative flex items-center">
              {searchOpen ? (
                <div className="fixed top-0 inset-x-0 z-50 h-16 md:h-[72px] bg-[#0a0a0e]/98 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center lg:static lg:inset-auto lg:h-auto lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0">
                  <div className="flex items-center w-full lg:w-64 xl:w-72 bg-[#141620]/95 border border-white/20 rounded-full pl-3.5 pr-1 py-0.5 transition-all">
                    <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />
                    <input
                      id="navbar-search-input"
                      name="search"
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Títulos, géneros..."
                      aria-label="Buscar en el catálogo"
                      className="bg-transparent text-sm text-white placeholder-zinc-400 focus:outline-none w-full min-w-0 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchOpen(false);
                        if (location.pathname === '/buscar') navigate('/');
                      }}
                      aria-label="Cerrar búsqueda"
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 40);
                  }}
                  aria-label="Abrir búsqueda"
                  title="Buscar (/)"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Perfil del usuario */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC]"
                aria-expanded={menuOpen}
                aria-label="Menú de usuario"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.Name ?? 'Perfil'}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#AA5CC3] to-[#00A4DC] flex items-center justify-center text-sm font-bold text-white">
                    {user?.Name?.[0]?.toUpperCase() ?? 'J'}
                  </div>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-zinc-300 transition-transform duration-200 hidden sm:block ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 shadow-2xl py-2 animate-fadeIn">
                  <div className="px-4 py-2.5 border-b border-white/10">
                    <p className="text-sm font-semibold text-white truncate">{user?.Name}</p>
                    <p className="text-xs text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                      <Server className="w-3 h-3 text-[#00A4DC] shrink-0" />
                      {serverInfo?.ServerName ?? serverUrl}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/perfil');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-zinc-400" />
                      Preferencias de reproducción
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        switchProfile();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <Users className="w-4 h-4 text-zinc-400" />
                      Cambiar de perfil
                    </button>
                  </div>

                  {!isEnvServerLocked && (
                    <div className="pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          disconnectServer();
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Desconectar servidor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Barra inferior adaptativa para móviles */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0e]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around"
      >
        {NAV_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#00A4DC]' : 'text-zinc-400 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
