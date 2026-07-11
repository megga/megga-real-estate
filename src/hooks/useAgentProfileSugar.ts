// MEGGA CRM Sugar v2 — Source de vérité pour ProfileSection (Réglages).
// Lit/écrit le profile agent à travers 3 tables :
//   - `profiles`        : full_name, phone, mobile_phone, agent_role, rcc,
//                         email_signature, email_signature_html, signature_mode,
//                         email, avatar_url, agency_id
//   - `agencies`        : name (champ `agency` lecture seule côté ce form)
//   - `agent_profiles`  : bio, languages, specialties (annuaire public)
//
// Mapping ProfileData ↔ DB :
//   firstName/lastName : split de profiles.full_name (et stockés aussi sur agent_profiles)
//   email              : profiles.email (read-only — passe par auth.users)
//   phone              : profiles.phone (ligne fixe)
//   mobile             : profiles.mobile_phone
//   title              : profiles.agent_role
//   rcc                : profiles.rcc
//   agency             : agencies.name via agency_id (read-only)
//   bio                : agent_profiles.bio
//   languages          : agent_profiles.languages
//   specialties        : agent_profiles.specialties
//   signature          : profiles.email_signature (texte)
//   signatureHtml      : profiles.email_signature_html
//   signatureMode      : profiles.signature_mode ('text' | 'html')
//   avatarUrl          : profiles.avatar_url (hydratation initiale — écriture
//     gérée par useAvatar : upload bucket `avatars` + update avatar_url).

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  DEFAULT_PROFILE,
  type ProfileData,
} from '@/components/crm-sugar/settings/data'

// Champs persistés via save() — tout le formulaire est désormais sauvegardé.
// `avatarUrl` est persisté séparément par useAvatar (upload Storage + avatar_url),
// donc absent de cette liste qui couvre uniquement le payload de save().

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? '').trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(/\s+/)
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '??'
}

// Couleur d'avatar déterministe depuis l'id (stable entre re-renders)
function avatarBgFromId(id: string): string {
  const tones = ['#0041D9', '#0E9F6E', '#E53935', '#F59E0B', '#7C3AED', '#0EA5E9']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return tones[Math.abs(h) % tones.length]
}

interface ProfileJoinRow {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  mobile_phone: string | null
  agent_role: string | null
  rcc: string | null
  email_signature: string | null
  email_signature_html: string | null
  signature_mode: string | null
  avatar_url: string | null
  agency_id: string | null
  agencies: { name: string | null } | { name: string | null }[] | null
  agent_profile: { bio: string | null; languages: string[] | null; specialties: string[] | null } | { bio: string | null; languages: string[] | null; specialties: string[] | null }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export interface UseAgentProfileSugarReturn {
  profile: ProfileData
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean   // false → utilisateur non connecté, save() est un no-op
  save: (next: ProfileData) => Promise<void>
}

export function useAgentProfileSugar(options?: { enabled?: boolean }): UseAgentProfileSugarReturn {
  const enabled = options?.enabled ?? true
  const { profile: authProfile } = useAuth()
  const profileId = authProfile?.id
  const queryClient = useQueryClient()

  const { data: row, isLoading } = useQuery({
    queryKey: ['agent-profile-sugar', profileId],
    queryFn: async (): Promise<ProfileJoinRow | null> => {
      if (!profileId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, mobile_phone, agent_role, rcc, email_signature, email_signature_html, signature_mode, avatar_url, agency_id, agencies:agencies!agency_id(name), agent_profile:agent_profiles!profile_id(bio, languages, specialties)')
        .eq('id', profileId)
        .single()
      if (error) throw error
      return data as unknown as ProfileJoinRow
    },
    enabled: enabled && !!profileId,
    staleTime: 60_000,
  })

  // Adapt row → ProfileData. Tous les champs sont désormais hydratés depuis la DB.
  const fetched = useMemo<ProfileData | null>(() => {
    if (!row) return null
    const agency = unwrap(row.agencies)
    const agent = unwrap(row.agent_profile)
    const { firstName, lastName } = splitName(row.full_name ?? '')
    return {
      firstName,
      lastName,
      title: row.agent_role ?? '',
      agency: agency?.name ?? '',
      email: row.email,
      phone: row.phone ?? '',
      mobile: row.mobile_phone ?? '',
      rcc: row.rcc ?? '',
      languages: agent?.languages ?? [],
      specialties: agent?.specialties ?? [],
      bio: agent?.bio ?? '',
      signature: row.email_signature ?? '',
      signatureHtml: row.email_signature_html ?? '',
      signatureMode: row.signature_mode === 'html' ? 'html' : 'text',
      avatarUrl: row.avatar_url ?? null,
      initials: initialsOf(firstName, lastName),
      avatarBg: avatarBgFromId(row.id),
    }
  }, [row])

  // Profile retourné : DB si dispo, sinon defaults vides (PAS le mock "Gregory")
  const profile = useMemo<ProfileData>(() => {
    if (fetched) return fetched
    // Fallback empty pour les utilisateurs non connectés (preview, demo)
    return {
      ...DEFAULT_PROFILE,
      firstName: '', lastName: '', title: '', agency: '',
      email: '', phone: '', mobile: '', rcc: '',
      languages: [], specialties: [], bio: '', signature: '',
      signatureMode: 'text', signatureHtml: '', avatarUrl: null,
      initials: '?', avatarBg: '#7A8088',
    }
  }, [fetched])

  const mutation = useMutation({
    mutationFn: async (next: ProfileData) => {
      if (!profileId) throw new Error('Profil non chargé')

      // 1. profiles : identité + contact + signature.
      //    avatar_url N'EST PAS écrit ici — géré par useAvatar (upload Storage).
      const full_name = `${next.firstName} ${next.lastName}`.trim()
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name,
          phone: next.phone || null,
          mobile_phone: next.mobile || null,
          agent_role: next.title || null,
          rcc: next.rcc || null,
          email_signature: next.signature || null,
          email_signature_html: next.signatureHtml || null,
          signature_mode: next.signatureMode || 'text',
        })
        .eq('id', profileId)
      if (pErr) throw pErr

      // 2. agent_profiles : upsert sur profile_id (bio + languages + specialties)
      // Le record peut ne pas exister encore (cas agent freshly onboarded).
      const { data: existing } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle()

      if (existing?.id) {
        const { error: aErr } = await supabase
          .from('agent_profiles')
          .update({
            first_name: next.firstName || '',
            last_name: next.lastName || '',
            bio: next.bio || null,
            languages: next.languages,
            specialties: next.specialties,
            phone: next.phone || null,
          })
          .eq('id', existing.id)
        if (aErr) throw aErr
      }
      // Note : si pas de record agent_profiles, on ne le crée pas ici (besoin
      // d'un slug unique). À gérer lors de l'onboarding ou via un Edge Function
      // dédié. C'est OK : l'agent peut sauvegarder profiles, le reste reviendra
      // en sync quand son agent_profile sera créé.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-profile-sugar', profileId] })
    },
  })

  return {
    profile,
    isLoading,
    isSaving: mutation.isPending,
    hasBackend: !!profileId,
    save: async (next) => { await mutation.mutateAsync(next) },
  }
}

// Helper exposé pour les tests / debug — liste des champs effectivement persistés
