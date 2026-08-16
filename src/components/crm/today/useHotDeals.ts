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

// CTA contextuel — la maquette donne un libellé par nature de dossier, pas un
// « Ouvrir » uniforme. Vu à l'écran : trois cartes portant le même mot ne disent
// rien de ce qui attend l'agent. Les clés inconnues retombent sur « Ouvrir ».
const CTA_BY_TYPE: Record<string, string> = {
  call: 'today.h.deals.ctaCall',
  kyc: 'today.h.deals.ctaKyc',
  sign: 'today.h.deals.ctaSign',
  offer: 'today.h.deals.ctaOffer',
  match: 'today.h.deals.ctaMatch',
  visit: 'today.h.deals.ctaVisit',
  seller: 'today.h.deals.ctaSeller',
  bien: 'today.h.deals.ctaListing',
  cooling: 'today.h.deals.ctaCall',
}

const ICON_BY_TYPE: Record<string, string> = {
  call: 'user', kyc: 'shield', sign: 'doc', offer: 'offer',
  match: 'spark', visit: 'home', seller: 'user', bien: 'doc', cooling: 'user',
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
      cta: t(CTA_BY_TYPE[it.type] ?? 'today.h.deals.open'),
      ctaIcon: ICON_BY_TYPE[it.type] ?? 'user',
      price: it.bien?.price ?? '',
      photo: it.bien?.photo || undefined,
    }))
  }, [items, isLive, t])

  return { deals, isLoading }
}
