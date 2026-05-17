// MEGGA CRM Sugar v2 — Adapter Supabase → CrmContact/CrmMatch/CrmBien
// Permet à MatchingSugarV2Page de consommer la vraie donnée Supabase
// (matches + contacts + kyc_cases) sans refactorer les composants UI :
// la sortie respecte les shapes mock que FocusPanel/MMiniRow/etc consomment.
//
// Branchements :
//   - matches : useMatching (hook existant)
//   - contacts : SELECT contacts WHERE id IN (buyer ids des matches)
//   - kyc : SELECT kyc_cases WHERE contact_id IN (...) (dernier par contact)
//   - sendMatch : useMatching.sendMatch (UPDATE matches SET status='sent', sent_at, sent_via)
//   - scheduleVisit : INSERT INTO visits (status='planned', scheduled_at, contact_id, property_id)
//   - runMatching : useMatching.runMatching → invoke('matching-engine')
//   - updateCriteria : UPDATE contacts SET search_criteria = $1
//
// Mapping enum match.status :
//   DB 'suggested' → mock 'to-send'
//   DB 'sent' | 'visit_planned' → mock 'sent'
//   DB 'interested' → mock 'liked'
//   DB 'rejected' | 'ignored' → mock 'rejected'

import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useMatching, type MatchResult } from '@/hooks/useMatching'
import type { Contact, SearchCriteria } from '@/types/contact'
import type { KycCase } from '@/types/kyc'
import { contactToCrm, listingToBien } from '@/lib/sugarAdapters'
import {
  registerLiveBien,
  registerLiveContact,
  resetLiveOverrides,
  type CrmBien,
  type CrmMatch,
} from '@/components/crm-sugar/mockData'
import type { MatchGroup } from '@/components/crm-sugar/matching/helpers'

// ─── Mapping enum match.status ─────────────────────────────────────────────
function mapMatchStatus(dbStatus: MatchResult['status']): CrmMatch['status'] {
  switch (dbStatus) {
    case 'suggested':    return 'to-send'
    case 'sent':         return 'sent'
    case 'visit_planned': return 'sent'
    case 'interested':   return 'liked'
    case 'rejected':     return 'rejected'
    case 'ignored':      return 'rejected'
    default:             return 'to-send'
  }
}

// ─── Reasons : flatten JSONB structuré en chips lisibles ──────────────────
const REASON_LABELS: Record<string, string> = {
  budget: 'Budget',
  zone: 'Zone',
  type: 'Type',
  rooms: 'Pièces',
  features: 'Critères',
}

