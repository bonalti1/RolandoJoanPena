/**
 * JP monogram — a high-contrast Didone serif "JP" (cream J, taupe P) to match
 * Rolando's brand mark. Rendered as live text so it stays razor-sharp at any
 * size; on Apple devices the Didot face gives it that elegant fashion-house
 * look, with graceful serif fallbacks elsewhere.
 *
 * To use an exact image instead, drop it at public/logo.png and swap this for
 * an <img src="/logo.png" />.
 */
export function Logo({ height = 52, title = 'JP' }: { height?: number; title?: string }) {
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
      <span style={{ color: '#f1eae4' }}>J</span>
      <span style={{ color: '#b7a69f', marginLeft: '-0.06em' }}>P</span>
    </div>
  )
}
