# Implementation plan

## Source and delivery gate

Read all 14 pages of `Blind 75 Recall Build Brief for Codex.pdf` (v1.0, 24 October 2026). The requested `Blind-75-Recall-Build-Brief.pdf` filename is absent; the existing PDF is preserved and authoritative. MUST/SHOULD/COULD priorities and confirmed decisions remain binding. Complete checks and make one commit per milestone before beginning the next. M1 was completed in `d7d7f1f`; M2 in `d5133fe`; M3 in `4225de7`; M4 in `ff26c45`; M5 in `1637bb6`. M6's software/automated acceptance work is recorded in [m6-verification.md](m6-verification.md). The [criterion-by-criterion audit](acceptance-audit.md) retains physical-device checks as open; GitHub publication is deferred at the owner's request.

## Milestones

| Milestone | Work and exit checks |
| --- | --- |
| M1 | React 18, strict TypeScript, Vite, offline PWA shell, exact theme tokens, separated modules, versioned live-verified 75-problem seed. Configure Vitest, Playwright and linting; validate schema, count, membership, bundle budget, manifest, icons and shell viewports; build successfully. |
| M2 | Resolve scheduler questions below, then implement pure `schedule(card, rating, now, settings)` and queue builder without UI. Centralize all section 7.2 defaults. Test every transition, lateness, early practice, deterministic fuzz, preview equality, rollover/DST, queue priorities/learn-ahead and a seeded 365-day simulation. |
| M3 | Add Dexie schema/migrations, Library grouping/filters and completion ticks. Default first review to tomorrow; archive and restore with history. Test transactional persistence, bulk ticking, restart recovery and cross-tab behavior. |
| M4 | Today picks/Up next, unlimited Keep going, arbitrary/early reviews, links-only reveal, rating previews, timer if included and one-level undo. Test repeat ratings, learning countdown, empty states, goal/streak accounting and rotation preserving session state. |
| M5 | Stats, Settings, versioned JSON export/import with validation, count preview and overwrite confirmation; double-confirm reset. Verify exact backup round trips, invalid imports, retention/forecast/maturity, configurable steps and backup reminder if feasible. |
| M6 | Full portrait/landscape/tablet pass at all specified sizes and 320–1024 px widths. Verify safe areas on iPhone, VoiceOver/focus/contrast, offline installation, performance (1.5 s cold, 100 ms rating, Lighthouse 90+/90+), <150 KB gzip JS, deployment and final README. |

## M6 final implementation boundary

All prior scheduler, persistence and management contracts remain intact. M6 fixes measured accessibility issues (visible/accessible name agreement, scroll-region/route/reveal focus, control-border contrast, answer-track collapse at 200% text), exposes testable safe-area CSS variables retaining all four env() values, and adds a bounded immutable-history calendar cache after profiling repeated Intl work. It adds no runtime dependency or schema change. Existing review name assertions now include visible number/status/difficulty; the component test expands its native details before querying the row. No scheduling assertion was removed.

Final checks include WCAG-tagged axe scans, all-screen viewport/target geometry, 200% text, every integer width 320–1024, injected insets, real-clock 5000-log rating/launch measurements, Lighthouse mobile scores and root/subpath production/PWA checks. The manual-only GitHub Pages workflow follows the owner's instruction to publish later. Real iPhone install/standalone/safe areas, VoiceOver and 4G timing remain explicitly unexecuted, with a [device checklist](physical-device-checklist.md); automated success does not close those items.

## Original review findings and remaining milestone decisions

The numbered findings below preserve the original review. M2's scheduler decisions are now approved and recorded in [scheduler-decisions.md](scheduler-decisions.md), including both user amendments: retain section 7.9's early-review equations (no blanket freeze) and keep preview/application equality based on identical captured inputs (no stale-preview mechanism). Items concerning persistence, UI and accessibility remain implementation work for their milestones; they must follow that contract.

