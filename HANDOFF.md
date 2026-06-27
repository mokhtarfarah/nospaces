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

**Session 88 — Build B (media Add → bottom-sheet card) + self-authored style profile.** Both shipped on `main`, 98 Vitest green + typecheck + lint clean, verified in preview (pending Farah's phone eyeball). **Build B:** the full-page `/add` route is now a bottom-sheet composer (`src/components/MediaComposer.tsx`) matching the Things `ProductComposer`; sheet chrome extracted to `src/components/Sheet.tsx`; the FAB opens it instead of routing; legacy `/add` still works (renders the library behind the sheet); old `AddScreen.tsx` deleted. **Style profile (Farah's idea):** a free-text "about you" (aesthetic + body type) in the Things taste tab (`StyleProfileBlock` → `user_prefs.styleProfile`), fed into `things-compare` + `things-taste-fit` (NOT the editorial board read; body type is a fit constraint, not aesthetic). New `api/_profile.ts`. Free / ~free (no new AI calls). Full detail → archive (s88). *(Prior: s87 — screenshot-capture feature, all 5 parts; s87 (cont.) — in-app capture + product-isolation crop + Build A add-flow restructure.)*

## ▶ Next session (89) — verify s87+s88 on a real phone

**Verify on a real phone** (nothing below is verified on real data — the noauth preview has no seed items):
- **s87 in-app capture:** screenshot a Farfetch/miista product via "save a product → screenshot a shop page" → does it isolate the product cleanly (not the whole page)? does the plan selector file it right? If a crop is off for a shop, the bbox prompt in `readProductFromImage` (`api/_vision.ts`) is the knob.
- **s88 Build B:** does the media + FAB open the add card over each page nicely on iOS (safe-area, keyboard)?
- **s88 style profile:** fill it in, then run a real **compare** on a plan with 2+ options + a **per-item "how it fits"** — does the read actually speak to your body type/fit? (This is the one live-AI check not yet done — costs ~$0.05–0.10 for the compare's web search.) Tune wording in `api/_profile.ts` if it parrots the profile back.

### Other open items

**⛔ Email-in testing is PARKED.** Postmark hit its 100/mo free cap AND won't let Farah buy the 10k plan until they **approve the account** (same approval that gates talkback). So the *email* screenshot path + the email-driven `for review · N` inbox (in-app saves land live, no gate) wait for approval (Farah pays for 10k then). Don't propose emailing screenshots until then. Detail → `docs/REFERENCE.md` → Postmark plan.

**Also testable now on existing items:** the **flip** (board product → "actually media" → type → library, and back via "actually a thing"); **"find online ↗"** on a linkless product (title → Google search — I put it on the *sheet*, not the card tiles; open whether Farah wants it on tiles too).

Also still open from s85/s84: eyeball the **filter tray / tag counts / recency re-sort** (preview was empty then too); the Things `full`-caption trim (keep the taste/material line or strip to name+price+brand?). After that:

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
