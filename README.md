# MorphPlay — Cliente Web Moderno compatible con Jellyfin

**MorphPlay** es un cliente web de código abierto compatible con servidores **Jellyfin**, diseñado para ofrecer una experiencia cinematográfica fluida, veloz y adaptable a cualquier pantalla (móvil, tableta, portátil y monitores 4K), conectándose directamente con la API oficial de tu servidor.

Incluye identidad visual neutra de fábrica y permite personalizar libremente el **nombre** y el **logotipo** de la aplicación, tanto a nivel global en Docker como desde el navegador de cada usuario.

---

## Características principales

- **Marca e identidad personalizable**:
  - Incluye el nombre neutro **MorphPlay** y un logotipo vectorial propio por defecto.
  - Configurable globalmente mediante variables de entorno (`APP_NAME` y `APP_LOGO_URL`, incluyendo soporte para archivos locales montados en `/brand/`) o de forma individual en cada navegador desde **Perfil (`/perfil`)**.

- **Conexión híbrida y sencilla**:
  - Si defines `JELLYFIN_SERVER_URL` en `docker-compose.yml`, la aplicación se conecta automáticamente a tu servidor y muestra directo el selector de perfiles.
  - Si no la defines, muestra un asistente visual en el navegador para conectar cualquier servidor Jellyfin (incluyendo un **Modo Demostración** integrado).
- **Selector de perfiles ("¿Quién está viendo?")**:
  - Lista los perfiles públicos (`/Users/Public`) y recuerda localmente en el dispositivo las cuentas iniciadas (incluso si el servidor oculta perfiles públicos), con acceso en un clic o modal de contraseña.
- **Inicio cinematográfico**:
  - **Hero Banner** adaptable (`16:9` completo a la derecha en escritorio y apilado superior con fundido suave y gestos *swipe* en móvil/tableta), logotipo oficial, valoración, año, clasificación y acciones rápidas.
  - Carruseles horizontales con soporte táctil y desplazamiento: **Seguir viendo** (con botón discreto `×` para quitar elementos), **Próximos episodios**, **Reciente en Películas**, **Reciente en Series**, **Top 10 mejor valorados**, **Mi lista** y géneros.
  - Tarjetas limpias (2:3 para pósteres y 16:9 con barra de progreso para continuar viendo) y modal superpuesto de detalles con reparto, temporadas, episodios y títulos similares.
- **Reproductor de video a medida (`hls.js` + Direct Play)**:
  - Reproducción adaptativa HLS y Direct Play con previsualización **Trickplay** sobre la barra de progreso, compatibilidad táctil (controles centrales, pantalla completa iOS y menús adaptables) y atajos de teclado (`Espacio`, `J`, `L`, `M`, `F`, `Esc`).
  - Selector de pistas de audio y subtítulos VTT renderizados mediante overlay cinematográfico propio sobre el reproductor.
  - Botón flotante **"Saltar intro"** / **"Saltar créditos"** compatible con la API `MediaSegments` de Jellyfin 10.10+.
  - Aviso y transición automática al **siguiente episodio**, además de sincronización periódica del progreso con el servidor (`/Sessions/Playing/Progress`).

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

### 2. Inicia el contenedor

```bash
docker compose up -d --build
```

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

# Compilar y verificar tipos para producción
npm run build
```

---

## Arquitectura del proyecto

```text
src/
├── components/
│   ├── BrandLogo.tsx           # Logotipo personalizable (SVG MorphPlay por defecto o imagen propia)
│   ├── DetailModal.tsx         # Modal de detalles, temporadas, episodios, reparto y similares
│   ├── HeroBanner.tsx          # Carrusel principal a pantalla completa
│   ├── MediaCard.tsx           # Tarjetas 2:3 (póster) y 16:9 (Seguir viendo / Próximos)
│   ├── MediaRow.tsx            # Carruseles horizontales con desplazamiento táctil
│   ├── Navbar.tsx              # Barra superior fija y barra inferior adaptativa móvil
│   └── VideoPlayerModal.tsx    # Reproductor HLS / Direct Play con MediaSegments
├── context/
│   └── AuthContext.tsx         # Estado de servidor, sesión de usuario, marca y preferencias
├── pages/
│   ├── CatalogPage.tsx         # Películas, Series, Colecciones, Mi lista y Búsqueda
│   ├── HomePage.tsx            # Vista principal del catálogo
│   ├── ProfileSelectPage.tsx   # Selector visual "¿Quién está viendo?"
│   ├── ProfileSettingsPage.tsx # Personalización de marca, calidad, idiomas y perfil
│   └── ServerConnectPage.tsx   # Asistente de conexión y acceso a Modo Demo
├── services/
│   ├── demoData.ts             # Catálogo de demostración sin servidor
│   └── jellyfinApi.ts          # Cliente HTTP tipado basado en la API OpenAPI de Jellyfin
└── types/
    └── jellyfin.ts             # Definiciones TypeScript para esquemas de Jellyfin
```

---

## Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
