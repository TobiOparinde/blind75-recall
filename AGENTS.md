# Repository Guidelines

## Project Structure & Module Organization

Blind 75 Recall is an iPhone-first, offline spaced-repetition PWA. Read `docs/Blind 75 Recall Build Brief for Codex.pdf` in full before implementation; it is the source of truth. Follow the approved amendments in `docs/scheduler-decisions.md` and milestone gates in `docs/implementation-plan.md`. M1/M2 are implemented; do not silently start later milestones.

Use `src/ui/` for React components and CSS, `src/data/` for bundled JSON and validation, `src/domain/` for UI-independent types, and `src/scheduler/` for pure scheduling/calendar/queue functions. `src/storage/` documents M3's Dexie boundary. PWA icons live in `public/`. Colocate unit tests with modules; keep browser tests in `tests/e2e/`.

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

Use React 18, strict TypeScript, two-space indentation and LF endings (`.editorconfig`). Use PascalCase components, camelCase functions and stable problem IDs such as `lc-1`. Share CSS tokens from `src/ui/styles/tokens.css`; avoid downloaded fonts and heavy UI dependencies. Pass captured time/timezone explicitly to scheduling functions; defaults live in `src/scheduler/config.ts`. Keep runtime dependencies justified by the <150,000-byte gzip budget.

## Testing Guidelines

Name Vitest files `*.test.ts` and Playwright flows `*.spec.ts`. Preserve M1's seed/PWA/browser checks and M2's transition, preview, fuzz, cap, early-review, queue, rollover/DST and 365-day simulation tests. No numeric coverage threshold is specified. Browser tests do not replace physical iPhone checks.

## Commit & Pull Request Guidelines

Commit once per milestone after its checks pass; use a short descriptive summary, e.g. `M1: scaffold PWA and validate Blind 75 seed`. PRs should describe behavior changes, reference requirements or issues, list validation, and include portrait/landscape screenshots for UI changes. Record live-list deviations in `docs/seed-notes.md`.
