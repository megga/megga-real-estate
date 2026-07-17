// MEGGA CRM Sugar v3 — Fiche Bien (Sprint 2) — primitives partagées
// Port pixel-près du canon crm-screen-bien-detail-sugar.jsx (handoff Sprint 2).

import i18n from '@/i18n'

// ─── Eyebrow ────────────────────────────────────────────────────────────
// ─── Alerte C2PA Sprint 3 ───────────────────────────────────────────────
// Le seul endroit du chrome agent où la signature C2PA redevient visible :
// quand des photos sont publiées sans certification d'authenticité.
// Phrasing volontairement non-technique (red-team C1) : on ne dit pas
// « C2PA », on parle de « certification d'authenticité » côté agent.
// ─── Card blanche radius 24px + sgFadeUp ────────────────────────────────
// ─── Input inline (mode édition) ────────────────────────────────────────
// Préserve la typo du champ display tout en révélant un input modifiable.
// ─── Status chip ─────────────────────────────────────────────────────────
// Mapping aligné sur PropertyStatus (src/lib/constants). Couleur du dot par
// statut ; le libellé vient de i18n (listings:status.* pour les statuts
// communs, listings:detail.status.archived pour le statut propre à la fiche).
// ─── Photo : vraie URL si dispo, sinon gradient hash stable ─────────────
// Sprint 3 : le badge C2PA a été RETIRÉ du chrome agent. Les props
// c2paVerified / photoCount / showBadge sont conservées pour la compat
// API mais ignorées — la signature C2PA tourne en arrière-plan, sa trace
// vit dans le journal d'audit nLPD (Sprint 1).
// Côté marketplace publique, le badge reste sur C2PaBadge / ListingCard.
// ─── Formatters spécifiques fiche Bien ──────────────────────────────────
// ─── Labels stage pipeline (deals liés) ─────────────────────────────────
// Les 14 stades DB de la fiche bien. i18n-aware via l'instance i18n (utilisable
// hors composant React) ; fallback sur le code brut si la clé manque ou est
// inconnue. Clés sous listings:detail.stage.*.
const BD_STAGE_KEYS = new Set([
  'new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done',
  'interest_confirmed', 'offer', 'negotiation', 'reserved', 'financing',
  'notary', 'signed', 'lost', 'to_recontact',
])
export function bdStageLabel(stage: string): string {
  if (BD_STAGE_KEYS.has(stage)) return i18n.t(`listings:detail.stage.${stage}`)
  return stage
}
