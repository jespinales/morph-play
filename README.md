# MorphPlay — Cliente Web Moderno compatible con Jellyfin

**MorphPlay** es un cliente web de código abierto compatible con servidores **Jellyfin**, diseñado para ofrecer una experiencia cinematográfica fluida, veloz y adaptable a cualquier pantalla (móvil, tableta, portátil y monitores 4K), conectándose directamente con la API oficial de tu servidor.

Incluye identidad visual neutra de fábrica y permite personalizar libremente el **nombre** y el **logotipo** de la aplicación, tanto a nivel global en Docker como desde el navegador de cada usuario.

---

## Características principales

- **Marca e identidad personalizable**:
  - Incluye el nombre neutro **MorphPlay** y un logotipo vectorial propio por defecto.
  - Configurable globalmente mediante variables de entorno (`APP_NAME` y `APP_LOGO_URL`, incluyendo soporte para archivos locales montados en `/brand/`) o en cada navegador desde **Ajustes (`/settings`)** (solo visible para usuarios administradores), junto con el selector de idioma **ES / EN**.
- **Conexión y perfiles ("¿Quién está viendo?")**:
  - Conexión automática mediante `JELLYFIN_SERVER_URL` o asistente visual en el navegador (con **Modo Demostración** integrado).
  - Lista perfiles públicos (`/Users/Public`), recuerda cuentas iniciadas localmente y soporta inicio y autorización de dispositivos mediante **Quick Connect**, cierre de sesión real en servidor (`/Sessions/Logout`) y sincronización de `User.Configuration`.
- **Inicio cinematográfico y exploración**:
  - **Hero Banner** adaptable (`16:9` en escritorio y vista optimizada táctil en móvil/tableta) con logotipo, metadatos y acciones rápidas.
  - Carruseles horizontales: **Seguir viendo** (agrupado a 1 entrada por serie con el último episodio reproducido), **Próximos episodios**, **Recomendado para ti** (`/Items/Suggestions`), **Reciente en Películas**, **Reciente en Series**, **Top 10 mejor valorados**, **Mi lista** y géneros.
  - Búsqueda instantánea con autocompletado (`/Search/Hints`), catálogos paginados con filtros por biblioteca y género, gestión de **Playlists** de video y modal de detalles con reparto interactivo (filmografía por persona), temporadas, tráilers, extras y títulos similares.
- **Reproductor de video a medida (`hls.js` + Direct Play)**:
  - Reproducción adaptativa HLS y Direct Play con selector de versiones (`MediaSources`), **capítulos** con miniaturas sobre la barra de progreso y previsualización **Trickplay**.
  - Selector de pistas de audio y subtítulos VTT en overlay cinematográfico propio, además de transcodificación con quemado (*burn-in*) para subtítulos gráficos (PGS, VobSub, DVB).
  - Botón flotante **"Saltar intro"** / **"Saltar créditos"** mediante `MediaSegments`, transición automática al siguiente episodio y atajos de teclado (`Espacio`, `J`, `L`, `M`, `F`, `Esc`).
  - Control remoto (**Play To / Cast**), visualización sincronizada en grupo (**SyncPlay**) y actualizaciones en vivo mediante WebSocket (`/socket`).

---

## Compatibilidad con la API de Jellyfin

