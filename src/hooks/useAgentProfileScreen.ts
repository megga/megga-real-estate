// MEGGA CRM Sugar v2 — Source de vérité pour ProfileSection (Réglages).
// Lit/écrit le profile agent à travers 3 tables :
//   - `profiles`        : full_name, agent_role, rcc,  (phone/mobile_phone : LUS seulement)
//                         email_signature, email_signature_html, signature_mode,
//                         email, avatar_url, agency_id
//   - `agencies`        : name (champ `agency` lecture seule côté ce form)
//   - `agent_profiles`  : bio, languages, specialties (annuaire public)
//
// Mapping ProfileData ↔ DB :
//   firstName/lastName : split de profiles.full_name (et stockés aussi sur agent_profiles)
//   email              : profiles.email (read-only — passe par auth.users)
//   phone              : profiles.phone — LECTURE SEULE depuis le 17.08.2026. La colonne
//                        appartient au trigger de vérification WhatsApp ; save() n'y
//                        touche plus (cf. le commentaire de la mutation).
//   mobile             : profiles.mobile_phone — idem, plus aucune UI ne le règle.
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
} from '@/components/crm/settings/data'

// Champs persistés via save() — tout le formulaire est désormais sauvegardé.
// `avatarUrl` est persisté séparément par useAvatar (upload Storage + avatar_url),
// donc absent de cette liste qui couvre uniquement le payload de save().

/** Sépare un nom complet en prénom / nom (premier mot vs. le reste). */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName ?? '').trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(/\s+/)
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

/** Initiales majuscules depuis prénom + nom (`??` si vides). */
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
  agent_profile:
    | { bio: string | null; languages: string[] | null; specialties: string[] | null; website_url: string | null; linkedin_url: string | null }
    | { bio: string | null; languages: string[] | null; specialties: string[] | null; website_url: string | null; linkedin_url: string | null }[]
    | null
}

/** Déballe une relation Supabase (objet ou tableau) en un seul enregistrement ou null. */
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export interface UseAgentProfileScreenReturn {
  profile: ProfileData
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean   // false → utilisateur non connecté, save() est un no-op
  /**
   * false → aucune ligne `agent_profiles` pour cet agent. save() ne PEUT PAS
   * persister bio/languages/specialties/website/linkedin (UPDATE-only + INSERT
   * réservé au super-admin par RLS). L'UI doit alors éviter d'afficher un faux
   * « Enregistré » sur ces champs d'annuaire.
   */
  hasAgentProfile: boolean
  save: (next: ProfileData) => Promise<void>
}

/**
 * Source de vérité du ProfileSection (Réglages) : joint `profiles` + `agencies`
 * + `agent_profiles` en un `ProfileData` éditable et le persiste via `save()`.
 * Fallback vide (jamais le mock) hors session ; `hasAgentProfile` signale si les
 * champs d'annuaire (bio, langues…) sont réellement persistables.
 */
export function useAgentProfileScreen(options?: { enabled?: boolean }): UseAgentProfileScreenReturn {
  const enabled = options?.enabled ?? true
  const { profile: authProfile } = useAuth()
  const profileId = authProfile?.id
  const queryClient = useQueryClient()

  const { data: row, isLoading } = useQuery({
    queryKey: ['agent-profile', profileId],
    queryFn: async (): Promise<ProfileJoinRow | null> => {
      if (!profileId) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, mobile_phone, agent_role, rcc, email_signature, email_signature_html, signature_mode, avatar_url, agency_id, agencies:agencies!agency_id(name), agent_profile:agent_profiles!profile_id(bio, languages, specialties, website_url, linkedin_url)')
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
      website: agent?.website_url ?? '',
      linkedin: agent?.linkedin_url ?? '',
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
      website: '', linkedin: '',
      signatureMode: 'text', signatureHtml: '', avatarUrl: null,
      initials: '?', avatarBg: '#7A8088',
    }
  }, [fetched])

  const mutation = useMutation({
    mutationFn: async (next: ProfileData) => {
      if (!profileId) throw new Error('Profil non chargé')

      // 1. profiles : identité + signature.
      //    avatar_url N'EST PAS écrit ici — géré par useAvatar (upload Storage).
      //
      // ⛔ `phone` ET `mobile_phone` NE SONT PLUS ÉCRITS, et les retirer est un CORRECTIF,
      // pas un nettoyage. Depuis le 17.08.2026, `profiles.phone` appartient au trigger
      // `trg_sync_profile_phone_from_wa_link` : c'est le numéro WhatsApp VÉRIFIÉ, et les
      // deux champs de saisie ont quitté l'écran. Or ce `update` partait à chaque
      // enregistrement de N'IMPORTE QUEL champ — prénom, fonction, bio — en réécrivant
      // `phone` depuis `next`, c'est-à-dire depuis un instantané client que rien
      // n'invalide (la requête `['agent-profile']` a `staleTime: 60_000`, et aucune
      // mutation de `useWhatsAppPairing` ne la touche).
      //
      // Le parcours qui perdait la donnée est exactement celui que cette série crée :
      // vérifier son numéro, revenir sur Profil dans la minute, corriger sa « Fonction »
      // → le cache rend encore `phone: ''` → `phone` repart à NULL. Le numéro vérifié
      // disparaissait des trois surfaces clientes (réception acheteur, e-mails de
      // matching, RDV d'accueil) SANS qu'aucun écran ne puisse le montrer ni le
      // restaurer : seule une déliaison suivie d'une nouvelle vérification y parvenait.
      //
      // ⚠ `mobile_phone` part avec, pour la même raison inverse : plus aucune UI ne le
      // règle, donc l'écrire ne peut plus rien faire d'autre que l'effacer.
      const full_name = `${next.firstName} ${next.lastName}`.trim()
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          full_name,
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
            // ⛔ `phone` RETIRÉ de cette écriture le 17.08.2026, même motif que sur
            // `profiles` : le numéro n'est plus une donnée de formulaire, il vient de la
            // vérification WhatsApp (`trg_sync_profile_phone_from_wa_link` → `profiles.phone`).
            // Le recopier ici depuis l'instantané client fabriquait une SECONDE copie que
            // rien ne tient à jour : vérifier un nouveau numéro corrigeait `profiles`, et
            // `agent_profiles` gardait l'ancien jusqu'à la prochaine sauvegarde du profil.
            // ⚠ La table compte 0 ligne en production (mesuré le 17.08) — la dérive n'a
            // donc jamais eu lieu. C'est le moment de la fermer, pas après.
            website_url: next.website || null,
            linkedin_url: next.linkedin || null,
          })
          .eq('id', existing.id)
        if (aErr) throw aErr
      }
      // Note : si pas de record agent_profiles, on ne le crée pas ici (besoin
      // d'un slug unique). À gérer via un Edge Function dédié. C'est OK :
      // l'agent peut sauvegarder profiles, le reste reviendra en sync quand
      // son agent_profile sera créé.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-profile', profileId] })
    },
  })

  const hasAgentProfile = !!(row && unwrap(row.agent_profile))

  return {
    profile,
    isLoading,
    isSaving: mutation.isPending,
    hasBackend: !!profileId,
    hasAgentProfile,
    save: async (next) => { await mutation.mutateAsync(next) },
  }
}

// Helper exposé pour les tests / debug — liste des champs effectivement persistés
