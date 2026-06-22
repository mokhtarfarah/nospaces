# Nospaces — Reference

Stable facts about the app: what it is, how it's built, where things live. Read on demand — you don't need to re-read this every session. For "what's next," see `HANDOFF.md`; for the backlog, `docs/ROADMAP.md`; for history, `docs/HANDOFF-archive.md`.

---

## App

Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

**North star:** one-stop media library + taste-tracking / curation source. The whole point: see all my media easily, at a glance, including on the go. Design mentality: clean, easy, productive, sleek/editorial. Every UX and feature choice serves "at a glance + low friction."

**Design constants:** all-lowercase UI. No emoji anywhere — use text/SVG glyphs; if a unicode symbol might emoji-render on iOS, append `︎` (U+FE0E). Palette: ink `#1C1B19`, graphite `#6F6B64`, mute `#ABA69C`, hairline `#ECEAE6`. Typeface: Geist.

**Current state:** Phases 1–4 done (mobile/status/genres/header; action card + editing; cohesion + tag system; data management). Phase 5 (discovery + taste) in progress.

---

## Stack

React + TypeScript + Vite PWA · Supabase (okxuzqqzqpuyepgiskqp) · Google OAuth · Anthropic claude-sonnet-4-5 · Vercel · Postmark inbound (nospaces.xyz) · Repo: github.com/mokhtarfarah/nospaces

