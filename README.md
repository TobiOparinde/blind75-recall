# Blind 75 Recall

An iPhone-first, offline PWA for recalling coding patterns. **M1–M5:** PWA shell, verified seed, pure scheduler, persistent Library, Today/review sessions with one-level undo, Stats, Settings and JSON backup/import/reset. M6's final device/accessibility/performance/deployment work is not started.

The source of truth is [the full build brief](docs/Blind%2075%20Recall%20Build%20Brief%20for%20Codex.pdf), supplemented by the [approved scheduler decisions](docs/scheduler-decisions.md), [persistence contract](docs/persistence-contract.md) and [review contract](docs/review-contract.md). Read the [M1–M6 plan](docs/implementation-plan.md) and [seed verification notes](docs/seed-notes.md) before extending the app.

## Run and check

Use Node.js 24.15+ in the 24.x line and npm. Supported ranges are 22.22.2+ in 22.x, 24.15+ in 24.x, or 26+. M3's jsdom test tooling sets this minimum; versions are pinned in `package-lock.json`.

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

- `npm run typecheck` — strict TypeScript, including tests and configuration.
- `npm run lint` — ESLint and React Hooks rules; zero warnings allowed.
- `npm test` — Vitest seed/scheduler/365-day simulations, fake-indexeddb transaction tests, presentation models and jsdom React component tests.
- `npm run build` — type-check, generate production PWA, enforce JS budget.
- `npm run test:e2e` — Chromium and WebKit checks against an existing `dist/` build; launches its own preview server.
- `npm run check` — lint, unit tests, build/type checks and browser tests.
- `npm run preview` — serve production output locally; use this for offline testing. Development mode deliberately does not register a worker.

The bundle gate conservatively sums every emitted JavaScript file gzipped individually, including service worker/Workbox, and requires **less than 150,000 bytes**.

## Layout

```text
docs/              Brief, milestone plan, scheduler/persistence contracts, verification
public/            Manifest icons and SVG favicon source
src/data/          Bundled JSON, runtime validation and unit tests
src/domain/        UI-independent problem, card, settings, log and undo types
src/library/       Framework-independent Library controller and presentation models
src/review/        Today/session controller, progress and preview presentation models
src/management/    Settings form conversion, backup validation and action controller
src/stats/         Pure forecast, retention, streak, maturity and lapse statistics
src/scheduler/     Pure scheduler, previews, calendar, queue and tests
src/storage/       Dexie schema, transactional repository, persistence tests
src/ui/            Shell, Today, Review, Library, dialogs, tokens and component tests
tests/e2e/         Production review/Library, recovery, cross-tab, offline and viewport tests
scripts/           Build-budget check
```

## Deploy and install

For a root-path static host such as Netlify or Vercel: run `npm ci && npm run build`, publish `dist/`, and enable HTTPS. Serve `sw.js` and `index.html` with revalidation rather than immutable caching; hashed assets may be immutable. No backend, secrets, accounts or environment variables are required. Deployment itself is deferred to M6. Subpath hosting needs base/scope adjustments first.

On iPhone, open the HTTPS deployment in Safari, choose **Share → Add to Home Screen → Add**, then launch the icon. After the first successful online load and worker activation, close and reopen offline to verify caching. New workers wait for existing windows to close, avoiding forced reloads during future reviews. Physical iPhone installation and safe-area/VoiceOver checks remain part of M6; desktop WebKit is only an automated approximation.

The PNG icons are rasterizations of `public/favicon.svg`; the maskable variant uses a full dark background and inset artwork. Do not add remote fonts or icon libraries.

## Local data

Cards, review logs and scheduler settings live in the browser's `blind75-recall` IndexedDB database (Dexie schema v1). Ticking adds a card for tomorrow by default. Removing archives it after confirmation; ticking it again restores its schedule and history. Membership actions offer one-level Undo, guarded against later changes in another tab. All screens work offline after the first cached load. No accounts or sync are implemented.

## Review

Today is the default screen; use `#library` to open Library directly. Start review follows the due queue, while any queue/Review early row starts that card manually. Show answer exposes links and four interval previews. Space reveals; 1–4 rate when ordinary controls are not focused. Goal hit pauses at the daily target; Keep going has no limit. Waiting cards show a countdown and explicit Show now override.

Accepted ratings atomically save card+log and offer one-level Undo rating. Reload rebuilds progress from committed logs without replaying the previous attempt. After a changed day/timezone or expired learning preview, Refresh intervals keeps the answer revealed while capturing a new proposal.

## Stats, settings and backups

Stats shows current due work, stored deadlines over seven days, streak, 30-day retention, maturity, weakest categories and leeches. Open Settings through Today's gear (`#settings`). Step inputs use comma-separated minutes. Settings are validated against every stored card; incompatible caps/step lists are rejected rather than silently rewriting schedules.

Use **Export JSON** and save the file outside the app. A gentle reminder appears after 30 days. **Import JSON** validates the version/data and previews counts before **Confirm overwrite** atomically replaces cards, logs and settings. Archived history and exact schedules survive the round trip. Cancel leaves data untouched. Reset requires two confirmations and returns an empty deck/default settings while keeping the Library and PWA cache. See the [management contract](docs/management-contract.md) for format, stats definitions and concurrency behavior.
