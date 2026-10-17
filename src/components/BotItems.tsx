import { useState, type SVGProps } from 'react'
import { Card, Skeleton } from './ui'
import { IconCheck } from './icons'
import { useToast } from '../lib/toast'
import { daysUntil, parseDate, todayISO } from '../lib/dates'
import { AREA_LABEL, doneDay, useBotItems, type BotArea, type BotEvent, type BotItem, type BotStatus } from '../lib/bots'

/**
 * What your AI bots left you, shown like the focus cards:
 *  • "Esperando por ti" — needs_me tasks: only you can do or approve them.
 *  • "De mis bots" — every other task a bot added.
 *  • Today's events a bot sent (school, the kids' activities).
 */

export const BOT_ACCENT = '#7c3aed'
export const WAITING_ACCENT = '#d97706'
export const EVENT_ACCENT = '#0891b2'
const URGENT = '#dc2626'
const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 } as const

export const IconBot = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V5M2 13v3M22 13v3" /><circle cx="12" cy="4" r="1" />
    <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
export const IconWaiting = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />
  </svg>
)
export const IconEvent = (p: SVGProps<SVGSVGElement>) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

/** The first web link in a note — a PR, a script's doc, a cart. */
const firstUrl = (s: string): string | undefined => /https?:\/\/[^\s<>"')]+/.exec(s)?.[0]

export const fmtTime = (t?: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

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
  const link = firstUrl(item.notes)
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
          {link && <> · <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold" style={{ color: 'var(--color-accent)' }}>Open ↗</a></>}
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

/**
 * Bot tasks for one area (or all), kept live, split into the ones waiting
 * for you (needs_me) and the rest, with check-off that reports failures.
 */
export function useBotTasks(area?: BotArea) {
  const { items, status, setDone } = useBotItems()
  const { toast } = useToast()
  const today = todayISO()
  const visible = items.filter((i) => (!area || i.area === area) && (i.status === 'abierta' || doneDay(i) === today))
  const toggle = async (item: BotItem) => {
    if (!(await setDone(item.id, item.status !== 'hecha'))) toast("Couldn't update that task — check your connection.")
  }
  const open = (list: BotItem[]) => list.filter((i) => i.status === 'abierta').length
  const tasks = visible.filter((i) => !i.needs_me)
  const waiting = visible.filter((i) => i.needs_me)
  return { status, tasks, waiting, openCount: open(tasks), waitingCount: open(waiting), toggle }
}

/**
 * Home tasks page: the home-area tasks bots added. Shown only when there's
 * something to show, so the planner stays as it was the rest of the time.
 */
export function BotHomeTasks() {
  const { status, tasks, openCount, toggle } = useBotTasks('casa')
  if (status !== 'ready' || tasks.length === 0) return null
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
      <BotTaskList items={tasks} showArea={false} empty="Nothing open from your bots." onToggle={toggle} />
    </Card>
  )
}

/** A day's bot events: time (or all day), title, notes, who sent it. */
export function BotEventList({ events, onRemove }: { events: BotEvent[]; onRemove?: (e: BotEvent) => void }) {
  const sorted = [...events].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
  return (
    <ul className="flex flex-col gap-3">
      {sorted.map((e) => (
        <li key={e.id} className="group flex items-start gap-3 text-sm">
          <span className="text-xs font-semibold w-[72px] shrink-0 pt-0.5 tnum" style={{ color: EVENT_ACCENT }}>
            {e.start_time ? fmtTime(e.start_time) : 'All day'}
          </span>
          <div className="flex-1 min-w-0">
            <div style={{ color: 'var(--color-text)' }}>{e.title}</div>
            {e.notes && <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-muted)' }}>{e.notes}</div>}
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
              {[AREA_LABEL[e.area], e.end_time ? `until ${fmtTime(e.end_time)}` : '', `via ${e.bot}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          {onRemove && (
            <button onClick={() => onRemove(e)} className="opacity-0 group-hover:opacity-60 text-xs shrink-0" style={{ color: 'var(--color-muted)' }} aria-label="Remove event">✕</button>
          )}
        </li>
      ))}
    </ul>
  )
}
