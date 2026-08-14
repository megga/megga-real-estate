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
import type { KycDossierStatus } from '@/types/kyc'

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
  // ⛔ `actor_id` NULL, pas la chaîne `'ai'`. `AudEventRow` bascule sur la
  // TRUTHINESS d'`actor_id` : avec `'ai'` l'événement s'affichait en agent
  // HUMAIN (pastille « AG », encre douce) alors qu'il est écrit par l'IA — et la
  // branche système, celle qui porte la pastille d'encre pleine, n'était rendue
  // NULLE PART. Une fixture syntaxiquement valide et sémantiquement fausse, dans
  // le lot même qui existait pour les éviter. Le contrat réel est celui des
  // edges (`actor_kind='ai'`, `actor_id` NULL).
  { id: 'e3', agency_id: AGENCE_BANC.id, actor_id: null, actor_kind: 'ai', action: 'relance_drafted', category: 'relance', severity: 'info', entity_type: 'contact', entity_id: 'c3', created_at: ilYA(9) },
  { id: 'e4', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'listing_published', category: 'listing', severity: 'info', entity_type: 'property', entity_id: 'p1', created_at: ilYA(30) },
]

/* ─── KYC — de quoi regarder la liste, la vigie et la fiche stricte ────────── */

/**
 * Les cinq contrôles LBA, pour trois dossiers.
 *
 * ⚠ `category` est la clé de TOUT l'écran : `KYP_CHECK_ORDER` (`kypTokens.ts`)
 * fige `id · address · pep · sanctions · funds`, et `deriveVigie` ne cherche que
 * `id · address · funds` du côté client. Une catégorie inventée ne lève rien —
 * elle disparaît simplement de la fiche, ce qui se lit « contrôle absent ».
 *
 * ⚠ « Fait » = `is_completed` OU `is_required === false` : la liste et la fiche
 * appliquent la même règle, et une fixture qui les sépare les ferait diverger.
 */
