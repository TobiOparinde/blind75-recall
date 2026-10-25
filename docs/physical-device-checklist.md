# Remaining physical iPhone release checks

Not executed in the Windows/headless environment. Record device model, iOS/Safari version, URL, date, orientation, result and any issue for each check. Desktop WebKit and injected safe-area values do not substitute for these checks.

## Install and offline

1. After the owner publishes the GitHub Pages build, open its HTTPS URL in Safari. Verify the icon, app name, Share → Add to Home Screen → Add, and Settings' install instructions.
2. Launch from the Home Screen; verify standalone display, correct start URL, status bar and absence of browser chrome. Close/reopen normally and in airplane mode after caching.
3. Offline: tick/untick/re-tick, rate/undo, close/reopen mid-session, open Stats, edit Settings, export to Files, reset with both confirmations, and import the saved backup. Check exact restored dates/history and no duplicate ratings.
4. Close all windows after a new deployment, reopen, and verify the new cached version. Leaving a revealed review open must not trigger a forced reload.

## Screen geometry and input

1. On a notched/Dynamic Island phone, inspect all five screens in portrait and both landscape directions. Check all four edges, home indicator, dynamic browser toolbar, keyboard and action/navigation positions.
2. Reveal an answer, rotate repeatedly, then rate it. Preserve title, revealed links, exact previews, goal progress and attempt timing; four rating controls remain usable.
3. Test larger iOS text/Dynamic Type and Safari zoom, especially long Library titles, expanded rating guide, alerts, import counts, reset and removal confirmation. Inputs must not auto-zoom on focus.
4. Confirm touch comfort and lack of accidental adjacent taps; check primary actions in the lower thumb zone, category summaries, 44px checkbox targets and Settings gear.

## VoiceOver and keyboard

1. Traverse landmarks and headings; route navigation should place focus at the new screen heading. Stats must scroll with keyboard/assistive input. Skip to content must work.
2. Verify every checkbox announces title/state, every queue item announces number/title/status/difficulty, and each rating announces its name/interval. Difficulty/rating meaning must remain understandable without color.
3. Reveal links, expand the guide, move between ratings and undo. Confirm focus after reveal, new card, goal reached, close, undo and cross-tab invalidation. No focus trap outside a modal; Cancel/Escape closes removal and restores the trigger.
4. With iPad/desktop hardware keyboard, use Tab/Shift+Tab, Enter, Space and 1–4. Ordinary focused inputs, links and buttons must retain their expected behavior. Verify focus indicators and Reduce Motion.

## Physical performance

1. On a named mid-range iPhone, use a documented 4G/network condition and clear caches for a cold load. Measure navigation to a visible, enabled Today action; target <1.5s. Record at least five runs and the conditions, without replacing results with desktop/Lighthouse values.
2. Measure warm/offline launches and ten rating-to-next-card paints, including a populated history. Target rating interaction <100ms. Record observed median/p95 and traces if available.
3. If any check fails, keep release acceptance open, fix the defect, rerun relevant automated checks and repeat the device check. Do not mark the two manual-pending acceptance rows PASS until this evidence exists.
