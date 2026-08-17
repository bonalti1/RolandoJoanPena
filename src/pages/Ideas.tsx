import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, PageHeader, Button } from '../components/ui'
import { IconPlus, IconTrash, IconSearch, IconMic, IconCheck } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useConfirmDelete } from '../lib/confirmDelete'
import { COMPANIES, companyById, type CompanyId } from '../lib/companies'
import { useDeptsFor } from '../lib/depts'
import { putAudio, getAudio, delAudio } from '../lib/audioStore'

/**
 * The idea vault — everything you might do one day, in one place.
 *
 * Deliberately not a task list: nothing here is due, nothing nags. An idea is
 * caught in seconds (type it or say it), filed against a company + department
 * or a side of your personal life, and left alone until you come looking. What
 * makes it findable later is the filing plus two optional taps — how big it
 * could be, and how much work it would take — which is enough to pull the
 * cheap wins back out of a long list.
 */

type World = 'business' | 'personal'
type Impact = 'high' | 'medium' | 'low'
type Effort = 'quick' | 'project' | 'big'

type Idea = {
  id: string
  text: string
  world: World
  company?: CompanyId     // business ideas
  dept?: string           // department id within that company
  area?: string           // personal ideas
  impact?: Impact
  effort?: Effort
  starred?: boolean
  archived?: boolean
  audio?: boolean         // a voice note lives in the audio store under this id
  created: number
}

const AREAS = ['Home', 'Family', 'Health', 'Money', 'Travel', 'Fun']
const MISC = 'Misc'

const IMPACTS: { id: Impact; label: string; color: string }[] = [
  { id: 'high', label: 'Big', color: '#16a34a' },
  { id: 'medium', label: 'Medium', color: '#d97706' },
  { id: 'low', label: 'Small', color: '#64748b' },
]
const EFFORTS: { id: Effort; label: string }[] = [
  { id: 'quick', label: 'Quick win' },
  { id: 'project', label: 'Project' },
  { id: 'big', label: 'Big bet' },
]

const SRClass =
  (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ||
  (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
const RECORD_SUPPORTED = typeof window !== 'undefined' && 'MediaRecorder' in window

interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void
  onresult: ((e: SREvent) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
type SREvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string }; length: number }[] }

function pickMime(): string {
  for (const o of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    try { if (MediaRecorder.isTypeSupported(o)) return o } catch { /* ignore */ }
  }
  return ''
}

const ageLabel = (t: number) => {
  const d = Math.floor((Date.now() - t) / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  return m < 12 ? `${m}mo ago` : `${Math.floor(d / 365)}y ago`
}

const chip = (on: boolean) => ({
  background: on ? 'var(--color-accent)' : 'var(--color-bg)',
  color: on ? 'var(--color-on-accent)' : 'var(--color-muted)',
  border: '1px solid var(--color-border)',
})
const softChip = (on: boolean) => ({
  background: on ? 'color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))' : 'var(--color-bg)',
  color: on ? 'var(--color-accent)' : 'var(--color-muted)',
  border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border)'}`,
})

/** Company wordmark at a fixed height so mixed aspect ratios stay tidy. */
function CoLogo({ id, h = 15 }: { id?: string; h?: number }) {
  const c = companyById(id)
  if (!c) return null
  return <img src={c.logo} alt={c.name} draggable={false} className="shrink-0 object-contain" style={{ height: h, width: 'auto', maxWidth: h * 3.6 }} />
}

