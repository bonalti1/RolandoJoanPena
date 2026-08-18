/**
 * Who else's OS you're allowed to work inside.
 *
 * Grants live in Supabase (`os_access`) and are handed out by running one SQL
 * statement — never from inside the app, so nobody can grant themselves access
 * to anybody. This just reads back the grants that already name you, which is
 * how the Team page learns a colleague's user id without anyone copying ids
 * around by hand.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type OsGrant = { ownerId: string; ownerName: string }

export function useOsGrants(): OsGrant[] {
  const [grants, setGrants] = useState<OsGrant[]>([])
  useEffect(() => {
    if (!supabase) return
    let alive = true
    void (async () => {
      const { data: session } = await supabase!.auth.getUser()
      const me = session?.user?.id
      if (!me) return
      const { data, error } = await supabase!
        .from('os_access')
        .select('owner_id, owner_name')
        .eq('delegate_id', me)
      if (error || !data || !alive) return
      setGrants(data.map((r) => ({
        ownerId: r.owner_id as string,
        ownerName: (r.owner_name as string) || 'Their OS',
      })))
    })()
    return () => { alive = false }
  }, [])
  return grants
}
