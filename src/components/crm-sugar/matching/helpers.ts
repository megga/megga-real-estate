// MEGGA CRM Sugar v2 — Matching helpers
// 1:1 port from `crm-screen-matching-sugar.jsx`.

import {
  CRM_CONTACTS,
  CRM_MATCHES,
  type CrmBien,
  type CrmContact,
  type CrmMatch,
} from '../mockData'
import type { SugarPalette } from '../tokens'

export interface MatchGroup {
  buyer: CrmContact
  matches: CrmMatch[]
  topScore: number
}

export function buildMatchGroups(): MatchGroup[] {
  return CRM_CONTACTS.filter(c => c.type === 'buyer')
    .map(buyer => {
      const matches = CRM_MATCHES.filter(m => m.contactId === buyer.id).sort(
        (a, b) => b.score - a.score,
      )
      return { buyer, matches, topScore: matches[0]?.score || 0 }
    })
    .filter(g => g.matches.length > 0)
    .sort((a, b) => b.topScore - a.topScore)
}

export function mColor(score: number): string {
  if (score >= 75) return '#0041D9'
  return '#9CA3AF'
}

export function mLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 75) return 'Très bon'
  if (score >= 60) return 'Bon'
  return 'Faible'
}

export function fmtPriceShort(b: CrmBien | undefined | null): string {
  if (!b) return ''
  if (b.price) {
    if (b.price >= 1e6) return `CHF ${(b.price / 1e6).toFixed(2)}M`
    return `CHF ${(b.price / 1000).toFixed(0)}k`
  }
  if (b.rent) return `CHF ${b.rent.toLocaleString('fr-CH')}/m`
  return ''
}

export interface Engagement {
  label: string
  dot: string
}

export function getEngagement(matches: CrmMatch[]): Engagement {
  if (matches.some(m => m.status === 'liked'))
    return { label: 'A aimé un bien', dot: '#0E9F6E' }
  if (matches.some(m => m.status === 'viewed'))
    return { label: 'Dossier consulté', dot: '#F59E0B' }
  if (matches.some(m => m.status === 'to-send'))
    return { label: 'À activer', dot: '#0041D9' }
  if (matches.some(m => m.status === 'sent'))
    return { label: 'Envoyé · sans retour', dot: '#9CA3AF' }
  return { label: 'Nouveau', dot: '#9CA3AF' }
}

export function getBuyerType(b: CrmContact): string {
  if (b.tags?.includes('investor') || b.tags?.includes('investisseur'))
    return 'Investisseur'
  if (b.criteria?.transaction === 'location') return 'Location'
  return 'Acheteur'
}

export function getCities(b: CrmContact): string {
  return ((b.criteria?.cities as string[] | undefined) || (b.criteria?.cantons as string[] | undefined) || [])
    .slice(0, 2)
    .join(', ')
}

export const AI_NOTES: Record<string, string> = {
  'c-001': "Marie a visité le 5p Carouge il y a 36h sans suivi. Le bien à 94% colle pile à son profil famille.",
  'c-003': 'Lead chaud — KYC requis avant offre.',
  'c-002': 'Investisseur, pas pressé. Élargir au marché public MEGGA.',
  'c-007': 'Offre en cours sur Cologny. Ne pas brouiller le signal.',
  'c-005': 'Expat US, arrive en juillet. Le 3p Pâquis coche tout.',
}

export function getStatusMap(sp: SugarPalette): Record<
  CrmMatch['status'],
  { label: string; textInk: string }
> {
  return {
    'to-send': { label: 'À envoyer', textInk: '#0041D9' },
    sent: { label: 'Envoyé', textInk: sp.sub },
    viewed: { label: 'Vu', textInk: sp.sub },
    liked: { label: 'Aimé', textInk: sp.sub },
    rejected: { label: 'Rejeté', textInk: sp.sub },
  }
}

export function matchKey(m: CrmMatch): string {
  return `${m.contactId}-${m.bienId}`
}
