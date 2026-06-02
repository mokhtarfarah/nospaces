# Nospaces — Handoff

## App
Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

## North star (read before every design call)
Nospaces is a **one-stop media library + taste-tracking / curation source** — Farah's single source of truth for everything she's watched, read, listened to, and wants to. The whole point: **see all my media easily, at a glance, including on the go.**

Design mentality: **clean, easy, productive, sleek/editorial.** Every UX and feature choice serves "at a glance + low friction." Claude should proactively suggest tweaks that push toward this (and flag things that fight it). When in doubt, favor clarity and calm over more options.

## Stack
React + TypeScript + Vite PWA · Supabase (okxuzqqzqpuyepgiskqp) · Google OAuth · Anthropic claude-sonnet-4-5 · Vercel · Postmark inbound (nospaces.xyz) · Repo: github.com/mokhtarfarah/nospaces

## Local dev
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces && npm run dev  # localhost:5173
```

## Key files
- `src/screens/LibraryScreen.tsx` — library UI
- `src/screens/AddScreen.tsx` — add screen (AI, photo, shortcut)
- `src/screens/ImportScreen.tsx` — Letterboxd CSV import
- `src/lib/letterboxd.ts` — Letterboxd parsing + mapping logic (pure, unit-tested)
- `src/components/{MarkDoneSheet,ItemActionSheet,ConfirmSheet,ViewSheet}.tsx`
- `src/hooks/{useItems,useAuth}.tsx`
- `api/{identify,email,art,blurb,lookup,watch}.ts`
- `src/lib/{artwork,blurb,wikipedia,seasons}.ts`
- `supabase/schema.sql`

## Vercel env vars
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side, email API)
- `POSTMARK_SERVER_TOKEN` — **needed to activate email talkback** (get from Postmark → Servers → API Tokens). Not set yet → talkback silently no-ops, saving still works.
- `POSTMARK_FROM` — optional reply-from override (e.g. `Nospaces <hello@nospaces.xyz>`)

## Email capture
Forward anything to `anything@nospaces.xyz` from an allowed address. AI finds every media item + saves as `want_to`. Photo attachments (incl. HEIC) work.

**Big photo attachments don't work via email (by design, 2026-06-02).** Vercel caps inbound requests at 4.5MB (hard limit, not configurable); Postmark always inlines the full attachment; Gmail can't shrink attachments. So a full-res photo email → HTTP 413, whole email rejected (all-or-nothing). Text/newsletters and small screenshots always work. **For big photos use the in-app "Add from a photo" button** — it now downscales to 1600px/JPEG client-side (`prepareImage` in AddScreen.tsx), so it always fits, runs faster, and handles HEIC. No email re-architecture planned.

**Talkback** (code live, not yet active): replies to sender with what was saved. To activate:
1. Get Postmark DKIM to go green — **see DKIM fix below** (Return-Path ✅, MX ✅, DKIM blocked)
2. Add `POSTMARK_SERVER_TOKEN` to Vercel env vars → redeploy
3. Postmark account approval request submitted 2026-06-02 (needed to send to gmail)

### DKIM not propagating — root cause found 2026-06-02
DKIM wasn't slow, it was **blocked**. Porkbun has a **wildcard CNAME** (`*.nospaces.xyz → pixie.porkbun.com`, their URL-forwarding/parking). It intercepts the DKIM lookup (`*._domainkey.nospaces.xyz`) and answers with parking junk, so Postmark never sees the signing key. Confirmed: a made-up subdomain still resolves to pixie.porkbun.com. MX (`inbound.postmarkapp.com`) and Return-Path (`pm-bounces → pm.mtasv.net`) work because they have explicit records that override the wildcard.
**Fix:** In Porkbun DNS, (1) delete the wildcard `*` record, (2) add Postmark's exact DKIM record (hostname + `k=rsa;p=...` value from Postmark → Sending → Domains → nospaces.xyz → DKIM). Then DKIM goes green.

**Status as of 2026-06-02:** ✅ Wildcard deleted. ✅ DKIM TXT record added clean — selector `20260602022450pm._domainkey`, exactly one record, value matches Postmark char-for-char (an earlier attempt had a duplicate + a `0`-for-`O` typo, both fixed; verified via `dig`). ⏳ **But Postmark still shows DKIM "Unverified"** — likely just DNS propagation (Postmark says up to 48h, auto-rechecks). **TODO: check Postmark → Sending → Domains → nospaces.xyz later; it should flip to green on its own.** Return-Path already ✅ verified. Talkback reply needs BOTH this DKIM green AND Postmark account approval (still pending) before replies land.
**To re-check the DNS record anytime:** `dig +short 20260602022450pm._domainkey.nospaces.xyz TXT` (should return exactly one `k=rsa;...` line containing `SaMgQ1OJ2eY` with a capital O).

## Spotify sync (built 2026-06-02, needs dev-app credentials to go live)
Add screen → "Sync from Spotify" → `/spotify`. Pulls your **Saved Albums** on demand (no background sync).
- **Fully client-side OAuth** (Authorization Code + PKCE). No Client Secret, no server function, no token storage. `src/lib/spotify.ts` (logic) + `src/screens/SpotifyScreen.tsx` (UI, mirrors ImportScreen).
- **Status rule:** first ever sync → all albums as `want_to` (backlog to triage). Every sync after → only *newly saved* albums, as `done` (no reaction; Farah adds her own). Detected by whether any `source_detail==='spotify'` item already exists.
- Deduped vs existing music by title+artist key AND by `metadata.spotifyId`.
- Stored as `type:'music'`, `source:'manual'`, `source_detail:'spotify'`, `metadata.{spotifyId,spotifyUrl,coverUrl}`. Posters resolve via `/api/art` (Deezer/iTunes) at display time.

**To activate (Farah's 2-min setup):**
1. developer.spotify.com → Dashboard → Create app. Name anything. **Redirect URIs:** add `https://nospaces.vercel.app/spotify` and (for local dev) `http://127.0.0.1:5173/spotify` (Spotify rejects `localhost` now — use 127.0.0.1). API: Web API.
2. Copy the **Client ID** → add `VITE_SPOTIFY_CLIENT_ID` to Vercel env vars → redeploy. (No secret needed — PKCE.)
3. App is in "development mode" by default — allows up to 25 users; add Farah + Tom under Settings → User Management. Plenty for now.
- Local testing: open the app at `http://127.0.0.1:5173` (not localhost) so the redirect URI matches.

