import { useState } from 'react'
import { Card, PageHeader, Button, Input } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { useStore, uid } from '../lib/store'
import { useConfirmDelete } from '../lib/confirmDelete'

/**
 * Team workspaces — one card per leader. Each leader runs their own app (their
 * own site + login that shows only their stuff); this page is Rolando's door
 * into each of them. The workspace URL is saved once and syncs across devices.
 */

type Leader = { id: string; name: string; role: string; url: string; os?: string }

const SEED: Leader[] = [
  { id: 'lead_carlos', name: 'Carlos', role: 'Content Manager', url: '', os: 'Content Operating System' },
]

/** The workspace is branded by function ("Content Operating System"), falling
 * back to the leader's name for cards saved before the field existed. */
const osTitle = (l: Leader) =>
  l.os?.trim() || (l.id === 'lead_carlos' ? 'Content Operating System' : `${l.name} Operating System`)

const initials = (name: string) => (name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

const normUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export default function Team() {
  const confirmDelete = useConfirmDelete()
  const [leaders, setLeaders] = useStore<Leader[]>('team.leaders', SEED)
  const [editing, setEditing] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Leader | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftRole, setDraftRole] = useState('')
  const [draftUrl, setDraftUrl] = useState('')

  const patch = (id: string, p: Partial<Leader>) => setLeaders((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)))

  const openWorkspace = (l: Leader) => {
    if (!l.url.trim()) { setEditing(l.id); return }
    setViewing(l)
  }

  // ---- Embedded workspace: work inside a leader's app without leaving yours ----
  if (viewing) {
    // `as=assistant` asks the leader's app to render exactly what THEY see
    // (their shell, their sections) instead of the owner view. Apps that don't
    // know the param simply ignore it.
    const base = normUrl(viewing.url)
    const src = /[?&]as=/.test(base) ? base : base + (base.includes('?') ? '&' : '?') + 'as=assistant'
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'var(--color-bg)' }}>
        {/* Dark BONALTI bar — the white wordmark sits on the company's dark chrome */}
        <div className="flex items-center gap-3 px-4 py-2.5 shrink-0" style={{ background: 'linear-gradient(180deg, var(--color-sidebar) 0%, var(--color-sidebar-2) 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setViewing(null)} className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-2.5 py-1.5 shrink-0" style={{ color: '#fff', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)' }}>
            ‹ My dashboard
          </button>
          <img src="/logos/bonalti.png" alt="BONALTI" draggable={false} className="shrink-0" style={{ height: 15, width: 'auto' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight truncate" style={{ color: '#fff' }}>{osTitle(viewing)}</div>
            <div className="text-[11px] leading-tight truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{viewing.name} · {viewing.role}</div>
          </div>
          <a href={src} target="_blank" rel="noopener" className="text-xs font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.85)' }}>Open in new tab ↗</a>
        </div>
        <iframe src={src} title={`${viewing.name}'s workspace`} className="flex-1 w-full border-0" allow="microphone; clipboard-read; clipboard-write" />
      </div>
    )
  }

  const addLeader = () => {
    const name = draftName.trim()
    if (!name) return
    setLeaders((prev) => [...prev, { id: uid('lead'), name, role: draftRole.trim(), url: draftUrl.trim() }])
    setDraftName(''); setDraftRole(''); setDraftUrl('')
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Every leader runs their own workspace — their own app, their own login, only their stuff. Open any of them from here."
      />

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {leaders.map((l) => (
          <Card key={l.id} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-11 w-11 rounded-full grid place-items-center font-bold shrink-0" style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}>{initials(l.name)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ color: 'var(--color-text)' }}>{osTitle(l)}</div>
                <div className="text-sm truncate" style={{ color: 'var(--color-muted)' }}>{l.name} · {l.role || 'Leader'}</div>
              </div>
              <button
                onClick={() => confirmDelete({ label: `${l.name}'s workspace card`, detail: 'Only this card is removed — their app and data are untouched.', onConfirm: () => setLeaders((prev) => prev.filter((x) => x.id !== l.id)) })}
                className="opacity-40 hover:opacity-100 transition shrink-0" style={{ color: 'var(--color-muted)' }} aria-label="Remove card"
              >
                <IconTrash width={15} height={15} />
              </button>
            </div>

            {editing === l.id ? (
              <div className="flex flex-col gap-2">
                <Input value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} placeholder="Name" />
                <Input value={l.role} onChange={(e) => patch(l.id, { role: e.target.value })} placeholder="Role (e.g. Content Manager)" />
                <Input value={l.os ?? ''} onChange={(e) => patch(l.id, { os: e.target.value })} placeholder="Workspace name (e.g. Content Operating System)" />
                <Input value={l.url} onChange={(e) => patch(l.id, { url: e.target.value })} placeholder="Workspace link (e.g. bonalti-employeeos.netlify.app)" />
                <Button onClick={() => setEditing(null)}>Done</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openWorkspace(l)}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-center transition active:scale-[0.98]"
                  style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
                >
                  {l.url.trim() ? 'Open workspace →' : 'Set workspace link'}
                </button>
                <Button variant="outline" onClick={() => setEditing(l.id)}>Edit</Button>
              </div>
            )}
            {!l.url.trim() && editing !== l.id && (
              <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>Paste their app's link once — it saves and syncs to all your devices.</p>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h3 className="font-bold mb-3" style={{ color: 'var(--color-text)' }}>Add a leader</h3>
        <div className="grid sm:grid-cols-[1fr_1fr_1.4fr_auto] gap-2">
          <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Name" />
          <Input value={draftRole} onChange={(e) => setDraftRole(e.target.value)} placeholder="Role" />
          <Input value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLeader() }} placeholder="Workspace link (optional)" />
          <Button onClick={addLeader}><IconPlus width={16} height={16} /> Add</Button>
        </div>
      </Card>
    </div>
  )
}
