export type Locale = 'en' | 'es';

export const STORAGE_LOCALE_KEY = 'morphplay_locale';

export function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_LOCALE_KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    // Ignore storage access errors in restricted browsing contexts
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language?.toLowerCase() : '';
  return browserLang.startsWith('es') ? 'es' : 'en';
}

export interface TranslationDictionary {
  common: {
    cancel: string;
    close: string;
    back: string;
    play: string;
    resume: string;
    demoMode: string;
    demoShort: string;
    episodeCode: (season: number | undefined, episode: number | undefined) => string;
  };
  language: {
    english: string;
    spanish: string;
    switcherAria: string;
  };
  app: {
    initializing: (appName: string) => string;
  };
  connect: {
    title: string;
    subtitle: string;
    serverUrlLabel: string;
    serverUrlPlaceholder: string;
    hintPrefix: string;
    hintIn: string;
    hintSuffix: string;
    connecting: string;
    connectButton: string;
    or: string;
    tryDemo: string;
    emptyUrlError: string;
    connectFailedPrefix: string;
    unreachableError: string;
  };
  profiles: {
    changeServer: string;
    whoIsWatching: string;
    subtitle: string;
    loadingProfiles: string;
    fetchError: string;
    retry: string;
    manualLogin: string;
    requiresPassword: string;
    forgetProfileAria: (name: string) => string;
    forgetProfileTitle: string;
    otherAccount: string;
    helloUser: (name: string) => string;
    signIn: string;
    enterProfilePassword: string;
    enterRegisteredUser: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    emptyUsernameError: string;
    invalidCredentials: string;
    verifying: string;
    enter: string;
    closeAria: string;
  };
  nav: {
    mainAria: string;
    mobileAria: string;
    home: string;
    movies: string;
    series: string;
    collections: string;
    myList: string;
    searchPlaceholder: string;
    searchAria: string;
    closeSearchAria: string;
    openSearchAria: string;
    searchTitle: string;
    userMenuAria: string;
    profileFallback: string;
    playbackPreferences: string;
    switchProfile: string;
    disconnectServer: string;
  };
  hero: {
    featuredAria: string;
    featuredSeries: string;
    featuredMovie: string;
    moreInfo: string;
    addToList: string;
    removeFromList: string;
    prevFeaturedAria: string;
    nextFeaturedAria: string;
    viewFeaturedAria: (index: number, name: string) => string;
  };
  row: {
    scrollLeftAria: (title: string) => string;
    scrollRightAria: (title: string) => string;
  };
  card: {
    defaultRemove: string;
    playAria: (title: string) => string;
    detailsAria: (title: string) => string;
    moreInfo: string;
    watched: string;
    addToList: string;
    removeFromList: string;
    moreInfoAria: (title: string) => string;
  };
  home: {
    continueWatching: string;
    removeFromContinue: string;
    nextEpisodes: string;
    removeFromNextUp: string;
    recentMovies: string;
    recentSeries: string;
    topRated: string;
    myList: string;
    actionAndAdventure: string;
  };
  catalog: {
    movies: string;
    series: string;
    collections: string;
    favorites: string;
    searchTitle: string;
    searchResultsFor: (query: string) => string;
    emptyMovies: string;
    emptySeries: string;
    emptyCollections: string;
    emptyFavorites: string;
    emptySearch: string;
    loadingTitles: string;
    availableTitles: (count: number) => string;
    searchInputPlaceholder: string;
    searchInputAria: string;
    filterGenreAria: string;
    allGenres: string;
    sortCatalogAria: string;
    clearGenreFilter: string;
    sortRecent: string;
    sortTopRated: string;
    sortReleaseYear: string;
    sortAlpha: string;
  };
  detail: {
    closeAria: string;
    inMyList: string;
    myList: string;
    addToList: string;
    removeFromList: string;
    markUnplayed: string;
    markPlayed: string;
    noOverview: string;
    genres: string;
    originalTitle: string;
    studio: string;
    format: string;
    formatSeries: string;
    formatCollection: string;
    formatMovie: string;
    episodes: string;
    noEpisodesInSeason: string;
    collectionItems: string;
    cast: string;
    similarTitles: string;
  };
  settings: {
    defaultUser: string;
    demoSuffix: string;
    switchProfile: string;
    disconnect: string;
    playbackPreferences: string;
    preferredQuality: string;
    qualityAutoLabel: string;
    qualityAutoDesc: string;
    quality1080Label: string;
    quality1080Desc: string;
    quality720Label: string;
    quality720Desc: string;
    quality480Label: string;
    quality480Desc: string;
    autoPlayNextTitle: string;
    autoPlayNextDesc: string;
    autoSkipIntroTitle: string;
    autoSkipIntroDesc: string;
    preferredAudioLang: string;
    preferredSubtitleLang: string;
    subtitlesOffByDefault: string;
    langSpa: string;
    langEng: string;
    langJpn: string;
    langKor: string;
    langFra: string;
    interfaceLanguageTitle: string;
    interfaceLanguageDesc: string;
    brandTitle: string;
    brandDescPrefix: string;
    brandDescAnd: string;
    brandDescSuffix: string;
    restoreDefault: string;
    preview: string;
    appNameLabel: string;
    logoUrlLabel: string;
    logoUrlPlaceholder: string;
    logoUrlInvalidHint: string;
  };
  player: {
    loadEpisodeError: string;
    noPlaybackSources: string;
    playbackInitError: string;
    hlsLoadError: string;
    preparing: string;
    playbackFailed: string;
    backToCatalog: string;
    skipCredits: string;
    skipRecap: string;
    skipIntro: string;
    nextEpisode: string;
    hideNextPromptAria: string;
    playNow: string;
    nextEpisodeCountdown: (seconds: number) => string;
    pausedBetweenEpisodes: string;
    seriesFinished: string;
    movieFinished: string;
    nextShortLabel: (season: number | undefined, episode: number | undefined) => string;
    watchAgain: string;
    youMightAlsoLike: string;
    backAria: string;
    rewind10Aria: string;
    rewind10Title: string;
    forward10Aria: string;
    forward10Title: string;
    playAria: string;
    pauseAria: string;
    unmuteAria: string;
    muteAria: string;
    volumeAria: string;
    seekPositionAria: string;
    nextEpisodeTitle: string;
    nextShortBtn: string;
    audioTracksTitle: string;
    audioSelectAria: string;
    audioHeading: string;
    trackFallback: (index: number) => string;
    subtitlesTitle: string;
    subtitlesSelectAria: string;
    subtitlesHeading: string;
    subtitlesOff: string;
    noExternalSubtitles: string;
    playbackSpeedAria: string;
    fullscreenTitle: string;
    fullscreenAria: string;
    resumePromptTitle: string;
    resumeFromTime: (time: string) => string;
    startFromBeginning: string;
    savedProgressLabel: (current: string, total?: string) => string;
  };
}