## iOS Shortcut (flaky)
Share screenshot → POST to `/api/identify-upload` → copy URL to clipboard → open app → tap "From Shortcut" → paste → confirm. Clipboard sometimes empty on second run.

## Letterboxd import (built 2026-06-02, not yet tested with real export)
Add screen → "Import from Letterboxd" → `/import`. Upload `watchlist.csv`, `watched.csv`, `ratings.csv` from Letterboxd Settings → Data → Export (all three at once is fine). Detected by filename.
- `ratings.csv` → `done` + reaction: 5★ → loved it, 4/4.5★ → liked it, 3/3.5★ → eh, ≤2★ → not for me (half-stars round to nearest)
- `watched.csv` → `done`, no reaction
- `watchlist.csv` → `want_to`
- Deduped vs existing films (title+year); rated > watched > watchlist when a film appears in multiple files
- Stored as `type:film`, `source:'manual'`, `source_detail:'letterboxd'`, `metadata.letterboxdRating`
- Posters/blurbs resolve via `/api/art` at display time — nothing extra to do

**Next:** Farah tests with her real export. No public Letterboxd API exists for sync — CSV is the only path.

## TODO / Roadmap (last edited 2026-06-02)

### 📥 Seamless capture
1. **Mark-as-done at identify time** — log done + reaction in 1 step on confirm page (not 2).
2. **Bulk picture upload** — pick many photos → AI runs each → batch confirm/save.
3. **Manual source field** — set where an item came from (person/site/newsletter). Decide where it surfaces.
4. **Music / songs** — today albums-only. Figure out adding individual songs + cleanest flow.
5. **Descriptive queries** (designed, not built): "rosalía latest album" → AI returns intent {creator, type, ordinal}; server resolves via live catalog (Deezer for music, TMDB for film/TV). Implement in `api/identify.ts`.
6. **Screenshot shortcut reliability** — clipboard flow flaky. Improve or retire.
7. **Photo-blurb / OCR** — snap back cover → Claude reads blurb → save.

