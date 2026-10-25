# Blind 75 Recall

An iPhone-first, offline PWA for recalling coding patterns. M1–M6 implementation is in place: persistent Library, pure scheduler, Today/review/undo, Stats, Settings and JSON backup/import/reset, with responsive/accessibility/performance checks and a GitHub Pages deployment workflow. Physical iPhone acceptance and publication remain explicitly pending; see the [acceptance audit](docs/acceptance-audit.md).

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
- `npm run audit` — mobile Lighthouse Performance/Accessibility on all four routes; raw HTML/JSON reports and environment in `.local/lighthouse/`. Uses installed Chrome or Playwright Chromium; set `CHROME_PATH` if necessary. Scores below 90 fail the command.
- `npm run check:deploy` — separately build `/blind75-recall/`, check its JS budget, manifest/icons/worker/installability, and test persisted offline routes in Chromium/WebKit. Output is `.local/pages-dist/`, leaving `dist/` intact.
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

The owner will publish to GitHub later; no deployment has been performed. The included `.github/workflows/pages.yml` is **manual only**, so pushing the repository does not publish automatically.

1. Create/connect your GitHub repository and push this project's committed files.
2. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**. Enable Actions if needed and configure the `github-pages` environment's allowed deployment branch.
3. Open **Actions → Deploy Recall to GitHub Pages → Run workflow**, selecting the intended release branch. It installs Node 24.15, runs the complete check suite, Lighthouse and subpath smoke test, builds with the Pages-provided base path, then uploads/deploys `dist/`.
4. Open the deployment URL shown by the workflow. Verify routes, icons, manifest/worker scope, offline reload and the [physical-device checklist](docs/physical-device-checklist.md). The workflow has not been run on GitHub in this environment.

This supports project sites (`https://USER.github.io/REPO/`), user sites and custom domains. For local subpath reproduction in PowerShell:

```powershell
$env:BASE_PATH = '/REPO/'
npm run build
npm run preview
# Open http://127.0.0.1:4173/REPO/
Remove-Item Env:BASE_PATH
```

`BASE_PATH` defaults to `/` and must end with `/`; Vite assets, manifest id/start/scope/icons, registration and offline fallback use it together. Hash routes need no server rewrite. For another static host, build for its path, publish `dist/` over HTTPS and revalidate `sw.js`/`index.html` rather than applying immutable caching; hashed assets may be immutable. No backend, account or app secrets are needed. These steps follow the [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) and [GitHub custom-workflow requirements](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Data is local to the browser origin. Export before moving from localhost or another host, then import the file at the published URL. A code deployment does not transfer local IndexedDB data.

On iPhone, open the HTTPS deployment in Safari, choose **Share → Add to Home Screen → Add**, then launch the icon. After the first successful online load and worker activation, close and reopen offline to verify caching. New workers wait for existing windows to close, avoiding forced reloads during reviews. Physical iPhone installation, safe areas, VoiceOver and 4G timing still require the linked checklist; desktop WebKit is only an automated approximation.

The PNG icons are rasterizations of `public/favicon.svg`; the maskable variant uses a full dark background and inset artwork. Do not add remote fonts or icon libraries.

## Local data

Cards, review logs and scheduler settings live in the browser's `blind75-recall` IndexedDB database (Dexie schema v1). Ticking adds a card for tomorrow by default. Removing archives it after confirmation; ticking it again restores its schedule and history. Membership actions offer one-level Undo, guarded against later changes in another tab. All screens work offline after the first cached load. No accounts or sync are implemented.

## Review

Today is the default screen; use `#library` to open Library directly. Start review follows the due queue, while any queue/Review early row starts that card manually. Show answer exposes links and four interval previews. Space reveals; 1–4 rate when ordinary controls are not focused. Goal hit pauses at the daily target; Keep going has no limit. Waiting cards show a countdown and explicit Show now override.

Accepted ratings atomically save card+log and offer one-level Undo rating. Reload rebuilds progress from committed logs without replaying the previous attempt. After a changed day/timezone or expired learning preview, Refresh intervals keeps the answer revealed while capturing a new proposal.

## Stats, settings and backups

Stats shows current due work, stored deadlines over seven days, streak, 30-day retention, maturity, weakest categories and leeches. Open Settings through Today's gear (`#settings`). Step inputs use comma-separated minutes. Settings are validated against every stored card; incompatible caps/step lists are rejected rather than silently rewriting schedules.

Use **Export JSON** and save the file outside the app. A gentle reminder appears after 30 days. **Import JSON** validates the version/data and previews counts before **Confirm overwrite** atomically replaces cards, logs and settings. Archived history and exact schedules survive the round trip. Cancel leaves data untouched. Reset requires two confirmations and returns an empty deck/default settings while keeping the Library and PWA cache. See the [management contract](docs/management-contract.md) for format, stats definitions and concurrency behavior.
