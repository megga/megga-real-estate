// Atelier Matching — synthèse MEGGA AI de la colonne « Pourquoi ça matche ».
// Phrase composée déterministe à partir des signaux réels du moteur de
// matching (reasons), du statut d'engagement et du KYC. Suggestion seulement —
// jamais d'action auto (grammaire : l'IA assiste, l'agent agit).

import type { AtelierKyc, AtelierReason, AtelierStatus } from './types'

interface HintInput {
  status: AtelierStatus
  kyc: AtelierKyc
  score: number
  reasons: AtelierReason[]
  sentAt: string | null
  engage: string
}

const KYC_PHRASE: Record<AtelierKyc, string> = {
  verified: 'Aucun frein KYC — dossier envoyable immédiatement.',
  pending: "KYC en cours, sans blocage pour l'envoi.",
  stale: 'Vérification KYC expirée — à re-screener avant une offre.',
  none: 'KYC non démarré — rappel doux, non bloquant à ce stade.',
}

export function composeAiHint(b: HintInput): string {
  // Sans retour : relance prioritaire, avec l'ancienneté réelle de l'envoi
  if (b.status === 'no-reply') {
    const days = b.sentAt
      ? Math.max(1, Math.round((Date.now() - new Date(b.sentAt).getTime()) / 864e5))
      : null
    const age = days ? `il y a ${days} jour${days > 1 ? 's' : ''}` : 'récemment'
    return `Dossier envoyé ${age}, sans réaction. Tenter un autre canal — téléphone ou WhatsApp.`
  }

  // Engagé : battre le fer tant qu'il est chaud
  if (b.status === 'engaged') {
    if (b.engage === 'Visite planifiée') {
      return 'Visite déjà planifiée. Préparer le bon de visite et les points forts du bien.'
    }
    return `${b.engage} — relance à chaud, c'est le moment de proposer une visite.`
  }

  // À envoyer : forces réelles du match + état KYC
  const pos = b.reasons.filter(r => r.ok).sort((a, z) => z.pts - a.pts)
  const neg = b.reasons.filter(r => !r.ok)

  if (b.score >= 85 && neg.length === 0) {
    return `Profil aligné sur tous les axes. ${KYC_PHRASE[b.kyc]}`
  }
  if (neg.length > 0 && pos.length > 0) {
    const force = pos[0].label.toLowerCase()
    const frein = neg[0]
    return `${cap(force)} aligné${force === 'surface' ? 'e' : ''}, mais ${frein.label.toLowerCase()} en retrait (${frein.detail.toLowerCase()}). À présenter avec ce contexte.`
  }
  if (pos.length >= 2) {
    return `${cap(pos[0].label)} et ${pos[1].label.toLowerCase()} alignés. ${KYC_PHRASE[b.kyc]}`
  }
  return `Match à ${b.score}/100 sur les critères actifs. ${KYC_PHRASE[b.kyc]}`
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
