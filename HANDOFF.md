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

**Session 88 — media Add → card, self-authored style profile, and a deep compare overhaul.** All shipped on `main`, 98 Vitest green + typecheck + lint clean. Build B + style profile were verified on Farah's phone this session; the compare changes were tuned live against her real plans. **Build B:** the full-page `/add` route is now a bottom-sheet composer (`src/components/MediaComposer.tsx`) matching the Things `ProductComposer`; shared `src/components/Sheet.tsx`; FAB opens it instead of routing; legacy `/add` renders the library behind the sheet; old `AddScreen.tsx` gone. **Style profile:** free-text "about you" (aesthetic + body type) — a quiet "style profile ›" link on the Things taste tab → `user_prefs.styleProfile`, fed into `things-compare` + `things-taste-fit` (NOT the editorial board read), gated by item category so body-type advice never lands on a shoe. New `api/_profile.ts`. **Compare overhaul (all in `things-compare`):** never refuses on bot-walled shops (uses saved tags + never punts back); **judges from the product PHOTOS** now, not just text (`fetchImageBase64`, labelled image blocks); 2nd-person voice; shorter, no marketing-restating; `temperature 0.3` + brief-pinned catches for run-to-run consistency; cite-tag/identity-prefix stripping; **result cached** on `IntentMeta.comparison` so it survives reopening the plan. Plus **"pull photo & price from link"** (gap-fill only) when a screenshot product gets a link. Cost: compare ~$0.06–0.12/run (web search + images), opt-in only; everything else free/~free. Crash fix: per-instance Supabase channel topics (`useItems`/`usePrefs`) so the add sheet over the page no longer collides. Full detail → archive (s88). *(Prior: s87 — screenshot-capture feature, all 5 parts; s87 (cont.) — in-app capture + product-isolation crop + Build A.)*

## ▶ Next session (89) — verify remaining s87/s88 on a real phone

**Still unverified on real data** (the noauth preview has no seed items):
- **s88 photo-aware compare:** does feeding the product images actually sharpen the visual reads (silhouette, "reads cute" now grounded)? does the per-instance image fetch ever 403 (then it judges that option from text + says so)?
- **s88 compare cache + pull-from-link:** run a compare, close/reopen the plan → result still there? add a link to a screenshot product → does "pull photo & price" fill only the gaps?
- **s87 in-app capture:** screenshot a Farfetch/miista product via "save a product → screenshot a shop page" → does it isolate the product cleanly? does the plan selector file it right? Crop knob = the bbox prompt in `readProductFromImage` (`api/_vision.ts`).

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
