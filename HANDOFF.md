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

## ▶ Next session (88) — eyeball s87 on a real phone, then pick up the backlog

**The screenshot feature is compile-verified only — the noauth preview is empty, so the interactive bits are UNVERIFIED.** First, eyeball with real captures on the phone:
- **Email a screenshot of a walled shop (Farfetch/miista) to save@** → does it land on the board with look-tags? Email a **poster/book-cover screenshot** → does it land in the library?
- **The flip** — open a board product → "actually media" → pick a type → does it move to the library (and vice-versa from a media item)?
- **Review inbox** — does a low-confidence capture show under the board's `for review · N` chip? Does "looks right" clear it? Does the ProductSheet review banner read well?
- **"find online ↗"** — on a linkless product, does the title link to a working Google search? **Decision for Farah:** I put it on the *sheet*, not the card tiles (her spec said "cards") — see `docs/ROADMAP.md` → Screenshot-capture follow-ups. Want it on the tiles too?
- **Reply copy** — a single confident forward should say "Saved to your library", not "for review".

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
