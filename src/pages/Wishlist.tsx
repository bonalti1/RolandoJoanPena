import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, Button, Input, EmptyState, Skeleton } from '../components/ui'
import { IconPlus, IconTrash, IconSearch, IconWishlist, IconAssistant } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useToast } from '../lib/toast'
import {
  unfurl, searchProducts, aiProsCons, aiDecide, priceNumber,
  type Product, type Collection, type Status, type Priority, type SearchResult,
} from '../lib/wishlist'

const STATUSES: Status[] = ['Researching', 'Want', 'Bought']
const PRIORITIES: Priority[] = ['Low', 'Medium', 'High']
const DEFAULT_COLLECTION: Collection = { id: 'all', name: 'My Wishlist' }

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange?.(n)} className="text-base leading-none"
          style={{ color: n <= value ? 'var(--color-accent)' : 'var(--color-border)', cursor: onChange ? 'pointer' : 'default' }}>★</button>
      ))}
    </div>
  )
}

const selectStyle = { background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }

export default function Wishlist() {
  const [collections, setCollections] = useStore<Collection[]>('wishlist.collections', [DEFAULT_COLLECTION])
  const [items, setItems] = useStore<Product[]>('wishlist.items', [])
  const [migrated, setMigrated] = useStore<boolean>('wishlist.migrated', false)
  const { removeWithUndo } = useToast()
  const [activeCol, setActiveCol] = useState<string>(collections[0]?.id ?? 'all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [sortBy, setSortBy] = useState<'recent' | 'price' | 'rating' | 'status'>('recent')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState<{ open: boolean; loading: boolean; results: SearchResult[]; notConfigured: boolean; q: string }>({ open: false, loading: false, results: [], notConfigured: false, q: '' })
  const [compareOpen, setCompareOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [decide, setDecide] = useState<{ priority: string; loading: boolean; text: string }>({ priority: 'best overall value', loading: false, text: '' })

  // One-time migration from the old flat `wishlist` list.
  useEffect(() => {
    if (migrated) return
    try {
      const old = JSON.parse(localStorage.getItem('jess:wishlist') || 'null')
      if (Array.isArray(old) && old.length) {
        const cid = collections[0]?.id ?? 'all'
        setItems((prev) => prev.length ? prev : old.map((o: Record<string, unknown>) => ({
          id: (o.id as string) || uid('p'), collectionId: cid, name: (o.name as string) || '', price: (o.price as string) || '',
          rating: (o.rating as number) || 0, link: (o.link as string) || '', image: (o.image as string) || '',
          notes: (o.notes as string) || '', status: (o.bought ? 'Bought' : 'Researching') as Status, priority: 'Medium' as Priority,
        })))
      }
    } catch { /* ignore */ }
    setMigrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrated])

  const colItems = useMemo(() => {
    const list = items.filter((i) => i.collectionId === activeCol)
    const arr = [...list]
    if (sortBy === 'price') arr.sort((a, b) => (priceNumber(a.price) ?? 1e12) - (priceNumber(b.price) ?? 1e12))
    else if (sortBy === 'rating') arr.sort((a, b) => b.rating - a.rating)
    else if (sortBy === 'status') arr.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status))
    return arr
  }, [items, activeCol, sortBy])

  const update = (id: string, patch: Partial<Product>) => setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const recordPrice = (p: Product) => {
    const n = priceNumber(p.price)
    if (n == null) return
    const hist = p.priceHistory ?? []
    if (hist.length && hist[hist.length - 1].p === n) return
    update(p.id, { priceHistory: [...hist, { d: new Date().toISOString().slice(0, 10), p: n }] })
  }
  const remove = (id: string) => {
    const item = items.find((p) => p.id === id)
    if (!item) return
    setSelected((s) => { const n = new Set(s); n.delete(id); return n })
    removeWithUndo(`${item.name || 'Item'} removed`, () => setItems((prev) => prev.filter((p) => p.id !== id)), () => setItems((prev) => [item, ...prev]))
  }

  const makeItem = (over: Partial<Product>): Product => ({
    id: uid('p'), collectionId: activeCol, name: '', price: '', rating: 0, link: '', image: '', notes: '',
    status: 'Researching', priority: 'Medium', ...over,
  })
  const addItem = (over: Partial<Product>) => setItems((prev) => [makeItem(over), ...prev])

  const handleAdd = async () => {
    const q = query.trim()
    if (!q) return
    setQuery('')
    if (/^https?:\/\//i.test(q)) {
      // Paste-a-link → unfurl
      const placeholder = makeItem({ name: '', link: q, loading: true })
      setItems((prev) => [placeholder, ...prev])
      setAdding(true)
      const data = await unfurl(q)
      setAdding(false)
      setItems((prev) => prev.map((p) => p.id === placeholder.id ? {
        ...p,
        loading: false,
        name: data?.title || q,
        image: data?.image || '',
        price: data?.price ? (data.price.startsWith('$') ? data.price : `$${data.price}`) : '',
        notes: data?.description || '',
        source: data?.site,
      } : p))
      return
    }
    // Text → live search (if configured), else manual add
    setSearch({ open: true, loading: true, results: [], notConfigured: false, q })
    const out = await searchProducts(q)
    if (out.ok) {
      if (out.results.length === 0) { setSearch({ open: false, loading: false, results: [], notConfigured: false, q }); addItem({ name: q }) }
      else setSearch({ open: true, loading: false, results: out.results, notConfigured: false, q })
    } else if (out.reason === 'not_configured') {
      setSearch({ open: false, loading: false, results: [], notConfigured: false, q })
      addItem({ name: q })
    } else {
      setSearch({ open: false, loading: false, results: [], notConfigured: false, q })
      addItem({ name: q })
    }
  }

  const addFromResult = (r: SearchResult) => addItem({
    name: r.title, image: r.image || '', price: r.price || '', rating: Math.round(r.rating || 0),
    reviews: r.reviews, link: r.link || '', source: r.source,
  })

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectedItems = items.filter((i) => selected.has(i.id))

  const runProsCons = async (p: Product) => {
    setAiBusy(p.id)
    const out = await aiProsCons({ name: p.name, price: p.price, notes: p.notes })
    setAiBusy(null)
    update(p.id, { ai: out.ok ? out.text : out.reason === 'not_configured' ? 'Add OPENAI_API_KEY in Netlify to enable AI pros & cons.' : 'Could not generate right now.' })
  }

  const runDecide = async () => {
    setDecide((d) => ({ ...d, loading: true, text: '' }))
    const out = await aiDecide(decide.priority, selectedItems.map((p) => ({ name: p.name, price: p.price, rating: p.rating, notes: p.notes })))
    setDecide((d) => ({ ...d, loading: false, text: out.ok ? out.text : out.reason === 'not_configured' ? 'Add OPENAI_API_KEY in Netlify to enable this.' : 'Could not generate right now.' }))
  }

  const addCollection = () => {
    const name = window.prompt('Name this list (e.g. Gifts, Kitchen)')?.trim()
    if (!name) return
    const c = { id: uid('col'), name }
    setCollections((prev) => [...prev, c]); setActiveCol(c.id)
  }

  const loadDemo = () => {
    const thumb = (label: string, color: string) =>
      'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${color}'/><stop offset='1' stop-color='#ffffff' stop-opacity='0.25'/></linearGradient></defs><rect width='320' height='200' fill='url(#g)'/><text x='160' y='112' font-size='26' fill='white' font-family='Georgia, serif' text-anchor='middle'>${label}</text></svg>`)
    const cid = uid('col')
    const demo: Product[] = [
      { id: uid('p'), collectionId: cid, name: 'Dyson V15 Detect', price: '$649', rating: 5, reviews: 3200, link: 'https://www.dyson.com', image: thumb('Dyson V15', '#7c6fb5'), notes: 'Best suction, laser dust detection. Pricey but top reviews.', status: 'Want', priority: 'High', targetPrice: '$549', source: 'dyson.com', priceHistory: [{ d: '2026-05-01', p: 699 }, { d: '2026-06-15', p: 649 }] },
      { id: uid('p'), collectionId: cid, name: 'Shark Stratos', price: '$399', rating: 4, reviews: 1800, link: '', image: thumb('Shark Stratos', '#5b8bb0'), notes: 'Great value, odor neutralizer. Heavier than Dyson.', status: 'Researching', priority: 'Medium' },
      { id: uid('p'), collectionId: cid, name: 'Tineco Pure One S15', price: '$499', rating: 4, reviews: 720, link: '', image: thumb('Tineco S15', '#5fa98f'), notes: 'Smart sensor, app control. Smaller brand.', status: 'Researching', priority: 'Low' },
      { id: uid('p'), collectionId: cid, name: 'Roborock Q5 (robot)', price: '$299', rating: 4, reviews: 2400, link: '', image: thumb('Roborock Q5', '#c08bb0'), notes: 'Hands-free robot. Different category — for daily upkeep.', status: 'Researching', priority: 'Medium', targetPrice: '$259' },
    ]
    setCollections((prev) => [...prev, { id: cid, name: '✨ Vacuum demo' }])
    setItems((prev) => [...demo, ...prev])
    setActiveCol(cid)
  }
  const renameCollection = () => {
    const cur = collections.find((c) => c.id === activeCol)
    const name = window.prompt('Rename list', cur?.name)?.trim()
    if (name) setCollections((prev) => prev.map((c) => c.id === activeCol ? { ...c, name } : c))
  }
  const deleteCollection = () => {
    if (collections.length <= 1) return
    if (!window.confirm('Delete this list and its items?')) return
    setItems((prev) => prev.filter((i) => i.collectionId !== activeCol))
    const rest = collections.filter((c) => c.id !== activeCol)
    setCollections(rest); setActiveCol(rest[0].id)
  }

  return (
    <div>
      <PageHeader
        title="Wishlist"
        subtitle="Research products side by side — paste a link or search, compare, and let AI help you decide."
        action={
          <form onSubmit={(e) => { e.preventDefault(); handleAdd() }} className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <IconSearch width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-muted)' }} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Paste a link or search…" className="!pl-9 w-full sm:w-72" />
            </div>
            <Button type="submit" disabled={adding}><IconPlus width={16} height={16} /> Add</Button>
          </form>
        }
      />

      {/* Collections */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {collections.map((c) => (
          <button key={c.id} onClick={() => setActiveCol(c.id)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            style={activeCol === c.id
              ? { background: 'var(--color-accent)', color: 'var(--color-on-accent)' }
              : { background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}>
            {c.name}
          </button>
        ))}
        <button onClick={addCollection} className="px-3 py-1.5 rounded-full text-sm" style={{ color: 'var(--color-muted)', border: '1px dashed var(--color-border)' }}>＋ List</button>
        <button onClick={loadDemo} className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ color: 'var(--color-accent)', border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)' }}>✨ Load example</button>
        <div className="ml-auto flex items-center gap-2">
          {colItems.some((p) => priceNumber(p.price) != null) && (
            <span className="text-sm font-semibold tnum" style={{ color: 'var(--color-text)' }}>
              Total ${colItems.reduce((s, p) => s + (priceNumber(p.price) ?? 0), 0).toLocaleString()}
            </span>
          )}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-lg px-2 py-1.5 text-sm outline-none" style={selectStyle}>
            <option value="recent">Recent</option>
            <option value="price">Price ↑</option>
            <option value="rating">Rating ↓</option>
            <option value="status">Status</option>
          </select>
          {collections.length > 1 && <button onClick={renameCollection} className="text-xs" style={{ color: 'var(--color-muted)' }}>Rename</button>}
          {collections.length > 1 && <button onClick={deleteCollection} className="text-xs" style={{ color: 'var(--color-muted)' }}>Delete list</button>}
        </div>
      </div>

      {colItems.length === 0 ? (
        <div className="flex flex-col items-center">
          <EmptyState icon={<IconWishlist width={44} height={44} />} title="Nothing here yet" hint="Paste a product link to auto-fill it, type a name to search, or load an example to see how comparing works." />
          <Button onClick={loadDemo}>✨ Load example comparison</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {colItems.map((p) => {
            const target = priceNumber(p.targetPrice)
            const cur = priceNumber(p.price)
            const deal = target != null && cur != null && cur <= target
            const isSel = selected.has(p.id)
            if (p.loading) {
              return (
                <Card key={p.id} className="p-4 flex flex-col gap-3">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>Fetching product details…</p>
                </Card>
              )
            }
            return (
              <Card key={p.id} className="p-4 flex flex-col" style={{ opacity: p.status === 'Bought' ? 0.7 : 1, outline: isSel ? '2px solid var(--color-accent)' : '2px solid transparent', outlineOffset: -2 }}>
                <div className="h-32 rounded-xl mb-3 grid place-items-center overflow-hidden relative" style={{ background: 'var(--color-bg)' }}>
                  {p.image ? <img src={p.image} alt={p.name} className="h-full w-full object-cover" /> : <IconWishlist width={32} height={32} style={{ color: 'var(--color-border)' }} />}
                  {deal && <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>DEAL ✓</span>}
                  <label className="absolute top-2 right-2 h-6 w-6 rounded-md grid place-items-center cursor-pointer" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} title="Select to compare">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)} />
                  </label>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} className="font-semibold bg-transparent outline-none w-full" style={{ color: 'var(--color-text)' }} />
                  <button onClick={() => remove(p.id)} style={{ color: 'var(--color-muted)' }}><IconTrash width={16} height={16} /></button>
                </div>

                <div className="flex items-center justify-between mt-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Stars value={p.rating} onChange={(v) => update(p.id, { rating: v })} />
                    {p.reviews != null && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>({p.reviews.toLocaleString()})</span>}
                  </div>
                  <input value={p.price} onChange={(e) => update(p.id, { price: e.target.value })} onBlur={() => recordPrice(p)} placeholder="$ price" className="w-20 text-right bg-transparent outline-none font-bold" style={{ color: 'var(--color-accent)' }} />
                </div>

                {(() => {
                  const hist = p.priceHistory ?? []
                  if (hist.length < 2) return null
                  const low = Math.min(...hist.map((h) => h.p))
                  const cur = priceNumber(p.price)
                  const dropped = cur != null && cur <= low
                  return (
                    <div className="text-xs mb-2 flex items-center gap-1" style={{ color: dropped ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                      {dropped ? '▼ lowest yet' : `▲ was as low as $${low.toLocaleString()}`}
                    </div>
                  )
                })()}

                <div className="flex gap-2 mb-2">
                  <select value={p.status} onChange={(e) => update(p.id, { status: e.target.value as Status })} className="flex-1 rounded-lg px-2 py-1 text-xs outline-none" style={selectStyle}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <select value={p.priority} onChange={(e) => update(p.id, { priority: e.target.value as Priority })} className="flex-1 rounded-lg px-2 py-1 text-xs outline-none" style={selectStyle}>
                    {PRIORITIES.map((s) => <option key={s} value={s}>{s} priority</option>)}
                  </select>
                </div>

                <div className="flex gap-2 mb-2">
                  <Input value={p.link} onChange={(e) => update(p.id, { link: e.target.value })} placeholder="Link (URL)" className="text-xs" />
                  <Input value={p.targetPrice ?? ''} onChange={(e) => update(p.id, { targetPrice: e.target.value })} placeholder="Target $" className="text-xs !w-24" />
                </div>

                <textarea value={p.notes} onChange={(e) => update(p.id, { notes: e.target.value })} placeholder="Notes, pros & cons…" rows={2}
                  className="rounded-xl px-3 py-2 text-sm outline-none resize-none mb-2" style={{ ...selectStyle }} />

                {p.ai && (
                  <div className="text-xs rounded-xl p-2.5 mb-2 whitespace-pre-wrap leading-relaxed" style={{ background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg))', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold flex items-center gap-1" style={{ color: 'var(--color-accent)' }}><IconAssistant width={12} height={12} /> AI take</span>
                      <button onClick={() => update(p.id, { ai: undefined })} style={{ color: 'var(--color-muted)' }}>✕</button>
                    </div>
                    {p.ai}
                  </div>
                )}

                <div className="mt-auto flex items-center gap-2 pt-1">
                  <button onClick={() => runProsCons(p)} disabled={aiBusy === p.id} className="text-xs font-semibold flex items-center gap-1 disabled:opacity-50" style={{ color: 'var(--color-accent)' }}>
                    <IconAssistant width={13} height={13} /> {aiBusy === p.id ? 'Thinking…' : 'Pros & cons'}
                  </button>
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="ml-auto text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open ↗</a>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Compare floating bar */}
      {selected.size >= 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{selected.size} selected</span>
          <Button onClick={() => setCompareOpen(true)} disabled={selected.size < 2}>Compare</Button>
          <button onClick={() => setSelected(new Set())} className="text-sm" style={{ color: 'var(--color-muted)' }}>Clear</button>
        </div>
      )}

      {/* Search results modal */}
      {search.open && (
        <Modal onClose={() => setSearch((s) => ({ ...s, open: false }))} title={`Results for "${search.q}"`}>
          {search.loading ? (
            <p className="text-center py-10" style={{ color: 'var(--color-muted)' }}>Searching…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {search.results.map((r, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--color-bg)' }}>
                  <div className="h-16 w-16 rounded-lg overflow-hidden shrink-0 grid place-items-center" style={{ background: 'var(--color-surface)' }}>
                    {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <IconWishlist width={20} height={20} style={{ color: 'var(--color-border)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--color-text)' }}>{r.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                      {r.price || ''} {r.rating ? `· ${r.rating}★` : ''} {r.reviews ? `(${r.reviews.toLocaleString()})` : ''}
                    </p>
                    <button onClick={() => { addFromResult(r); setSearch((s) => ({ ...s, open: false })) }} className="text-xs font-semibold mt-1" style={{ color: 'var(--color-accent)' }}>+ Add to compare</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* Compare modal */}
      {compareOpen && (
        <Modal onClose={() => setCompareOpen(false)} title="Compare" wide>
          <CompareTable items={selectedItems} />
          <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--color-bg)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>Help me decide</span>
              <select value={decide.priority} onChange={(e) => setDecide((d) => ({ ...d, priority: e.target.value }))} className="rounded-lg px-2 py-1 text-sm outline-none" style={selectStyle}>
                <option value="best overall value">Best overall value</option>
                <option value="lowest price">Lowest price</option>
                <option value="highest quality / rating">Highest quality</option>
                <option value="most durable / long-term">Most durable</option>
              </select>
              <Button onClick={runDecide} disabled={decide.loading}><IconAssistant width={15} height={15} /> {decide.loading ? 'Thinking…' : 'Ask AI'}</Button>
            </div>
            {decide.text && <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text)' }}>{decide.text}</p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center p-4" style={{ background: 'rgba(10,8,20,0.45)' }} onClick={onClose}>
      <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[85vh] overflow-y-auto rounded-2xl p-5`} style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{title}</h2>
          <button onClick={onClose} style={{ color: 'var(--color-muted)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CompareTable({ items }: { items: Product[] }) {
  const prices = items.map((i) => priceNumber(i.price)).filter((n): n is number => n != null)
  const minPrice = prices.length ? Math.min(...prices) : null
  const maxRating = Math.max(0, ...items.map((i) => i.rating))
  const Row = ({ label, render }: { label: string; render: (p: Product) => React.ReactNode }) => (
    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
      <td className="py-2 pr-3 text-xs font-semibold align-top" style={{ color: 'var(--color-muted)' }}>{label}</td>
      {items.map((p) => <td key={p.id} className="py-2 px-2 text-sm align-top" style={{ color: 'var(--color-text)' }}>{render(p)}</td>)}
    </tr>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          <Row label="" render={(p) => (
            <div className="h-20 w-20 rounded-lg overflow-hidden grid place-items-center" style={{ background: 'var(--color-bg)' }}>
              {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <IconWishlist width={20} height={20} style={{ color: 'var(--color-border)' }} />}
            </div>
          )} />
          <Row label="Product" render={(p) => <span className="font-semibold">{p.name}</span>} />
          <Row label="Price" render={(p) => {
            const n = priceNumber(p.price)
            const best = n != null && n === minPrice
            return <span style={{ color: best ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: best ? 700 : 400 }}>{p.price || '—'}{best && ' ✓'}</span>
          }} />
          <Row label="Rating" render={(p) => (
            <span style={{ color: p.rating > 0 && p.rating === maxRating ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: p.rating === maxRating && p.rating > 0 ? 700 : 400 }}>
              {p.rating ? '★'.repeat(p.rating) : '—'}{p.reviews ? ` (${p.reviews.toLocaleString()})` : ''}
            </span>
          )} />
          <Row label="Status" render={(p) => p.status} />
          <Row label="Priority" render={(p) => p.priority} />
          <Row label="Notes" render={(p) => <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{p.notes || '—'}</span>} />
          <Row label="" render={(p) => p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: 'var(--color-accent)' }}>Open ↗</a> : null} />
        </tbody>
      </table>
    </div>
  )
}
