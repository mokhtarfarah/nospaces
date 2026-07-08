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

Personal PWA taste library for Farah + Tom (films, books, music, TV) **+ a Things side** (shopping / wishlist). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.** Things is the active workstream.

**Session 107 — 3 of 5 s106 nits shipped + pushed to `main` (live).** Farah confirmed s106's two live-unverified items (Things review discard; taste-read anti-hallucination fix — "seems better"). Then, on `ThingsScreen.tsx` + `Sheet.tsx`: (1) the **cramped product sheet**, fixed for real after two failed nudges — the sheet now scrolls as one continuous page (photo included, like a shopping-app product screen) instead of pinning a fixed-height header over a tiny leftover scroll region; close/⋯ controls moved to a sticky spacer so they stay reachable through the whole scroll (verified in a throwaway repro before touching the real app — this was the third attempt at this element). Also shrank the title and made taste tags opt-in, folded into the existing credit line (zero extra lines collapsed, one line expanded) after a "no extraneous text" note from Farah. **Confirmed working live** ("product card looks better"). (2) A **roomy/compact density toggle** on the Things board grid — took two bugs to get right (first attempt had zero effect on mobile specifically; fixed so compact is always guaranteed at least one more column than roomy at any width) — **confirmed working live**. Media's own grid-3/grid-4 toggle was relabeled to match the same terminology. (3) **"Add to a plan →"** on a standalone product's ⋯ menu — attaches it to an existing/new plan, deletes the standalone copy — **worked first try**. **Held back:** the 4th s106 nit, a closed Things-category list, needs the actual list decided with Farah first — not built. Also hit and resolved a **PWA login-loop glitch** (stale service-worker cache from the session's several deploys, not a code bug — force-quit + reopen fixed it). Full blow-by-blow → archive (s107, three entries — the road there had real dead ends, worth reading if this UI needs touching again).

## ▶ Next session (108) — no fixed queue; pick from below

**Session 108 so far — 2 quick fixes shipped + pushed to `main` (live):** (1) the **desert-island read-sheet line** now gets the same label-column treatment as vibe/verdict (★ in the label slot, "desert island" in the content slot) instead of sitting flush-left and breaking the grid. (2) **Things categories are now a closed list** — decided with Farah: clothing (outerwear, dresses & jumpsuits, bottoms, tops, shoes, bags, jewelry), home (furniture, lighting, decor, kitchenware, appliances), beauty (skincare, makeup, fragrance), + other. Root cause was the vision prompt saying category was "not limited to the list" — fixed there (now a strict enum) plus the tag-editor UI (grouped pick-one chips, no free text) plus a synonym map that folds old sprawled values (fabric/material sample/coat/bag/etc.) onto the new list at read time — no backend migration needed. Farah's also planning to start saving home + beauty items now that the categories exist for them.

**Do first (housekeeping):**
- **Confirm the 10k Postmark plan is bought.** Approval unblocked it; talkback ≈ 2 emails/capture and the free plan is only 100/mo, so real use will blow the cap fast. Detail → `docs/REFERENCE.md` → Postmark plan.

**Still open from s106 (full detail in `docs/ROADMAP.md`):**
- **Header/footer nav reconciliation** — nav is split between top header and bottom bar inconsistently; rethink the model, discuss with Farah first (→ Media library polish, next to the bottom-nav items).

**Settled, not open:** tags-as-a-third-tab (alongside note/how-it-fits) was considered and declined this session — leave the credit-line placement alone unless discoverability becomes a real complaint again (s107 archive has the reasoning).

**Still carried from s103:** read the s103 "how it fits" tone retune on real items (pushed `aff8108`, unverified). Reads are **cached on `metadata.tasteFit`** — Farah must tap **"re-read"** per item. Check openers all differ (no "Squarely your board"), bags stay pure aesthetic, tee/dresses make a fit call not a variable, no "try it on to confirm" endings. If good, mark s103 confirmed in the archive.

