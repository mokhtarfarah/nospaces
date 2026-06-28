// A short, user-authored "style profile" — their own words on their aesthetic and
// body type. An optional input to the Things taste reads (compare + per-item fit)
// so the model can weigh fit/silhouette against who the shopper actually is, not
// just what's on the board. Stored in user_prefs; only ever the user's own
// self-description, never something we infer.
const MAX = 800

export function sanitizeProfile(input: unknown): string {
  return typeof input === 'string' ? input.trim().slice(0, MAX) : ''
}

// Renders the profile as a prompt section, or '' when there's nothing to add — so
// callers can drop it straight into a template string with no empty scaffolding.
export function profilePromptBlock(profile: string): string {
  if (!profile) return ''
  return `\nAbout them, in their own words — their stated aesthetic and body type:\n"""\n${profile}\n"""\nUse this actively: judge how each option's cut, silhouette, neckline, length and colour actually flatter them, and let it tip the lean when one option suits them better than another. Don't quote it back verbatim or open by describing them to themselves — apply it. (Write your final answer in second person, "you"/"your".)\n`
}
