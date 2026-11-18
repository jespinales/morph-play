import React, { useEffect, useMemo, useState } from 'react';
import { BaseItemDto } from '../types/jellyfin';
import { useAuth } from '../context/AuthContext';
import { jellyfinApi } from '../services/jellyfinApi';
import { HeroBanner } from '../components/HeroBanner';
import { MediaRow } from '../components/MediaRow';

interface HomePageProps {
  isModalOpen: boolean;
  refreshSignal: number;
  onPlay: (item: BaseItemDto) => void;
  onOpenDetail: (item: BaseItemDto) => void;
  onToggleFavorite: (item: BaseItemDto) => Promise<void>;
  mutatedItems: Record<string, BaseItemDto>;
}

export const HomePage: React.FC<HomePageProps> = ({
  isModalOpen,
  refreshSignal,
  onPlay,
  onOpenDetail,
  onToggleFavorite,
  mutatedItems,
}) => {
  const { serverUrl, accessToken, user, t } = useAuth();

  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<BaseItemDto[]>([]);
  const [resumeItems, setResumeItems] = useState<BaseItemDto[]>([]);
  const [nextUpItems, setNextUpItems] = useState<BaseItemDto[]>([]);
  const [latestMovies, setLatestMovies] = useState<BaseItemDto[]>([]);
  const [latestSeries, setLatestSeries] = useState<BaseItemDto[]>([]);
  const [topRated, setTopRated] = useState<BaseItemDto[]>([]);
  const [favorites, setFavorites] = useState<BaseItemDto[]>([]);
  const [actionMovies, setActionMovies] = useState<BaseItemDto[]>([]);

  useEffect(() => {
    let active = true;
    async function fetchHomeData() {
      if (!serverUrl || !accessToken || !user) return;
      try {
        const [resume, nextUp, movies, series, top, favs, actionPrimary] = await Promise.all([
          jellyfinApi.getResumeItems(serverUrl, accessToken, user.Id).catch(() => []),
          jellyfinApi.getNextUpItems(serverUrl, accessToken, user.Id).catch(() => []),
          jellyfinApi.getLatestItems(serverUrl, accessToken, user.Id, 'Movie', 16).catch(() => []),
          jellyfinApi.getLatestItems(serverUrl, accessToken, user.Id, 'Series', 16).catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, user.Id, {
              includeItemTypes: 'Movie,Series',
              sortBy: 'CommunityRating',
              sortOrder: 'Descending',
              limit: 10,
            })
            .then((r) => r.Items)
            .catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, user.Id, {
              includeItemTypes: 'Movie,Series',
              filters: 'IsFavorite',
              limit: 16,
            })
            .then((r) => r.Items)
            .catch(() => []),
          jellyfinApi
            .getItems(serverUrl, accessToken, user.Id, {
              includeItemTypes: 'Movie',
              genres: 'Action',
              limit: 16,
            })
            .then((r) => r.Items)
            .catch(() => []),
        ]);

        // Fallback to Spanish genre tag for libraries configured with Spanish metadata
        const action =
          actionPrimary.length > 0
            ? actionPrimary
            : await jellyfinApi
                .getItems(serverUrl, accessToken, user.Id, {
                  includeItemTypes: 'Movie',
                  genres: 'Acción',
                  limit: 16,
                })
                .then((r) => r.Items)
                .catch(() => []);

        if (!active) return;

        // Pick top candidates for HeroBanner
        const heroPool = [...top, ...movies, ...series].filter(
          (item, index, arr) =>
            arr.findIndex((x) => x.Id === item.Id) === index &&
            (item.BackdropImageTags?.length || item.Overview)
        );

        setFeatured(heroPool.slice(0, 5));
        setResumeItems(resume);
        setNextUpItems(nextUp);
        setLatestMovies(movies);
        setLatestSeries(series);
        setTopRated(top);
        setFavorites(favs);
        setActionMovies(action);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchHomeData();
    return () => {
      active = false;
    };
  }, [serverUrl, accessToken, user, refreshSignal]);

  const hydrate = (list: BaseItemDto[]): BaseItemDto[] =>
    list.map((item) => (mutatedItems[item.Id] ? { ...item, ...mutatedItems[item.Id] } : item));

  const handleRemoveFromResume = async (item: BaseItemDto) => {
    if (!serverUrl || !accessToken || !user) return;
    const prevResume = resumeItems;
    const prevNextUp = nextUpItems;
    setResumeItems((list) => list.filter((i) => i.Id !== item.Id));
    try {
      await jellyfinApi.removeFromResume(serverUrl, accessToken, user.Id, item.Id);
      const updatedNextUp = await jellyfinApi
        .getNextUpItems(serverUrl, accessToken, user.Id)
        .catch(() => prevNextUp);
      setNextUpItems(updatedNextUp);
    } catch {
      setResumeItems(prevResume);
      setNextUpItems(prevNextUp);
    }
  };

  const handleRemoveFromNextUp = async (item: BaseItemDto) => {
    if (!serverUrl || !accessToken || !user) return;
    const prevNextUp = nextUpItems;
    const prevResume = resumeItems;
    setNextUpItems((list) =>
      list.filter((i) => i.Id !== item.Id && (!item.SeriesId || i.SeriesId !== item.SeriesId))
    );
    setResumeItems((list) => list.filter((i) => i.Id !== item.Id));
    try {
      await jellyfinApi.removeFromNextUp(serverUrl, accessToken, user.Id, item);
    } catch {
      setNextUpItems(prevNextUp);
      setResumeItems(prevResume);
    }
  };

  const hydratedFeatured = hydrate(featured);
  const hydratedFavs = hydrate(favorites);

  const dedupedNextUpItems = useMemo(() => {
    const resumeIds = new Set(resumeItems.map((entry) => entry.Id));
    const resumeSeriesIds = new Set(
      resumeItems.map((entry) => entry.SeriesId).filter((id): id is string => Boolean(id))
    );
    return nextUpItems.filter(
      (entry) =>
        !resumeIds.has(entry.Id) && (!entry.SeriesId || !resumeSeriesIds.has(entry.SeriesId))
    );
  }, [resumeItems, nextUpItems]);

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
          seeAllTo="/peliculas"
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />

        <MediaRow
          title={t.home.recentSeries}
          items={hydrate(latestSeries)}
          seeAllTo="/series"
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
        />

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
            seeAllTo="/mi-lista"
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