**Also still carried:** the ~8 junk board cards from the old email bug (s100) may still be there — check she deleted them. *(Dependency/Dependabot cleanup is now DONE — s101.)* **One open Dependabot PR is expected + intentional:** the `major-updates` group PR (batches react 19, react-router 7, vite/vitest majors) — the new config's parked "majors" bucket. Leave it; those are deliberate own-session upgrades (`docs/ROADMAP.md`), not noise.

**First: re-look at the music-library "iPod collection" reframe** (`docs/ROADMAP.md` → "Media library polish"). Farah confirmed the direction "generally" but **isn't 100% — she wants to look again before any build.** The core idea: the music clutter is **want-to bleeding into the collection**; split *collection (the iPod, done — browse by artist, naturally curated)* from *queue (want-to)* by default. Sub-asks already locked: verdict "shelves" = one added view *inside* the collection (not default); by-artist view sortable by **# of albums saved**. Open layout step: *how* the queue sits beside the collection (leaning: a `to listen · N` chip atop music) + whether it generalizes past music. Confirm the framing with her, then it's a free frontend build.

**Also still worth a check:** the s89 **pull-from-link fix** — screenshot a product, add a link, edit → does "pull photo & price" now appear and **swap the screenshot for the clean shop photo**? (Only fires on *newly* screenshot-saved products — the `imageFromShot` flag isn't backfilled onto older ones.)

**Email-in is fully working (Postmark approved, s104–105).** Talkback replies + undo link + the email screenshot path are all live and tested end-to-end. Only open item is the Postmark quota (the 10k-plan check above). Detail → `docs/REFERENCE.md` → Postmark plan.

**Open question carried over:** "find online ↗" lives on the product *sheet*, not the card tiles — open whether Farah wants it on the tiles too (`docs/ROADMAP.md`).

**New for-discussion (Farah, s96) — want-to priority list.** Farah wants to revisit pinning/tiering the backlog (was a parked "smaller idea"). No decision yet — weigh the original park worries first (clutter on every row; help-me-decide + search already cover the acute case; cuts against the calm UI). Leaning: a "next up" **sort/filter** over a per-row tier, to keep rows clean. Detail + open questions → `docs/ROADMAP.md` → "Want-to priority list".

No fixed queue. The big remaining taste item is gated on a decision with Farah:
- **"What feeds the taste read"** — the consolidated design decision (self-defined taste + Things-taste reframe + beauty/home exclusion + a "got it"→worth-it signal). **Gated:** decide the feedback loop *with Farah first*, honouring the "saving is the signal" soul rule. No code until decided.

Ungated alternatives if she's not ready to decide the above: the **user-guide overhaul** (stale + media-only — split into media/things tabs, refresh screenshots; own session, free); the **capture pain points** (iOS share-shortcut email path, image-share, paywalled-article extraction — own session, mostly free); or the **scraper-403 fingerprint** real-world check (does a previously-403 shop read now?).

**Newly unblocked (in `docs/ROADMAP.md` → "Media library polish"):** the **"all" de-confusion** — hide per-medium tag filters when category is "all" + default "all" to recency (decided s85, just needs a session); and **filter tag-search** (idea 3, *after* the s85 counts land if `show all` lists still feel long). **For-discussion (parked, same section):** scroll-lock stickiness (recheck after the s85 nav merge); music-library clutter (pair with the verdict reshape).

**Things model facts:** all on `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`|`inspiration` (mood-board image); `metadata.attributes[]` (`{facet,value}`) is the composition engine; a promoted plan keeps `metadata.fromPlan` (reversible via `demoteProductToIntent`); resolve = `done` + winner flag, **no archive** (losers persist). The taste read runs over wishlist + mood together (`tasteItems`).

**Don't touch (genuinely good):** decade grouping; the taste page's vibe-headline → prose → gap → always-loved → desert-island arc; the editorial palette; the faithful-creators logic; **the recommendation engine itself.** (All re-confirmed in the s81 review.)

Backlog beyond this → `docs/ROADMAP.md`.

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
