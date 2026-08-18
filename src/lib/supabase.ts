import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional cloud backend. The app is fully offline-first; when these two env
 * vars are present (set in Netlify), the dashboard also backs everything up to
 * your own Supabase project and syncs it across every device you sign in on.
 *
 * When the vars are absent, `supabase` is null and the app behaves exactly as
 * before — local-only, zero setup. Nothing breaks either way.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

/**
 * A malformed URL makes createClient throw while this module is still loading,
 * which takes the whole app down to a blank white screen — a mistyped Netlify
 * variable should never do that. If the client can't be built, the dashboard
 * simply runs local-only and says so.
 */
function connect(): SupabaseClient | null {
  if (!url || !anonKey) return null
  try {
    return createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch (e) {
    console.error('Supabase is not configured correctly — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.', e)
    return null
  }
}

export const supabase: SupabaseClient | null = connect()
/** True only when the cloud is actually reachable, not merely configured. */
export const cloudConfigured = !!supabase
