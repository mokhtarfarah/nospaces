# Nospaces — Handoff

## 🚦 Current state

| Phase | Status | Summary |
|---|---|---|
| Phase 1 — Stop the bleeding | ✅ Done | Mobile, status, genres, header |
| Phase 2 — Action card + editing | ✅ Done | Two-verb read, auto-fill, type-fix, unconfirmed vibes, labelled tags |
| Phase 3 — Cohesion + tag system | ✅ Done | Vibe/verdict split, canon, data-gaps nav, edit tightening |
| Phase 4 — Data management | ✅ Done | Cover art · data-gaps nav · Tom's login |
| Phase 5 — Discovery + taste | 🔄 In progress | Help-me-decide, how to use, taste page rebuild |

**▶ START HERE:** See "Next session" at the bottom.

## Next session

**▶ START WITH: new-user audit #3–#7 (editorial polish — see the ⭐ queue below).** The whole security audit queue is now closed: #1 webhook spoofing (session 44), #2 rate-limit gaps + #3 SSRF + #4 lookup open-proxy (all session 45). The next open work is the editorial new-user audit (#3 Discover dead-ends without a taste profile, #4 ragged Discover cover sizes, #5 "the gap" needs a label, #6 empty-library insult line, #7 catalog-miss interstitial).

### ⭐ Review next time — new-user audit (session 43, verbatim)

Full editorial audit done through the lens of "a new user with great taste." Two items (#1 + #2) were fixed in session 43; the rest are the open queue. Kept word-for-word so it can be pulled back exactly.

**Big ones (a discerning user notices in 10 seconds)**

1. **The login screen is a different app.** ✅ FIXED (session 43). It was the only Title Case screen ("Nospaces" + "Your personal taste library"); now lowercase `nospaces` / `your personal taste library` to match the design constant.
2. **Robot words leak into the UI.** ✅ FIXED (session 43). Scrubbed "Sonnet" (×2 in AddScreen) and the "Claude's knowledge" source fallback in Discover. Nobody with great taste knows what "Sonnet" is — it read like a debug label.
3. **Discover is a locked door for a new user.** No taste profile = the whole page is a dead end that says "go to the taste page first." And the taste page itself needs rated items first. So a fresh user clicks Discover → wall. The most exciting feature is gated behind two prerequisites with no on-ramp. (`DiscoverScreen.tsx:84,202`)
4. **Discover rows look ragged.** Music covers are 72×72, everything else is 56×84 — covers don't line up on a shared left edge in a mixed feed. Exactly what a design eye catches. (`DiscoverScreen.tsx:406`)

**Medium**

5. **"the gap" is a riddle.** On the taste page it shows `adding thriller · finishing horror` with no label explaining the idea. A new user has no clue what it means — needs one line of framing ("what you're collecting vs. what you actually finish"). (`TasteScreen.tsx:317`)
6. **The empty-library line insults the visitor.** "go listen to some music you loser" — funny as a Farah-and-Tom inside joke, jarring to a stranger. Farah's call whether to keep it. (`LibraryScreen.tsx:899`)
7. **The "nothing found — identify with Sonnet?" interstitial** adds a decision step mid-flow. A great-taste user expects "just find it" — make the fallback automatic or silent. (`AddScreen.tsx:367`)

**What's genuinely good (don't touch):** library header restraint, decade grouping, the taste page's vibe-headline → prose → desert island arc, the editorial palette (once past login), the faithful-creators ("always loved") logic.


**Quick win — ✅ done (session 40):** `api/` now typechecked via a dedicated `tsconfig.api.json` (Node types, DOM lib to match Vercel). Wired into `npm run typecheck` and the Stop hook. Surfaces api TS errors before deploy.

### 🔐 Security audit (session 43, option-B manual deep-dive — fixes PENDING)

Per-endpoint matrix (auth / rate-limit / calls-Anthropic) checked across all 17 `api/` endpoints. Findings, ranked:

1. **[HIGH] `api/email.ts` inbound webhook is spoofable + un-rate-limited.** ✅ FIXED (session 44). Now requires `EMAIL_WEBHOOK_SECRET` (constant-time compared) on every request — via Postmark HTTP Basic Auth header OR `?token=` query param — verified *before* the body is read or any Anthropic call is made. Fails closed if the secret is unset. `EMAIL_WEBHOOK_SECRET` set in Vercel + on the Postmark inbound webhook URL. Verified: no/wrong token → 401 (free, pre-Anthropic); correct token → 200. *(Original hole: trusted attacker-controlled `req.body.From` against `ALLOWED_EMAILS`; a guessed allowed address → library injection + Sonnet cost-DoS.)*
2. **[MEDIUM] Rate limiting is inconsistent.** ✅ FIXED (session 45). All 7 endpoints (`describe`, `vibes`, `genres`, `taste-profile`, `recommend-feeds`, `search`, `runtime`) now call `checkRateLimit` after auth. Each was switched from the local boolean `requireAuth` to the shared `getAuthUserId` + `checkRateLimit` from `_ratelimit.js` (also deleted the duplicated Supabase client boilerplate). Caps: Haiku/cheap (describe, vibes, genres, search, runtime) = 60/hr; pricey Sonnet (taste-profile, recommend-feeds) = 20/hr — in line with identify=60 / recommend=10. *(email.ts calls Anthropic but is a secret-gated webhook with no Supabase user to key on — correctly excluded.)*
3. **[LOW-MED] SSRF in `api/recommend-feeds.ts`.** ✅ FIXED (session 45). New `isSafeFeedUrl()` guard filters `customFeeds[].url` before fetching: requires `http(s)` and rejects loopback / private / link-local / non-routable hosts (incl. the `169.254.169.254` cloud-metadata address), IPv4 + IPv6. `DEFAULT_FEEDS` (hardcoded) skip the check. Literal-host check only — does not resolve DNS (rebinding out of scope for a 2-user app), matching the logged fix.
4. **[LOW] `api/lookup.ts` is an unauthenticated open proxy.** ✅ MITIGATED (session 45). Can't use the Supabase-user rate limiter (no auth + `api_rate_limits.user_id` is a uuid FK to `auth.users`). Added a light in-memory per-IP sliding-window throttle (40 req/IP/min → 429) keyed on `x-forwarded-for`. Best-effort speed bump against casual TMDB-quota scraping — serverless instances are ephemeral/parallel so it's not a hard guarantee. A hard limit would need a schema change (IP-keyed table); not worth it for a LOW finding on a 2-user app.

