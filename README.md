# Blind 75 Recall

> An iPhone-first spaced-repetition app for keeping LeetCode patterns fresh — built around the Blind 75, with offline reviews, progress tracking and a simple Anki-style scheduler.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?style=flat-square)
![IndexedDB](https://img.shields.io/badge/IndexedDB-Dexie-3B82F6?style=flat-square)
![Playwright](https://img.shields.io/badge/Tested_with-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)

**Deployment:** GitHub Pages workflow ready; public site not published yet.

---

## Overview

Solving a LeetCode problem once is one thing. Remembering the pattern a few weeks later is another.

I built **Blind 75 Recall** to make that second part easier. Instead of repeatedly going through the entire Blind 75, I can tick the problems I've solved, turn them into review cards and practise them again when they're due. The app uses spaced repetition to adjust the next review based on how easily I remembered the solution.

It's designed primarily for an iPhone, but works in a browser on desktop too. There's no account or backend: progress is saved locally on each device, and JSON backups let me export or restore it.

---

## Features

- **Blind 75 Library** — all 75 problems grouped by NeetCode category, with completion tracking, difficulty filters and progress.
- **Spaced-repetition scheduler** — rate each attempt **Again, Hard, Good or Easy** to decide when it comes back. Includes learning steps, relearning, overdue reviews and early practice.
- **Today dashboard** — see what's due, work towards a daily goal and keep going after hitting it.
- **Review sessions** — attempt a problem before revealing links to LeetCode and NeetCode. Next-review intervals appear on the rating buttons.
- **Undo and recovery** — undo the last rating, keep review history and pick back up after closing or reloading the app.
- **Stats** — streak, retention, 7-day forecast, card maturity and areas that need more practice.
- **Adjustable settings** — daily goal, review steps, day rollover and scheduling intervals.
- **Offline PWA** — installable to an iPhone Home Screen and usable offline after the first successful load.
- **JSON backups** — export and import your data, with validation before anything is overwritten.

---

## How It Works

1. **Tick completed problems** in the Library. Only ticked problems enter your review deck.
2. **Open Today** to see what is due. The daily goal is a target, not a limit.
3. **Try to recall the approach** before pressing **Show answer** and checking LeetCode or NeetCode.
4. **Rate your attempt** using Again, Hard, Good or Easy. The scheduler updates the next review date.
5. **Repeat over time.** Problems you struggle with return sooner; familiar ones are spaced further apart.

Unticking a problem archives it rather than deleting its history, so re-ticking it restores its previous progress.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 18 | Component-based UI |
| TypeScript | Strict typing across application and scheduler logic |
| Vite | Development server and production builds |
| CSS | Dark, LeetCode-inspired styling and responsive layouts |
| IndexedDB + Dexie | On-device storage for cards, settings and review history |
| vite-plugin-pwa / Workbox | Installation, service worker and offline caching |
| Vitest + React Testing Library | Scheduler, storage and UI tests |
| Playwright | Chromium and WebKit browser, viewport and offline testing |
| GitHub Actions + Pages | Prepared static-site deployment workflow |

---

## Getting Started

**Prerequisites:** Node.js 24.15+ in the 24.x line and npm. The project also supports Node 22.22.2+ in the 22.x line, or Node 26+.

```bash
# 1. Clone the repository
git clone https://github.com/TobiOparinde/blind75-recall.git
cd blind75-recall

# 2. Install dependencies
npm ci

# 3. Start the development server
npm run dev
```

Open the local URL shown by Vite. For production/offline behaviour, use `npm run build` followed by `npm run preview` instead; the development server deliberately doesn't register the service worker.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server |
| `npm run build` | Type-check, build the PWA and enforce the JavaScript budget |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit and component tests |
| `npm run test:e2e` | Run Chromium and WebKit tests against a built app |
| `npm run check` | Run the complete lint/test/build/browser check suite |
| `npm run audit` | Run mobile Lighthouse checks on the four app routes |
| `npm run check:deploy` | Test the GitHub Pages subpath, assets and offline behaviour |

For local browser testing, first run `npx playwright install chromium webkit`.

---

## Project Structure

```text
blind75-recall/
├── src/
│   ├── data/          # Blind 75 seed and validation
│   ├── domain/        # Shared types
│   ├── scheduler/     # Scheduling, day rollover, previews and queues
│   ├── storage/       # Dexie database and transactions
│   ├── library/       # Completion tracking and filters
│   ├── review/        # Today dashboard and review sessions
│   ├── stats/         # Streaks, retention, forecast and maturity
│   ├── management/    # Settings, backups and reset
│   └── ui/            # React screens and styling
├── tests/e2e/         # Browser and offline tests
├── public/            # PWA icons and assets
├── docs/              # Build brief, contracts and verification
├── scripts/           # Bundle budget checks
└── .github/workflows/ # GitHub Pages deployment
```

---

## Testing

I wanted the scheduling to be predictable, particularly around early reviews, missed days, daylight-saving changes and undo. The scheduler is kept separate from the React UI so its behaviour can be tested directly.

**Latest local verification:**

| Check | Result |
|---|---|
| Unit and component tests | **507 passed** |
| Browser tests | **196 passed** (Chromium + WebKit) |
| Lighthouse Performance | **99** |
| Lighthouse Accessibility | **100** |
| JavaScript bundle | **103,728 bytes gzipped** (under the 150 KB budget) |
| TypeScript, ESLint, production/PWA build | **Passed** |

Tests also cover review transitions, persisted data, import/export, offline use, screen sizes and rotation. Lighthouse scores were measured in the automated test environment, not on a physical iPhone.

See the [final review](docs/final-review.md) and [acceptance audit](docs/acceptance-audit.md) for details.

---

## Design Decisions

**Recall first** — the problem category stays hidden during a review. The idea is to recognise the pattern independently, rather than being given the clue immediately.

**Pure scheduler** — review calculations, interval previews and queue ordering live outside the UI. The same scheduling logic produces both the preview and the saved result.

**Offline and local by default** — IndexedDB stores cards, logs and settings on the device. No account, server or network connection is needed once the PWA is cached.

**History over resets** — removing a problem from the deck archives it without throwing away previous reviews. Undo restores the previous card state and review log safely.

**Mobile-first** — dark LeetCode-inspired styling, thumb-friendly controls, iPhone safe-area handling and layouts that adapt to portrait and landscape.

---

## Deployment and iPhone Installation

GitHub Pages deployment is configured, but **publishing is a separate manual step**. Pushing code to GitHub alone does not make the site live.

1. Push the repository to GitHub.
2. Open **Settings → Pages** in the repository and select **GitHub Actions** under Build and deployment.
3. Go to **Actions → Deploy Recall to GitHub Pages → Run workflow** and select the release branch.
4. Open the URL GitHub gives you after the workflow succeeds. For this repo, the expected project-site format is `https://tobioparinde.github.io/blind75-recall/`.

To install on iPhone, open the published URL in **Safari → Share → Add to Home Screen**. After opening it online once and allowing the PWA to cache, test reopening it in airplane mode.

**Important:** browser storage does not sync between your laptop and iPhone. Export a JSON backup on one device and import it on the other to transfer progress. Physical iPhone installation, VoiceOver, safe areas and real-device loading performance still need checking.

---

## Documentation

- [Original build brief](docs/Blind%2075%20Recall%20Build%20Brief%20for%20Codex.pdf)
- [Implementation plan](docs/implementation-plan.md)
- [Scheduler decisions](docs/scheduler-decisions.md)
- [Persistence contract](docs/persistence-contract.md)
- [Review contract](docs/review-contract.md)
- [Physical-device checklist](docs/physical-device-checklist.md)

---

*Built with React + TypeScript + Vite, with Codex used to support implementation, testing and iteration.*
