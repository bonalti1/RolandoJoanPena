/**
 * Per-site identity. One codebase serves every leader's Personal OS — each
 * Netlify site sets two variables and gets its own front door:
 *
 *   VITE_OWNER_NAME     — e.g. "Cristo Calderon". Drives the greeting and the
 *                         default profile name until they set their own.
 *   VITE_OWNER_WORDMARK — text drawn in the signature script in place of the
 *                         RJP monogram (e.g. "Cristo Calderon"). When unset,
 *                         the site keeps the RJP mark.
 *
 * Neither variable touches data. Whose tasks appear is decided by the login,
 * never by the site.
 */
/**
 * VITE_BRAND_FROM_LOGIN=1 — the shared team door. One site serves every
 * leader: the wordmark and greeting come from the signed-in profile, so a new
 * leader is onboarded by sending them the link — no new site, no variables.
 */
export const BRAND_FROM_LOGIN: boolean =
  ((import.meta.env.VITE_BRAND_FROM_LOGIN as string | undefined) || '').trim() === '1'

export const OWNER_NAME: string =
  ((import.meta.env.VITE_OWNER_NAME as string | undefined) || (BRAND_FROM_LOGIN ? '' : 'Rolando')).trim()

export const OWNER_FIRST: string = OWNER_NAME.split(/\s+/)[0] ?? ''

export const OWNER_WORDMARK: string =
  ((import.meta.env.VITE_OWNER_WORDMARK as string | undefined) || '').trim()

/**
 * VITE_HIDDEN_TABS — comma-separated page names this site does without,
 * e.g. "family" or "family,health". Hidden pages disappear from every menu
 * and their routes bounce home, so the page can't be reached by URL either.
 */
const hidden = ((import.meta.env.VITE_HIDDEN_TABS as string | undefined) || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

export const isHiddenTab = (path: string): boolean =>
  hidden.includes(path.replace(/^\//, '').toLowerCase())
