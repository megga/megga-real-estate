// MEGGA CRM Sugar v2 — Adapter Supabase → CrmDeal[] pour PipelineSugarV2Page.
// Charge les transactions de l'agence + contacts + KYC + properties associés,
// remplit le registry runtime (registerLiveContact/Bien) pour que les lookups
// `crmContactById` / `crmBienById` de la page renvoient la version Supabase.
//
// Pattern aligné sur useContactsSugar et useMatchingSugar : la page UI continue
// d'appeler les helpers mock — seul le contenu retourné est désormais réel.

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  useTransactions,
  useUpdateTransactionStage,
  type ContactTransaction,
} from '@/hooks/useTransactions'
import type { Contact } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import type { Property } from '@/types/listing'
import {
  contactToCrm,
  propertyToCrmBien,
  transactionToCrmDeal,
} from '@/lib/sugarAdapters'
import {
  registerLiveContact,
  registerLiveBien,
  resetLiveOverrides,
  type CrmDeal,
  type CrmContact,
  type CrmBien,
} from '@/components/crm-sugar/mockData'

export interface UsePipelineSugarReturn {
  deals: CrmDeal[]
  isLoading: boolean
  /** true si l'une des 4 queries (transactions/contacts/kyc/properties) a échoué. */
  isError: boolean
  /** relance les 4 queries du pipeline (bouton « Réessayer » des surfaces). */
  refetch: () => void
  updateStage: ReturnType<typeof useUpdateTransactionStage>
  /** Index contact/bien résolus (Supabase) — items Focus auto-suffisants
   *  sans dépendre du registry runtime global (fragile au démontage). */
  contactsById: Map<string, CrmContact>
  biensById: Map<string, CrmBien>
  /** KYC acheteur le plus récent par contact (signal Focus KYC×closing,
   *  NON-BLOQUANT). dossier_status/risk_level/expires_at portés tels quels. */
  kycByContact: Map<string, KycCase>
}

/**
 * Adapter Supabase → `CrmDeal[]` de PipelineSugarV2Page : charge transactions +
 * contacts + KYC acheteur + properties de l'agence, hydrate le registry runtime
 * (registerLive*) et expose des index par id (contacts/biens/KYC) pour les items Focus.
 */
