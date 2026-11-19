# MorphPlay

React 18 + TypeScript + Tailwind CSS + Vite web client for Jellyfin (`hls.js` for HLS playback).

## Commands
- `npm run dev`: Start Vite dev server.
- `npm test`: Run Vitest suite (`vitest run`).
- `npm run build`: Typecheck and build production bundle (`tsc -b && vite build`).
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`: Rebuild local Docker container.

Run `npm test` and `npm run build` after code changes.

## Architecture (Feature-Based Layered)
- `src/app/`: App shell and routing (`App.tsx`), global `layout/` (`Navbar`), and React `providers/` (`AuthProvider`, `PreferencesProvider`). Only layer allowed to compose multiple features.
- `src/features/<domain>/`: Isolated vertical slices (`auth`, `catalog`, `media-detail`, `player`, `settings`).
  - Keep state/API orchestration in `hooks/` and presentation in `components/`.
  - May consume `src/app/providers/` and `src/shared/`, but **never import across `src/features/*`**; coordinate feature interactions via `src/app/App.tsx` or promote reusable code to `src/shared/`.
- `src/shared/`: Cross-cutting foundation (`api/`, `components/`, `i18n/`, `types/`, `utils/`). Must **never** import from `src/app/` or `src/features/`.
  - Route all Jellyfin requests and `demo://` fallbacks through `src/shared/api/` (Jellyfin API docs: https://api.jellyfin.org/).

## Conventions & Guardrails
- Write all code, comments, config files, and commit messages in **English**. Keep `README.md` in **Spanish**.
- Use original MorphPlay and Jellyfin terminology across code, comments, UI copy, and docs.
- TypeScript uses `strict`, `noUnusedLocals`, and `noUnusedParameters` (`tsconfig.json`).
- Add every new UI copy key to both `en` and `es` in `src/shared/i18n/translations.ts` (`npm test` enforces key parity).
- Runtime Docker env vars (`JELLYFIN_SERVER_URL`, `APP_NAME`, `APP_LOGO_URL`) are injected at container startup by `docker-entrypoint.sh` via `window.__ENV__` (`env-config.js`), not baked into the Vite bundle.
- Validate custom logo URLs with `isSafeLogoUrl`; keep brand editing restricted to Jellyfin administrators (`Policy?.IsAdministrator`).
- Keep `.env` and local files in `brand/` untracked.

## Jellyfin API Support (10.10+ Target)
- **Reference Spec**: Official OpenAPI documentation at `https://api.jellyfin.org/` targeting **Jellyfin Server 10.10+** (`MediaSegments` and `Trickplay` require `10.10+`; core catalog/playback degrades gracefully on older servers).
- **Implemented API Surface (`src/shared/api/`)**:
  - **Auth & Users** (`jellyfin.ts`): `/System/Info/Public`, `/Users/Public`, `/Users/AuthenticateByName`, `/Sessions/Logout`, `/QuickConnect/*` + `/Users/AuthenticateWithQuickConnect`, `/Users/{id}` and `/Users/{id}/Configuration`.
  - **Catalog, Discovery & Playlists** (`jellyfin.ts`): `/Users/{id}/Views`, `/Users/{id}/Items/Resume` (deduplicated to 1 most recently played episode per series), `/Shows/NextUp`, `/Users/{id}/Items/Latest`, paginated `/Users/{id}/Items`, `/Genres`, `/Items/Suggestions`, `/Search/Hints`, `/Shows/{id}/Seasons`, `/Shows/{id}/Episodes`, `/Items/{id}/Similar`, `LocalTrailers`, `SpecialFeatures`, `FavoriteItems`, `PlayedItems`, `/UserItems/{id}/UserData`, and `/Playlists/*`.
  - **Playback & Media** (`jellyfin.ts`, `playback.ts`): `/Items/{id}/PlaybackInfo`, Direct Play (`/Videos/{id}/stream`), adaptive HLS (`/Videos/{id}/master.m3u8` + `SubtitleMethod=Encode` burn-in and VTT subtitle streams), `/MediaSegments/{id}`, `/Videos/{id}/Trickplay/...`, and item/chapter/person/user image URLs.
  - **Sessions, WebSocket & SyncPlay** (`jellyfin.ts`, `websocket.ts`): `/Sessions/Capabilities/Full`, `/Sessions/Playing{,/Progress,/Stopped}` (with `keepalive` on `pagehide`), `/Sessions?ControllableByUserId=...`, `/Sessions/{id}/Playing`, `/SyncPlay/*` (`List`, `New`, `Join`, `Leave`, `SetNewQueue`, `Pause`, `Unpause`, `Seek`, `Ready`, `Buffering`), and `/socket` (`UserDataChanged`, `LibraryChanged`, `Play`, `Playstate`, `SyncPlayCommand`, `SyncPlayGroupUpdate`).
