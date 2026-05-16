// MEGGA CRM Sprint 2 — Types Visite (bon + rapport)
// Source : HANDOFF_SPRINT_2_CLAUDE_CODE.md §Modèle de données
// Migration DB : 20260517_001_sprint2_crm_offers_visits.sql (étend visits)

/** Sentiment du visiteur capturé pendant/après la visite. */
export type VisitSentiment = 'hot' | 'warm' | 'cool' | 'cold'

/** Kind frontend Sprint 2 — mapping depuis status DB. */
export type VisitKind = 'scheduled' | 'done' | 'no-show' | 'cancelled'

/** Bon de visite (avant la visite). Pré-imprimable PDF. */
export interface VisitBon {
  generatedAt: string
  signedAt: string | null
  docId: string
  visitorNames: string[]
  visitorIds: string[]
}

/** Note vocale enregistrée par l'agent. */
export interface VisitVoiceNote {
  duration: number
  transcribed: boolean
}

/** Rapport de visite (après la visite). */
export interface VisitRapport {
  savedAt: string
  sentiment: VisitSentiment
  interestLevel: number
  highlights: string[]
  objections: string[]
  nextSteps: string
  photos: number
  voiceNote: VisitVoiceNote | null
  followUpScheduledAt: string | null
}

/** Mapping status DB → kind frontend (handoff §5). */
export function visitStatusToKind(
  status: string | null | undefined,
): VisitKind {
  switch (status) {
    case 'done':
      return 'done'
    case 'cancelled':
      return 'cancelled'
    case 'no_show':
      return 'no-show'
    case 'planned':
    case 'confirmed':
    default:
      return 'scheduled'
  }
}

/** Sentiment label + tone. */
export const VISIT_SENTIMENT_LABELS: Record<
  VisitSentiment,
  { label: string; tone: string }
> = {
  hot: { label: 'Très intéressé', tone: '#EF4444' },
  warm: { label: 'Intéressé', tone: '#F59E0B' },
  cool: { label: 'Tiède', tone: '#7A8088' },
  cold: { label: 'Pas intéressé', tone: '#B5BAC2' },
}