/** Plays back the voice note attached to an idea, pulled on demand. */
function VoiceNote({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let made = ''
    void getAudio(id).then((blob) => {
      if (!live || !blob) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [id])
  if (!url) return <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>🎙 loading…</span>
  return <audio src={url} controls preload="metadata" className="h-8 w-full max-w-xs mt-2" />
}

export default function Ideas() {
  const confirmDelete = useConfirmDelete()
  const deptsFor = useDeptsFor()
  const [ideas, setIdeas] = useStore<Idea[]>('ideas.list', [])

  // ---- capture ----
  const [world, setWorld] = useState<World>('business')
  const [text, setText] = useState('')
  const [interim, setInterim] = useState('')
  const [company, setCompany] = useState<CompanyId | ''>('')
  const [dept, setDept] = useState('')
  const [area, setArea] = useState('')
  const [impact, setImpact] = useState<Impact | ''>('')
  const [effort, setEffort] = useState<Effort | ''>('')
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const srRef = useRef<SpeechRec | null>(null)

  // ---- browsing ----
  const [view, setView] = useState<'all' | World>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'new' | 'quick' | 'starred'>('new')
  const [filterCo, setFilterCo] = useState<CompanyId | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)

  const stopTracks = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }
  useEffect(() => () => {
    try { srRef.current?.stop() } catch { /* ignore */ }
    try { recRef.current?.stop() } catch { /* ignore */ }
    stopTracks()
  }, [])

  const startRecording = async () => {
    setError('')
    if (!RECORD_SUPPORTED) { setError('Recording is not supported in this browser.'); return }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
    catch { setError('Microphone blocked — allow it in your browser to record.'); return }
    streamRef.current = stream
    chunksRef.current = []
    setBlob(null)
    const mime = pickMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    rec.onstop = () => { setBlob(new Blob(chunksRef.current, { type: mime || 'audio/webm' })); stopTracks() }
    rec.start()
    recRef.current = rec
    setRecording(true)

    // Live dictation where the browser supports it — the audio is kept either way.
    if (SRClass) {
      const sr = new SRClass()
      sr.lang = navigator.language || 'en-US'
      sr.continuous = true
      sr.interimResults = true
      sr.onresult = (e: SREvent) => {
        let live = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) setText((prev) => (prev ? prev + ' ' : '') + r[0].transcript.trim())
          else live += r[0].transcript
        }
        setInterim(live)
      }
      sr.onend = () => setInterim('')
      sr.onerror = () => { /* transient — the recording continues */ }
      try { sr.start() } catch { /* already running */ }
      srRef.current = sr
    }
  }

  const stopRecording = () => {
    try { srRef.current?.stop() } catch { /* ignore */ }
    try { recRef.current?.stop() } catch { /* ignore */ }
    srRef.current = null
    setRecording(false)
    setInterim('')
  }

  const save = async () => {
    const body = text.trim()
    if (!body && !blob) { setError('Say it or type it first.'); return }
    if (recording) stopRecording()
    const id = uid('idea')
    if (blob) { try { await putAudio(id, blob) } catch { /* the text still saves */ } }
    const idea: Idea = {
      id,
      text: body || '(voice note)',
      world,
      created: Date.now(),
      ...(world === 'business' && company ? { company: company as CompanyId } : {}),
      ...(world === 'business' && dept ? { dept } : {}),
      ...(world === 'personal' && area ? { area } : {}),
      ...(impact ? { impact: impact as Impact } : {}),
      ...(effort ? { effort: effort as Effort } : {}),
      ...(blob ? { audio: true } : {}),
    }
    setIdeas((prev) => [idea, ...prev])
    setText(''); setBlob(null); setImpact(''); setEffort(''); setError('')
    // The filing stays put — most ideas arrive in runs about the same thing.
  }

  const patch = (id: string, fn: (i: Idea) => Idea) =>
    setIdeas((prev) => prev.map((i) => (i.id === id ? fn(i) : i)))
  const remove = (idea: Idea) =>
    confirmDelete({
      label: idea.text ? `“${idea.text.slice(0, 60)}”` : 'this idea',
      detail: 'The idea and its voice note will be removed. This can’t be undone.',
      onConfirm: () => { void delAudio(idea.id); setIdeas((prev) => prev.filter((i) => i.id !== idea.id)) },
    })

  const deptName = (co: string | undefined, id: string | undefined) =>
    id ? deptsFor(co).find((d) => d.id === id)?.name : undefined

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = ideas.filter((i) => {
      if (!!i.archived !== showArchived) return false
      if (view !== 'all' && i.world !== view) return false
      if (view === 'business' && filterCo !== 'all' && i.company !== filterCo) return false
      if (!q) return true
      const dn = deptName(i.company, i.dept) ?? ''
      return `${i.text} ${dn} ${i.area ?? ''} ${companyById(i.company)?.name ?? ''}`.toLowerCase().includes(q)
    })
    const effortRank: Record<string, number> = { quick: 0, project: 1, big: 2 }
    const impactRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return list.sort((a, b) => {
      if (sort === 'starred') return (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || b.created - a.created
      if (sort === 'quick') {
        return (impactRank[a.impact ?? 'medium'] - impactRank[b.impact ?? 'medium'])
          || (effortRank[a.effort ?? 'project'] - effortRank[b.effort ?? 'project'])
          || b.created - a.created
      }
      return b.created - a.created
    })
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ideas, query, view, filterCo, sort, showArchived])

  const live = ideas.filter((i) => !i.archived)
  const quickWins = live.filter((i) => i.impact === 'high' && i.effort === 'quick').length
  const archivedCount = ideas.length - live.length
  const depts = deptsFor(company || undefined)

  return (
    <div className="fade-up">
      <PageHeader
        title="Ideas"
        subtitle="Everything you might do one day. Catch it now, decide later — nothing here is a task."
      />

      {/* Capture */}
      <Card className="p-4 mb-5">
        {/* Which side of life is this for? */}
        <div className="flex gap-1.5 mb-3">
          {([['business', 'Business'], ['personal', 'Personal']] as const).map(([w, label]) => (
            <button key={w} onClick={() => setWorld(w)}
              className="px-4 py-1.5 rounded-full text-[13px] font-semibold transition" style={chip(world === w)}>
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={text + (interim ? (text ? ' ' : '') + interim : '')}
          onChange={(e) => { setText(e.target.value); setInterim('') }}
          rows={2}
          placeholder={world === 'business' ? 'What could we do?' : 'What do you want to do one day?'}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-y"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        />

        {/* Where it's filed */}
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-muted)' }}>
            {world === 'business' ? 'Which company' : 'Which part of life'}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {world === 'business' ? (
              <>
                {COMPANIES.map((c) => (
                  <button key={c.id} onClick={() => { setCompany(c.id); setDept('') }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition" style={softChip(company === c.id)}>
                    <CoLogo id={c.id} h={16} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{c.name}</span>
                  </button>
                ))}
                <button onClick={() => { setCompany(''); setDept('') }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition" style={softChip(company === '')}>
                  {MISC}
                </button>
              </>
            ) : (
              <>
                {AREAS.map((a) => (
                  <button key={a} onClick={() => setArea(a)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition" style={softChip(area === a)}>
                    {a}
                  </button>
                ))}
                <button onClick={() => setArea('')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition" style={softChip(area === '')}>
                  {MISC}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Department, once a company is chosen */}
        {world === 'business' && company && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Which department <span style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.8 }}>· optional</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {depts.map((d) => (
                <button key={d.id} onClick={() => setDept(dept === d.id ? '' : d.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition" style={softChip(dept === d.id)}>
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* How big / how hard — two taps, both optional */}
        <div className="flex gap-4 flex-wrap mt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-muted)' }}>How big</div>
            <div className="flex gap-1.5">
              {IMPACTS.map((i) => (
                <button key={i.id} onClick={() => setImpact(impact === i.id ? '' : i.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition" style={softChip(impact === i.id)}>
                  {i.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--color-muted)' }}>How much work</div>
            <div className="flex gap-1.5">
              {EFFORTS.map((e) => (
                <button key={e.id} onClick={() => setEffort(effort === e.id ? '' : e.id)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition" style={softChip(effort === e.id)}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-sm mt-2" style={{ color: '#c0504d' }}>{error}</p>}
        {blob && !recording && (
          <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--color-accent)' }}>
            <IconCheck width={13} height={13} /> Voice note attached
            <button onClick={() => setBlob(null)} className="underline" style={{ color: 'var(--color-muted)' }}>remove</button>
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button onClick={() => void save()}><IconPlus width={16} height={16} /> Save idea</Button>
          {RECORD_SUPPORTED && (
            <button
              onClick={() => (recording ? stopRecording() : void startRecording())}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition"
              style={recording
                ? { background: '#dc2626', color: '#fff' }
                : { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
              <IconMic width={16} height={16} />
              {recording ? 'Stop' : 'Speak it'}
            </button>
          )}
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {recording ? 'Listening… it types as you talk.' : 'Nothing here is due. Filing is optional — Misc is fine.'}
          </span>
        </div>
      </Card>

      {/* Browse */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {([['all', 'All'], ['business', 'Business'], ['personal', 'Personal']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition" style={chip(view === v)}>
            {label}
          </button>
        ))}
        <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 flex-1 min-w-[160px]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <IconSearch width={15} height={15} style={{ color: 'var(--color-muted)' }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ideas…"
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--color-text)' }} />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl px-2.5 py-2 text-xs font-semibold outline-none"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
          <option value="new">Newest first</option>
          <option value="quick">Biggest & easiest first</option>
          <option value="starred">Starred first</option>
        </select>
      </div>

      {view === 'business' && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setFilterCo('all')} className="px-3 py-1 rounded-full text-xs font-semibold" style={softChip(filterCo === 'all')}>All companies</button>
          {COMPANIES.map((c) => (
            <button key={c.id} onClick={() => setFilterCo(c.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={softChip(filterCo === c.id)}>
              <CoLogo id={c.id} h={14} /> {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-3 flex-wrap text-xs" style={{ color: 'var(--color-muted)' }}>
        <span>{live.length} idea{live.length === 1 ? '' : 's'} kept</span>
        {quickWins > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>{quickWins} big & easy</span>}
        {archivedCount > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} className="font-semibold" style={{ color: 'var(--color-accent)' }}>
            {showArchived ? '← Back to my ideas' : `Archived (${archivedCount})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {showArchived ? 'Nothing archived.'
              : ideas.length === 0 ? 'No ideas yet. Say one out loud up there — it types itself.'
                : 'No ideas match that.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2">
          {visible.map((i) => {
            const dn = deptName(i.company, i.dept)
            const imp = IMPACTS.find((x) => x.id === i.impact)
            const eff = EFFORTS.find((x) => x.id === i.effort)
            return (
              <Card key={i.id} className="p-3.5 group">
                <div className="flex items-start gap-2">
                  <button onClick={() => patch(i.id, (x) => ({ ...x, starred: !x.starred }))}
                    className="shrink-0 mt-0.5 text-base leading-none transition"
                    style={{ color: i.starred ? '#f59e0b' : 'var(--color-border)' }}
                    aria-label={i.starred ? 'Unstar' : 'Star'}>★</button>
                  <p className="flex-1 min-w-0 text-sm leading-snug whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>{i.text}</p>
                  <button onClick={() => remove(i)} className="shrink-0 opacity-0 group-hover:opacity-60 transition" style={{ color: 'var(--color-muted)' }} aria-label="Delete">
                    <IconTrash width={14} height={14} />
                  </button>
                </div>

                {i.audio && <VoiceNote id={i.id} />}

                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {i.company && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg" style={{ background: 'var(--color-bg)' }}>
                      <CoLogo id={i.company} h={13} />
                      {dn && <span className="text-[10px] font-semibold" style={{ color: 'var(--color-muted)' }}>{dn}</span>}
                    </span>
                  )}
                  {i.world === 'personal' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>
                      {i.area || MISC}
                    </span>
                  )}
                  {i.world === 'business' && !i.company && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{MISC}</span>
                  )}
                  {imp && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `color-mix(in srgb, ${imp.color} 14%, var(--color-surface))`, color: imp.color }}>{imp.label}</span>}
                  {eff && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-muted)' }}>{eff.label}</span>}
                  <span className="text-[10px] tnum ml-auto" style={{ color: 'var(--color-muted)' }}>{ageLabel(i.created)}</span>
                  <button onClick={() => patch(i.id, (x) => ({ ...x, archived: !x.archived }))}
                    className="text-[10px] font-semibold" style={{ color: 'var(--color-accent)' }}>
                    {i.archived ? 'Restore' : 'Archive'}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