**Verified OK:** service-role key is server-only (never shipped to client), `ALLOWED_EMAILS` fails closed when unset, Supabase queries are parameterized (no SQL injection), no `Access-Control-Allow-Origin: *`, `identify` caps input at 2000 chars, rate-limit fails open by design (Supabase hiccup won't block use).

**Flagged / unresolved:**
- **Discover page not in final form** — redesign shipped (bigger covers, blurb hero, ink save chip, no-repeat logic) but Farah flagged it still needs more work. Assess next session with fresh eyes. Two concrete code findings from the session-41 audit: (1) it's hard-gated behind the taste profile — no profile = a dead-end empty state; (2) cover sizes are inconsistent (music 72px vs others 56px) so rows don't align.
- **Taste-page "stats" drift — RESOLVED (session 42).** The old stats section (medium filter pills, reaction breakdown, verdict counts, genre love-rate) was **deliberately removed**, not lost — commit `216e6ca` ("rate limiting + taste page redesign") stripped the page down to vibe words → AI prose → aspiration gap → always-loved creators → desert island gallery. Current `TasteScreen.tsx` matches this. The session 30/31 roadmap entries describing the 3-section page were stale and have been corrected. No action needed unless a stats section is wanted back.
- **`ALLOWED_EMAILS` env var** — ✅ set in Vercel.
- **Email talkback** — code live, waiting on Postmark account approval for sending to Gmail (submitted 2026-06-02).

**Parked (do not re-raise without new signal):**
- **Offline library cache** — full offline-first requires queuing mutations (markDone, edits, deletes) — different scope. Revisit only if offline usage becomes a real pattern.
- **Want-to priority** — help-me-decide covers the acute case.
- **Regions map / country filter** — filter library by country of origin (UK vs US vs French films etc). Data blocker: need to pull `P495` (country of origin) from Wikidata and store on items before the filter UI is possible. Wikidata is the right source — reliable structured field.

---

## App

Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

**North star:** one-stop media library + taste-tracking / curation source. The whole point: see all my media easily, at a glance, including on the go. Design mentality: clean, easy, productive, sleek/editorial. Every UX and feature choice serves "at a glance + low friction."

**Design constants:** all-lowercase UI. No emoji anywhere — use text/SVG glyphs; if a unicode symbol might emoji-render on iOS, append `︎` (U+FE0E). Palette: ink `#1C1B19`, graphite `#6F6B64`, mute `#ABA69C`, hairline `#ECEAE6`. Typeface: Geist.

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

**Rules:** never run more than 2–3 test API calls to verify a feature. web_search is the most expensive tool — never in loops or exploratory tests. Flag cost impact whenever suggesting a new Anthropic API feature.

---

## Vercel env vars

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side)
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
Every `api/` endpoint requires Supabase auth and is rate-limited via the shared `api/_ratelimit.ts` (`checkRateLimit(userId, endpoint, limitPerHour)` → atomic `check_rate_limit()` RPC, backed by the `api_rate_limits` table in `schema.sql`). Caps are per-endpoint (e.g. identify 60/hr, recommend 10/hr). Fails closed if auth is missing.

### Data gaps
`itemGaps()` in `src/lib/gaps.ts` checks: year, creator, genre, runtime/pages, wikiUrl. Gaps accessible from Library header as persistent "tidy · N" link. Opens `GapsSheet` bottom sheet with filter chips + item list → deep-links into `/library?item=&edit=1&tidy=1` tidy-queue flow. Auto-fill tools (batch genre, runtime, wiki, art refresh, cleanup) remain on the Add page under "library tools."

---

## Roadmap

### Near-term

**Library UX**
- **Filter bar declutter** — ✅ shipped. Single "filter ▾" button with active-count badge; opens bottom sheet with pill chips for vibe/verdict/genre/series.
- **Decade section headers** — ✅ shipped. "By year" view groups items into decade sections (2020s, 2010s, etc.) instead of a flat chronological list.
- **"Help me decide" decision tree** — ✅ shipped. Guided 3-step flow (seen before? → type → vibe) from `/decide`. Entry: inline link in library header.
- **Library defaults + dynamic tabs** — ✅ shipped. Default: grid + year (decade headers). Category tabs ordered by item count (most-used first), "all" last. "All" grid mode uses uniform square tiles (object-position:top for posters). List thumbnails 42→52px.

**Action card / edit view**
- **Action card link order** — ✅ shipped. New order: edit · about this · spotify · wikipedia · watch · own it.
- **"Add to series" dropdown** — ✅ shipped. Native `<select>` of existing series + "+ new series…" option that reveals a text input. Works on mobile.
- **Data-gaps tidy mode: highlight missing fields** — ✅ shipped. Missing fields show red border/label in tidy-queue flow; more-details auto-expands when runtime/pages/wiki are gaps.

**Data quality / tidy**
- **Wiki gap false positives** — ✅ fixed. Two bugs: (1) ItemActionSheet fetched wiki but never saved it — added auto-save effect. (2) Fill-auto counters didn't respect dismissedGaps — now all derived from itemGaps().
- **Wiki match correctness** — title guard shipped. Existing bad matches: re-identify case-by-case.
- **Data-gaps tidy mode: highlight missing fields** — in tidy-queue flow (`?tidy=1`), show missing fields in red and auto-expand them in edit view. Only in tidy mode.

**Onboarding**
- **"How to use" tutorial page** — ✅ shipped. `/guide` — 5 sections, inline CSS illustrations, accurate to current UI. Entry: `?` in library header + empty-state link. Auto-reminder hook fires when screens change.

**Discovery**
- **Move "shows near you" to discover tab** — ✅ shipped. Removed from music filter row; now a "shows near you / browse →" row above sources on the discover tab.
- **"Not interested" dismiss on discover** — dismiss per result row, titles stored in prefs. Client-side only, no AI signal value — purely keeps feed clean.

