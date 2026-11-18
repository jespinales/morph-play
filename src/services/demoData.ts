import {
  BaseItemDto,
  MediaSegmentDto,
  PlaybackInfoResponse,
  PublicSystemInfo,
  UserDto,
} from '../types/jellyfin';

export const DEMO_SERVER_URL = 'demo://jellyfin.local';
export const DEMO_ACCESS_TOKEN = 'demo-session-token';

// Flujo HLS público de prueba (Blender Foundation - Big Buck Bunny) para validar el reproductor hls.js
export const DEMO_HLS_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
export const DEMO_MP4_FALLBACK =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createArtworkDataUri(
  title: string,
  subtitle: string,
  c1: string,
  c2: string,
  c3: string,
  width: number,
  height: number,
  style: 'poster' | 'backdrop' | 'avatar' = 'poster'
): string {
  const safeTitle = escapeXml(title);
  const safeSubtitle = escapeXml(subtitle);

  if (style === 'avatar') {
    const initials = escapeXml(
      title
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" rx="28" fill="url(#g)"/>
      <circle cx="150" cy="112" r="46" fill="rgba(255,255,255,0.2)"/>
      <path d="M72 248c8-48 44-72 78-72s70 24 78 72" fill="rgba(255,255,255,0.2)"/>
      <text x="150" y="276" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  const isBackdrop = style === 'backdrop';
  const words = safeTitle.split(' ');
  const mid = Math.ceil(words.length / 2);
  const line1 = words.length > 2 ? words.slice(0, mid).join(' ') : safeTitle;
  const line2 = words.length > 2 ? words.slice(mid).join(' ') : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="52%" stop-color="${c2}"/>
        <stop offset="100%" stop-color="${c3}"/>
      </linearGradient>
      <radialGradient id="glow" cx="${isBackdrop ? '70%' : '50%'}" cy="${isBackdrop ? '35%' : '32%'}" r="65%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.28)"/>
        <stop offset="55%" stop-color="rgba(255,255,255,0.05)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
      </radialGradient>
      <linearGradient id="vignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(10,10,14,0.1)"/>
        <stop offset="65%" stop-color="rgba(10,10,14,0.35)"/>
        <stop offset="100%" stop-color="rgba(10,10,14,0.92)"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${width * (isBackdrop ? 0.72 : 0.5)}" cy="${height * 0.34}" r="${Math.min(width, height) * 0.42}" fill="url(#glow)"/>
    <path d="M0 ${height * 0.68} Q ${width * 0.35} ${height * 0.55} ${width} ${height * 0.75} L ${width} ${height} L 0 ${height} Z" fill="rgba(0,0,0,0.28)"/>
    <rect width="${width}" height="${height}" fill="url(#vignette)"/>
    ${
      !isBackdrop
        ? `<text x="${width / 2}" y="${height * 0.72}" text-anchor="middle" fill="#ffffff" font-family="Inter,Arial,sans-serif" font-size="${width * 0.085}" font-weight="900" letter-spacing="-1">${line1}</text>
           ${
             line2
               ? `<text x="${width / 2}" y="${height * 0.805}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="Inter,Arial,sans-serif" font-size="${width * 0.072}" font-weight="800">${line2}</text>`
               : ''
           }
           <text x="${width / 2}" y="${height * 0.90}" text-anchor="middle" fill="rgba(255,255,255,0.65)" font-family="Inter,Arial,sans-serif" font-size="${width * 0.042}" font-weight="600" letter-spacing="2">${safeSubtitle.toUpperCase()}</text>`
        : ''
    }
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const DEMO_SYSTEM_INFO: PublicSystemInfo = {
  Id: 'demo-server-001',
  ServerName: 'Jellyfin Hogar (Demo)',
  Version: '10.10.6',
  ProductName: 'Jellyfin Server',
  StartupWizardCompleted: true,
};

export const DEMO_USERS: UserDto[] = [
  {
    Id: 'demo-user-1',
    Name: 'Cineasta',
    ServerId: 'demo-server-001',
    HasPassword: false,
    HasConfiguredPassword: false,
    PrimaryImageTag: 'avatar-1',
    Configuration: {
      AudioLanguagePreference: 'spa',
      SubtitleLanguagePreference: 'spa',
      PlayDefaultAudioTrack: true,
    },
  },
  {
    Id: 'demo-user-2',
    Name: 'Familia',
    ServerId: 'demo-server-001',
    HasPassword: false,
    HasConfiguredPassword: false,
    PrimaryImageTag: 'avatar-2',
  },
  {
    Id: 'demo-user-3',
    Name: 'Invitado',
    ServerId: 'demo-server-001',
    HasPassword: true,
    HasConfiguredPassword: true,
    PrimaryImageTag: 'avatar-3',
  },
];

interface DemoArtSeed {
  c1: string;
  c2: string;
  c3: string;
  subtitle: string;
}

const DEMO_ART_MAP: Record<string, DemoArtSeed> = {
  'demo-squid': { c1: '#8b0a50', c2: '#0f2f3f', c3: '#090b10', subtitle: 'Serie Original' },
  'demo-squid-s1': { c1: '#8b0a50', c2: '#0f2f3f', c3: '#090b10', subtitle: 'Temporada 1' },
  'demo-squid-e3': { c1: '#a0135d', c2: '#143b4d', c3: '#090b10', subtitle: 'S1:E3' },
  'demo-squid-e4': { c1: '#7e124d', c2: '#18324a', c3: '#090b10', subtitle: 'S1:E4' },
  'demo-squid-e5': { c1: '#59103f', c2: '#1a273e', c3: '#090b10', subtitle: 'S1:E5' },
  'demo-odyssey': { c1: '#233248', c2: '#4e3524', c3: '#0a0a0e', subtitle: 'Épica • 2026' },
  'demo-deadpool': { c1: '#9b111e', c2: '#b8860b', c3: '#111116', subtitle: 'Acción • 2024' },
  'demo-passion': { c1: '#4a2c16', c2: '#23140b', c3: '#090808', subtitle: 'Drama • 2004' },
  'demo-chappie': { c1: '#1d4d6b', c2: '#463829', c3: '#0e1116', subtitle: 'Ciencia Ficción' },
  'demo-troy': { c1: '#6e4e26', c2: '#352214', c3: '#0d0b0a', subtitle: 'Aventura • 2004' },
  'demo-avatar': { c1: '#1b5f87', c2: '#513763', c3: '#0a0e17', subtitle: 'Fantasía • 2026' },
  'demo-lotr': { c1: '#2b4728', c2: '#5f4318', c3: '#0a0c0a', subtitle: 'Aventura • 2001' },
  'demo-mario': { c1: '#19459d', c2: '#8a1e3e', c3: '#0b0c1c', subtitle: 'Animación • 2026' },
  'demo-revenant': { c1: '#283d4a', c2: '#1a242c', c3: '#070a0d', subtitle: 'Supervivencia • 2015' },
  'demo-series-2': { c1: '#1f4e5f', c2: '#3b2e5a', c3: '#0a0c14', subtitle: 'Serie • 16 Episodios' },
  'demo-series-3': { c1: '#296356', c2: '#16383b', c3: '#080e10', subtitle: 'Anime • 12 Episodios' },
  'demo-col-1': { c1: '#4f3a18', c2: '#1f3220', c3: '#090b09', subtitle: 'Colección' },
  'demo-col-2': { c1: '#7e1222', c2: '#25263a', c3: '#090a10', subtitle: 'Colección' },
};

export function getDemoImageUrl(
  itemId: string,
  type: 'Primary' | 'Backdrop' | 'Thumb' | 'Logo' | 'User',
  title = 'Jellyfin'
): string {
  if (type === 'User') {
    const user = DEMO_USERS.find((u) => u.Id === itemId);
    const name = user?.Name ?? title;
    const palette =
      itemId === 'demo-user-1'
        ? ['#AA5CC3', '#00A4DC']
        : itemId === 'demo-user-2'
          ? ['#00A4DC', '#10b981']
          : ['#f59e0b', '#ef4444'];
    return createArtworkDataUri(name, 'Perfil', palette[0], palette[1], '#0a0a0e', 300, 300, 'avatar');
  }

  const seed = DEMO_ART_MAP[itemId] ?? {
    c1: '#4c266a',
    c2: '#0f496c',
    c3: '#0a0a0e',
    subtitle: 'Jellyfin',
  };

  if (type === 'Backdrop' || type === 'Thumb') {
    return createArtworkDataUri(title, seed.subtitle, seed.c1, seed.c2, seed.c3, 1280, 720, 'backdrop');
  }

  return createArtworkDataUri(title, seed.subtitle, seed.c1, seed.c2, seed.c3, 400, 600, 'poster');
}

const DEFAULT_PEOPLE = [
  { Id: 'person-1', Name: 'Lee Jung-jae', Role: 'Seong Gi-hun', Type: 'Actor' },
  { Id: 'person-2', Name: 'Ryan Reynolds', Role: 'Wade Wilson', Type: 'Actor' },
  { Id: 'person-3', Name: 'Viggo Mortensen', Role: 'Aragorn', Type: 'Actor' },
  { Id: 'person-4', Name: 'Leonardo DiCaprio', Role: 'Hugh Glass', Type: 'Actor' },
  { Id: 'person-5', Name: 'Brad Pitt', Role: 'Aquiles', Type: 'Actor' },
];

const DEFAULT_MEDIA_STREAMS = [
  {
    Type: 'Video' as const,
    Index: 0,
    Codec: 'h264',
    Width: 3840,
    Height: 2160,
    VideoRangeType: 'HDR10',
    DisplayTitle: '4K H264 HDR10',
  },
  {
    Type: 'Audio' as const,
    Index: 1,
    Codec: 'aac',
    Language: 'spa',
    DisplayTitle: 'Español (Latino) — AAC 5.1',
    IsDefault: true,
    Channels: 6,
  },
  {
    Type: 'Audio' as const,
    Index: 2,
    Codec: 'aac',
    Language: 'eng',
    DisplayTitle: 'Inglés (Original) — AAC 5.1',
    Channels: 6,
  },
  {
    Type: 'Subtitle' as const,
    Index: 3,
    Codec: 'vtt',
    Language: 'spa',
    DisplayTitle: 'Español',
    IsDefault: true,
    IsExternal: true,
    SupportsExternalStream: true,
  },
  {
    Type: 'Subtitle' as const,
    Index: 4,
    Codec: 'vtt',
    Language: 'eng',
    DisplayTitle: 'Inglés (CC)',
    IsExternal: true,
    SupportsExternalStream: true,
  },
];

export const DEMO_ITEMS: BaseItemDto[] = [
  {
    Id: 'demo-squid',
    Name: 'El juego del calamar',
    Type: 'Series',
    ProductionYear: 2021,
    CommunityRating: 8.6,
    OfficialRating: 'TV-MA',
    Genres: ['Suspenso', 'Drama', 'Acción'],
    Overview:
      'Cientos de jugadores con problemas económicos aceptan una extraña invitación para competir en juegos infantiles por un premio multimillonario, pero las consecuencias son mortales.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[0]],
    UserData: { IsFavorite: true, UnplayedItemCount: 4, Played: false },
  },
  {
    Id: 'demo-odyssey',
    Name: 'La Odisea',
    Type: 'Movie',
    ProductionYear: 2026,
    CommunityRating: 8.9,
    OfficialRating: 'PG-13',
    RunTimeTicks: 93_600_000_000, // 156 min
    Genres: ['Aventura', 'Fantasía', 'Drama'],
    Overview:
      'Tras la caída de Troya, el rey Odiseo emprende un peligroso viaje de regreso a Ítaca enfrentando monstruos míticos, dioses implacables y pruebas de ingenio.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[4], DEFAULT_PEOPLE[2]],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: true, Played: false },
  },
  {
    Id: 'demo-deadpool',
    Name: 'Deadpool & Wolverine',
    Type: 'Movie',
    ProductionYear: 2024,
    CommunityRating: 8.1,
    OfficialRating: 'R',
    RunTimeTicks: 76_800_000_000, // 128 min
    Genres: ['Acción', 'Comedia', 'Ciencia Ficción'],
    Overview:
      'Un apático Wade Wilson se esfuerza por adaptarse a la vida civil cuando una amenaza existencial lo obliga a unir fuerzas con un reticente Wolverine.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[1]],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: true, Played: false },
  },
  {
    Id: 'demo-lotr',
    Name: 'El señor de los anillos: La comunidad del anillo',
    Type: 'Movie',
    ProductionYear: 2001,
    CommunityRating: 9.0,
    OfficialRating: 'PG-13',
    RunTimeTicks: 106_800_000_000, // 178 min
    Genres: ['Fantasía', 'Aventura', 'Acción'],
    Overview:
      'Un joven hobbit recibe el encargo de destruir un antiguo anillo de poder antes de que caiga en manos del Señor Oscuro en la Tierra Media.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[2]],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: true, Played: false },
  },
  {
    Id: 'demo-mario',
    Name: 'Super Mario Galaxy: La película',
    Type: 'Movie',
    ProductionYear: 2026,
    CommunityRating: 8.3,
    OfficialRating: 'PG',
    RunTimeTicks: 58_800_000_000, // 98 min
    Genres: ['Animación', 'Aventura', 'Familia'],
    Overview:
      'Mario y sus aliados viajan más allá del Reino Champiñón para recorrer galaxias vibrantes, salvar las estrellas y detener una nueva amenaza cósmica.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-revenant',
    Name: 'Revenant: El renacido',
    Type: 'Movie',
    ProductionYear: 2015,
    CommunityRating: 8.0,
    OfficialRating: 'R',
    RunTimeTicks: 93_600_000_000,
    Genres: ['Aventura', 'Drama', 'Suspenso'],
    Overview:
      'En una expedición por las tierras salvajes estadounidenses, el explorador Hugh Glass lucha por sobrevivir al invierno extremo tras ser traicionado y abandonado.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[3]],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-avatar',
    Name: 'Avatar: Aang, El último maestro del aire',
    Type: 'Movie',
    ProductionYear: 2026,
    CommunityRating: 8.4,
    OfficialRating: 'PG',
    RunTimeTicks: 69_000_000_000,
    Genres: ['Animación', 'Aventura', 'Fantasía'],
    Overview:
      'Aang y sus compañeros adultos enfrentan un misterio ancestral que amenaza el equilibrio entre las cuatro naciones elementales.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-troy',
    Name: 'Troya',
    Type: 'Movie',
    ProductionYear: 2004,
    CommunityRating: 7.6,
    OfficialRating: 'R',
    RunTimeTicks: 97_800_000_000,
    Genres: ['Acción', 'Drama', 'Historia'],
    Overview:
      'El legendario guerrero Aquiles lidera a las fuerzas griegas frente a las imponentes murallas de Troya en una guerra que definirá una era.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    People: [DEFAULT_PEOPLE[4]],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-chappie',
    Name: 'Chappie',
    Type: 'Movie',
    ProductionYear: 2015,
    CommunityRating: 7.2,
    OfficialRating: 'R',
    RunTimeTicks: 72_000_000_000,
    Genres: ['Ciencia Ficción', 'Acción'],
    Overview:
      'Un robot policial reprogramado con inteligencia artificial real comienza a pensar y sentir por sí mismo, convirtiéndose en el objetivo de intereses rivales.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-passion',
    Name: 'La pasión de Cristo',
    Type: 'Movie',
    ProductionYear: 2004,
    CommunityRating: 7.5,
    OfficialRating: 'R',
    RunTimeTicks: 76_200_000_000,
    Genres: ['Drama', 'Historia'],
    Overview:
      'Crónica cinematográfica de las últimas doce horas de Jesús de Nazaret en Jerusalén.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { IsFavorite: false, Played: false },
  },
  {
    Id: 'demo-series-2',
    Name: 'Horizontes de Seúl',
    Type: 'Series',
    ProductionYear: 2024,
    CommunityRating: 8.5,
    OfficialRating: 'TV-14',
    Genres: ['Drama', 'Misterio'],
    Overview:
      'Dos investigadores cruzan caminos mientras descifran desapariciones vinculadas a una red tecnológica oculta.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    UserData: { IsFavorite: false, UnplayedItemCount: 16, Played: false },
  },
  {
    Id: 'demo-series-3',
    Name: 'Crónicas del Borde Estelar',
    Type: 'Series',
    ProductionYear: 2025,
    CommunityRating: 8.8,
    OfficialRating: 'TV-14',
    Genres: ['Animación', 'Ciencia Ficción', 'Acción'],
    Overview:
      'Una tripulación improvisada protege los portales orbitales contra piratas interestelares y antiguas reliquias.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
    UserData: { IsFavorite: false, UnplayedItemCount: 12, Played: false },
  },
  // Colecciones
  {
    Id: 'demo-col-1',
    Name: 'Saga de la Tierra Media',
    Type: 'BoxSet',
    ProductionYear: 2001,
    ChildCount: 3,
    Overview: 'Todas las entregas épicas del viaje hacia el Monte del Destino.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
  },
  {
    Id: 'demo-col-2',
    Name: 'Universo Mutante y Antihéroes',
    Type: 'BoxSet',
    ProductionYear: 2024,
    ChildCount: 4,
    Overview: 'Colección de acción irreverente y multiversos.',
    ImageTags: { Primary: '1' },
    BackdropImageTags: ['1'],
  },
];

export const DEMO_EPISODES: BaseItemDto[] = [
  {
    Id: 'demo-squid-e3',
    Name: 'El hombre del paraguas',
    SeriesName: 'El juego del calamar',
    SeriesId: 'demo-squid',
    SeasonName: 'Temporada 1',
    SeasonId: 'demo-squid-s1',
    Type: 'Episode',
    IndexNumber: 3,
    ParentIndexNumber: 1,
    ProductionYear: 2021,
    RunTimeTicks: 33_000_000_000, // 55 min
    Overview:
      'Algunos jugadores ingresan a la siguiente ronda con ventajas ocultas, pero una prueba de precisión extrema pone a todos al límite.',
    ImageTags: { Primary: '1' },
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: {
      PlaybackPositionTicks: 14_850_000_000,
      PlayedPercentage: 45,
      Played: false,
    },
  },
  {
    Id: 'demo-squid-e4',
    Name: 'No abandones el equipo',
    SeriesName: 'El juego del calamar',
    SeriesId: 'demo-squid',
    SeasonName: 'Temporada 1',
    SeasonId: 'demo-squid-s1',
    Type: 'Episode',
    IndexNumber: 4,
    ParentIndexNumber: 1,
    ProductionYear: 2021,
    RunTimeTicks: 33_600_000_000,
    Overview:
      'Las alianzas se ponen a prueba cuando el grupo debe combinar estrategia y fuerza física para sobrevivir al tercer desafío.',
    ImageTags: { Primary: '1' },
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { PlaybackPositionTicks: 0, PlayedPercentage: 0, Played: false },
  },
  {
    Id: 'demo-squid-e5',
    Name: 'Un mundo justo',
    SeriesName: 'El juego del calamar',
    SeriesId: 'demo-squid',
    SeasonName: 'Temporada 1',
    SeasonId: 'demo-squid-s1',
    Type: 'Episode',
    IndexNumber: 5,
    ParentIndexNumber: 1,
    ProductionYear: 2021,
    RunTimeTicks: 31_800_000_000,
    Overview:
      'La tensión nocturna crece en los dormitorios mientras el detective infiltrado descubre pistas clave sobre la organización.',
    ImageTags: { Primary: '1' },
    MediaStreams: DEFAULT_MEDIA_STREAMS,
    UserData: { PlaybackPositionTicks: 0, PlayedPercentage: 0, Played: false },
  },
];

export const DEMO_SEASONS: BaseItemDto[] = [
  {
    Id: 'demo-squid-s1',
    Name: 'Temporada 1',
    SeriesId: 'demo-squid',
    Type: 'Season',
    IndexNumber: 1,
    ChildCount: 3,
    ImageTags: { Primary: '1' },
  },
];

export const DEMO_SEGMENTS: MediaSegmentDto[] = [
  {
    Id: 'seg-intro-1',
    ItemId: 'demo-squid-e3',
    Type: 'Intro',
    StartTicks: 5 * 10_000_000, // 5s
    EndTicks: 25 * 10_000_000, // 25s
  },
];

export function buildDemoPlaybackInfo(itemId: string): PlaybackInfoResponse {
  return {
    PlaySessionId: `demo-session-${itemId}`,
    MediaSources: [
      {
        Id: `demo-source-${itemId}`,
        Name: 'Stream HLS de demostración',
        Container: 'mp4',
        SupportsDirectPlay: false,
        SupportsDirectStream: true,
        SupportsTranscoding: true,
        RunTimeTicks: 596 * 10_000_000,
        DefaultAudioStreamIndex: 1,
        DefaultSubtitleStreamIndex: 3,
        HasSegments: true,
        MediaStreams: DEFAULT_MEDIA_STREAMS,
      },
    ],
  };
}
