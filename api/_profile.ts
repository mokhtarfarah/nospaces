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
  return `\nAbout them, in their own words — their stated aesthetic and body type:\n"""\n${profile}\n"""\nApply ONLY the parts that actually bear on this kind of item. Their aesthetic always counts. Body-type notes apply only where the item touches that part of the body: torso, waist, bust and sleeve matter for tops, dresses and outerwear — NOT for shoes, bags or jewellery; height, proportion and leg line matter for shoes and hem lengths. If a detail doesn't fit the category, ignore it — never force it or invent a connection (a shoe can't gap at the waist or shorten a torso). Where it genuinely applies, use it to judge fit and let it tip the lean. Don't quote it back verbatim. (Write your final answer in second person, "you"/"your".)\n`
}
