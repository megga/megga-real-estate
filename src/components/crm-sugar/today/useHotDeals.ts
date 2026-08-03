// MEGGA CRM — Today V2 « concept H » · LOT 3 · le segment « Dossiers ».
// ----------------------------------------------------------------------------
// Le handoff demande un « classement MEGGA AI » des dossiers chauds. Il existe
// déjà, et il ne s'appelle pas comme ça : c'est la FILE FOCUS (`useFocusQueue`),
// DÉTERMINISTE et EXPLICABLE, 0 LLM — deals à risque, rappels échus, offres qui
// expirent, leads vendeurs, matchs à traiter, le tout scoré et trié.
//
// On la réemploie plutôt que d'inventer un second classement : deux algorithmes
// concurrents sur la même page finiraient par se contredire, et c'est l'agent
// qui arbitrerait.
//
// ⛔ Aucun repli sur des personas : file vide ⇒ segment vide. `selectFocusQueue`
// tient déjà cette règle (« l'empty-state honnête remplace le seed pour un agent
// réel à 0 item »).

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusQueue } from './useFocusQueue'
import { selectFocusQueue, type FocusItem } from './focusQueue'
import type { HlHotData } from './dataH'

/** Volume-adaptatif : 1 dossier ⇒ une carte, jusqu'à 4 (comme la maquette). */
const MAX_HOT = 4

export interface HotDeal extends HlHotData {
  /** Contact visé — le CTA ouvre sa fiche. */
  contactId: string
  /** Raison lisible du classement. Disponible, mais la carte de la maquette ne
   *  la rend pas — cf. notes : question de design en suspens. */
  reason: string
}

export interface UseHotDealsReturn {
  deals: HotDeal[]
  isLoading: boolean
}

/** Pastille : rouge si le dossier est en retard, sinon la teinte de sa famille. */
const DOT_BY_CATEGORY: Record<string, string> = {
  RELANCE: '#C45A00',
  KYC: '#5B6472',
  MANDAT: '#1E5BC6',
  OFFRE: '#C45A00',
  MATCH: '#6F8CFF',
}

export function useHotDeals(): UseHotDealsReturn {
  const { t } = useTranslation('dashboard')
  const { items, isLive, isLoading } = useFocusQueue()

  const deals = useMemo<HotDeal[]>(() => {
    const queue: FocusItem[] = selectFocusQueue({ live: isLive, items, isDemo: false })
    return queue.slice(0, MAX_HOT).map((it): HotDeal => ({
      id: it.id,
      contactId: it.contactId,
      init: it.initials,
      av: it.av,
      name: it.contact,
      role: it.sub,
      ctx: it.reason,
      reason: it.reason,
      dot: it.urgent ? '#F26B65' : (DOT_BY_CATEGORY[it.category] ?? '#797D90'),
      late: it.urgent,
      cta: t('today.h.deals.open'),
      ctaIcon: 'user',
      price: it.bien?.price ?? '',
      photo: it.bien?.photo || undefined,
    }))
  }, [items, isLive, t])

  return { deals, isLoading }
}
