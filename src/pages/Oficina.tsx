import { useEffect, useState } from 'react'
import { useToast } from '../lib/toast'
import { BotStatusNote } from '../components/BotItems'
import {
  MAIN_BOTS, OTHER_BOTS, STATE_COLOR, STATE_LABEL, greeting, useOffice,
  type OfficeBot, type OfficeState,
} from '../lib/office'

/**
 * Oficina — a virtual office of your bots. Pure black, monochrome; the only
 * color is the status: green working, yellow needs you, lavender paused.
 * Data is live (os_items + os_bot_activity via Supabase realtime).
 */

const SERIF = 'Georgia, "Times New Roman", serif'
const INK = '#fff'
const DIM = 'rgba(255,255,255,0.55)'
const LINE = 'rgba(255,255,255,0.12)'
const PANEL = 'rgba(255,255,255,0.05)'

// ── Robot art ───────────────────────────────────────────────────────────────

/** A robot at its desk, 3/4 view. Used until public/robots/robot-N.png exists. */
function RobotSvg() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="rb-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2f2f2" /><stop offset="1" stopColor="#9a9a9a" />
        </linearGradient>
        <linearGradient id="rb-desk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4a4a" /><stop offset="1" stopColor="#1c1c1c" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="46" ry="7" fill="rgba(255,255,255,0.07)" />
      {/* chair + body */}
      <rect x="44" y="58" width="32" height="26" rx="9" fill="url(#rb-body)" />
      <rect x="48" y="62" width="24" height="5" rx="2.5" fill="rgba(0,0,0,0.18)" />
      {/* head */}
      <path d="M60 24v-7" stroke="#bdbdbd" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="14.5" r="3" fill="#e8e8e8" />
      <rect x="40" y="24" width="40" height="32" rx="11" fill="url(#rb-body)" />
      <rect x="45" y="31" width="30" height="17" rx="7" fill="#101010" />
      <circle cx="54" cy="39.5" r="3.2" fill="#fff" />
      <circle cx="66" cy="39.5" r="3.2" fill="#fff" />
      {/* arms to keyboard */}
      <path d="M44 66 34 80M76 66l10 14" stroke="#bdbdbd" strokeWidth="5" strokeLinecap="round" />
      {/* desk top (3/4 parallelogram) + front */}
      <path d="M14 82 34 74h72l-20 8Z" fill="#5c5c5c" />
      <path d="M14 82h72v10H14Z" fill="url(#rb-desk)" />
      <path d="M86 82l20-8v10l-20 8Z" fill="#262626" />
      <path d="M20 92v12M80 92v12M100 84v20" stroke="#303030" strokeWidth="3" strokeLinecap="round" />
      {/* monitor */}
      <path d="M70 60h26l-3 14H70Z" fill="#1a1a1a" stroke="#6a6a6a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M74 64h16M74 68h11" stroke="#8a8a8a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/** Image from public/robots if it exists, otherwise the SVG. */
function RobotArt({ n, paused }: { n: number; paused: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="w-full aspect-square" style={{ opacity: paused ? 0.45 : 1, transition: 'opacity .3s' }}>
      {broken ? <RobotSvg /> : (
        <img src={`/robots/robot-${n}.png`} alt="" draggable={false} loading="lazy"
          onError={() => setBroken(true)} className="w-full h-full object-contain select-none" />
      )}
    </div>
  )
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Dots({ color }: { color: string }) {
  return (
    <span className="inline-flex gap-[2px] leading-none" aria-label="trabajando" style={{ color }}>
      {[0, 1, 2].map((i) => <span key={i} className="dot-blink text-[9px]" style={{ animationDelay: `${i * 0.2}s` }}>•</span>)}
    </span>
  )
}

function Pill({ bot, short }: { bot: OfficeBot; short?: boolean }) {
  const color = STATE_COLOR[bot.state]
  return (
    <span className="relative z-10 inline-flex items-center gap-1 max-w-full min-w-0 rounded-full px-2 py-[3px] text-[10px] font-semibold"
      style={{ background: '#0b0b0b', border: `1px solid ${LINE}`, color: INK }}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="truncate min-w-0">{short ? bot.short ?? bot.name : bot.name}</span>
      {bot.state === 'needs' && <span className="shrink-0 tnum" style={{ color: STATE_COLOR.needs }}>{bot.pending.length}</span>}
      {bot.state === 'working' && <Dots color={color} />}
    </span>
  )
}

function BotButton({ bot, onOpen, short }: { bot: OfficeBot; onOpen: (b: OfficeBot) => void; short?: boolean }) {
  return (
    <button onClick={() => onOpen(bot)} className="flex flex-col items-center gap-0.5 w-full min-w-0 active:scale-95 transition-transform"
      aria-label={`${bot.name}, ${STATE_LABEL[bot.state]}`}>
      <Pill bot={bot} short={short} />
      <div className={`w-[88%] pointer-events-none ${bot.state === 'working' ? 'bot-float' : ''}`}><RobotArt n={bot.image} paused={bot.state === 'paused'} /></div>
    </button>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px]" style={{ color: DIM }}>
      {(['working', 'needs', 'paused'] as OfficeState[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLOR[s] }} />{STATE_LABEL[s]}
        </span>
      ))}
    </div>
  )
}

