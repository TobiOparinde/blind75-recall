# Approved scheduler contract (M2)

The full build brief remains authoritative. The user approved the scheduler analysis with two amendments: **implement the written section 7.9 early-review equations; do not freeze successful early schedules**, and **compare preview/application results using identical captured inputs; leave stale-screen UI handling to M4**. This document records the approved contract. M2 contains pure functions and types only, with no IndexedDB, product screens or undo effects.

## Public API and units

Import from `src/scheduler/index.ts`:

```ts
dayIndex(now, rolloverHour, timeZone): number
schedule(card, rating, now, settings, timeZone): ScheduleResult
intervalPreviews(card, now, settings, timeZone): IntervalPreviews
buildQueue(cards, problems, now, settings, timeZone, completedRatingsToday = 0): QueueResult
```

`now`, `dueAt`, `addedAt`, `lastReviewedAt`, step durations and learn-ahead use integer UTC epoch milliseconds. Day indices and intervals use integer civil days. Timezone is an explicit IANA name, not ambient machine state. Ratings 1/2/3/4 mean Again/Hard/Good/Easy. `schedule` returns `{ nextCard, early }` without changing inputs. `intervalPreviews` calls that same function four times with exactly the same captured inputs, returning the complete result for each rating. Applying a selected result gives deep equality with its preview; M2 performs no clock reads, refresh, expiry or acceptance workflow.

## Defaults and validation

`DEFAULT_SETTINGS` is one frozen configuration object containing every section 7.2 default, the ease adjustments, ten-minute learn-ahead and the specified daily-goal/rollover/first-review defaults. Step arrays and starting-ease values are also frozen. `SchedulerSettings` combines the user-facing settings with scheduler policy constants; future storage can persist the same shape or deliberately version it.

Validation requires goal 1–20, integer rollover 0–23, nonempty positive integer millisecond step arrays, positive integer intervals fitting the maximum, minimum ease at least 1.3, starting ease at least that minimum, valid finite multipliers and nonnegative ease adjustments. Lapse multiplier must not exceed 1. Fuzz fraction is 0–1; radius floor is a nonnegative integer (zero plus fraction zero disables fuzz for formula fixtures). Unsupported states, inconsistent active timing fields, out-of-range step indices, invalid timestamps/counters and unsafe arithmetic throw explicit errors instead of returning NaN or repairing data silently.

Future settings updates must validate against stored cards. Reject lowering the cap below an existing interval until an explicit migration is agreed. Shorter step lists require an explicit transaction normalizing affected indices to the last remaining step while preserving pending `dueAt`; this is not hidden in `schedule` and is not implemented in M2.

## State and field invariants

| State | Active due field | intervalDays | stepIndex |
| --- | --- | --- | --- |
| New | dueDay | 0 | 0 |
| Learning | dueAt | 0 | Valid learning-step index |
| Review | dueDay; no dueAt | Positive, at most maximum | 0 |
| Relearning | dueAt | Positive retained return interval | Valid relearning-step index |

During steps, the required but inactive `dueDay` retains its prior value and never controls eligibility. Every accepted rating increments `reps` once and sets `lastReviewedAt` to captured `now`. Only Again **from review** increments `lapses`. Only new cards have zero repetitions and no last-reviewed timestamp. Notes, identity, added time and archive status survive transitions. Archived cards cannot be rated or queued. Leech threshold is metadata for later UI; it does not automatically suspend cards.

M3 should initialize new cards with the configured difficulty-based starting ease, zero interval/repetitions/lapses, step zero, and today's/tomorrow's due day. Difficulty affects starting ease and review queue ties, not interval formulas after initialization.

## New/learning/relearning

| Input state | Again | Hard | Good | Easy |
| --- | --- | --- | --- | --- |
| New/learning | Enter/restart learning at step 0; wait first delay | Enter learning/repeat current step and delay | Advance a step, or graduate from last to graduatingIntervalDays | Graduate immediately to easyIntervalDays |
| Relearning | Restart step 0 and first delay | Repeat current step and delay | Advance a step, or return to review from last | Same as Good |

Graduation removes `dueAt`, resets step zero, and sets `dueDay = today + intervalDays`. Relearning keeps the interval established by the original lapse; it is not multiplied or fuzzed again on exit. Step ratings do not change ease or add lapses. With one default learning step, a brand-new Good immediately graduates to two days; no mandatory first wait is inserted.

## Due and late review calculations

Use the brief's section 7.3 formulas and **pre-rating ease**. Again reduces the old interval by the lapse multiplier, rounds with minimum one day, applies fuzz/cap once, decreases ease (bounded by minimum), adds one lapse and enters relearning step zero with the first configured delay. Hard/Good/Easy use their exact multipliers and lateness fractions; their candidate lower bound is base interval plus one. Ease then changes by -0.15/0/+0.15 by default. Missing days never reset progress.

For successful review candidates, let `B` be the calculation base and `M` the maximum. Compute all three candidates together even when only one rating was requested. Round, fuzz, and normalize as follows:

- `L = min(B + 1, M)`.
- Hard is clamped to `[L, max(L, M - 2)]`.
- Good's lower bound is `min(M, Hard + 1)` and its upper bound is the greater of that lower bound and `M - 1`.
- Easy is clamped to `[min(M, Good + 1), M]`.

This reserves room for strict `Hard < Good < Easy` whenever compatible with the growth floor. At cap 180, previous due intervals 177/178/179/180 yield respectively 178–179–180 / 179–180–180 / 180–180–180 / 180–180–180. Ties at saturation are the approved exception; the cap is never exceeded. Normalization may override the initial fuzz range. Again is a lapse, not part of this successful-rating ordering.

