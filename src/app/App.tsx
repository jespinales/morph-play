import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ProfileSelectPage } from '../features/auth/ProfileSelectPage';
import { ServerConnectPage } from '../features/auth/ServerConnectPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { HomePage } from '../features/catalog/HomePage';
import { DetailModal } from '../features/media-detail/DetailModal';
import { VideoPlayerModal } from '../features/player/VideoPlayerModal';
import { ProfileSettingsPage } from '../features/settings/ProfileSettingsPage';
import { jellyfinApi } from '../shared/api/jellyfin';
import { BrandLogo } from '../shared/components/BrandLogo';
import { Navbar } from './layout/Navbar';
import { BaseItemDto } from '../shared/types/jellyfin';
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
  const { serverUrl, user, accessToken, isAuthenticated, isInitializing } = useAuth();
  const { brand, t } = usePreferences();
  const navigate = useNavigate();
  const location = useLocation();

  const [detailItem, setDetailItem] = useState<BaseItemDto | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [mutatedItems, setMutatedItems] = useState<Record<string, BaseItemDto>>({});
  const [refreshSignal, setRefreshSignal] = useState(0);
  const homeProgressRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const handleRegisterHomeProgressRefresh = useCallback(
    (refreshFn: (() => Promise<void>) | null) => {
      homeProgressRefreshRef.current = refreshFn;
    },
    []
  );

  const handleSyncHomeProgress = useCallback(async () => {
    await homeProgressRefreshRef.current?.();
  }, []);

  // Clear local modal/mutation state when signing out or switching profiles
  useEffect(() => {
    setDetailItem(null);
    setPlayback(null);
    setMutatedItems({});
  }, [user?.Id]);

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
      <Navbar />

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
        <VideoPlayerModal
          item={playback.item}
          episodeQueue={playback.episodeQueue}
          onClose={() => setPlayback(null)}
          onSyncProgress={handleSyncHomeProgress}
          onProgressUpdated={() => setRefreshSignal((n) => n + 1)}
        />
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
