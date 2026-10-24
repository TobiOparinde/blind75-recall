# M1 verification

Validated on 24 October 2026 using Node 24.15.0 and npm 11.12.1 on Windows.

## Scope delivered

- React 18.3.1, Vite 8.3.5 and TypeScript strict scaffold, with pinned packages and lockfile.
- Standalone PWA manifest (`orientation: any`), normal/maskable icons, Apple touch icon, app-shell precaching and waiting-worker updates.
- Exact brief palette, 4 px spacing tokens, 8 px radius, system fonts, reduced-motion token, focus styling, dynamic viewport and all four safe-area insets.
- Separate data, domain, UI, scheduler and persistence directories. The last two contain boundary documentation only.
- Versioned 75-problem JSON, loaded by the shell, validated on startup and in tests. Live-list differences are documented in `seed-notes.md`.
- M1–M6 plan, unresolved requirement analysis, contributor guide and run/test/deploy/install instructions.

All M1 requirements in section 13 are satisfied. No scheduling functions, database, Library, Today, Review, Stats or Settings screens have been implemented.

## Final checks

`npm run check` completed with exit code 0:

| Check | Result |
| --- | --- |
| ESLint | Passed, zero warnings/errors |
| Vitest | 43 passed: schema, malformed/missing fields, membership/order, counts, optional fields, extensibility |
| TypeScript | Passed: strict, unused checks, indexed-access and optional-property checks |
| Vite/PWA build | Passed; manifest and Workbox worker emitted |
| Gzip budget | 56,000 bytes across **all** emitted JS, including service worker and Workbox; limit <150,000 bytes |
| Playwright | 24 passed: 12 Chromium + 12 WebKit |

Browser checks covered 375x667, 390x844, 430x932, 667x375, 844x390, 932x430, 820x1180, plus 320x568 and 1024x768. Each verified visible loaded seed, no horizontal overflow/clipping, internal scrolling and no console/page errors. Additional checks covered rotation/reduced motion, offline reload after worker activation, manifest properties, icon dimensions and iOS metadata. Portrait 390x844 and landscape 844x390 WebKit screenshots and the maskable icon were visually inspected. Screenshots are regenerated in ignored `test-results/`.

The first browser run exposed an overly literal assertion: minification changed `0ms` to equivalent `0s`. The assertion now accepts both zero-duration representations; application behavior was correct. A sandboxed preview attempt could not complete its local-server readiness check; final browser validation ran with approved local process/network access after that attempt exited.

## Remaining acceptance work

This validates the M1 shell, not the completed MVP. Real iPhone Add to Home Screen/standalone behavior, safe areas, VoiceOver, interactive-screen contrast, full-width sweep, Lighthouse 90+/90+, 4G load time and rating latency still require M6 checks. Scheduling, state, undo and backups require their own milestone tests. No deployment has been performed.

Before M2, resolve interval cap/order/growth conflicts, early-review guarantees and relearning gaps in `implementation-plan.md`; then add centralized defaults and pure scheduler/queue logic with the specified tests.
