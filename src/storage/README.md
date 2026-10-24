# IndexedDB persistence (M3)

`database.ts` declares the Dexie v1 schema for cards, reviewLogs, settings and membership revision metadata. `libraryRepository.ts` owns initialization, transactional membership/settings changes, snapshots, guarded membership undo and live-query subscriptions. Read `docs/persistence-contract.md` before extending it.

Membership archives/restores records without changing review history. Settings initialize only once; first-review timing is read within each mutation transaction. No database is cleared on startup, reload or error. Future schema changes require explicit migrations. React uses the independent controller in `src/library/`; pure scheduling remains in `src/scheduler/`.

`reviewRepository.ts` extends the shared snapshot/revision primitives for M4's atomic card+review-log writes and guarded latest-rating undo. Read `docs/review-contract.md` for captured proposals, conflict guards and recovery. No schema migration was needed. Library membership undo never deletes cards or logs; rating undo removes exactly its latest log and restores its full pre-rating card. Both invalidate older tokens through the shared revision.

`managementRepository.ts` adds validated settings saves, atomic backup replacement and reset with revision guards. Backup JSON validation/canonicalization and the action controller live in `src/management/`; Stats is pure in `src/stats/`. The optional backupReminderAt metadata key is device housekeeping, excluded from exported deck state and revision changes. See `docs/management-contract.md`.
