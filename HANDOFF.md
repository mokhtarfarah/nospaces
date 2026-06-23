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

**This session (66) — built "Things" Slice 1: the attribute model + the pure "thread" reader (free).** On branch **`things-slice-1`** off freshly-synced `main`. **$0** — no `api/` touch, no Anthropic call. Shipped: `Attribute = {facet, value}` tags (material/palette/form/category/priceTier) as **flat free-text, not a frozen enum** (vocab grows from real saves — couldn't query the live DB, so built the machinery not the taxonomy); `readThread(items)` pure reader → recurring-attribute read like `muted · wool · structured`, returns null below 4 tagged items (**14 Vitest cases, full suite 70/70 green**, typecheck clean); `AttributesEditor` capture UI in `FieldsForm` + a tiny per-card read so tagging is visible. **Live masthead deliberately deferred to Slice 2.** Then, same session, **pulled Slice 3 (domain switcher) forward** — Farah hit the temp setup leaking things into the media library. Now: top-level `Media / Things` toggle (`DomainSwitcher`) on every primary screen, temp 4th nav tab gone, things filtered out of media library/taste/discover, board is its own world (own capture, no media nav/FAB). Then **Slice 2 masthead** (`ThreadMasthead` — the board reads back the recurring thread; comparison table dropped as unnecessary). All shipped straight to `main` (no more feature branches — Farah's call).

**Last session (65):** Built "Things" Slice 0 — gut-check PASSED, merged to `main` via PR #16. Free `api/og-parse.ts` reader · board with both capture paths · intent→candidates→★→pick deliberation loop · edit/manual `FieldsForm` · sale price · opt-in AI Compare (`api/things-compare.ts`, Haiku ~$0.001/tap) + plan brief. _(The s65 archive entry was lost when PR #16 cut one commit short at `fbbadb9`; recovered into `main` afterward — see archive s65.)_

---

## ▶ Next session (67)

**First: Supabase preview-auth fix** must be applied once (`https://*.vercel.app/**` in Redirect URLs) or preview testing stays broken — see memory `preview-auth-redirect`. (Slices 1 + 3 are already on `main` — committing direct, no branches.)

**Main job: Slice 4 — first PAID surface in Things.** Sonnet **vision** attribute-read for photo/link-image capture (reads material/palette/form/category off an image, not identity). **State exact per-call cost before building** — Compare already proved the paid plumbing. This is the natural unlock now that tagging exists: vision fills the tags the masthead reads, so the board mirrors you without manual tagging.

**(Slices 1–3 + the Slice 2 masthead all DONE s66, on `main`.)** Slice 1 = attribute model + `readThread`. Slice 3 = domain switcher + leak fix. Slice 2 = the `ThreadMasthead` on the board (≥4 tagged → "muted · wool · structured"; below → gentle nudge). **The comparison-table-along-axes was dropped** (Farah: "doesn't feel necessary").

**⚠️ First-run reality:** the masthead only lights up once items are *tagged*, and Farah's 3 existing saves are untagged — so it shows the "tag a few (0/4)" nudge until she tags them. By design, not a bug. Slice 4's vision read is what makes tagging effortless.

**Carried from s66 (Slice 1 — check on live preview, don't rebuild):** the `AttributesEditor` (facet chips + free text) in product/candidate add+edit, and the per-card attribute read. The reader is fully unit-tested but the **editor UI was never clicked through live** (preview behind Google auth) — eyeball it once merged + preview-auth fixed. Watch: is `FieldsForm` getting crowded now that it carries fields + sale price + taste tags?

**Carried from s65 (Slice 0 — check, don't rebuild):** board, deliberation loop, edit/manual fallback, sale price, AI Compare voice + plan brief. Slice 0 passed the gut check. Watch: does Compare still read human on real items? Is the plan sheet busy?

**Key model facts:** all on existing `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`; `metadata.attributes[]` (`{facet,value}`) is the composition engine; `reaction` stays null; resolve = `done` + winner flag, **no archive** (losers persist).

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
