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

**Session 75 — per-item "how this fits your taste" one-liner SHIPPED + a long Things polish pass. All shipped to `main` AND deployed; 89 Vitest green, typecheck + eslint + build clean.** The product sheet now reads how a single item rhymes with the board (`api/things-taste-fit.ts`, Haiku text-only ~$0.001, cached on `metadata.tasteFit`, tap-only, gated). Voice was reworked to read **aesthetically not categorically** + anti-formula after Farah's feedback. Plus: deciding card → compact text box (single-line title); Things list = flat Library-style rows; product sheet narrowed + actions unified to one quiet-link style + a "read taste from photo" recovery; Library view-switcher pinned on scroll; masthead copy de-tagged. Full detail → archive (s75).

---

## ▶ Next session (76)

**FIRST — eyeball the s75 Things polish on the live board** (couldn't drive it live this session — login wall). Specifically: does the **taste-fit voice** read better now (tap **re-read** on a product or two — old cached lines keep the wooden voice until then)? Do the **deciding card**, the **flat list rows**, and the **narrowed product sheet** look right? Farah's open worry: with a clear, narrow aesthetic the taste-fit line could get repetitive fast — watch for that.

**Then build (queued, in order):**
1. **Mood board** — a collection of pure-inspiration images (not purchasable); free (just saved images). Spec it the same way before building.
2. **Taste synthesis for Things** — a 1–2 sentence "what you're reflecting." **Combo of saved items + mood board, but generates from saved alone too** so it starts working as you add items, before any moodboarding. One cheap on-demand Anthropic call (Haiku, cached, never auto-run); mirrors the media Taste page; must import `HUMANIZER_GUARDRAILS`. Reuse `boardTasteSummary()` (new in s75) as the seed. See memory `things-taste-synthesis`.

**Carried (still open):**
- Scraper-403 fingerprint wants a real-world check (does a previously-403 shop read now?).
- New parked items in `docs/ROADMAP.md`: beauty/home/misc products (taste-neutral), the iOS share-to-app Shortcut (email-auto-send path), the media "verdict" reshape.
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
