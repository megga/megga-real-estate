// MEGGA CRM Sugar v2 — Source de vérité pour AgencySection.
// Lit/écrit la ligne agencies du profil courant (agency_id du profile).
// Champs persistés : name, address, city, canton, phone, email, website, logo_url,
// legal_name, legal_form_id, business_registration_number, tva, founded_year,
// postal_code, country, about_short.
//
// `legal_form_id` est une FK vers legal_forms (référentiel) et non plus du texte
// libre : la forme juridique pilote le parcours de vérification KYB, une faute de
// frappe y changerait donc les contrôles exigés. Options via useLegalForms.

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type AgencyPlan = 'starter' | 'pro' | 'agency' | 'enterprise'

export interface AgencySettingsData {
  name: string
  address: string
  city: string
  canton: string
  phone: string
  email: string
  website: string
  logoUrl: string
  legal: string
  /** FK legal_forms.id (chaîne vide = non renseignée) — agencies.legal_form_id. */
  legalFormId: string
  /** IDE/UID en CH, SIREN en FR — agencies.business_registration_number. */
  businessRegistrationNumber: string
  tva: string
  /** Année de création — string côté form, parsée en int au save. */
  foundedYear: string
  postal: string
  country: string
  aboutShort: string
}

const EMPTY_AGENCY: AgencySettingsData = {
  name: '',
  address: '',
  city: '',
  canton: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
  legal: '',
  legalFormId: '',
  businessRegistrationNumber: '',
  tva: '',
  foundedYear: '',
  postal: '',
  country: '',
  aboutShort: '',
}

interface AgencyRow {
  name: string | null
  address: string | null
  city: string | null
  canton: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  legal_name: string | null
  legal_form_id: string | null
  business_registration_number: string | null
  tva: string | null
  founded_year: number | null
  postal_code: string | null
  country: string | null
  about_short: string | null
  plan: AgencyPlan | null
}

interface AgencyQueryResult {
  settings: AgencySettingsData
  plan: AgencyPlan | null
}

export interface UseAgencySettingsReturn {
  agency: AgencySettingsData
  /** Plan d'abonnement de l'agence (lecture seule, non éditable via le form). */
  plan: AgencyPlan | null
  isLoading: boolean
  isSaving: boolean
  hasBackend: boolean
  agencyId: string | null
  save: (next: AgencySettingsData) => Promise<void>
}

/**
 * Réglages de l'agence courante (dérivée de `profile.agency_id`) : hydrate un état
 * local éditable depuis la ligne `agencies` et le persiste via `save()`. `plan` est
 * exposé en lecture seule. `enabled: false` évite de charger hors du contexte Réglages.
 */
export function useAgencySettings(options?: { enabled?: boolean }): UseAgencySettingsReturn {
  const enabled = options?.enabled ?? true
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  const queryClient = useQueryClient()
  const [local, setLocal] = useState<AgencySettingsData>(EMPTY_AGENCY)

  const { data, isLoading } = useQuery({
    queryKey: ['agency-settings', agencyId],
    queryFn: async (): Promise<AgencyQueryResult> => {
      if (!agencyId) return { settings: EMPTY_AGENCY, plan: null }
      const { data: row, error } = await supabase
        .from('agencies')
        .select('name, address, city, canton, phone, email, website, logo_url, legal_name, legal_form_id, business_registration_number, tva, founded_year, postal_code, country, about_short, plan')
        .eq('id', agencyId)
        .single<AgencyRow>()
      if (error) throw error
      return {
        settings: {
          name: row?.name ?? '',
          address: row?.address ?? '',
          city: row?.city ?? '',
          canton: row?.canton ?? '',
          phone: row?.phone ?? '',
          email: row?.email ?? '',
          website: row?.website ?? '',
          logoUrl: row?.logo_url ?? '',
          legal: row?.legal_name ?? '',
          legalFormId: row?.legal_form_id ?? '',
          businessRegistrationNumber: row?.business_registration_number ?? '',
          tva: row?.tva ?? '',
          foundedYear: row?.founded_year != null ? String(row.founded_year) : '',
          postal: row?.postal_code ?? '',
          country: row?.country ?? '',
          aboutShort: row?.about_short ?? '',
        },
        plan: row?.plan ?? null,
      }
    },
    enabled: enabled && !!agencyId,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data) setLocal(data.settings)
  }, [data])

  const mutation = useMutation({
    mutationFn: async (next: AgencySettingsData) => {
      if (!agencyId) throw new Error('Agence non chargée')
      // `name` est NOT NULL dans agencies → on garde la valeur courante si vide.
      if (!next.name.trim()) throw new Error('Le nom de l\'agence est requis')
      // founded_year est un integer en DB : on parse, et NaN → null (jamais d'écriture invalide).
      const parsedYear = next.foundedYear.trim() ? Number.parseInt(next.foundedYear, 10) : null
      const foundedYear = parsedYear != null && Number.isNaN(parsedYear) ? null : parsedYear
      const { error } = await supabase
        .from('agencies')
        .update({
          name: next.name.trim(),
          address: next.address || null,
          city: next.city || null,
          canton: next.canton || null,
          phone: next.phone || null,
          email: next.email || null,
          website: next.website || null,
          logo_url: next.logoUrl || null,
          legal_name: next.legal || null,
          legal_form_id: next.legalFormId || null,
          business_registration_number: next.businessRegistrationNumber || null,
          tva: next.tva || null,
          founded_year: foundedYear,
          postal_code: next.postal || null,
          country: next.country || null,
          about_short: next.aboutShort || null,
        })
        .eq('id', agencyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-settings', agencyId] })
    },
  })

  return {
    agency: local,
    plan: data?.plan ?? null,
    isLoading,
    isSaving: mutation.isPending,
    hasBackend: !!agencyId,
    agencyId,
    save: async (next) => { await mutation.mutateAsync(next) },
  }
}
