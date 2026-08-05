import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Live backend (Phase 1 cutover). Until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are set, the app runs entirely on the demo data layer in store.ts.
// Schema: see supabase/schema.sql

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null
export const isLive = supabase !== null
