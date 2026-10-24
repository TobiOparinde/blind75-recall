# M2 verification

Validated on 24 October 2026 with `npm run check`, exit code 0.

| Check | Result |
| --- | --- |
| ESLint | Passed, zero errors/warnings |
| Vitest | 7 files, 305 tests passed: 43 M1 seed tests + 262 M2 tests |
| Strict TypeScript | Passed across application, domain, tests and configuration |
| Vite/PWA production build | Passed; manifest, precache and service worker emitted |
| Initial JavaScript budget | 56,000 bytes gzip including Workbox/worker, below 150,000 bytes |
| Playwright | 24 passed: 12 Chromium + 12 WebKit, including offline reload and the M1 viewport matrix |

M2 unit tests cover all default and configurable multi-step transitions; exact ordinary, late and early-review formula fixtures; successful early reviews that preserve or extend schedules; early Again; ten repeated early Goods; deterministic fuzz vectors/ranges; growth/order/cap saturation; deep preview/application equality for identical captured inputs; immutable inputs; configuration/card validation; queue priority, seeded ties/collision fallback, soft goal and explicit learn-ahead; and timezone/clock changes.

Calendar tests include 03:59/04:00/04:01, 23-hour and 25-hour London days, nonexistent/repeated rollover times, New York DST, Lord Howe's half-hour change, and Troll's two-hour transitions. The fall-back test verifies that a day does not roll backward after the first rollover occurrence.

Two seeded 365-day simulations run over all 75 problems: default configuration in Europe/London, and multi-step learning/relearning with a 30-day cap in America/New_York. Each is repeated and compared for full reproducibility. Every accepted rating checks preview equality, finite fields, nonnegative/bounded intervals, ease at least 1.3, counters and early no-shortening invariants. Every rating and state is exercised, with over 1,000 accepted ratings per run.

The approved contract is in `scheduler-decisions.md`. Successful early reviews retain the written section 7.9 equations; no blanket freeze or stale-preview UI mechanism was added. The domain includes early metadata and a complete pre-rating snapshot for later transactional undo.

No dependencies were added. M1 application, seed, PWA configuration and browser tests were preserved; documentation was updated for current milestone status. The pure M2 module is type-checked/tested but is not imported into the shell until later UI milestones, so the measured initial bundle is unchanged.

There are no blocking M2 issues. IndexedDB, configuration migration transactions, log persistence, undo handlers, UI integration and long-open review-screen behavior remain work for the approved later milestones. M3 has not begun.
