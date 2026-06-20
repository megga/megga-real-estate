// Atelier Matching — synthèse MEGGA AI de la colonne « Pourquoi ça matche ».
// Phrase composée déterministe à partir des signaux réels du moteur de
// matching (reasons), du statut d'engagement et du KYC. Suggestion seulement —
// jamais d'action auto (grammaire : l'IA assiste, l'agent agit).

import i18n from '@/i18n'
import type { AtelierKyc, AtelierReason, AtelierStatus } from './types'

// i18n : producteur de texte déterministe (comme focusScore.buildReason) ;
// non unit-testé + rendu dans des composants re-rendus au changement de langue →
// instance i18n singleton, signature inchangée (cf docs/i18n-conventions §6).
// NB : les libellés de raison (reasons[].label/.detail) et `engage` sont des
// DONNÉES du moteur de matching — interpolés tels quels (résidu data-layer).

interface HintInput {
  status: AtelierStatus
  kyc: AtelierKyc
  score: number
  reasons: AtelierReason[]
  sentAt: string | null
  engage: string
}

const kycPhrase = (kyc: AtelierKyc): string => i18n.t('matching:aiHint.kycPhrase.' + kyc)

export function composeAiHint(b: HintInput): string {
  // Sans retour : relance prioritaire, avec l'ancienneté réelle de l'envoi
  if (b.status === 'no-reply') {
    const days = b.sentAt
      ? Math.max(1, Math.round((Date.now() - new Date(b.sentAt).getTime()) / 864e5))
      : null
    const age = days ? i18n.t('matching:aiHint.daysAgo', { count: days }) : i18n.t('matching:aiHint.recently')
    return i18n.t('matching:aiHint.noReply', { age })
  }

  // Engagé : battre le fer tant qu'il est chaud
  if (b.status === 'engaged') {
    if (b.engage === 'Visite planifiée') {
      return i18n.t('matching:aiHint.engagedVisit')
    }
    return i18n.t('matching:aiHint.engaged', { engage: b.engage })
  }

  // À envoyer : forces réelles du match + état KYC
  const pos = b.reasons.filter(r => r.ok).sort((a, z) => z.pts - a.pts)
  const neg = b.reasons.filter(r => !r.ok)

  if (b.score >= 85 && neg.length === 0) {
    return i18n.t('matching:aiHint.aligned', { kyc: kycPhrase(b.kyc) })
  }
  if (neg.length > 0 && pos.length > 0) {
    const force = pos[0].label.toLowerCase()
    const frein = neg[0]
    // `agr` = accord de genre FR (« alignée » pour surface) ; inutilisé en EN.
    return i18n.t('matching:aiHint.posNeg', {
      force: cap(force),
      agr: force === 'surface' ? 'e' : '',
      frein: frein.label.toLowerCase(),
      detail: frein.detail.toLowerCase(),
    })
  }
  if (pos.length >= 2) {
    return i18n.t('matching:aiHint.twoPos', { a: cap(pos[0].label), b: pos[1].label.toLowerCase(), kyc: kycPhrase(b.kyc) })
  }
  return i18n.t('matching:aiHint.default', { score: b.score, kyc: kycPhrase(b.kyc) })
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
