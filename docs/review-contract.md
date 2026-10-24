# Today and review contract (M4)

M4 adds Today, review sessions and rating undo to the approved M2 scheduler and M3 persistence boundary. Stats/full Settings, backup/import and deployment remain later milestones. No dependency or database schema version change is needed.

## Navigation and presentation

The default route is Today (`#today`); Library is `#library`. Two working navigation tabs replace M3's single Library entry. The M1 shell/seed/PWA checks are retained; M3 browser setup now opens its explicit Library route, with the original assertions preserved. During review the normal navigation is replaced by the close/progress/undo bar. Closing returns to the previously selected tab (normal queue starts are on Today).

Today derives its state from one transactional snapshot and the captured calendar context. `todayModel` calls the existing M2 queue builder, never implements another queue order. Due totals count only ready items; Learning includes relearning. The goal ring clamps its visual fill at 100% while the numeric event count keeps increasing. Picks are the queue builder's outstanding goal picks, followed by More due. Separate Review early rows expose all other active deck cards, including future new/review and waiting steps. Archived cards never appear.

Every committed rating event counts, including early, repeated and learning ratings. No stored progress counter or queue position is updated independently. Streak counts distinct consecutive review days ending today, or yesterday before today's first rating, using the current rollover/timezone context. Future calendar days do not extend it. Caught-up text includes tomorrow's active scheduled count; an empty deck links directly to Library.

Reaching the goal from below closes the current automatic session and shows Goal hit. Keep going starts a continuation session that serves additional ready cards without a cap. Manual rows start the chosen card out of order through the same controller and scheduler. Waiting learning never auto-promotes before due: the countdown and Show now are explicit. Once actually due, a waiting session automatically resumes the highest-priority ready card using M2's queue. Show now can override the nearest waiting step even outside the ordinary ten-minute learn-ahead window, as approved for manual selection.

## Session and preview identity

`ReviewController` is independent of React and owns the selected card snapshot, attempt identity, revealed answer, captured settings, four complete previews and monotonic attempt start. Clock, timezone and monotonic time are injectable. Rotation/rerenders change layout without recreating the attempt or recomputing previews. The UI hides category on the front, exposes external LeetCode, then reveals NeetCode/LeetCode links and the four rating controls. Rating guide text follows section 7.1. No notes/complexity/solution text is introduced.

Show answer calls `intervalPreviews` once with the immutable card, settings, captured now and timezone. Labels describe the returned due timestamp or due-day difference. The selected result is passed unchanged to storage. M2 remains pure and unchanged.

M4 alone handles long-open UI context: ordinary clock ticks and orientation changes retain previews exactly. If the review day or timezone changes, or a preview's learning/relearning deadline has already passed, keep the answer/current card visible but disable ratings until the user chooses Refresh intervals. This explicitly captures a new batch without accepting a different result behind the user's back. The rating controller checks the same condition at the action boundary, including if a tick has not rendered yet. Refresh is also available voluntarily. No database write occurs until a rating is accepted.

Space reveals an answer and 1–4 rate it. Modified/repeated keys, text input, links, buttons, summaries, contenteditable elements and dialog controls retain ordinary behavior. Each new attempt focuses its session container. durationMs measures monotonic elapsed attempt time across rerenders/rotation; no optional stopwatch UI is implemented.

## Transactional acceptance

`ReviewRepository` extends the M3 repository, reusing protected snapshot/revision primitives. M3's public snapshot shape remains unchanged; `reviewSnapshot` additionally reads logs inside the same transaction. Both repositories share the same database and revision protocol. Dexie live queries notify both Today and Library across tabs.

`acceptRating` receives the expected revision, complete pre-rating card/settings, rating, captured now/timezone, complete displayed proposal and duration. In one read/write transaction over cards/reviewLogs/settings/metadata it:

1. Checks revision, active card identity/full value and settings against the expected snapshot.
2. Calls M2 schedule with the same captured inputs and verifies deep equality with the displayed proposal.
3. Persists a clone of that exact proposal's card.
4. Appends an auto-numbered log containing all required summary fields, early, durationMs and the complete pre-rating card.
5. Advances the shared revision and returns a consistent snapshot plus a one-level undo token only after commit.

A failure at any write rolls back the entire transaction. A repeated/stale command cannot add another log because its expected revision/card no longer match. There is no persisted pending-command replay or outbox. Reload drops an uncommitted session and rebuilds from confirmed cards/logs. An interrupted transaction either commits in full or leaves the previous state. Re-reading after an uncertain acknowledgement discovers committed progress instead of resubmitting automatically.

The controller immediately displays the next card/progress optimistically and blocks further acceptance until commit. A temporary in-memory log contributes to that optimistic view but is never stored. On failure it re-reads confirmed data, rolls back optimism and preserves the old revealed attempt only if its card/settings still match. A changed/archived selected card or changed settings cancels that attempt; unrelated live changes preserve it. No stale write overwrites another tab's work.

## One-level rating undo

The token contains the latest log ID, expected full post-rating card and committed shared revision. Undo verifies all three, the latest committed log, and matching snapshot identities. It atomically restores log.cardBefore, deletes exactly that log and advances the revision. It does not delete a card, alter other history or expose the next-oldest event.

Optimistic undo removes that event and restores its card, progress and queue. The undone card reopens on its front for deliberate re-attempt. A successful undo consumes the token; later membership/settings/rating changes invalidate it. A failed transaction can retain only that same token for an explicit retry if the confirmed revision/log/post-card still match. Tokens are session-only and do not reappear after reload. M3 membership undo and M4 rating undo invalidate each other through the shared revision without sharing deletion semantics.

## Layout and verification

Portrait uses the bottom navigation and an accessible primary action. Short landscape uses a left rail, Today count/action side by side, and review problem/answer columns. Four ratings stay in one row in both orientations; each target is at least 44 pixels. Existing safe-area/dynamic viewport tokens remain active. The exact red/neutral/green/blue rating colors are retained on hover. Difficulty colors and links use existing tokens.

M4 verification covers every rating's persisted preview identity, goal-1 continuation, manual/early selection, waiting and Show now, reload before/after reveal, interrupted acceptance, atomic rollback, duplicate delivery, undo and stale undo, cross-tab invalidation, offline acceptance, keyboard handling, and the full portrait/landscape matrix with revealed state preserved. Physical iPhone/VoiceOver and final performance targets remain M6 work.
