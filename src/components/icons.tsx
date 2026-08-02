// Minimal inline SVG icon set (no dependency). Each takes standard svg props.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (props: P) => ({
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 11 9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M9 20v-6h6v6" />
  </svg>
)

export const IconMenu = (p: P) => (
  <svg {...base(p)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
)

export const IconTasks = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)

export const IconWork = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18" />
    <path d="m9 15 2 2 4-4" />
  </svg>
)

export const IconWishlist = (p: P) => (
  <svg {...base(p)}>
    <path d="M20.8 5.6a4.4 4.4 0 0 0-6.2 0L12 8.2 9.4 5.6a4.4 4.4 0 1 0-6.2 6.2L12 20.6l8.8-8.8a4.4 4.4 0 0 0 0-6.2Z" />
  </svg>
)

export const IconPayments = (p: P) => (
  <svg {...base(p)}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </svg>
)

export const IconBank = (p: P) => (
  <svg {...base(p)}>
    <path d="m3 10 9-6 9 6" />
    <path d="M4 10v9M20 10v9M9 10v9M15 10v9M3 19h18" />
  </svg>
)

export const IconCalendar = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18" />
  </svg>
)

export const IconHealth = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12h4l2-5 4 10 2-5h6" />
  </svg>
)

export const IconFamily = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M2.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M15 20a4.5 4.5 0 0 1 6.5-4" />
  </svg>
)

export const IconAssistant = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
  </svg>
)

export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.9H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.6 6.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.1 4H10a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V10a2 2 0 1 1 0 4h-.1Z" />
  </svg>
)

export const IconPlus = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
)

export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>
)