const en: TranslationDictionary = {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    back: 'Back',
    play: 'Play',
    resume: 'Resume',
    demoMode: 'Demo Mode',
    demoShort: 'Demo',
    episodeCode: (season, episode) => `S${season ?? '?'}:E${episode ?? '?'}`,
  },
  language: {
    english: 'English',
    spanish: 'Español',
    switcherAria: 'Select interface language',
  },
  app: {
    initializing: (appName) => `Starting ${appName}…`,
  },
  connect: {
    title: 'Connect your server',
    subtitle: 'Enter your Jellyfin server URL to start exploring your media library.',
    serverUrlLabel: 'Server address',
    serverUrlPlaceholder: 'https://jellyfin.yourdomain.com or 192.168.1.50:8096',
    hintPrefix: 'You can also set',
    hintIn: 'in',
    hintSuffix: 'to skip this step.',
    connecting: 'Connecting…',
    connectButton: 'Connect to server',
    or: 'or',
    tryDemo: 'Try demo mode',
    emptyUrlError: 'Please enter your Jellyfin server address.',
    connectFailedPrefix: 'Connection failed:',
    unreachableError:
      'Unable to reach the Jellyfin server. Check the URL, port (e.g. 8096), and ensure CORS allows connections from this browser.',
  },
  profiles: {
    changeServer: 'Change server',
    whoIsWatching: "Who's watching?",
    subtitle: 'Choose a profile to access your libraries and pick up where you left off.',
    loadingProfiles: 'Loading server profiles…',
    fetchError: 'Could not retrieve server profiles. Make sure the server is online.',
    retry: 'Retry',
    manualLogin: 'Manual sign in',
    requiresPassword: 'Password required',
    forgetProfileAria: (name) => `Forget profile ${name}`,
    forgetProfileTitle: 'Remove profile from this device',
    otherAccount: 'Another account',
    helloUser: (name) => `Hi, ${name}`,
    signIn: 'Sign in',
    enterProfilePassword: 'Enter your profile password to continue.',
    enterRegisteredUser: 'Sign in with an account registered on this server.',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Password (leave blank if none)',
    emptyUsernameError: 'Please enter a username.',
    invalidCredentials: 'Incorrect username or password.',
    verifying: 'Verifying…',
    enter: 'Sign in',
    closeAria: 'Close',
  },
  nav: {
    mainAria: 'Primary navigation',
    mobileAria: 'Mobile navigation',
    home: 'Home',
    movies: 'Movies',
    series: 'Series',
    collections: 'Collections',
    myList: 'My List',
    searchPlaceholder: 'Titles, genres...',
    searchAria: 'Search catalog',
    closeSearchAria: 'Close search',
    openSearchAria: 'Open search',
    searchTitle: 'Search (/)',
    userMenuAria: 'User menu',
    profileFallback: 'Profile',
    playbackPreferences: 'Playback & Settings',
    switchProfile: 'Switch profile',
    disconnectServer: 'Disconnect server',
  },
  hero: {
    featuredAria: 'Featured',
    featuredSeries: 'Featured Series',
    featuredMovie: 'Featured Movie',
    moreInfo: 'More info',
    addToList: 'Add to My List',
    removeFromList: 'Remove from My List',
    prevFeaturedAria: 'Previous featured title',
    nextFeaturedAria: 'Next featured title',
    viewFeaturedAria: (index, name) => `View featured ${index}: ${name}`,
  },
  row: {
    scrollLeftAria: (title) => `Scroll ${title} left`,
    scrollRightAria: (title) => `Scroll ${title} right`,
  },
  card: {
    defaultRemove: 'Remove from this section',
    playAria: (title) => `Play ${title}`,
    detailsAria: (title) => `Details for ${title}`,
    moreInfo: 'More info',
    watched: 'Watched',
    addToList: 'Add to My List',
    removeFromList: 'Remove from My List',
    moreInfoAria: (title) => `More info about ${title}`,
  },
  home: {
    continueWatching: 'Continue Watching',
    removeFromContinue: 'Remove from Continue Watching',
    nextEpisodes: 'Next Up',
    removeFromNextUp: 'Remove from Next Up',
    recentMovies: 'Recently Added Movies',
    recentSeries: 'Recently Added Series',
    topRated: 'Top 10 Highest Rated',
    myList: 'My List',
    actionAndAdventure: 'Action & Adventure',
  },
  catalog: {
    movies: 'Movies',
    series: 'Series',
    collections: 'Collections',
    favorites: 'My List',
    searchTitle: 'Explore catalog',
    searchResultsFor: (query) => `Results for “${query}”`,
    emptyMovies: 'No movies found.',
    emptySeries: 'No series found.',
    emptyCollections: 'No collections configured on the server.',
    emptyFavorites: 'You have not added any titles to My List yet.',
    emptySearch: 'No matches found for your search.',
    loadingTitles: 'Loading titles…',
    availableTitles: (count) => `${count} ${count === 1 ? 'title' : 'titles'} available`,
    searchInputPlaceholder: 'Search movies, series, or genres…',
    searchInputAria: 'Search movies, series, or genres',
    filterGenreAria: 'Filter by genre',
    allGenres: 'All genres',
    sortCatalogAria: 'Sort catalog',
    clearGenreFilter: 'Clear genre filter',
    sortRecent: 'Recently added',
    sortTopRated: 'Highest rated',
    sortReleaseYear: 'Release year',
    sortAlpha: 'Alphabetical (A–Z)',
  },
  detail: {
    closeAria: 'Close details',
    inMyList: 'In My List',
    myList: 'My List',
    addToList: 'Add to My List',
    removeFromList: 'Remove from My List',
    markUnplayed: 'Mark as unplayed',
    markPlayed: 'Mark as watched',
    noOverview: 'No synopsis available on the server.',
    genres: 'Genres:',
    originalTitle: 'Original title:',
    studio: 'Studio:',
    format: 'Format:',
    formatSeries: 'Series',
    formatCollection: 'Collection',
    formatMovie: 'Movie',
    episodes: 'Episodes',
    noEpisodesInSeason: 'No episodes available in this season.',
    collectionItems: 'Titles in this collection',
    cast: 'Cast',
    similarTitles: 'Similar titles',
  },
  settings: {
    defaultUser: 'User',
    demoSuffix: ' (Demo Mode)',
    switchProfile: 'Switch profile',
    disconnect: 'Disconnect',
    playbackPreferences: 'Playback preferences',
    preferredQuality: 'Preferred streaming quality',
    qualityAutoLabel: 'Auto / Direct Play',
    qualityAutoDesc: 'Highest native quality when supported by the browser',
    quality1080Label: 'Full HD 1080p (20 Mbps)',
    quality1080Desc: 'Ideal for Wi-Fi and home fiber connections',
    quality720Label: 'HD 720p (8 Mbps)',
    quality720Desc: 'Balanced smoothness and bandwidth usage',
    quality480Label: 'SD 480p (3 Mbps)',
    quality480Desc: 'Recommended for limited mobile connections',
    autoPlayNextTitle: 'Auto-play next episode',
    autoPlayNextDesc: 'Automatically continue with the next episode when one finishes.',
    autoSkipIntroTitle: 'Auto-skip intro',
    autoSkipIntroDesc: 'Automatically skip intros when the server provides MediaSegments.',
    preferredAudioLang: 'Preferred audio language',
    preferredSubtitleLang: 'Preferred subtitle language',
    subtitlesOffByDefault: 'Off by default',
    langSpa: 'Spanish',
    langEng: 'English',
    langJpn: 'Japanese',
    langKor: 'Korean',
    langFra: 'French',
    interfaceLanguageTitle: 'Interface language',
    interfaceLanguageDesc: 'Choose the display language for menus, buttons, and player controls.',
    brandTitle: 'Brand customization',
    brandDescPrefix: 'Customize the app name and logo in this browser (or globally using',
    brandDescAnd: 'and',
    brandDescSuffix: 'in Docker).',
    restoreDefault: 'Restore default',
    preview: 'Preview',
    appNameLabel: 'Application name',
    logoUrlLabel: 'Logo URL or path (SVG / PNG)',
    logoUrlPlaceholder: 'https://... or /brand/logo.svg',
    logoUrlInvalidHint: 'Use an http(s):// URL, a local /... path, or a data:image/ image.',
  },
  player: {
    loadEpisodeError: 'Could not load the series episode.',
    noPlaybackSources: 'The server returned no valid playback sources.',
    playbackInitError: 'Failed to start media playback.',
    hlsLoadError: 'Could not load the HLS video stream.',
    preparing: 'Preparing playback…',
    playbackFailed: 'Unable to play video',
    backToCatalog: 'Back to catalog',
    skipCredits: 'Skip credits',
    skipRecap: 'Skip recap',
    skipIntro: 'Skip intro',
    nextEpisode: 'Next episode',
    hideNextPromptAria: 'Hide next episode prompt',
    playNow: 'Play now',
    nextEpisodeCountdown: (seconds) => `Next episode in ${seconds} s`,
    pausedBetweenEpisodes: 'Playback paused between episodes',
    seriesFinished: 'Series finished',
    movieFinished: 'Movie finished',
    nextShortLabel: (season, episode) => `Next: S${season ?? '?'}:E${episode ?? '?'}`,
    watchAgain: 'Watch again',
    youMightAlsoLike: 'You might also like',
    backAria: 'Back',
    rewind10Aria: 'Rewind 10 seconds',
    rewind10Title: 'Rewind 10 s (J)',
    forward10Aria: 'Forward 10 seconds',
    forward10Title: 'Forward 10 s (L)',
    playAria: 'Play',
    pauseAria: 'Pause',
    unmuteAria: 'Unmute',
    muteAria: 'Mute',
    volumeAria: 'Volume',
    seekPositionAria: 'Playback position',
    nextEpisodeTitle: 'Next episode',
    nextShortBtn: 'Next',
    audioTracksTitle: 'Audio tracks',
    audioSelectAria: 'Select audio',
    audioHeading: 'Audio',
    trackFallback: (index) => `Track ${index}`,
    subtitlesTitle: 'Subtitles',
    subtitlesSelectAria: 'Select subtitles',
    subtitlesHeading: 'Subtitles',
    subtitlesOff: 'Off',
    noExternalSubtitles: 'No external subtitles available',
    playbackSpeedAria: 'Playback speed',
    fullscreenTitle: 'Fullscreen (F)',
    fullscreenAria: 'Toggle fullscreen',
    resumePromptTitle: 'Resume playback?',
    resumeFromTime: (time) => `Resume from ${time}`,
    startFromBeginning: 'Start from beginning',
    savedProgressLabel: (current, total) =>
      total ? `Saved at ${current} of ${total}` : `Saved at ${current}`,
  },
};

