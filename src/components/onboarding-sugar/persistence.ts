// MEGGA Onboarding — Service de persistance Supabase
// Voir migration 20260521_001_onboarding_persistence.sql.
import { supabase } from '@/lib/supabase'
import type { ObAgency, OnboardingData } from './types'
import type { TablesUpdate } from '@/types/database'

// ─── Agencies — autocomplete + create + join ─────────────────────────

type SearchRow = {
  id: string
  name: string
  city: string | null
  canton: string | null
  logo_url: string | null
  member_count: number
}

// Stable hash → couleur d'accent pour le badge "tint" (pas de couleur en DB).
function nameToTint(name: string): string {
  const palette = [
    '#1E5BC6', '#0B0C0E', '#0891B2', '#C45A00',
    '#059669', '#5B7CFA', '#A855F7', '#0EA5E9',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return palette[Math.abs(h) % palette.length]
}

function rowToAgency(r: SearchRow): ObAgency {
  const initials = r.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'AG'
  return {
    id: r.id,
    name: r.name,
    city: r.city ?? '',
    canton: r.canton ?? '',
    agents: Number(r.member_count ?? 0),
    since: new Date().getFullYear(),
    initials,
    tint: nameToTint(r.name),
  }
}

export async function searchAgencies(query: string): Promise<ObAgency[]> {
  const q = query.trim()
  if (q.length === 0) return []
  const { data, error } = await supabase.rpc('search_agencies', { q, lim: 10 })
  if (error) {
    console.warn('[onboarding] search_agencies failed:', error.message)
    return []
  }
  return ((data ?? []) as SearchRow[]).map(rowToAgency)
}

// Dev bypass : si la RPC échoue avec "not_authenticated" en mode dev, on
// retourne un succès fake pour permettre de traverser le wizard sans avoir
// à signup un vrai compte. En prod, comportement strict (error remonte).
function isDevAuthBypass(message: string | undefined): boolean {
  return Boolean(import.meta.env.DEV && message && /not_authenticated/.test(message))
}

// Génère un UUID v4 client-side (pour le fake agencyId en dev bypass).
function devFakeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'dev-' + Math.random().toString(36).slice(2, 14)
}

export async function createAgency(
  name: string,
  city: string,
  canton: string,
  solo: boolean,
): Promise<{ ok: true; agencyId: string } | { ok: false; conflict: boolean; message: string }> {
  const { data, error } = await supabase.rpc('create_agency_and_join', {
    p_name: name,
    p_city: city,
    p_canton: canton,
    p_solo: solo,
  })
  if (error) {
    if (isDevAuthBypass(error.message)) {
      const id = devFakeUuid()
      console.warn(
        '[onboarding] create_agency_and_join: dev bypass (not_authenticated). Fake agencyId:',
        id,
      )
      return { ok: true, agencyId: id }
    }
    const conflict =
      error.code === '23505' ||
      /unique|duplicate/i.test(error.message)
    return { ok: false, conflict, message: error.message }
  }
  return { ok: true, agencyId: String(data) }
}

export async function joinAgency(agencyId: string): Promise<boolean> {
  const { error } = await supabase.rpc('join_agency', { p_agency_id: agencyId })
  if (error) {
    if (isDevAuthBypass(error.message)) {
      console.warn('[onboarding] join_agency: dev bypass (not_authenticated)')
      return true
    }
    console.warn('[onboarding] join_agency failed:', error.message)
    return false
  }
  return true
}

// ─── Storage uploads ─────────────────────────────────────────────────

async function fileToBlob(file: File): Promise<Blob> {
  return file
}

export async function uploadAgencyLogo(
  file: File,
  agencyId: string,
): Promise<string | null> {
  try {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${agencyId}/logo.${ext === 'svg' ? 'svg' : ext}`
    const { error } = await supabase.storage.from('agency-logos').upload(path, await fileToBlob(file), {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    })
    if (error) {
      console.warn('[onboarding] agency logo upload failed:', error.message)
      return null
    }
    const { data } = supabase.storage.from('agency-logos').getPublicUrl(path)
    return `${data.publicUrl}?v=${Date.now()}`
  } catch (e) {
    console.warn('[onboarding] agency logo upload exception:', e)
    return null
  }
}

export async function uploadAgentAvatar(
  file: File,
  userId: string,
): Promise<string | null> {
  try {
    const path = `${userId}/avatar.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    })
    if (error) {
      console.warn('[onboarding] avatar upload failed:', error.message)
      return null
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return `${data.publicUrl}?v=${Date.now()}`
  } catch (e) {
    console.warn('[onboarding] avatar upload exception:', e)
    return null
  }
}

// ─── Profile saves ───────────────────────────────────────────────────

export async function saveAgentProfile(
  userId: string,
  data: OnboardingData,
): Promise<boolean> {
  const ap = data.agentProfile
  if (!ap) return true
  const fullName = `${ap.firstName?.trim() ?? ''} ${ap.lastName?.trim() ?? ''}`.trim()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName || undefined,
      phone: ap.phone?.trim() || null,
      avatar_url: ap.avatar ?? null,
      agent_role: ap.role,
      spoken_languages: ap.languages,
    })
    .eq('id', userId)
  if (error) {
    console.warn('[onboarding] saveAgentProfile failed:', error.message)
    return false
  }
  return true
}

export async function saveAgencyProfile(
  agencyId: string,
  patch: {
    name?: string
    city?: string
    canton?: string
    street?: string
    npa?: string
    phone?: string
    website?: string
    logoUrl?: string | null
  },
): Promise<boolean> {
  // Compose address from street + npa + city if provided
  const address = [
    patch.street?.trim(),
    [patch.npa?.trim(), patch.city?.trim()].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ') || undefined

  const updates: Record<string, unknown> = {
    name: patch.name?.trim() || undefined,
    city: patch.city?.trim() || undefined,
    canton: patch.canton || undefined,
    website: patch.website?.trim() || undefined,
    phone: patch.phone?.trim() || undefined,
    address,
    logo_url: patch.logoUrl ?? undefined,
  }
  // Strip undefined to avoid wiping existing values
  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k])
  if (Object.keys(updates).length === 0) return true

  const { error } = await supabase
    .from('agencies')
    .update(updates as TablesUpdate<'agencies'>)
    .eq('id', agencyId)
  if (error) {
    console.warn('[onboarding] saveAgencyProfile failed:', error.message)
    return false
  }
  return true
}
