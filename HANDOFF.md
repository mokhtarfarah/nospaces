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

**This session (53):** **BUILT the entire Discover redesign** (session-52 locked spec, all 8 items). Discover is now type-first stacked sections (films → music → books → tv, top 3 + "more →"), a **mood search bar** (new `mood` param on `recommend-feeds` — one paid Sonnet call/search, works with no profile), a single **for you ⇄ further afield** toggle, **free static editorial cold-start** (`src/lib/editorialPicks.ts`) instead of the no-profile wall, and 2-line-clamped blurbs. "shows near you" moved into the Library music view; "decide for me" promoted to a Library status-row chip (out of the `⋯` menu). Engine untouched. typecheck + lint + 56 tests + production build all clean. **Not screenshotted — app is behind Google OAuth, the preview can't sign in, so the redesign is UNVERIFIED in a signed-in browser.**

**Last session (52):** Discover redesign design conversation (spec locked, no code) + re-fixed session-49 #2/#5 (PWA-only, unverified on phone). Full detail → archive.

---

## ▶ Next session — VERIFY the Discover redesign, then the small open items

The Discover redesign is **built but only verified up to the auth wall** (typecheck/lint/tests/build clean; no signed-in screenshot). First job:

1. **Eyeball the rebuilt Discover signed-in** (deployed or local `npm run dev` with Farah's login). Check, as a first-time user with taste: type-first sections render + look right; **mood search** returns sensible picks (costs one paid Sonnet call — test 1–2 times max); **for you ⇄ further afield** toggle works (further-afield still opt-in); **cold-start editorial picks** show for a no-profile state and read as a respectable first impression (curated list is in `src/lib/editorialPicks.ts` — swap any picks that feel off); blurbs clamp to 2 lines + expand on tap. In Library: **"shows near you"** appears only in the music view; **"decide for me"** chip works and is gone from the `⋯` menu.

**Also still open (smaller):**
- **Session-49 #2 (scroll restore) + #5 (filter clip)** — re-fixed session 52, **unverified on phone** (both PWA-only). Re-test on the deployed build.
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a step mid-flow; kept as a cost gate (paid Sonnet). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)
- **Discover mood chips** — parked, revisit **2026-06-29** after a week of real use of the rebuilt Discover. (`docs/ROADMAP.md`)

**Don't touch (genuinely good):** library header restraint, decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic, **the recommendation engine itself.**

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
