# Nospaces — Handoff

## App
Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

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
Forward anything to `anything@nospaces.xyz` from an allowed address. AI finds every media item + saves as `want_to`. Photo attachments (incl. HEIC) work as of 2026-06-02.

**Talkback** (code live, not yet active): replies to sender with what was saved. To activate:
1. Wait for Postmark DKIM to go green (Return-Path ✅, DKIM still propagating as of 2026-06-02)
2. Add `POSTMARK_SERVER_TOKEN` to Vercel env vars → redeploy
3. Postmark account approval request submitted 2026-06-02 (needed to send to gmail)

## iOS Shortcut (flaky)
Share screenshot → POST to `/api/identify-upload` → copy URL to clipboard → open app → tap "From Shortcut" → paste → confirm. Clipboard sometimes empty on second run.

## TODO / Roadmap (last edited 2026-06-02)

### 🚨 Quick fixes
1. ✅ Email picture upload broken — fixed 2026-06-02 (HEIC conversion, media-type normalization)
2. ✅ iOS zoom-on-type — fixed 2026-06-02 (bumped all text inputs/textareas to font-size 16).
3. ✅ Revert scroll position after editing action card — fixed 2026-06-02 (edits do a silent refetch in `useItems`, list stays mounted).

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
2. **Letterboxd** — one-time CSV import and/or sync.

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
3. **Split "want to" / "done"** under each category.
4. **Subtitle extras** — pages/runtime, added date, source, who added.

### 🎨 Polish
1. **All lowercase** UI experiment.
2. ✅ Where-to-watch → text-only provider links (logos removed 2026-06-02 for a cleaner look).
3. ✅ Remove-duplicates banner. (Block-on-save optional.)

### 🌱 Bigger / later
- Genre/mood tags + trend analysis
- Recommendations from trusted sources
- Tom's login (publish Google OAuth consent screen)
- Optional multi-category select (long-press)
- Bulk import with reactions + done status

### 🧹 Cleanup (ongoing)
Security + dead code. Check RLS, auth, exposed keys periodically.

## Working style reminders (for Claude)
- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted (prod deploys, data changes, subtle bugs).
- Flag good moments to start a fresh chat (long sessions = expensive).
- Suggest Sonnet for routine work, Opus for gnarly debugging / architecture.
