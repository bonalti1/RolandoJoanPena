/**
 * Live product search. Activates when a shopping API key is configured;
 * otherwise returns { error: 'not_configured' } and the app falls back to
 * manual / paste-a-link entry.
 *
 * POST { query } -> { ok, results: [{ title, image, price, rating, reviews, link, source }] }
 *
 * Provider: RapidAPI "Real-Time Product Search" (Google Shopping data).
 * Set in Netlify:
 *   RAPIDAPI_KEY                  – your RapidAPI key
 *   RAPIDAPI_PRODUCT_HOST         – optional, defaults to real-time-product-search.p.rapidapi.com
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Result = { title: string; image?: string; price?: string; rating?: number; reviews?: number; link?: string; source?: string }

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = process.env.RAPIDAPI_KEY
  if (!key) return json({ error: 'not_configured' }, 200)

  let query = ''
  try {
    query = (await req.json()).query?.trim() || ''
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!query) return json({ error: 'Missing query' }, 400)

  const host = process.env.RAPIDAPI_PRODUCT_HOST || 'real-time-product-search.p.rapidapi.com'

  try {
    const url = `https://${host}/search?q=${encodeURIComponent(query)}&country=us&language=en&limit=12`
    const res = await fetch(url, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host },
    })
    if (!res.ok) {
      const detail = await res.text()
      console.error('product-search upstream', res.status, detail.slice(0, 200))
      return json({ error: 'search_error' }, 200)
    }
    const data = (await res.json()) as { data?: { products?: Record<string, unknown>[] } }
    const products = data?.data?.products ?? []
    const results: Result[] = products.slice(0, 12).map((p) => {
      const offer = (p.offer ?? {}) as Record<string, unknown>
      const photos = (p.product_photos ?? []) as string[]
      return {
        title: String(p.product_title ?? ''),
        image: photos[0] ?? (p.product_photo as string | undefined),
        price: (offer.price as string | undefined) ?? (p.typical_price_range as string | undefined),
        rating: p.product_rating != null ? Number(p.product_rating) : undefined,
        reviews: p.product_num_reviews != null ? Number(p.product_num_reviews) : undefined,
        link: (offer.offer_page_url as string | undefined) ?? (p.product_page_url as string | undefined),
        source: offer.store_name as string | undefined,
      }
    }).filter((r) => r.title)
    return json({ ok: true, results })
  } catch (e) {
    console.error('product-search error', (e as Error).message)
    return json({ error: 'search_error' }, 200)
  }
}
