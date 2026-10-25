# M6 verification and release handoff

Validated on 25 October 2026 (Europe/London). M6 software work and automated acceptance are complete. Physical iPhone checks and owner-run publication remain open; this document does not claim they were executed.

## Final automated checks

| Check | Actual result |
| --- | --- |
| `npm run check` | Exit 0; ESLint, unit/component tests, strict TypeScript, production/PWA build and Chromium/WebKit suite |
| Vitest | 21 files, 498 passed: all 496 M1–M5 tests plus 2 M6 calendar-cache tests |
| Playwright | 188 passed: 94 Chromium + 94 WebKit; 150 prior cases plus 38 M6 cases |
| axe WCAG scans | No violations under WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags in Today/Library/Stats/Settings, removal/reset confirmations, review front/back and expanded guide |
| Strict TypeScript and ESLint | Passed; zero lint warnings/errors |
| Root JavaScript budget | 103,433 gzip bytes including every emitted JS file and worker/Workbox; limit <150,000 |
| Pages subpath JavaScript budget | 103,451 gzip bytes; same limit |
| `npm run check:deploy` | Passed in Chromium 156.0.8078.4 and WebKit 27.2; `/blind75-recall/` assets, icons, manifest, worker scope, persisted deck and offline routes |
| Chromium installability | CDP `Page.getInstallabilityErrors`: empty array on the subpath production build |
| Git whitespace | `git diff --check` passed |

The final M1–M6 check run took 4.7 minutes for its 188 browser cases. The benchmark uses real clocks and a rollover-safe Start review/Keep going selector. Test assertions for scheduling, transaction consistency, archive/history, import/reset and preview identity were retained. The review component opens its native Review early details before checking the row; queue-name expectations now assert the full visible number/title/status/difficulty.

## Responsive and accessibility evidence

All five screens are checked at 375×667, 390×844, 430×932, 667×375, 844×390, 932×430 and 820×1180, plus 320×568 and 1024×768. Tests cover internal scrolling instead of body scrolling, no horizontal clipping, centered ≤720px content, bottom tabs/landscape rail, Today side-by-side action/count, review columns, four 44px rating targets and usable expanded guide. The original M4 primary-action thumb-zone and rotation assertions remain active.

The sweep additionally checks every integer width 320–1024, 200% text reflow, input font ≥16px, visible focus, reduced motion, effective 44×44px control targets, and rotation with simulated top/right/bottom/left insets. All four production CSS variables default to their corresponding safe-area env() values. Real hardware safe areas remain unverified. WebKit review screenshots at 390×844 and 667×375, and narrow Settings at 320×568, were visually inspected.

Measured defects fixed: queue labels omitted visible metadata; rating label spans lacked explicit whitespace; Stats' scroll region was not keyboard-focusable; route changes left focus on the old navigation control; revealing an answer could remove the focused button without establishing useful focus. Queue accessible names now include visible text, route headings receive focus, main is focusable, reveal returns focus to the review region, and Skip to content is available. Input borders now meet 3:1 non-text contrast while preserving the original theme colors. Rating/difficulty text remains explicit, independent of color. The final 200%-text cross-check also exposed a long-title review collapsing the answer track: content-sized grid minima and internal review-column scrolling now preserve the Show answer target and all rating controls. At enlarged text sizes, vertical scrolling to the rating row is expected and tested; horizontal overflow is not allowed.

## Lighthouse measurements

Final command: `npm run audit`. Windows (`win32 10.0.26300`, x64), AMD Ryzen 7 6800H, Node 24.15.0, Lighthouse 13.5.0, installed headless Chrome 155.0.0.0. Local Vite production preview, default simulated mobile profile: 412×823, DPR 1.75, 4× CPU slowdown, 150ms RTT/1638.4 Kbps configured throughput. Raw reports are reproducible in ignored `.local/lighthouse/`; committed metrics/configuration are in [lighthouse-summary.json](lighthouse-summary.json).

| Route | Performance | Accessibility | Simulated LCP |
| --- | --- | --- | --- |
| Today | 99 | 100 | 1682ms |
| Library | 99 | 100 | 1660ms |
| Stats | 99 | 100 | 1681ms |
| Settings | 99 | 100 | 1662ms |

Every scored screen exceeds 90/90. These are lab results, not an iPhone/4G test. In particular, simulated LCP is **above 1.5s**; it is not a cold-interactive measurement and does not establish the separate physical-device target. No performance result has been relabeled to close that requirement.

Lighthouse 12 removed the PWA category; Lighthouse 13.5 does not provide a PWA score. Manifest/icon/worker/offline checks and Chromium installability diagnostics are recorded separately in [deploy-verification.json](deploy-verification.json). See the [official removal notice](https://developers.google.com/speed/docs/insights/release_notes#may_10_2024).

## Interaction profiling

The production benchmark creates a 75-card deck and 5,000 history events by calling the unchanged scheduler. It measures navigation-to-ready paint and ten click-capture → next-card DOM/two-animation-frame samples with **real clocks**, without network/CPU throttling or tracing. Full-run measurements/environment are committed in [performance-results.json](performance-results.json).

| Browser | Cold ready | Warm ready | Offline ready | Rating median / p95 paint |
| --- | --- | --- | --- | --- |
| Chromium | 107ms | 32ms | 26ms | 29 / 31ms |
| WebKit | 415ms | 260ms | 267ms | 24 / 34ms |

These localhost desktop values cannot predict physical iPhone results. Both pass the <100ms lab rating gate. Initial Chromium heavy-history profiling showed roughly 50ms DOM work and 78ms median/92ms p95 paint. Repeated Intl day attribution was the avoidable work: the new 8,192-entry cache keys immutable timestamps plus exact timezone/rollover context, is bounded, and is tested across context changes/DST. No calculated stats are persisted. Settings is memoized to skip unrelated one-second review ticks. M2 scheduling remains unchanged.

## Deployment and unresolved device acceptance

The owner said they will deploy to their GitHub after completion. A manual-only GitHub Pages workflow and exact README instructions are prepared; no repository remote, hosted build, Actions execution or public deployment is claimed. BASE_PATH coordinates Vite assets, manifest id/start/scope/icons, worker registration and fallback for either a project subpath or root site. Local subpath/offline/installability checks pass in both engines.

The [section-12 audit](acceptance-audit.md) records nine PASS criteria and two PASS WITH MANUAL DEVICE CHECK REMAINING criteria, with evidence per row. No known automated criterion fails. [physical-device-checklist.md](physical-device-checklist.md) retains iPhone Safari installation/standalone, actual notch/home-indicator/Dynamic Type, VoiceOver and real 4G/interaction timing. Clean axe scans and a Lighthouse score of 100 are not a certification of full WCAG conformance. Do not close these manual checks without device evidence.

Only test tooling dependencies (Lighthouse and axe) were added. Runtime dependencies, seed, scheduler rules, IndexedDB schema and existing data contracts are unchanged. GitHub publication and physical-device sign-off are the remaining release steps, not additional implemented features.
