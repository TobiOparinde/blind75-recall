# M4 verification

Validated on 24 October 2026 using Node 24.15.0. Final `npm run check` completed with exit code 0.

| Check | Result |
| --- | --- |
| ESLint | Passed, zero errors/warnings |
| Strict TypeScript | Passed across application, controllers, storage, tests and configuration |
| Vitest | 14 files, 417 tests passed: 362 existing M1–M3 + 55 M4 |
| Chromium/WebKit | 116 browser tests passed: 58 each, including all 62 prior cases + 54 M4 |
| Production/PWA build | Passed; manifest, precache and Workbox worker emitted |
| JavaScript gzip budget | 98,633 bytes across all emitted JS including worker/Workbox; limit <150,000 bytes |

## Behavior covered

- Today goal ring, due count/state breakdown, streak, empty-deck Library link, caught-up state, picks/remaining queue, future manual rows, goal-1 Goal hit and unlimited Keep going.
- Existing M2 queue/scheduler integration for every rating, ordinary/early/manual reviews, exact deep equality between the captured displayed proposal and persisted card, early metadata and complete pre-rating snapshots.
- Hidden category on the front, external problem/answer links, answer reveal, four interval buttons, rating guide, close/progress controls and one-level undo.
- Atomic card/log/revision writes, rollback after card/log/metadata failure, duplicate delivery rejection, concurrency guards and committed-data reread after uncertain acknowledgement.
- Complete rating undo, deletion of exactly one latest log, restored progress/queue, single-level consumption, safe retry after a failed undo, cross-tab membership/rating invalidation and stale post-card rejection.
- Waiting learning countdown (including 7:42), opt-in Show now, automatic resumption only once actually due, and no archived-card review.
- Reload before/after revealing without a log, reload after commit without replay, and immediate reload during acceptance with either the whole transaction or no transaction. Reload does not recreate an undo chain.
- Offline rating/reload recovery and two-tab live progress updates.
- Space/numeric shortcuts, ordinary control/input exclusion, monotonic duration and preserved session identity/reveal/previews during rerender/rotation.
- Long-open answer remains revealed while a changed day/timezone or expired learning preview requires explicit Refresh intervals; no old-day rating is silently accepted.

The full viewport matrix and 320x568/1024x768 extensions verify preserved revealed state and exact previews after rotation, four rating controls across with 44-pixel targets and in-viewport bounds, and the Today primary action in the bottom 40% of the screen. Short landscape additionally verifies count/action side by side. Portrait/landscape Today and review screenshots were visually inspected. The first expanded geometry checks exposed action placement on tall devices; the layout was fixed while retaining those assertions.

## Scope and compatibility

No dependencies or schema migration were added. M2 scheduler code/tests and M1 seed/PWA configuration are unchanged. The M3 repository only exposes its existing snapshot/revision methods to the M4 subclass; membership behavior and snapshot shape remain intact. M3 browser setup now opens `#library` explicitly because Today is the new default screen; its prior assertions are preserved. The shared native fixture helper accepts additional settings for goal/step cases without exposing a production test API.

See [review-contract.md](review-contract.md) for the captured-preview, transaction, recovery, undo and UI-context rules. All M4 requirements are satisfied; there are no blocking issues. Physical iPhone/VoiceOver and final hardware performance checks remain M6. Stats, full Settings, backup/import and other M5 features have not begun.