**Pro hardening (session 47)**
- **Crash reporting (Sentry)** — ✅ wired (`@sentry/react` in `main.tsx` + `ErrorBoundary` reports crashes). No-op until `VITE_SENTRY_DSN` is set in Vercel — see manual steps below.
- **Lint in CI** — ✅ done. `npm run lint` now runs in `ci.yml`. Also fixed all 30 pre-existing lint issues, incl. a **real bug**: `GapsSheet.tsx` had an early `return null` before ~24 hooks (React rules-of-hooks violation — could crash). Return moved below the hooks.
- **Secret-leak scan (gitleaks)** — ✅ done. New `gitleaks` job in `ci.yml` scans repo + full git history for committed keys.
- **Dependabot** — ✅ done. `.github/dependabot.yml` opens weekly grouped PRs for vulnerable/outdated npm + GitHub Actions deps.
- **PR workflow + branch protection** — ⏸ **parked until >2 users** (pro hardening item #6). Direct pushes to `main` are still allowed (solo dev, 2 users). Memory `pr-workflow-at-3-users` will prompt to revisit when a 3rd user joins.

**⚠️ Pro hardening — manual steps left (need Farah, can't be automated):**
1. ~~**Sentry**~~ — ✅ DONE + verified live (session 47). DSN set in Vercel, test crash landed in the dashboard.
2. **Spend alerts** — ⏳ STILL TODO. (a) Anthropic console → Billing → set a monthly usage limit + alert email. (b) Vercel → project → Usage → set spend notifications. Protects against a runaway loop billing you.

**Dev automation**
- **Typecheck on Stop hook** — ✅ done. Stop hook runs `tsc --noEmit` and injects a system message if any `error TS` lines are found.
- **HANDOFF.md staleness warning** — ✅ done. `scripts/check-handoff-staleness.sh` fires on Stop; warns if screens/key components changed but HANDOFF.md wasn't updated.
- **moods.ts → guide reminder** — ✅ done. Stop hook regex now includes `src/lib/moods.ts`.
- **Automatic testing** — ✅ done (session 46). Two layers: (1) `scripts/check-tests.sh` runs Vitest on Stop and warns on failures (only when `.ts/.tsx` changed); (2) pre-commit hook is now a hard gate — `check-genres` + `npm run typecheck` + `vitest run` must pass to commit (`--no-verify` to bypass). `scripts/check-test-coverage.sh` nudges when `src/lib` logic changed but no test did. CI (`ci.yml`) remains the push-side backstop.
- **Roadmap reminder** — ✅ done (session 46). `scripts/check-roadmap.sh` fires on Stop when `src/`/`api/` code shipped but the Roadmap section wasn't touched — nudges to mark items ✅ shipped AND pitch new roadmap items.
- **HANDOFF cleanup reminder** — ✅ done (session 46). `scripts/check-handoff-size.sh` fires on Stop when the session log exceeds ~8 entries and HANDOFF was edited this session — suggests archiving oldest sessions to `docs/HANDOFF-archive.md`.

### Medium-term

**Taste & stats**
- **Taste page** — ✅ shipped, then redesigned (commit `216e6ca`). Current sections: vibe headline → AI prose → "the gap" (per-medium aspiration) → "always loved" (faithful creators) → desert island gallery. The earlier 3-section stats version (medium pills, reaction breakdown, verdict counts, effort axis) was **deliberately removed** in that redesign — do not assume it's still there.
- **Regions map** — creator origin breakdown. Parked: needs nationality data (not stored). Next step: decide between manual country field vs Wikidata batch-pull.

**Taxonomy / vocabulary**
- **New verdict: "stuck with me"** — ✅ shipped. Between "delivers" and "respect, not love". For things that weren't immediately enjoyable but lingered.
- **Want-to priority** — ⏸ parked. Pin/tier system for backlog adds clutter to every want-to row; help-me-decide + search already cover the acute case. Revisit if backlog grows genuinely unwieldy.

**Discovery & search**
- **Discovery improvements** — ✅ "not interested" shipped. Divert mode as data accumulates.
- **Descriptive library search** — ⛔ shelved. AI applies too many filters simultaneously → tiny intersections. Filter sheet covers the use case better.

**Data & input**
- **Describe-by-recency for film/TV** — ✅ shipped (session 34). `tmdbByPerson()` in `api/lookup.ts`.

**Infrastructure**
- **Offline capture queue** — ✅ shipped (session 34). `src/lib/offlineQueue.ts` + `src/hooks/useOfflineSync.ts`.

### Shelved (decided against — keep for reference)

- **Individual songs** — albums-only is correct. Songs would bloat the library immediately (hundreds of items vs ~50 albums). Taste model (vibe/verdict/genre) is more meaningful at album level. "Standout tracks" belongs as a note on the album, not a separate item.
- **Letterboxd diary.csv** — adds per-watch dates + repeat viewing counts. Per-watch dates are cosmetic. Repeat viewings are interesting signal but require a schema change (currently one reaction per item) and a rewatch UI — disproportionate scope. Revisit only if rewatch tracking becomes a native feature.
- **Bandsintown API** — not yet applied. Approval odds low for a personal app; they gate access for commercial partners. TM covers major shows; indie venue coverage would be nice but not worth planning around. Apply passively and revisit if approved.
- **Descriptive library search** — tried and removed. AI maps natural language to filters but applies all matched dimensions simultaneously, producing tiny intersections. Filter sheet does the job better.

### Long-term

- **Restaurants, museums, exhibitions, experiences** — expand beyond media. Same reaction/note/tag model; new types. Taste profile generalises naturally.
- **Calendar integration** — surface relevant items + suggestions based on where Farah will be. "You'll be in Tokyo in March — 3 things from your want-to list."
- **Master "life index"** — nospaces as curated self-portrait across all domains (media, food, places, events). Not a tracker but a mirror + recommendation engine. Every feature decision: does this make the index richer or the curation sharper?

---

## Recent session log

### Session 47 (2026-06-22) — pro hardening bundle (Sentry, lint-in-CI, gitleaks, Dependabot)

Added the "professional setting" protections bundle. All verified: lint + typecheck + 54 tests + production build green.

1. **Crash reporting (Sentry).** `@sentry/react` installed; `Sentry.init` in `main.tsx` guarded on `VITE_SENTRY_DSN` (no-op locally / until the env var is set); `ErrorBoundary.componentDidCatch` now reports caught crashes. **Manual step left:** create Sentry project + set `VITE_SENTRY_DSN` in Vercel.
2. **Lint in CI + cleanup to zero.** Added `npm run lint` to `ci.yml`. Fixed all 30 pre-existing lint problems to make it a real gate — including a **genuine bug**: `GapsSheet.tsx` had `if (total === 0) return null` *before* ~24 `useState`/`useRef` calls (rules-of-hooks violation that could crash the sheet). Moved the return below all hooks (behavior-identical). Other fixes: eslint config now treats `_`-prefixed vars as intentionally-unused; removed a dead eslint-disable in `AddScreen`; dropped a stable `navigate` dep + justified one intentional dep omission in `LibraryScreen`; documented the two Ticketmaster `any` shapes in `shows.ts`.
3. **Secret-leak scan (gitleaks).** New `gitleaks` CI job scans repo + full history for committed keys. Free for personal repos.
4. **Dependabot.** `.github/dependabot.yml` — weekly grouped PRs for vulnerable/outdated npm + Actions deps (capped to stay quiet).
5. **Spend alerts** — documented as a manual step (Anthropic console + Vercel usage notifications); can't be automated from code.
6. **PR workflow + branch protection** — deliberately **parked until >2 users**. Saved memory `pr-workflow-at-3-users` so a future session proactively prompts to set it up when a 3rd user joins.

### Session 46 (2026-06-22) — dev automation: auto-testing, roadmap + handoff-cleanup reminders

Built three automation pieces on top of the existing hook scaffolding. All local + free (no Anthropic cost).

1. **Automatic testing (two layers).** (a) New Stop hook `scripts/check-tests.sh` runs `vitest run` after each turn and injects a warning if tests fail (only when `.ts/.tsx` changed, so it stays quiet otherwise). (b) The `.git/hooks/pre-commit` gate — previously genres-only — now also runs `npm run typecheck` + `vitest run`; a broken commit is blocked (`--no-verify` bypass). (c) `scripts/check-test-coverage.sh` nudges when `src/lib` logic changed but no test file did.
2. **Roadmap reminders.** `scripts/check-roadmap.sh` fires on Stop when `src/`/`api/` code shipped but the HANDOFF Roadmap region wasn't edited — nudges to (1) mark finished items ✅ shipped and (2) pitch NEW roadmap items the work surfaced.
3. **Handoff cleanup.** `scripts/check-handoff-size.sh` fires on Stop when the session log passes ~8 entries AND HANDOFF was edited this session — suggests archiving the oldest sessions to `docs/HANDOFF-archive.md` (log is at 22 now, so this will start firing). Roadmap + Next session stay inline.
4. **Wiring.** All four scripts registered in `.claude/settings.local.json` Stop hooks + permission allowlist. Verified: settings JSON valid, 54 tests pass, scripts stay silent on a no-app-code session.

### Session 45 (2026-06-22) — security audit queue closed (#2, #3, #4)

Closed the remaining three security findings. The whole audit queue is now done.

1. **#2 — rate-limited 7 paid endpoints.** `describe`, `vibes`, `genres`, `taste-profile`, `recommend-feeds`, `search`, `runtime` had auth but no rate limit — a runaway client loop or leaked session token could rack up Anthropic cost. Each now calls `checkRateLimit(userId, '<endpoint>', cap)` right after auth, returning 429 on exceed. Caps: Haiku/cheap = 60/hr (describe, vibes, genres, search, runtime); pricey Sonnet = 20/hr (taste-profile, recommend-feeds). Refactor: swapped each from its copy-pasted boolean `requireAuth` to the shared `getAuthUserId` + `checkRateLimit` from `_ratelimit.js`; removed the now-unused `createClient` import from `search.ts`. email.ts deliberately excluded (secret-gated webhook, no Supabase user to key on; spoofing closed in s44). Commit `1292de8`.
2. **#3 — SSRF guard in `recommend-feeds.ts`.** New `isSafeFeedUrl()` filters `customFeeds[].url` before `fetchFeed`: requires http(s), rejects loopback/private/link-local/non-routable IPv4+IPv6 (incl. `169.254.169.254` metadata). `DEFAULT_FEEDS` skip the check. Literal-host only (no DNS resolution — rebinding out of scope).
3. **#4 — light throttle on `lookup.ts`.** Unauthenticated open proxy can't use the uuid-keyed DB limiter, so added an in-memory per-IP sliding window (40/IP/min → 429, keyed on `x-forwarded-for`). Best-effort speed bump vs TMDB-quota scraping; not a hard guarantee on ephemeral serverless. A hard limit would need a schema change — not worth it for a LOW finding.
4. **Verified:** `npm run typecheck` (src + api) clean, all 54 tests pass after each fix.

### Session 44 (2026-06-22) — email webhook secret + ESM outage fix

Set out to fix security #1 (email webhook spoofing); shipped that **and** uncovered/fixed a hidden production outage.

1. **Security #1 — email webhook secret (shipped + verified end-to-end).** `api/email.ts` now gates every request on `EMAIL_WEBHOOK_SECRET` (constant-time compare via `node:crypto`), accepted as Postmark HTTP Basic Auth OR a `?token=` query param, checked *before* the body is read or any Anthropic call fires. Fails closed if unset. Secret set in Vercel + on the Postmark inbound webhook URL (Basic Auth form: `https://x:SECRET@nospaces.vercel.app/api/email`). Verified live: no/wrong token → 401 (free, pre-Anthropic), correct token → 200. **Real forwarded email confirmed landing in the review inbox.**
2. **Production outage found + fixed (the real story).** While testing, the email endpoint 500'd (`FUNCTION_INVOCATION_FAILED`) — and so did `genres`, `identify`, `recommend`, `search`. Root cause: `package.json` `"type":"module"` makes Vercel run `api/` as ESM, which rejects **extensionless relative imports** at runtime. Every endpoint importing `./_genres` or `./_ratelimit` had been crashing on every request since the genre consolidation (session 40); failures were silent (email has no talkback yet, others fall back). Fixed by adding `.js` extensions to all 7 relative imports. New Architecture note documents the gotcha. Local typecheck + esbuild had hidden it (bundling inlines the import).
3. **Committed earlier session-43 work** that was left uncommitted (login casing + model-name scrub) as `eccbf56`.
4. **Setup gotcha (resolved live).** First real-email test failed because the Postmark webhook URL had a stray `P` typo'd in front of the secret (`x:P3c81d…` instead of `x:3c81d…`) → 401, silently dropped. Isolated it by simulating the exact Postmark POST against our endpoint (it dedup-skipped a known film → proved the pipeline was healthy and the break was in Postmark's auth). Removing the `P` fixed it. Lesson: when capture silently does nothing, check the Postmark Activity log / webhook URL auth first — the endpoint failing closed returns 401, not an error the user sees.

### Session 43 (2026-06-21) — new-user audit, casing/model-name fixes, security deep-dive

Editorial audit through a "new user with great taste" lens + an option-B manual security deep-dive of all 17 `api/` endpoints. Two small fixes shipped; everything else logged for next session (see "⭐ Review next time" and "🔐 Security audit" near the top).

1. **Audit #1 — login casing fixed.** `LoginScreen.tsx` was the only Title Case surface ("Nospaces" / "Your personal taste library"); now lowercase to match the all-lowercase design constant.
2. **Audit #2 — model names scrubbed from UI.** "Sonnet" → "ai" in `AddScreen.tsx` (sonnet-prompt copy + button + PickerSheet fallback). "Claude's knowledge" → "nospaces" in Discover — fixed at the source: the `api/recommend-feeds.ts` prompt instructed the model to emit `["Claude's knowledge"]` (two spots), plus the `normaliseSources` frontend fallback. Cached discover results may show the old label until the 48h TTL expires.
3. **Audit #3–#7 logged, not fixed** — Discover dead-ends without a taste profile; ragged Discover cover sizes (72 vs 56/84); "the gap" needs a label; empty-library insult line (Farah's call); the catalog-miss interstitial is an extra step (kept as a deliberate cost gate).
4. **Security deep-dive logged** — headline: `api/email.ts` is a spoofable, un-rate-limited inbound webhook (next session's #1). Plus rate-limit gaps on 7 paid endpoints, SSRF via custom feed URLs, and the documented unauth `lookup` proxy. Verified-clean list recorded too.
5. **No code fixes** for #3–#7 or any security item this session — all deferred to a fresh session with clean context.

### Session 42 (2026-06-21) — HANDOFF ↔ code reconciliation

Docs-only pass: audited HANDOFF against the actual code and fixed every mismatch. No code changed.

1. **Taste-page stats drift resolved** — confirmed via git (`216e6ca`) that the old 3-section stats page was **deliberately removed**, not lost. Rewrote the flag + the stale roadmap entries that still described medium pills / reaction breakdown / verdict counts / effort axis. Current page is correct as documented.
2. **Verdict list corrected** — HANDOFF said "9 verdicts" and omitted `stuck with me`; code has 10.
3. **Key files api list completed** — was 10 endpoints, actually 17 + `_genres.ts`/`_ratelimit.ts` helpers. Added the missing ones.
4. **Added API auth + rate-limiting architecture note** — `api/_ratelimit.ts` (used by every endpoint, `check_rate_limit()` RPC) was undocumented.
5. **`typecheck` comment fixed** — now runs two passes (src + `tsconfig.api.json`).
6. **Verified accurate, left as-is** — 54 tests/6 files, models (sonnet-4-5 + haiku-4-5), all vibe lists, both discover flags (still real: taste-profile hard-gate + uneven cover sizes).

### Session 41 (2026-06-21) — fresh audit + library header / view / filter overhaul

Started with an open-ended editorial+tech audit, then Farah picked the library header to work on. All shipped to `main` (deployed live).

0. **Fresh app audit** — flagged: library header was the heaviest surface (4 control rows before content); discover gating + uneven covers; taste-page stats drift (see Flagged above). Header chosen as the session's focus.
1. **Library header declutter (A + D)** — *A (consolidate):* top row is now `library · [view ▾] ⌕ ⋯`. The `view ▾` sheet absorbs list/grid + column count (removed the duplicate cols toggle); new `⋯` overflow sheet holds help me decide · how to use · tidy (when gaps) · select. *D (collapse-on-scroll):* scrolling into the collection folds away the title row + view control; category + status tabs pin, with `⌕ ⋯` tucked inline. Hysteresis dead-zone (collapse >56px, expand <16px). Switching category/status resets scroll + re-expands so a short result set can't strand the header. `LibraryScreen.tsx` + `ViewSheet.tsx`.
2. **View sheet reorder + compaction** — layout (list/grid) + columns moved to the top as primary controls; sort options became compact single-line rows (dropped the tall per-row hint descriptions + dividers); added a "tap the selected sort again to reverse" footnote.
3. **Views trimmed 7 → 4** — kept `recent · by year · by creator · a → z`. Cut "recently edited" (no browsing use), "want to / done" (redundant with status tabs), "by rating" (overlaps reaction chips). Removed dead `groupByStatus` + its grouping branch. Guarded persisted `view` against old removed values so an old localStorage value can't index a missing config.
4. **Multi-select filter sheet** — vibe/verdict/genre/series now accept multiple selections: OR within a group, AND across groups (faceted). State moved string|null → string[]; chips toggle on/off; `filter · N` counts total selected tags. Category + status stay single-select (top-level nav). `LibraryScreen.tsx` (FilterSheet/FilterSection).

### Session 40 (2026-06-21) — tsconfig api typecheck, TV auto-status, taste page ratings

0. **Genre vocab consolidation** — added `cookbook` to books, then discovered the vocab was duplicated across 5 api files (not the "4 copies" the handoff claimed — and `wiki.ts` had none). Several copies (`recommend`, `email`) had silently drifted into reduced subsets, and the sync guard only checked 3. Consolidated to a single `api/_genres.ts` imported by all api endpoints; only 2 copies remain (src + api shared); updated `check-genres.mjs` accordingly. `recommend`/`email` now use the full vocab.
1. **api/ typecheck (quick win)** — new `tsconfig.api.json` (Node types + DOM lib to mirror Vercel's environment, avoiding undici `.json()→unknown` false positives). Added to `npm run typecheck` (`tsc && tsc -p tsconfig.api.json`) and the Stop hook so api TS errors surface locally before deploy.
2. **TV auto-status** — ticking/unticking seasons now keeps status honest. `editItem` accepts `status`/`date_done`; `onSetSeasons` in `LibraryScreen` demotes a **done** show to **in_progress** when not all aired seasons are watched, and nudges a **want_to** show to **in_progress** once the first season is ticked. Auto-populated season lists (TVmaze) don't trigger this — only explicit user toggles persist via `onSetSeasons`.
3. **Desert island gallery fixes** (`TasteScreen.tsx`) — (a) tiles were mismatched sizes across media (music 1:1 vs film/book/tv 2:3); now uniform 1:1 squares with `objectPosition:top` for posters (matches the library "all" grid pattern). (b) Section is now collapsible — header is a toggle button with item count + chevron, defaults open.
4. **Taste profile takes ratings seriously** — the AI prose previously only received loved+liked items and treated private notes as primary evidence, so commentary outweighed ratings. Now `TasteScreen` sends the full rated spectrum; `api/taste-profile.ts` groups items by reaction (LOVED → liked → eh → not-for-me, per-bucket caps) and the prompt makes the **rating the primary signal**: anchor on loved, use rejections as the boundary of taste, and never let a heavily-annotated lower-rated item overshadow a loved one. Still requires ≥1 positive to generate.

### Session 38 (2026-06-05) — Review inbox redesign, vibe seeding fixes, small UX polish

1. **Review inbox redesign** — filing buttons simplified to 3: **want to** (keeps as want_to), **mark as done** (reveals inline reaction chips), **discard** (triggers confirm dialog then deletes). Old confusing layout (keep·want to + all 4 reactions + separate mark-as-done/delete buttons) replaced. `ItemActionSheet.tsx` + `LibraryScreen.tsx`.
2. **Save-and-next for review inbox** — filing any inbox item now auto-advances to the next review item (queue built lazily on first open, frozen to sort order at that moment). End of queue shows "🥂 inbox cleared" toast. Mirrors the existing tidy-queue pattern.
3. **Decade label fix** — "by year" group headers were showing `2020S` (CSS `text-transform:uppercase` was uppercasing the `s`). Now renders `2020s` using a `textTransform:lowercase` span on the trailing `s`. `LibraryScreen.tsx`.
4. **Tidy button hidden when clean** — "tidy · N" link in library header now only renders when `gapCount > 0`. Previously always visible (ghosted when 0). `LibraryScreen.tsx`.
5. **Vibe auto-seed fix (edit view)** — `editMoods` was only seeded at mount; async vibe fetch that arrived after mount was never reflected. Added `useEffect` keyed on `unconfirmedVibesKey` to merge arriving vibes into `editMoods`. `ItemActionSheet.tsx`.
6. **Vibe auto-seed fix (reaction view)** — same race on `selectedMoods` in the mark-reaction view. Same fix applied. `ItemActionSheet.tsx`.

### Session 37 (2026-06-05) — Security fixes, discover redesign, no-repeat recs

1. **React error boundary** — `src/components/ErrorBoundary.tsx` wrapped at app root in `main.tsx`. Unhandled component throws now show an in-app error screen instead of a blank page.
2. **`window.open` noopener** — Spotify + Wikipedia quick-links in `LibraryScreen` now pass `'noopener,noreferrer'` as third arg.
3. **`console.log` guard** — both logs in `AddScreen.tsx` wrapped in `import.meta.env.DEV`. Gone from production builds.
4. **`alert()` → toast** — bulk duplicate removal in `LibraryScreen` now shows a fixed-position ink chip that auto-dismisses after 3s.
5. **Input length cap** — `api/identify.ts` slices `input` to 2000 chars before sending to Claude.
6. **Hardcoded emails removed** — `api/email.ts` fails closed (empty allowlist + console warning) if `ALLOWED_EMAILS` env var is missing. **Set `ALLOWED_EMAILS=farahmokhtar94@gmail.com,tom.effland@gmail.com` in Vercel.**
7. **Discover editorial redesign** — `ResultRow`: covers 44→56/72px, title 14→15px, blurb 12→13px with 1.7 line-height, save is now an ink pill. Redundant "MEDIA" label removed. Farah flagged it still needs more work — revisit next session.
8. **No-repeat recommendations** — `seenDiscoverTitles` accumulated in user prefs (cap 150). Passed to `/api/recommend-feeds` as `ALREADY RECOMMENDED IN PAST SESSIONS` exclusion block. Prevents repeats across sessions and cache refreshes.
9. **Vercel TS fixes** — `api/_ratelimit.ts` RPC cast to `any`; `api/recommend-feeds.ts` raw AI response typed as `Record<string,unknown>` before mapping to `DiscoveryResult`. Both were pre-existing, caught by Vercel's stricter compiler.

### Session 35 (2026-06-05) — App audit + library UX overhaul

1. **Full app audit** — two-lens review: editorial designer (would you pay for this?) + independent tech auditor (systems, security, functionality). Produced a ranked improvement list of 18 items now in "Next session" above.
2. **Library default view** — changed from list+recent to grid+year (decade headers). Rationale: grid is a collection, list is a log; year/decade shows taste range vs. recency as feed.
3. **Dynamic category tab order** — tabs now sorted by item count from actual library data, most-used type first, "all" moved to last. Avoids imposing a medium hierarchy (films > books etc.) that may not match the user's collection.
4. **Grid aspect ratio fix** — "all" mode uses uniform 1:1 square tiles with `object-position:top` for non-music covers (preserves faces/titles). Single-medium grids keep native ratios (2:3 film/book/tv, 1:1 music).
5. **List thumbnail size** — 42px → 52px.

### Session 34 (2026-06-05) — Offline capture queue, describe-by-recency film/TV, canon chip fix

1. **Canon chip reorder + inline icon** — reaction row now: `not for me · eh · liked it · loved it | canon`. Hairline divider before canon. Diamond glyph inline with text (was stacked above).
2. **Offline capture queue** — `src/lib/offlineQueue.ts` (IndexedDB) + `src/hooks/useOfflineSync.ts`. `addItem` checks `navigator.onLine`; if offline, enqueues to IndexedDB instead of calling Supabase. On reconnect, `useOfflineSync` flushes the queue. Banner in `App.tsx` shows pending count + syncing/synced state. "Save as note" is the cleanest offline path (no API calls). Main submit falls back to queued plain-title save with an offline-aware error message.
3. **Describe-by-recency for film/TV** — `tmdbByPerson()` in `api/lookup.ts`. Recency queries now resolve person by name via TMDB `/search/person`, pull `combined_credits`, sort newest-first. Director/Writer crew credits carry person as creator; cast credits fill in for actors. Falls back to plain `tmdb()` if no person found. Matches the existing music (`itunesByArtist`) and books (`openLibraryByAuthor`) pattern.
4. **Offline library cache** — parked. Full offline-first requires queuing mutations (markDone, edits, deletes); disproportionate scope. Revisit if offline usage becomes a real pattern.

### Session 33 (2026-06-05) — Discover polish, mark-done redesign, bug fixes, roadmap

1. **"Not interested" dismiss on discover** — dismiss button per result row; dismissed titles persisted to `user_prefs.dismissedDiscoverTitles`. Filtered client-side in `filterResults`.
2. **Discover UX polish** — "shows near you" moved to top as prominent full-width dark button; `MEDIA` section label above type tabs; refresh button moved inline on both `IN TASTE` and `DIVERT` section headers (date + refresh on same line); removed top-level refresh from page header.
3. **Shows back nav** — back button on `/shows` now returns to `/discover` instead of `/library`.
4. **Mark-done redesign (both sheets)** — `MarkDoneSheet` and `ItemActionSheet` reaction view both updated: single row of 5 equal chips (loved it · liked it · ◇ canon · eh · not for me). The bug was that the main mark-done path goes through `ItemActionSheet`, not `MarkDoneSheet` directly.
5. **Canon filter removed** — `◆ canon` filter chip removed from library header. Canon visible as `◆` marker on items and on the taste page.
6. **Type downgrade fix** — `identifyIntoEdit()` in `ItemActionSheet` no longer sets type to `"other"` from AI identify results. "other" means Sonnet couldn't identify the item — not that the type changed. Prevents obscure items being silently downgraded.
7. **Descriptive library search** — built then shelved. AI applied too many filters simultaneously; intersections too narrow. Filter sheet covers the use case.
8. **Roadmap decisions** — individual songs: shelved (album model correct, songs would bloat library). Letterboxd diary: shelved (cosmetic dates + schema complexity for repeat views). Bandsintown: not yet applied, approval odds low, apply passively. Offline capture queue + describe-by-recency → next session priorities.

### Session 32 (2026-06-05) — Discover UX, tidy fix, decade headers

1. **"Shows near you" moved to discover tab** — removed from music filter row in LibraryScreen; now appears as a "shows near you / browse →" row above sources in DiscoverScreen.
2. **Tidy queue end-of-queue bug fixed** — last item's "save & next" was navigating to `/add`; now closes the sheet and returns to library. Button label on final item changed to "save & finish".
3. **Decade section headers in by-year view** — "by year" sort now groups into decade buckets (2020s, 1990s, etc.) using the existing section header rendering. Items without a year land under "unknown".
4. **Roadmap decisions** — "not interested" on discover: build it (UX value, no AI signal). Want-to priority: parked (adds clutter, help-me-decide covers the acute case).

### Session 31 (2026-06-05) — Stats section refinement

1. **Genre love rate** — replaced "what you reach for" (frequency-based tag lists per reaction bucket) with "where your taste is clearest": genres ranked by % loved (min 3 rated items). Shows actual affinity, not just what you watch a lot of. Bolded when ≥60% loved. Respects medium filter.
2. **Verdict counts** — added `(N)` after each verdict label. Now shows "comfort (8) · hyperfixation (3)" instead of a flat unweighted list.
3. **Effort axis removed** — signal was too sparse (almost no items tagged "easy"/"demanding") and misled more than it informed.

### Session 30 (2026-06-05) — Taste page rebuild + new verdict

1. **New verdict: "stuck with me"** — added to `VERDICTS` in `src/lib/moods.ts` between "delivers" and "respect, not love". For things that weren't immediately enjoyable but lingered.
2. **Taste page rebuild** — `TasteScreen.tsx` restructured into three sections:
   - **① Identity** (unchanged) — vibe ranked line + "rarely lands" + AI prose.
   - **② Stats** (new) — medium filter pills (`all · films · books · music · tv`) controlling: lede ("X things · Y% loved"), "what you reach for" reaction breakdown grid (per reaction tier: top genre+vibe tags by frequency), "verdicts" (frequency-ranked verdict tendencies), "effort" (easy ←→ demanding dot bar derived from vibe tags on loved+liked items; hidden if < 3 signal items).
   - **③ By medium** (collapsible) — film/book/music/tv each as a collapsed row; header shows rated count + loved % + canon count; expands to show canon tiles + top creators + top genres.
   - **Era map removed.** Replaced by regions (parked — needs creator nationality data).

### Session 29 (2026-06-05) — Genre sync guard + dev automation plan

1. **Genre sync guard** — `scripts/check-genres.mjs` diffs the three copies of the genre vocab (`src/lib/genres.ts`, `api/genres.ts`, `api/identify.ts`) and exits 1 if any are out of sync. Wired as `.git/hooks/pre-commit` — blocks commits when copies diverge. Run manually: `node scripts/check-genres.mjs`.
2. **Session-length Stop hook** — `scripts/check-session-length.sh` counts numbered items in the current session block in HANDOFF.md; injects a "good stopping point" system message when ≥ 4 items shipped. Fires after every Claude turn.
3. **moods.ts → guide reminder** — Stop hook regex extended to also fire when `src/lib/moods.ts` is touched (new verdicts/vibes require updating the guide's reaction section).
4. **Typecheck on Stop** — `tsc --noEmit` added to Stop hook; injects system message on any `error TS` output.
5. **HANDOFF.md staleness warning** — `scripts/check-handoff-staleness.sh` added to Stop hook; fires when screens/key components change but HANDOFF.md is not updated this session.

### Session 28 (2026-06-05) — Filter bar, how-to guide, guide hook

1. **Filter bar declutter** — 4 dropdown buttons (vibe / verdict / genre / series) replaced with a single "filter ▾" button. Active-count badge ("filter · N"). Tapping opens a `FilterSheet` bottom sheet with pill chips per group; "clear all" when any active. `DropdownButton` + `DropdownMenu` components removed.
2. **"How to use" page** (`/guide`) — 5-section guide at `/guide` with inline CSS illustrations matching current UI. Entry points: `?` in library header (always) + "how to use →" in empty-library state.
   - Section 01: saving things — 3 numbered paths (type / photo / email), each with full description text inside the illustration. "nospaces finds it and fills in the details" as a bold footer. Letterboxd + Spotify as extras.
   - Section 02: logging a reaction — illustration matches current `MarkDoneSheet` layout (loved/liked → full-width canon → eh/not for me → vibe chips). Canon tip here. In progress + note as extras.
   - Section 03: your library — illustration shows current filter bar + thumbnail rows. Data gaps + series as extras (series: no TV seasons).
   - Section 04: discover — shows actual `ResultRow` layout (cover + "via [source]" + italic why blurb + save). No vibe chips (not a real feature — noted for roadmap).
   - Section 05: taste — shows real taste page (vibe chip hero + `CategoryCard` with canon tiles + ranked genres).
   - "A few more things" block removed — redistributed as per-section extras.
3. **Guide auto-reminder hook** — `Stop` hook in `.claude/settings.local.json`. Fires when any `src/screens/` or `ItemActionSheet`/`MarkDoneSheet` file was touched; displays: *"guide reminder: screens or key components changed this session — does /guide need updating?"*

### Session 27 (2026-06-05) — Help me decide, data gaps fixes, action card polish

1. **"Help me decide"** — new screen at `/decide`. Three-step decision tree: seen before? → type → vibe. Filters want-to (new) or done (revisit) pool client-side. 2–3 shuffled picks, reshuffable. Entry: inline link in library header title row. Zero API cost.
2. **Wiki gap false positives** — two bugs fixed: (a) `ItemActionSheet` fetched wiki but never saved `metadata.wikiUrl` — added auto-save effect mirroring `ItemRow`. (b) Fill-auto counters (`needsWiki`, `needsRuntime`, `untagged`) didn't respect `dismissedGaps` — now all derived from `itemGaps()`.
3. **Action card link reorder** — `about this` now first after edit, `own it` moved to last.
4. **Series dropdown** — native `<select>` populated from existing series in library. "+ new series…" option reveals a text input. Works on mobile (replaced broken `<datalist>`).
5. **Tidy mode highlights** — in tidy-queue flow, missing fields show red border + red label. "More details" section auto-expands when runtime/pages/wiki are among the gaps.
6. **Roadmap grouped thematically** — near/medium/long-term items now organised by theme (Library UX, Action card, Data quality, Taste & stats, etc.).

### Session 26 (2026-06-05) — Nav overhaul, add screen, wiki fix, transitions

1. **Tom's login** — confirmed already working (was already a test user). Phase 4 complete.
2. **Wiki match correctness** — title guard (`const guarded = true`) now applies to film/TV, not just book/music. Prevents wrong Wikipedia articles being saved. Existing bad matches: re-identify case-by-case.
3. **Page transitions** — fade + 6px lift, 180ms, on all route changes. CSS keyframe in `index.css`, wrapper div with `key={location.pathname}` in `App.tsx`.
4. **Nav restructure** — add tab removed; FAB (ink circle, bottom-right, above nav) replaces it. Nav is now library → taste → discover. FAB hides on `/add`.
5. **Add screen streamlined** — no heading; tighter textarea + button; photo + note as compact utility row; "other ways to add" always visible (no toggle); library tools removed entirely.
6. **Library tools → GapsSheet** — batch auto-fill (genre, runtime/pages, mood migration, wiki, art refresh) moved into the tidy sheet as a "fill automatically" section above the individual gap items. Art refresh now only flags covers genuinely below 300px (checks URL patterns per source).

### Session 25 (2026-06-05) — Canon, duplicates UX, data-gaps nav

1. **Canon status** — `metadata.canon` flag. Toggle in reaction view as full-width 5th row between positive and negative reactions. `◆` on list rows + grid cards. `◆ canon` filter chip. Canon section on taste page per medium (cover tiles, no cap). "on my shelf" label for books instead of "own it".
2. **Duplicates UX** — "added first (Mon YYYY)" label on original entry in review sheet. App palette applied.
3. **Data-gaps nav** — `GapsSheet` bottom sheet accessible from Library header ("tidy · N" — always visible, ghosted when no gaps). Fill-by-hand list removed from Add page. Auto-fill tools remain.

### Session 24 (2026-06-05) — Music verdicts, edit view, cover art

1. **Verdict overhaul** — dropped "would revisit"; added "hyperfixation", "in rotation", "unfinished business". MOOD_REMAP updated. Run "clean up" in library tools to migrate existing items.
2. **Edit view tightening** — removed WHAT IT IS / TAGS headings; runtime/pages moved to more details.
3. **Cover art resolution** — TMDB w185→w342, Open Library -M→-L, Wikipedia 160→500px. Refresh tool in library tools.

### Session 23 (2026-06-05) — Vibe/verdict UX overhaul

Vibe/verdict library filter split into separate dropdowns. Unconfirmed vibes pre-populated on mark-done sheet. Verdict starts open by default on first mark-done. "add a verdict →" routes to reaction view. Collapsible MoodChips in reaction flow. Labels: feel→vibe, how it landed→verdict. × alignment fixed.

### Sessions 1–22 (2026-06-02 to 2026-06-04) — Foundation

All core features built: library, add screen, action card, taste page, Spotify sync, Letterboxd import, email capture, Discover feed, vibe/verdict taxonomy, shows near you, data-gaps tidy queue, wiki auto-fill via Wikidata, AI vibes at add time, for-review inbox, testing foundation (Vitest + CI). See git log for full history.

---

## Working style

- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted.
- Flag good moments to start a fresh chat (long sessions = expensive).
