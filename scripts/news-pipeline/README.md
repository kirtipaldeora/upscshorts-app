# Penni daily news pipeline

Replaces the manual newspaper-PDF workflow. Every morning it enumerates what
The Hindu, Indian Express, PIB, PRS India and AIR/DD News published, filters it
for UPSC relevance, and generates the day's Penni article pack (deep dive,
prelims questions, English + Hinglish narration) straight into
`app/public/data/articles/`.

## How it works

```
[1] FETCH    Hindu news sitemap ─┐
             IE news sitemap    ─┤
             PIB AllRelease     ─┼─→ raw.json          (every item published, ~400-600/day)
             PRS blog listing   ─┤
             DD/AIR RSS feeds   ─┘
[2] PREFILTER heuristics drop sports/entertainment/horoscopes/local-crime
[3] FILTER    Haiku scores each survivor 0-10 for UPSC relevance, tags
              category + GS paper, and clusters same-event coverage
              → scored.json (full audit trail), selected.json (top stories)
[4] GENERATE  Sonnet writes each selected story as a full Penni article
              following app/content-generation-guidelines.md and
              app/content/explain-script-prompt.md
              → app/public/data/articles/<date>.json + index.json
```

Run artifacts live in `content-pipeline/runs/<date>/`. `scored.json` is the
audit trail: if a story you expected is missing from the app, look it up there
to see the score it received, then tune the filter prompt.

## Sources (legal basis)

Only free, publisher-provided discovery surfaces are used: news sitemaps
(published for Google News), public RSS feeds, and government press releases.
Full text is fetched only where freely readable; paywalled pieces are worked
from headline + summary + corroborating free sources. Published articles are
original teaching material, never reproductions.

- The Hindu — full print edition ("Today's Paper",
  `thehindu.com/todays-paper/<date>/th_chennai/`): the complete daily issue,
  every desk (National, International, Editorial, Business, Regional), ~110-120
  articles with headline + teaser. Falls back to the update sitemap if the TOC
  layout changes. Editorials, international affairs, ethics angles and
  UPSC-relevant regional/state stories are all scored in — the filter is told to
  prefer analytical editorials and opinion pieces (Mains gold).
- Indian Express — `indianexpress.com/news-sitemap.xml`
- PIB — `pib.gov.in/AllRelease.aspx?reg=3&lang=1` (English, national)
- PRS India — `prsindia.org/theprsblog` listing
- DD News — `ddnews.gov.in/category/{national,international,business}/feed/`
- AIR — `newsonair.gov.in/feed/` (frequently blocks bots; tolerated failure)

## Running locally

No API key needed — it uses your Claude Code CLI login:

```bash
node scripts/news-pipeline/run.mjs --skip-generate   # preview: fetch + filter only
node scripts/news-pipeline/run.mjs                   # full run for today (IST)
node scripts/news-pipeline/run.mjs --max 10 --dry    # generate but don't touch app data
```

Flags: `--date YYYY-MM-DD`, `--hours N` (lookback window, default 26),
`--max N` (stories to publish, default 14), `--min-score N` (default 6),
`--engine api|cli|codex|auto`, `--skip-generate`, `--dry`.

For a curated bulletin import, `manual-import.mjs` normally reads
`scripts/news-pipeline/data/<date>.mjs`. Pass `--data path/to/items.json` to use
an extracted JSON array with the same item fields without copying a temporary
source file into the repository.

## Automation

Loading-screen case studies have their own deliberately small pipeline:
`loading-briefs.mjs` reads the publisher-provided The Better India RSS feed on
the server, selects three to five constructive stories, and writes original
16–24 word briefs to `app/public/data/loading-briefs/latest.json`. The published
snapshot retains provenance metadata for validation and auditing, while the
loading interface only renders the category, title and summary.

`.github/workflows/daily-loading-briefs.yml` runs at **06:30 IST** every day
and can also be started manually with an optional date and story count. It
requires the `ANTHROPIC_API_KEY` repository secret. Generated copy is checked
for schema, length, topic diversity and meaningful source-phrase overlap before
the file is touched; the workflow validates it again and commits only a real
JSON change. If RSS, generation or validation fails, the job exits without
replacing the last known-good snapshot.

Run or verify it locally with:

```bash
node scripts/news-pipeline/loading-briefs.mjs --engine cli --dry
node scripts/news-pipeline/loading-briefs.mjs --validate app/public/data/loading-briefs/latest.json
```

## In-app source toggles

Settings → News sources lets a student hide/show articles per source
(The Hindu, Indian Express, PIB, PRS India, AIR/DD News). Mapping lives in
`app/src/constants/sources.ts`; articles with combined bylines stay visible
while any of their sources is enabled.
