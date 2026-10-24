# Pure scheduler (M2)

Import the public API from `index.ts`: `schedule`, `intervalPreviews`, `buildQueue`, `dayIndex`, `DEFAULT_SETTINGS`, validation functions and domain types. Time is integer UTC epoch milliseconds; timezone is an explicit IANA name. Step durations are milliseconds and intervals are calendar days.

Read `docs/scheduler-decisions.md` for the approved algorithms and the user's two amendments. Early reviews use the written section 7.9 equations; previews use the same immutable inputs and captured time as an applied rating. No stale-preview UI mechanism is implemented.

Keep this directory independent of React, storage, ambient clocks and unseeded randomness. Calendar memoization uses only explicit inputs and bounded caches. Tests are colocated; `simulation.test.ts` runs two seeded 365-day scenarios over all 75 problems, each twice to verify reproducibility. M3 persistence and M4 review/undo effects are outside this module.
