// MEGGA CRM Sugar v2 — Source de vérité pour AgencySection.
// Lit/écrit la ligne agencies du profil courant (agency_id du profile).
// Champs persistés : name, address, city, canton, phone, email, website.
// Les anciens champs locaux (legal, ide, foundedYear, country, aboutShort,
// branding, network) ont été retirés de l'UI tant qu'il n'existe pas de
// colonnes en DB — chip pour les réintroduire si besoin (agencies_extended).

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

export function useAgencySettings(): UseAgencySettingsReturn {
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
        .select('name, address, city, canton, phone, email, website, logo_url, plan')
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
        },
        plan: row?.plan ?? null,
      }
    },
    enabled: !!agencyId,
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
