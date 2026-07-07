# Penni

A UPSC preparation app: daily current-affairs briefings with article-based Prelims practice, Mains answer-writing evaluation (AI-annotated PDFs), previous-year questions, and a geography Maps Arcade.

**Live:** https://kirtipaldeora.github.io/michi/

## Features
- Daily shorts with UPSC relevance, key terms, prelims facts and deep dives
- 2 Prelims MCQs auto-attached to important articles — practice while you read
- Practice hub: daily target set, subject-wise, article-wise and bookmark-based practice
- Mains: upload up to 5 handwritten answers/day — Claude evaluates, returns feedback + an annotated PDF (bring your own API key in Settings)
- Streaks, badges and progress tracking
- PYQ Vault and Maps Arcade
- Installable PWA, works offline

## Daily content
Attach a current-affairs PDF in the Claude Code session; topics are extracted into `defC()` in `index.html` (with key terms + practice questions) and pushed automatically.

## Files
- `index.html` — the app shell, feed and content store
- `penni.js` — practice engine, engagement, settings, Mains evaluation
- `pyq.html` / `pyq-data.json` — PYQ Vault
- `index-3.html` + `support.js` — Maps Arcade
- `sw.js`, `manifest.webmanifest` — PWA layer
