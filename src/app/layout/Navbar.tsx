import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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
import { jellyfinApi } from '../../shared/api/jellyfin';
import { getItemImageUrl, getUserAvatarUrl } from '../../shared/api/playback';
import { BrandLogo } from '../../shared/components/BrandLogo';
import { LanguageSwitcher } from '../../shared/components/LanguageSwitcher';
import { BaseItemDto, SearchHintDto } from '../../shared/types/jellyfin';
import { useAuth } from '../providers/AuthProvider';
import { usePreferences } from '../providers/PreferencesProvider';

interface NavbarProps {
  onOpenSearchResult?: (item: BaseItemDto) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearchResult }) => {
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
  } = useAuth();
  const { brand, locale, setLocale, t } = usePreferences();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHints, setSearchHints] = useState<SearchHintDto[]>([]);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { to: '/', label: t.nav.home, icon: Home },
    { to: '/movies', label: t.nav.movies, icon: Film },
    { to: '/shows', label: t.nav.series, icon: Tv },
    { to: '/collections', label: t.nav.collections, icon: Layers },
    { to: '/my-list', label: t.nav.myList, icon: Bookmark },
  ];

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
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setHintsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Fetch instant Search/Hints suggestions as the user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (!searchOpen || q.length < 2 || !serverUrl || !accessToken || !user?.Id) {
      setSearchHints([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      const hints = await jellyfinApi.getSearchHints(serverUrl, accessToken, user.Id, q, 7);
      if (active) {
        setSearchHints(hints);
        setHintsOpen(hints.length > 0);
      }
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery, serverUrl, accessToken, user?.Id]);

  const openSearchAndFocus = useCallback(() => {
    // Flush DOM mount synchronously inside the user gesture so iOS WebKit opens the virtual keyboard on first tap
    flushSync(() => {
      setSearchOpen(true);
    });
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        openSearchAndFocus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, openSearchAndFocus]);

  useEffect(() => {
    if (location.pathname === '/search') {
      const q = new URLSearchParams(location.search).get('q') ?? '';
      setSearchQuery(q);
      setSearchOpen(true);
    }
  }, [location.pathname, location.search]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`, { replace: location.pathname === '/search' });
    } else if (location.pathname === '/search') {
      navigate('/search', { replace: true });
    }
  };

  const avatarUrl = user && serverUrl ? getUserAvatarUrl(serverUrl, user) : null;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-gradient-to-b from-[#0a0a0e]/85 via-[#0a0a0e]/35 to-transparent">
        {/* Separate blurred layer so only opacity transitions cleanly without edge flicker */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 bg-[#0a0a0e]/95 backdrop-blur-md border-b border-white/10 shadow-2xl transition-opacity duration-500 ease-out ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 h-16 md:h-[72px] flex items-center justify-between gap-3">
          {/* Brand logo + main navigation */}
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <Link
              to="/"
              className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC] rounded-lg"
            >
              <BrandLogo
                appName={brand.appName}
                logoUrl={brand.logoUrl}
                iconSize={30}
                textClassName="text-lg md:text-xl font-extrabold tracking-tight text-white"
              />
            </Link>

            <nav aria-label={t.nav.mainAria} className="hidden md:flex items-center gap-1 lg:gap-2">
              {navLinks.map(({ to, label }) => (
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

          {/* Search & profile menu */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isDemo && (
              <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-[#AA5CC3]/25 to-[#00A4DC]/25 border border-[#00A4DC]/40 text-[#7dd3fc]">
                {t.common.demoMode}
              </span>
            )}

            {/* Expandable search bar (full-width overlay below lg to avoid overflow on mobile/tablet) */}
            <div ref={searchBoxRef} className="relative flex items-center">
              {searchOpen ? (
                <div className="fixed top-0 inset-x-0 z-50 h-16 md:h-[72px] bg-[#0a0a0e]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center lg:static lg:inset-auto lg:h-auto lg:bg-transparent lg:backdrop-blur-none lg:border-0 lg:p-0">
                  <div className="relative flex items-center w-full lg:w-64 xl:w-72 bg-[#141620]/95 border border-white/20 rounded-full pl-3.5 pr-1 py-0.5 transition-all">
                    <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />
                    <input
                      id="navbar-search-input"
                      name="search"
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onFocus={() => {
                        if (searchHints.length > 0) setHintsOpen(true);
                      }}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t.nav.searchPlaceholder}
                      aria-label={t.nav.searchAria}
                      className="bg-transparent text-base lg:text-sm text-white placeholder-zinc-400 focus:outline-none w-full min-w-0 py-1.5"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchHints([]);
                        setHintsOpen(false);
                        setSearchOpen(false);
                        if (location.pathname === '/search') navigate('/');
                      }}
                      aria-label={t.nav.closeSearchAria}
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {hintsOpen && searchHints.length > 0 && (
                      <div
                        className={`absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 shadow-2xl py-1.5 max-h-[60vh] overflow-y-auto z-50 ${
                          location.pathname === '/search' ? 'hidden lg:block' : ''
                        }`}
                      >
                        {searchHints.map((hint) => {
                          const targetId = hint.Id || hint.ItemId || '';
                          const thumb = getItemImageUrl(
                            serverUrl,
                            {
                              Id: targetId,
                              Name: hint.Name,
                              ImageTags: hint.PrimaryImageTag
                                ? { Primary: hint.PrimaryImageTag }
                                : undefined,
                            },
                            'Primary',
                            160
                          );
                          return (
                            <button
                              key={`${hint.Type}-${targetId}`}
                              type="button"
                              onClick={() => {
                                setHintsOpen(false);
                                onOpenSearchResult?.({
                                  Id: targetId,
                                  Name: hint.Name,
                                  Type: hint.Type,
                                  ProductionYear: hint.ProductionYear,
                                  SeriesName: hint.Series,
                                  ImageTags: hint.PrimaryImageTag
                                    ? { Primary: hint.PrimaryImageTag }
                                    : undefined,
                                });
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors"
                            >
                              <div className="w-9 h-12 rounded bg-white/10 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-zinc-400">
                                {thumb ? (
                                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  hint.Name[0]?.toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-semibold text-white truncate">
                                  {hint.Name}
                                </p>
                                <p className="text-[11px] text-zinc-400 truncate">
                                  {[hint.Series, hint.Type, hint.ProductionYear].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openSearchAndFocus}
                  aria-label={t.nav.openSearchAria}
                  title={t.nav.searchTitle}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* User profile dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A4DC]"
                aria-expanded={menuOpen}
                aria-label={t.nav.userMenuAria}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.Name ?? t.nav.profileFallback}
                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#AA5CC3] to-[#00A4DC] flex items-center justify-center text-sm font-bold text-white">
                    {user?.Name?.[0]?.toUpperCase() ?? 'M'}
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
                        navigate('/settings');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-zinc-400" />
                      {t.nav.playbackPreferences}
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
                      {t.nav.switchProfile}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        void logoutSession();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-zinc-400" />
                      {t.nav.logoutSession}
                    </button>

                    <div className="px-4 py-2 flex items-center justify-between border-t border-white/10 mt-1">
                      <span className="text-xs text-zinc-400">ES / EN</span>
                      <LanguageSwitcher
                        locale={locale}
                        onChange={setLocale}
                        ariaLabel={t.language.switcherAria}
                        labels={{ es: t.language.spanish, en: t.language.english }}
                        compact
                      />
                    </div>
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
                        {t.nav.disconnectServer}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Adaptive bottom bar for mobile */}
      <nav
        aria-label={t.nav.mobileAria}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0a0a0e]/95 backdrop-blur-xl border-t border-white/10 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around"
      >
        {navLinks.map(({ to, label, icon: Icon }) => (
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
