import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Eye,
  Film,
  Layers,
  Play,
  Plus,
  Star,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { getItemImageUrl, getPersonImageUrl } from '../../shared/api/playback';
import { BaseItemDto } from '../../shared/types/jellyfin';
import { formatDurationFromTicks } from '../../shared/utils/time';
import { useMediaDetail } from './hooks/useMediaDetail';

interface DetailModalProps {
  item: BaseItemDto;
  onClose: () => void;
  onPlay: (item: BaseItemDto, episodeQueue?: BaseItemDto[]) => void;
  onSelectItem: (item: BaseItemDto) => void;
  onItemMutated: (updated: BaseItemDto) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onPlay,
  onSelectItem,
  onItemMutated,
}) => {
  const { serverUrl, accessToken, user } = useAuth();
  const { t } = usePreferences();
  const [logoFailed, setLogoFailed] = useState(false);

  const {
    detail,
    seasons,
    selectedSeasonId,
    episodes,
    collectionItems,
    similar,
    loadingEpisodes,
    handleSeasonChange,
    handleToggleFavorite,
    handleTogglePlayed,
  } = useMediaDetail({
    item,
    serverUrl,
    accessToken,
    userId: user?.Id,
    onItemMutated,
  });

  useEffect(() => {
    setLogoFailed(false);
  }, [item]);

  // Lock document scroll while modal is open and handle Escape key
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handlePrimaryPlay = () => {
    if (detail.Type === 'Series' && episodes.length > 0) {
      const resumable =
        episodes.find((ep) => (ep.UserData?.PlaybackPositionTicks ?? 0) > 0) ??
        episodes.find((ep) => !ep.UserData?.Played) ??
        episodes[0];
      onPlay(resumable, episodes);
      return;
    }
    if (detail.Type === 'BoxSet' && collectionItems.length > 0) {
      onPlay(collectionItems[0]);
      return;
    }
    onPlay(detail);
  };

  const backdropUrl = getItemImageUrl(serverUrl, detail, 'Backdrop', 1600);
  const logoUrl = !logoFailed ? getItemImageUrl(serverUrl, detail, 'Logo', 600) : null;
  const durationLabel = formatDurationFromTicks(detail.RunTimeTicks);
  const isFavorite = Boolean(detail.UserData?.IsFavorite);
  const isPlayed = Boolean(detail.UserData?.Played);
  const hasResume = (detail.UserData?.PlaybackPositionTicks ?? 0) > 0;
  const cast = (detail.People ?? []).filter((p) => p.Type === 'Actor' || !p.Type).slice(0, 12);
  const videoStream = detail.MediaStreams?.find((s) => s.Type === 'Video');
  const is4k = (videoStream?.Width ?? 0) >= 3800;
  const isHd = !is4k && (videoStream?.Width ?? 0) >= 1200;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={detail.Name}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto overscroll-contain px-2 sm:px-6 py-4 sm:py-10 flex justify-center items-start"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-2xl overflow-hidden bg-[#12131a] border border-white/15 shadow-[0_25px_90px_rgba(0,0,0,0.9)] animate-scaleIn my-auto"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t.detail.closeAria}
          className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 16:9 panoramic header */}
        <div className="relative aspect-video max-h-[480px] w-full overflow-hidden bg-[#0a0a0e]">
          {backdropUrl ? (
            <img
              src={backdropUrl}
              alt={detail.Name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2d1a3e] via-[#142033] to-[#12131a]" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-[#12131a] via-[#12131a]/40 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#12131a]/85 via-transparent to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 sm:bottom-8 sm:left-8 sm:right-8 flex flex-col gap-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={detail.Name}
                onError={() => setLogoFailed(true)}
                className="max-h-20 sm:max-h-28 max-w-[75%] object-contain object-left drop-shadow-xl"
              />
            ) : (
              <h2 className="text-2xl sm:text-4xl font-black text-white drop-shadow-lg leading-tight">
                {detail.Name}
              </h2>
            )}

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handlePrimaryPlay}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-bold text-sm sm:text-base hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
              >
                <Play className="w-5 h-5 fill-black" />
                {hasResume ? t.common.resume : t.common.play}
              </button>

              {detail.Type !== 'BoxSet' && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    title={isFavorite ? t.detail.removeFromList : t.detail.addToList}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                      isFavorite
                        ? 'bg-[#00A4DC]/20 border-[#00A4DC] text-[#7dd3fc]'
                        : 'bg-white/10 border-white/25 text-white hover:bg-white/20'
                    }`}
                  >
                    {isFavorite ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>{isFavorite ? t.detail.inMyList : t.detail.myList}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTogglePlayed}
                    title={isPlayed ? t.detail.markUnplayed : t.detail.markPlayed}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isPlayed
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-white/10 border-white/25 text-zinc-200 hover:bg-white/20'
                    }`}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Metadata, episodes, cast, and similar titles body */}
        <div className="p-5 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2.5 text-sm text-zinc-300">
                {detail.CommunityRating && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                    <Star className="w-4 h-4 fill-emerald-400" />
                    {detail.CommunityRating.toFixed(1)}
                  </span>
                )}
                {detail.ProductionYear && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    {detail.ProductionYear}
                  </span>
                )}
                {detail.OfficialRating && (
                  <span className="px-2 py-0.5 rounded border border-white/25 bg-white/5 text-xs font-semibold text-white">
                    {detail.OfficialRating}
                  </span>
                )}
                {durationLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    {durationLabel}
                  </span>
                )}
                {is4k && (
                  <span className="px-2 py-0.5 rounded bg-gradient-to-r from-[#AA5CC3]/30 to-[#00A4DC]/30 border border-[#00A4DC]/40 text-xs font-bold text-white">
                    4K UHD
                  </span>
                )}
                {isHd && (
                  <span className="px-2 py-0.5 rounded bg-white/10 text-xs font-semibold text-zinc-200">
                    HD
                  </span>
                )}
              </div>

              {detail.Taglines?.[0] && (
                <p className="text-sm italic text-[#7dd3fc] font-medium">
                  “{detail.Taglines[0]}”
                </p>
              )}

              <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
                {detail.Overview || t.detail.noOverview}
              </p>
            </div>

            {/* Right quick info column */}
            <div className="space-y-2.5 text-xs sm:text-sm bg-white/[0.03] border border-white/10 rounded-xl p-4 h-fit">
              {detail.Genres && detail.Genres.length > 0 && (
                <div>
                  <span className="text-zinc-400">{t.detail.genres} </span>
                  <span className="text-zinc-100 font-medium">{detail.Genres.join(', ')}</span>
                </div>
              )}
              {detail.OriginalTitle && detail.OriginalTitle !== detail.Name && (
                <div>
                  <span className="text-zinc-400">{t.detail.originalTitle} </span>
                  <span className="text-zinc-100">{detail.OriginalTitle}</span>
                </div>
              )}
              {detail.Studios && detail.Studios.length > 0 && (
                <div>
                  <span className="text-zinc-400">{t.detail.studio} </span>
                  <span className="text-zinc-100">
                    {detail.Studios.map((s) => s.Name).join(', ')}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-400">{t.detail.format} </span>
                <span className="text-zinc-100">
                  {detail.Type === 'Series'
                    ? t.detail.formatSeries
                    : detail.Type === 'BoxSet'
                      ? t.detail.formatCollection
                      : t.detail.formatMovie}
                </span>
              </div>
            </div>
          </div>

          {/* Seasons & Episodes (for Series) */}
          {detail.Type === 'Series' && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-[#00A4DC]" />
                  {t.detail.episodes}
                </h3>

                {seasons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {seasons.map((season) => (
                      <button
                        key={season.Id}
                        type="button"
                        onClick={() => handleSeasonChange(season.Id)}
                        className={`px-4 py-2 min-h-[38px] rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                          selectedSeasonId === season.Id
                            ? 'bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC] text-white shadow'
                            : 'bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {season.Name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loadingEpisodes ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-24 rounded-xl bg-white/5 animate-pulse" />
                  ))}
                </div>
              ) : episodes.length === 0 ? (
                <p className="text-sm text-zinc-400">{t.detail.noEpisodesInSeason}</p>
              ) : (
                <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#0d0e14]/70 overflow-hidden">
                  {episodes.map((ep, index) => {
                    const epThumb = getItemImageUrl(serverUrl, ep, 'Primary', 480);
                    const epDuration = formatDurationFromTicks(ep.RunTimeTicks);
                    const epProgress =
                      typeof ep.UserData?.PlayedPercentage === 'number'
                        ? ep.UserData.PlayedPercentage
                        : ep.UserData?.PlaybackPositionTicks && ep.RunTimeTicks
                          ? Math.round((ep.UserData.PlaybackPositionTicks / ep.RunTimeTicks) * 100)
                          : 0;

                    return (
                      <button
                        key={ep.Id}
                        type="button"
                        onClick={() => onPlay(ep, episodes)}
                        className="w-full text-left p-3 sm:p-4 hover:bg-white/[0.06] transition-colors flex flex-col sm:flex-row items-start sm:items-center gap-4 group"
                      >
                        <div className="hidden sm:flex w-7 justify-center text-lg font-bold text-zinc-500 group-hover:text-white">
                          {ep.IndexNumber ?? index + 1}
                        </div>

                        <div className="relative w-full sm:w-44 aspect-video rounded-lg overflow-hidden bg-black/50 shrink-0 ring-1 ring-white/10">
                          {epThumb ? (
                            <img
                              src={epThumb}
                              alt={ep.Name}
                              loading="lazy"
                              className="w-full h-full object-cover [@media(hover:hover)]:group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#232638] to-[#12131a]" />
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-black ml-0.5" />
                            </div>
                          </div>
                          {epProgress > 0 && (
                            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                              <div
                                className="h-full bg-gradient-to-r from-[#AA5CC3] to-[#00A4DC]"
                                style={{ width: `${Math.min(100, epProgress)}%` }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm sm:text-base font-bold text-white truncate">
                              {ep.IndexNumber ? `${ep.IndexNumber}. ` : ''}
                              {ep.Name}
                            </h4>
                            {epDuration && (
                              <span className="text-xs text-zinc-400 shrink-0">{epDuration}</span>
                            )}
                          </div>
                          {ep.Overview && (
                            <p className="text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
                              {ep.Overview}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Collection items (for BoxSet) */}
          {detail.Type === 'BoxSet' && collectionItems.length > 0 && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#AA5CC3]" />
                {t.detail.collectionItems}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {collectionItems.map((colItem) => {
                  const poster = getItemImageUrl(serverUrl, colItem, 'Primary', 400);
                  return (
                    <button
                      key={colItem.Id}
                      type="button"
                      onClick={() => onSelectItem(colItem)}
                      className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181a24] ring-1 ring-white/10 hover:ring-white/40 transition-all text-left"
                    >
                      {poster ? (
                        <img
                          src={poster}
                          alt={colItem.Name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-3 text-center text-sm font-bold">
                          {colItem.Name}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-3">
                        <span className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                          {colItem.Name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Main cast */}
          {cast.length > 0 && (
            <section className="space-y-3 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white">{t.detail.cast}</h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {cast.map((person) => {
                  const photo = getPersonImageUrl(serverUrl, person.Id, person.PrimaryImageTag);
                  return (
                    <div
                      key={`${person.Id}-${person.Name}`}
                      className="flex-shrink-0 w-28 sm:w-32 text-center space-y-1.5"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
                        {photo ? (
                          <img
                            src={photo}
                            alt={person.Name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-bold text-zinc-300">
                            {person.Name
                              .split(' ')
                              .slice(0, 2)
                              .map((w) => w[0])
                              .join('')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                        {person.Name}
                      </p>
                      {person.Role && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                          {person.Role}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Similar titles */}
          {similar.length > 0 && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white">{t.detail.similarTitles}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {similar.slice(0, 8).map((simItem) => {
                  const simBackdrop = getItemImageUrl(serverUrl, simItem, 'Backdrop', 500);
                  return (
                    <button
                      key={simItem.Id}
                      type="button"
                      onClick={() => onSelectItem(simItem)}
                      className="group rounded-xl overflow-hidden bg-[#181a24] border border-white/10 hover:border-white/30 transition-all text-left flex flex-col"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                        {simBackdrop ? (
                          <img
                            src={simBackdrop}
                            alt={simItem.Name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-[#272038] to-[#12131a]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#181a24] via-transparent to-transparent" />
                      </div>
                      <div className="p-3 space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                          <span>{simItem.ProductionYear ?? ''}</span>
                          {simItem.CommunityRating && (
                            <span className="text-emerald-400 font-semibold">
                              ★ {simItem.CommunityRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                          {simItem.Name}
                        </h4>
                        {simItem.Overview && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {simItem.Overview}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
