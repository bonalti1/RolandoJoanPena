/**
 * Brand logo — Rolando's JP monogram. Uses the real artwork at public/logo.png,
 * shown as a rounded tile so its light background reads as a crisp app-style
 * badge on the dark sidebar and anywhere else.
 */
export function Logo({ height = 56, title = 'JP' }: { height?: number; title?: string }) {
  const radius = Math.round(height * 0.22)
  return (
    <img
      src="/logo.png"
      alt={title}
      width={height}
      height={height}
      style={{ width: height, height, borderRadius: radius, display: 'block', objectFit: 'cover', userSelect: 'none' }}
      draggable={false}
    />
  )
}