### Local dev
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces && npm run dev  # localhost:5173
```

### Testing
```bash
npm test             # Vitest, run once
npm run test:watch   # re-run on change
npm run typecheck    # tsc --noEmit (src) && tsc --noEmit -p tsconfig.api.json (api/)
```
54 tests across `letterboxd`, `gaps`, `spotify`, `shows`, `genres`, `review`. CI runs on every push (GitHub Actions, free). **When adding pure logic, add a test.**

**Tests run automatically:** a Stop hook (`scripts/check-tests.sh`) runs Vitest after each turn and warns on failures; the pre-commit hook hard-blocks any commit where genres/typecheck/tests fail (bypass with `git commit --no-verify`). All local + free.

---

## Key files

- `src/screens/LibraryScreen.tsx` — library UI + filter/sort/gaps/dupes
- `src/screens/AddScreen.tsx` — add screen + library tools (auto-fill)
- `src/screens/TasteScreen.tsx` — taste snapshot page
- `src/components/ItemActionSheet.tsx` — action card (read/edit/reaction views)
- `src/components/MarkDoneSheet.tsx` — mark-as-done sheet
- `src/components/GapsSheet.tsx` — data-gaps tidy sheet (accessible from Library header)
- `src/components/DuplicatesSheet.tsx` — duplicate review sheet
- `src/hooks/useItems.ts` — all item CRUD + toggleOwned, toggleCanon, duplicateGroups
- `src/lib/moods.ts` — vibe/verdict vocab + MOOD_REMAP. Edit freely.
- `src/lib/genres.ts` — genre vocab per type (frontend source of truth).
- `api/_genres.ts` — genre vocab for all Vercel functions (they can't import from src/). **Only TWO copies now** (session 40): `src/lib/genres.ts` + `api/_genres.ts`. Every api endpoint (`genres`, `identify`, `recommend`, `search`, `email`) imports from `api/_genres.ts` — never redeclare a local copy. `scripts/check-genres.mjs` (pre-commit) diffs the two and blocks drift.
- `api/` endpoints: `identify` · `genres` · `vibes` · `email` · `art` · `blurb` · `lookup` · `watch` · `wiki` · `runtime` · `describe` · `search` · `geocode` · `shows` · `recommend` · `recommend-feeds` · `taste-profile`
- `api/_genres.ts` (shared genre vocab) · `api/_ratelimit.ts` (shared auth + rate-limit; see Architecture)
- `supabase/schema.sql`

---

## API costs

**Two completely separate billing systems.**

| System | What it is | How billed |
|---|---|---|
| **Claude Code (this chat)** | Farah's Claude Code subscription | Flat subscription — no per-token cost |
| **Nospaces `ANTHROPIC_API_KEY`** | Pay-as-you-go API key in Vercel | Charged per token. Can run out. |

**Per-call estimates:**
- `/api/identify` (Sonnet, single item): ~$0.01
- `/api/genres` or `/api/vibes` (Haiku): ~$0.001
- `/api/recommend` with web_search: **~$0.15–0.20** ← expensive
- `/api/recommend` PDF upload (no web_search): ~$0.05–0.10
- All other endpoints (blurb, art, wiki, shows): free (external APIs)

**Rules:** never run more than 2–3 test API calls to verify a feature. web_search is the most expensive *per-call* tool — never in loops or exploratory tests. Flag cost impact whenever suggesting a new Anthropic API feature.

**Real-world note (June 2026, from the usage console):** the actual monthly bill (~$10) was dominated by **Sonnet token volume**, not web_search (only 42 searches all month ≈ $0.40). Spend was front-loaded into the Jun 1–6 build week (bulk seeding/identifying). Input tokens (1.68M) far outweighed output (315k), so the true cost lever is **input-heavy calls: photo vision, bulk email/Letterboxd adds, and whole-library prompts (taste-profile, recommend)** — not clicking around Discover. Routine single-item adds are pennies. Anthropic has a **$20 monthly hard cap** set (hard stop — if hit, all AI features fail silently until month reset; fix = raise the cap).

---

## Vercel env vars

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- `ALLOWED_EMAILS` — allowlist for inbound email capture. ✅ set. Fails closed if unset.
- `EMAIL_WEBHOOK_SECRET` — gates the inbound email webhook (Postmark Basic Auth or `?token=`). ✅ set in Vercel + on the Postmark webhook URL.
- `POSTMARK_SERVER_TOKEN` — needed to activate email talkback (not yet active — waiting on Postmark account approval for sending to gmail, submitted 2026-06-02)
- `POSTMARK_FROM` — optional reply-from override
- `TICKETMASTER_API_KEY` — shows near you (Ticketmaster/Live Nation only)
- `TMDB_API_KEY` — film/TV catalog search in `/api/lookup`
- `VITE_SENTRY_DSN` — crash reporting (frontend). ✅ set in Vercel (all envs) + verified live (test event landed in the `javascript-react` project, session 47). Note: ad-blockers/privacy extensions block the ingest request locally — Farah's own Chrome was blocking it; real user/phone crashes still report fine.

---

## Features

### Email capture
Forward anything to `anything@nospaces.xyz`. AI finds every media item + saves as `want_to`. Photo attachments (incl. HEIC) work. **Big photos don't work via email** — Vercel caps at 4.5MB; Postmark always inlines full attachment; Gmail can't shrink. Use in-app "Add from a photo" instead (downscales to 1600px client-side). **Talkback** (replies to sender): code live, waiting on Postmark account approval.

**DKIM verified (2026-06-02):** was blocked by a Porkbun wildcard CNAME (`*`). Fixed by deleting the wildcard and adding Postmark's DKIM TXT record directly. Selector: `20260602022450pm._domainkey`. Verify: `dig +short 20260602022450pm._domainkey.nospaces.xyz TXT`.

### Spotify sync
Add → "Sync from Spotify" → `/spotify`. Pulls Saved Albums on demand (PKCE OAuth, fully client-side). First sync → all as `want_to`. Subsequent syncs → only new albums as `done`. Deduped by title+artist and `metadata.spotifyId`. Stored: `type:'music'`, `source_detail:'spotify'`, `metadata.{spotifyId,spotifyUrl,coverUrl}`.

### Letterboxd import
Add → "Import from Letterboxd" → `/import`. Upload `watchlist.csv`, `watched.csv`, `ratings.csv`. Ratings→reactions: 5★→loved it, 4/4.5★→liked it, 3/3.5★→eh, ≤2★→not for me. Deduped by title+year. Imports arrive with null creator (no director in CSV) — re-identify fixes one at a time.

### Shows near you
Music category → "shows near you" → `/shows`. Ticketmaster Discovery API. Two tabs: near me (GPS/city list) + all tours (worldwide by artist). Covers TM/Live Nation only — indie venues missing. Bandsintown API gated (applied, not approved). Shape is ready to merge both sources when approved.

### iOS Shortcut — RETIRED
iOS doesn't support PWA file share targets. Use screenshot → share → Mail → forward to nospaces address instead.

### Input paths (summary)
1. Type/describe → Haiku intent → catalog (iTunes/TMDB/OpenLibrary) → PickerSheet → ConfirmSheet
2. Catalog miss → Sonnet identify → ConfirmSheet
3. Single/bulk photo → Sonnet vision → ConfirmSheet / BulkConfirmSheet
4. Save as note (scratch) → no AI, triage later
5. Email forward → Sonnet → bulk save want_to
6. Letterboxd CSV → no AI, stars→reaction
7. Spotify sync → no AI
8. Recommendations PDF → Sonnet → checklist → want_to

---

## Architecture decisions

### Vibe/verdict taxonomy (locked)
- **Verdicts** = your relationship to the work → always manual, AI never suggests. Stored in `moods[]`.
- **Vibes** = properties of the work → AI suggests (unconfirmed), user confirms. Stored in `moods[]` (confirmed) or `metadata.unconfirmedVibes` (unconfirmed, never in moods until user confirms).
- **Axis metadata** in `moods.ts` groups cross-medium synonyms for the recommender.

**Current verdicts (10):** comfort · guilty pleasure · hyperfixation · in rotation · unfinished business · delivers · stuck with me · respect, not love · overrated · so bad it's good

**Current vibes:**
- Core (all media): hazy · dark · melancholic · nostalgic · romantic · off-kilter · epic · playful · sexy · sharp · lush
- Narrative (film/tv/book): intense · heavy · easy · demanding · funny · cozy · earnest
- Film/TV only: arthouse · fun
- Music only: hype · raw · danceable · groovy · mellow · hypnotic
- Book only: propulsive · dense · lyrical · immersive · literary · spare

### Canon
Stored as `metadata.canon: true`. Toggle lives in the reaction view — sits between "liked it" / "loved it" and "eh" / "not for me" rows, styled as the 5th reaction button. Saves immediately (like `toggleOwned`). `◆` marker on library rows and grid cards. `◆ canon` filter chip in library. Canon items shown per-medium on taste page (cover tiles, no cap). Canon is NOT a verdict — it's a curatorial identity statement, not a description of how something landed.

### Wikipedia
Proxied through Vercel (`api/wiki.ts`) to avoid CORS. Multi-fallback cascade (4 queries per item). Film/TV resolution is lenient (trusts top hit, no title guard) — meaning film/TV items may get the wrong article. Books/music use title guard. Persisted to `metadata.wikiUrl/wikiThumb/wikiSummary` via `patchMetadata`. Wikidata fields (year, runtime, director, author, pages) read from structured claims, not article prose.

### Genre vocab — two copies (consolidated session 40)
Vercel serverless can't import from `src/`. Previously the vocab was duplicated across 5+ api files (genres, identify, recommend, search, email) — several had silently drifted into reduced subsets. Now there's a single `api/_genres.ts` (exports `GENRE_VOCAB`, `GENRE_FLAT`, `genreBlock()`) that every api endpoint imports. Only two copies remain: `src/lib/genres.ts` and `api/_genres.ts`, kept in sync by `scripts/check-genres.mjs`. Side effect: `recommend` and `email` now use the full vocab (they used to omit `memoir` etc.).

### Action card structure
Read view: flat link row (edit · on my shelf/own it · about this · wikipedia · watch). Unconfirmed vibes shown muted. "add a verdict →" nudge on done items with no verdict → opens reaction view with verdict expanded. Edit view: auto-fill button at top, more-details collapsed section. Reaction view: reaction grid → canon → note → vibe/verdict chips → save.

### api/ is ESM — relative imports MUST have `.js` extensions
`package.json` has `"type": "module"`, so Vercel runs the `api/` functions as native ESM. **Node ESM rejects extensionless relative imports at runtime** (`ERR_MODULE_NOT_FOUND` → `FUNCTION_INVOCATION_FAILED` on every request) — even though the TS checker (`tsconfig.api.json`) and local `esbuild --bundle` both accept them (bundling inlines the import and hides the bug). So any `import … from './_genres'` must be written `'./_genres.js'` (the compiled output name, even though the source is `.ts`). This silently took down 5 endpoints between the genre consolidation and session 44. **When adding a new `api/` helper or importing one, always include the `.js` extension.**

### API auth + rate limiting
Every `api/` endpoint requires Supabase auth and is rate-limited via the shared `api/_ratelimit.ts` (`checkRateLimit(userId, endpoint, limitPerHour)` → atomic `check_rate_limit()` RPC, backed by the `api_rate_limits` table in `schema.sql`). Caps are per-endpoint (e.g. identify 60/hr, recommend 10/hr). Fails closed if auth is missing. (`lookup.ts` is unauthenticated by design — it uses a light in-memory per-IP throttle instead; see session 45.)

### Data gaps
`itemGaps()` in `src/lib/gaps.ts` checks: year, creator, genre, runtime/pages, wikiUrl. Gaps accessible from Library header as persistent "tidy · N" link. Opens `GapsSheet` bottom sheet with filter chips + item list → deep-links into `/library?item=&edit=1&tidy=1` tidy-queue flow. Auto-fill tools (batch genre, runtime, wiki, art refresh, cleanup) remain on the Add page under "library tools."

### Security posture (audit closed, sessions 43–45)
Full per-endpoint audit done and all findings fixed. Closed: email webhook spoofing (secret-gated, constant-time compare), rate-limit gaps on 7 paid endpoints, SSRF via custom feed URLs (`isSafeFeedUrl()`), unauth `lookup` proxy (per-IP throttle). Verified OK: service-role key server-only, `ALLOWED_EMAILS` fails closed, parameterized Supabase queries, no `Access-Control-Allow-Origin: *`, identify caps input at 2000 chars, rate-limit fails open by design.

---

## Dev automation / hooks

All local + free (no Anthropic cost). Stop hooks fire after each turn; pre-commit gates block bad commits.

- **Genre sync guard** — `scripts/check-genres.mjs` (pre-commit) diffs `src/lib/genres.ts` vs `api/_genres.ts`, blocks drift.
- **Pre-commit hard gate** — `check-genres` + `npm run typecheck` + `vitest run` must pass to commit (`--no-verify` bypass).
- **Automatic testing** — `scripts/check-tests.sh` (Stop) runs Vitest and warns on failure (only when `.ts/.tsx` changed). `scripts/check-test-coverage.sh` nudges when `src/lib` logic changed but no test did.
- **Typecheck on Stop** — runs `tsc --noEmit` (src + api), injects a system message on any `error TS` line.
- **HANDOFF staleness** — `scripts/check-handoff-staleness.sh` fires when screens/key components changed but HANDOFF wasn't updated this session.
- **HANDOFF size / cleanup** — `scripts/check-handoff-size.sh` fires when the live HANDOFF carries too much session history — suggests archiving to `docs/HANDOFF-archive.md`.
- **Roadmap reminder** — `scripts/check-roadmap.sh` fires when `src/`/`api/` code shipped but the roadmap wasn't touched — nudges to mark items shipped AND pitch new ones.
- **Session length / wrap** — `scripts/check-session-length.sh` + `scripts/check-session-wrap.sh` nudge a good stopping point once enough items shipped.
- **guide reminder** — Stop hook fires when `src/screens/` / `ItemActionSheet` / `MarkDoneSheet` / `src/lib/moods.ts` change — prompts to check if `/guide` needs updating.

All registered in `.claude/settings.local.json` (Stop hooks + permission allowlist).

### CI + supply chain
- **CI (`ci.yml`)** runs on every push: lint + typecheck + 54 tests + production build + `gitleaks` (secret scan over repo + full history).
- **Dependabot** (`.github/dependabot.yml`) — weekly grouped PRs for vulnerable/outdated npm + GitHub Actions deps.
- **Crash reporting** — `@sentry/react` in `main.tsx` (guarded on `VITE_SENTRY_DSN`); `ErrorBoundary` reports caught crashes.
