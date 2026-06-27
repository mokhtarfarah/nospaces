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

**Session 87 — the screenshot-capture feature shipped (all 5 parts), on `main` pending Farah's eyeball. 98 Vitest green + typecheck + lint clean.** Built the whole locked spec in one session: **(1)** emailed NON-inline screenshots get one Sonnet vision read (`classifyEmailImage`) that routes **product→board / media→library** + pulls fields/look-tags in the same call; the save@ link still wins *if it yields a product*, else a screenshot rescues it. **(2)** **confidence-gated review** — `review = bulk(>1) || low-confidence` (was a blanket flag on all forwards); single confident captures land live; board gets a `for review · N` chip mirroring the Library's. **(3)** **media↔thing flip** (`src/lib/flip.ts` + 7 tests) — "actually media" picker in the ProductSheet, "actually a thing" in the ItemActionSheet; flipping clears review. **(4)** **"find online ↗"** on the ProductSheet (free google-search from brand+title) for linkless screenshot saves. **(5)** failure copy nudges "screenshot it and send that." Only new cost: ~1¢ vision per emailed screenshot. Full detail → archive (s87). *(Prior: s86 capture-failure fixes + the now-built spec; s85 library header/filter overhaul.)*

**Session 87 (cont.) — in-app screenshot capture + product-isolation crop + add-flow restructure.** After the email path got blocked (Postmark), shipped the **in-app "screenshot a shop page"** capture (no Postmark), then on Farah's feedback: a **product-isolation crop** (vision returns a bbox → crop the screenshot to just the product so the card matches the clean tiles) and **Build A** — folded screenshot into the one "save a product" card + an "add to a plan?" selector (standalone / existing plan / new plan). Decisions locked for next: media Add → a card/sheet (Build B); search = just match the look; standalone text-note thing = skip. Full detail → archive (s87).

## ▶ Next session (88) — Build B (media Add → card), then verify on phone

**Build B — convert the media `AddScreen` (a full-page route) into a bottom-sheet card** like the Things product composer (`ProductComposer`), so adding media doesn't feel like navigating away. The search/identify logic stays; it's a presentation refactor (wrap it in the `Sheet`, match the chrome). Decided with Farah this session. *Start fresh — it's self-contained, and the s87 chat ran long.*

**Then verify on a real phone** (the in-app capture now has the crop + plan attachment): screenshot a Farfetch/miista product via "save a product → screenshot a shop page" → does it isolate the product cleanly (not the whole page)? does the plan selector file it right? If a crop is off for some shop, the bbox prompt in `readProductFromImage` (`api/_vision.ts`) is the knob.

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
