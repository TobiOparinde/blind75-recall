# IndexedDB persistence (M3)

`database.ts` declares the Dexie v1 schema for cards, reviewLogs, settings and membership revision metadata. `libraryRepository.ts` owns initialization, transactional membership/settings changes, snapshots, guarded membership undo and live-query subscriptions. Read `docs/persistence-contract.md` before extending it.

Membership archives/restores records without changing review history. Settings initialize only once; first-review timing is read within each mutation transaction. No database is cleared on startup, reload or error. Future schema changes require explicit migrations. React uses the independent controller in `src/library/`; pure scheduling remains in `src/scheduler/`.

M4 must implement atomic card+review-log writes, rating undo and shared revision updates using `src/domain/scheduler.ts` and `docs/scheduler-decisions.md`. M3 provides the persisted log store and read boundary but no rating flow. Library membership undo does not delete cards or log entries.
