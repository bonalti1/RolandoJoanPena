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
export const OWNER_NAME: string =
  ((import.meta.env.VITE_OWNER_NAME as string | undefined) || 'Rolando').trim()

export const OWNER_FIRST: string = OWNER_NAME.split(/\s+/)[0]

export const OWNER_WORDMARK: string =
  ((import.meta.env.VITE_OWNER_WORDMARK as string | undefined) || '').trim()
