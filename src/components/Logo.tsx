import { BRAND_FROM_LOGIN, OWNER_WORDMARK } from '../lib/brand'
import { useStore } from '../lib/store'

/**
 * The site's personal wordmark. By default the RJP monogram — an elegant
 * serif on a transparent background, sized by height. A leader's site sets
 * VITE_OWNER_WORDMARK ("Cristo Calderon") and gets their name set in the
 * bundled signature script instead, so every duplicate of this app carries
 * its owner's mark with no new artwork.
 */
export function Logo({ height = 56, title = 'RJP' }: { height?: number; title?: string }) {
  // On the shared team door the mark is whoever signed in — their name in the
  // signature script the moment they've set it, the company mark before then
  // (and on the login screen, where nobody is signed in yet).
  const [profile] = useStore<{ name?: string }>('profile', {})
  const loginName = BRAND_FROM_LOGIN ? (profile.name || '').trim() : ''
  const wordmark = OWNER_WORDMARK || loginName

  if (BRAND_FROM_LOGIN && !wordmark) {
    return (
      <span
        aria-label="BONALTI"
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: height * 0.52,
          lineHeight: `${height}px`,
          letterSpacing: '0.18em',
          display: 'block',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          color: 'currentColor',
        }}
      >
        BONALTI
      </span>
    )
  }

  if (wordmark) {
    return (
      <span
        aria-label={wordmark}
        style={{
          fontFamily: '"Signature", "Snell Roundhand", "Brush Script MT", cursive',
          // The script face carries tall ascenders — sized so the name fills
          // roughly the same visual band the monogram did.
          fontSize: height * 0.72,
          lineHeight: `${height}px`,
          display: 'block',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          color: 'currentColor',
        }}
      >
        {wordmark}
      </span>
    )
  }
  return (
    <img
      src="/logos/rjp.png"
      alt={title}
      draggable={false}
      style={{ height, width: 'auto', display: 'block', userSelect: 'none' }}
    />
  )
}
