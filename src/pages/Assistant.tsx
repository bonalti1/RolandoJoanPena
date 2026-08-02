import { useEffect, useRef, useState } from 'react'
import { Card, PageHeader, Button, Input } from '../components/ui'
import { IconAssistant } from '../components/icons'
import { useStore } from '../lib/store'
import { askAI, type ChatMessage } from '../lib/ai'

type Hit = { source: string; date: string; text: string }

/** Local fallback search — used when the AI service isn't connected/reachable. */
function searchEverything(q: string): Hit[] {
  const query = q.toLowerCase().trim()
  if (!query) return []
  const hits: Hit[] = []
  const get = <T,>(key: string): T[] => {
    try { return JSON.parse(localStorage.getItem('jess:' + key) || '[]') } catch { return [] }
  }
  const match = (s: string) => !!s && s.toLowerCase().includes(query)

  get<{ date: string; title: string }>('calendar.events').forEach((e) => {
    if (match(e.title)) hits.push({ source: 'Calendar', date: e.date, text: e.title })
  })
  get<{ date: string; kind: string; title: string; notes: string }>('health.records').forEach((r) => {
    if (match(r.title) || match(r.notes) || match(r.kind))
      hits.push({ source: `Health · ${r.kind}`, date: r.date, text: r.title })
  })
  get<{ date: string; who: string; what: string }>('family.appts').forEach((a) => {
    if (match(a.what) || match(a.who)) hits.push({ source: 'Family appt', date: a.date, text: `${a.who} — ${a.what}` })
  })
  get<{ text: string; done: boolean; created: number }>('tasks.master').forEach((t) => {
    if (match(t.text)) hits.push({ source: t.done ? 'Task (done)' : 'Task', date: new Date(t.created).toISOString().slice(0, 10), text: t.text })
  })
  return hits.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

function localAnswer(q: string): string {
  const hits = searchEverything(q)
  if (hits.length === 0) {
    return `I couldn't find anything about "${q}" in your saved data. (The full AI assistant isn't connected yet — add your OPENAI_API_KEY in Netlify to turn it on.)`
  }
  const lines = hits.slice(0, 8).map((h) => `• ${h.date || '—'} — ${h.text} (${h.source})`)
  return `Here's what I found in your data:\n${lines.join('\n')}\n\n(Tip: connect the AI key in Netlify for full conversational answers.)`
}

const SUGGESTIONS = [
  'When did I last go to the doctor?',
  'Which bills have I not paid this month?',
  'What appointments are coming up?',
  'Summarize my week.',
]

/** Inline markdown: **bold** and `code`. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (/^`[^`]+`$/.test(p)) return <code key={i} style={{ background: 'var(--color-surface)', padding: '1px 4px', borderRadius: 4 }}>{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

/** Lightweight markdown — headings, bullets, numbered lists, bold/code, line breaks. */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((ln, i) => {
        if (ln.trim() === '') return <div key={i} className="h-1.5" />
        const bullet = /^\s*[-*]\s+/.test(ln)
        const num = ln.match(/^\s*(\d+)\.\s+/)
        const head = /^\s*#{1,3}\s+/.test(ln)
        if (head) return <div key={i} className="font-bold mt-1" style={{ color: 'var(--color-text)' }}>{inline(ln.replace(/^\s*#{1,3}\s+/, ''))}</div>
        if (bullet) return <div key={i} className="flex gap-2 pl-1"><span style={{ color: 'var(--color-accent)' }}>•</span><span>{inline(ln.replace(/^\s*[-*]\s+/, ''))}</span></div>
        if (num) return <div key={i} className="flex gap-2 pl-1"><span className="font-semibold" style={{ color: 'var(--color-accent)' }}>{num[1]}.</span><span>{inline(ln.replace(/^\s*\d+\.\s+/, ''))}</span></div>
        return <div key={i}>{inline(ln)}</div>
      })}
    </div>
  )
}

export default function Assistant() {
  const [messages, setMessages] = useStore<ChatMessage[]>('ai.chat', [])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    const history = messages.slice()
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setBusy(true)
    const result = await askAI(q, history)
    const answer = result.ok ? result.answer : localAnswer(q)
    setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    setBusy(false)
  }

  return (
    <div>
      <PageHeader
        title="Ask AI"
        subtitle='Ask anything about your dashboard — "When did I do this?", "What do I owe?"'
        action={messages.length > 0 ? <Button variant="outline" onClick={() => setMessages([])}>Clear chat</Button> : undefined}
      />

      <Card className="flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }}>
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {messages.length === 0 && !busy && (
            <div className="m-auto text-center max-w-md">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl grid place-items-center" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>
                <IconAssistant width={28} height={28} />
              </div>
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>Ask me about your dashboard</p>
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
                I can look across your tasks, bills, calendar, health and family.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-sm px-3 py-1.5 rounded-full transition hover:scale-[1.03]"
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                style={
                  m.role === 'user'
                    ? { background: 'var(--color-accent)', color: 'var(--color-on-accent)' }
                    : { background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }
                }
              >
                {m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--color-muted)', animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--color-muted)', animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ background: 'var(--color-muted)', animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length > 0 && !busy && (
          <div className="flex gap-2 px-4 pt-3 overflow-x-auto" style={{ borderTop: '1px solid var(--color-border)' }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="text-xs whitespace-nowrap px-3 py-1.5 rounded-full shrink-0 transition hover:scale-[1.03]"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>{s}</button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => { e.preventDefault(); send(input) }}
          className="flex gap-2 p-4"
          style={messages.length > 0 ? undefined : { borderTop: '1px solid var(--color-border)' }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={busy} />
          <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
        </form>
      </Card>

      <p className="text-xs mt-3" style={{ color: 'var(--color-muted)' }}>
        Powered by OpenAI through a secure Netlify function — your data is sent only to answer your question and is never stored on a server.
      </p>
    </div>
  )
}