### 🎬 Integrations
1. ✅ **Spotify** — saved-albums sync live (built 2026-06-02). See "Spotify sync" section above. Still TODO/v2: top artists/tracks "insights" view, ongoing auto-sync, individual songs.
2. ✅ **Letterboxd** — CSV import live. See "Letterboxd import" section above.

### 🃏 Action card
1. **Mark done / edit reaction inline** — not just via row action sheet.
2. **Fix notes display** — show note below blurb, user-friendly format.
3. **Design polish** — first pass done; needs user eye on real covers.
4. **Manual link** — paste Wikipedia/URL to fix wrong cover/blurb. Store in `metadata.wikiUrl`.
5. **"Want to reread/rewatch" button** — `metadata.revisit` boolean; label adapts by type; Revisit filter chip.
6. **Manual cover art edit** — let user override the auto-picked cover (paste image URL or pick from candidates). Store in `metadata.coverUrl`; display layer prefers it over auto-resolved art. (added 2026-06-02)

### 🔗 Wikipedia coverage (added 2026-06-02)
- **Push harder on Wikipedia links.** Many films that *should* have a Wikipedia page don't get one linked. Improve `src/lib/wikipedia.ts` resolution — better title+year matching, fallback queries (drop "The", try original title, disambiguation by media type), and backfill existing items missing a link. Wikipedia link is core to the "one source of truth" north star.

### 📚 Content / types
1. **Book & movie series** — group like TV seasons.
2. **Magazines / articles** — new media type(s).
3. **TV season ratings** — per-season, not just whole show.

### 🔀 Sort & filter
1. **Recently edited** sort option.
2. **By year** ascending + descending.
3. ✅ **Split "want to" / "done"** — "Want to / Done" view mode added 2026-06-02.
4. **Subtitle extras** — pages/runtime, added date, source, who added.

### 🎨 Polish
1. **All lowercase** UI experiment.
2. **Letterboxd source label** — small "from Letterboxd" badge in the action card for imported items (`source_detail === 'letterboxd'`). Helps spot anything that imported wrong.
3. **Dedup after Letterboxd import** — title+year dedup catches exact matches, but slight title variants (e.g. "Anatomy of a Fall" vs "The Anatomy of a Fall") can slip through. Worth running the existing remove-duplicates tool after first import.
4. **Remove-duplicates: show before deleting** (added 2026-06-02) — today `removeDuplicates()` in `src/hooks/useItems.ts` auto-deletes by a scoring heuristic (done > note/reaction > earliest). Farah wants it to **surface the duplicate groups for case-by-case review** (see which items it considers dupes, pick what to keep) instead of silently deleting. Build a review sheet/preview before the delete.

### 🌱 Bigger / later
- Genre/mood tags + trend analysis
- Recommendations from trusted sources
- Tom's login (publish Google OAuth consent screen)
- Optional multi-category select (long-press)
- **`diary.csv` rewatches** — Letterboxd diary has per-watch dates and logs repeat viewings. Not imported yet. Relevant if Farah wants rewatch history.
- **Descriptive queries for films** — "rosalía latest album" style intent resolution already in roadmap; same pattern applies to films via TMDB.

### 🧹 Cleanup (ongoing)
Security + dead code. Check RLS, auth, exposed keys periodically.

## Working style reminders (for Claude)
- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted (prod deploys, data changes, subtle bugs).
- Flag good moments to start a fresh chat (long sessions = expensive).
- Suggest Sonnet for routine work, Opus for gnarly debugging / architecture.
