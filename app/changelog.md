# Changelog

All notable changes to the `michi` application will be documented in this file.

---

## [1.1.0] - 2026-07-08

### Added
* **Local Network Hosting**: Configured `host: true` in `vite.config.ts` so `npm run dev` exposes the app on the local network (e.g. `http://192.168.1.X:5173`), enabling instant mobile phone testing.
* **FontAwesome Local Assets**: Copied local FontAwesome styles and webfonts into `public/fa` and linked the stylesheet in `index.html`, fixing missing onboarding and loading icons.
* **Responsive Deck Mode Layout**: Added a max-height CSS media query (`max-height: 740px`) that automatically resizes cards, paddings, and icons (shrinking center icons from `104px` to `76px`) to prevent content from overlapping the bottom slide counter and navigation bar on short mobile screens.

### Changed
* **Compact PYQ Vault Dropdowns**: Replaced space-consuming horizontal filter chip rows with custom, side-by-side glassmorphic `CustomDropdown` selectors for Year and Subject filters.
* **Inline Header Search Bar**: Repositioned the search input next to the PYQ Vault header, letting it dynamically stretch and expand to fill all remaining width.
* **Standardized Header Styles**: Reverted custom title modifications in PYQ Vault to left-aligned `PYQ Vault` with a smaller subtitle `"Practice previous years 📝"`.
* **Standardized Back Buttons**: Aligned and matched the back button design across PYQ Vault and Maps Arcade screens to match the global premium glass-panel style.
* **Revise Subject Theme Styling**: Updated the title formatting in "Revise by Subject" screen so the active subject is displayed in theme yellow matching standard screens.

### Fixed
* **PYQ Data Loading Bug**: Fixed a syntax omission inside the `results` useMemo block of `PYQVault.tsx` where the `pool.filter` callback function was missing a return statement, causing questions and options to load as empty lists.

---

## [1.0.0] - 2026-07-07

### Added
* **Capacitor Integration**: Scaffolded native mobile builds for iOS and Android platforms.
* **Daily Briefing Card Deck**: Implemented swipe gestures for standard article revision deck.
* **Interactive Maps Arcade**: Added geography quiz for Indian national parks and river systems using D3.js and TopoJSON.
* **PYQ Practice**: Implemented previous years question list view with bookmarking and descriptions.
* **Progressive Web App Support**: Added PWA assets (icons, manifest) and workbox service-worker caching configuration for full offline capability.
* **Settings & Haptics**: Implemented theme switching (light/dark modes), local storage backups, JSON sheet imports, and haptic feedback triggers for interactive buttons.
