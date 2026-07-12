// ── Supabase Matching Types ──────────────────────────────────────────────────
export type MatchStatus = 'suggested' | 'sent' | 'visit_planned' | 'interested' | 'rejected' | 'ignored'

// Statuts de RÉACTION du client à un dossier envoyé (producteur HITL côté agent).
// Chacun pose matches.response_at via trigger DB (20260617120000). 'ignored' est
// exclu : c'est un écart agent, pas une réponse client.
export type MatchReaction = Extract<MatchStatus, 'interested' | 'visit_planned' | 'rejected'>
