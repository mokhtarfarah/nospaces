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

**Session 104 — Postmark approved → talkback LIVE; shipped email undo link + fixed an email-in hallucination bug.** Postmark approved the account (unblocks talkback + the paid 10k plan); Farah confirmed talkback works (got a confirmation email). Two bugs surfaced in that first live test: (1) a **book-cover screenshot bounced back** — undiagnosed, needs logs; (2) emailing bare "**Yesteryear** + Caro Claire Burke" (a 2025 *book*) saved it as **music with a hallucinated album blurb**, because `EMAIL_PROMPT` told the model to fill fields "from your own knowledge" and it confidently guessed. **Shipped (green gate — tsc + api tsc + eslint + 126 tests, NOT yet committed/pushed):** an **undo link** in every "saved" talkback reply (`api/_undo.ts` HMAC token + `api/undo.ts`; GET confirm-page → POST deletes, so link-prefetch can't auto-delete; scoped to signed user+ids); and an **anti-hallucination prompt fix** (don't invent a medium/blurb for unrecognized titles → mark `low` → land in review; never default "Title by Name" to music). **Then s105 root-caused the s104 screenshot bounce:** emailed screenshots were being silently dropped because the image filter hard-excluded **inline** images (ContentID set) as "shop decoration" — but iOS Mail / Gmail send a pasted screenshot inline, so every one got binned before vision. Fixed (dropped the inline exclusion; weight + count gates still guard decoration) + added a raw-attachment diagnostic log. Both s104 + s105 pushed to `main` (`9895392` + the s105 commit), full green gate. **s105 fix NOT yet verified live** — resend a book-cover screenshot after deploy; expect `raw attachments: 1` then a save. Full detail → archive (s104, s105). *(Prior: s103 — "how it fits" tone retune, still awaiting Farah's live re-read.)*

## ▶ Next session (105) — commit s104, verify the undo link + hallucination fix live, chase the screenshot bounce

**⚠️ FIRST — the s104 work is NOT committed/pushed.** Review the diff (`api/_undo.ts`, `api/undo.ts`, `api/email.ts`, `src/lib/undo.test.ts` + docs), then commit + push to `main`. Gate is green locally.

**Then verify on the deploy (real email):**
1. **Undo link** — forward something, get the "saved" reply, tap the undo link → confirm page appears → tap the button → item is gone from the app. (GET must NOT delete on its own; only the POST button should.)
2. **Hallucination fix** — email a bare obscure "title + author" like the Yesteryear case → it should NOT save as music with a fake blurb; it should land in the **review inbox** (low confidence), typed sensibly (book, not music).
3. **Emailed screenshot save (s105 fix, unverified)** — resend a book-cover screenshot. Check the Vercel `/api/email` log for the new `[email] raw attachments: N [...]` line: expect **N ≥ 1** (was 0 — inline images were being dropped), then a normal media/board save + reply. If it's STILL 0, the raw log now shows whether Postmark even sent the attachment (→ Postmark-side, not our code).
4. **Confirm the 10k Postmark plan is bought** — approval unblocked it; talkback ≈ 2 emails/capture, free plan = 100/mo.

**Still carried from s103:** read the s103 "how it fits" tone retune on real items (pushed `aff8108`, unverified). Reads are **cached on `metadata.tasteFit`** — Farah must tap **"re-read"** per item. Check openers all differ (no "Squarely your board"), bags stay pure aesthetic, tee/dresses make a fit call not a variable, no "try it on to confirm" endings. If good, mark s103 confirmed in the archive.

**Also still carried:** the ~8 junk board cards from the old email bug (s100) may still be there — check she deleted them. *(Dependency/Dependabot cleanup is now DONE — s101.)* **One open Dependabot PR is expected + intentional:** the `major-updates` group PR (batches react 19, react-router 7, vite/vitest majors) — the new config's parked "majors" bucket. Leave it; those are deliberate own-session upgrades (`docs/ROADMAP.md`), not noise.

**First: re-look at the music-library "iPod collection" reframe** (`docs/ROADMAP.md` → "Media library polish"). Farah confirmed the direction "generally" but **isn't 100% — she wants to look again before any build.** The core idea: the music clutter is **want-to bleeding into the collection**; split *collection (the iPod, done — browse by artist, naturally curated)* from *queue (want-to)* by default. Sub-asks already locked: verdict "shelves" = one added view *inside* the collection (not default); by-artist view sortable by **# of albums saved**. Open layout step: *how* the queue sits beside the collection (leaning: a `to listen · N` chip atop music) + whether it generalizes past music. Confirm the framing with her, then it's a free frontend build.

**Still open — `★ desert island` read-sheet placement (untouched s94).** The line sits flush-left and breaks the genre/vibe/verdict label-column grid (see `docs/ROADMAP.md`, "Desert-island read-sheet placement"). A quick frontend tweak whenever — and note the s94 "thoughts" block just moved to the *quiet 10px muted label* style, so match the desert-island line to that same label family when you place it.

**Also still worth a check:** the s89 **pull-from-link fix** — screenshot a product, add a link, edit → does "pull photo & price" now appear and **swap the screenshot for the clean shop photo**? (Only fires on *newly* screenshot-saved products — the `imageFromShot` flag isn't backfilled onto older ones.)

**Email-in is UNBLOCKED (Postmark approved, s104).** Talkback is live; the email screenshot path + the email-driven `for review · N` inbox are now testable. Watch the Postmark quota (≈2 emails/capture, free plan = 100/mo — confirm the 10k plan is bought). Detail → `docs/REFERENCE.md` → Postmark plan.

**Open question carried over:** "find online ↗" lives on the product *sheet*, not the card tiles — open whether Farah wants it on the tiles too (`docs/ROADMAP.md`).

**New for-discussion (Farah, s96) — want-to priority list.** Farah wants to revisit pinning/tiering the backlog (was a parked "smaller idea"). No decision yet — weigh the original park worries first (clutter on every row; help-me-decide + search already cover the acute case; cuts against the calm UI). Leaning: a "next up" **sort/filter** over a per-row tier, to keep rows clean. Detail + open questions → `docs/ROADMAP.md` → "Want-to priority list".

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
