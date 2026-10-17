import { useState, type SVGProps } from 'react'
import { Card, Skeleton } from './ui'
import { IconCheck } from './icons'
import { useToast } from '../lib/toast'
import { daysUntil, parseDate, todayISO } from '../lib/dates'
import { AREA_LABEL, doneDay, useBotItems, type BotArea, type BotItem, type BotStatus } from '../lib/bots'

/** "De mis bots" — the tasks your AI bots left you, shown like the focus cards. */

export const BOT_ACCENT = '#7c3aed'
const URGENT = '#dc2626'
const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 } as const

export const IconBot = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V5M2 13v3M22 13v3" /><circle cx="12" cy="4" r="1" />
    <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

function dueLabel(due: string | null): { text: string; late: boolean } | null {
  const d = due ? parseDate(due) : null
  const days = due ? daysUntil(due) : null
  if (!d || days === null) return null
  const short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (days < 0) return { text: `Overdue · ${short}`, late: true }
  if (days === 0) return { text: 'Today', late: false }
  if (days === 1) return { text: 'Tomorrow', late: false }
  return { text: short, late: false }
}

/** Due today or overdue first, then undated, then upcoming; high priority first within each. */
const focusOrder = (a: BotItem, b: BotItem) => {
  const band = (i: BotItem) => { const d = i.due ? daysUntil(i.due) : null; return d === null ? 1 : d <= 0 ? 0 : 2 }
  return band(a) - band(b)
    || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || (a.due ?? '').localeCompare(b.due ?? '')
    || a.created_at.localeCompare(b.created_at)
}

function BotRow({ item, accent, showArea, onToggle }: { item: BotItem; accent: string; showArea: boolean; onToggle: () => void }) {
  const done = item.status === 'hecha'
  const high = item.priority === 'alta' && !done
  const due = dueLabel(item.due)
  const meta = [showArea ? AREA_LABEL[item.area] : '', `via ${item.bot}`].filter(Boolean).join(' · ')
  return (
    <li className="flex items-start gap-3 text-sm">
      <button onClick={onToggle} className="h-5 w-5 mt-px rounded-md grid place-items-center shrink-0 transition" style={{ border: `2px solid ${high ? URGENT : accent}`, background: done ? accent : 'transparent' }} aria-label={done ? 'Mark not done' : 'Complete task'}>
        {done && <IconCheck width={12} height={12} style={{ color: '#fff' }} />}
      </button>
      <div className="flex-1 min-w-0">
        <div style={{ color: done ? 'var(--color-muted)' : high ? URGENT : 'var(--color-text)', fontWeight: high ? 600 : 400 }}>{item.title}</div>
        {item.notes && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{item.notes}</div>}
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {meta}
          {due && <> · <span style={{ color: due.late && !done ? URGENT : undefined, fontWeight: due.late && !done ? 600 : undefined }}>{due.text}</span></>}
        </div>
      </div>
    </li>
  )
}

/**
 * Open bot tasks, with the ones finished today folded into a single line you
 * can open to untick — the same shape as the business/home focus cards.
 */
export function BotTaskList({ items, accent = BOT_ACCENT, showArea, empty, onToggle }: {
  items: BotItem[]; accent?: string; showArea: boolean; empty: string; onToggle: (item: BotItem) => void
}) {
  const [showDone, setShowDone] = useState(false)
  const today = todayISO()
  const open = items.filter((i) => i.status === 'abierta').sort(focusOrder)
  const done = items.filter((i) => i.status === 'hecha' && doneDay(i) === today)

  return (
    <>
      {open.length === 0 ? (
        <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>
          {done.length > 0 ? `All ${done.length} done for today. 🎉` : empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3 mb-3">
          {open.map((it) => <BotRow key={it.id} item={it} accent={accent} showArea={showArea} onToggle={() => onToggle(it)} />)}
        </ul>
      )}

      {done.length > 0 && (
        <>
          <button onClick={() => setShowDone((v) => !v)} className="text-xs font-semibold flex items-center gap-1.5 mb-2" style={{ color: 'var(--color-muted)' }}>
            <IconCheck width={13} height={13} style={{ color: accent }} />
            {done.length} done today
            <span style={{ opacity: 0.7 }}>{showDone ? '▴' : '▾'}</span>
          </button>
          {showDone && (
            <ul className="flex flex-col gap-3 mb-3">
              {done.map((it) => <BotRow key={it.id} item={it} accent={accent} showArea={showArea} onToggle={() => onToggle(it)} />)}
            </ul>
          )}
        </>
      )}
    </>
  )
}

/** Loading / not-set-up / offline states for a bot list. Nothing once it's ready. */
export function BotStatusNote({ status }: { status: BotStatus }) {
  if (status === 'loading') {
    return <div className="flex flex-col gap-3 py-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
  }
  if (status === 'missing' || status === 'error') {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--color-muted)' }}>
        {status === 'missing'
          ? 'Not connected yet — run the os_items migration in Supabase (see docs/BOT_API.md).'
          : "Can't reach your bots' tasks right now. They'll show up when you're back online."}
      </p>
    )
  }
  return null
}

/** Bot tasks for one area (or all), kept live, with check-off that reports failures. */
export function useBotTasks(area?: BotArea) {
  const { items, status, setDone } = useBotItems()
  const { toast } = useToast()
  const today = todayISO()
  const mine = area ? items.filter((i) => i.area === area) : items
  const visible = mine.filter((i) => i.status === 'abierta' || doneDay(i) === today)
  const toggle = async (item: BotItem) => {
    if (!(await setDone(item.id, item.status !== 'hecha'))) toast("Couldn't update that task — check your connection.")
  }
  return { status, items: visible, openCount: visible.filter((i) => i.status === 'abierta').length, toggle }
}

/**
 * Home tasks page: the home-area tasks bots added. Shown only when there's
 * something to show, so the planner stays as it was the rest of the time.
 */
export function BotHomeTasks() {
  const { status, items, openCount, toggle } = useBotTasks('casa')
  if (status !== 'ready' || items.length === 0) return null
  return (
    <Card className="p-4 mt-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="shrink-0" style={{ color: BOT_ACCENT }}><IconBot width={20} height={20} /></span>
        <div className="min-w-0">
          <h2 className="font-bold text-lg leading-tight" style={{ color: 'var(--color-text)' }}>De mis bots</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Home tasks your bots added{openCount ? ` · ${openCount} open` : ''} — check one off here or on Home.
          </p>
        </div>
      </div>
      <BotTaskList items={items} showArea={false} empty="Nothing open from your bots." onToggle={toggle} />
    </Card>
  )
}
