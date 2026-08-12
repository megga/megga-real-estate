// MEGGA CRM Sugar v2 — Adapter Supabase → CrmBien[] pour BiensSugarV2Page.
// Charge les biens de l'agence (RLS agency-scopée via useAgencyProperties),
// adapte vers le shape mock que BnRow / BnDetailOverlay consomment.
//
// Pattern aligné sur useContactsSugar / usePipelineSugar : la page UI continue
// d'utiliser CrmBien — seul le contenu retourné est désormais réel.

import { useEffect, useMemo } from 'react'
import { useAgencyProperties } from '@/hooks/useProperties'
import type { Property } from '@/types/listing'
import { propertyToCrmBien } from '@/lib/sugarAdapters'
import {
  registerLiveBien,
  resetLiveOverrides,
  type CrmBien,
} from '@/components/crm-sugar/mockData'

export interface UseBiensSugarReturn {
  biens: CrmBien[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Biens de l'agence adaptés au shape mock CrmBien pour BiensSugarV2Page : injecte
 * vues/favoris réels (jointure listings) + score de bien, et publie chaque bien au
 * registry runtime Sugar pour crmBienById().
 */
export function useBiensSugar(): UseBiensSugarReturn {
  // useAgencyProperties renvoie un sur-ensemble de Property (joint avec
  // listings(views_count, favorites_count) — pas utile pour CrmBien).
  const { data: rawProperties = [], isLoading, isError, refetch } = useAgencyProperties()
  // ⚠ Le score de bien N'EST PLUS lu ici. Il était attaché par id depuis
  // `property_scores` (hook `usePropertyScores`, retiré le 12 août 2026 avec la
  // pastille qui l'affichait) : une requête par ouverture de « Mes biens » pour
  // remplir un champ que plus rien ne rendait. La table continue d'être
  // alimentée côté base — seule la lecture côté app a disparu.

  const biens = useMemo<CrmBien[]>(
    () =>
      rawProperties.map(p => {
        const b = propertyToCrmBien(p as Property, null)
        // Vues / favoris réels via la jointure listings(views_count, favorites_count).
        const l = (
          p as { listing?: Array<{ views_count?: number; favorites_count?: number }> }
        ).listing?.[0]
        if (l) {
          b.stats = {
            ...b.stats,
            views: l.views_count ?? b.stats.views,
            favorites: l.favorites_count ?? b.stats.favorites,
          }
        }
        return b
      }),
    [rawProperties],
  )

  // Registry runtime : permet aux autres composants Sugar qui appellent
  // crmBienById(id) (ex. DealDetailDrawer, ContactsDetailPane) de récupérer
  // ces biens sans changer de signature.
  useEffect(() => {
    for (const b of biens) registerLiveBien(b)
  }, [biens])

  useEffect(() => {
    return () => { resetLiveOverrides() }
  }, [])

  return { biens, isLoading, isError, refetch }
}
