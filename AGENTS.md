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

## Jellyfin API Support (OpenAPI 12.4.0 Spec)
- **Reference Spec**: Local OpenAPI `3.0.4` spec in `docs/jellyfin-openapi-stable.json` (`Jellyfin API 12.4.0`, source: `https://api.jellyfin.org/`). Core features target `12.4.0` while `MediaSegments` and `Trickplay` require `10.10+` servers.
- **Implemented API Surface (`src/shared/api/`)**:
  - **Auth & Users** (`jellyfin.ts`, `jellyfinExtended.ts`): `/System/Info/Public`, `/Branding/Configuration`, `/Users/Public`, `/Users/AuthenticateByName`, `/Sessions/Logout`, `/QuickConnect/*` + `/Users/AuthenticateWithQuickConnect`, `/Users/{id}`, `/Users/Configuration`, `/Users/Password`, and `/DisplayPreferences/{id}`.
  - **Catalog, Collections & Playlists** (`jellyfin.ts`, `jellyfinExtended.ts`): `/UserViews`, `/UserItems/Resume` (deduplicated to 1 most recently played episode per series), `/Shows/NextUp`, `/Shows/Upcoming`, `/Items/Latest`, paginated `/Items`, `/Items/{id}`, `/Genres`, `/Items/Filters2`, `/Years`, `/Items/Suggestions`, `/Movies/Recommendations`, `/Search/Hints`, `/Shows/{id}/Seasons`, `/Shows/{id}/Episodes`, `/Items/{id}/Similar`, `LocalTrailers`, `SpecialFeatures`, `ThemeMedia`, `Collections`, `Ancestors`, `ExternalIdInfos`, `AdditionalParts`, `/UserFavoriteItems/{id}`, `/UserPlayedItems/{id}`, `/UserItems/{id}/Rating`, `/UserItems/{id}/UserData`, `/Collections/*`, and `/Playlists/*` (including `Move`, rename, public toggle, and user shares).
  - **Playback, Subtitles & Media** (`jellyfin.ts`, `jellyfinExtended.ts`, `playback.ts`): `/Items/{id}/PlaybackInfo` (negotiating `TranscodingUrl` + `AlwaysBurnInSubtitleWhenTranscoding`), `/Playback/BitrateTest`, Direct Play (`/Videos/{id}/stream`), `/Items/{id}/Download`, VTT & remote subtitle search/download/upload/delete (`/Items/{id}/RemoteSearch/Subtitles/*`, `/Videos/{id}/Subtitles`), `/MediaSegments/{id}`, `/Videos/{id}/Trickplay/...`, item/chapter/person image URLs, `/UserImage`, and `/Audio/{id}/stream`.
  - **Sessions, WebSocket & SyncPlay** (`jellyfin.ts`, `jellyfinExtended.ts`, `websocket.ts`): `/Sessions/Capabilities/Full`, `/Sessions/Playing{,/Progress,/Stopped,/Ping}` (with `keepalive` on `pagehide`), `/Sessions?controllableByUserId=...`, `/Sessions/{id}/Playing`, `/Sessions/{id}/Playing/{command}`, `/Sessions/{id}/Message`, full `/SyncPlay/*` suite (`List`, `{id}`, `New`, `Join`, `Leave`, `SetNewQueue`, `Queue`, `Pause`, `Unpause`, `Seek`, `Ready`, `Buffering`, `Ping`, `NextItem`, `PreviousItem`, `SetPlaylistItem`, `MovePlaylistItem`, `RemoveFromPlaylist`, `SetRepeatMode`, `SetShuffleMode`, `SetIgnoreWait`, `Stop`), and `/socket` (`UserDataChanged`, `LibraryChanged`, `Play`, `Playstate`, `SyncPlayCommand`, `SyncPlayGroupUpdate`).
