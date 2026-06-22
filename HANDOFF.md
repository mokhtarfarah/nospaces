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

**Last session (50):** recovered a Claude Code branch Farah ran **on her phone** (`desert-island-form-redesign`, never merged). It added **bare-link email capture** (forward a naked URL → fetch its page metadata → identify the item; no new API cost). Before merging I **SSRF-hardened** it — the mobile code fetched attacker-controllable email-body URLs server-side with no guard — by extracting the existing feed guard into shared `api/_ssrf.ts` and routing both `email.ts` + `recommend-feeds.ts` through it. Merged to main (`61ddd55`); **bare-link path not verified end-to-end** (needs a real inbound email — Farah to forward one bare link after redeploy). The branch's "desert island display rethink" note is parked in `docs/ROADMAP.md` and folds into the Discover redesign below.

**Still open from session 49's list:** **#6, a "failed email captures" feed on the review page** — a feature, deferred to its own session. Plus session 49's five bug fixes are **unverified on the live app** (port held + login wall) — confirm on phone.

---

## ▶ Next session — Discover full redesign (START WITH A DESIGN CONVO)

After ~2 weeks of real use, Farah's verdict: Discover **still isn't right or compelling** — not a polish problem, a concept problem. So this is no longer the small #3 on-ramp fix; it's a **ground-up rethink of the whole Discover page.** The new-user dead-end (#3 below) is *one* symptom, but don't treat fixing it as the goal.

**Do NOT open by editing code.** Start with a design conversation: what is Discover *for*, what makes it compelling enough to open unprompted, what it should show someone with no taste profile yet. Land the concept first, then build.

Known symptoms to feed into that convo:
- **#3 — dead-ends for new users.** No taste profile = the whole page is a wall ("go to the taste page first"), and the taste page needs rated items first. The most exciting feature is gated behind two prerequisites with no on-ramp. (`DiscoverScreen.tsx:84,202`)
- The session-48 redesign (bigger covers, blurb hero, ink save chip, no-repeat) shipped but didn't make it land — so bigger/prettier isn't the answer.

**Carry in the mobile desert-island ideas (session 50, parked in `docs/ROADMAP.md`).** Farah felt the taste page's 3-column desert-island grid doesn't match the weight of the concept. Display options floated on her phone: (1) horizontal scroll strips by category, (2) **full-width stacked cards with cover + reason text — her tentative pick**, (3) numbered editorial list, (4) dense cover mosaic / tap-to-reveal, (5) swipeable single-item cards. **Bigger idea also raised: delete the taste tab entirely and make the library the primary entry point**, with desert-island as a pinned/filtered view inside it. This overlaps the Discover rethink (both ask "is the taste page even the right shape?") — treat them as one design problem, not two. Decide the *concept* before any display option.

**Also still open (smaller, not this redesign):**
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a decision step mid-flow. Kept deliberately as a cost gate (identify is a paid Sonnet call). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)

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
