import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BaseItemDto } from './types/jellyfin';
import { jellyfinApi } from './services/jellyfinApi';
import { BrandLogo } from './components/BrandLogo';
import { Navbar } from './components/Navbar';
import { DetailModal } from './components/DetailModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ServerConnectPage } from './pages/ServerConnectPage';
import { ProfileSelectPage } from './pages/ProfileSelectPage';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

interface PlaybackState {
  item: BaseItemDto;
  episodeQueue?: BaseItemDto[];
}

const AppShell: React.FC = () => {
  const { serverUrl, user, accessToken, isAuthenticated, isInitializing, brand, t } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [detailItem, setDetailItem] = useState<BaseItemDto | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [mutatedItems, setMutatedItems] = useState<Record<string, BaseItemDto>>({});
  const [refreshSignal, setRefreshSignal] = useState(0);

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
        <BrandLogo iconSize={54} showText={false} className="animate-pulse" />
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
              mutatedItems={mutatedItems}
            />
          }
        />
        <Route
          path="/peliculas"
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
          path="/series"
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
          path="/colecciones"
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
          path="/mi-lista"
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
          path="/buscar"
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
        <Route path="/perfil" element={<ProfileSettingsPage />} />
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
          onProgressUpdated={() => setRefreshSignal((n) => n + 1)}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
