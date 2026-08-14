/**
 * Fixtures du banc `/dev/crm` — données de DÉMONSTRATION, rien ne vient de la
 * base et aucun geste n'écrit.
 *
 * ── CE QUE CE FICHIER PORTE EN PLUS DE `adminFixtures` : UNE SESSION ─────────
 * La console super-admin se regardait sans session : ses hooks lisent des RPC
 * qui ne dépendent pas d'un profil. Le CRM agent, non — mesuré, ses hooks sont
 * gatés sur `profile?.agency_id` (`useAgencySettings`, `useRelanceLeads`,
 * `useIdentityGate`…), et `AgentSugarLayout` RETIENT l'écran sur `BootSplash`
 * tant que le gate d'identité n'a pas résolu. Sans session, le banc n'aurait
 * montré qu'un écran d'attente : le mur n'est pas seulement `ProtectedRoute`.
 *
 * ⛔ ET ON NE PEUT PAS S'APPUYER SUR `DEV_BYPASS_AUTH`. Il existe
 * (`useAuth.tsx`) et injecte exactement ce profil — mais il est commandé par
 * `VITE_DEV_BYPASS_AUTH=true` dans un `.env.local`, donc un banc qui en dépend
 * ne s'ouvre pas chez qui ne l'a pas posé. Les sept autres bancs `/dev/*` n'en
 * demandent aucun ; celui-ci non plus.
 *
 * La session est donc SEMÉE dans le stockage que `supabase-js` lit, avec une
 * échéance lointaine — `purgeExpiredAuthTokens()` (lu dans `src/lib/supabase.ts`)
 * ne retire que ce qui est expiré ou illisible, et il tranche sur `expires_at`
 * quand il est présent, sans décoder le jeton.
 *
 * ⚠ LE JETON N'EST PAS SIGNÉ, et c'est sans conséquence ICI seulement : chaque
 * appel REST et chaque edge function est intercepté par `bancSupabase`, donc
 * aucun `Authorization` ne sort. C'est aussi la raison pour laquelle la route du
 * banc est conditionnée à `import.meta.env.DEV` — semer une session dans un
 * bundle déployé n'aurait aucune excuse.
 */

// ⚠ La session et les deux identités vivent dans `bancSession.ts`, importé par
// `App.tsx` : elles doivent être posées AVANT que les providers montent, et ce
// fichier-ci arrive derrière un import lazy. Voir l'en-tête de `bancSession`.
export { AGENCE_BANC, AGENT_BANC } from './bancSession'
import { AGENCE_BANC, AGENT_BANC } from './bancSession'

/* ─── Le socle : ce que le CHROME tire sur CHAQUE écran ────────────────────── */

const ilYA = (heures: number) => new Date(Date.now() - heures * 3_600_000).toISOString()

