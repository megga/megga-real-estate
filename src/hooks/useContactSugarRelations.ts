// MEGGA CRM Sugar v2 — Relations d'un contact pour ContactsDetailPane.
// Orchestre 4 fetches Supabase en parallèle + adapte vers shapes mock :
//   - matches du contact (via useMatching)
//   - transactions (deals) du contact (via useContactTransactions)
//   - activity_events timeline (via useContactTimeline)
//   - biens dont le contact est propriétaire (filtre useAgencyProperties)
//
// Toutes les widgets de la fiche détail consomment le résultat comme props
// pures, ce qui permet de garder leur signature stable + d'éviter les fetch
// dupliqués par widget.

import { useMemo } from 'react'
import { useMatching } from '@/hooks/useMatching'
import { useContactTransactions } from '@/hooks/useTransactions'
import { useContactTimeline } from '@/hooks/useContactTimeline'
import { useAgencyProperties } from '@/hooks/useProperties'
import {
  listingToBien,
  propertyToCrmBien,
  timelineToActivity,
  transactionToCrmDeal,
} from '@/lib/sugarAdapters'
import {
  registerLiveBien,
  type CrmActivity, type CrmBien, type CrmDeal, type CrmMatch,
} from '@/components/crm-sugar/mockData'

export interface UseContactSugarRelationsReturn {
  matches: CrmMatch[]
  deals: CrmDeal[]
  activity: CrmActivity[]
  biensOwned: CrmBien[]
  isLoading: boolean
}

export function useContactSugarRelations(
  contactId: string | undefined,
): UseContactSugarRelationsReturn {
  // 1. Matches : useMatching renvoie déjà MatchResult adapté (Supabase + RLS)
  const { matches: rawMatches, isLoading: matchesLoading } = useMatching(contactId)

  // 2. Transactions du contact (buyer OR seller)
  const { data: rawTransactions = [], isLoading: txLoading } =
    useContactTransactions(contactId)

  // 3. Timeline d'activité
  const { data: rawTimeline = [], isLoading: timelineLoading } =
    useContactTimeline(contactId)

  // 4. Properties de l'agence (on filtre ensuite par owner_contact_id côté client
  // — il n'y a pas de colonne dédiée encore, donc on garde la liste filtrée vide
  // pour l'instant). Pour les vendeurs, à brancher quand `properties.owner_contact_id`
  // existera. En attendant, on dérive depuis les transactions (les biens qui ont
  // une transaction où le contact est le seller).
  const { data: rawProperties = [], isLoading: propsLoading } = useAgencyProperties()

  // 5. Adapter pur
  const matches = useMemo<CrmMatch[]>(() => {
    if (!contactId) return []
    return rawMatches.map(m => {
      const bien = listingToBien(m)
      // Enregistrer le bien dans le registry pour que crmBienById le trouve
      registerLiveBien(bien)
      return {
        id: m.id,
        contactId: m.contactId,
        bienId: bien.id,
        score: m.score,
        reasons: Object.entries(m.reasons)
          .filter(([, v]) => v.match && v.score > 0)
          .sort((a, b) => b[1].score - a[1].score)
          .map(([k, v]) => {
            const label = k === 'budget' ? 'Budget' : k === 'zone' ? 'Zone' :
                          k === 'type' ? 'Type' : k === 'rooms' ? 'Pièces' :
                          k === 'features' ? 'Critères' : k
            return `${label} +${v.score}`
          }),
        status:
          m.status === 'suggested' ? 'to-send' :
          m.status === 'sent' || m.status === 'visit_planned' ? 'sent' :
          m.status === 'interested' ? 'liked' :
          'rejected',
      }
    })
  }, [contactId, rawMatches])

  const deals = useMemo<CrmDeal[]>(() => {
    if (!contactId) return []
    return rawTransactions.map(t => transactionToCrmDeal(t, contactId, null))
  }, [contactId, rawTransactions])

  const activity = useMemo<CrmActivity[]>(() => {
    if (!contactId) return []
    return rawTimeline.map(e => timelineToActivity(e, contactId))
  }, [contactId, rawTimeline])

  const biensOwned = useMemo<CrmBien[]>(() => {
    if (!contactId) return []
    // Heuristique : biens qui apparaissent dans une transaction où ce contact
    // est seller. La colonne owner_contact_id n'existe pas encore en DB.
    const ownedIds = new Set(
      rawTransactions
        .filter(t => t.property && t.stage)   // tx avec un bien
        .map(t => t.property?.title)
        .filter(Boolean),
    )
    return rawProperties
      .filter(p => ownedIds.has(p.title))
      .map(p => propertyToCrmBien(p, contactId))
  }, [contactId, rawTransactions, rawProperties])

  return {
    matches,
    deals,
    activity,
    biensOwned,
    isLoading: matchesLoading || txLoading || timelineLoading || propsLoading,
  }
}