const es: TranslationDictionary = {
  common: {
    cancel: 'Cancelar',
    close: 'Cerrar',
    back: 'Volver',
    play: 'Reproducir',
    resume: 'Reanudar',
    demoMode: 'Modo Demo',
    demoShort: 'Demo',
    episodeCode: (season, episode) => `T${season ?? '?'}:E${episode ?? '?'}`,
  },
  language: {
    english: 'English',
    spanish: 'Español',
    switcherAria: 'Seleccionar idioma de la interfaz',
  },
  app: {
    initializing: (appName) => `Iniciando ${appName}…`,
  },
  connect: {
    title: 'Conecta tu servidor',
    subtitle: 'Ingresa la dirección de tu servidor Jellyfin para comenzar a explorar tu biblioteca.',
    serverUrlLabel: 'Dirección del servidor',
    serverUrlPlaceholder: 'https://jellyfin.tudominio.com o 192.168.1.50:8096',
    hintPrefix: 'También puedes definir',
    hintIn: 'en',
    hintSuffix: 'para omitir este paso.',
    connecting: 'Conectando…',
    connectButton: 'Conectar al servidor',
    or: 'o',
    tryDemo: 'Probar modo demostración',
    emptyUrlError: 'Introduce la dirección de tu servidor Jellyfin.',
    connectFailedPrefix: 'No se pudo conectar:',
    unreachableError:
      'No se pudo alcanzar el servidor Jellyfin. Verifica la URL, el puerto (ej. 8096) y que el servidor permita conexiones desde este navegador.',
  },
  profiles: {
    changeServer: 'Cambiar servidor',
    whoIsWatching: '¿Quién está viendo?',
    subtitle: 'Elige un perfil para acceder a tus bibliotecas y continuar donde lo dejaste.',
    loadingProfiles: 'Cargando perfiles del servidor…',
    fetchError: 'No se pudieron obtener los perfiles del servidor. Verifica que esté en línea.',
    retry: 'Reintentar',
    manualLogin: 'Login manual',
    requiresPassword: 'Requiere contraseña',
    forgetProfileAria: (name) => `Olvidar perfil ${name}`,
    forgetProfileTitle: 'Quitar perfil de este dispositivo',
    otherAccount: 'Otra cuenta',
    helloUser: (name) => `Hola, ${name}`,
    signIn: 'Iniciar sesión',
    enterProfilePassword: 'Ingresa la contraseña de tu perfil para continuar.',
    enterRegisteredUser: 'Accede con un usuario registrado en este servidor.',
    usernameLabel: 'Usuario',
    usernamePlaceholder: 'Nombre de usuario',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Contraseña (deja vacío si no tiene)',
    emptyUsernameError: 'Ingresa un nombre de usuario.',
    invalidCredentials: 'Usuario o contraseña incorrectos.',
    verifying: 'Verificando…',
    enter: 'Entrar',
    closeAria: 'Cerrar',
  },
  nav: {
    mainAria: 'Navegación principal',
    mobileAria: 'Navegación móvil',
    home: 'Inicio',
    movies: 'Películas',
    series: 'Series',
    collections: 'Colecciones',
    myList: 'Mi lista',
    searchPlaceholder: 'Títulos, géneros...',
    searchAria: 'Buscar en el catálogo',
    closeSearchAria: 'Cerrar búsqueda',
    openSearchAria: 'Abrir búsqueda',
    searchTitle: 'Buscar (/)',
    userMenuAria: 'Menú de usuario',
    profileFallback: 'Perfil',
    playbackPreferences: 'Preferencias y ajustes',
    switchProfile: 'Cambiar de perfil',
    disconnectServer: 'Desconectar servidor',
  },
  hero: {
    featuredAria: 'Destacados',
    featuredSeries: 'Serie destacada',
    featuredMovie: 'Película destacada',
    moreInfo: 'Más información',
    addToList: 'Agregar a Mi lista',
    removeFromList: 'Quitar de Mi lista',
    prevFeaturedAria: 'Destacado anterior',
    nextFeaturedAria: 'Siguiente destacado',
    viewFeaturedAria: (index, name) => `Ver destacado ${index}: ${name}`,
  },
  row: {
    scrollLeftAria: (title) => `Desplazar ${title} a la izquierda`,
    scrollRightAria: (title) => `Desplazar ${title} a la derecha`,
  },
  card: {
    defaultRemove: 'Quitar de esta sección',
    playAria: (title) => `Reproducir ${title}`,
    detailsAria: (title) => `Detalles de ${title}`,
    moreInfo: 'Más información',
    watched: 'Visto',
    addToList: 'Agregar a Mi lista',
    removeFromList: 'Quitar de Mi lista',
    moreInfoAria: (title) => `Más información sobre ${title}`,
  },
  home: {
    continueWatching: 'Seguir viendo',
    removeFromContinue: 'Quitar de Seguir viendo',
    nextEpisodes: 'Próximos episodios',
    removeFromNextUp: 'Quitar de Próximos episodios',
    recentMovies: 'Reciente en Películas',
    recentSeries: 'Reciente en Series',
    topRated: 'Top 10 mejor valorados',
    myList: 'Mi lista',
    actionAndAdventure: 'Acción y aventura',
  },
  catalog: {
    movies: 'Películas',
    series: 'Series',
    collections: 'Colecciones',
    favorites: 'Mi lista',
    searchTitle: 'Explorar catálogo',
    searchResultsFor: (query) => `Resultados para “${query}”`,
    emptyMovies: 'No se encontraron películas.',
    emptySeries: 'No se encontraron series.',
    emptyCollections: 'No hay colecciones configuradas en el servidor.',
    emptyFavorites: 'Aún no has agregado títulos a Mi lista.',
    emptySearch: 'No hay coincidencias para tu búsqueda.',
    loadingTitles: 'Cargando títulos…',
    availableTitles: (count) => `${count} ${count === 1 ? 'título disponible' : 'títulos disponibles'}`,
    searchInputPlaceholder: 'Buscar película, serie o género…',
    searchInputAria: 'Buscar película, serie o género',
    filterGenreAria: 'Filtrar por género',
    allGenres: 'Todos los géneros',
    sortCatalogAria: 'Ordenar catálogo',
    clearGenreFilter: 'Limpiar filtro de género',
    sortRecent: 'Recientes primero',
    sortTopRated: 'Mejor valoradas',
    sortReleaseYear: 'Año de estreno',
    sortAlpha: 'Alfabético (A–Z)',
  },
  detail: {
    closeAria: 'Cerrar detalles',
    inMyList: 'En Mi lista',
    myList: 'Mi lista',
    addToList: 'Agregar a Mi lista',
    removeFromList: 'Quitar de Mi lista',
    markUnplayed: 'Marcar como no visto',
    markPlayed: 'Marcar como visto',
    noOverview: 'Sin sinopsis disponible en el servidor.',
    genres: 'Géneros:',
    originalTitle: 'Título original:',
    studio: 'Estudio:',
    format: 'Formato:',
    formatSeries: 'Serie',
    formatCollection: 'Colección',
    formatMovie: 'Película',
    episodes: 'Episodios',
    noEpisodesInSeason: 'No hay episodios disponibles en esta temporada.',
    collectionItems: 'Títulos en esta colección',
    cast: 'Reparto principal',
    similarTitles: 'Títulos similares',
  },
  settings: {
    defaultUser: 'Usuario',
    demoSuffix: ' (Modo Demostración)',
    switchProfile: 'Cambiar de perfil',
    disconnect: 'Desconectar',
    playbackPreferences: 'Preferencias de reproducción',
    preferredQuality: 'Calidad de transmisión preferida',
    qualityAutoLabel: 'Automática / Direct Play',
    qualityAutoDesc: 'Máxima calidad nativa cuando el navegador lo permite',
    quality1080Label: 'Full HD 1080p (20 Mbps)',
    quality1080Desc: 'Ideal para redes Wi-Fi y fibra doméstica',
    quality720Label: 'HD 720p (8 Mbps)',
    quality720Desc: 'Equilibrio entre fluidez y ahorro de ancho de banda',
    quality480Label: 'SD 480p (3 Mbps)',
    quality480Desc: 'Recomendado para conexiones móviles limitadas',
    autoPlayNextTitle: 'Reproducir siguiente episodio automáticamente',
    autoPlayNextDesc: 'Al terminar un capítulo, continúa automáticamente con el siguiente.',
    autoSkipIntroTitle: 'Saltar introducción automáticamente',
    autoSkipIntroDesc: 'Omite la intro de forma automática cuando el servidor reporta MediaSegments.',
    preferredAudioLang: 'Idioma de audio preferido',
    preferredSubtitleLang: 'Idioma de subtítulos preferido',
    subtitlesOffByDefault: 'Desactivados por defecto',
    langSpa: 'Español',
    langEng: 'Inglés',
    langJpn: 'Japonés',
    langKor: 'Coreano',
    langFra: 'Francés',
    interfaceLanguageTitle: 'Idioma de la interfaz',
    interfaceLanguageDesc: 'Elige el idioma visible de los menús, botones y controles del reproductor.',
    brandTitle: 'Personalización de marca',
    brandDescPrefix: 'Personaliza el nombre y el logotipo en este navegador (o de forma global con',
    brandDescAnd: 'y',
    brandDescSuffix: 'en Docker).',
    restoreDefault: 'Restaurar predeterminado',
    preview: 'Vista previa',
    appNameLabel: 'Nombre de la aplicación',
    logoUrlLabel: 'URL o ruta del logotipo (SVG / PNG)',
    logoUrlPlaceholder: 'https://... o /brand/logo.svg',
    logoUrlInvalidHint: 'Usa una URL http(s)://, ruta local /... o imagen data:image/.',
  },
  player: {
    loadEpisodeError: 'No se pudo cargar el episodio de la serie.',
    noPlaybackSources: 'El servidor no devolvió fuentes de reproducción válidas.',
    playbackInitError: 'Error al iniciar la reproducción multimedia.',
    hlsLoadError: 'No se pudo cargar el flujo de video HLS.',
    preparing: 'Preparando reproducción…',
    playbackFailed: 'No se pudo reproducir el video',
    backToCatalog: 'Volver al catálogo',
    skipCredits: 'Saltar créditos',
    skipRecap: 'Saltar resumen',
    skipIntro: 'Saltar intro',
    nextEpisode: 'Siguiente episodio',
    hideNextPromptAria: 'Ocultar aviso de siguiente episodio',
    playNow: 'Reproducir ahora',
    nextEpisodeCountdown: (seconds) => `Siguiente episodio en ${seconds} s`,
    pausedBetweenEpisodes: 'Reproducción en pausa entre capítulos',
    seriesFinished: 'Fin de la serie',
    movieFinished: 'Película finalizada',
    nextShortLabel: (season, episode) => `Siguiente: T${season ?? '?'}:E${episode ?? '?'}`,
    watchAgain: 'Volver a ver',
    youMightAlsoLike: 'También te podría gustar',
    backAria: 'Volver',
    rewind10Aria: 'Retroceder 10 segundos',
    rewind10Title: 'Retroceder 10 s (J)',
    forward10Aria: 'Adelantar 10 segundos',
    forward10Title: 'Adelantar 10 s (L)',
    playAria: 'Reproducir',
    pauseAria: 'Pausar',
    unmuteAria: 'Activar sonido',
    muteAria: 'Silenciar',
    volumeAria: 'Volumen',
    seekPositionAria: 'Posición de reproducción',
    nextEpisodeTitle: 'Siguiente episodio',
    nextShortBtn: 'Siguiente',
    audioTracksTitle: 'Pistas de audio',
    audioSelectAria: 'Seleccionar audio',
    audioHeading: 'Audio',
    trackFallback: (index) => `Pista ${index}`,
    subtitlesTitle: 'Subtítulos',
    subtitlesSelectAria: 'Seleccionar subtítulos',
    subtitlesHeading: 'Subtítulos',
    subtitlesOff: 'Desactivados',
    noExternalSubtitles: 'Sin subtítulos externos disponibles',
    playbackSpeedAria: 'Velocidad de reproducción',
    fullscreenTitle: 'Pantalla completa (F)',
    fullscreenAria: 'Alternar pantalla completa',
    resumePromptTitle: '¿Cómo quieres reproducirlo?',
    resumeFromTime: (time) => `Continuar desde ${time}`,
    startFromBeginning: 'Empezar desde el principio',
    savedProgressLabel: (current, total) =>
      total ? `Te quedaste en ${current} de ${total}` : `Te quedaste en ${current}`,
  },
};

export const translations: Record<Locale, TranslationDictionary> = { en, es };
