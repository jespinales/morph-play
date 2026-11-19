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
  - Route all Jellyfin requests and `demo://` fallbacks through `src/shared/api/`.

## Conventions & Guardrails
- Write all code, comments, config files, and commit messages in **English**. Keep `README.md` in **Spanish**.
- Use original MorphPlay and Jellyfin terminology across code, comments, UI copy, and docs.
- TypeScript uses `strict`, `noUnusedLocals`, and `noUnusedParameters` (`tsconfig.json`).
- Add every new UI copy key to both `en` and `es` in `src/shared/i18n/translations.ts` (`npm test` enforces key parity).
- Runtime Docker env vars (`JELLYFIN_SERVER_URL`, `APP_NAME`, `APP_LOGO_URL`) are injected at container startup by `docker-entrypoint.sh` via `window.__ENV__` (`env-config.js`), not baked into the Vite bundle.
- Validate custom logo URLs with `isSafeLogoUrl`; keep brand editing restricted to Jellyfin administrators (`Policy?.IsAdministrator`).
- Keep `.env` and local files in `brand/` untracked.
