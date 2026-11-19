import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ProfileSelectPage } from '../features/auth/ProfileSelectPage';
import { ServerConnectPage } from '../features/auth/ServerConnectPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { HomePage } from '../features/catalog/HomePage';
import { DetailModal } from '../features/media-detail/DetailModal';
import type { PlayerRemoteHandlers } from '../features/player/VideoPlayerModal';
import { ProfileSettingsPage } from '../features/settings/ProfileSettingsPage';

const VideoPlayerModal = React.lazy(() => import('../features/player/VideoPlayerModal'));
import { jellyfinApi } from '../shared/api/jellyfin';
import { JellyfinSocketClient } from '../shared/api/websocket';
import { BrandLogo } from '../shared/components/BrandLogo';
import { Navbar } from './layout/Navbar';
import {
  BaseItemDto,
  PlaystateCommandData,
  SyncPlayCommandData,
} from '../shared/types/jellyfin';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { PreferencesProvider, usePreferences } from './providers/PreferencesProvider';

interface PlaybackState {
  item: BaseItemDto;
  episodeQueue?: BaseItemDto[];
}

const SearchRedirect: React.FC = () => {
  const { search } = useLocation();
  return <Navigate to={`/search${search}`} replace />;
};

const AppShell: React.FC = () => {
  const { serverUrl, user, accessToken, isAuthenticated, isDemo, isInitializing } = useAuth();
  const { brand, t, updatePreferences } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();

  const [detailItem, setDetailItem] = useState<BaseItemDto | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [mutatedItems, setMutatedItems] = useState<Record<string, BaseItemDto>>({});
  const [refreshSignal, setRefreshSignal] = useState(0);
  const homeProgressRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const remotePlaystateHandlerRef = useRef<((cmd: PlaystateCommandData) => void) | null>(null);
  const syncPlayCommandHandlerRef = useRef<((cmd: SyncPlayCommandData) => void) | null>(null);
  const syncPlayGroupUpdateHandlerRef = useRef<((data: unknown) => void) | null>(null);

  const handleRegisterHomeProgressRefresh = useCallback(
    (refreshFn: (() => Promise<void>) | null) => {
      homeProgressRefreshRef.current = refreshFn;
    },
    []
  );

  const handleSyncHomeProgress = useCallback(async () => {
    await homeProgressRefreshRef.current?.();
  }, []);

  const handleRegisterRemoteHandlers = useCallback((handlers: PlayerRemoteHandlers | null) => {
    remotePlaystateHandlerRef.current = handlers?.onPlaystate ?? null;
    syncPlayCommandHandlerRef.current = handlers?.onSyncPlayCommand ?? null;
    syncPlayGroupUpdateHandlerRef.current = handlers?.onSyncPlayGroupUpdate ?? null;
  }, []);

  // Clear local modal/mutation state and apply server user preferences when switching profiles
  useEffect(() => {
    setDetailItem(null);
    setPlayback(null);
    setMutatedItems({});

    const cfg = user?.Configuration;
    if (!cfg) return;
    const patch: Record<string, unknown> = {};
    if (cfg.AudioLanguagePreference) {
      patch.preferredAudioLang = cfg.AudioLanguagePreference.toLowerCase();
    }
    if (cfg.SubtitleMode === 'None') {
      patch.preferredSubtitleLang = 'none';
    } else if (cfg.SubtitleLanguagePreference) {
      patch.preferredSubtitleLang = cfg.SubtitleLanguagePreference.toLowerCase();
    }
    if (typeof cfg.EnableNextEpisodeAutoPlay === 'boolean') {
      patch.autoPlayNextEpisode = cfg.EnableNextEpisodeAutoPlay;
    }
    if (Object.keys(patch).length > 0) {
      updatePreferences(patch);
    }
  }, [user?.Id, user?.Configuration, updatePreferences]);

  useEffect(() => {
    if (!isInitializing && (!serverUrl || !isAuthenticated) && location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [isInitializing, serverUrl, isAuthenticated, location.pathname, navigate]);

  const handleItemMutated = useCallback((updated: BaseItemDto) => {
    setMutatedItems((prev) => ({ ...prev, [updated.Id]: updated }));
  }, []);

  const handleToggleFavorite = useCallback(
    async (item: BaseItemDto) => {
      if (!serverUrl || !accessToken || !user) return;
      const currentFav = mutatedItems[item.Id]?.UserData?.IsFavorite ?? item.UserData?.IsFavorite;
      const nextFav = !Boolean(currentFav);

      const updated: BaseItemDto = {
        ...item,
        UserData: { ...item.UserData, IsFavorite: nextFav },
      };
      handleItemMutated(updated);

      if (detailItem?.Id === item.Id) {
        setDetailItem(updated);
      }

      try {
        await jellyfinApi.toggleFavorite(serverUrl, accessToken, user.Id, item.Id, nextFav);
      } catch {
        // Revert optimistic update on failure
        handleItemMutated(item);
      }
    },
    [serverUrl, accessToken, user, mutatedItems, detailItem, handleItemMutated]
  );

  const handlePlay = useCallback((item: BaseItemDto, episodeQueue?: BaseItemDto[]) => {
    setPlayback({ item, episodeQueue });
  }, []);

  // Real-time WebSocket listener for capabilities, library scans, remote Play/Playstate, and SyncPlay
  useEffect(() => {
    if (!isAuthenticated || isDemo || !serverUrl || !accessToken || !user?.Id) return;

    const socket = new JellyfinSocketClient(serverUrl, accessToken);
    let userDataTimer: number | null = null;
    let libraryTimer: number | null = null;

    void jellyfinApi.reportSessionCapabilities(serverUrl, accessToken);

    const unsubscribe = socket.subscribe((msg) => {
      if (msg.MessageType === 'UserDataChanged') {
        if (userDataTimer) window.clearTimeout(userDataTimer);
        userDataTimer = window.setTimeout(() => {
          void homeProgressRefreshRef.current?.();
        }, 500);
      } else if (msg.MessageType === 'LibraryChanged') {
        if (libraryTimer) window.clearTimeout(libraryTimer);
        libraryTimer = window.setTimeout(() => {
          setRefreshSignal((n) => n + 1);
        }, 1500);
      } else if (msg.MessageType === 'Play' && msg.Data && typeof msg.Data === 'object') {
        const data = msg.Data as { ItemIds?: string[]; StartPositionTicks?: number };
        const targetId = data.ItemIds?.[0];
        if (!targetId) return;
        void jellyfinApi
          .getItemDetail(serverUrl, accessToken, user.Id, targetId)
          .then((targetItem) => {
            const patched: BaseItemDto =
              typeof data.StartPositionTicks === 'number'
                ? {
                    ...targetItem,
                    UserData: {
                      ...targetItem.UserData,
                      PlaybackPositionTicks: data.StartPositionTicks,
                    },
                  }
                : targetItem;
            setPlayback({ item: patched });
          })
          .catch(() => {});
      } else if (msg.MessageType === 'Playstate' && msg.Data && typeof msg.Data === 'object') {
        remotePlaystateHandlerRef.current?.(msg.Data as PlaystateCommandData);
      } else if (msg.MessageType === 'SyncPlayCommand' && msg.Data && typeof msg.Data === 'object') {
        syncPlayCommandHandlerRef.current?.(msg.Data as SyncPlayCommandData);
      } else if (msg.MessageType === 'SyncPlayGroupUpdate') {
        syncPlayGroupUpdateHandlerRef.current?.(msg.Data);
      }
    });

    socket.connect();

    return () => {
      unsubscribe();
      socket.disconnect();
      if (userDataTimer) window.clearTimeout(userDataTimer);
      if (libraryTimer) window.clearTimeout(libraryTimer);
    };
  }, [isAuthenticated, isDemo, serverUrl, accessToken, user?.Id]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0a0a0e] flex flex-col items-center justify-center gap-4">
        <BrandLogo
          appName={brand.appName}
          logoUrl={brand.logoUrl}
          iconSize={54}
          showText={false}
          className="animate-pulse"
        />
        <p className="text-sm text-zinc-400 font-medium">{t.app.initializing(brand.appName)}</p>
      </div>
    );
  }

  if (!serverUrl) {
    return <ServerConnectPage />;
  }

  if (!isAuthenticated) {
    return <ProfileSelectPage />;
  }

  const isAnyModalOpen = Boolean(detailItem || playback);

  return (
    <div className="min-h-screen bg-[#0a0a0e] text-white">
      <Navbar onOpenSearchResult={(item) => setDetailItem(item)} />

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              isModalOpen={isAnyModalOpen}
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              onRegisterProgressRefresh={handleRegisterHomeProgressRefresh}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/movies"
          element={
            <CatalogPage
              mode="movies"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/shows"
          element={
            <CatalogPage
              mode="series"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/collections"
          element={
            <CatalogPage
              mode="collections"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/playlists"
          element={
            <CatalogPage
              mode="playlists"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/my-list"
          element={
            <CatalogPage
              mode="favorites"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/search"
          element={
            <CatalogPage
              mode="search"
              refreshSignal={refreshSignal}
              onPlay={(item) => handlePlay(item)}
              onOpenDetail={(item) => setDetailItem(item)}
              onToggleFavorite={handleToggleFavorite}
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route path="/settings" element={<ProfileSettingsPage />} />

        {/* Legacy Spanish route redirects */}
        <Route path="/peliculas" element={<Navigate to="/movies" replace />} />
        <Route path="/series" element={<Navigate to="/shows" replace />} />
        <Route path="/colecciones" element={<Navigate to="/collections" replace />} />
        <Route path="/mi-lista" element={<Navigate to="/my-list" replace />} />
        <Route path="/buscar" element={<SearchRedirect />} />
        <Route path="/perfil" element={<Navigate to="/settings" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Overlay details modal */}
      {detailItem && (
        <DetailModal
          item={mutatedItems[detailItem.Id] ?? detailItem}
          onClose={() => setDetailItem(null)}
          onPlay={(item, queue) => handlePlay(item, queue)}
          onSelectItem={(nextItem) => setDetailItem(nextItem)}
          onItemMutated={handleItemMutated}
        />
      )}

      {/* Fullscreen video player modal */}
      {playback && (
        <React.Suspense
          fallback={
            <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-[#00A4DC] border-t-transparent animate-spin" />
            </div>
          }
        >
          <VideoPlayerModal
            item={playback.item}
            episodeQueue={playback.episodeQueue}
            onClose={() => setPlayback(null)}
            onSyncProgress={handleSyncHomeProgress}
            onProgressUpdated={() => setRefreshSignal((n) => n + 1)}
            onRegisterRemoteHandlers={handleRegisterRemoteHandlers}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  );
};

export default App;
