import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  Clapperboard,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Film,
  FolderPlus,
  Layers,
  ListPlus,
  ListVideo,
  Music,
  Play,
  Plus,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User as UserIcon,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { usePreferences } from '../../app/providers/PreferencesProvider';
import { jellyfinApi } from '../../shared/api/jellyfin';
import {
  getItemDownloadUrl,
  getItemImageUrl,
  getPersonImageUrl,
  getThemeAudioUrl,
} from '../../shared/api/playback';
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
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);
  const [playlists, setPlaylists] = useState<BaseItemDto[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistFeedback, setPlaylistFeedback] = useState<string | null>(null);
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false);
  const [collections, setCollections] = useState<BaseItemDto[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistPublic, setEditPlaylistPublic] = useState(false);
  const [playlistSavedFlag, setPlaylistSavedFlag] = useState(false);
  const [shareUserId, setShareUserId] = useState('');
  const [shareCanEdit, setShareCanEdit] = useState(false);
  const [playingThemeAudio, setPlayingThemeAudio] = useState(false);
  const themeAudioRef = useRef<HTMLAudioElement | null>(null);

  const {
    detail,
    seasons,
    selectedSeasonId,
    episodes,
    collectionItems,
    personCredits,
    trailers,
    specialFeatures,
    additionalParts,
    similar,
    externalIds,
    itemCollections,
    ancestors,
    themeSongs,
    playlistMeta,
    playlistUsers,
    publicUsers,
    loadingEpisodes,
    handleSeasonChange,
    handleToggleFavorite,
    handleTogglePlayed,
    handleSetRating,
    handleRemoveFromPlaylist,
    handleMovePlaylistItem,
    handleUpdatePlaylist,
    handleSetPlaylistUser,
    handleRemovePlaylistUser,
    handleRemoveFromCollection,
  } = useMediaDetail({
    item,
    serverUrl,
    accessToken,
    userId: user?.Id,
    onItemMutated,
  });

  useEffect(() => {
    setLogoFailed(false);
    setPlaylistPickerOpen(false);
    setCollectionPickerOpen(false);
    setPlaylistFeedback(null);
    setPlaylistSavedFlag(false);
    setPlayingThemeAudio(false);
    if (themeAudioRef.current) {
      themeAudioRef.current.pause();
      themeAudioRef.current = null;
    }
  }, [item]);

  useEffect(() => {
    setEditPlaylistName(detail.Name);
  }, [detail.Name]);

  useEffect(() => {
    if (playlistMeta) {
      setEditPlaylistPublic(Boolean(playlistMeta.OpenAccess));
    }
  }, [playlistMeta]);

  useEffect(() => {
    return () => {
      if (themeAudioRef.current) {
        themeAudioRef.current.pause();
        themeAudioRef.current = null;
      }
    };
  }, []);

  const handleOpenPlaylistPicker = async () => {
    const nextOpen = !playlistPickerOpen;
    setPlaylistPickerOpen(nextOpen);
    setCollectionPickerOpen(false);
    setPlaylistFeedback(null);
    if (nextOpen && serverUrl && accessToken && user) {
      const list = await jellyfinApi.getPlaylists(serverUrl, accessToken, user.Id).catch(() => []);
      setPlaylists(list);
    }
  };

  const handleOpenCollectionPicker = async () => {
    const nextOpen = !collectionPickerOpen;
    setCollectionPickerOpen(nextOpen);
    setPlaylistPickerOpen(false);
    setPlaylistFeedback(null);
    if (nextOpen && serverUrl && accessToken && user) {
      const res = await jellyfinApi
        .getItems(serverUrl, accessToken, user.Id, {
          includeItemTypes: 'BoxSet',
          sortBy: 'SortName',
          sortOrder: 'Ascending',
          limit: 100,
        })
        .catch(() => ({ Items: [], TotalRecordCount: 0 }));
      setCollections(res.Items);
    }
  };

  const handleAddToExistingCollection = async (col: BaseItemDto) => {
    if (!serverUrl || !accessToken) return;
    await jellyfinApi.addToCollection(serverUrl, accessToken, col.Id, [detail.Id]);
    setPlaylistFeedback(t.detail.addedToCollection(col.Name));
    setCollectionPickerOpen(false);
  };

  const handleCreateCollectionWithItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !newCollectionName.trim()) return;
    const title = newCollectionName.trim();
    await jellyfinApi.createCollection(serverUrl, accessToken, title, [detail.Id]);
    setNewCollectionName('');
    setPlaylistFeedback(t.detail.addedToCollection(title));
    setCollectionPickerOpen(false);
  };

  const handleToggleThemeMusic = () => {
    if (playingThemeAudio && themeAudioRef.current) {
      themeAudioRef.current.pause();
      themeAudioRef.current = null;
      setPlayingThemeAudio(false);
      return;
    }
    const song = themeSongs[0];
    if (!song || !serverUrl || !accessToken) return;
    const audioUrl = getThemeAudioUrl(serverUrl, song.Id, accessToken);
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.volume = 0.45;
    audio.onended = () => setPlayingThemeAudio(false);
    void audio.play().catch(() => setPlayingThemeAudio(false));
    themeAudioRef.current = audio;
    setPlayingThemeAudio(true);
  };

  const handleAddToExistingPlaylist = async (pl: BaseItemDto) => {
    if (!serverUrl || !accessToken || !user) return;
    await jellyfinApi.addToPlaylist(serverUrl, accessToken, user.Id, pl.Id, [detail.Id]);
    setPlaylistFeedback(t.detail.addedToPlaylist(pl.Name));
    setPlaylistPickerOpen(false);
  };

  const handleCreatePlaylistWithItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl || !accessToken || !user || !newPlaylistName.trim()) return;
    const title = newPlaylistName.trim();
    await jellyfinApi.createPlaylist(serverUrl, accessToken, user.Id, title, [detail.Id]);
    setNewPlaylistName('');
    setPlaylistFeedback(t.detail.addedToPlaylist(title));
    setPlaylistPickerOpen(false);
  };

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
    if ((detail.Type === 'BoxSet' || detail.Type === 'Playlist') && collectionItems.length > 0) {
      onPlay(collectionItems[0], detail.Type === 'Playlist' ? collectionItems : undefined);
      return;
    }
    onPlay(detail);
  };

  const isPerson = detail.Type === 'Person';
  const backdropUrl = isPerson
    ? getPersonImageUrl(serverUrl, detail.Id, detail.ImageTags?.Primary)
    : getItemImageUrl(serverUrl, detail, 'Backdrop', 1600);
  const logoUrl = !isPerson && !logoFailed ? getItemImageUrl(serverUrl, detail, 'Logo', 600) : null;
  const localTrailer = trailers[0];
  const remoteTrailerUrl = detail.RemoteTrailers?.find((rt) =>
    Boolean(rt.Url && /^https?:\/\//i.test(rt.Url))
  )?.Url;
  const durationLabel = formatDurationFromTicks(detail.RunTimeTicks);
  const isFavorite = Boolean(detail.UserData?.IsFavorite);
  const isPlayed = Boolean(detail.UserData?.Played);
  const userLikes = detail.UserData?.Likes;
  const downloadUrl =
    detail.CanDownload && accessToken
      ? getItemDownloadUrl(serverUrl, detail.Id, accessToken)
      : null;
  const hasThemeMusic = Boolean(themeSongs.length > 0 && accessToken);
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

            {!isPerson && (
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={handlePrimaryPlay}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-bold text-sm sm:text-base hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg"
                >
                  <Play className="w-5 h-5 fill-black" />
                  {hasResume ? t.common.resume : t.common.play}
                </button>

                {localTrailer ? (
                  <button
                    type="button"
                    onClick={() => onPlay(localTrailer)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all"
                  >
                    <Clapperboard className="w-4 h-4" />
                    <span>{t.detail.watchTrailer}</span>
                  </button>
                ) : remoteTrailerUrl ? (
                  <a
                    href={remoteTrailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-all"
                  >
                    <Clapperboard className="w-4 h-4" />
                    <span>{t.detail.watchTrailer}</span>
                  </a>
                ) : null}

                {detail.Type !== 'BoxSet' && detail.Type !== 'Playlist' && (
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

                    <button
                      type="button"
                      onClick={() => void handleSetRating(true)}
                      title={t.detail.likeTitle}
                      aria-label={t.detail.likeTitle}
                      className={`p-2.5 rounded-lg border transition-all ${
                        userLikes === true
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-white/10 border-white/25 text-zinc-200 hover:bg-white/20'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSetRating(false)}
                      title={t.detail.dislikeTitle}
                      aria-label={t.detail.dislikeTitle}
                      className={`p-2.5 rounded-lg border transition-all ${
                        userLikes === false
                          ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                          : 'bg-white/10 border-white/25 text-zinc-200 hover:bg-white/20'
                      }`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>

                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t.detail.downloadItem}
                        aria-label={t.detail.downloadItem}
                        className="p-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-zinc-200 transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    {hasThemeMusic && (
                      <button
                        type="button"
                        onClick={handleToggleThemeMusic}
                        title={playingThemeAudio ? t.detail.themeMusicStop : t.detail.themeMusicPlay}
                        className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                          playingThemeAudio
                            ? 'bg-[#00A4DC]/20 border-[#00A4DC] text-[#7dd3fc]'
                            : 'bg-white/10 border-white/25 text-zinc-200 hover:bg-white/20'
                        }`}
                      >
                        {playingThemeAudio ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">
                          {playingThemeAudio ? t.detail.themeMusicStop : t.detail.themeMusicPlay}
                        </span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => void handleOpenCollectionPicker()}
                        title={t.detail.addToCollection}
                        aria-label={t.detail.addToCollection}
                        className="p-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-zinc-200 transition-all"
                      >
                        <FolderPlus className="w-5 h-5" />
                      </button>

                      {collectionPickerOpen && (
                        <div className="absolute left-0 bottom-12 z-40 w-64 rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            {t.detail.addToCollection}
                          </p>
                          {collections.length > 0 && (
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {collections.map((col) => (
                                <button
                                  key={col.Id}
                                  type="button"
                                  onClick={() => void handleAddToExistingCollection(col)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-zinc-200 hover:bg-white/10 truncate"
                                >
                                  {col.Name}
                                </button>
                              ))}
                            </div>
                          )}
                          <form onSubmit={handleCreateCollectionWithItem} className="flex gap-1.5 pt-1 border-t border-white/10">
                            <input
                              type="text"
                              value={newCollectionName}
                              onChange={(e) => setNewCollectionName(e.target.value)}
                              placeholder={t.detail.collectionNamePlaceholder}
                              className="flex-1 min-w-0 bg-[#0a0a0e] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                            />
                            <button
                              type="submit"
                              disabled={!newCollectionName.trim()}
                              className="px-2.5 py-1.5 rounded-lg bg-[#00A4DC] text-black font-bold text-xs disabled:opacity-50"
                            >
                              {t.detail.createAndAdd}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => void handleOpenPlaylistPicker()}
                        title={t.detail.addToPlaylist}
                        aria-label={t.detail.addToPlaylist}
                        className="p-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 text-zinc-200 transition-all"
                      >
                        <ListPlus className="w-5 h-5" />
                      </button>

                      {playlistPickerOpen && (
                        <div className="absolute left-0 bottom-12 z-40 w-64 rounded-xl bg-[#141620]/95 backdrop-blur-xl border border-white/15 p-3 shadow-2xl space-y-2.5">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            {t.detail.addToPlaylist}
                          </p>
                          {playlists.length > 0 && (
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {playlists.map((pl) => (
                                <button
                                  key={pl.Id}
                                  type="button"
                                  onClick={() => void handleAddToExistingPlaylist(pl)}
                                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-zinc-200 hover:bg-white/10 truncate"
                                >
                                  {pl.Name}
                                </button>
                              ))}
                            </div>
                          )}
                          <form onSubmit={handleCreatePlaylistWithItem} className="flex gap-1.5 pt-1 border-t border-white/10">
                            <input
                              type="text"
                              value={newPlaylistName}
                              onChange={(e) => setNewPlaylistName(e.target.value)}
                              placeholder={t.detail.playlistNamePlaceholder}
                              className="flex-1 min-w-0 bg-[#0a0a0e] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#00A4DC]"
                            />
                            <button
                              type="submit"
                              disabled={!newPlaylistName.trim()}
                              className="px-2.5 py-1.5 rounded-lg bg-[#00A4DC] text-black font-bold text-xs disabled:opacity-50"
                            >
                              {t.detail.createAndAdd}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {playlistFeedback && (
                  <span className="text-xs font-semibold text-emerald-400 px-2">
                    {playlistFeedback}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata, episodes, cast, and similar titles body */}
        <div className="p-5 sm:p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${isPerson ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
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
            {!isPerson && (
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
                {itemCollections.length > 0 && (
                  <div>
                    <span className="text-zinc-400">{t.detail.collectionsLabel} </span>
                    <span className="inline-flex flex-wrap gap-1.5 mt-1">
                      {itemCollections.map((col) => (
                        <button
                          key={col.Id}
                          type="button"
                          onClick={() => onSelectItem(col)}
                          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-xs text-[#7dd3fc] font-medium"
                        >
                          {col.Name}
                        </button>
                      ))}
                    </span>
                  </div>
                )}
                {ancestors.length > 1 && (
                  <div>
                    <span className="text-zinc-400">{t.detail.ancestorsLabel} </span>
                    <span className="text-zinc-300">
                      {ancestors
                        .slice()
                        .reverse()
                        .slice(0, -1)
                        .map((a) => a.Name)
                        .join(' › ')}
                    </span>
                  </div>
                )}
                {(detail.ExternalUrls?.length || externalIds.length > 0) && (
                  <div>
                    <span className="text-zinc-400">{t.detail.externalIdsLabel} </span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(detail.ExternalUrls ?? []).map((ext) =>
                        ext.Url ? (
                          <a
                            key={ext.Url}
                            href={ext.Url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-xs text-zinc-200"
                          >
                            <span>{ext.Name}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null
                      )}
                      {(!detail.ExternalUrls || detail.ExternalUrls.length === 0) &&
                        externalIds.map((info) =>
                          info.Name ? (
                            <span
                              key={info.Name}
                              className="px-2 py-0.5 rounded bg-white/10 text-xs text-zinc-300"
                            >
                              {info.Name}
                            </span>
                          ) : null
                        )}
                    </div>
                  </div>
                )}
                <div>
                  <span className="text-zinc-400">{t.detail.format} </span>
                  <span className="text-zinc-100">
                    {detail.Type === 'Series'
                      ? t.detail.formatSeries
                      : detail.Type === 'BoxSet'
                        ? t.detail.formatCollection
                        : detail.Type === 'Playlist'
                          ? t.detail.formatPlaylist
                          : t.detail.formatMovie}
                  </span>
                </div>
              </div>
            )}
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

          {/* Collection or Playlist items */}
          {(detail.Type === 'BoxSet' || detail.Type === 'Playlist') && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {detail.Type === 'Playlist' ? (
                  <ListVideo className="w-5 h-5 text-[#00A4DC]" />
                ) : (
                  <Layers className="w-5 h-5 text-[#AA5CC3]" />
                )}
                {detail.Type === 'Playlist' ? t.detail.playlistItems : t.detail.collectionItems}
              </h3>

              {detail.Type === 'Playlist' && (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {t.detail.playlistSettingsTitle}
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await handleUpdatePlaylist(editPlaylistName, editPlaylistPublic);
                      setPlaylistSavedFlag(true);
                    }}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input
                      type="text"
                      value={editPlaylistName}
                      onChange={(e) => {
                        setEditPlaylistName(e.target.value);
                        setPlaylistSavedFlag(false);
                      }}
                      placeholder={t.detail.playlistRenamePlaceholder}
                      className="flex-1 min-w-[180px] bg-[#0a0a0e] border border-white/15 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-[#00A4DC]"
                    />
                    <label className="inline-flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPlaylistPublic}
                        onChange={(e) => {
                          setEditPlaylistPublic(e.target.checked);
                          setPlaylistSavedFlag(false);
                        }}
                        className="w-4 h-4 accent-[#00A4DC]"
                      />
                      <span>{t.detail.playlistPublicLabel}</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-[#00A4DC] text-black font-bold text-xs"
                    >
                      {t.detail.playlistSaveBtn}
                    </button>
                    {playlistSavedFlag && (
                      <span className="text-xs text-emerald-400 font-semibold">
                        {t.detail.playlistSaved}
                      </span>
                    )}
                  </form>

                  {publicUsers.length > 0 && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <p className="text-xs font-semibold text-zinc-300">
                        {t.detail.playlistShareTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={shareUserId}
                          onChange={(e) => setShareUserId(e.target.value)}
                          className="bg-[#0a0a0e] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        >
                          <option value="">{t.detail.playlistShareSelectUser}</option>
                          {publicUsers
                            .filter((u) => u.Id !== user?.Id)
                            .map((u) => (
                              <option key={u.Id} value={u.Id}>
                                {u.Name}
                              </option>
                            ))}
                        </select>
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shareCanEdit}
                            onChange={(e) => setShareCanEdit(e.target.checked)}
                            className="w-3.5 h-3.5 accent-[#00A4DC]"
                          />
                          <span>{t.detail.playlistShareCanEdit}</span>
                        </label>
                        <button
                          type="button"
                          disabled={!shareUserId}
                          onClick={() => void handleSetPlaylistUser(shareUserId, shareCanEdit)}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-40"
                        >
                          {t.detail.playlistShareAddBtn}
                        </button>
                      </div>
                      {playlistUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {playlistUsers.map((perm) => {
                            const matchedUser = publicUsers.find((u) => u.Id === perm.UserId);
                            return (
                              <span
                                key={perm.UserId}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-xs text-zinc-200"
                              >
                                <span>{matchedUser?.Name ?? perm.UserId}</span>
                                <button
                                  type="button"
                                  onClick={() => void handleRemovePlaylistUser(perm.UserId)}
                                  title={t.detail.playlistShareRemoveBtn}
                                  className="text-rose-300 hover:text-rose-200"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {collectionItems.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {collectionItems.map((colItem, colIdx) => {
                    const poster = getItemImageUrl(serverUrl, colItem, 'Primary', 400);
                    return (
                      <div
                        key={`${colItem.PlaylistItemId ?? colItem.Id}`}
                        className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181a24] ring-1 ring-white/10 hover:ring-white/40 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            detail.Type === 'Playlist'
                              ? onPlay(colItem, collectionItems)
                              : onSelectItem(colItem)
                          }
                          className="w-full h-full text-left"
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

                        {detail.Type === 'Playlist' && colItem.PlaylistItemId && (
                          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                            {colIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => void handleMovePlaylistItem(colItem, colIdx - 1)}
                                title={t.detail.moveUp}
                                aria-label={t.detail.moveUp}
                                className="w-7 h-7 rounded-full bg-black/70 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center transition-colors"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {colIdx < collectionItems.length - 1 && (
                              <button
                                type="button"
                                onClick={() => void handleMovePlaylistItem(colItem, colIdx + 1)}
                                title={t.detail.moveDown}
                                aria-label={t.detail.moveDown}
                                className="w-7 h-7 rounded-full bg-black/70 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center transition-colors"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleRemoveFromPlaylist(colItem)}
                              title={t.detail.removeFromPlaylist}
                              aria-label={t.detail.removeFromPlaylist}
                              className="w-7 h-7 rounded-full bg-black/70 hover:bg-rose-600/90 text-white border border-white/15 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {detail.Type === 'BoxSet' && (
                          <button
                            type="button"
                            onClick={() => void handleRemoveFromCollection(colItem)}
                            title={t.detail.removeFromCollection}
                            aria-label={t.detail.removeFromCollection}
                            className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/70 hover:bg-rose-600/90 text-white border border-white/15 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Person filmography */}
          {isPerson && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-[#00A4DC]" />
                {t.detail.filmography}
              </h3>
              {personCredits.length === 0 ? (
                <p className="text-sm text-zinc-400">{t.detail.noPersonCredits}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {personCredits.map((credit) => {
                    const poster = getItemImageUrl(serverUrl, credit, 'Primary', 400);
                    return (
                      <button
                        key={credit.Id}
                        type="button"
                        onClick={() => onSelectItem(credit)}
                        className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-[#181a24] ring-1 ring-white/10 hover:ring-white/40 transition-all text-left"
                      >
                        {poster ? (
                          <img
                            src={poster}
                            alt={credit.Name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-3 text-center text-sm font-bold">
                            {credit.Name}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3">
                          <span className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                            {credit.Name}
                          </span>
                          {credit.ProductionYear && (
                            <span className="text-[11px] text-zinc-400">{credit.ProductionYear}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Additional parts */}
          {additionalParts.length > 0 && (
            <section className="space-y-3 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Film className="w-5 h-5 text-[#00A4DC]" />
                {t.detail.additionalPartsTitle}
              </h3>
              <div className="flex flex-wrap gap-2.5">
                {additionalParts.map((part) => (
                  <button
                    key={part.Id}
                    type="button"
                    onClick={() => onPlay(part)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs sm:text-sm font-semibold text-white transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>{part.Name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Special features / extras */}
          {specialFeatures.length > 0 && (
            <section className="space-y-3 pt-2 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-[#00A4DC]" />
                {t.detail.extrasTitle}
              </h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {specialFeatures.map((extra) => {
                  const thumb = getItemImageUrl(serverUrl, extra, 'Backdrop', 480);
                  return (
                    <button
                      key={extra.Id}
                      type="button"
                      onClick={() => onPlay(extra)}
                      className="group flex-shrink-0 w-56 rounded-xl overflow-hidden bg-[#181a24] border border-white/10 hover:border-white/30 text-left transition-all"
                    >
                      <div className="relative aspect-video bg-black/50">
                        {thumb && (
                          <img
                            src={thumb}
                            alt={extra.Name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow">
                            <Play className="w-4 h-4 fill-black ml-0.5" />
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 space-y-0.5">
                        <p className="text-xs font-semibold text-white line-clamp-1">{extra.Name}</p>
                        {extra.RunTimeTicks && (
                          <p className="text-[11px] text-zinc-400">
                            {formatDurationFromTicks(extra.RunTimeTicks)}
                          </p>
                        )}
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
                    <button
                      key={`${person.Id}-${person.Name}`}
                      type="button"
                      onClick={() =>
                        onSelectItem({
                          Id: person.Id,
                          Name: person.Name,
                          Type: 'Person',
                          ImageTags: person.PrimaryImageTag
                            ? { Primary: person.PrimaryImageTag }
                            : undefined,
                        })
                      }
                      aria-label={t.detail.viewPersonAria(person.Name)}
                      className="group flex-shrink-0 w-28 sm:w-32 text-center space-y-1.5 rounded-xl p-1.5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white/10 ring-1 ring-white/15 group-hover:ring-[#00A4DC] transition-all flex items-center justify-center">
                        {photo ? (
                          <img
                            src={photo}
                            alt={person.Name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      <p className="text-xs font-semibold text-white group-hover:text-[#7dd3fc] line-clamp-2 leading-snug transition-colors">
                        {person.Name}
                      </p>
                      {person.Role && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-snug">
                          {person.Role}
                        </p>
                      )}
                    </button>
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
