# Persistence boundary (M3)

Add Dexie-backed cards, review logs, and settings here during M3. Keep schema migrations and transactions separate from UI and pure scheduler logic. No database is created in M1/M2. `src/domain/scheduler.ts` defines immutable card/log types and the complete pre-rating snapshot required for M4 undo. Follow `docs/scheduler-decisions.md` for atomic rating/log writes, the undo deletion exception, conflict guards and configuration migration policies. These effects are not implemented in M2.
