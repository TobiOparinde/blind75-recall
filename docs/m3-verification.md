# M3 verification

Validated on 24 October 2026 with `npm run check`, exit code 0, using Node 24.15.0.

| Check | Result |
| --- | --- |
| ESLint | Passed with zero errors/warnings |
| Vitest | 10 files, 362 tests passed: 43 M1 + 262 M2 + 57 M3 |
| Strict TypeScript | Passed across application, storage, domain, tests and configuration |
| Production/PWA build | Passed; manifest, Workbox worker and precache emitted |
| All emitted JavaScript gzip budget | 93,038 bytes including worker/Workbox, below 150,000 bytes |
| Playwright | 62 passed: 31 Chromium + 31 WebKit; includes all 24 unchanged M1 cases and 38 M3 cases |

## Behavior verified

- All 75 problems in 18 verified collapsible categories, correct numbers/titles/difficulty/Premium labels, global active completion count and difficulty-split progress.
- Combined completion/difficulty filters, archive exclusion from active scheduling, state-specific row status, bulk category marking and multiple independent ticks.
- Immediate optimistic ticks before the database write completes; canonical new-card defaults, difficulty-based ease, persisted today/tomorrow timing and timezone/rollover use.
- Explicit removal confirmation, Cancel/Escape without a write, archive instead of deletion, and exact restore on re-tick without resetting schedule, notes, counts or history.
- Single/bulk membership undo, preserving earlier active records; first-tick undo archives rather than deletes. Revision and complete post-card guards reject stale undo.
- Dexie schema v1 persists cards, review logs and settings across reload and connection close/reopen. Existing history survives archive, restore and undo. Initialization is idempotent and never clears populated stores.
- Atomic rollback on card-write or related metadata-write failure, concurrent duplicate/distinct additions, invalid settings rejection, live queries across connections and two real browser tabs.
- Failed optimistic saves restore confirmed data and offer Retry; failed reads do not expose an editable empty replacement deck. Retry can reopen a closed connection without resetting saved settings/cards/logs.
- Offline reload and further offline ticks, followed by another reload retaining both changes.
- Library rows, 44-pixel checkbox label targets, visible Undo toast and confirmation bounds at 375x667, 390x844, 430x932, 667x375, 844x390, 932x430, 820x1180, 320x568 and 1024x768. Difficulty badge text contrast is at least 4.5:1 while preserving the specified token colors.

WebKit screenshots at 390x844, 844x390 and 320x568 were visually inspected. An initial WebKit test exposed that mouse-clicking a checkbox does not necessarily focus it; the dialog now explicitly returns focus to its triggering checkbox, and the original assertion passes. A test-fixture import was corrected to avoid Node's unsupported bare JSON import path; no application seed/import behavior was changed.

## Scope and dependencies

Dexie 4.4.7 is the only added runtime dependency. fake-indexeddb 6.2.6, jsdom 30.1.3 and Testing Library React/user-event are test-only. The new jsdom dependency requires Node 22.22.2+ in 22.x, 24.15+ in 24.x, or 26+; the manifest, lockfile and run/contributor instructions now agree on that floor.

The shell is extended into the Library, with dense phone/landscape layout. M1 seed data, PWA configuration and browser tests, and all M2 scheduler code/tests are unchanged. [persistence-contract.md](persistence-contract.md) records the database schema, boundaries, transaction/undo protocol, filter/bulk behavior and M4 integration obligations.

All M3 requirements are satisfied. There are no blocking issues. No Today/review flow, review-session UI, rating persistence/undo effects, Stats or Settings screens were added. Physical iPhone installation/VoiceOver and the full performance acceptance pass remain M6 work; backup/import remains M5. M4 has not begun.
