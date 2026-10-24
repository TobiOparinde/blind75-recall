# Library and persistence contract (M3)

M3 implements the Library and deck membership only. The approved M2 scheduling algorithms and card/log types remain unchanged. No review-session, Today, Stats, Settings, backup or review-undo UI is implemented.

This document records the M3 baseline. M4 now supplies rating/log writes and rating undo through ReviewRepository, sharing the same v1 stores and revision. See [review-contract.md](review-contract.md) for the current rating/session extension; membership behavior below is retained.

M5 adds ManagementRepository for revision-guarded settings, validated atomic backup replacement and reset. The same metadata store gains optional device-only backupReminderAt; no schema migration is required. See [management-contract.md](management-contract.md) for the portable format and current management boundary.

## Database and boundaries

`src/storage/database.ts` declares Dexie database `blind75-recall`, schema version 1 (native IndexedDB version 10). M1/M2 created no database, so there is no legacy data migration. Future versions must declare explicit, non-destructive migrations.

| Store | Key / indexes | Stored data |
| --- | --- | --- |
| cards | problemId; state, dueDay, dueAt | Complete M2 Card values, including archived cards |
| reviewLogs | Auto-increment id; problemId, ratedAt | Complete ReviewLog values, including early and cardBefore |
| settings | key | Singleton `{ key: 'scheduler', value: SchedulerSettings }` |
| metadata | key | Singleton membershipRevision, initially 0 |

Archived flags remain booleans in records; they are filtered in memory rather than used as IndexedDB keys. There are only 75 library problems. Initialization inserts defaults only if absent, validates existing settings, and never clears/recreates a populated store. Closed connections can be explicitly reopened without resetting cards, logs or settings.

`LibraryRepository` owns database operations and consistent snapshots. `LibraryController` manages subscriptions, optimism, errors and the latest membership-undo token independently of React. `Library` consumes that controller, renders presentation models, and requests confirmation before an active checkbox is unticked. Pure scheduler modules have no storage or React dependency.

## Membership transactions

For every membership action, one read/write transaction reads the latest settings and cards, computes all changes, writes cards and advances the revision. Its returned snapshot is read inside that transaction and delivered only after commit. Duplicate requested IDs are deduplicated; ticking an already-active card is a no-op. A failed write aborts the whole batch, including metadata. Concurrent connections serialize through these stores.

- **First tick:** create a new card immediately, with configured difficulty ease; interval/reps/lapses zero, step zero and addedAt equal to the captured action time. Compute today through the M2 timezone/rollover function. Add one day only for firstReview=tomorrow. The daily goal never limits additions.
- **Untick:** the UI asks “Remove from deck? History is kept.” Cancel or Escape makes no write. Confirmation changes only archived to true.
- **Re-tick:** change only archived to false. Preserve original due fields, interval, ease, step, repetitions, lapses, addedAt, notes and last-reviewed time. First-review settings apply only to genuinely new records.
- **History:** membership operations never delete or rewrite review logs and never create rating events. Existing logs survive archive, restore, undo, connection close and reload. The log table and read boundary exist now; atomic rating/log writes belong to M4.

Settings are persisted and validated even though M3 has no Settings screen. saveSettings rejects changes incompatible with any stored card; it performs no implicit step/cap migration. Settings and membership writes invalidate older membership undo by advancing the same revision.

## Instant updates, undo and cross-tab behavior

Ticking updates the checkbox, global progress and filtered rows optimistically before persistence completes. One in-flight membership action per controller prevents duplicate taps. A write error restores the most recent confirmed snapshot and offers Retry; data is never replaced with an editable empty deck after a read failure.

The latest successful membership action offers Undo, including category actions. The token holds complete before/after cards plus the committed revision. Undo verifies that revision and every post-action card, restores the previous records atomically, and advances the revision. Undo of a first tick archives the newly created card rather than deleting it. A re-tick can still restore it. Bulk undo touches only records changed by that bulk action, preserving previously active cards. Tokens are session-only, consumed once, and cleared on dismissal, later actions or cross-tab changes. This is Library membership undo, distinct from M4 rating undo.

Dexie liveQuery observes transactional snapshots and propagates Dexie writes across connections/tabs. React unsubscribes on unmount. Future rating writers must atomically save card+log and participate in the revision protocol; the full post-card guard also protects against a changed card. M3 has no automatic rating replay or persisted UI progress counter.

## Library presentation

The Library is the current root screen. Preserve all 75 bundled problems in their verified category/row order, with 18 collapsible categories. Global completion and the difficulty-split progress bar count only active cards. All/Completed/Remaining and single-choice difficulty filters intersect; archived cards appear under Remaining. Filters are session UI state and reset on reload.

Each row has a 44-pixel label target, LeetCode number/title, difficulty, Premium flag if relevant, and status derived from the state's authoritative due field. Status refreshes periodically and on resume/focus without rewriting schedules. Full-category Mark all explicitly labels its total and includes hidden filtered rows; it never restarts active cards. The Undo toast persists until dismissed or superseded so keyboard users are not timed out. The native removal dialog defaults to Cancel and explicitly restores focus to its triggering checkbox, including in WebKit.

The existing PWA precaches the local application bundle, including Dexie. No backend, network request, component library, routing package or state-store dependency is needed for M3. fake-indexeddb, jsdom and Testing Library are test-only dependencies. jsdom 30 requires Node 22.22.2+ in 22.x, 24.15+ in 24.x, or 26+; package.json and the contributor/run instructions now state that tooling floor. The verified runtime is Node 24.15.0. Physical iPhone installation, VoiceOver and the final performance pass remain M6 work.
