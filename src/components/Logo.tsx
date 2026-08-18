import { OWNER_WORDMARK } from '../lib/brand'

/**
 * The site's personal wordmark. By default the RJP monogram — an elegant
 * serif on a transparent background, sized by height. A leader's site sets
 * VITE_OWNER_WORDMARK ("Cristo Calderon") and gets their name set in the
 * bundled signature script instead, so every duplicate of this app carries
 * its owner's mark with no new artwork.
 */
export function Logo({ height = 56, title = 'RJP' }: { height?: number; title?: string }) {
  if (OWNER_WORDMARK) {
    return (
      <span
        aria-label={OWNER_WORDMARK}
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
        {OWNER_WORDMARK}
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
