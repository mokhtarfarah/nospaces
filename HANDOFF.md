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

**This session (72) — Things UX overhaul. All on `main`, 85 Vitest green, typecheck + eslint clean. NOT runtime-verified — the board + plan sheets are behind Google auth, so it all wants Farah's eye on the deploy.** Highlights: undo a decision (**put back in plan** + **change my mind — keep deciding**), **plan→saved always auto-tags** (+ non-silent no-photo case), **gallery-style product detail** (image hero, quiet `view at <brand> ↗` actions, `$3,600` price formatting, descriptor tag line), **image auto-trim** (`src/lib/imageTrim.ts` — crops product out of its whitespace; replaced the ambient blur fill), **two-section board** (deciding strip ↑ / saved grid ↓, got-it hidden), unified plan edit, dropped the density toggle, fixed the "shows near you" back nav. Full detail + decisions → archive (s72).

---

## ▶ Next session (73)

**Everything from s72 needs Farah's eyeball on the live deploy (behind auth).** Her standing feedback for tomorrow:
- **`DecidingCard` needs polish** — the labelled-box direction is right, the execution isn't finished.
- **Images still wonky** — off-centre on some, soft when zoomed on a few. Limits are the heuristic + source resolution + CORS (the client trim only runs where a shop allows pixel reads; elsewhere it falls back to a plain cover-crop). **If it keeps annoying, the robust fix is to move the trim server-side** — where we already fetch images for vision (bypasses CORS, and we can pull higher-res).

**Then build (queued, in order):**
1. **Mood board** — a collection of pure-inspiration images (not purchasable); free (just saved images). Spec it the same way before building.
2. **Taste synthesis for Things** — a 1–2 sentence "what you're reflecting." **Combo of saved items + mood board, but generates from saved alone too** so it starts working as you add items, before any moodboarding. One cheap on-demand Anthropic call (Haiku, cached, never auto-run); mirrors the media Taste page; must import `HUMANIZER_GUARDRAILS`. See memory `things-taste-synthesis`.

**Carried (still open):**
- Scraper-403 fingerprint wants a real-world check (does a previously-403 shop read now?).
- **Things model facts:** all on `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`; `metadata.attributes[]` (`{facet,value}`) is the composition engine; a promoted plan keeps `metadata.fromPlan` (reversible via `demoteProductToIntent`); resolve = `done` + winner flag, **no archive** (losers persist).

**Don't touch (genuinely good):** decade grouping; the taste page's vibe-headline → prose → gap → always-loved → desert-island arc; the editorial palette; the faithful-creators logic; **the recommendation engine itself.**

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