M3 resolves membership/persistence with a transactional Dexie v1 repository, no-delete archive/restore, settings validation, guarded Library undo and live queries across tabs. M4 extends that boundary without a schema migration: atomic card+log+revision writes, guarded latest-log undo, optimistic UI and committed-data recovery. M2 scheduling remains unchanged. Long-open preview handling is confined to the M4 UI and keeps the displayed result fixed until an explicit refresh.

1. **M2: maximum versus strict ordering.** Section 7.3 requires growth beyond the previous interval, a 180-day maximum, and `Hard < Good < Easy` after clamping. At an existing 180-day interval, these cannot all hold. Decide which invariant wins; do not silently exceed the cap or shorten Hard.
2. **M2: early review.** Section 7.9's `max(old dueDay, today + calc)` can extend a date even for Good, whereas its test says Good leaves the date unchanged. Example: interval 10, nine days elapsed, ease 2.5 gives approximately 23 days. It also permits repeated Easy to increase ease. Define the intended non-inflation guarantee and treatment of never-reviewed new cards before adding assertions.
3. **M2: relearning.** Hard and non-final Good/Easy transitions are missing for configurable multi-step relearning. Step units, empty-step validation, and rounding/fuzz bounds also need explicit conventions. A minimum one-day fuzz can exceed 5% on small intervals.
4. **M2: calendar math.** Local days across DST are not fixed 86,400,000 ms intervals. Use civil-calendar day arithmetic after local rollover, while learning uses absolute UTC milliseconds. Specify timezone-change behavior and deterministic queue tie seeds.
5. **M3/M4: log and undo.** Section 6 calls the log append-only; section 7.7 deletes the undone entry. Listed fields cannot restore all card fields (dueAt, stepIndex, reps, lapses, etc.). Section 7.9 additionally requires `early: true`. Agree an explicit versioned snapshot/log extension and transactional undo exception.
6. **M3/M4: goal and queue.** Immediate deck membership is compatible with tomorrow's first due date; it must not force same-day review. The goal is a soft target, not a daily new-card limit. Clarify whether repeated attempts of one card count multiple times and whether picks shrink with today's completed reviews.
7. **M4: notes conflict.** The rotation rule mentions notes text, but the confirmed MVP back is links only with no notes UI. Preserve only implemented session state; do not introduce notes to satisfy that incidental phrase.
8. **M3/M6: storage and updates.** IndexedDB writes do not emit localStorage `storage` events; use an explicit cross-tab mechanism. iOS eviction makes backup essential. Workers must not force a reload mid-review. M1 uses a waiting-worker lifecycle; update UI can follow in a later milestone.
9. **M4/M6: color and accessibility.** Preserve exact token colors, but choose foregrounds and badge surfaces by measured contrast; white on accent colors is not automatically WCAG AA. No forced orientation, font downloads or heavy UI/chart libraries.

## M1 implementation choices

- Plain CSS tokens; only React/ReactDOM are direct application dependencies. Install Dexie and routing/store libraries when used, not as unused placeholders.
- Seed envelope adds `schemaVersion` and `seedVersion`; Problem fields follow section 6. `order` is one-based global position in the rendered live list. Six Premium flags and LeetCode numbers come from Appendix A (39 is verified separately); titles, links, grouping and ordering come from the live list.
- Safari 16 build target and Node 22.12+ tooling baseline. Root-path HTTPS static hosting initially; subpath deployment requires coordinated Vite base, manifest scope and worker changes.
- M1 has only a collection-loaded shell. Navigation, Today, Library, Stats, Settings, scheduling and persistence remain unimplemented.
- The M1 shell uses a compact left header in short landscape viewports. Actual navigation rail, review columns and sticky actions belong to their screen milestones.
- Automated WebKit checks are not proof of physical iPhone installation, safe-area rendering, VoiceOver or 4G performance. Those remain explicit M6 device checks.