MorphPlay implementa la integración con el servidor basándose en la especificación oficial **Jellyfin API `12.4.0`** publicada en [api.jellyfin.org](https://api.jellyfin.org/) (manteniendo compatibilidad con servidores Jellyfin `10.10+` para funciones como `MediaSegments` y `Trickplay`):

- **Autenticación, usuarios y dispositivos**: Información pública del servidor (`/System/Info/Public`), aviso de acceso (`/Branding/Configuration`), usuarios públicos (`/Users/Public`), login por credenciales, cambio de contraseña (`/Users/Password`), flujo completo de **Quick Connect** (`Enabled`, `Initiate`, `Connect`, `Authorize`, `AuthenticateWithQuickConnect`), cierre de sesión (`/Sessions/Logout`), configuración de usuario (`/Users/Configuration`) y preferencias de vista en servidor (`/DisplayPreferences`).
- **Catálogo, descubrimiento, colecciones y playlists**: Vistas de biblioteca (`/UserViews`), elementos para reanudar (`/UserItems/Resume`), próximos episodios y estrenos (`/Shows/NextUp`, `/Shows/Upcoming`), recientes (`/Items/Latest`), sugerencias y recomendaciones (`/Items/Suggestions`, `/Movies/Recommendations`), consultas paginadas, filtros dinámicos y años (`/Items`, `/Genres`, `/Items/Filters2`, `/Years`), búsqueda rápida (`/Search/Hints`), temporadas/episodios/similares/partes adicionales, tráilers (`LocalTrailers`), extras (`SpecialFeatures`), música tema (`ThemeMedia`), enlaces externos (`ExternalIdInfos`), favoritos, me gusta/no me gusta (`/UserItems/{id}/Rating`), estado visto (`/UserPlayedItems/{id}`), gestión de colecciones (`/Collections`) y listas con edición, reordenamiento y compartición (`/Playlists`).
- **Reproducción y recursos multimedia**: Negociación de fuentes (`PlaybackInfo` + `TranscodingUrl`), test de ancho de banda (`/Playback/BitrateTest`), Direct Play (`/Videos/{id}/stream`), descarga directa (`/Items/{id}/Download`), subtítulos VTT, quemado de gráficos (`SubtitleMethod=Encode`), búsqueda/descarga/subida/borrado de subtítulos (`RemoteSearch/Subtitles`, `/Videos/{id}/Subtitles`), **MediaSegments** (`/MediaSegments/{id}`), hojas **Trickplay** (`/Videos/{id}/Trickplay`), e imágenes de ítems, capítulos, personas y avatares (`/UserImage`).
- **Sesiones, WebSocket y SyncPlay**: Registro de capacidades (`/Sessions/Capabilities/Full`), reporte y keepalive de reproducción (`/Sessions/Playing`, `Progress`, `Stopped` con `keepalive` en `pagehide`, `Ping`), control remoto y mensajería (`/Sessions/{id}/Playing`, `Playing/{command}`, `Message`), sala compartida **SyncPlay** (`List`, `New`, `Join`, `Leave`, `SetNewQueue`, `Queue`, `Pause`, `Unpause`, `Seek`, `Ready`, `Buffering`, `Ping`, `NextItem`, `PreviousItem`, `SetRepeatMode`, `SetShuffleMode`, `SetIgnoreWait`, `Stop`) y canal `/socket` en tiempo real (`UserDataChanged`, `LibraryChanged`, `Play`, `Playstate`, `SyncPlayCommand`, `SyncPlayGroupUpdate`).

---

## Despliegue rápido con Docker

Este repositorio incluye un único `docker-compose.yml` parametrizable mediante `.env` para servir tanto en **entorno de pruebas / homelab** como en **producción** detrás de Cloudflare Tunnel o un proxy inverso HTTPS (Nginx Proxy Manager, Caddy, Traefik).

### 1. Clona el repositorio y configura `.env`

```bash
cp .env.example .env
```

Edita `.env` según tu entorno:

- **Producción detrás de Cloudflare Tunnel o Nginx Proxy Manager local (recomendado por defecto):**

```env
BIND_ADDRESS=127.0.0.1
PORT=3000
JELLYFIN_SERVER_URL=https://jellyfin.tudominio.com
# Opcional: personaliza globalmente el título y logotipo de la instancia
APP_NAME=MorphPlay
APP_LOGO_URL=
```

- **Pruebas o acceso directo en red local (homelab LAN):**

```env
BIND_ADDRESS=0.0.0.0
PORT=3000
JELLYFIN_SERVER_URL=https://jellyfin.tudominio.com
```

> Si dejas `JELLYFIN_SERVER_URL` vacío, la interfaz mostrará el asistente visual para introducir la dirección de tu servidor al abrir el navegador.
> Si quieres usar un logotipo local sin depender de una URL externa, coloca tu imagen en `./brand/logo.svg`, descomenta el volumen `./brand:/usr/share/nginx/html/brand:ro` en `docker-compose.yml` y define `APP_LOGO_URL=/brand/logo.svg` en `.env`.

### 2. Inicia el contenedor (imagen precompilada desde GitHub Container Registry)

```bash
docker compose up -d
```

> `docker-compose.yml` descarga directamente `ghcr.io/jespinales/morph-play:latest` (multi-arquitectura `amd64` y `arm64`) sin necesidad de compilar en tu servidor. Si actualizas la versión, ejecuta `docker compose pull && docker compose up -d`.

- Con `BIND_ADDRESS=127.0.0.1`, accede localmente en `http://localhost:3000` y apunta tu túnel (`cloudflared`) o proxy inverso a `http://127.0.0.1:3000`.
- El contenedor incluye `healthcheck` en `/healthz`, cabeceras de seguridad Nginx y `CDN-Cache-Control: no-store` para `/env-config.js`.

### Nota sobre CORS en Jellyfin

Al ejecutarse como una aplicación SPA en el navegador, la interfaz realiza peticiones HTTP directamente hacia la URL de tu servidor Jellyfin. Asegúrate de que tu servidor o proxy inverso (Nginx, Caddy, Traefik) permita peticiones desde el origen donde hospedes esta interfaz web (Jellyfin habilita CORS por defecto en la mayoría de despliegues estándar).

---

## Desarrollo local

Requisitos: **Node.js 20+** y **npm**.

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo con recarga rápida
npm run dev

# Ejecutar tests unitarios (Vitest)
npm test

# Compilar y verificar tipos para producción
npm run build

# Construir y levantar la imagen Docker localmente en lugar de usar GHCR
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

---

## Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
