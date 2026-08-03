/**
 * JP monogram — rendered as crisp transparent vector text so it sits directly
 * on any background (no baked-in tile). The J takes the surrounding text color
 * (white on the dark sidebar, dark on the light mobile bar); the P is brand
 * blue. On Apple devices the Didot face gives it that elegant fashion-house look.
 *
 * To use an exact image instead, export a *transparent* PNG to public/logo.png
 * and swap this for an <img src="/logo.png" />.
 */
const BRAND_BLUE = '#2f6fed'

export function Logo({ height = 56, title = 'JP' }: { height?: number; title?: string }) {
  return (
    <div
      role="img"
      aria-label={title}
      style={{
        fontFamily: "Didot, 'Bodoni 72', 'Playfair Display', Georgia, 'Times New Roman', serif",
        fontSize: height,
        lineHeight: 1,
        letterSpacing: '-0.04em',
        display: 'inline-flex',
        alignItems: 'baseline',
        userSelect: 'none',
        fontWeight: 500,
      }}
    >
      <span style={{ color: 'currentColor' }}>J</span>
      <span style={{ color: BRAND_BLUE, marginLeft: '-0.05em' }}>P</span>
    </div>
  )
}
