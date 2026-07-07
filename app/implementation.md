# Implementation Details

This document outlines the technical design, architectural patterns, and structural implementations of the `michi` Progressive Web App (PWA).

---

## 🎨 1. Glassmorphism Design System & Styling

The application uses custom design tokens defined in [index.css](file:///d:/Projects/Personal/michi/app/src/index.css) to build a consistent frosted-glass theme across light and dark modes.

* **CSS Variables**: System colors, background gradients, and panels are powered by theme-aware variables:
  * `--bg1`, `--bg2`, `--bg3`: Main background gradient.
  * `--panel`, `--panel2`, `--panel-border`: Controls backdrop panels, borders, and frosted card gradients.
  * `--ink`, `--ink2`, `--ink3`: Dynamic typography color palettes.
* **Liquid Glass Nav Bar**: Custom style sheets override default settings to construct the premium floating bottom dock navigation menu.
* **Layout Safeguards (Mobile-First)**:
  * Uses `padding-top: env(safe-area-inset-top)` and `padding-bottom: max(44px, calc(44px + env(safe-area-inset-bottom)))` to prevent content overlaps with physical device elements (such as iOS notches or Android home bars).
  * Uses max-height responsive media queries (`max-height: 740px`) to scale down the daily card deck components (icons, text lengths, padding) on shorter viewports so content stays centered without overlapping the deck counter card (`.deck-cnt`) or bottom menu.

---

## ⚡ 2. State Management

Application state is kept modular and clean using [Zustand](https://github.com/pmndrs/zustand) stores located in `src/stores/`:

1. **`useAppStore.ts`**:
   * Tracks active screen ('feed', 'revise', 'search', 'profile') and overlay screens ('deep-dive', 'flashcards', 'maps-arcade', 'pyq-vault').
   * Holds downloaded article feeds and selected date filters.
   * Syncs state to local storage with custom JSON encoders for offline persistency.
2. **`useBookmarkStore.ts`**:
   * Maintains user-marked bookmarks.
   * Provides rapid lookup arrays to trigger active state indicators on cards and grids.
3. **`useThemeStore.ts`**:
   * Controls light/dark mode states.
   * Toggles the `.dark` class directly on `document.documentElement` to trigger CSS token swaps.

---

## 🔍 3. Data Integration & Custom Filtering

Data is loaded locally from json structures in the `public/` directory (e.g. `/data/pyq-data.json`, `/data/articles/...`).

### PYQ Filtering Logic
The filter system processes standard search keywords alongside category fields:
* **Inputs**: Search string `query`, `activeYear` (either `number` or `'all'`), and `activeSubject` (either `string` or `'all'`).
* **Optimized Memoization**:
  The filtered results array is computed using `useMemo` blocks:
  ```typescript
  const results = useMemo(() => {
    const q = query.toLowerCase()
    return pool.filter((item) => {
      const matchYear = activeYear === 'all' || item.year === activeYear
      const matchSub = activeSubject === 'all' || item.subject === activeSubject
      const matchQ = !q || item.question.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q)
      return matchYear && matchSub && matchQ
    })
  }, [pool, activeYear, activeSubject, query])
  ```
  *(Fixed syntax omission where the `pool.filter` callback was missing the final boolean return statement, resulting in an empty array output).*

---

## 🛠️ 4. Offline Capabilities & PWA Configuration

To achieve reliable offline operation suitable for a Capacitor app context, all network and CDN dependencies have been vendor-loaded locally.

* **Vite PWA Plugin Configuration**:
  Implemented auto-update behaviors via `VitePWA()` in `vite.config.ts`.
* **Runtime Service Worker Caching**:
  * **Static Assets**: Automatically caches local Nunito webfonts, local FontAwesome stylesheets, and app stylesheets.
  * **Daily Briefing Articles**: Employs `StaleWhileRevalidate` caching strategies to load stored JSON lists instantly, while checking the server background for updates.
  * **Map GeoJSON Data**: Employs a `CacheFirst` strategy on map geojson datasets to ensure heavy map layers are stored locally forever after the initial download.
* **Exposing Network IP**:
  Added `server: { host: true }` in `vite.config.ts` so developers can directly load the live development build on mobile devices over Wi-Fi.

---

## 🎯 5. Local Assets Vendor Setup

* **FontAwesome**: FontAwesome icon vector resources are hosted entirely inside `public/fa/`. They are loaded in `index.html` via:
  ```html
  <link href="/fa/css/all.min.css" rel="stylesheet" />
  ```
  This renders all standard icon selectors (`fas fa-newspaper`, `fas fa-circle-notch`) reliably offline without CDN dependencies.
* **Nunito Fonts**: Font styles are defined inside `index.css` via local `@font-face` rules pointing to `/fonts/nunito-0.woff2` to guarantee offline font consistency.



## 6. The Start orignal plan 

# michi — React + TypeScript + Vite + Tailwind Migration Plan

## Background

**michi** is a mobile-first UPSC current affairs app currently built as a single-page HTML/CSS application (177 KB `index.html`) with:
- A **custom dc-runtime** (`support.js`, 55 KB) — a declarative React-based template engine built on top of bundled React/ReactDOM/Babel loaded from `assets/vendor/`
- `index-3.html` — the Maps Arcade, using dc-runtime's `<x-dc>` template syntax with D3.js, TopoJSON, and custom map quiz logic
- `pyq.html` — the PYQ Vault, a standalone vanilla JS page
- GeoJSON/TopoJSON data files (`india-rivers-ne-10m.geojson`, `india-rivers-osm.geojson`, `india-national-parks.json`, `assets/data/countries-110m.json`)
- Font Awesome icons (local, in `assets/fa/`)
- Nunito font (local, in `assets/fonts/`)
- CSS custom properties for a dual-mode (light/dark) glassmorphic purple theme

The goal is to migrate into a proper **React 18 + TypeScript + Vite + Tailwind CSS** monorepo, packaged for **Web (Vercel)**, **Android**, and **iOS (Capacitor)** — while keeping the UI/UX pixel-faithful to the current design.

---

## User Review Required

> [!IMPORTANT]
> **Maps Arcade is a dc-runtime component.** `index-3.html` uses `<x-dc>` declarative template syntax, `<sc-if>`, `<sc-for>`, `{{ }}` interpolations, and connects to a custom runtime. Migrating this to React components will require rewriting the entire Maps Arcade template as proper React JSX. The quiz logic, state machine, and D3-rendered SVG map will all be ported to React hooks + refs. This is the most complex part of the migration.

> [!IMPORTANT]
> **GeoJSON files are large.** `india-rivers-osm.geojson` is 3.2 MB. On mobile (Capacitor), bundling these inside `public/data/` is the right call for offline use. On web/Vercel, we can serve from `public/` too, but may want to consider lazy-loading or splitting. The plan below bundles all data files in `public/data/` for offline-first support.

> [!WARNING]
> **The existing `index.html` contains embedded article data** (the full `defC()` function returning a large JSON object of UPSC current affairs articles). In the new architecture, this data should live in `public/data/articles/` as per-date JSON files (e.g., `2026-07-07.json`) and be fetched dynamically. This is a breaking change to the data model — please confirm if this approach is acceptable, or if you'd prefer to keep the embedded data pattern differently.

---

## Confirmed Decisions

All decisions locked in based on alignment session:

| Topic | Decision |
|---|---|
| **Tailwind version** | v3 LTS — `tailwind.config.ts`, `extend.colors` |
| **Routing** | React state-based only — no URL changes, Capacitor-safe |
| **Font Awesome** | npm packages (`@fortawesome/react-fontawesome`) — tree-shaking + TypeScript |
| **Article data** | Per-date JSON files in `public/data/articles/{date}.json`; architecture ready for remote fetch later |
| **State management** | Zustand |
| **Maps Arcade** | Full React rewrite — D3 via `useRef`, quiz via `useReducer`. Fully independent from Atlas Arcade Codex |
| **PYQ Vault** | Full React rewrite — `PYQVault.tsx` component |
| **PWA** | Yes — `vite-plugin-pwa` with service worker |
| **App location** | `michi/app/` subdirectory, legacy files untouched |
| **Capacitor plugins** | `@capacitor/haptics`, `@capacitor/share`, `@capacitor/filesystem` |
| **JSON Import feature** | Preserved + improved (drag-and-drop on desktop, better progress UX) |
| **Atlas Arcade Codex** | Kept fully independent — no code sharing |

---

## Proposed Changes

### Project Structure

The new app will live at `d:\Projects\Personal\michi\app\` (a subdirectory of the existing repo).

```
michi/
├── (legacy files — kept as-is)
│   ├── index.html
│   ├── index-3.html
│   ├── pyq.html
│   └── ...
└── app/                          ← NEW React app
    ├── public/
    │   ├── data/
    │   │   ├── countries-110m.json
    │   │   ├── india-rivers-ne-10m.geojson
    │   │   ├── india-rivers-osm.geojson
    │   │   ├── india-national-parks.json
    │   │   └── articles/         ← per-date JSON files
    │   ├── icons/                ← copied from assets/icons/
    │   ├── fonts/                ← Nunito WOFF2
    │   └── manifest.webmanifest
    ├── src/
    │   ├── types/
    │   │   ├── article.ts        ← Article, DeepDive, Flashcard types
    │   │   └── quiz.ts           ← Map quiz types
    │   ├── constants/
    │   │   ├── categories.ts     ← CC, CI (colors & icons)
    │   │   └── theme.ts          ← CSS variable tokens
    │   ├── stores/
    │   │   ├── useAppStore.ts    ← Zustand: articles, dates, active screen
    │   │   ├── useThemeStore.ts  ← light/dark toggle
    │   │   └── useBookmarkStore.ts
    │   ├── hooks/
    │   │   ├── useArticles.ts    ← load/merge article data
    │   │   └── useHaptic.ts      ← navigator.vibrate wrapper
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── SplashScreen.tsx
    │   │   │   ├── Onboarding.tsx
    │   │   │   ├── BottomNav.tsx
    │   │   │   └── TopBar.tsx
    │   │   ├── feed/
    │   │   │   ├── FeedScreen.tsx
    │   │   │   ├── DateTabs.tsx
    │   │   │   ├── ViewToggle.tsx
    │   │   │   ├── FeedCard.tsx      ← list view card
    │   │   │   └── DeckCard.tsx      ← deck view card
    │   │   ├── deep-dive/
    │   │   │   └── DeepDive.tsx      ← full-screen article detail
    │   │   ├── flashcards/
    │   │   │   └── Flashcards.tsx    ← 3D flip card modal
    │   │   ├── revise/
    │   │   │   └── ReviseScreen.tsx  ← subject accordion
    │   │   ├── search/
    │   │   │   └── SearchScreen.tsx
    │   │   ├── bookmarks/
    │   │   │   └── BookmarksScreen.tsx
    │   │   ├── profile/
    │   │   │   └── ProfileScreen.tsx
    │   │   ├── maps-arcade/
    │   │   │   ├── MapsArcade.tsx        ← full-screen overlay
    │   │   │   ├── MapSVG.tsx            ← D3 + TopoJSON SVG map
    │   │   │   ├── QuizOverlay.tsx       ← question panels
    │   │   │   └── useMapQuiz.ts         ← quiz state machine
    │   │   ├── pyq-vault/
    │   │   │   └── PYQVault.tsx          ← PYQ question list
    │   │   ├── upload/
    │   │   │   └── ImportSheet.tsx       ← bottom sheet, JSON import
    │   │   └── ui/
    │   │       ├── Toast.tsx
    │   │       └── Toggle.tsx
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css             ← @import Nunito, CSS vars, Tailwind base
    ├── capacitor.config.ts
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── package.json
```

---

### Phase 1 — Scaffolding

#### [NEW] `app/` directory via Vite

- `npm create vite@latest app -- --template react-ts`
- Install dependencies: `tailwindcss`, `@tailwindcss/vite` (or postcss plugin), `zustand`, `d3`, `topojson-client`, `@types/d3`, `@types/topojson-client`, `@capacitor/core`, `@capacitor/cli`
- FontAwesome: `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome`

---

### Phase 2 — Design System (CSS)

#### [NEW] `app/src/index.css`

Map the existing CSS custom properties to Tailwind's theme system. The light/dark variables will use `html.dark` class toggling (identical to current behaviour).

The glassmorphic purple colour palette, Nunito font, animations (`cardIn`, `sli`, `sti`, `se`, `sg`), scrollbar hiding, and `button:active` scale transform will all be preserved faithfully.

#### [NEW] `app/tailwind.config.ts`

Define all design tokens as Tailwind theme extensions so they can be used as utility classes (e.g., `bg-panel`, `text-ink2`, `border-panel-border`).

---

### Phase 3 — Types & State

#### [NEW] `app/src/types/article.ts`
TypeScript interfaces for: `Article`, `DeepDive`, `Flashcard`, `ArticlesByDate`.

#### [NEW] `app/src/types/quiz.ts`
Types for the map quiz: `QuizMode`, `QuizState`, `MapFeature`, `QuizQuestion`.

#### [NEW] `app/src/stores/useAppStore.ts`
Zustand store for: articles by date, active screen, selected date, GS paper filters, view mode (deck/list).

#### [NEW] `app/src/stores/useThemeStore.ts`
Zustand store that persists `light|dark` to localStorage, toggling the `html.dark` class.

#### [NEW] `app/src/stores/useBookmarkStore.ts`
Zustand store persisting bookmarked article IDs to localStorage.

---

### Phase 4 — Component Migration

Each section of the original `index.html` maps to a React component:

| Original HTML | React Component |
|---|---|
| `#splash` | `SplashScreen.tsx` |
| `#onboarding` | `Onboarding.tsx` |
| `#app > .top-bar` | `TopBar.tsx` |
| `#feed-screen` | `FeedScreen.tsx` |
| `.date-tabs` | `DateTabs.tsx` |
| `.view-toggle` + `.feed-scroll` | `ViewToggle.tsx` + `FeedCard.tsx` / `DeckCard.tsx` |
| `#deep-dive` | `DeepDive.tsx` |
| `#flashcards` | `Flashcards.tsx` |
| `#revise-screen` | `ReviseScreen.tsx` |
| `#search-screen` | `SearchScreen.tsx` |
| `#bm-screen` | `BookmarksScreen.tsx` |
| `#profile-screen` | `ProfileScreen.tsx` |
| `#upload` | `ImportSheet.tsx` |
| `#maps-arcade` + `index-3.html` | `MapsArcade.tsx` + `MapSVG.tsx` |
| `#pyq-vault` + `pyq.html` | `PYQVault.tsx` |
| `.bottom-nav` | `BottomNav.tsx` |
| `.toast` | `Toast.tsx` |

**Maps Arcade** is the most complex — the dc-runtime `<x-dc>` template (with `<sc-if>`, `<sc-for>`, D3 SVG rendering, quiz state machine, sound system, etc.) will be rewritten as a proper React component tree using `useRef` for D3 and `useState`/`useReducer` for the quiz state machine.

---

### Phase 5 — Data Layer

#### [MODIFY] Article data
The `defC()` embedded function in `index.html` will be extracted to `public/data/articles/2026-07-07.json`. The `useArticles` hook will fetch from `public/data/articles/{date}.json`, falling back to localStorage for previously fetched data. This enables Capacitor offline mode.

#### Static GeoJSON/TopoJSON
All map data files will be copied to `public/data/` and fetched via `fetch('/data/...')` at runtime — identical to current behaviour, but now served by Vite's dev server and bundled in the Capacitor app's web assets.

#### PYQ data
`pyq-data.json` → `public/data/pyq-data.json`

---

### Phase 6 — Capacitor Setup

#### [NEW] `app/capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.michi.app',
  appName: 'michi',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

After `vite build`, run:
```bash
npx cap add android
npx cap add ios
npx cap sync
```

---

### Phase 7 — Vercel Deployment

#### [NEW] `app/vercel.json`

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Verification Plan

### Automated
- TypeScript: `tsc --noEmit` (no type errors)
- Lint: `eslint src/`
- Build: `vite build` — confirm no bundle errors

### Manual Verification Checklist

- [ ] Splash screen animation plays and exits correctly
- [ ] Onboarding flow (3 slides + GS chip selection) works
- [ ] Feed loads articles for today/yesterday; date tabs switch correctly
- [ ] Deck view (swipe-like cards) and list view both render correctly
- [ ] Tapping a card opens Deep Dive with full explanation, facts, question
- [ ] Deep Dive → Flashcards flow works (3D flip)
- [ ] Bookmarking works and persists across refresh
- [ ] Search filters by keyword and category
- [ ] Revise by Subject accordion works
- [ ] Import JSON sheet accepts file upload and merges articles
- [ ] Maps Arcade opens, map renders, quiz plays (all quiz modes)
- [ ] PYQ Vault loads questions, filter by exam/year/subject works
- [ ] Light/dark theme toggle persists
- [ ] Bottom nav switches screens correctly
- [ ] Safe area insets correct on iOS (Capacitor)
- [ ] App runs on `npx cap run android` and `npx cap run ios`
- [ ] Vercel deploy succeeds from `app/dist/`

