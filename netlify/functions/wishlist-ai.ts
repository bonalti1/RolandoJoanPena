/**
 * AI helper for the Wishlist. Uses the same OPENAI_API_KEY as the assistant.
 *
 * POST { action: 'proscons', product }              -> { ok, text }
 * POST { action: 'decide', priority, products: [] } -> { ok, text }
 *
 * Note: this is AI guidance based on the product name/details provided — it is
 * not scraped customer reviews. Live ratings/review counts come from the
 * product-search function when configured.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function chat(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw Object.assign(new Error('not_configured'), { code: 'not_configured' })
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.3,
      max_tokens: 500,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content?.trim() || ''
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: { action?: string; product?: Record<string, unknown>; products?: Record<string, unknown>[]; priority?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  try {
    if (body.action === 'proscons' && body.product) {
      const p = body.product
      const text = await chat(
        'You are a sharp, trustworthy shopping advisor. Give a tight, balanced buying take. Use plain language. No fluff, no marketing speak.',
        `Give pros and cons for this product, then a one-line "good for" verdict.
Product: ${p.name}
${p.price ? `Price: ${p.price}` : ''}
${p.notes ? `My notes: ${p.notes}` : ''}
Format:
Pros:
- ...
Cons:
- ...
Good for: ...`,
      )
      return json({ ok: true, text })
    }

    if (body.action === 'decide' && Array.isArray(body.products)) {
      const list = body.products
        .map((p, i) => `${i + 1}. ${p.name}${p.price ? ` — ${p.price}` : ''}${p.rating ? ` — ${p.rating}★` : ''}${p.notes ? ` — notes: ${p.notes}` : ''}`)
        .join('\n')
      const text = await chat(
        'You are a decisive but honest shopping advisor helping someone choose between options they are comparing.',
        `My priority: ${body.priority || 'best overall value'}.
Here are the options I'm comparing:
${list}

Pick the best one for my priority. Start with "Pick: <name>", then 2-3 short bullets on why, then one line on the runner-up.`,
      )
      return json({ ok: true, text })
    }

    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'not_configured') return json({ error: 'not_configured' }, 200)
    console.error('wishlist-ai error', err.message)
    return json({ error: 'ai_error' }, 200)
  }
}
