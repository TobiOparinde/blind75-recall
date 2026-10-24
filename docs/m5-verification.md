# M5 verification

Validated on 24 October 2026 with Node 24.15.0. Final `npm run check` completed with exit code 0.

| Check | Result |
| --- | --- |
| ESLint | Passed; zero errors/warnings |
| Strict TypeScript | Passed across source, tests and configuration |
| Vitest | 20 files, 496 tests passed: 417 existing M1–M4 + 79 M5 |
| Chromium/WebKit | 150 passed: 75 each; all 116 existing cases + 34 M5 |
| Production/PWA build | Passed; manifest, precache and Workbox worker emitted |
| JavaScript gzip budget | 103,243 bytes including worker/Workbox, below 150,000 bytes |
| Git whitespace | `git diff --check` passed |

## Verified behavior

- Stats derives ready due totals, stored-deadline forecast, distinct-day streak, 30-logical-day retention, active maturity, historical category lapse rates and configured-threshold leeches. Tests cover empty history, boundary dates, archived/early/step events, overdue work, waiting steps, 21-day maturity boundary and rollover/DST.
- All Settings fields persist; comma-separated minute steps convert to integer milliseconds through existing M2 validation. Invalid goals/hours/intervals/steps/configurations and incompatible stored-card caps/indices fail without modifying schedules. New scheduling uses saved steps/easy interval, and first ticks honor saved timing.
- Export is deterministic and includes complete cards, archived history, settings, log IDs and pre-rating snapshots. Clean-browser import in both engines restores native IndexedDB cards/logs/settings exactly, survives reload and exports byte-identical JSON.
- Import previews counts without writing and requires explicit overwrite confirmation. Malformed JSON, incompatible format/version, unknown/missing fields, invalid settings/cards/logs, duplicates, orphan history and inconsistent summaries are rejected. Historical snapshot caps/step indices are not incorrectly checked against later settings.
- Injected failures in cards, reviewLogs, settings and metadata roll back the full replacement. The write boundary clones/revalidates data. Stale settings/import/reset actions cannot overwrite later changes; real cross-tab import conflict is tested.
- Reset requires both confirmation stages, supports cancellation, clears cards/history, restores defaults, retains the 75-problem Library/PWA, and advances revision. Reminder metadata is cleared safely.
- A persistent device-only reminder appears after 30 elapsed days and clears on an export request. Its writes leave the deck revision/export unchanged; optional housekeeping failures cannot block exporting.
- Stats, Settings, export/import and reset work offline after cached load. New-screen portrait/landscape/320px/tablet checks cover overflow, 16px inputs and unsaved-form preservation through rotation. WebKit Settings portrait and Stats landscape screenshots were visually inspected.

The first M5 browser pass exposed the first-review selector's label lookup. An explicit label association fixed it; the original test was retained. Initial stats fixtures reused problem IDs; fixtures were corrected without changing M2's duplicate-card guard. All original milestone test files/assertions remain unchanged.

## Scope

All M5 requirements are satisfied. No dependencies or database migration were added. M1 data/PWA configuration and M2 scheduler implementation remain unchanged. M4 exposes its existing transactional snapshot primitive to the M5 subclass; v1 metadata accepts an optional reminder key. See [management-contract.md](management-contract.md) for documented statistics, backup, settings-compatibility and reset decisions.

No blocking concerns remain. An export request cannot confirm that a user ultimately saved the download outside the app; help text makes this responsibility explicit. Physical iPhone/Safari download/install checks, VoiceOver, final accessibility/performance and deployment remain M6 work. M6 has not started.