/** Mini avatar: the robot's head, small. */
function Mini({ bot }: { bot: OfficeBot }) {
  return (
    <span className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 grid place-items-center"
      style={{ background: '#161616', border: `1px solid ${STATE_COLOR[bot.state]}55` }}>
      <span className="w-[130%] h-[130%] block" style={{ marginTop: '4%' }}><RobotArt n={bot.image} paused={bot.state === 'paused'} /></span>
    </span>
  )
}

// ── Sheet ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`
}

function BotSheet({ bot, onClose, onDone }: { bot: OfficeBot; onClose: () => void; onDone: (id: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const color = STATE_COLOR[bot.state]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={bot.name}>
      <div className="absolute inset-0 fade-in" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose} />
      <div className="sheet-up relative w-full max-w-md max-h-[85dvh] overflow-y-auto overflow-x-clip rounded-t-3xl px-5 pt-3 min-w-0"
        style={{ background: '#0b0b0b', border: `1px solid ${LINE}`, color: INK, paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto h-1 w-10 rounded-full mb-4" style={{ background: LINE }} />
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-16 w-16 shrink-0"><RobotArt n={bot.image} paused={bot.state === 'paused'} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold truncate" style={{ fontFamily: SERIF }}>{bot.name}</h2>
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color }}>
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />{STATE_LABEL[bot.state]}
              {bot.state === 'working' && <Dots color={color} />}
            </span>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="h-9 w-9 shrink-0 rounded-full text-lg" style={{ background: PANEL, color: DIM }}>✕</button>
        </div>

        <h3 className="mt-5 mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: DIM }}>Ahora</h3>
        <p className="text-sm break-words" style={{ color: bot.now ? INK : DIM }}>
          {bot.now || (bot.state === 'needs' ? 'Esperando por ti.' : 'Sin actividad en este momento.')}
        </p>

        <h3 className="mt-5 mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: DIM }}>Últimas 3 acciones</h3>
        {bot.recent.length === 0 ? (
          <p className="text-sm" style={{ color: DIM }}>Todavía nada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {bot.recent.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm min-w-0">
                <span className="mt-[7px] h-1 w-1 rounded-full shrink-0" style={{ background: DIM }} />
                <span className="min-w-0 flex-1 break-words">{a.text}</span>
                <span className="text-[11px] shrink-0 pt-0.5" style={{ color: DIM }}>{timeAgo(a.at)}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 mb-1.5 text-[11px] uppercase tracking-[0.14em]" style={{ color: DIM }}>Te pide</h3>
        {bot.pending.length === 0 ? (
          <p className="text-sm" style={{ color: DIM }}>Nada pendiente.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bot.pending.map((it) => (
              <li key={it.id} className="rounded-2xl p-3 min-w-0" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                <div className="text-sm font-medium break-words">{it.title}</div>
                {it.notes && <div className="text-xs mt-1 break-words line-clamp-3" style={{ color: DIM }}>{it.notes}</div>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => onDone(it.id)} className="flex-1 rounded-full py-2 text-sm font-semibold" style={{ background: INK, color: '#000' }}>Aprobar</button>
                  <button onClick={() => onDone(it.id)} className="flex-1 rounded-full py-2 text-sm font-semibold" style={{ border: `1px solid ${LINE}`, color: INK }}>Hecho</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Oficina() {
  const [tick, setTick] = useState(0)
  const [view, setView] = useState<'main' | 'others'>('main')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const { bots, status, setDone, pendingTotal } = useOffice(tick)
  const { toast } = useToast()

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const complete = async (id: string) => {
    if (!(await setDone(id, true))) toast('No se pudo actualizar — revisa tu conexión.')
  }
  const byKey = new Map(bots.map((b) => [b.key, b]))
  const main = MAIN_BOTS.map((d) => byKey.get(d.key)!)
  const others = OTHER_BOTS.map((d) => byKey.get(d.key)!)
  const active = bots.filter((b) => b.state === 'working').length
  const open = openKey ? byKey.get(openKey) ?? null : null
  // Everything waiting on you, from the 17 known bots.
  const asks = bots.flatMap((b) => b.pending.map((it) => ({ it, bot: b })))

  return (
    <div className="-mx-5 sm:-mx-6 md:-mx-10 -mt-6 md:-mt-8 -mb-28 lg:-mb-8 px-5 sm:px-6 md:px-10 pt-6 pb-32 lg:pb-10 min-h-full overflow-x-clip min-w-0"
      style={{ background: '#000', color: INK, minHeight: '100dvh' }}>
      <div className="max-w-md mx-auto min-w-0">
        {view === 'others' ? (
          <div className="fade-in">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setView('main')} aria-label="Volver" className="h-10 w-10 rounded-full grid place-items-center text-lg shrink-0"
                style={{ background: PANEL, border: `1px solid ${LINE}` }}>←</button>
              <div className="min-w-0">
                <h1 className="text-xl truncate" style={{ fontFamily: SERIF }}>Otras oficinas</h1>
                <p className="text-xs" style={{ color: DIM }}>{others.filter((b) => b.state === 'working').length} activos · {others.reduce((n, b) => n + b.pending.length, 0)} te esperan</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
              {others.map((b) => <BotButton key={b.key} bot={b} onOpen={(x) => setOpenKey(x.key)} />)}
            </div>
            <div className="mt-6"><Legend /></div>
          </div>
        ) : (
          <div className="fade-in">
            <div className="flex items-baseline justify-between gap-3 min-w-0">
              <h1 className="text-xl truncate" style={{ fontFamily: SERIF }}>Tu equipo ahora</h1>
              <span className="text-xs shrink-0" style={{ color: STATE_COLOR.working }}>● {active} activos</span>
            </div>
            <p className="text-sm mt-1" style={{ color: DIM }}>
              {greeting()}, Rolando · {pendingTotal} {pendingTotal === 1 ? 'cosa te espera' : 'cosas te esperan'}
            </p>

            <BotStatusNote status={status} />

            {/* The circle: 8 desks around the name. */}
            <div className="relative w-full aspect-square mt-4">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[26px] tracking-[0.18em] font-light" style={{ fontFamily: SERIF }}>BONALTI</span>
                <span className="text-[9px] tracking-[0.5em] mt-1" style={{ color: DIM }}>OFICINA</span>
              </div>
              {main.map((b, i) => {
                const a = (i / main.length) * 2 * Math.PI - Math.PI / 2
                return (
                  <div key={b.key} className="absolute w-[27%] min-w-0"
                    style={{ left: `${50 + 36 * Math.cos(a)}%`, top: `${50 + 36 * Math.sin(a)}%`, marginLeft: '-13.5%', marginTop: '-14.5%' }}>
                    <BotButton bot={b} short onOpen={(x) => setOpenKey(x.key)} />
                  </div>
                )
              })}
            </div>
            <div className="mt-2"><Legend /></div>

            <button onClick={() => setView('others')} className="mt-6 w-full flex items-center gap-3 rounded-2xl p-3.5 text-left min-w-0 active:scale-[0.99] transition-transform"
              style={{ background: PANEL, border: `1px solid ${LINE}` }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Otras oficinas →</div>
                <div className="text-xs" style={{ color: DIM }}>{others.length} equipos más</div>
              </div>
              <div className="flex -space-x-2 shrink-0">
                {others.slice(0, 5).map((b) => <Mini key={b.key} bot={b} />)}
              </div>
            </button>

            <h2 className="mt-7 mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: DIM }}>
              Te necesita · {pendingTotal} {pendingTotal === 1 ? 'cosa' : 'cosas'}
            </h2>
            {asks.length === 0 ? (
              <p className="text-sm" style={{ color: DIM }}>Todo en orden. Nada espera por ti.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {asks.map(({ it, bot }) => (
                  <li key={it.id} className="flex items-center gap-3 rounded-2xl p-3 min-w-0" style={{ background: PANEL, border: `1px solid ${LINE}` }}>
                    <button onClick={() => setOpenKey(bot.key)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm break-words line-clamp-2">{it.title}</div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: DIM }}>{bot.name}</div>
                    </button>
                    <button onClick={() => complete(it.id)} className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: INK, color: '#000' }}>Hecho</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {open && <BotSheet bot={open} onClose={() => setOpenKey(null)} onDone={complete} />}
    </div>
  )
}
