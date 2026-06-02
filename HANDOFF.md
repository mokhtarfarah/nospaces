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

**Talkback** (code live, not yet active): replies to sender with what was saved. To activate:
1. Wait for Postmark DKIM to go green (Return-Path ✅, DKIM still propagating as of 2026-06-02)
2. Add `POSTMARK_SERVER_TOKEN` to Vercel env vars → redeploy
3. Postmark account approval request submitted 2026-06-02 (needed to send to gmail)

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
1. **Spotify** — OAuth, listening history, saved albums.
2. ✅ **Letterboxd** — CSV import live. See "Letterboxd import" section above.

### 🃏 Action card
1. **Mark done / edit reaction inline** — not just via row action sheet.
2. **Fix notes display** — show note below blurb, user-friendly format.
3. **Design polish** — first pass done; needs user eye on real covers.
4. **Manual link** — paste Wikipedia/URL to fix wrong cover/blurb. Store in `metadata.wikiUrl`.
5. **"Want to reread/rewatch" button** — `metadata.revisit` boolean; label adapts by type; Revisit filter chip.

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
