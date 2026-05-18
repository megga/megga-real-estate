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
}

export function useBiensSugar(): UseBiensSugarReturn {
  // useAgencyProperties renvoie un sur-ensemble de Property (joint avec
  // listings(views_count, favorites_count) — pas utile pour CrmBien).
  const { data: rawProperties = [], isLoading } = useAgencyProperties()

  const biens = useMemo<CrmBien[]>(
    () => rawProperties.map(p => propertyToCrmBien(p as Property, null)),
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

  return { biens, isLoading }
}
