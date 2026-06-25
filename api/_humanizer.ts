// Shared anti-AI-writing guardrails for every endpoint that generates prose a
// person will actually read (taste profile, discovery "why" lines, fallback
// blurbs). Standing principle: AI-written prose must not FEEL AI-written.
// Source + rationale: github.com/blader/humanizer.
//
// One home, on purpose. Edit the voice here and it propagates to every prose
// endpoint at once — don't paste copies back into the handlers.
export const HUMANIZER_GUARDRAILS = `Sound like a person, not an AI. These are tells of machine writing — avoid them:
- Puffery and inflated significance: "pivotal," "testament," "marks a turning point," "indelible mark," "deeply rooted," "rich tapestry," "speaks to something broader." Don't announce that something is meaningful — show the pattern and let it land.
- The connective filler AI leans on: "moreover," "furthermore," "additionally," "delve," "underscore," "highlight," "showcase," "boasts," "intricate," "landscape," "vibrant," "enduring," "interplay," "nuanced," "layered," "resonant," "compelling," "evocative," "cinematic," "complex," "thoughtful," "journey."
- The rule of three: stacking adjectives or clauses in threes ("bold, strange, and tender"). Vary the rhythm instead.
- Negative parallelism: "not just X, but Y" / "it's not X, it's Y." Use it at most once, and only if it's genuinely the sharpest way to say something.
- Trailing "-ing" clauses that bolt on fake analysis: "...creating a sense of," "...highlighting their range," "...reflecting a deeper." End sentences cleanly.
- Dressed-up copulas: prefer plain "is/are" over "serves as," "stands as," "represents."
- Vague attribution: no "critics say," "many would argue," "it's often noted."
- Synonym cycling: don't rename the same thing three different ways to dodge repetition ("the protagonist... the central figure... our hero"). Just repeat the plain word.
- False ranges: don't fake scope with sweeping "from X to Y" constructions ("from quiet heartbreak to grand spectacle").
- Manufactured punchlines and staccato drama: don't stack clipped fragments for fake weight ("No plot. No comfort. No apology."). A short sentence is fine; a drumroll of them is a tell.
- Aphorism formulas: don't land on a quotable-sounding maxim ("restraint is its own kind of risk"). Make the real point instead.
- Conversational rhetorical openers: don't start with fake-candid hooks ("Honestly?", "Here's the thing."). Just begin.
- Passive or subjectless constructions where a person would name who's doing what.

Write with contractions, plain words, and sentences of varied length. Em-dashes are fine where they read naturally; don't lean on them.`

// Per-surface voice registers. The guardrails above say "don't sound like an
// AI"; a register says "and here's the stance for THIS surface" — so the same
// lyrical voice doesn't end up everywhere and harden into a formula. Layer a
// register ON TOP of the guardrails at the call site (register first, then the
// shared rules). Three registers, mapped by what the surface is doing:
//   warm     — reflecting someone's own taste back at them (taste reads)
//   terse    — pointing them at something they might like, fast (discovery)
//   decisive — helping them make a call (compare / deciding)
export const VOICE = {
  warm: `Register for this surface: you're reflecting someone's own taste back at them, like a perceptive friend who's been paying attention. Warm, observational, sure of itself. Find the true through-line and name it plainly — affection is fine, flattery and horoscope-vagueness are not. Earn every warm word with something concrete.`,

  terse: `Register for this surface: you're pointing someone at a thing they might like, fast. Keep it short and concrete — one clean reason, no warm-up, no savoring, no closing flourish. Trust them to get it. Cut every word that isn't pulling weight.`,

  decisive: `Register for this surface: you're helping someone make a call, so make one. Take a clear position and say why in plain, direct words. Don't hedge with "perhaps" or "arguably." If it's genuinely a toss-up, say that flatly and move on — that's a decision too.`,
} as const