const CONTACTS = [
  { id: 'c1', agency_id: AGENCE_BANC.id, full_name: 'Camille Rochat', first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03', role: 'buyer', status: 'active', canton: 'GE', last_interaction_at: ilYA(26), created_at: ilYA(900) },
  { id: 'c2', agency_id: AGENCE_BANC.id, full_name: 'Théo Baumgartner', first_name: 'Théo', last_name: 'Baumgartner', email: 'theo.b@example.ch', phone: '+41 78 220 14 77', role: 'seller', status: 'active', canton: 'VD', last_interaction_at: ilYA(74), created_at: ilYA(1400) },
  { id: 'c3', agency_id: AGENCE_BANC.id, full_name: 'Salomé Perret', first_name: 'Salomé', last_name: 'Perret', email: 's.perret@example.ch', phone: '+41 76 903 55 12', role: 'buyer', status: 'active', canton: 'GE', last_interaction_at: ilYA(191), created_at: ilYA(2100) },
]

const EVENEMENTS = [
  { id: 'e1', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'contact_created', category: 'contact', severity: 'info', entity_type: 'contact', entity_id: 'c1', created_at: ilYA(1) },
  { id: 'e2', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'visit_scheduled', category: 'visit', severity: 'info', entity_type: 'visit', entity_id: 'v1', created_at: ilYA(4) },
  { id: 'e3', agency_id: AGENCE_BANC.id, actor_id: 'ai', actor_kind: 'ai', action: 'relance_drafted', category: 'relance', severity: 'info', entity_type: 'contact', entity_id: 'c3', created_at: ilYA(9) },
  { id: 'e4', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'listing_published', category: 'listing', severity: 'info', entity_type: 'property', entity_id: 'p1', created_at: ilYA(30) },
]

/**
 * Tables du banc.
 *
 * ⚠ Volontairement PARTIEL au lot 0 : le socle du chrome et de quoi peupler
 * « Aujourd'hui ». Ce qui manque est COMPTÉ et affiché par les commandes du banc
 * — un banc qui tronque en silence se lit « tout couvert », et c'est chaque
 * vague qui ajoute les siennes.
 */
export const CRM_TABLES: Record<string, unknown[]> = {
  profiles: [AGENT_BANC],
  agencies: [AGENCE_BANC],
  contacts: CONTACTS,
  activity_events: EVENEMENTS,
  relance_sessions: [],
  relance_items: [],
  reminders: [
    { id: 'r1', agency_id: AGENCE_BANC.id, user_id: AGENT_BANC.id, contact_id: 'c1', title: 'Rappeler pour le dossier Champel', due_at: ilYA(-3), status: 'pending', kind: 'call', created_at: ilYA(48) },
    { id: 'r2', agency_id: AGENCE_BANC.id, user_id: AGENT_BANC.id, contact_id: 'c3', title: 'Envoyer le comparatif de quartier', due_at: ilYA(-27), status: 'pending', kind: 'email', created_at: ilYA(52) },
  ],
  visits: [
    { id: 'v1', agency_id: AGENCE_BANC.id, contact_id: 'c1', property_id: 'p1', scheduled_at: ilYA(-5), status: 'confirmed', created_at: ilYA(40) },
  ],
  properties: [
    { id: 'p1', agency_id: AGENCE_BANC.id, title: 'Appartement 4,5 pièces · Champel', city: 'Genève', canton: 'GE', price: 1_450_000, rooms: 4.5, surface: 118, status: 'active', transaction_type: 'sale', published_at: ilYA(120), created_at: ilYA(400) },
    { id: 'p2', agency_id: AGENCE_BANC.id, title: 'Villa individuelle · Cologny', city: 'Cologny', canton: 'GE', price: 3_200_000, rooms: 7, surface: 260, status: 'active', transaction_type: 'sale', published_at: ilYA(300), created_at: ilYA(700) },
  ],
  transactions: [],
  matches: [],
  crm_offers: [],
  seller_leads: [],
  kyc_cases: [],
  property_scores: [],
  appointments: [],
}

/**
 * RPC du banc.
 *
 * `claim_pending_role` est appelée par `useAuth` à chaque ouverture de session :
 * sans fixture elle rendrait `[]`, ce qui est juste, mais la COMPTER dans les
 * appels sans fixture noierait le signal des vraies manques.
 */
/**
 * Les trois RPC d'Analytics, à la FORME que `buildAxData` attend.
 *
 * ⚠ LA FORME, PAS SEULEMENT LE NOM. La console avait livré quatre fixtures
 * syntaxiquement valides et sémantiquement fausses — un taux rendu en fraction
 * affiché « 870,0 % », une enveloppe de RPC incomplète qui faisait lever le
 * lecteur et éprouver la branche d'ÉCHEC en croyant éprouver le succès. Ces
 * trois-ci sont recopiées des interfaces `CockpitJson`, `ObjectifJson` et
 * `FunnelJson`, champ par champ : une clé manquante rend `undefined` là où la
 * page attend un nombre, et l'écran ment sans erreur.
 */
const AX_COCKPIT = {
  scope: 'me', period: 'month', velocity_source: 'stage_change',
  decomp: { signed: 84_000, compromis: 42_000, offres: 61_000, pipeline: 128_000 },
  decomp_flags: {
    signed: { n_default_pct: 0, n_missing_price: 0 },
    compromis: { n_default_pct: 1, n_missing_price: 0 },
    offres: { n_default_pct: 2, n_missing_price: 1 },
    pipeline: { n_default_pct: 4, n_missing_price: 2 },
  },
  projected: 187_450,
  contributors: [
    { name: 'Champel · 4,5 p', stage: 'compromis', amount: 42_000, price_missing: false, pct_default: false },
    { name: 'Cologny · villa', stage: 'offre', amount: 61_000, price_missing: false, pct_default: true },
  ],
  deals: 12, n_signed: 3, volume_signed: 2_800_000,
  conversion: 0.26, conversion_prev: 0.21,
  delta_deals: 2, velocity: 34, kyc_risk: 1, kyc_urgent: 0, kyc_risk_prev: 2,
}

const AX_OBJECTIF = {
  period: 'month', trunc: 'week', target: 250_000, target_is_set: true,
  realized: 84_000, buckets: 4, realIdx: 2,
  xLabels: ['S1', 'S2', 'S3', 'S4'],
  real: [21_000, 38_000, 84_000, 0],
  median: [25_000, 55_000, 90_000, 140_000],
  projected: 187_450, label: 'Août 2026',
}

const AX_FUNNEL = {
  funnel: { leads: 34, leads_prev: 28, qualif: 19, qualif_prev: 17, visits: 11, offers: 5, compromis: 2 },
  sources: [
    { source: 'flatfox', v: 14, conv: 0.21, prev: 11, comm: 42_000, won: 1 },
    { source: 'site', v: 9, conv: 0.33, prev: 8, comm: 61_000, won: 1 },
    { source: 'recommandation', v: 6, conv: 0.5, prev: 5, comm: 84_000, won: 1 },
  ],
  forecast: { n30: 3, mid30: 96_000, n60: 6, mid60: 148_000, n90: 9, mid90: 205_000 },
}

/** Le journal de version, tel que `get_agent_changelog` le PROJETTE. */
const CHANGELOG = [
  {
    id: 'chg-1', version: '2026.08',
    title: 'Les états vides parlent d’une seule voix',
    content: 'Un idiome unique remplace les trois grammaires qui coexistaient.',
    published_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]

/**
 * Ce que les trois RPC d'Analytics rendent quand il n'y a RIEN — un objet
 * complet à zéro, pas `null`. C'est la différence entre « aucune commission sur
 * la période » (un état vide, qui se dessine) et « la donnée n'est pas arrivée »
 * (un squelette, qui tourne).
 */
export const CRM_RPC_VIDE: Record<string, unknown> = {
  analytics_cockpit: {
    ...AX_COCKPIT,
    decomp: { signed: 0, compromis: 0, offres: 0, pipeline: 0 },
    projected: 0, contributors: [], deals: 0, n_signed: 0, volume_signed: 0,
    conversion: null, conversion_prev: null, delta_deals: 0, velocity: 0,
    kyc_risk: 0, kyc_urgent: 0, kyc_risk_prev: 0,
  },
  // ⚠ `target_is_set` RESTE VRAI. Le mettre à faux ne montre pas l'état vide : il
  // route vers `AxFirstRun` (« Fixe ton objectif annuel »), qui est un écran
  // d'ACCUEIL. L'état vide d'Analytics, c'est « un objectif est fixé, rien n'a
  // encore été réalisé » — vu à l'écran, pas déduit de la forme.
  analytics_objectif: {
    ...AX_OBJECTIF,
    realized: 0, realIdx: 0,
    real: [0, 0, 0, 0], median: [0, 0, 0, 0], projected: 0,
  },
  analytics_funnel: {
    funnel: { leads: 0, leads_prev: 0, qualif: 0, qualif_prev: 0, visits: 0, offers: 0, compromis: 0 },
    sources: [],
    forecast: { n30: 0, mid30: 0, n60: 0, mid60: 0, n90: 0, mid90: 0 },
  },
  get_agent_changelog: [],
}

export const CRM_RPC: Record<string, unknown> = {
  claim_pending_role: null,
  is_super_admin: false,
  // ⚠ `analytics_*` rendent un OBJET, pas un tableau : le hook les lit
  // directement comme `CockpitJson` / `ObjectifJson` / `FunnelJson`.
  analytics_cockpit: AX_COCKPIT,
  analytics_objectif: AX_OBJECTIF,
  analytics_funnel: AX_FUNNEL,
  get_agent_changelog: CHANGELOG,
}
