/** Client helpers + types for the Wishlist. Talks to the Netlify functions. */

export type Status = 'Researching' | 'Want' | 'Bought'
export type Priority = 'Low' | 'Medium' | 'High'

export type Product = {
  id: string
  collectionId: string
  name: string
  price: string
  rating: number // 0-5
  reviews?: number
  link: string
  image: string
  notes: string
  status: Status
  priority: Priority
  targetPrice?: string
  source?: string
  ai?: string // AI pros/cons cache
  loading?: boolean // transient: unfurling a pasted link
  priceHistory?: { d: string; p: number }[] // recorded when the price changes
  bought?: boolean // legacy
}

export type Collection = { id: string; name: string }

export type SearchResult = {
  title: string; image?: string; price?: string; rating?: number; reviews?: number; link?: string; source?: string
}

const post = async (fn: string, body: unknown) => {
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export type Unfurled = { title?: string; image?: string; price?: string; description?: string; site?: string }

/** Fetch product details from a pasted URL. Returns null if it couldn't read it. */
export async function unfurl(url: string): Promise<Unfurled | null> {
  try {
    const data = await post('unfurl', { url })
    return data?.ok ? data : null
  } catch {
    return null
  }
}

export type SearchOutcome =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: 'not_configured' | 'error' }

export async function searchProducts(query: string): Promise<SearchOutcome> {
  try {
    const data = await post('product-search', { query })
    if (data?.ok) return { ok: true, results: data.results ?? [] }
    return { ok: false, reason: data?.error === 'not_configured' ? 'not_configured' : 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export type AiOutcome = { ok: true; text: string } | { ok: false; reason: 'not_configured' | 'error' }

export async function aiProsCons(product: Pick<Product, 'name' | 'price' | 'notes'>): Promise<AiOutcome> {
  try {
    const data = await post('wishlist-ai', { action: 'proscons', product })
    if (data?.ok) return { ok: true, text: data.text }
    return { ok: false, reason: data?.error === 'not_configured' ? 'not_configured' : 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function aiDecide(priority: string, products: Pick<Product, 'name' | 'price' | 'rating' | 'notes'>[]): Promise<AiOutcome> {
  try {
    const data = await post('wishlist-ai', { action: 'decide', priority, products })
    if (data?.ok) return { ok: true, text: data.text }
    return { ok: false, reason: data?.error === 'not_configured' ? 'not_configured' : 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Parse the first number out of a price string ("$1,299.00" -> 1299). */
export function priceNumber(s?: string): number | null {
  if (!s) return null
  const m = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