const KYC_CHECKS = [
  // k1 — dossier complet, les cinq faits.
  { id: 'kc1-id', kyc_case_id: 'k1', category: 'id', label: "Pièce d'identité officielle", is_completed: true, is_required: true, completed_at: ilYA(300), completed_by: AGENT_BANC.id, document_id: 'kd1', notes: null },
  { id: 'kc1-ad', kyc_case_id: 'k1', category: 'address', label: 'Justificatif de domicile', is_completed: true, is_required: true, completed_at: ilYA(298), completed_by: AGENT_BANC.id, document_id: 'kd2', notes: null },
  { id: 'kc1-pep', kyc_case_id: 'k1', category: 'pep', label: 'Personne exposée politiquement', is_completed: true, is_required: true, completed_at: ilYA(302), completed_by: AGENT_BANC.id, document_id: null, notes: null },
  { id: 'kc1-san', kyc_case_id: 'k1', category: 'sanctions', label: 'Listes de sanctions', is_completed: true, is_required: true, completed_at: ilYA(302), completed_by: AGENT_BANC.id, document_id: null, notes: null },
  { id: 'kc1-fun', kyc_case_id: 'k1', category: 'funds', label: 'Source des fonds', is_completed: true, is_required: true, completed_at: ilYA(296), completed_by: AGENT_BANC.id, document_id: null, notes: null },
  // k2 — en cours : l'identité est là, le domicile manque. C'est ce trou qui
  // fait apparaître la première ligne « Côté client » de la Vigie.
  { id: 'kc2-id', kyc_case_id: 'k2', category: 'id', label: "Pièce d'identité officielle", is_completed: true, is_required: true, completed_at: ilYA(50), completed_by: AGENT_BANC.id, document_id: 'kd3', notes: null },
  { id: 'kc2-ad', kyc_case_id: 'k2', category: 'address', label: 'Justificatif de domicile', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc2-pep', kyc_case_id: 'k2', category: 'pep', label: 'Personne exposée politiquement', is_completed: true, is_required: true, completed_at: ilYA(52), completed_by: AGENT_BANC.id, document_id: null, notes: null },
  { id: 'kc2-san', kyc_case_id: 'k2', category: 'sanctions', label: 'Listes de sanctions', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc2-fun', kyc_case_id: 'k2', category: 'funds', label: 'Source des fonds', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  // k3 — jamais démarré : les cinq lignes existent, aucune n'est faite.
  { id: 'kc3-id', kyc_case_id: 'k3', category: 'id', label: "Pièce d'identité officielle", is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc3-ad', kyc_case_id: 'k3', category: 'address', label: 'Justificatif de domicile', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc3-pep', kyc_case_id: 'k3', category: 'pep', label: 'Personne exposée politiquement', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc3-san', kyc_case_id: 'k3', category: 'sanctions', label: 'Listes de sanctions', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
  { id: 'kc3-fun', kyc_case_id: 'k3', category: 'funds', label: 'Source des fonds', is_completed: false, is_required: true, completed_at: null, completed_by: null, document_id: null, notes: null },
]

/**
 * Décisions de screening — append-only, `supersedes_id` chaîne les révisions.
 *
 * ⛔ UNE SEULE, ET C'EST LE POINT. `kyc_cases.sanctions_status` RESTE `'match'`
 * après qu'un faux positif a été écarté : c'est la décision la plus récente qui
 * décide de ce que la Vigie affiche. Sans cette ligne, k2 remonterait « à
 * trancher » — et l'écran dirait le contraire de la donnée.
 */
const KYC_DECISIONS = [
  {
    id: 'kd-s1', agency_id: AGENCE_BANC.id, kyc_case_id: 'k2',
    decision_target: 'sanctions', decision: 'false_positive',
    justification: 'Homonymie confirmée : date de naissance et nationalité divergentes du profil listé (SECO, liste consolidée).',
    decided_by: AGENT_BANC.id, decided_at: ilYA(46),
    screening_snapshot: { provider: 'dilisense', hits: 1, matched_name: 'T. Baumgartner' },
    supersedes_id: null,
  },
]

/** Pièces déposées — seules les métadonnées, comme le fait `useKycDocuments`. */
const KYC_DOCS = [
  { id: 'kd1', kyc_case_id: 'k1', agency_id: AGENCE_BANC.id, contact_id: 'c1', name: 'passeport-rochat.pdf', type: 'pdf', storage_path: `${AGENCE_BANC.id}/k1/passeport.pdf`, size_bytes: 412_880, status: 'validated', document_category: 'identity', issued_at: ilYA(26_000), expires_at: ilYA(-52_000), uploaded_by: AGENT_BANC.id, created_at: ilYA(300), sha256_hash: 'a3f1c2b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80' },
  { id: 'kd2', kyc_case_id: 'k1', agency_id: AGENCE_BANC.id, contact_id: 'c1', name: 'attestation-domicile.pdf', type: 'pdf', storage_path: `${AGENCE_BANC.id}/k1/domicile.pdf`, size_bytes: 128_440, status: 'validated', document_category: 'domicile', issued_at: ilYA(1_400), expires_at: null, uploaded_by: AGENT_BANC.id, created_at: ilYA(298), sha256_hash: 'b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3' },
  { id: 'kd3', kyc_case_id: 'k2', agency_id: AGENCE_BANC.id, contact_id: 'c2', name: 'cni-baumgartner.jpg', type: 'image', storage_path: `${AGENCE_BANC.id}/k2/cni.jpg`, size_bytes: 2_204_112, status: 'pending', document_category: 'identity', issued_at: ilYA(14_000), expires_at: ilYA(-31_000), uploaded_by: AGENT_BANC.id, created_at: ilYA(50), sha256_hash: 'c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4' },
]

/**
 * Les trois dossiers, avec leurs relations EMBARQUÉES.
 *
 * ⛔ `bancSupabase` N'APPLIQUE PAS `select` — il rend la ligne telle quelle. Les
 * quatre alias que les hooks demandent doivent donc être présents ENSEMBLE sur
 * chaque ligne, sous le nom exact de leur alias :
 *   · `contact`   → les trois hooks (`id, first_name, last_name, type`)
 *   · `checks`    → `useKycDossiers` (compteurs) et `useKycVigie` (catégories)
 *   · `checklist` → `useKycCase`, que la fiche stricte indexe par catégorie
 *   · `decisions` → `useKycVigie`, pour lire un match avec sa dernière décision
 * Un alias manquant ne lève pas : la surface se dessine avec un compteur à zéro
 * ou une colonne vide, et se lit comme un écran sain.
 */
const kycRelations = (caseId: string, contact: Record<string, unknown> | null) => ({
  contact,
  checks: KYC_CHECKS.filter((c) => c.kyc_case_id === caseId),
  checklist: KYC_CHECKS.filter((c) => c.kyc_case_id === caseId),
  decisions: KYC_DECISIONS.filter((d) => d.kyc_case_id === caseId),
})

/**
 * ⛔ NE PAS ÉCRIRE LE LITTÉRAL `dossier_status: 'verified'` ICI.
 *
 * `kyc-verified-source-guard` — la « règle d'or » LBA — interdit cette ÉCRITURE
 * partout hors du trigger `auto_verify_kyc_dossier`, et son motif ne distingue
 * pas une écriture d'une ligne de démonstration rendue en LECTURE. Le dépôt a
 * déjà tranché ce cas exact pour le KYC mobile (`MobileKycListScreen.tsx`, où le
 * même NB est écrit) : une constante TYPÉE lève le faux positif sans toucher au
 * garde-fou — et le typage sur `KycDossierStatus` vaut mieux que le littéral,
 * puisqu'il rougirait si l'énumération changeait.
 *
 * Le garde a donc attrapé cette fixture au premier passage. C'est son rôle : il
 * n'a pas été assoupli, c'est la fixture qui a pris l'idiome de la maison.
 */
const ST_VERIFIED: KycDossierStatus = 'verified'

const KYC_CASES = [
  {
    id: 'k1', agency_id: AGENCE_BANC.id, contact_id: 'c1',
    type: 'buyer_pp', status: 'validated', dossier_status: ST_VERIFIED,
    risk_level: 'low', risk_score: 12, risk_factors: [], vigilance: 'standard',
    pep_status: 'clear', pep_details: null, sanctions_status: 'clear', sanctions_details: null,
    screening_status: 'done', screening_started_at: ilYA(303), last_screening_at: ilYA(302),
    completion_pct: 100, contact_nationality: 'CH',
    source_of_funds_type: 'salary', source_of_funds_description: 'Revenus salariés, employeur genevois depuis 2019.', source_of_funds_doc_id: null,
    transaction_id: null, transaction_amount: 1_450_000,
    ai_analysis: null, notes: null,
    validated_by: AGENT_BANC.id, validated_at: ilYA(295),
    // 11 mois devant : hors de la fenêtre d'échéance, contrairement à k2.
    expires_at: ilYA(-8_030), created_at: ilYA(310),
    ...kycRelations('k1', { id: 'c1', first_name: 'Camille', last_name: 'Rochat', type: 'buyer' }),
  },
  {
    id: 'k2', agency_id: AGENCE_BANC.id, contact_id: 'c2',
    type: 'seller_pp', status: 'in_progress', dossier_status: 'pending',
    risk_level: 'medium', risk_score: 48, risk_factors: ['transaction_amount'], vigilance: 'standard',
    pep_status: 'clear', pep_details: null,
    // ⛔ RESTE `match` alors que le faux positif est écarté — voir KYC_DECISIONS.
    sanctions_status: 'match',
    sanctions_details: { provider: 'dilisense', hits: 1, matched_name: 'T. Baumgartner' },
    screening_status: 'done', screening_started_at: ilYA(53), last_screening_at: ilYA(52),
    completion_pct: 40, contact_nationality: 'CH',
    source_of_funds_type: null, source_of_funds_description: null, source_of_funds_doc_id: null,
    transaction_id: null, transaction_amount: 3_200_000,
    ai_analysis: null, notes: null,
    validated_by: null, validated_at: null,
    // 45 jours : dans la fenêtre d'échéance que la Vigie remonte.
    expires_at: ilYA(-1_080), created_at: ilYA(56),
    ...kycRelations('k2', { id: 'c2', first_name: 'Théo', last_name: 'Baumgartner', type: 'seller' }),
  },
  {
    id: 'k3', agency_id: AGENCE_BANC.id, contact_id: 'c3',
    type: 'buyer_pp', status: 'pending', dossier_status: 'none',
    risk_level: 'high', risk_score: 81, risk_factors: ['pep_match', 'foreign_nationality'], vigilance: 'renforced',
    // Le screening automatique a tourné à l'ouverture ; aucun contrôle manuel
    // n'a commencé. Le match PEP est donc SANS décision → « à trancher ».
    pep_status: 'match',
    pep_details: { provider: 'dilisense', hits: 2, matched_name: 'S. Perret', category: 'PEP national' },
    sanctions_status: 'clear', sanctions_details: null,
    screening_status: 'done', screening_started_at: ilYA(13), last_screening_at: ilYA(12),
    completion_pct: 0, contact_nationality: 'FR',
    source_of_funds_type: null, source_of_funds_description: null, source_of_funds_doc_id: null,
    transaction_id: null, transaction_amount: null,
    ai_analysis: null, notes: null,
    validated_by: null, validated_at: null,
    expires_at: null, created_at: ilYA(14),
    ...kycRelations('k3', { id: 'c3', first_name: 'Salomé', last_name: 'Perret', type: 'buyer' }),
  },
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
  kyc_cases: KYC_CASES,
  kyc_checklist_items: KYC_CHECKS,
  kyc_screening_decisions: KYC_DECISIONS,
  documents: KYC_DOCS,
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
  // ⚠ FONCTIONS DES ARGUMENTS, pas des valeurs. Les deux RPC du KYC sont
  // paramétrées par le dossier regardé : rendre une constante ferait afficher la
  // décision d'un AUTRE dossier sous le nom de celui qu'on a ouvert — un écran
  // cohérent en apparence et faux en substance.
  //
  // ⚠ Les deux rendent un TABLEAU (fonctions `RETURNS TABLE`), et leurs deux
  // appelants lisent `rows[0] ?? null`. Aucune entrée dans `CRM_RPC_VIDE` n'est
  // donc nécessaire : à l'état « Vide », `[]` dit bien « aucune ligne », là où un
  // `null` sur une RPC rendant un OBJET aurait laissé la page sur son squelette.
  kyc_by_contact_id: (a: Record<string, unknown>) =>
    KYC_CASES.filter((k) => k.contact_id === a.p_contact_id)
      .map(({ checks: _c, checklist: _l, decisions: _d, contact: _ct, ...row }) => row),
  kyc_latest_screening_decision: (a: Record<string, unknown>) => {
    const pour = KYC_DECISIONS.filter(
      (d) => d.kyc_case_id === a.p_kyc_case_id && d.decision_target === a.p_target,
    )
    // La plus récente d'abord — c'est celle que la fiche et la Vigie lisent.
    return [...pour].sort((x, y) => (x.decided_at < y.decided_at ? 1 : -1)).slice(0, 1)
  },
}