export function usePipelineSugar(): UsePipelineSugarReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // 1. Transactions de l'agence (RLS agency-scopée)
  const { data: transactions = [], isLoading: txLoading, isError: txError, refetch: refetchTx } = useTransactions()

  // 2. IDs contacts (buyer + seller) à hydrater
  const contactIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of transactions) {
      if (t.contact_buyer_id) s.add(t.contact_buyer_id)
      if (t.contact_seller_id) s.add(t.contact_seller_id)
    }
    return Array.from(s)
  }, [transactions])

  // 3. IDs properties à hydrater
  const propertyIds = useMemo(() => {
    const s = new Set<string>()
    for (const t of transactions) if (t.property_id) s.add(t.property_id)
    return Array.from(s)
  }, [transactions])

  // 4. Contacts complets (la jointure useTransactions ne ramène que first/last_name)
  const { data: rawContacts = [], isLoading: contactsLoading, isError: contactsError, refetch: refetchContacts } = useQuery({
    queryKey: ['pipeline-sugar-contacts', agencyId, contactIds],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId || contactIds.length === 0) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .in('id', contactIds)
      if (error) throw error
      return (data ?? []) as unknown as Contact[]
    },
    enabled: !!agencyId && contactIds.length > 0,
  })

  // 5. KYC dossiers acheteurs (verrou pipeline §SugarPipelineKycLock)
  const { data: kycCases = [], isLoading: kycLoading, isError: kycError, refetch: refetchKyc } = useQuery({
    queryKey: ['pipeline-sugar-kyc', agencyId, contactIds],
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

  // 6. Properties complètes (la jointure useTransactions est légère)
  const { data: rawProperties = [], isLoading: propsLoading, isError: propsError, refetch: refetchProps } = useQuery({
    queryKey: ['pipeline-sugar-properties', agencyId, propertyIds],
    queryFn: async (): Promise<Property[]> => {
      if (!agencyId || propertyIds.length === 0) return []
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .in('id', propertyIds)
      if (error) throw error
      return (data ?? []) as unknown as Property[]
    },
    enabled: !!agencyId && propertyIds.length > 0,
  })

  // 7. Index KYC par contact (premier rencontré = plus récent grâce à ORDER BY)
  const kycByContact = useMemo(() => {
    const map = new Map<string, KycCase>()
    for (const k of kycCases) {
      if (!map.has(k.contact_id)) map.set(k.contact_id, k)
    }
    return map
  }, [kycCases])

  // 8. Adapt contacts → CrmContact (avec kyc dérivé)
  const crmContacts = useMemo(
    () => rawContacts.map(c => contactToCrm(c, kycByContact.get(c.id))),
    [rawContacts, kycByContact],
  )

  // 9. Adapt properties → CrmBien (sans ownerContactId : pas critique pour pipeline)
  const crmBiens = useMemo(
    () => rawProperties.map(p => propertyToCrmBien(p, null)),
    [rawProperties],
  )

  // 10. Adapt transactions → CrmDeal[]
  // L'adapter accepte ContactTransaction (shape allégé) ; Transaction est un
  // sur-ensemble compatible (mêmes champs id/stage/status/prix/updated_at/property).
  const deals = useMemo<CrmDeal[]>(
    () => transactions.map(t => {
      const contactId = t.contact_buyer_id ?? t.contact_seller_id ?? ''
      const propertyId = t.property_id ?? null
      const ctLike: ContactTransaction = {
        id: t.id,
        stage: t.stage,
        status: t.status,
        price_offered: t.price_offered,
        price_final: t.price_final,
        updated_at: t.updated_at,
        // useTransactions joint property (title, address, city, price, photos)
        // — c'est exactement ce que ContactTransaction attend.
        property: (t as unknown as { property: ContactTransaction['property'] }).property ?? null,
      }
      return transactionToCrmDeal(ctLike, contactId, propertyId)
    }),
    [transactions],
  )

  // 11. Hydrate le registry runtime SYNCHRONEMENT pendant le render (et non dans
  // un effet post-commit). Les composants enfants (SugarStageColumn, SugarDealCard,
  // PipelineList) résolvent les contacts/biens via `crmContactById`/`crmBienById`
  // au moment où ils montent ; une hydratation post-commit laissait le board collé
  // vide — `filteredDeals` écarte les deals dont le contact n'est pas encore résolu,
  // et un contact chargé APRÈS les transactions ne déclenchait aucun recompute.
  // registerLive* est un Map.set idempotent : sûr à ré-exécuter à chaque render,
  // sous StrictMode, ou sur un render concurrent abandonné.
  for (const c of crmContacts) registerLiveContact(c)
  for (const b of crmBiens) registerLiveBien(b)

  // 12. Cleanup au démontage : on libère les overrides pour ne pas polluer
  // les autres pages Sugar v2 encore non câblées (Today, Biens, etc.).
  useEffect(() => {
    return () => { resetLiveOverrides() }
  }, [])

  // 13. Index par id pour des items auto-suffisants (Focus, etc.) sans passer
  // par le registry runtime global (rempli/vidé par d'autres pages = fragile).
  const contactsById = useMemo(() => {
    const m = new Map<string, CrmContact>()
    for (const c of crmContacts) m.set(c.id, c)
    return m
  }, [crmContacts])
  const biensById = useMemo(() => {
    const m = new Map<string, CrmBien>()
    for (const b of crmBiens) m.set(b.id, b)
    return m
  }, [crmBiens])

  const updateStage = useUpdateTransactionStage()

  return {
    deals,
    isLoading: txLoading || contactsLoading || kycLoading || propsLoading,
    isError: txError || contactsError || kycError || propsError,
    refetch: () => {
      void refetchTx()
      void refetchContacts()
      void refetchKyc()
      void refetchProps()
    },
    updateStage,
    contactsById,
    biensById,
    kycByContact,
  }
}
