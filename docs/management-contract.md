# Stats, settings and backup contract (M5)

M5 adds `#stats` to the bottom tabs and `#settings` through the Today gear. M1–M4 scheduling, membership and review behavior is retained. No dependency, indexed store or schema migration is added; the existing metadata store accepts an optional device housekeeping key.

## Derived statistics

`src/stats/model.ts` is pure and receives the complete persisted snapshot, captured time and explicit timezone. Due today uses M2's ready queue, including overdue work and excluding waiting steps. Streak follows M4's distinct-day rule. Retention includes all committed rating events (including learning, early and archived history) in logical days today − 29 through today; Good/Easy are successes. No ratings means “No reviews yet”, rather than a misleading zero percent.

The forecast covers today and six following logical days. Each active card contributes once using its authoritative due field; overdue deadlines are placed in today's bar. Waiting steps later today appear in today's forecast but are not yet “due today”. This is a snapshot of stored deadlines, not a simulation of future answers. CSS bars have textual counts and require no chart library.

Active cards are New, Learning (including relearning), Young (review interval <21 days), or Mature (review interval ≥21 days). Category lapse rate is all-history Again-from-Review events divided by all review-state ratings; step failures are not lapses. Categories with no denominator are omitted. Archived history remains included. Leeches are active cards at the configured lapse threshold, sorted by lapses; they are not suspended.

## Settings and concurrency

UI step units are minutes, converted to integer milliseconds through M2 validation. All exposed settings use the existing typed configuration; advanced values survive edits. A save validates every stored card, including archived cards, before a transaction writes settings and advances the shared revision. No deadlines, ease, intervals or step indices are rewritten. Existing first-review deadlines are retained; firstReview affects genuinely new ticks only. Changed rollover/timezone reattributes history using the existing M2/M4 rule.

M3's conservative compatibility rule remains binding: reject caps below existing intervals and shorter step lists that exclude existing indices. The optional step-normalization migration mentioned in the original scheduler analysis is not performed silently. The UI explains the rejection. Ordinary rerenders/rotation retain unsaved form values; a committed configuration change replaces the draft with the current settings.

Settings saves, imports and reset require the revision captured by their UI action/preview. All cards, logs, settings and revision participate in one transaction. A conflicting write requires a fresh action/preview; a stale confirmation cannot erase another tab's work. Live queries refresh every screen and invalidate prior membership/rating undo tokens.

## Portable JSON format

The envelope is `{ format: 'blind75-recall', schemaVersion: 1, settings, cards, reviewLogs }`. It includes all cards (archived too), exact log IDs and complete pre-rating snapshots, plus all scheduler settings. Keys are sorted recursively, cards by problem ID and logs by ID. Identical persisted deck/history/settings produce byte-identical JSON. Times remain UTC integers; no timezone conversion or scheduler replay occurs.

The local concurrency revision, IndexedDB auto-increment housekeeping, session/undo state, UI filters and backup-reminder timestamp are intentionally excluded: they do not reproduce the deck or schedule. Import preserves explicit log IDs; later generated IDs remain greater than the stored maximum. Reset does not need to rewind IndexedDB's internal key generator.

Validation rejects malformed JSON, missing/unknown fields, incompatible format/version, invalid settings/cards, unknown problems, duplicate cards/log IDs, orphan logs, invalid timestamps/ratings/counters/durations, and summaries inconsistent with their pre-rating snapshots. Historical snapshots may predate different caps and step lists: validate their intrinsic invariants independently of today's configuration bounds. Current cards must satisfy the imported configuration. Historical settings/timezones are not stored, so import does not invent them or attempt to reconstruct/replay old ratings.

File selection only validates and previews total/active cards, log count and settings count. Explicit Confirm overwrite is required. The repository clones and revalidates the proposal before atomically replacing cards, logs and settings and advancing the local revision. Any failure rolls back the entire replacement. Export/import into a clean browser restores cards, schedules, settings, archived history and log IDs exactly.

## Reset, backup reminder and offline use

Reset requires two separate confirmations after its initial action, with cancellation at either stage. The final transaction clears cards/logs, restores defaults, removes backup housekeeping and advances the revision. It retains seed assets, worker/cache and the bundled 75-problem Library. The result is an empty deck; stale undo cannot restore deleted user data.

The optional `metadata.backupReminderAt` stores a device-local reminder deadline: 30 elapsed days after first M5 use or a requested export. Today gently links to Settings when due; checks run on load, focus and every minute without interrupting review. Reminder writes do not advance the deck revision, invalidate undo, or enter exports. Failure to write reminder housekeeping never blocks exporting the deck. An export request cannot establish whether the user ultimately retained the downloaded file; the help text explicitly asks them to keep it outside the app.

Stats, Settings, file validation/download, replacement and reset use local code/storage and work offline once the PWA is cached. Safari Share → Add to Home Screen help is included. M6's physical-device, final accessibility/performance and deployment work is not started.
