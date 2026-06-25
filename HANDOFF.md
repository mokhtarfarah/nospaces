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

**Session 74 — AI image cutout + board polish + product-card value-add. All shipped to `main` AND deployed; 85 Vitest green, typecheck + eslint + build clean. Farah ran the Supabase SQL, re-polished, reviewed live — looks good.** Products are now AI-subject-cutouts trimmed-to-fill, floated on one **cool-gray** tile (`TILE #ECEDEF`); model/lifestyle shots fill the tile edge-to-edge. The product card earned a job: **tappable taste tags** (tap → filter the board, "· N" match count), a **"why you saved it" note**, and a unified italic note style (`NoteProse`, matches the taste page) used on Things + the media Library. Card capped to the photo's width. Cutout backfill/override + strict person⇒onModel vision. Full detail → archive (s74).

---

## ▶ Next session (75)

**TOP — build the per-item "how this fits your taste" one-liner.** The last piece of the product-card value-add, deliberately deferred because it's the only part that costs anything. On the product sheet, a one-line read of how the item rhymes with the board (e.g. *"leans into your structured, monochrome streak — a touch dressier than usual"*). **Cheap Haiku, cached per item** (store on `metadata.tasteFit` so it's ~1¢ once, NOT per card-open — never auto-run on every open). Must import `HUMANIZER_GUARDRAILS`. Fold it into the same voice/work as the queued Things taste-synthesis (memory `things-taste-synthesis`) — they're the same muscle (item-level vs board-level). State cost before building.

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
