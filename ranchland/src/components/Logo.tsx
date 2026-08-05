import stagUrl from '../assets/stag.png'

export function Wordmark({ size = 1 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: `${size}rem` }}>
      Ranch Land
      <small>— GROUP —</small>
    </span>
  )
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <img src={stagUrl} alt="" width={34} style={light ? { filter: 'brightness(1.35)' } : undefined} />
      <Wordmark size={0.95} />
    </span>
  )
}
