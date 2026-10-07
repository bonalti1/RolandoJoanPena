/**
 * Department documents — PDFs attached to one department in one quarter.
 *
 * Files live in Supabase Storage under the signed-in user's private folder
 * (`<uid>/docs/<company>/<quarter>/<dept>/…`), in the same per-user bucket the
 * journal's recordings use — its policies already lock every file to its
 * owner, so documents need no new setup. The file list itself is kept in the
 * synced store (`companies.docs`), so names and dates appear on every device
 * instantly while the bytes are fetched on demand.
 */
import { supabase } from './supabase'
import { currentUserId } from './cloud'

const BUCKET = 'journal-audio'
const MAX_BYTES = 25 * 1024 * 1024

export type DeptDoc = { name: string; path: string; size: number; ts: number }

export const docKey = (co: string, q: string, dept: string) => `${co}|${q}|${dept}`

export const docsReady = (): boolean => !!supabase && !!currentUserId()

const clean = (name: string) => name.replace(/[^\w.\- ()]/g, '_').slice(-80)

export async function uploadDoc(co: string, q: string, dept: string, file: File): Promise<DeptDoc | null> {
  const uid = currentUserId()
  if (!supabase || !uid) return null
  if (file.size > MAX_BYTES) throw new Error('too_big')
  const ts = Date.now()
  const path = `${uid}/docs/${co}/${q}/${dept}/${ts}_${clean(file.name)}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  })
  if (error) return null
  return { name: file.name, path, size: file.size, ts }
}

/** A short-lived link for viewing or downloading — the file stays private.
 *  Pass `downloadAs` to have the browser save it under its real name. */
export async function docUrl(path: string, downloadAs?: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.storage.from(BUCKET)
      .createSignedUrl(path, 60 * 60, downloadAs ? { download: downloadAs } : undefined)
    return data?.signedUrl ?? null
  } catch { return null }
}

export async function removeDoc(path: string): Promise<void> {
  if (!supabase) return
  try { await supabase.storage.from(BUCKET).remove([path]) } catch { /* list entry is removed regardless */ }
}

export const fmtSize = (b: number): string =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