## Early review: user amendment takes precedence

For a **review-state** card with `today < oldDueDay`, use `B = max(1, today - dayIndex(lastReviewedAt, rolloverHour, timeZone))`, with **no late bonus**. Apply the successful rating formula, fuzz and candidate normalization using that base to obtain `calc`. Then independently set:

```text
dueDay = max(oldDueDay, today + calc)
intervalDays = max(oldIntervalDays, calc)
```

Do not use the resulting stored interval in the due-day equation. Again instead uses the ordinary lapse path based on the old stored interval. All ease changes and repetition/log behavior remain intact.

Successful early results can preserve both fields or extend either; there is no blanket freeze. Existing-schedule max guards can collapse final successful outcomes even below the cap; strict candidate ordering does not override these explicit equations. The no-shortening invariant holds, while avoiding repeated multiplication of the previous stored interval. Repeated Easy may still change ease and future results, as required. The brief's unchanged-date early-Good fixture must have a sufficiently distant original due date. Ten early Goods must never move a date earlier.

New cards selected before their first due day use the new state machine. Learning/relearning selected before `dueAt` use their own step transitions; inactive dueDay never activates review-state elapsed-day equations. `early` is based on the input state's active due field, including manual step overrides.

## Exact deterministic fuzz

For a rounded candidate `I < fuzzThresholdDays` (default 3), do nothing. Otherwise use radius `R = max(fuzzMinDays, round(I * fuzzFraction))`, default minimum 1 and fraction 0.05. Select an integer offset across the discrete range `[-R, R]`, including zero.

Hash UTF-8 bytes with unsigned 32-bit FNV-1a (initial 2166136261, multiply 16777619 modulo 2^32 after each byte XOR). Key: `fuzz:v1|<problemId>|<pre-rating reps>`. Divide the unsigned hash by 2^32 to get `u`, then offset is `floor(u * (2R + 1)) - R`. Reuse that seed/sample for all candidate ratings; do not seed by rating, clock or array order. Undo restoring reps reproduces the same fuzz for the same captured inputs.

Fuzz applies when the **input state is review**, including Again's retained lapse interval if at least the threshold. Explicit learning graduation and relearning exit intervals are not fuzzed. A one-day radius can exceed 5% for small intervals; the parenthetical minimum takes precedence. Cap, growth and ordering normalization happen afterward.

## Calendar, DST and clock changes

Encode local civil dates as ordinal days; do not divide elapsed UTC durations to obtain local days. For each civil date, resolve the configured local rollover boundary: choose the first occurrence if repeated and the first valid instant after a gap if missing. Compare absolute `now` with that boundary to select today's or the previous civil-day ordinal. This avoids rolling backward when a two-hour fallback crosses the configured rollover again.

Calendar resolution uses Intl's explicit timezone and bounded memoization keyed solely by inputs. There is no new dependency. Advancing review dueDay uses civil-day integers; adding a ten-minute step adds exactly 600000 milliseconds even over DST. Timezone or clock changes never rewrite stored fields; rebuild the queue using the newly captured context. Negative elapsed review days are clamped to the required minimum one.

## Queue, progress and learn-ahead

Filter archived cards and build an uncapped ready queue:

1. Learning/relearning with `dueAt <= now`, together sorted by dueAt then code-point problem ID.
2. Review with `dueDay <= today`, sorted by dueDay, then difficulty Hard/Medium/Easy, then stable unsigned hash rank, then problem ID on collisions.
3. New with `dueDay <= today`, sorted by addedAt then problem ID.

Review tie key: `queue:v1|<today>|<problemId>`, hashed by the same FNV-1a algorithm. It is stable within a day, independent of input order/reps, and may change next day. Adding/removing a tied card does not reshuffle the others.

`completedRatingsToday` is an explicit count of committed rating events, including repeats/learning/early ratings and excluding undone entries. Remaining picks are `max(0, dailyGoal - completedRatingsToday)`; Up next contains everything else. No hard daily limit or new-card cap is introduced. Future milestones derive counts from logs in the current calendar context; changing timezone/rollover can redistribute historical daily attribution unless a future approved ratedDay field is introduced.

When ready is empty, return separate `learnAheadCandidates` with `now < dueAt <= now + learnAheadMs`. Also return the earliest future step's timestamp as `nextLearningDueAt` (or null); future new/review dates are not learning countdowns. Nothing is automatically promoted. The caller can show the 7:42 countdown and explicitly select Show now. Any active card can be manually rated regardless of due time; farther-future selections are explicit overrides. Queue construction never rates or logs a card.

## Logs and one-level undo boundary

`ReviewLog` retains all brief summary fields and adds required `early` and complete immutable `cardBefore` snapshot. `UndoToken` carries the latest log ID and expected post-rating card. Future storage uses monotonic committed log IDs and atomically writes card+log; undo atomically restores the snapshot and deletes that one log, the sole append-only exception. Consume one session token without exposing an older undo; invalidate it on later ratings/conflicting mutations. Guard the expected post-rating version to avoid undo overwriting another tab's work. No log persistence, transaction, migration or undo handler is implemented in M2.

## Verification obligations

M2 tests cover every default and multi-step transition, exact no-fuzz ordinary/late/early formulas, pre-rating ease, floor/cap ordering, all required early fixtures, seed vectors and ranges, full preview equality/immutability, state-field validation, queue ordering/ties/boundaries, opt-in countdown behavior, 03:59/04:01 rollover, DST gaps/overlaps including half-hour and two-hour changes, travel/clock changes, and two seeded 365-day scenarios over all 75 problems. Each simulation is repeated for complete reproducibility. M1 seed and browser tests remain required.
