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
  return `\nAbout the shopper, in their own words (their stated aesthetic and body type). Weigh fit and silhouette against this where it's relevant, but treat it as context — don't read it back to them verbatim:\n"""\n${profile}\n"""\n`
}
