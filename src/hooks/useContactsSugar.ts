// MEGGA CRM Sugar v2 — Adapter Supabase → CrmContact[] pour ContactsSugarV2Page.
// Charge tous les contacts de l'agence + leurs dossiers KYC (Sprint 1
// dossier_status), adapte vers les shapes mock que ContactsListPane et
// ContactsDetailPane consomment déjà sans modification.
//
// Pattern aligné sur useMatchingSugar : le hook remplit le registry runtime
// `registerLiveContact` pour que `crmContactById(id)` renvoie la version
// Supabase quand un composant l'appelle (notamment ContactsSugarV2Page
// pour résoudre le contact sélectionné).

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Contact } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import { contactToCrm } from '@/lib/sugarAdapters'
import {
  registerLiveContact,
  resetLiveOverrides,
  type CrmContact,
} from '@/components/crm-sugar/mockData'

export interface UseContactsSugarReturn {
  contacts: CrmContact[]
  isLoading: boolean
}

export function useContactsSugar(): UseContactsSugarReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // 1. Contacts de l'agence (RLS agency-scopée)
  const { data: rawContacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts-sugar', agencyId],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('last_interaction_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: !!agencyId,
  })

  // 2. KYC dossiers acheteurs (pp/pm) pour tous les contacts chargés.
  // Filtre par type buyer_* : un même contact peut avoir plusieurs dossiers
  // (achat + vente), on ne veut que le dossier acheteur pour le matching UI.
  const contactIds = useMemo(() => rawContacts.map(c => c.id), [rawContacts])

  const { data: kycCases = [], isLoading: kycLoading } = useQuery({
    queryKey: ['contacts-sugar-kyc', agencyId, contactIds],
    queryFn: async (): Promise<KycCase[]> => {
      if (!agencyId || contactIds.length === 0) return []
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, contact_id, type, status, dossier_status, risk_level, expires_at, created_at')
        .in('contact_id', contactIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KycCase[]
    },
    enabled: !!agencyId && contactIds.length > 0,
  })

  // 3. Index KYC par contact (premier rencontré = plus récent grâce à l'ORDER BY)
  const kycByContact = useMemo(() => {
    const map = new Map<string, KycCase>()
    for (const k of kycCases) {
      if (!map.has(k.contact_id)) map.set(k.contact_id, k)
    }
    return map
  }, [kycCases])

  // 4. Adapter (pur, pas de side effect dans useMemo)
  const contacts = useMemo<CrmContact[]>(
    () => rawContacts.map(c => contactToCrm(c, kycByContact.get(c.id))),
    [rawContacts, kycByContact],
  )

  // 5. Side effect : remplir le registry runtime après commit. Le mock arrays
  // restent intacts pour les autres pages encore non-câblées Supabase.
  useEffect(() => {
    if (contacts.length === 0) return
    for (const c of contacts) registerLiveContact(c)
  }, [contacts])

  // 6. Cleanup au démontage pour ne pas polluer les autres pages Sugar v2
  // qui consomment encore le mock array via `crmContactById`.
  useEffect(() => {
    return () => { resetLiveOverrides() }
  }, [])

  return {
    contacts,
    isLoading: contactsLoading || kycLoading,
  }
}
