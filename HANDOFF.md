# Nospaces — Handoff

**Read this file at session start.** It's deliberately short. Everything else is split out by how often it changes:

| File | What's in it | When to open it |
|---|---|---|
| **`HANDOFF.md`** (this) | Where we are + what's next | every session |
| `docs/ROADMAP.md` | Open backlog, parked + shelved ideas | picking what to do next |
| `docs/REFERENCE.md` | Stack, env vars, key files, costs, features, architecture, dev hooks | when you need a fact |
| `docs/HANDOFF-archive.md` | Full session-by-session history | rarely — digging up "why did we…" |

---

## 🚦 Where we are

Personal PWA taste library for Farah + Tom (films, books, music, TV). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.**

**This session (65) — built "Things" Slice 0; gut-check PASSED.** First real build of the Things domain (s64 composition-over-reaction design). On branch **`things-slice-0`** (PR open, **not yet merged to `main`**). All on the existing `Item` model — `type:'thing'`, `metadata.kind` (`'product'`|`'intent'`) — **no migration**. Shipped: free `api/og-parse.ts` link reader · the board with both capture paths (save a product / plan a purchase → candidates → ★ leaning → pick) · edit + manual-add fallback (`FieldsForm`) · on-sale "Was" price · **opt-in AI Compare** (`api/things-compare.ts`, Haiku, ~$0.001/tap, first paid surface in Things) · plan **brief** fed into Compare. Farah: "slice 0 passes the gut check — definitely useful." Full detail + decisions → archive (s65).

**Last session (64):** Design-only. Reworked Things around composition-over-reaction (the set is the signal, attributes are the engine), kept intent/candidates first-class. Full detail → archive.

---

## ▶ Next session (66)

**First: merge `things-slice-0` → `main`** if not already done (PR is open; Farah merges). Then **Supabase preview-auth fix** must be applied once (`https://*.vercel.app/**` in Redirect URLs) or preview testing stays broken — see memory `preview-auth-redirect` / s65 archive.

**Main job: Slice 1 — the attribute model + the pure "thread" composition reader.** This is what turns the board from a save-list into a *taste mirror* (the whole point). The design is settled (`docs/ROADMAP.md` → "Expansion beyond media"). Build:
- **`metadata.attributes[]`** on `thing` items: **material** (wool/leather/linen…), **palette** (muted/earth/monochrome…), **form** (oversized/tailored/structured…), price-tier, category. **Vocab waits for real saved items** — don't invent the taxonomy in a vacuum (same lesson as letting the profile wait for real data). Look at what Farah's actually saved on the board first.
- **The "thread" reader** — pure function: recurring attributes across the set → a short aesthetic read ("muted · natural · structured"). +Vitest (free CI gate).
- Then **Slice 2** = board + live masthead (the thread shown from ~6 items) · **Slice 3** = domain switcher (replaces the temp 4th nav tab) · **Slice 4** = the second paid surface (Sonnet **vision** attribute-read for photo/link-image capture — state exact per-call cost before building; Compare already proved the paid-surface plumbing).
- **Deferred to Slice 1:** the **comparison table along axes** Farah asked about — it needs the attribute columns this slice builds. (s65 decision.)

**Carried from s65 (Slice 0 — check on the live preview, don't rebuild):**
- The board, deliberation loop, edit/manual-fallback, sale price, **AI Compare** voice + the plan **brief**. Slice 0 passed the gut check. Watch: does Compare still read human on real items? Is the plan sheet getting busy now that edit/sale/compare/brief all live in it?
- **Key model facts:** all on existing `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`; products carry `{image,price,wasPrice?,brand,siteName,url}`; intents carry `{candidates[],leaning,winner,brief}`; `reaction` stays null; resolve = `done` + winner flag, **no archive** (losers persist).

**Carried from s63 (check, don't rebuild):**
- **Regions** — shipped, browser-direct backfill. Coverage was still filling in via repeated ⋯ → "pull regions". If it's plateaued with a stubborn `failed` count, slow the pull down (lower concurrency / add pacing in `src/lib/regions.ts`). Language axis `P364` parked in ROADMAP.
- **Filter sheet** — trimmed to collapsible sections; confirm it eyeballs right on phone.

**📅 ~2026-07-14 checkpoint — held decision:**
1. **Taste-tab keep-or-fold** — DECIDED s63: *keep the tab*; revisit after real desert-island use. (Reasoning + profile-as-masthead fold sketch → `docs/ROADMAP.md`.)

**Still pending re-check (s57 follow-ups, may already be fine):** Discover blurb titles read upright/distinct; search shows "all" tab highlighted while a query is active.

**Verified earlier — don't re-check:** s56 scroll-restore (cold-kill case) + "new music tuesday"; detail sheet (`SheetHero`); filter-clip bug (session-49 #5).

**Parked from s55:** bigger detail-sheet cover with **real CSS text-wrap** (deferred — body lives outside `SheetHero` + `overflow:hidden` kills wrapping). Page-level **kicker+rule section dividers** (Taste/Library) is a fast-follow if wanted.

**Also still open (smaller, carried from before):**
- **PageHeader 1.5px rule** — if it reads heavy across pages, softer hairline = one-line change in `src/components/PageHeader.tsx`.
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a step mid-flow; kept as a cost gate (paid Sonnet). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)
- **Discover mood chips** — parked, revisit **2026-06-29** after a week of real use. (`docs/ROADMAP.md`)

**Don't touch (genuinely good):** decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic, **the recommendation engine itself.**

Backlog beyond this queue → `docs/ROADMAP.md`.

---

## 🔁 Doc upkeep (the process that keeps this from rotting)

The reason this got messy before: one file did five jobs, history piled up, and the same fact lived in three places (then drifted — session 42 was a whole cleanup). The split above fixes the structure; these rules keep it clean:

1. **One fact, one home.** A status (e.g. "Sentry is live") lives in exactly one file. Elsewhere, link to it — don't restate it.
2. **End of session: log, then prune.** Write the session entry at the **top** of `docs/HANDOFF-archive.md`. If you finished a roadmap item, **delete** it from `docs/ROADMAP.md` (the log is its record — no ✅ graveyard). Update "Where we are" + the Next-session checklist here.
3. **Keep this file one screen.** Session history → archive. Stable facts → reference. Backlog → roadmap. If `HANDOFF.md` is scrolling, something's in the wrong file.
4. **The Stop hooks nudge all of this** (roadmap reminder, handoff staleness/size, guide reminder). They're cues to do the prune, not noise to dismiss. See `docs/REFERENCE.md` → Dev automation.

---

## 🛠️ Working style

- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted.
- Flag good moments to start a fresh chat (long sessions = expensive).
- Two billing systems — the Anthropic API key (pay-per-token, $20/mo cap) is separate from this Claude Code subscription. Never burn more than 2–3 test API calls; web_search is the pricey one. See `docs/REFERENCE.md` → API costs.