function flattenReasons(r: MatchResult['reasons']): string[] {
  return Object.entries(r)
    .filter(([, v]) => v.match && v.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .map(([k, v]) => `${REASON_LABELS[k] ?? k} +${v.score}`)
}

// mapContactType / mapKycStatus / mapCriteria / pickAvatarBg / contactToCrm /
// listingToBien sont désormais centralisés dans `@/lib/sugarAdapters` (réutilisés
// par useContactsSugar, useDealsSugar, etc).

// ─── Hook principal ──────────────────────────────────────────────────────
export interface UseMatchingSugarReturn {
  groups: MatchGroup[]
  isLoading: boolean
  sendMatch: (matchId: string, channel: 'email' | 'whatsapp' | 'both') => void
  scheduleVisit: (input: ScheduleVisitInput) => Promise<void>
  runMatching: () => void
  isRunning: boolean
  updateCriteria: (contactId: string, patch: Partial<SearchCriteria>) => Promise<void>
}

export interface ScheduleVisitInput {
  contactId: string
  propertyId: string
  scheduledAt: string  // ISO
  durationMin: number
  notes?: string
}

export function useMatchingSugar(): UseMatchingSugarReturn {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const agencyId = profile?.agency_id

  // 1. Matches via le hook existant.
  // On ne réexporte pas `runMatching` (mode 'match-contact', requiert un contactId) :
  // notre `runMatching()` ci-dessous fait un scan agency-wide via invoke direct.
  const { matches, isLoading: matchesLoading, sendMatch, isRunning } = useMatching()

  // 2. Contacts impliqués (acheteurs des matches)
  const buyerIds = useMemo(
    () => Array.from(new Set(matches.map(m => m.contactId))),
    [matches],
  )

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['matching-sugar-contacts', agencyId, buyerIds],
    queryFn: async (): Promise<Contact[]> => {
      if (!agencyId || buyerIds.length === 0) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .in('id', buyerIds)
      if (error) throw error
      return (data ?? []) as Contact[]
    },
    enabled: !!agencyId && buyerIds.length > 0,
  })

  // 3. Dossiers KYC du dernier connu par contact
  const { data: kycCases = [], isLoading: kycLoading } = useQuery({
    queryKey: ['matching-sugar-kyc', agencyId, buyerIds],
    queryFn: async (): Promise<KycCase[]> => {
      if (!agencyId || buyerIds.length === 0) return []
      // Filtre par type acheteur uniquement : un contact peut avoir plusieurs
      // dossiers (achat + vente), on ne veut que le dossier acheteur (pp/pm).
      // ORDER BY created_at DESC → le premier match = le plus récent.
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, contact_id, type, status, dossier_status, risk_level, expires_at, created_at')
        .in('contact_id', buyerIds)
        .in('type', ['buyer_pp', 'buyer_pm'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as KycCase[]
    },
    enabled: !!agencyId && buyerIds.length > 0,
  })

  // 4. Index KYC par contact (premier = le plus récent)
  const kycByContact = useMemo(() => {
    const map = new Map<string, KycCase>()
    for (const k of kycCases) {
      if (!map.has(k.contact_id)) map.set(k.contact_id, k)
    }
    return map
  }, [kycCases])

  // 5. Adapter Supabase → Crm shapes — PURE (pas de side effects, safe pour
  // React 18+ Concurrent Rendering). Le registry runtime est rempli ensuite
  // par un useEffect dédié, après que groups soit committed.
  const groups = useMemo<MatchGroup[]>(() => {
    if (matches.length === 0) return []

    // a. Indexer contacts
    const contactsById = new Map(contacts.map(c => [c.id, c]))

    // b. Transformer matches en (CrmMatch + CrmBien) par buyer
    type Acc = { matches: CrmMatch[]; biens: CrmBien[] }
    const acc = new Map<string, Acc>()

    for (const m of matches) {
      const bien = listingToBien(m)
      const crmMatch: CrmMatch = {
        id: m.id,
        contactId: m.contactId,
        bienId: bien.id,
        score: m.score,
        reasons: flattenReasons(m.reasons),
        status: mapMatchStatus(m.status),
      }
      const entry = acc.get(m.contactId) ?? { matches: [], biens: [] }
      entry.matches.push(crmMatch)
      entry.biens.push(bien)
      acc.set(m.contactId, entry)
    }

    // c. Construire groups (CrmContact dérivé du contact + KYC du contact_id)
    const out: MatchGroup[] = []
    for (const [buyerId, { matches: ms, biens: _bs }] of acc) {
      const contact = contactsById.get(buyerId)
      if (!contact) continue
      const buyer = contactToCrm(contact, kycByContact.get(buyerId))
      const sorted = ms.sort((a, b) => b.score - a.score)
      out.push({ buyer, matches: sorted, topScore: sorted[0]?.score ?? 0 })
    }

    return out.sort((a, b) => b.topScore - a.topScore)
  }, [matches, contacts, kycByContact])

  // 6. Side effect séparé : remplir le registry runtime après commit.
  // Garantit que crmBienById/crmContactById renvoient les versions Supabase
  // pour les composants UI qui appellent ces helpers.
  useEffect(() => {
    if (groups.length === 0) {
      resetLiveOverrides()
      return
    }
    resetLiveOverrides()
    for (const g of groups) {
      registerLiveContact(g.buyer)
      for (const m of g.matches) {
        const sourceMatch = matches.find(sm => sm.id === m.id)
        if (sourceMatch) registerLiveBien(listingToBien(sourceMatch))
      }
    }
  }, [groups, matches])

  // 7. Cleanup au démontage (évite que d'autres pages Sugar v2 héritent du registry)
  useEffect(() => {
    return () => { resetLiveOverrides() }
  }, [])

  // 7. Mutation : créer une visite (status='planned')
  const scheduleVisitMutation = useMutation({
    mutationFn: async (input: ScheduleVisitInput) => {
      if (!agencyId) throw new Error('No agency')
      const { error } = await supabase.from('visits').insert({
        agency_id: agencyId,
        contact_id: input.contactId,
        property_id: input.propertyId,
        scheduled_at: input.scheduledAt,
        duration_minutes: input.durationMin,
        status: 'planned',
        notes: input.notes ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  // 8. Mutation : update search_criteria du buyer.
  // IMPORTANT : le moteur de matching (Edge Function `matching-engine`) lit
  // `client_searches.criteria`, PAS `contacts.search_criteria`. Pour que
  // l'édit inline impacte le re-matching, on doit propager les deux :
  //   - `contacts.search_criteria` (affiche immédiatement la nouvelle valeur)
  //   - `client_searches.criteria` du dossier actif (pris en compte par l'IA)
  // Si aucun client_search actif n'existe pour ce buyer, on en crée un.
  const updateCriteriaMutation = useMutation({
    mutationFn: async ({ contactId, patch }: { contactId: string; patch: Partial<SearchCriteria> }) => {
      if (!agencyId) throw new Error('No agency')
      // 1. Merge avec l'existant côté contacts.search_criteria
      const existing = contacts.find(c => c.id === contactId)?.search_criteria ?? null
      const merged: SearchCriteria = { ...(existing ?? {}), ...patch }

      // 2. Update contacts.search_criteria (vue dénormalisée)
      const { error: contactErr } = await supabase
        .from('contacts')
        .update({ search_criteria: merged })
        .eq('id', contactId)
      if (contactErr) throw contactErr

      // 3. Propager au client_search actif (consommé par le matching engine)
      const { data: existingSearches } = await supabase
        .from('client_searches')
        .select('id, criteria')
        .eq('contact_id', contactId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingSearches && existingSearches.length > 0) {
        const search = existingSearches[0] as { id: string; criteria: SearchCriteria }
        const mergedSearch: SearchCriteria = { ...(search.criteria ?? {}), ...patch }
        const { error: updErr } = await supabase
          .from('client_searches')
          .update({ criteria: mergedSearch, updated_at: new Date().toISOString() })
          .eq('id', search.id)
        if (updErr) throw updErr
      } else {
        // Pas de client_search actif : en créer un
        const { error: insErr } = await supabase
          .from('client_searches')
          .insert({
            agency_id: agencyId,
            contact_id: contactId,
            criteria: merged,
            is_active: true,
          })
        if (insErr) throw insErr
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matching-sugar-contacts'] })
      queryClient.invalidateQueries({ queryKey: ['contact'] })
    },
  })

  return {
    groups,
    isLoading: matchesLoading || contactsLoading || kycLoading,
    sendMatch,
    scheduleVisit: (input: ScheduleVisitInput) => scheduleVisitMutation.mutateAsync(input),
    runMatching: () => {
      // Trigger un scan global plutôt que par contact (l'agent veut tout rafraîchir)
      // L'Edge Function accepte mode='scan-all' pour agency-wide
      void runScanAll()
    },
    isRunning,
    updateCriteria: (contactId: string, patch: Partial<SearchCriteria>) =>
      updateCriteriaMutation.mutateAsync({ contactId, patch }),
  }

  async function runScanAll() {
    if (!agencyId) return
    const { error } = await supabase.functions.invoke('matching-engine', {
      body: { mode: 'scan-all', agency_id: agencyId },
    })
    if (error) console.error('matching-engine scan-all failed', error)
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }
}
