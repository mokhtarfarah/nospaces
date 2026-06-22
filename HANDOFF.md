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

**Last session (48):** editorial polish — #4 (Discover covers now share a left edge) and #5 (labelled "the gap") shipped. **Next up: a round of input bug + workflow fixes** Farah hit while using the app this week — search not working, identify-with-AI quality, etc. Do that in a fresh session.

---

## ▶ Next session — editorial polish (new-user audit #3–#7)

The work now is making the app feel right to a **first-time user with great taste**. Full audit was done in session 43; #1–#2 shipped then, #4–#5 in session 48. Remaining:

- [ ] **#3 — Discover dead-ends for new users.** No taste profile = the whole page is a wall ("go to the taste page first"), and the taste page needs rated items first. The most exciting feature is gated behind two prerequisites with no on-ramp. **The real one — needs a small design, not just a fix.** (`DiscoverScreen.tsx:84,202`)
- [ ] **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a decision step mid-flow. Was kept deliberately as a cost gate (identify is a paid Sonnet call). **Kept for now** — Farah's call whether to make it automatic. (`AddScreen.tsx:367`)

**#6 (empty-library inside joke) parked** → see `docs/ROADMAP.md`.

**Don't touch (genuinely good):** library header restraint, decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic.

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
