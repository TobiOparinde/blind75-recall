# Final code and iPhone readiness review

Reviewed on 25 October 2026 (Europe/London), after M6 commit `983e438`. Scope: all application layers, configuration/PWA/deployment scripts, existing contracts and regression coverage. The approved scheduling equations, seed, database schema and runtime dependencies are unchanged. Publication remains the owner's next action.

## Findings fixed

- **Growing history:** the 8,192-entry timestamp cache previously cleared itself during sequential history scans. Once a deck exceeded that size, every render repeated calendar conversions. The bounded cache now retains its entries, and a WeakMap reuses dates for live immutable log objects without retaining discarded snapshots. Timestamp changes, rollover and timezone changes invalidate the relevant result. The regression tests verify zero repeated conversions for a live 10,000-log snapshot and bounded reuse on database rehydration.
- **Storage work:** rating/settings/import transactions previously loaded the complete history before and after writes, even though their initial checks needed only cards/settings/revision. They now load history only in the returned snapshot; undo uses the latest-log index for its initial guard. Transaction boundaries, atomic rollback, concurrency protection and exact undo remain unchanged.
- **Cross-tab waiting:** removing the final waiting card could leave an empty waiting screen. Waiting sessions now reconcile with the authoritative queue after changes, returning to Today when no work remains and resuming ready work added elsewhere.
- **Import race:** file reading previously occurred before the management busy flag. Reading, validation and preview preparation now share that lock; another selection/save/reset cannot overtake a slow file read. Failures preserve existing data.
- **Settings feedback:** save results and storage validation errors could appear above a scrolled form, out of sight. Feedback now receives focus and scrolls into view; a new submit clears superseded messages. Portrait/landscape tests verify visible success and error messages, useful focus and no stale duplicate error.
- **Extreme settings:** positive integers alone could admit step durations whose deadlines overflow JavaScript's date range. Save/import validation now checks representable timestamps and safe due-day arithmetic at the captured time, before any write. Ordinary settings and existing deadlines are unchanged.
- **Safe-area confirmations:** top-layer dialogs do not inherit their ancestor's layout padding. Removal dialogs now explicitly reserve all four safe-area insets and scroll within their bounded height.
- **Enlarged text:** 200% text plus simulated landscape insets shrank rating targets below 44px; forcing narrow columns also clipped tall rating labels. Spacing no longer expands at the expense of targets, and ratings have a 44px minimum width. Normal phone landscape keeps two columns. When enlarged text cannot fit both columns, the review reflows vertically and scrolls without shrinking text. The same answer, previews and attempt remain active through rotation.

## Verification

`npm run check` passed on the final code: ESLint with zero warnings, **507 unit/component tests across 21 files**, strict TypeScript, production/PWA build and **196 browser tests (98 Chromium + 98 WebKit)**. The browser run took 6.3 minutes. All emitted JavaScript, including worker/Workbox, totals **103,728 gzip bytes**, below 150,000. `git diff --check` passed. Baseline M1–M6 reports remain historical evidence.

Additional browser coverage exercises removal dialogs and a long-title, expanded-guide review at 200% text through portrait/landscape rotation with four injected safe-area insets. Existing tests still cover every required viewport, all widths 320–1024, focus/keyboard behavior, contrast, reduced motion, offline reload/recovery, all ratings, archive/restore, import/reset and exact scheduler previews. No existing assertion was weakened.

The production performance test now runs both 5,000- and 10,000-rating histories with 75 cards, real clocks and ten rating samples per browser. Measurements are unthrottled Windows localhost values, not physical iPhone measurements. Cold/warm/offline launch measurements use a fresh empty deck; history is loaded before the interaction benchmark.

| Browser / historical ratings | Cold / warm / offline ready | Rating median / p95 paint |
| --- | --- | --- |
| Chromium / 5,000 | 145 / 41 / 52ms | 25 / 28ms |
| Chromium / 10,000 | 117 / 47 / 39ms | 28 / 80ms |
| WebKit / 5,000 | 439 / 261 / 253ms | 31 / 34ms |
| WebKit / 10,000 | 409 / 252 / 263ms | 34 / 63ms |

All four cases pass the <100ms rating gate. Exact samples and browser versions are in [final-performance-results.json](final-performance-results.json). Chromium is 156.0.8078.4; WebKit is 27.2. Normal and enlarged-text landscape screenshots were visually inspected in both engines.

`npm run audit` passed: Lighthouse 13.5.0, installed headless Chrome 155, Windows x64, AMD Ryzen 7 6800H, Node 24.15.0. Default simulated mobile settings: 412×823, DPR 1.75, 4× CPU slowdown, 150ms RTT / 1638.4 Kbps. Actual scores were **99 Performance / 100 Accessibility on Today, Library, Stats and Settings**. Simulated LCP was respectively 1736, 1660, 1673 and 1658ms. These LCP values exceed 1.5s and do not establish the separate physical iPhone cold-interactive target. Full measurement/configuration summary: [final-lighthouse-summary.json](final-lighthouse-summary.json); raw reports are reproducible in `.local/lighthouse/`.

`npm run check:deploy` passed in Chromium and WebKit: project-subpath assets/icons/manifest, worker scope, persisted membership and offline reload/navigation. Chromium installability diagnostics returned no errors. Subpath JavaScript totals **103,744 gzip bytes**. Evidence: [final-deploy-verification.json](final-deploy-verification.json). This verifies local deployment output, not a hosted GitHub Actions run.

## Remaining device checks

Real Safari/Home Screen installation, VoiceOver, hardware safe areas, Dynamic Type/browser keyboard behavior and iPhone/4G timing require the [physical-device checklist](physical-device-checklist.md). Automated Chromium/WebKit results cannot close those checks. No GitHub push or publication was performed.
