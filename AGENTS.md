# Repository Guidelines

## Project Structure & Module Organization

Blind 75 Recall is an iPhone-first, offline spaced-repetition PWA. Read `docs/Blind 75 Recall Build Brief for Codex.pdf` in full before implementation; it is the source of truth. Consult `docs/implementation-plan.md` for milestone gates and unresolved requirements. M1 is implemented; do not silently start later milestones.

Use `src/ui/` for React components and CSS, `src/data/` for bundled JSON and validation, and `src/domain/` for UI-independent types. `src/scheduler/` and `src/storage/` currently document boundaries for M2's pure functions and M3's Dexie persistence. PWA icons live in `public/`. Colocate unit tests with modules; keep browser tests in `tests/e2e/`.

## Build, Test, and Development Commands

Use Node 22.12+ and npm; install locked dependencies with `npm ci`. Install browser engines with `npx playwright install chromium webkit`.

- `npm run dev`: start Vite locally.
- `npm run typecheck`: check strict TypeScript across source, tests and configuration.
- `npm run lint`: run ESLint with zero warnings allowed.
- `npm test`: run Vitest once; `npm run test:watch` watches changes.
- `npm run build`: type-check, build the PWA and enforce the gzip JavaScript budget.
- `npm run test:e2e`: test an existing production build with Playwright.
- `npm run check`: run the full validation sequence.

## Coding Style & Naming Conventions

Use React 18, strict TypeScript, two-space indentation and LF endings (`.editorconfig`). Use PascalCase components, camelCase functions and stable problem IDs such as `lc-1`. Share CSS tokens from `src/ui/styles/tokens.css`; avoid downloaded fonts and heavy UI dependencies. Pass time explicitly into future scheduler functions and centralize scheduler defaults in M2. Keep runtime dependencies justified by the <150,000-byte gzip budget.

## Testing Guidelines

Name Vitest files `*.test.ts` and Playwright flows `*.spec.ts`. M1 checks schema, membership/order, icons, offline reloads and viewport layout in Chromium/WebKit. M2 must add every required transition, preview equality, deterministic fuzz, rollover/DST, early reviews and the 365-day simulation. No numeric coverage threshold is specified. Browser tests do not replace physical iPhone checks.

## Commit & Pull Request Guidelines

Commit once per milestone after its checks pass; use a short descriptive summary, e.g. `M1: scaffold PWA and validate Blind 75 seed`. PRs should describe behavior changes, reference requirements or issues, list validation, and include portrait/landscape screenshots for UI changes. Record live-list deviations in `docs/seed-notes.md`.
