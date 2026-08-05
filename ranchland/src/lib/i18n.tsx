import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type Lang } from './types.ts'
import { storage } from './storage.ts'

// Every buyer-facing string lives here in both languages. Spanish is a
// first-class experience, not a translation bolted on later.
const STRINGS = {
  tagline: { en: 'Owner-financed ranchettes in South Texas', es: 'Ranchitos con financiamiento del dueño en el sur de Texas' },
  heroLead: {
    en: 'Own your piece of Texas. Simple monthly payments, no banks, and your deed recorded from day one.',
    es: 'Sea dueño de su pedazo de Texas. Pagos mensuales simples, sin bancos, y su escritura registrada desde el primer día.',
  },
  viewLots: { en: 'View available lots', es: 'Ver lotes disponibles' },
  clientLogin: { en: 'Client portal', es: 'Portal del cliente' },
  adminLogin: { en: 'Admin', es: 'Administración' },
  availableLots: { en: 'Available lots', es: 'Lotes disponibles' },
  acres: { en: 'acres', es: 'acres' },
  down: { en: 'down', es: 'de enganche' },
  perMonth: { en: '/month', es: '/mes' },
  sold: { en: 'Sold', es: 'Vendido' },
  reserved: { en: 'Reserved', es: 'Reservado' },
  available: { en: 'Available', es: 'Disponible' },
  howItWorks: { en: 'How it works', es: 'Cómo funciona' },
  how1t: { en: 'Pick your lot', es: 'Escoja su lote' },
  how1b: { en: 'Choose from surveyed ranchette lots with road access.', es: 'Elija entre lotes medidos con acceso por camino.' },
  how2t: { en: 'Low down payment', es: 'Enganche bajo' },
  how2b: { en: 'Put down a small amount and sign — in English or Spanish.', es: 'Dé un enganche pequeño y firme — en inglés o español.' },
  how3t: { en: 'Pay monthly, online', es: 'Pague mensual, en línea' },
  how3b: { en: 'Automatic payments from your bank account. Track everything in your portal.', es: 'Pagos automáticos desde su cuenta de banco. Vea todo en su portal.' },
  how4t: { en: 'The land is yours', es: 'La tierra es suya' },
  how4b: { en: 'You receive the deed at closing; when the note is paid, the lien is released.', es: 'Recibe la escritura al cerrar; al terminar de pagar, se libera el gravamen.' },

  // Portal
  welcome: { en: 'Welcome back', es: 'Bienvenido' },
  yourLand: { en: 'Your land', es: 'Su terreno' },
  balance: { en: 'Balance remaining', es: 'Saldo restante' },
  nextPayment: { en: 'Next payment', es: 'Próximo pago' },
  dueOn: { en: 'due', es: 'vence' },
  paidToDate: { en: 'Paid to date', es: 'Pagado a la fecha' },
  progress: { en: 'Progress to full ownership', es: 'Progreso hacia ser dueño total' },
  autopayOn: { en: 'Autopay is ON', es: 'Pago automático ACTIVADO' },
  autopayOff: { en: 'Autopay is OFF', es: 'Pago automático DESACTIVADO' },
  payNow: { en: 'Make a payment', es: 'Hacer un pago' },
  recentActivity: { en: 'Recent activity', es: 'Actividad reciente' },
  payments: { en: 'Payments', es: 'Pagos' },
  documents: { en: 'Documents', es: 'Documentos' },
  payoff: { en: 'Payoff quote', es: 'Cotización de liquidación' },
  overview: { en: 'Overview', es: 'Resumen' },
  schedule: { en: 'Payment schedule', es: 'Calendario de pagos' },
  date: { en: 'Date', es: 'Fecha' },
  amount: { en: 'Amount', es: 'Monto' },
  method: { en: 'Method', es: 'Método' },
  status: { en: 'Status', es: 'Estado' },
  settled: { en: 'Settled', es: 'Procesado' },
  pending: { en: 'Pending', es: 'Pendiente' },
  returned: { en: 'Returned', es: 'Devuelto' },
  current: { en: 'Current', es: 'Al corriente' },
  late: { en: 'Late', es: 'Atrasado' },
  paidOff: { en: 'Paid off', es: 'Liquidado' },
  interest: { en: 'Interest', es: 'Interés' },
  principal: { en: 'Principal', es: 'Capital' },
  escrow: { en: 'Tax escrow', es: 'Depósito p/ impuestos' },
  payment: { en: 'Payment', es: 'Pago' },
  balanceAfter: { en: 'Balance', es: 'Saldo' },
  payoffAsOf: { en: 'Payoff amount as of', es: 'Monto de liquidación al' },
  payoffNote: {
    en: 'This quote includes per-diem interest and is valid through the date shown. Contact us to complete a payoff — we will release the lien and record it with the county.',
    es: 'Esta cotización incluye interés por día y es válida hasta la fecha indicada. Contáctenos para liquidar — liberaremos el gravamen y lo registraremos con el condado.',
  },
  signOut: { en: 'Sign out', es: 'Cerrar sesión' },
  demoPay: { en: 'Record demo payment', es: 'Registrar pago (demo)' },
  demoBanner: {
    en: 'Demo mode — sample data. Connect Supabase + Stripe to go live.',
    es: 'Modo demostración — datos de ejemplo. Conecte Supabase + Stripe para producción.',
  },
  loginTitle: { en: 'Client portal', es: 'Portal del cliente' },
  loginLead: { en: 'Sign in to see your balance, payments, and documents.', es: 'Inicie sesión para ver su saldo, pagos y documentos.' },
  loginAs: { en: 'Sign in as (demo)', es: 'Entrar como (demo)' },
} as const

export type StringKey = keyof typeof STRINGS

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: StringKey) => string
}

const Ctx = createContext<I18n>({ lang: 'en', setLang: () => {}, t: (k) => STRINGS[k].en })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (storage.get('rl:lang') as Lang) || 'en')
  useEffect(() => { storage.set('rl:lang', lang); document.documentElement.lang = lang }, [lang])
  const t = (k: StringKey) => STRINGS[k][lang]
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx)
}

export function LangToggle() {
  const { lang, setLang } = useI18n()
  return (
    <span className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
      <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
    </span>
  )
}
