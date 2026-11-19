import React, { useEffect } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { BaseItemDto } from '../../shared/types/jellyfin';
import { HeroBanner } from './components/HeroBanner';
import { MediaRow } from './components/MediaRow';
import { useHomeCatalog } from './hooks/useHomeCatalog';

interface HomePageProps {
  isModalOpen: boolean;
  refreshSignal: number;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => Promise<void>;
  onRegisterProgressRefresh?: (refreshFn: (() => Promise<void>) | null) => void;
  mutatedItems: Record<string, BaseItemDto>;
}

export const HomePage: React.FC<HomePageProps> = ({
  isModalOpen,
  refreshSignal,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  onRegisterProgressRefresh,
  mutatedItems,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const { t } = usePreferences();

  const {
    loading,
    featured,
    resumeItems,
    dedupedNextUpItems,
    latestMovies,
    latestSeries,
    topRated,
    favorites,
    suggestions,
    recommendations,
    upcomingEpisodes,
    actionMovies,
    refreshResumeAndNextUp,
    handleRemoveFromResume,
    handleRemoveFromNextUp,
  } = useHomeCatalog({
    serverUrl,
    accessToken,
    userId: user?.Id,
    refreshSignal,
  });

  useEffect(() => {
    onRegisterProgressRefresh?.(refreshResumeAndNextUp);
    return () => {
      onRegisterProgressRefresh?.(null);
    };
  }, [onRegisterProgressRefresh, refreshResumeAndNextUp]);

  const hydrate = (list: BaseItemDto[]): BaseItemDto[] =>
    list.map((item) => (mutatedItems[item.Id] ? { ...item, ...mutatedItems[item.Id] } : item));

  const hydratedFeatured = hydrate(featured);
  const hydratedFavs = hydrate(favorites);

  if (loading) {
    return (
      <div className="min-h-screen pb-24">
        <div className="h-[72vh] w-full bg-[#12131a] animate-pulse" />
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-12 mt-6 space-y-8">
          {[1, 2, 3].map((row) => (
            <div key={row} className="space-y-3">
              <div className="h-6 w-48 rounded bg-white/10 animate-pulse" />
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((card) => (
                  <div
                    key={card}
                    className="w-[150px] sm:w-[180px] aspect-[2/3] rounded-lg bg-white/5 animate-pulse shrink-0"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-24 md:pb-14">
      <HeroBanner
        items={hydratedFeatured}
        isPaused={isModalOpen}
        onPlay={onPlay}
        onOpenDetail={onOpenDetail}
        onToggleFavorite={onToggleFavorite}
      />

      <div className="relative z-20 -mt-8 sm:-mt-14 space-y-3 sm:space-y-5">
        <MediaRow
          title={t.home.continueWatching}
          items={hydrate(resumeItems)}
          variant="continue"
          removeLabel={t.home.removeFromContinue}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          onRemove={handleRemoveFromResume}
        />

        <MediaRow
          title={t.home.nextEpisodes}
          items={hydrate(dedupedNextUpItems)}
          variant="continue"
          removeLabel={t.home.removeFromNextUp}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          onRemove={handleRemoveFromNextUp}
        />

        <MediaRow
          title={t.home.recentMovies}
          items={hydrate(latestMovies)}
          seeAllTo="/movies"
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />

        <MediaRow
          title={t.home.recentSeries}
          items={hydrate(latestSeries)}
          seeAllTo="/shows"
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />

        {suggestions.length > 0 && (
          <MediaRow
            title={t.home.recommendedForYou}
            items={hydrate(suggestions)}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {recommendations.map((rec, idx) =>
          rec.Items && rec.Items.length > 0 ? (
            <MediaRow
              key={`${rec.CategoryId ?? rec.BaselineItemName ?? idx}`}
              title={
                rec.BaselineItemName
                  ? t.home.becauseYouWatched(rec.BaselineItemName)
                  : t.home.recommendedForYou
              }
              items={hydrate(rec.Items)}
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              onToggleFavorite={onToggleFavorite}
            />
          ) : null
        )}

        {upcomingEpisodes.length > 0 && (
          <MediaRow
            title={t.home.upcomingEpisodes}
            items={hydrate(upcomingEpisodes)}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        <MediaRow
          title={t.home.topRated}
          items={hydrate(topRated).slice(0, 10)}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />

        {hydratedFavs.length > 0 && (
          <MediaRow
            title={t.home.myList}
            items={hydratedFavs}
            seeAllTo="/my-list"
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        <MediaRow
          title={t.home.actionAndAdventure}
          items={hydrate(actionMovies)}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </main>
  );
};
