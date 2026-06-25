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

**Session 81 — holistic first-impression pass + cold-start/coherence ship, on `main` (latest `d2c20cc`). 93 Vitest green, typecheck + eslint + build clean.** Read the app end-to-end from source, Farah fed screenshots in batches; delivered a first-time-user review + audit, then shipped the safe fixes: **warmer empty states** (dropped the "you loser" line, kept a wink), a blurred **locked preview** on the empty taste page, a **visible media/things switcher** (underlined inactive side), **Things chrome lowercased to one voice**, the **cover reaction badge** (smiley = loved / ✓ = done) replacing the undecodable dot, the **deciding-card grid cover** restored (overlaid title; a no-options plan now reads as a question, not a broken image), and **"wishlist"** as the board's single name. **Farah verified the badges + deciding card live — good.** The coherence audit reshaped the medium-term roadmap into one **"what feeds the taste read"** cluster + a **"vary the AI voice by surface"** item. Full detail → archive (s81).

---

## ▶ Next session (82) — open: pick from the restructured roadmap

No fixed queue. The s81 holistic pass reshaped the medium-term work in `docs/ROADMAP.md`. Two natural next moves:
- **Vary the AI voice by surface** — ungated, cheap, can go first. One shared humanizer base → a per-surface register (warm on taste, terse on discover, decisive on compare). While there, confirm `api/things-taste.ts` / `things-compare.ts` import the humanizer base.
- **"What feeds the taste read"** — the consolidated design decision (self-defined taste + Things-taste reframe + beauty/home exclusion + a "got it"→worth-it signal). **Gated:** decide the feedback loop *with Farah first*, honouring the "saving is the signal" soul rule. No code until decided.

**Still awaiting an eyeball (behind login):** the **mood masonry** (s80) — gapless + newest-first, and whether the column-shuffle as images load is distracting (`docs/ROADMAP.md` → "Awaiting Farah's eyeball"). (s81's badges + deciding card are verified and done.)

**For-discussion (parked, in `docs/ROADMAP.md` → "Media library polish"):** scroll-lock stickiness (needs a switcher-accessibility call); music-library clutter (pair with the verdict reshape).

**Carried:** the capture pain points (iOS share-shortcut email path, image-share, paywalled-article extraction — own session); scraper-403 fingerprint wants a real-world check (does a previously-403 shop read now?).

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
