/**
 * Fixtures du banc `/dev/crm` — données de DÉMONSTRATION, rien ne vient de la
 * base et aucun geste n'écrit.
 *
 * ── CE QUE CE FICHIER PORTE EN PLUS DE `adminFixtures` : UNE SESSION ─────────
 * La console super-admin se regardait sans session : ses hooks lisent des RPC
 * qui ne dépendent pas d'un profil. Le CRM agent, non — mesuré, ses hooks sont
 * gatés sur `profile?.agency_id` (`useAgencySettings`, `useRelanceLeads`,
 * `useIdentityGate`…), et `AgentLayout` RETIENT l'écran sur `BootSplash`
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
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { PHOTO } from '@/components/crm/today/data'
import type { KycDossierStatus } from '@/types/kyc'
import { JOURS_BAISSE, JOURS_MANDAT, JOURS_NOUVEAU } from '@/components/matching-fil/filSignaux'
import { STATUTS_COMPATIBLES } from '@/components/matching-fil/filQuiPour'

/* ─── Le socle : ce que le CHROME tire sur CHAQUE écran ────────────────────── */

const ilYA = (heures: number) => new Date(Date.now() - heures * 3_600_000).toISOString()

/**
 * Une ligne `contacts` complète — les colonnes RÉELLES de la table, valeurs par défaut
 * de la base.
 *
 * ⛔ LE TYPE VIT DANS `type`, PAS DANS `role`. Les trois premières lignes portaient
 * `role: 'seller'`, une colonne qui n'existe pas : `contactToCrm` lit `type`, retombait
 * sur « acheteur », et la liste Contacts montrait un vendeur en acheteur — sans budget
 * ni critère, puisque rien ne les portait. `full_name`, `status` et `canton` n'existent
 * pas non plus ; ils restent pour les lecteurs du banc qui les attendaient.
 *
 * ⚠ `roles` (PLURIEL) est une vraie colonne depuis le 22.09.2026 — à ne pas confondre avec le
 * `role` singulier ci-dessus, qui n'a jamais existé. C'est elle qui fait foi, `type` en dérive.
 * Mais le banc n'a AUCUN déclencheur : c'est à chaque fixture d'être d'accord avec elle-même,
 * comme pour les dates du lot C. `banc-contacts-roles.spec.ts` rejoue `typeDeRoles()` sur
 * chaque ligne et rougit à la première qui diverge.
 */
const contact = (id: string, prenom: string, nom: string, champs: Record<string, unknown>) => ({
  id, agency_id: AGENCE_BANC.id, entity_type: 'pp', user_id: null, deleted_user_id: null,
  full_name: `${prenom} ${nom}`, first_name: prenom, last_name: nom, status: 'active',
  email: null, phone: null, type: 'buyer', roles: ['buyer'], source: 'manual', score: null, tags: [],
  notes: null, language: 'fr', form_data: null, search_criteria: null,
  birth_date: null, nationality: null, residence_country: null, home_address: null,
  wa_opt_in: false, wa_consent_at: null, wa_opt_out_at: null, wa_suppressed: false,
  import_raw_text: null, import_raw_text_received_at: null,
  updated_at: null, last_interaction_at: null, created_at: ilYA(900),
  ...champs,
})

// ⚠ EXPORTÉ pour `banc-contacts-roles.spec.ts` seul : c'est la seule façon de confronter les
// fixtures à `typeDeRoles()` sans monter un écran. Les écrans, eux, passent par `CRM_TABLES`.
export const CONTACTS = [
  contact('c1', 'Camille', 'Rochat', {
    email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03', canton: 'GE',
    type: 'buyer', score: 'hot', source: 'website', tags: ['Primo-accédante'],
    notes: 'Cherche un 4,5 pièces lumineux, proche des écoles. Financement confirmé par sa banque.',
    nationality: 'CH', residence_country: 'CH', wa_opt_in: true, wa_consent_at: ilYA(880),
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Carouge', 'GE'], budget_min: 900_000, budget_max: 1_250_000, rooms_min: 4.5, surface_min: 90, features: ['balcon', 'ascenseur'] },
    last_interaction_at: ilYA(26), created_at: ilYA(900),
  }),
  contact('c2', 'Théo', 'Baumgartner', {
    email: 'theo.b@example.ch', phone: '+41 78 220 14 77', canton: 'VD',
    // Étape 3 : le contact à TROIS rôles — la pastille « Vendeur », le « +2 », les trois noms au survol.
    type: 'seller', roles: ['seller', 'referrer', 'trustee'], score: 'warm', source: 'referral', language: 'de', tags: ['Mandat exclusif'],
    notes: 'Vend son 5 pièces à Lutry ; souhaite signer avant la fin de l’année.',
    last_interaction_at: ilYA(74), created_at: ilYA(1400),
  }),
  contact('c3', 'Salomé', 'Perret', {
    email: 's.perret@example.ch', phone: '+41 76 903 55 12', canton: 'GE',
    type: 'buyer', score: 'warm', source: 'manual',
    search_criteria: { transaction_type: 'buy', type: 'house', zones: ['Collonge-Bellerive', 'Vandœuvres', 'GE'], budget_min: 1_600_000, budget_max: 2_100_000, rooms_min: 6, surface_min: 160, features: ['garden', 'parking'] },
    last_interaction_at: ilYA(191), created_at: ilYA(2100),
  }),
  contact('c4', 'Luca', 'Bernasconi', {
    email: 'luca.bernasconi@example.ch', phone: '+41 79 655 31 20', canton: 'GE',
    type: 'tenant', roles: ['tenant'], score: 'hot', source: 'whatsapp_ai', language: 'it',
    search_criteria: { transaction_type: 'rent', type: 'apartment', zones: ['Genève', 'GE'], budget_min: 2_500, budget_max: 3_200, rooms_min: 3.5 },
    last_interaction_at: ilYA(5), created_at: ilYA(60),
  }),
  contact('c5', 'Nadia', 'Haddad', {
    email: 'n.haddad@example.ch', phone: '+41 22 710 44 90', canton: 'GE',
    type: 'landlord', roles: ['landlord'], score: 'cold', source: 'import', tags: ['Immeuble Plainpalais'],
    last_interaction_at: ilYA(620), created_at: ilYA(3000),
  }),
  contact('c6', 'Olivier', 'Mottier', {
    email: 'olivier.mottier@example.ch', phone: '+41 79 301 67 45', canton: 'VD',
    // Étape 3 : l'acquéreur-vendeur, enfin ÉCRIVABLE — `both` n'est plus qu'un type dérivé de ces deux rôles.
    type: 'both', roles: ['buyer', 'seller'], score: 'warm', source: 'referral',
    notes: 'Vend sa maison de Pully pour acheter plus petit en ville.',
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Lausanne', 'VD'], budget_max: 1_100_000, rooms_min: 3.5 },
    last_interaction_at: ilYA(48), created_at: ilYA(400),
  }),
  contact('c7', 'Emma', 'Schneider', {
    email: 'emma.schneider@example.com', phone: '+41 76 488 02 19', canton: 'ZH',
    type: 'investor', roles: ['investor'], score: 'hot', source: 'website', language: 'en', tags: ['Investisseuse'],
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Zürich', 'Genève', 'ZH', 'GE'], budget_min: 1_200_000, budget_max: 3_000_000 },
    last_interaction_at: ilYA(12), created_at: ilYA(150),
  }),
  // Le prospect entré par WhatsApp que la cloche annonce (`n1`, « Léa Martin (via WhatsApp) »).
  // Étape 3 : le contact SANS rôle — aucune pastille sur sa ligne, et c'est ce vide qui rend `lead`.
  contact('c8', 'Léa', 'Martin', {
    phone: '+41 78 902 11 36', type: 'lead', roles: [], source: 'whatsapp_ai',
    last_interaction_at: ilYA(0.2), created_at: ilYA(0.2),
  }),
  // Le fil de matchs (17.09.2026) : deux acheteurs dont la recherche TIENT sur Champel et sur
  // Cologny. Antoine n'a pas de téléphone (la feuille d'envoi qui le montrait est retirée le 21.09.2026).
  contact('c9', 'Julie', 'Morand', {
    email: 'julie.morand@example.ch', phone: '+41 79 530 18 64', canton: 'GE',
    type: 'buyer', score: 'hot', source: 'referral',
    search_criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000, rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'] },
    last_interaction_at: ilYA(30), created_at: ilYA(200),
  }),
  contact('c10', 'Antoine', 'Lefèvre', {
    email: 'a.lefevre@example.ch', canton: 'GE', type: 'buyer', score: 'warm', source: 'website', language: 'en',
    search_criteria: { transaction_type: 'buy', type: 'house', zones: ['Cologny', 'Vandœuvres', 'GE'], budget_min: 2_800_000, budget_max: 3_500_000, rooms_min: 6, surface_min: 240, features: ['piscine', 'jardin', 'cave'] },
    last_interaction_at: ilYA(90), created_at: ilYA(500),
  }),
  // Lot C (22.09.2026). Anastasia pose les TROIS critères du lot : 4 chambres, rénovée au moins, off-market.
  // Philippe et Nathalie sont d'anciens prospects : leur fiche n'a plus de critères (le pont a fermé leur recherche).
  contact('c11', 'Anastasia', 'Volkova', {
    email: 'a.volkova@example.ch', phone: '+41 79 214 60 88', canton: 'GE', type: 'buyer', score: 'hot', source: 'referral', language: 'en',
    search_criteria: {
      transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Florissant', 'GE'], budget_min: 2_000_000, budget_max: 2_600_000,
      rooms_min: 5, bedrooms_min: 4, condition_min: 'renovated', off_market_only: true, features: ['terrasse', 'vue lac'],
    },
    last_interaction_at: ilYA(20), created_at: ilYA(24 * 30),
  }),
  contact('c12', 'Philippe', 'Rey', {
    email: 'philippe.rey@example.ch', phone: '+41 78 331 07 52', canton: 'GE', type: 'buyer', score: 'cold', source: 'website',
    last_interaction_at: ilYA(24 * 130), created_at: ilYA(24 * 400),
  }),
  contact('c13', 'Nathalie', 'Gerber', {
    email: 'n.gerber@example.ch', phone: '+41 76 540 93 17', canton: 'GE', type: 'buyer', score: 'warm', source: 'referral',
    last_interaction_at: ilYA(24 * 25), created_at: ilYA(24 * 500),
  }),
  // Étape 3 (22.09.2026) : le RÉSEAU PUR, le cas qu'aucune autre ligne ne montrait. Aucun rôle
  // de transaction, donc `type = 'lead'` : il se voit au sélecteur de rôles et compte pour
  // « Private banker », mais aucun des quatre onglets ne le prend.
  // ⚠ Sans recherche, sans score, sans dossier ni deal — un banquier privé n'achète rien ici, et
  // lui inventer des critères ferait croire que le matching le prend.
  contact('c14', 'Jean-Marc', 'Dupraz', {
    email: 'jm.dupraz@example.ch', phone: '+41 22 819 03 27', canton: 'GE',
    type: 'lead', roles: ['private_banker'], source: 'manual',
    notes: 'Banquier privé à Genève ; il présente ses clients quand l’un d’eux vend ou achète.',
    last_interaction_at: ilYA(24 * 6), created_at: ilYA(24 * 210),
  }),
]

/**
 * ⛔ LES CATÉGORIES SONT CELLES DU CHECK, et seulement elles. Trois lignes portaient
 * `visit`, `relance` et `listing`, que `activity_events_category_check` refuse : le banc
 * montrait des valeurs qu'aucune base ne peut contenir, affichées en brut par le repli
 * `?? { label: event.category }` d'`AudEventRow` — donc impossibles à distinguer du
 * défaut que ce repli existe pour absorber. Valeurs reprises des émetteurs réels
 * (`visit_scheduled` → `contact`, whatsapp-actions ; `bien_published` → `bien`, trigger
 * des biens).
 */
const EVENEMENTS = [
  { id: 'e1', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'contact_created', category: 'contact', severity: 'info', entity_type: 'contact', entity_id: 'c1', created_at: ilYA(1) },
  { id: 'e2', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'visit_scheduled', category: 'contact', severity: 'info', entity_type: 'visit', entity_id: 'v1', created_at: ilYA(4) },
  // ⛔ `actor_id` NULL, pas la chaîne `'ai'`. `AudEventRow` basculait alors sur la
  // TRUTHINESS d'`actor_id` : avec `'ai'` l'événement s'affichait en agent
  // HUMAIN (pastille « AG », encre douce) alors qu'il est écrit par l'IA — et la
  // branche système, celle qui porte la pastille d'encre pleine, n'était rendue
  // NULLE PART. Une fixture syntaxiquement valide et sémantiquement fausse, dans
  // le lot même qui existait pour les éviter. Le contrat réel est celui des
  // edges (`actor_kind='ai'`, `actor_id` NULL) — et la ligne le lit désormais dans
  // `actor_kind` (src/lib/auditActor.ts), pas dans l'absence d'`actor_id`.
  { id: 'e3', agency_id: AGENCE_BANC.id, actor_id: null, actor_kind: 'ai', action: 'whatsapp_agent_copilot_reply', category: 'ai', severity: 'info', entity_type: 'whatsapp_message', entity_id: null, created_at: ilYA(9) },
  { id: 'e4', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'bien_published', category: 'bien', severity: 'info', entity_type: 'property', entity_id: 'p1', created_at: ilYA(30) },
  // Les deux autres acteurs SANS `actor_id`, que la page d'audit doit distinguer de l'IA
  // (src/lib/auditActor.ts) : le SYSTÈME (recalcul nocturne des scores, une ligne par
  // agence et par passe) et l'agent au compte SUPPRIMÉ — `actor_kind` resté 'user', et la
  // preuve déposée par la branche FK du trigger. ⚠ Pas de `email_received` ici :
  // `bancSupabase` laisse passer `not.in`, et la cloche du banc l'afficherait.
  { id: 'e7', agency_id: AGENCE_BANC.id, actor_id: null, actor_kind: 'system', action: 'contact_scores.recompute', category: 'contact', severity: 'info', entity_type: 'contact_scores', entity_id: null, metadata: { count: 3, version: 1 }, created_at: ilYA(20) },
  { id: 'e8', agency_id: AGENCE_BANC.id, actor_id: null, actor_kind: 'user', action: 'contact_created', category: 'contact', severity: 'info', entity_type: 'contact', entity_id: 'c2', metadata: { actor_detached_at: ilYA(200), actor_detached_from: '00000000-0000-4000-8000-00000000dead', actor_detached_reason: 'profile deleted (FK on delete set null)' }, created_at: ilYA(700) },
  // ⚠ `entity_type: 'kyc_case'` — c'est le seul motif que `useKycAuditEvents`
  // retient (avec `kyc` et `kyc_check`). Sans ces deux lignes, la piste d'audit
  // du RAPPORT sort vide, et sa page 3 se relit comme une page réussie.
  // `actor:profiles!actor_id` est embarqué : le banc n'applique pas `select`.
  // ⚠ Les ACTIONS sont celles que la production écrit : `kyc_case_opened` (renommée par
  // 20260729100000) et « Contrôle validé », que le trigger `auto_verify_kyc_dossier` écrit
  // encore en français. Le banc portait `kyc_case_created` et `kyc_check_completed`, que
  // rien n'émet — le journal d'audit les affichait « Kyc case created ».
  { id: 'e5', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'kyc_case_opened', category: 'kyc', severity: 'info', entity_type: 'kyc_case', entity_id: 'k1', metadata: null, created_at: ilYA(310), actor: { full_name: AGENT_BANC.full_name } },
  { id: 'e6', agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'Contrôle validé', category: 'kyc', severity: 'info', entity_type: 'kyc_check', entity_id: 'kc1-id', object_label: 'Pièce d’identité', metadata: { category: 'id', kyc_case_id: 'k1' }, created_at: ilYA(300), actor: { full_name: AGENT_BANC.full_name } },
  // ── Les scénarios de la CLOCHE (14.09.2026) — un événement système ou IA par type
  // (`KIND_META`), sur trois jours, pour relire la popover telle qu'une agence la vit.
  // Actions réelles : celles de la production et de la table du journal. La rafale de
  // trois `match_suggested` sans sujet, à la même seconde, est la forme d'une passe du
  // moteur — elle doit sortir en UNE ligne « ×3 » (`regrouper`). Les matchs et la
  // diffusion désignent un bien PHOTOGRAPHIÉ : la tuile doit en montrer la photo.
  // `metadata` a la forme de la production (`source`, `market_listing_id`, `score`).
  // ⚠ Les sévérités aussi : `kyc_screening_match` est écrit `critical` par kyc-screening,
  // le prospect WhatsApp `warn` par le webhook. `n7` portait `'warning'`, que
  // `activity_events_severity_check` (info · warn · critical) refuse — le journal
  // d'audit montrait une pastille qu'aucune base ne peut produire.
  cloche('n1', 'ai', 'whatsapp_inbound_lead_created', 'contact', 'contact', 'Léa Martin (via WhatsApp)', 0.2, 'warn'),
  cloche('n2', 'system', 'whatsapp_message_received', 'contact', 'contact', 'Camille Rochat', 0.6),
  cloche('n3a', 'ai', 'match_suggested', 'contact', 'match', null, 1.5, 'info', { metadata: { source: 'market', score: 88, contact_id: 'c1', property_id: null, market_listing_id: 'ml-cloche-1' } }),
  cloche('n3b', 'ai', 'match_suggested', 'contact', 'match', null, 1.5, 'info', { metadata: { source: 'market', score: 81, contact_id: 'c3', property_id: null, market_listing_id: 'ml-cloche-2' } }),
  cloche('n3c', 'ai', 'match_suggested', 'contact', 'match', null, 1.5, 'info', { metadata: { source: 'property', score: 76, contact_id: 'c1', property_id: 'p2', market_listing_id: null } }),
  cloche('n4', 'system', 'visit_scheduled', 'contact', 'visit', 'Rue de Lausanne 12 · jeudi 10:30', 2.2),
  cloche('n5', 'ai', 'reminder_created', 'contact', 'reminder', 'Rappeler Camille Rochat', 3),
  cloche('n6', 'system', 'stage_change', 'deal', 'transaction', 'visit_done → offer', 4),
  cloche('n7', 'ai', 'kyc_screening_match', 'kyc', 'kyc', 'Dossier Rochat · une alerte à examiner', 5, 'critical'),
  cloche('n8', 'system', 'signature.created', 'deal', 'signature', 'Mandat de vente · Avenue de Champel 8', 26),
  cloche('n9', 'system', 'document_filed_from_email', 'doc', 'document', 'Attestation bancaire.pdf', 28),
  cloche('n10', 'system', 'property_published_to_portal', 'bien', 'property', 'Appartement 4,5 pièces · Champel', 30, 'info', { entity_id: 'p1' }),
  cloche('n11', 'ai', 'whatsapp_morning_brief_sent', 'ai', 'agency', null, 33),
  cloche('n12', 'system', 'team_invite_accepted', 'auth', 'profile', 'Sophie Keller', 60),
  cloche('n13', 'system', 'subscription_changed', 'settings', 'agency', 'Plan Pro', 80),
  cloche('n14', 'system', 'whatsapp_number_verified', 'settings', 'agency', null, 120),
]

/**
 * La LONGUE TRAÎNE du journal d'audit (14.09.2026) : 1 100 gestes d'agent, de 100 jours à
 * quatre ans en arrière — absents de 7, 30 et 90 jours, ils ne se montrent qu'en « Tout ».
 * Sans elle, le banc n'atteignait jamais les 1000 lignes d'une page, et la pagination du
 * journal (« Charger les évènements plus anciens ») ne s'y éprouvait pas.
 * ⚠ Des gestes d'AGENT (`actor_kind: 'user'`) sur une fiche qui n'existe pas (`archive`) :
 * la cloche (`neq actor_kind user`) et les timelines (par `entity_id`) ne les voient pas.
 */
const TRAINE_JOURNAL = Array.from({ length: 1100 }, (_, i) => {
  const bien = i % 3 === 2
  return {
    id: `t${String(i + 1).padStart(4, '0')}`, agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user',
    action: bien ? 'bien_updated' : i % 3 === 0 ? 'note_added' : 'contact_created',
    category: bien ? 'bien' : 'contact', severity: 'info', entity_type: bien ? 'property' : 'contact',
    entity_id: 'archive', object_label: `Dossier archivé n° ${i + 1}`, metadata: null,
    created_at: ilYA(2400 + i * 30),
  }
})

/** Un événement de la cloche : écrit par le système ou l'IA, jamais par un agent (`actor_id` NULL). */
function cloche(
  id: string, acteur: 'ai' | 'system', action: string, category: string, entity_type: string,
  object_label: string | null, heures: number, severity = 'info',
  cible: { entity_id?: string; metadata?: Record<string, unknown> } = {},
) {
  return {
    id, agency_id: AGENCE_BANC.id, actor_id: null, actor_kind: acteur, action, category, severity, entity_type,
    entity_id: cible.entity_id ?? null, metadata: cible.metadata ?? null, object_label, created_at: ilYA(heures),
  }
}

/**
 * Les deux annonces de marché que désignent les matchs de la cloche. ⚠ À PART de
 * `ANNONCE_MARCHE_BANC`, qui doit rester SANS photo (elle éprouve le repli du catalogue).
 */
const ANNONCES_CLOCHE = [
  { id: 'ml-cloche-1', title: 'Appartement 3,5 pièces · Carouge', city: 'Carouge', canton: 'GE', transaction_type: 'rent', status: 'active', photos: [PHOTO.carouge], photos_cf: null },
  { id: 'ml-cloche-2', title: 'Appartement 4 pièces · Eaux-Vives', city: 'Genève', canton: 'GE', transaction_type: 'rent', status: 'active', photos: [PHOTO.eauxvives], photos_cf: null },
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
    // Une analyse contextuelle, pour que la section « MEGGA AI » du rapport ait un
    // état à regarder. ⚠ La production n'en produit PLUS depuis #829 (kyc-screening
    // est déterministe) : seuls des dossiers antérieurs en portent une.
    ai_analysis: {
      provider: 'banc', analyzed_at: ilYA(302), qualitative_risk: 'low', vigilance_recommendation: 'standard',
      patterns_detected: [], additional_checks_suggested: [], confidence: 0.91,
      justification: 'Acheteuse suisse résidant à Genève, profession stable, transaction conforme aux pratiques du segment. La source des fonds est documentée et la cohérence documentaire est intégralement vérifiée.',
    },
    notes: null,
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
/**
 * Une annonce de marché, pour la fiche autonome `/dashboard/market/:id`.
 *
 * ⚠ Forme de LIGNE (colonnes de `market_listings`), pas de modèle de vue : le banc
 * intercepte `fetch`, donc `mapListingRow` tourne pour de vrai dessus. C'est ce qui
 * rend le banc utile — il éprouve le mapper, pas seulement le rendu.
 *
 * ⚠ `transaction_type: 'rent'` avec `rent: null` et le montant dans `price` : c'est
 * la forme RÉELLE mesurée en production le 05.09.2026 (0 `rent` renseigné sur 36 770
 * locations actives). Une fixture qui remplirait `rent` cacherait le seul cas où la
 * projection peut se tromper.
 */
export const ANNONCE_MARCHE_BANC = {
  id: '00432e97-f3d2-4d11-9c1f-dd882343ee8e',
  title: 'Appartement traversant de 3.5 pièces vue sur le Léman',
  address: 'Chemin du Lac 4', city: 'Rolle', postal_code: '1180', canton: 'VD',
  type: 'apartment', transaction_type: 'rent',
  price: 2450, current_price: 2450, price_at_first_seen: 2600, price_per_m2: null,
  rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 78,
  features: [], photos: [], photos_cf: null,
  status: 'price_reduced', source_portal: 'flatfox',
  source_url: 'https://flatfox.ch/fr/annonce/demo', source_id: '86339127',
  agency_name: 'Régie du Léman', agency_phone: '021 000 00 00',
  agency_logo_url: null, lat: 46.4583, lng: 6.3372,
  year_built: 2019, days_on_market: 12, land_surface: null,
  // Pige (21.09.2026) : l'âge se lit dans first_seen_at, et removed_at dit un retrait. `price_reduced` :
  // son historique (`HISTORIQUE_PRIX_BANC`) finit sur une baisse sous son premier loyer, 2600 → 2450, et
  // `trg_ra_price_status` pose ce statut à tout loyer sous le premier (Flatfox compris depuis la pige).
  first_seen_at: ilYA(24 * 42), removed_at: null,
  description: "Traversant, balcon plein sud, vue dégagée sur le lac et les Alpes.",
  floor: 3, parking_count: 1, year_renovated: null, usable_surface: 74,
  charges_monthly: 250, is_furnished: false, availability_date: '2026-10-01',
  visit_contact_name: 'Mme Dupont', agency_reference: 'RL-1180-42',
}

/**
 * L'historique du prix de `ANNONCE_MARCHE_BANC` (pige, 21.09.2026) — ce que la fiche autonome lit dans
 * `market_price_history`. Un relevé initial puis une baisse : la courbe, l'écart et la liste ont de quoi se
 * dessiner. ⚠ Forme de LIGNE : le banc filtre `market_listing_id=eq.…` et trie `detected_at.desc,id.desc`.
 */
const HISTORIQUE_PRIX_BANC = [
  {
    id: 'mph-banc-1', market_listing_id: ANNONCE_MARCHE_BANC.id, kind: 'suivi', detected_at: ilYA(24 * 30),
    old_price: null, new_price: 2600, change_pct: null, old_status: null, new_status: 'active',
    transaction_type: 'rent', canton: 'VD', type: 'apartment', city: 'Rolle',
  },
  {
    id: 'mph-banc-2', market_listing_id: ANNONCE_MARCHE_BANC.id, kind: 'baisse', detected_at: ilYA(24 * 6),
    old_price: 2600, new_price: 2450, change_pct: -5.77, old_status: 'active', new_status: 'price_reduced',
    transaction_type: 'rent', canton: 'VD', type: 'apartment', city: 'Rolle',
  },
]

/**
 * Le reste du portefeuille de « Mes biens » : 48 biens, pour un total de 50.
 *
 * ⚠ Pourquoi 50 : à deux biens, la galerie ne montrait ni le défilement, ni une
 * ligne de cartes pleine, ni un filtre qui trie vraiment (Julien, 16.09.2026).
 *
 * ⚠ DÉTERMINISTE — aucun `Math.random` : une capture du banc doit se refaire à
 * l'identique. La variété vient de rotations sur des tables premières entre elles.
 * Mélange voulu : ~un tiers de locations, des réservés, des brouillons (trois sans
 * photo : « Photos à ajouter »), deux en pause, deux vendus, et des mandats qui
 * expirent dans les 60 jours pour peupler « À suivre ».
 */
const PHOTOS_MAISON = [
  '1600596542815-ffad4c1539a9', '1600585154340-be6161a56a0c', '1600047509807-ba8f99d2cdde',
  '1570129477492-45c003edd2be', '1580587771525-78b9dba3b914', '1564013799919-ab600027ffc6',
  '1605276374104-dee2a0ed3cd6', '1523217582562-09d0def993a6', '1576941089067-2de3c901e126',
  '1599809275671-b5942cabc7a2', '1494526585095-c41746248156', '1449844908441-8829872d2607',
  '1518780664697-55e3ad937233', '1568605114967-8130f3a36994', '1512917774080-9991f1c4c750',
]
const PHOTOS_APPART = [
  '1600607687939-ce8a6c25118c', '1600566753190-17f0baa2a6c3', '1502005229762-cf1b2da7c5d6',
  '1505691938895-1758d7feb511', '1556911220-bff31c812dba', '1616594039964-ae9021a400a0',
  '1600210492486-724fe5c67fb0', '1600573472550-8090b5e0745e', '1512918728675-ed5a9ecdebfd',
  '1507089947368-19c1da9775ae', '1554995207-c18c203602cb', '1522708323590-d24dbb6b0267',
  '1484154218962-a197022b5858', '1545324418-cc1a3fa10c00',
]
const PHOTOS_BUREAU = ['1486406146926-c627a92ad1ab', '1497366216548-37526070297c']
const PHOTOS_CHALET = ['1510798831971-661eb04b3739', '1542718610-a1d656d1884c']
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?w=1000&q=80`

/** Ville, canton, NPA, rue, prix de vente au m², loyer mensuel au m². */
const LIEUX: [string, string, string, string, number, number][] = [
  ['Carouge', 'GE', '1227', 'Rue Saint-Joseph', 13_500, 32],
  ['Genève', 'GE', '1207', 'Rue des Eaux-Vives', 15_000, 36],
  ['Lausanne', 'VD', '1003', 'Avenue de Rumine', 11_000, 29],
  ['Nyon', 'VD', '1260', 'Route de Divonne', 10_500, 27],
  ['Cologny', 'GE', '1223', 'Chemin de Ruth', 19_000, 42],
  ['Montreux', 'VD', '1820', 'Grand-Rue', 9_500, 25],
  ['Vevey', 'VD', '1800', 'Rue du Simplon', 9_800, 26],
  ['Fribourg', 'FR', '1700', 'Boulevard de Pérolles', 7_200, 21],
  ['Neuchâtel', 'NE', '2000', 'Rue du Seyon', 6_800, 20],
  ['Sion', 'VS', '1950', 'Avenue de la Gare', 6_500, 19],
  ['Morges', 'VD', '1110', 'Rue Louis-de-Savoie', 10_200, 27],
  ['Chêne-Bougeries', 'GE', '1224', 'Chemin de la Montagne', 16_000, 37],
  ['Verbier', 'VS', '1936', 'Route de Médran', 18_000, 45],
  ['Pully', 'VD', '1009', 'Avenue de Lavaux', 12_500, 31],
  ['Lancy', 'GE', '1212', 'Route du Pont-Butin', 12_000, 30],
  ['Yverdon-les-Bains', 'VD', '1400', 'Rue du Lac', 7_000, 21],
]

/** Gabarit : type DB, libellé du titre, pièces, surface, famille de photo. */
const GABARITS: { type: string; libelle: (pieces: number) => string; pieces: number; surface: number; photos: string[] }[] = [
  { type: 'apartment', libelle: (n) => `Appartement ${String(n).replace('.', ',')} pièces`, pieces: 3.5, surface: 82, photos: PHOTOS_APPART },
  { type: 'house', libelle: () => 'Villa individuelle', pieces: 6.5, surface: 210, photos: PHOTOS_MAISON },
  { type: 'apartment', libelle: (n) => `Attique ${String(n).replace('.', ',')} pièces`, pieces: 5.5, surface: 145, photos: PHOTOS_APPART },
  { type: 'apartment', libelle: () => 'Studio', pieces: 1, surface: 34, photos: PHOTOS_APPART },
  { type: 'house', libelle: () => 'Maison mitoyenne', pieces: 5.5, surface: 160, photos: PHOTOS_MAISON },
  { type: 'apartment', libelle: (n) => `Appartement ${String(n).replace('.', ',')} pièces`, pieces: 4.5, surface: 108, photos: PHOTOS_APPART },
  { type: 'office', libelle: () => 'Bureaux', pieces: 0, surface: 180, photos: PHOTOS_BUREAU },
  { type: 'apartment', libelle: (n) => `Loft ${String(n).replace('.', ',')} pièces`, pieces: 2.5, surface: 74, photos: PHOTOS_APPART },
  { type: 'villa', libelle: () => 'Chalet', pieces: 6, surface: 190, photos: PHOTOS_CHALET },
  { type: 'commercial', libelle: () => 'Arcade commerciale', pieces: 0, surface: 95, photos: PHOTOS_BUREAU },
  { type: 'house', libelle: () => 'Maison de maître', pieces: 9, surface: 340, photos: PHOTOS_MAISON },
]

/**
 * Deux collègues de Gregory — de quoi éprouver les axes « Agent » des filtres de Mes biens.
 * ⚠ Même agence que l'agent du banc : `useTeamMembers` lit `profiles` par `agency_id`.
 */
const COLLEGUES_BANC = [
  { id: '00000000-0000-4000-8000-000000000902', email: 'sophie.keller@megga.local', full_name: 'Sophie Keller', role: 'agent', avatar_url: null, phone: null, canton: 'GE', agency_id: AGENCE_BANC.id, created_at: '2026-02-01T00:00:00Z' },
  { id: '00000000-0000-4000-8000-000000000903', email: 'marc.favre@megga.local', full_name: 'Marc Favre', role: 'agent', avatar_url: null, phone: null, canton: 'VD', agency_id: AGENCE_BANC.id, created_at: '2026-03-01T00:00:00Z' },
]
const AGENTS_BANC = [AGENT_BANC.id, COLLEGUES_BANC[0].id, COLLEGUES_BANC[1].id]
/** Un bien sur cinq en co-mandat avec une agence partenaire ; les autres sont en propre. */
const PARTENAIRES_BANC = ['naef', null, 'cardis', null, null, 'bernard', null, null, null, null] as const

const BIENS_CATALOGUE = Array.from({ length: 48 }, (_, i) => {
  const [ville, canton, npa, rue, venteM2, loyerM2] = LIEUX[(i * 5) % LIEUX.length]
  const g = GABARITS[i % GABARITS.length]
  // Une location sur trois — jamais une villa de maître ni un chalet.
  const location = i % 3 === 1 && g.type !== 'villa' && g.surface < 300
  const surface = g.surface + ((i * 7) % 5) * 4
  const statut = i % 23 === 7 || i % 23 === 18 ? 'paused'
    : i === 41 || i === 45 ? 'sold'
      : i % 9 === 4 ? 'reserved'
        : i % 10 === 8 ? 'draft'
          : 'active'
  // Trois brouillons sans photo — l'état « Photos à ajouter » de la carte.
  const sansPhoto = statut === 'draft' && i % 20 === 8
  const jours = 3 + ((i * 11) % 320)
  // Un mandat sur sept expire dans les 60 jours : c'est ce que « À suivre » relève.
  const echeanceJours = i % 7 === 3 ? 10 + ((i * 3) % 50) : 90 + ((i * 13) % 300)
  return {
    id: `pb${i + 3}`, agency_id: AGENCE_BANC.id,
    created_by: AGENTS_BANC[(i * 7) % AGENTS_BANC.length], partner_agency: PARTENAIRES_BANC[i % PARTENAIRES_BANC.length],
    title: `${g.libelle(g.pieces)} · ${ville}`, type: g.type,
    address: `${rue} ${2 + ((i * 7) % 40)}`, postal_code: npa, city: ville, canton,
    price: location
      ? Math.round((surface * loyerM2) / 50) * 50
      : Math.round((surface * venteM2) / 10_000) * 10_000,
    charges_monthly: location ? Math.round(surface * 3.5 / 10) * 10 : null,
    rooms: g.pieces || null, bedrooms: g.pieces ? Math.max(0, Math.floor(g.pieces) - 1) : null,
    bathrooms: g.pieces ? 1 + (g.pieces >= 5 ? 1 : 0) : null, surface_m2: surface,
    year_built: 1905 + ((i * 17) % 118), energy_class: 'ABCDEFG'[(i * 3) % 7],
    mandate_type: i % 4 === 0 ? 'exclusive' : 'simple', mandate_commission_pct: location ? null : 2 + ((i % 3) * 0.5),
    mandate_signed_at: statut === 'draft' ? null : ilYA(24 * (jours + 10)),
    mandate_expires_at: statut === 'draft' ? null : ilYA(-24 * echeanceJours),
    views_count: statut === 'draft' ? 0 : (i * 37) % 620, favorites_count: statut === 'draft' ? 0 : (i * 7) % 41,
    status: statut, transaction_type: location ? 'rent' : 'sale',
    published_at: statut === 'draft' ? null : ilYA(24 * jours), created_at: ilYA(24 * jours + 5),
    photos: sansPhoto ? [] : [unsplash(g.photos[(i * 3) % g.photos.length])], photos_cf: null,
  }
})

/**
 * Les jointures `property` des matchs — le banc n'applique pas `select`, la ligne les porte. Leur `status` est celui de
 * la table : « Sa boucle » le lit, et un mandat qui ne l'aurait pas n'y serait plus en vente (lot E1).
 */
const CHAMPEL_EMBARQUE = {
  title: 'Appartement 4,5 pièces · Champel', price: 1_450_000, address: 'Avenue de Champel 12',
  city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 4.5, bedrooms: 3, surface_m2: 118,
  photos: [PHOTO.champel], type: 'apartment', description: 'Lumineux, traversant, deux balcons.',
  features: ['Balcon', 'Ascenseur'], floor: 4, year_built: 1968, charges_monthly: 420, status: 'active',
}
const COLOGNY_EMBARQUE = {
  title: 'Villa individuelle · Cologny', price: 3_200_000, address: 'Chemin de Ruth 8',
  city: 'Cologny', canton: 'GE', postal_code: '1223', rooms: 7, bedrooms: 5, surface_m2: 260,
  photos: [PHOTO.cologny], type: 'house', description: 'Villa contemporaine avec piscine, jardin arboré de 1 200 m² et vue sur le lac.',
  features: ['Piscine', 'Jardin', 'Garage double', 'Vue lac'], floor: null, year_built: 2011, charges_monthly: null, status: 'active',
}

/**
 * Annonces du MARCHÉ pour le fil de matchs (lot 2, 17.09.2026) — des ventes à Genève que les recherches
 * de Julie (c9) et d'Emma (c7) retiennent. ml-fil-3 garde volontairement deux écarts pour Julie
 * (surface, équipements) : la sélection doit montrer un bien NON coché d'office.
 */
const annonceFil = (id: string, titre: string, rue: string, npa: string, prix: number, pieces: number, surface: number, equipements: string[], photo: string, sourceId: string) => ({
  id, title: titre, address: rue, city: 'Genève', postal_code: npa, canton: 'GE',
  type: 'apartment', transaction_type: 'buy', price: prix, current_price: prix, price_at_first_seen: prix, price_per_m2: null,
  rooms: pieces, bedrooms: Math.max(1, Math.floor(pieces) - 1), bathrooms: pieces >= 5 ? 2 : 1, surface_m2: surface,
  features: equipements, photos: [unsplash(photo)], photos_cf: null, status: 'active',
  source_portal: 'realadvisor', source_url: `https://realadvisor.ch/fr/demo/${sourceId}`, source_id: sourceId,
  agency_name: 'Régie de démonstration', agency_phone: null, agency_logo_url: null, lat: null, lng: null,
  year_built: 1998, days_on_market: 9, land_surface: null, description: null, floor: 3, parking_count: null,
  year_renovated: null, usable_surface: null, charges_monthly: 450, is_furnished: false, availability_date: null,
  visit_contact_name: null, agency_reference: null,
})
const ANNONCES_FIL = [
  annonceFil('ml-fil-1', 'Appartement 5 pièces · Florissant', 'Route de Florissant 62', '1206', 1_520_000, 5, 124, ['Balcon', 'Ascenseur'], PHOTOS_APPART[0]!, '51842'),
  annonceFil('ml-fil-2', 'Attique 4,5 pièces · Eaux-Vives', 'Rue du Lac 14', '1207', 1_590_000, 4.5, 132, ['Terrasse', 'Ascenseur', 'Balcon'], PHOTOS_APPART[1]!, '51907'),
  annonceFil('ml-fil-3', 'Appartement 4 pièces · Plainpalais', 'Rue de Carouge 40', '1205', 1_180_000, 4, 96, ['Ascenseur'], PHOTOS_APPART[2]!, '52013'),
  annonceFil('ml-fil-4', 'Appartement 6 pièces · Champel', 'Avenue Miremont 30', '1206', 2_450_000, 6, 175, ['Ascenseur', 'Balcon', 'Cave'], PHOTOS_APPART[3]!, '52101'),
]

/**
 * La BOUCLE du fil (lot B, 21.09.2026) — huit ventes du marché, notées par le vrai moteur À LEUR PREMIER PRIX
 * (`banc-matching-boucle.spec.ts` les confronte à `calculateScoreV2` ; il ne renote pas une paire existante). Julie (c9) en a refusé deux pour le
 * PRIX (ml-boucle-1 et -2 : « Apprendre » propose d'abaisser son budget à 1'550'000) ; elle n'a pas encore
 * répondu sur ml-boucle-3, qui a baissé depuis qu'on le lui a proposé ; ml-boucle-4 est la seule de ses
 * suggestions que la correction écarte (57 → 49). Emma (c7) est intéressée par ml-boucle-5, n'a répondu ni sur
 * ml-boucle-6 ni sur ml-boucle-8 (proposés ensemble : « Retours de … » à deux biens), et ml-boucle-7, qu'elle
 * a refusé pour le prix, est revenu par une baisse.
 *
 * ⚠ Mêmes colonnes que `annonceFil`, plus l'historique du prix : `price_at_first_seen` au-dessus du prix
 * courant ⇒ baisse datée, et `price_reduced`, comme le pose `trg_ra_price_status` sur une vente RealAdvisor.
 */
const annonceBoucle = (
  id: string, titre: string, lieu: { rue: string; npa: string; ville: string; canton: string },
  prix: { actuel: number; premier: number }, pieces: number, surface: number, equipements: string[], photo: string, sourceId: string,
) => ({
  ...annonceFil(id, titre, lieu.rue, lieu.npa, prix.actuel, pieces, surface, equipements, photo, sourceId),
  city: lieu.ville, canton: lieu.canton, price_at_first_seen: prix.premier, first_seen_at: ilYA(24 * 14), removed_at: null,
  status: prix.premier > prix.actuel ? 'price_reduced' : 'active',
  price_reduced_at: prix.premier > prix.actuel ? ilYA(24 * 2) : null,
})
const GENEVE = (rue: string, npa: string) => ({ rue, npa, ville: 'Genève', canton: 'GE' })
const ZURICH = (rue: string, npa: string) => ({ rue, npa, ville: 'Zürich', canton: 'ZH' })
const ANNONCES_BOUCLE = [
  annonceBoucle('ml-boucle-1', 'Attique 4,5 pièces · Malagnou', GENEVE('Route de Malagnou 28', '1208'), { actuel: 1_580_000, premier: 1_580_000 }, 4.5, 112, ['Balcon', 'Ascenseur', 'Terrasse'], PHOTOS_APPART[4]!, '52210'),
  annonceBoucle('ml-boucle-2', 'Appartement 5 pièces · Servette', GENEVE('Rue de la Servette 45', '1202'), { actuel: 1_560_000, premier: 1_560_000 }, 5, 118, ['Balcon', 'Ascenseur'], PHOTOS_APPART[5]!, '52211'),
  annonceBoucle('ml-boucle-3', 'Appartement 4 pièces · Champel', GENEVE('Chemin des Crêts-de-Champel 9', '1206'), { actuel: 1_440_000, premier: 1_490_000 }, 4, 104, ['Balcon', 'Ascenseur'], PHOTOS_APPART[6]!, '52212'),
  annonceBoucle('ml-boucle-4', 'Appartement 3,5 pièces · Onex', { rue: 'Avenue du Bois-de-la-Chapelle 15', npa: '1213', ville: 'Onex', canton: 'GE' }, { actuel: 1_750_000, premier: 1_750_000 }, 3.5, 92, ['Ascenseur'], PHOTOS_APPART[7]!, '52213'),
  annonceBoucle('ml-boucle-5', 'Appartement 5,5 pièces · Enge', ZURICH('Seestrasse 120', '8002'), { actuel: 2_200_000, premier: 2_200_000 }, 5.5, 146, ['Balcon', 'Ascenseur'], PHOTOS_APPART[8]!, '52214'),
  annonceBoucle('ml-boucle-6', 'Attique 4,5 pièces · Oerlikon', ZURICH('Schaffhauserstrasse 340', '8050'), { actuel: 2_650_000, premier: 2_650_000 }, 4.5, 128, ['Terrasse', 'Ascenseur'], PHOTOS_APPART[9]!, '52215'),
  annonceBoucle('ml-boucle-7', 'Appartement 4,5 pièces · Seefeld', ZURICH('Seefeldstrasse 88', '8008'), { actuel: 2_480_000, premier: 2_590_000 }, 4.5, 121, ['Balcon', 'Ascenseur'], PHOTOS_APPART[10]!, '52216'),
  annonceBoucle('ml-boucle-8', 'Appartement 4,5 pièces · Wollishofen', ZURICH('Albisstrasse 60', '8038'), { actuel: 1_980_000, premier: 1_980_000 }, 4.5, 118, ['Balcon', 'Cave'], PHOTOS_APPART[11]!, '52217'),
]
/**
 * Lot C (22.09.2026) — deux ventes du marché pour Anastasia, chacune avec son signal « pourquoi maintenant » :
 * ml-signal-1 vue il y a un jour (« Nouveau sur le marché », construite l'an dernier : neuve), ml-signal-2 baissée
 * il y a cinq jours de CHF 250'000 (rénovée il y a trois ans ; ses chambres ne sont pas renseignées : « non
 * évalué »). L'année suit l'horloge, comme le moteur (`maintenant`).
 */
const ANNEE_BANC = new Date().getUTCFullYear()
const ANNONCES_SIGNAL = [
  {
    ...annonceFil('ml-signal-1', 'Appartement 6 pièces · Malagnou', 'Route de Malagnou 40', '1208', 2_480_000, 6, 172, ['Terrasse', 'Ascenseur'], PHOTOS_APPART[12]!, '52301'),
    year_built: ANNEE_BANC - 1, first_seen_at: ilYA(24), price_reduced_at: null, removed_at: null,
  },
  {
    ...annonceFil('ml-signal-2', 'Attique 5 pièces · Eaux-Vives', 'Quai Gustave-Ador 30', '1207', 2_450_000, 5, 150, ['Terrasse', 'Vue lac', 'Ascenseur'], PHOTOS_APPART[13]!, '52302'),
    price_at_first_seen: 2_700_000, status: 'price_reduced', price_reduced_at: ilYA(24 * 5), first_seen_at: ilYA(24 * 40),
    bedrooms: null, year_built: 1965, year_renovated: ANNEE_BANC - 3, removed_at: null,
  },
]
/** Les jointures `contact` et `property` des matchs du lot C — le banc n'applique pas `select`. */
const ANASTASIA_EMBARQUEE = { first_name: 'Anastasia', last_name: 'Volkova', email: 'a.volkova@example.ch', phone: '+41 79 214 60 88' }
const FLORISSANT_EMBARQUE = {
  title: 'Attique 5,5 pièces · Florissant', price: 2_350_000, address: 'Route de Florissant 58',
  city: 'Genève', canton: 'GE', postal_code: '1206', rooms: 5.5, bedrooms: 4, surface_m2: 168,
  photos: [unsplash(PHOTOS_APPART[9]!)], type: 'apartment', description: 'Attique traversant, terrasse de 60 m² et vue sur le lac.',
  features: ['Terrasse', 'Ascenseur', 'Vue lac'], floor: 7, year_built: 1972, charges_monthly: 690, status: 'active',
}
/** Les jointures `contact` des matchs de la boucle — le banc n'applique pas `select`, la ligne les porte. */
const JULIE_EMBARQUEE = { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' }
const EMMA_EMBARQUEE = { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' }
/** Emma (c7) sur un bien de Zürich : ni pièces ni équipements dans sa recherche, le moteur reporte leur poids. */
const RAISONS_EMMA_ZURICH = {
  budget: { match: true, score: 47, detail: 'Dans le budget' },
  zone: { match: true, score: 35, detail: 'Zürich correspond' },
  type: { match: true, score: 18, detail: 'apartment' },
  rooms: { match: false, score: 0, detail: 'Aucun critère' },
  features: { match: false, score: 0, detail: '—' },
}

export const CRM_TABLES: Record<string, unknown[]> = {
  market_listings: [ANNONCE_MARCHE_BANC, ...ANNONCES_CLOCHE, ...ANNONCES_FIL, ...ANNONCES_BOUCLE, ...ANNONCES_SIGNAL],
  market_price_history: HISTORIQUE_PRIX_BANC,
  credit_ledger: [],
  credit_wallets: [],
  profiles: [AGENT_BANC, ...COLLEGUES_BANC],
  agencies: [AGENCE_BANC],
  contacts: CONTACTS,
  activity_events: [...EVENEMENTS, ...TRAINE_JOURNAL],
  relance_sessions: [],
  relance_items: [],
  // ⚠ `trigger_at`, la SEULE date d'un rappel : le Calendrier, l'agenda d'« Aujourd'hui »
  // et l'agenda mobile la lisent tous (`useCalendarScreen`). Ces fixtures portaient un
  // `due_at` — colonne qui n'existe pas dans `reminders` —, si bien que les trois
  // écrans du banc ne voyaient AUCUN rappel. Depuis le 13.09.2026, « Aujourd'hui »
  // montre donc r1 (+3 h) dans sa journée, et le Calendrier les deux.
  // ⚠ `contact` : la jointure `contact:contacts(first_name, last_name)` que lit `useReminders` — le banc
  // n'applique pas `select`, la ligne la porte. Sans elle, « Dossiers » nommait chacun de ces rappels
  // « Contact » (son repli) : une limite du banc, antérieure au lot D1, relevée en le rejouant.
  reminders: [
    { id: 'r1', agency_id: AGENCE_BANC.id, user_id: AGENT_BANC.id, contact_id: 'c1', title: 'Rappeler pour le dossier Champel', trigger_at: ilYA(-3), status: 'pending', kind: 'call', type: 'custom', message_template: null, calendar_label_id: 'cl2', created_at: ilYA(48), contact: { first_name: 'Camille', last_name: 'Rochat' } },
    { id: 'r2', agency_id: AGENCE_BANC.id, user_id: AGENT_BANC.id, contact_id: 'c3', title: 'Envoyer le comparatif de quartier', trigger_at: ilYA(-27), status: 'pending', kind: 'email', type: 'custom', message_template: null, calendar_label_id: null, created_at: ilYA(52), contact: { first_name: 'Salomé', last_name: 'Perret' } },
    // La boucle du fil (lot B) : UNE relance par proposition, qui couvre TOUS ses biens (`match_ids`). rb1
    // reste ouverte — Julie a refusé m14 mais pas encore répondu sur m15 (`fermer_relance_proposition`) ;
    // rb2, échue, couvre les deux biens proposés ensemble à Emma. Colonnes réelles de `reminders`, telles que `poserRelance` les pose.
    { id: 'rb1', agency_id: AGENCE_BANC.id, contact_id: 'c9', property_id: null, transaction_id: null, match_id: 'm14', match_ids: ['m14', 'm15'], type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3, trigger_at: ilYA(-24), status: 'pending', channel: 'task', kind: null, completed_at: null, draft_message: null, calendar_label_id: null, message_template: 'Retour de Julie Morand sur 2 biens proposés', created_at: ilYA(48), contact: { first_name: 'Julie', last_name: 'Morand' } },
    { id: 'rb2', agency_id: AGENCE_BANC.id, contact_id: 'c7', property_id: null, transaction_id: null, match_id: 'm18', match_ids: ['m18', 'm21'], type: 'follow_up_sent_property', trigger_rule: 'manual', trigger_days: 3, trigger_at: ilYA(24), status: 'pending', channel: 'task', kind: null, completed_at: null, draft_message: null, calendar_label_id: null, message_template: 'Retour de Emma Schneider sur 2 biens proposés', created_at: ilYA(96), contact: { first_name: 'Emma', last_name: 'Schneider' } },
  ],
  // ⚠ Les jointures sont portées par la ligne (le banc n'applique pas `select`) : sans
  // elles, la fiche visite du banc titrait « Bien » sans visiteur et un bon de visite
  // vide — un écran que la production ne rend jamais.
  visits: [
    {
      id: 'v1', agency_id: AGENCE_BANC.id, contact_id: 'c1', property_id: 'p1', agent_id: AGENT_BANC.id,
      scheduled_at: ilYA(-5), duration_minutes: 45, status: 'confirmed', calendar_label_id: 'cl1', created_at: ilYA(40),
      property: { id: 'p1', title: 'Appartement 4,5 pièces · Champel', address: 'Avenue de Champel 12', city: 'Genève', canton: 'GE', photos: [], type: 'apartment', surface_m2: 118, rooms: 4.5, price: 1_450_000 },
      contact: { id: 'c1', first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      agent: { id: AGENT_BANC.id, full_name: AGENT_BANC.full_name, avatar_url: null },
    },
  ],
  // Un ÉVÉNEMENT du calendrier (`calendar_events`, 20260915080300) : ni visite ni relance,
  // gardé tel qu'on l'a saisi — titre, fin, type. Jointures portées par la ligne, comme
  // les visites (le banc n'applique pas `select`).
  calendar_events: [
    {
      id: 'ce1', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, type: 'notary', title: 'Signature chez le notaire · Champel',
      starts_at: ilYA(-26), ends_at: ilYA(-27), all_day: false, location: 'Étude Exemple, Genève', notes: null, color: null,
      recurrence: null, status: null, contact_id: 'c1', property_id: 'p1', mail_thread_id: null, calendar_label_id: null,
      created_at: ilYA(30), updated_at: ilYA(30),
      contact: { first_name: 'Camille', last_name: 'Rochat' },
      property: { id: 'p1', title: 'Appartement 4,5 pièces · Champel', address: 'Avenue de Champel 12', city: 'Genève', price: 1_450_000, surface_m2: 118 },
    },
  ],
  // Libellés du Calendrier — des barreaux de la direction, pas des littéraux : la
  // couleur d'un libellé est une donnée saisie, et une fixture qui écrirait des
  // hexadécimaux ferait monter l'inventaire de couleurs du dossier `pages/dev`.
  calendar_labels: [
    { id: 'cl1', agency_id: AGENCE_BANC.id, name: 'Urgent', color: MXC_SYSTEM.red400, position: 0, created_at: ilYA(300), updated_at: ilYA(300) },
    { id: 'cl2', agency_id: AGENCE_BANC.id, name: 'Client VIP', color: MXC_SYSTEM.yellow400, position: 1, created_at: ilYA(290), updated_at: ilYA(290) },
    { id: 'cl3', agency_id: AGENCE_BANC.id, name: 'Personnel', color: MXC_COLOR.accent, position: 2, created_at: ilYA(280), updated_at: ilYA(280) },
  ],
  properties: [
    // ⚠ Colonnes RÉELLES de `properties` (`surface_m2`, `energy_class`, `mandate_*`…) :
    // `propertyToCrmBien` tourne pour de vrai dessus. Avec un `surface` inventé, la
    // fiche « Bien » du banc rendait « — » dans sept caractéristiques sur huit.
    // p2 a un mandat qui expire dans 20 jours : il peuple « Mandats à renouveler ».
    {
      id: 'p1', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, partner_agency: null, title: 'Appartement 4,5 pièces · Champel', type: 'apartment',
      address: 'Avenue de Champel 12', postal_code: '1206', city: 'Genève', canton: 'GE',
      price: 1_450_000, charges_monthly: 420, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 118,
      year_built: 1968, energy_class: 'C', floor: 4,
      description: 'Lumineux, traversant, deux balcons. Cuisine refaite en 2022, cave et place de parc.',
      features: ['Balcon', 'Ascenseur', 'Cave', 'Parking'],
      mandate_type: 'exclusive', mandate_commission_pct: 3, mandate_signed_at: ilYA(24 * 120), mandate_expires_at: ilYA(-24 * 180),
      views_count: 214, favorites_count: 12,
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 120), condition: 'good', off_market: false, created_at: ilYA(400), photos: [PHOTO.champel], photos_cf: null,
    },
    {
      id: 'p2', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, partner_agency: null, title: 'Villa individuelle · Cologny', type: 'house',
      address: 'Chemin de Ruth 8', postal_code: '1223', city: 'Cologny', canton: 'GE',
      price: 3_200_000, charges_monthly: null, rooms: 7, bedrooms: 5, bathrooms: 3, surface_m2: 260,
      year_built: 2011, energy_class: 'B', floor: null,
      description: 'Villa contemporaine avec piscine, jardin arboré de 1 200 m² et vue sur le lac.',
      features: ['Piscine', 'Jardin', 'Garage double', 'Vue lac'],
      mandate_type: 'simple', mandate_commission_pct: 2.5, mandate_signed_at: ilYA(24 * 340), mandate_expires_at: ilYA(-24 * 20),
      views_count: 486, favorites_count: 31,
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 300), off_market: false, created_at: ilYA(700), photos: [PHOTO.cologny], photos_cf: null,
    },
    // Lot C (22.09.2026) : un mandat NEUF et OFF-MARKET — « Nouveau mandat » en tête de « Vos biens », et
    // « Qui pour ce bien ? » sur son en-tête, avec deux anciens prospects.
    {
      id: 'p3', agency_id: AGENCE_BANC.id, created_by: AGENT_BANC.id, partner_agency: null, title: 'Attique 5,5 pièces · Florissant', type: 'apartment',
      address: 'Route de Florissant 58', postal_code: '1206', city: 'Genève', canton: 'GE',
      price: 2_350_000, charges_monthly: 690, rooms: 5.5, bedrooms: 4, bathrooms: 2, surface_m2: 168,
      year_built: 1972, energy_class: 'C', floor: 7, condition: 'renovated', off_market: true,
      description: 'Attique traversant, terrasse de 60 m² et vue sur le lac. Entièrement rénové.',
      features: ['Terrasse', 'Ascenseur', 'Vue lac'],
      mandate_type: 'exclusive', mandate_commission_pct: 3, mandate_signed_at: ilYA(24 * 3), mandate_expires_at: ilYA(-24 * 180),
      views_count: 0, favorites_count: 0,
      status: 'active', transaction_type: 'sale', published_at: ilYA(24 * 2), created_at: ilYA(24 * 3),
      photos: [unsplash(PHOTOS_APPART[9]!)], photos_cf: null,
    },
    ...BIENS_CATALOGUE,
  ],
  // Les recherches que le moteur a notées (`matches.client_search_id`) — ce que le fil de matchs
  // compare au bien. Recopiées de la fiche : en production, la fiche est souvent vide et la
  // recherche pleine ; le banc, lui, garde les deux égales pour ne tromper aucune des deux surfaces.
  client_searches: [
    ...['c1', 'c7', 'c9', 'c10', 'c11'].map((id) => ({
      id: `cs${id.slice(1)}`, agency_id: AGENCE_BANC.id, contact_id: id, label: null, is_active: true,
      criteria: CONTACTS.find((c) => c.id === id)?.search_criteria ?? null,
      last_matched_at: null, created_at: ilYA(300), updated_at: ilYA(300),
    })),
    // Deux recherches CLOSES (lot C) : `updated_at` date leur clôture (le pont la pose). Philippe : il y a 120 jours ;
    // Nathalie : il y a 20 jours, mais un deal perdu il y a 150 jours en fait une ancienne prospecte.
    {
      id: 'cs12', agency_id: AGENCE_BANC.id, contact_id: 'c12', label: null, is_active: false, last_matched_at: null,
      criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_max: 2_500_000, rooms_min: 5, features: ['terrasse'] },
      created_at: ilYA(24 * 400), updated_at: ilYA(24 * 120),
    },
    {
      id: 'cs13', agency_id: AGENCE_BANC.id, contact_id: 'c13', label: null, is_active: false, last_matched_at: null,
      criteria: { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_min: 1_800_000, budget_max: 2_400_000, rooms_min: 5, surface_min: 180 },
      created_at: ilYA(24 * 500), updated_at: ilYA(24 * 20),
    },
  ],
  transactions: [],
  // Deux matchs pour la page « Catalogue » d'Aujourd'hui, et chacun éprouve un défaut
  // corrigé le 13.09.2026 : l'annonce de marché n'a AUCUNE photo (elle recevait celle
  // de Champel, et cinq intérieurs de stock dans sa galerie), le bien de l'agence n'en
  // a qu'UNE (le collage de la fiche la répétait trois fois).
  // ⚠ Les jointures (`contact`, `market_listing`, `property`) sont portées par la
  // ligne : le banc n'applique pas `select`.
  // ── Le fil de matchs (lot 1, 17.09.2026) : m2 à m6 sont des paires que le moteur PEUT créer —
  // cinq axes, points jamais négatifs, rien sous 55 (`matching-normalize.ts`). ⛔ m2 portait Salomé,
  // qui cherche une MAISON, sur l'appartement de Champel, type « tenu », à 81 : une paire sous le
  // seuil, et une ligne « Type : Maison / Appartement ✓ » à l'écran. m4 est reporté (la section des
  // reportés) ; m6 donne à Emma un historique (« 1 bien proposé · 1 intéressé »). Leurs `detail`
  // reprennent le libellé exact du moteur, et `client_search_id` désigne la recherche notée.
  // m1 est PROPOSÉ (17.09.2026) ; « suggested » contredisait la fiche de Camille. `sent_via: 'reception'` est
  // une valeur historique, gardée : le CRM n'envoie plus rien à l'acheteur depuis le 21.09.2026.
  matches: [
    {
      id: 'm1', agency_id: AGENCE_BANC.id, contact_id: 'c1', source: 'market',
      property_id: null, market_listing_id: ANNONCE_MARCHE_BANC.id,
      score: 88, status: 'sent', sent_via: 'reception', sent_at: ilYA(50), created_at: ilYA(20),
      reasons: {
        budget: { match: true, score: 30, detail: 'Loyer dans le budget' },
        zone: { match: true, score: 25, detail: 'Secteur recherché' },
        type: { match: true, score: 15, detail: '' },
        rooms: { match: false, score: 0, detail: '' },
        features: { match: false, score: 0, detail: '' },
      },
      contact: { first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      market_listing: ANNONCE_MARCHE_BANC, property: null,
    },
    {
      id: 'm2', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(30),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      id: 'm3', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 97, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(20),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      id: 'm4', agency_id: AGENCE_BANC.id, client_search_id: 'cs1', contact_id: 'c1', source: 'internal',
      property_id: 'p1', market_listing_id: null,
      score: 68, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: ilYA(-24 * 5), created_at: ilYA(26),
      reasons: {
        budget: { match: false, score: 0, detail: '16% au-dessus du budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 10, detail: '2/2 critères' },
      },
      contact: { first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      property: CHAMPEL_EMBARQUE, market_listing: null,
    },
    {
      // Refusé par Antoine pour le PRIX à 3'450'000, revenu à proposer quand le mandat est passé à 3'200'000
      // (lot B, `match_retour_prix_mandat`) : « Refusé par Antoine à CHF 3'450'000 · baissé de CHF 250'000 depuis ».
      id: 'm5', agency_id: AGENCE_BANC.id, client_search_id: 'cs10', contact_id: 'c10', source: 'internal',
      property_id: 'p2', market_listing_id: null,
      score: 97, status: 'suggested', sent_via: 'agent', sent_at: ilYA(24 * 20), snoozed_until: null, created_at: ilYA(24 * 25),
      response_at: ilYA(24 * 18), reaction_motif: 'prix', reaction_note: null, prix_propose: 3_450_000,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Cologny correspond' },
        type: { match: true, score: 12, detail: 'house' },
        rooms: { match: true, score: 22, detail: '7 pièces · 260 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: { first_name: 'Antoine', last_name: 'Lefèvre', email: 'a.lefevre@example.ch', phone: null },
      property: COLOGNY_EMBARQUE, market_listing: null,
    },
    {
      // `pb32` : « Loft 2,5 pièces · Genève », CHF 1'290'000, du catalogue de « Mes biens ».
      id: 'm6', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'pb32', market_listing_id: null,
      score: 100, status: 'interested', sent_via: 'reception', sent_at: ilYA(24 * 6), snoozed_until: null, created_at: ilYA(24 * 6 + 2),
      response_at: ilYA(24 * 5),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      property: { title: 'Loft 2,5 pièces · Genève', price: 1_290_000, city: 'Genève', canton: 'GE', rooms: 2.5, surface_m2: 86, photos: [], type: 'apartment', status: 'active' },
      market_listing: null,
    },
    // ── Le marché du fil (lot 2, 17.09.2026) : m8 à m13, des paires acheteur × annonce ANNONCES_FIL
    // notées par le vrai moteur (`calculateScoreV2`, script jetable). Toutes ≥ 55 : aucune écartée.
    {
      id: 'm8', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-1',
      score: 97, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(8),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '5 pièces · 124 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      market_listing: ANNONCES_FIL[0], property: null,
    },
    {
      id: 'm9', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-2',
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(10),
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 132 m²' },
        features: { match: true, score: 10, detail: '3/3 critères' },
      },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      market_listing: ANNONCES_FIL[1], property: null,
    },
    {
      id: 'm10', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-3',
      score: 90, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(12),
      reasons: {
        budget: { match: true, score: 31, detail: 'Sous le budget minimum' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 20, detail: '4 pièces · 96 m²' },
        features: { match: false, score: 3, detail: '1/3 critères' },
      },
      contact: { first_name: 'Julie', last_name: 'Morand', email: 'julie.morand@example.ch', phone: '+41 79 530 18 64' },
      market_listing: ANNONCES_FIL[2], property: null,
    },
    {
      id: 'm11', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-1',
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(14),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      market_listing: ANNONCES_FIL[0], property: null,
    },
    {
      id: 'm12', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-2',
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(16),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      market_listing: ANNONCES_FIL[1], property: null,
    },
    {
      id: 'm13', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-fil-4',
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(18),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: { first_name: 'Emma', last_name: 'Schneider', email: 'emma.schneider@example.com', phone: '+41 76 488 02 19' },
      market_listing: ANNONCES_FIL[3], property: null,
    },
    // ── La boucle du fil (lot B, 21.09.2026) : m14 à m21, sur ANNONCES_BOUCLE, notés par le vrai moteur
    // (`banc-matching-boucle.spec.ts`). ⚠ Le banc ne joue AUCUN trigger : ce que la base poserait seule y est
    // écrit tel qu'elle le laisserait — `prix_propose` au passage à `sent`, `response_at` à la réponse, le
    // retour à `suggested` d'un refus « prix » quand le prix baisse (m20, et m5 plus haut).
    {
      id: 'm14', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-2',
      score: 97, status: 'rejected', sent_via: 'agent', sent_at: ilYA(48), snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: ilYA(24), reaction_motif: 'prix', reaction_note: null, prix_propose: 1_560_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '5 pièces · 118 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[1], property: null,
    },
    {
      id: 'm15', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-3',
      score: 97, status: 'sent', sent_via: 'agent', sent_at: ilYA(48), snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 1_490_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4 pièces · 104 m²' },
        features: { match: true, score: 7, detail: '2/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[2], property: null,
    },
    {
      id: 'm16', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-1',
      score: 100, status: 'rejected', sent_via: 'agent', sent_at: ilYA(24 * 9), snoozed_until: null, created_at: ilYA(24 * 10),
      response_at: ilYA(24 * 8), reaction_motif: 'prix', reaction_note: 'Au-dessus de ce que sa banque suit.', prix_propose: 1_580_000, apprentissage_at: null,
      reasons: {
        budget: { match: true, score: 32, detail: 'Dans le budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 112 m²' },
        features: { match: true, score: 10, detail: '3/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[0], property: null,
    },
    {
      id: 'm17', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-5',
      score: 100, status: 'interested', sent_via: 'agent', sent_at: ilYA(24 * 5), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: ilYA(24 * 3), reaction_motif: null, reaction_note: null, prix_propose: 2_200_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[4], property: null,
    },
    {
      id: 'm18', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-6',
      score: 100, status: 'sent', sent_via: 'agent', sent_at: ilYA(24 * 4), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 2_650_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[5], property: null,
    },
    {
      id: 'm19', agency_id: AGENCE_BANC.id, client_search_id: 'cs9', contact_id: 'c9', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-4',
      score: 57, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(24 * 4),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: null, apprentissage_at: null,
      reasons: {
        budget: { match: false, score: 12, detail: '9% au-dessus du budget' },
        zone: { match: true, score: 14, detail: 'Canton GE correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 15, detail: '3,5 pièces · 92 m²' },
        features: { match: false, score: 3, detail: '1/3 critères' },
      },
      contact: JULIE_EMBARQUEE, market_listing: ANNONCES_BOUCLE[3], property: null,
    },
    {
      id: 'm20', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-7',
      score: 100, status: 'suggested', sent_via: 'agent', sent_at: ilYA(24 * 12), snoozed_until: null, created_at: ilYA(24 * 14),
      response_at: ilYA(24 * 10), reaction_motif: 'prix', reaction_note: 'Attend une baisse.', prix_propose: 2_590_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[6], property: null,
    },
    {
      id: 'm21', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'market',
      property_id: null, market_listing_id: 'ml-boucle-8',
      score: 100, status: 'sent', sent_via: 'agent', sent_at: ilYA(24 * 4), snoozed_until: null, created_at: ilYA(24 * 7),
      response_at: null, reaction_motif: null, reaction_note: null, prix_propose: 1_980_000, apprentissage_at: null,
      reasons: RAISONS_EMMA_ZURICH, contact: EMMA_EMBARQUEE, market_listing: ANNONCES_BOUCLE[7], property: null,
    },
    // ── Lot C (22.09.2026) : Florissant, off-market, et les deux annonces à signal d'Anastasia. ──
    {
      id: 'm22', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'internal',
      property_id: 'p3', market_listing_id: null, score_version: 4,
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(40),
      reasons: {
        budget: { match: true, score: 27, detail: 'Dans le budget' },
        zone: { match: true, score: 20, detail: 'Genève correspond' },
        type: { match: true, score: 10, detail: 'apartment' },
        rooms: { match: true, score: 10, detail: '5,5 pièces' },
        features: { match: true, score: 8, detail: '2/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: FLORISSANT_EMBARQUE, market_listing: null,
    },
    {
      id: 'm23', agency_id: AGENCE_BANC.id, client_search_id: 'cs7', contact_id: 'c7', source: 'internal',
      property_id: 'p3', market_listing_id: null, score_version: 4,
      score: 100, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(40),
      reasons: {
        budget: { match: true, score: 47, detail: 'Dans le budget' },
        zone: { match: true, score: 35, detail: 'Genève correspond' },
        type: { match: true, score: 18, detail: 'apartment' },
        rooms: { match: false, score: 0, detail: 'Aucun critère' },
        features: { match: false, score: 0, detail: '—' },
      },
      contact: EMMA_EMBARQUEE, property: FLORISSANT_EMBARQUE, market_listing: null,
    },
    {
      id: 'm24', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'market',
      property_id: null, market_listing_id: 'ml-signal-1', score_version: 4,
      score: 87, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(20),
      reasons: {
        budget: { match: true, score: 27, detail: 'Dans le budget' },
        zone: { match: true, score: 20, detail: 'Genève correspond' },
        type: { match: true, score: 10, detail: 'apartment' },
        rooms: { match: true, score: 10, detail: '6 pièces' },
        features: { match: true, score: 4, detail: '1/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[0],
    },
    {
      id: 'm25', agency_id: AGENCE_BANC.id, client_search_id: 'cs11', contact_id: 'c11', source: 'market',
      property_id: null, market_listing_id: 'ml-signal-2', score_version: 4,
      score: 95, status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: ilYA(24 * 2),
      reasons: {
        budget: { match: true, score: 30, detail: 'Dans le budget · Prix baissé de 9%' },
        zone: { match: true, score: 22, detail: 'Genève correspond' },
        type: { match: true, score: 11, detail: 'apartment' },
        rooms: { match: true, score: 11, detail: '5 pièces' },
        features: { match: true, score: 9, detail: '2/2 critères' },
      },
      contact: ANASTASIA_EMBARQUEE, property: null, market_listing: ANNONCES_SIGNAL[1],
    },
  ],
  crm_offers: [],
  seller_leads: [],
  kyc_cases: KYC_CASES,
  kyc_checklist_items: KYC_CHECKS,
  kyc_screening_decisions: KYC_DECISIONS,
  documents: KYC_DOCS,
  property_scores: [],
  appointments: [],
  // ── La fiche contact (16.09.2026) : ses lectures propres. Camille a un consentement
  // WhatsApp déclaré — ce qui donne à la fiche son bloc plein. Les deux autres restent
  // vides À DESSEIN : une suppression ou une invitation en cours changeraient le sens de
  // la fiche. (Son lien de réception est parti avec la page de l'acheteur, 21.09.2026.)
  contact_suppressions: [],
  whatsapp_consents: [
    { id: 'wc1', subject_kind: 'contact', contact_id: 'c1', profile_id: null, agency_id: AGENCE_BANC.id, wa_phone: '41794128803', event: 'opt_in', source: 'agent_manual', legal_basis: 'consent', purpose: 'service', scope: 'all', created_at: ilYA(880) },
  ],
  whatsapp_optin_invites: [],
  // Le fil de notes de Camille : les trois auteurs possibles, dont une note modifiée et une
  // note de l'agent connecté — la seule à porter « Modifier / Supprimer ». L'auteur est
  // EMBARQUÉ (`author`) : le banc n'applique pas le `select` et ne suit aucune clé.
  contact_notes: [
    { id: 'cn3', agency_id: AGENCE_BANC.id, contact_id: 'c1', author_id: AGENT_BANC.id, author_kind: 'user', body: 'Rappelée ce matin : visite confirmée jeudi 10h, elle viendra avec son mari.', created_at: ilYA(3), updated_at: ilYA(2.8), author: { full_name: AGENT_BANC.full_name } },
    { id: 'cn2', agency_id: AGENCE_BANC.id, contact_id: 'c1', author_id: null, author_kind: 'ai', body: 'Financement confirmé par la BCGE, apport de 25 %.', created_at: ilYA(40), updated_at: null, requested_by: AGENT_BANC.id, via: 'whatsapp', author: null },
    { id: 'cn1', agency_id: AGENCE_BANC.id, contact_id: 'c1', author_id: '00000000-0000-4000-8000-0000000000b2', author_kind: 'user', body: 'Cherche un 4,5 pièces lumineux, proche des écoles de Champel.\nPas de rez-de-chaussée.', created_at: ilYA(340), updated_at: null, author: { full_name: 'Sophie Keller' } },
  ],
  // Le lien WhatsApp de l'agent — VÉRIFIÉ : « Gregory » a relié son numéro dans les
  // Intégrations. ⚠ Il traverse l'état « Vide » (`socle`) : c'est le scénario de l'écran
  // vide des Contacts, un agent connecté qui n'a encore aucun contact.
  whatsapp_agent_links: [
    { profile_id: AGENT_BANC.id, verified: true, wa_number: '+41 79 *** ** 42', pairing_code: null, pairing_expires_at: null, pending_number: null, otp_expires_at: null, otp_attempts: 0 },
  ],
}

/**
 * `matching-engine` du banc — le mode `rescore-search` d'« Apprendre » (lot B) ; les autres modes rendent
 * `{ ok: true, banc: true }`, comme toute edge sans fixture.
 *
 * ⛔ LE BANC NE NOTE PAS : `src/` ne charge pas le barème Deno (CLAUDE.md §4). Il connaît les notes du cas de
 * démonstration — la recherche de Julie (cs9), budget maximum abaissé à 1'550'000 par ses deux refus « prix » —,
 * CONFRONTÉES au moteur par `banc-matching-boucle.spec.ts`. Une autre valeur pose la clé et prend les refus en
 * compte sans rien renoter (0 réévalué, et l'écran le dit) : le banc n'invente pas de note.
 *
 * Même contrat que l'edge : la SEULE clé corrigée (`correction: { cle, valeur }`), fusionnée dans les critères
 * d'aujourd'hui. Mêmes écritures, dans le même ordre : les notes (sous le seuil : `ignored`, motif
 * `recherche_ajustee`), puis, comme `matching_ajuster_recherche`, la clé dans la recherche et dans la fiche si
 * elle portait les mêmes critères, les refus pris en compte, une ligne au journal.
 */
type RaisonBanc = { match: boolean; score: number; detail: string }
/** Le seuil du barème (`DEFAULT_SCORING_CONFIG.threshold`, matching-normalize.ts). */
const SEUIL_MOTEUR = 55
/** Les notes du moteur pour la recherche de Julie au budget maximum de 1'550'000 : seul l'axe budget change. */
const NOTES_JULIE_1550: Record<string, { score: number; budget?: RaisonBanc }> = {
  m3: { score: 97 }, m8: { score: 97 }, m10: { score: 90 },
  m9: { score: 94, budget: { match: true, score: 26, detail: '3% au-dessus du budget' } },
  m19: { score: 49, budget: { match: false, score: 4, detail: '13% au-dessus du budget' } },
}

function renoterBanc(a: Record<string, unknown>): Record<string, unknown> {
  const recherche = (CRM_TABLES.client_searches as { id: string; contact_id: string; criteria: unknown }[])
    .find((r) => r.id === a.client_search_id)
  if (!recherche) return { error: 'search_not_found' }
  const brute = a.correction && typeof a.correction === 'object' ? a.correction as { cle?: unknown; valeur?: unknown } : null
  const correction = brute && typeof brute.cle === 'string' ? { cle: brute.cle, valeur: brute.valeur } : null
  const avant = recherche.criteria
  const criteres = correction ? { ...(avant as Record<string, unknown> | null), [correction.cle]: correction.valeur } : null
  const refus = Array.isArray(a.refus_ids) ? a.refus_ids.filter((id): id is string => typeof id === 'string') : []
  const matchs = CRM_TABLES.matches as {
    id: string; status: string; client_search_id?: string | null; score: number
    reasons: Record<string, unknown> | null; reaction_motif?: string | null; apprentissage_at?: string | null
  }[]
  const demonstration = recherche.id === 'cs9' && correction?.cle === 'budget_max' && correction.valeur === 1_550_000
  let reevalues = 0
  let ecartes = 0
  for (const m of matchs) {
    const note = demonstration ? NOTES_JULIE_1550[m.id] : undefined
    if (!note || m.status !== 'suggested' || m.client_search_id !== recherche.id) continue
    reevalues++
    m.score = note.score
    if (note.budget) m.reasons = { ...m.reasons, budget: note.budget }
    if (note.score < SEUIL_MOTEUR) {
      ecartes++
      m.status = 'ignored'
      m.reaction_motif = 'recherche_ajustee'
    }
  }
  if (criteres) {
    recherche.criteria = criteres
    const fiche = (CRM_TABLES.contacts as { id: string; search_criteria: unknown }[]).find((c) => c.id === recherche.contact_id)
    if (fiche && JSON.stringify(fiche.search_criteria) === JSON.stringify(avant)) fiche.search_criteria = criteres
  }
  const maintenant = new Date().toISOString()
  for (const m of matchs) {
    if (refus.includes(m.id) && m.status === 'rejected' && m.client_search_id === recherche.id) m.apprentissage_at = maintenant
  }
  const journal = CRM_TABLES.activity_events as Record<string, unknown>[]
  journal.push({
    id: crypto.randomUUID(), agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user',
    action: criteres ? 'recherche_ajustee' : 'matchs_reevalues', entity_type: 'contact', entity_id: recherche.contact_id,
    category: 'contact', severity: 'info', object_label: null, created_at: maintenant,
    metadata: {
      client_search_id: recherche.id, motif: a.motif ?? null, cle: correction?.cle ?? null, avant, apres: criteres ?? avant,
      refus_ids: refus, reevalues, ecartes,
    },
  })
  return { reevalues, ecartes, mode: 'rescore-search' }
}

/**
 * « Qui pour ce bien ? » (lot C) — les anciens prospects de Florissant, NOTÉS par le vrai moteur (calculés le
 * 22.09.2026, confrontés par `banc-matching-explique.spec.ts`). Le banc ne note pas : il rejoue seulement les
 * deux règles d'état du moteur — ni un acheteur qui a déjà un match sur le bien, ni une recherche rouverte.
 */
const PROSPECTS_BANC: Record<string, {
  contact_id: string; prenom: string; nom: string; client_search_id: string; score: number
  origine: 'recherche_close' | 'deal_perdu'; depuis: string; reasons: Record<string, RaisonBanc>
}[]> = {
  p3: [
    {
      contact_id: 'c12', prenom: 'Philippe', nom: 'Rey', client_search_id: 'cs12', score: 100, origine: 'recherche_close', depuis: ilYA(24 * 120),
      reasons: {
        budget: { match: true, score: 36, detail: 'Dans le budget' },
        zone: { match: true, score: 27, detail: 'Genève correspond' },
        type: { match: true, score: 13, detail: 'apartment' },
        rooms: { match: true, score: 13, detail: '5,5 pièces' },
        features: { match: true, score: 11, detail: '1/1 critères' },
      },
    },
    {
      contact_id: 'c13', prenom: 'Nathalie', nom: 'Gerber', client_search_id: 'cs13', score: 96, origine: 'deal_perdu', depuis: ilYA(24 * 150),
      reasons: {
        budget: { match: true, score: 36, detail: 'Dans le budget' },
        zone: { match: true, score: 27, detail: 'Genève correspond' },
        type: { match: true, score: 13, detail: 'apartment' },
        rooms: { match: true, score: 21, detail: '5,5 pièces · 168 m²' },
        features: { match: false, score: 0, detail: '—' },
      },
    },
  ],
}

function prospectsDuBanc(bienId: string | null) {
  const matchs = CRM_TABLES.matches as { contact_id: string; property_id: string | null }[]
  const recherches = CRM_TABLES.client_searches as { id: string; is_active: boolean | null }[]
  return (bienId ? PROSPECTS_BANC[bienId] ?? [] : [])
    .filter((p) => !matchs.some((m) => m.contact_id === p.contact_id && m.property_id === bienId))
    .filter((p) => recherches.find((r) => r.id === p.client_search_id)?.is_active === false)
}

function prospectsBanc(a: Record<string, unknown>): Record<string, unknown> {
  const bienId = typeof a.property_id === 'string' ? a.property_id : null
  return {
    prospects: prospectsDuBanc(bienId).map((p) => ({
      contact_id: p.contact_id, prenom: p.prenom, nom: p.nom, client_search_id: p.client_search_id,
      score: p.score, origine: p.origine, depuis: p.depuis,
    })),
  }
}

function reactiverBanc(a: Record<string, unknown>): Record<string, unknown> {
  const bienId = typeof a.property_id === 'string' ? a.property_id : null
  const p = prospectsDuBanc(bienId).find((x) => x.client_search_id === a.client_search_id)
  if (!p || !bienId) return { error: 'deja_sur_ce_bien' }
  const maintenant = new Date().toISOString()
  const recherche = (CRM_TABLES.client_searches as { id: string; is_active: boolean | null; updated_at: string }[])
    .find((r) => r.id === p.client_search_id)
  if (recherche) {
    recherche.is_active = true
    recherche.updated_at = maintenant
  }
  const id = `m-prospect-${p.contact_id}`
  ;(CRM_TABLES.matches as Record<string, unknown>[]).push({
    id, agency_id: AGENCE_BANC.id, client_search_id: p.client_search_id, contact_id: p.contact_id, source: 'internal',
    property_id: bienId, market_listing_id: null, score: p.score, reasons: p.reasons, score_version: 4,
    status: 'suggested', sent_via: null, sent_at: null, snoozed_until: null, created_at: maintenant,
    contact: { first_name: p.prenom, last_name: p.nom, email: null, phone: null }, property: FLORISSANT_EMBARQUE, market_listing: null,
  })
  ;(CRM_TABLES.activity_events as Record<string, unknown>[]).push({
    id: crypto.randomUUID(), agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action: 'prospect_reactive',
    entity_type: 'contact', entity_id: p.contact_id, category: 'contact', severity: 'info', object_label: null, created_at: maintenant,
    metadata: { client_search_id: p.client_search_id, property_id: bienId, match_id: id, score: p.score, origine: a.origine ?? null },
  })
  return { match_id: id, score: p.score }
}

/**
 * Edge functions du banc.
 *
 * `extract-lead` — « Coller un message » de la fiche express. ⛔ PAS DE MODÈLE ICI : une
 * lecture par motifs, assez fidèle pour éprouver le PRÉREMPLISSAGE (quelles cases se
 * remplissent, lesquelles restent intactes), à la FORME exacte de `ExtractLeadResult`.
 * Rien ne sort du navigateur.
 */
export const CRM_EDGES: Record<string, unknown> = {
  // « Apprendre » (lot B) : voir `renoterBanc`. « Qui pour ce bien ? » (lot C) : `prospectsBanc`, `reactiverBanc`.
  'matching-engine': (a: Record<string, unknown>) => (a.mode === 'rescore-search' ? renoterBanc(a)
    : a.mode === 'prospects' ? prospectsBanc(a)
      : a.mode === 'reactiver-prospect' ? reactiverBanc(a)
        : { ok: true, banc: true }),
  'extract-lead': (a: Record<string, unknown>) => {
    const texte = String(a.text ?? '')
    const bas = texte.toLowerCase()
    const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(texte)?.[0] ?? ''
    const phone = /(?:\+|00)\d{2}[\d\s]{8,}\d|0\d{2}[\s\d]{7,}\d/.exec(texte)?.[0]?.trim() ?? ''
    const nom = /(?:je m'appelle|je suis|moi c'est)\s+([A-ZÀ-Ý][\p{L}-]+)\s+([A-ZÀ-Ý][\p{L}-]+)/iu.exec(texte)
    const intent = /\b(louer|location|loyer)\b/i.test(texte) ? 'tenant' : /\b(vendre|vente de mon|estimer)\b/i.test(texte) ? 'seller' : 'buyer'
    const chf = (brut: string, unite = '') => {
      const n = Number(brut.replace(/[^\d.]/g, ''))
      return /mio|million/i.test(unite) ? n * 1_000_000 : /^k$/i.test(unite) ? n * 1_000 : n
    }
    const fourchette = /entre\s+(\d[\d'’\s.]*)\s*(k|mio)?\s*(?:chf\s*)?et\s+(\d[\d'’\s.]*)\s*(k|mio|millions?)?/i.exec(texte)
    const montant = /(\d[\d'’\s.]*)\s*(k|mio|millions?|chf|fr)\b/i.exec(texte)
    const budget = fourchette ? chf(fourchette[3], fourchette[4]) : montant ? chf(montant[1], montant[2]) : null
    const budgetMin = fourchette ? chf(fourchette[1], fourchette[2] || fourchette[4]) : null
    const pieces = /(\d(?:[.,]5)?)\s*(?:pièces|pieces|p\.)/i.exec(texte)
    const surface = /(\d{2,4})\s*m²/i.exec(texte)
    const LIEUX: Record<string, string> = { 'genève': 'GE', geneve: 'GE', carouge: 'GE', champel: 'GE', 'chêne-bougeries': 'GE', lausanne: 'VD', pully: 'VD', nyon: 'VD', morges: 'VD', sion: 'VS', fribourg: 'FR', 'neuchâtel': 'NE' }
    const cites = Object.keys(LIEUX).filter((l) => bas.includes(l))
    const nationalites: Record<string, string> = { suisse: 'CH', française: 'FR', francaise: 'FR', italienne: 'IT', allemande: 'DE', portugaise: 'PT', espagnole: 'ES' }
    const nat = /nationalité\s+(\p{L}+)/iu.exec(texte)?.[1]?.toLowerCase()
    const domicile = /domicilié(?:e)?\s+(?:à\s+|au\s+)?((?:rue|avenue|chemin|route|place|boulevard)[^,.\n]*\d+[a-z]?,\s*\d{4}\s+[\p{L}-]+)/iu.exec(texte)?.[1] ?? ''
    const FEATS: Record<string, string> = { balcon: 'balcon', loggia: 'balcon', terrasse: 'terrasse', jardin: 'jardin', 'vue sur le lac': 'vue lac', 'vue lac': 'vue lac', ascenseur: 'ascenseur', 'place de parc': 'parking', parking: 'parking', garage: 'garage', cave: 'cave' }
    return {
      extracted: {
        firstName: nom?.[1] ?? '', lastName: nom?.[2] ?? '', email, phone, intent,
        budget, rooms: pieces ? Number(pieces[1].replace(',', '.')) : null,
        zone: cites.join(', '), urgency: 'normal', nextAction: 'call', confidence: 0.8,
        civility: /\bmadame\b|\bmme\b/i.test(texte) ? 'mrs' : /\bmonsieur\b/i.test(texte) ? 'mr' : '',
        language: 'fr',
        preferredChannel: /(?:sur|par)\s+whatsapp/i.test(texte) ? 'whatsapp' : /appelez-moi|par téléphone/i.test(texte) ? 'call' : '',
        budgetMin, surfaceMin: surface ? Number(surface[1]) : null,
        propertyTypes: [...new Set([/appartement|attique|studio|duplex/i.test(texte) && 'apartment', /maison|villa|chalet/i.test(texte) && 'house', /terrain/i.test(texte) && 'land'].filter(Boolean))],
        cantons: [...new Set(cites.map((l) => LIEUX[l]))],
        cities: cites.filter((l) => !['genève', 'geneve'].includes(l)).map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
        features: [...new Set(Object.keys(FEATS).filter((k) => bas.includes(k)).map((k) => FEATS[k]))],
        nationality: nat ? nationalites[nat] ?? '' : '', residenceCountry: domicile ? 'CH' : '',
        homeAddress: domicile, propertyAddress: '',
      },
      redactionSummary: '', redactionCount: 0, truncated: false,
    }
  },
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
  // ⚠ Des valeurs de `contacts_source_check`, pas des mots : le banc montrait
  // « flatfox », « site » et « recommandation », qu'aucune ligne ne peut porter —
  // et masquait ainsi que `whatsapp_ai` s'affichait brut.
  sources: [
    { source: 'whatsapp_ai', v: 14, conv: 0.21, prev: 11, comm: 42_000, won: 1 },
    { source: 'website', v: 9, conv: 0.33, prev: 8, comm: 61_000, won: 1 },
    { source: 'referral', v: 6, conv: 0.5, prev: 5, comm: 84_000, won: 1 },
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
 * `matching_fil_marche_resume` — le résumé « Marché » du fil, CALCULÉ sur les tables du banc à chaque appel, avec
 * les règles de la RPC : `suggested`, non reporté, annonce non retirée ; trois vignettes. Une valeur figée
 * ne bougerait pas quand un envoi ou un « Écarter » vide la sélection.
 *
 * ⚠ Mêmes vignettes et même ordre que `20260921121000_matching_fil_marche.sql`, sans quoi le banc montre
 * une ligne que la production ne rend pas : `photos_cf[0]` (chaîne, ou son `.thumb`) puis `photos[0]`, une
 * chaîne vide ne comptant pas ; rang par score décroissant, puis `created_at` décroissant avec l'absent
 * EN DERNIER, puis l'id ; les trois premières vignettes NON vides dans ce rang.
 */
function vignetteMarcheBanc(cf: unknown, photos: readonly string[] | null | undefined): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier !== '') return premier
  const thumb = premier && typeof premier === 'object' ? (premier as Record<string, unknown>).thumb : undefined
  if (typeof thumb === 'string' && thumb !== '') return thumb
  const photo = photos?.[0]
  return typeof photo === 'string' && photo !== '' ? photo : null
}

function resumeMarcheBanc() {
  const maintenant = Date.now()
  const annonces = new Map((CRM_TABLES.market_listings as {
    id: string; status?: string | null; photos?: string[] | null; photos_cf?: unknown
    price?: number | null; current_price?: number | null; price_at_first_seen?: number | null
    price_reduced_at?: string | null; first_seen_at?: string | null
  }[]).map((a) => [a.id, a]))
  const parContact = new Map<string, {
    id: string; score: number; creeLe: string | null; vignette: string | null; nouveau: boolean; enBaisse: boolean
  }[]>()
  const jour = 86_400_000
  for (const m of CRM_TABLES.matches as {
    id: string; contact_id: string; market_listing_id: string | null; status: string; score: number
    created_at: string | null; snoozed_until?: string | null
  }[]) {
    if (m.status !== 'suggested' || !m.market_listing_id) continue
    if (m.snoozed_until && Date.parse(m.snoozed_until) > maintenant) continue
    const a = annonces.get(m.market_listing_id)
    if (!a || a.status === 'removed') continue
    const liste = parContact.get(m.contact_id) ?? []
    // Les seuils de la RPC (`matching_fil_marche_resume`) : ceux de `filSignaux`, date future écartée comprise.
    const prix = Number(a.current_price ?? a.price ?? 0)
    const enBaisse = a.price_reduced_at != null && Date.parse(a.price_reduced_at) > maintenant - JOURS_BAISSE * jour
      && Date.parse(a.price_reduced_at) <= maintenant
      && Number(a.price_at_first_seen ?? 0) > prix && prix > 0
    const nouveau = a.first_seen_at != null && Date.parse(a.first_seen_at) > maintenant - JOURS_NOUVEAU * jour
      && Date.parse(a.first_seen_at) <= maintenant
    liste.push({ id: m.id, score: m.score, creeLe: m.created_at, vignette: vignetteMarcheBanc(a.photos_cf, a.photos), nouveau, enBaisse })
    parContact.set(m.contact_id, liste)
  }
  // `created_at desc nulls last` : l'absent après toute date, sans jamais comparer une date absente.
  const parDate = (x: string | null, y: string | null): number =>
    x === y ? 0 : x == null ? 1 : y == null ? -1 : y < x ? -1 : 1
  return [...parContact]
    .map(([contact_id, l]) => {
      const tries = [...l].sort((x, y) => y.score - x.score || parDate(x.creeLe, y.creeLe) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
      return {
        contact_id, nombre: l.length, meilleur_score: tries[0]!.score,
        vignettes: tries.map((x) => x.vignette).filter((v): v is string => v != null).slice(0, 3),
        nouveaux: l.filter((x) => x.nouveau && !x.enBaisse).length,
        baisses: l.filter((x) => x.enBaisse).length,
      }
    })
    .sort((x, y) => y.meilleur_score - x.meilleur_score || y.nombre - x.nombre)
}

/**
 * Lot D1 (23.09.2026) — les RPC des surfaces, REJOUÉES sur les tables du banc à chaque appel, comme `resumeMarcheBanc` :
 * les matchs et les rappels y sont écrivables, donc un geste consigné au banc se voit dans « Aujourd'hui ». Sans elles, le
 * banc disait toujours « Tu es à jour », relance échue comprise.
 * ⚠ MIROIRS de `…_matching_surfaces.sql` (`matching_actions_du_jour`, `pige_acheteurs_compatibles`, et le
 * `today_absence` qu'elle réécrit) : mêmes règles, mêmes seuils (`filSignaux`), mêmes statuts compatibles
 * (`STATUTS_COMPATIBLES`) — `banc-matching-d1.spec.ts` confronte leur sortie à l'histoire du banc. Une règle changée d'un
 * côté se change de l'autre.
 * ⚠ Le banc n'a pas de RLS : le filtre d'agence que la base tient de la RLS (`security invoker`) ou écrit en dur
 * (`today_absence`, `security definer`) est écrit ici, sur `AGENCE_BANC`.
 * ⛔ Ni de TRIGGER : ce que la base pose seule après un geste n'y est pas écrit. Deux effets sont rejoués ici, À LA
 * LECTURE, parce que sans eux le banc mentait après un geste : la relance close par `fermer_relance_proposition`
 * (`relanceClose`) et la réponse datée par `set_match_response_at` (`reponduLe`). Pas `set_match_prix_propose` : « Je
 * l'ai proposé » sur le bien revenu d'Antoine (m5) garde au banc son prix de proposition et sa réponse d'avant, et
 * l'action « prix » y reste, là où la base la retirerait — une limite du banc du lot B, pas de ces miroirs.
 */
type MatchBanc = {
  id: string; agency_id: string; contact_id: string; property_id: string | null; market_listing_id: string | null
  status: string; score: number; sent_at: string | null; response_at?: string | null; reaction_motif?: string | null
  prix_propose?: number | null; snoozed_until?: string | null; updated_at?: string | null
}
type RappelBanc = {
  id: string; agency_id: string; contact_id: string | null; property_id?: string | null; type: string; status: string
  trigger_at: string | null; match_id?: string | null; match_ids?: string[] | null
}
type BienBanc = {
  id: string; agency_id: string; title?: string | null; address?: string | null; city?: string | null; price?: number | null
  status?: string; transaction_type?: string | null; mandate_signed_at?: string | null; published_at?: string | null
  deleted_at?: string | null
}
type AnnonceBanc = {
  id: string; title?: string | null; address?: string | null; city?: string | null; price?: number | null
  current_price?: number | null; status?: string | null; transaction_type?: string | null; price_at_first_seen?: number | null
  price_reduced_at?: string | null; first_seen_at?: string | null
}
type ContactBanc = { id: string; first_name: string | null; last_name: string | null }
/** Une ligne de `matching_actions_du_jour` avant la coupe : `rang` est la sorte, qui ordonne. */
type ActionBanc = {
  genre: 'retour' | 'prix' | 'mandat' | 'marche'; rang: 1 | 2 | 3 | 4
  contact_id: string | null; match_id: string | null; property_id: string | null; market_listing_id: string | null
  statut: string | null; titre: string | null; ville: string | null; nombre: number | null; nouveaux: number | null
  baisses: number | null; montant: number | null; location: boolean | null; quand: string | null
}

const JOUR_BANC = 86_400_000
const STATUTS_COMPATIBLES_BANC = new Set<string>(STATUTS_COMPATIBLES)
/** `x > now() - interval '<jours> days' and x <= now()` : une date récente, jamais future. */
const recenteBanc = (iso: string | null | undefined, jours: number, maintenant: number): boolean =>
  iso != null && Date.parse(iso) > maintenant - jours * JOUR_BANC && Date.parse(iso) <= maintenant
/** `greatest(…)` / `max(…)` sur des dates : la plus récente des présentes, nulle s'il n'y en a aucune. */
const plusRecenteBanc = (dates: readonly (string | null | undefined)[]): string | null =>
  dates.reduce<string | null>((max, d) => (d != null && (max == null || Date.parse(d) > Date.parse(max)) ? d : max), null)
/** `least(greatest(coalesce(v, défaut), min), max)` : la borne d'un paramètre. */
const borneBanc = (v: unknown, defaut: number, min: number, max: number): number => {
  const n = v == null ? defaut : Number(v)
  return Math.min(Math.max(Number.isFinite(n) ? n : defaut, min), max)
}
/** `nullif(x, '')`. */
const nonVideBanc = (s: string | null | undefined): string | null => (s == null || s === '' ? null : s)
/** `type = 'rent'` : nul quand le type l'est. */
const locationBanc = (type: string | null | undefined): boolean | null => (type == null ? null : type === 'rent')
/** Un ordre `nulls last`, croissant (`sens` 1) ou décroissant (-1) : un absent reste en dernier dans les deux sens. */
const ordreBanc = (x: string | number | null, y: string | number | null, sens: 1 | -1 = 1): number =>
  x === y ? 0 : x == null ? 1 : y == null ? -1 : (x < y ? -1 : 1) * sens
const tempsOuNulBanc = (iso: string | null): number | null => (iso == null ? null : Date.parse(iso))
const matchsBanc = () => (CRM_TABLES.matches as MatchBanc[]).filter((m) => m.agency_id === AGENCE_BANC.id)
const contactBanc = (id: string | null) => (CRM_TABLES.contacts as ContactBanc[]).find((c) => c.id === id)
const bienBanc = (id: string | null | undefined) => (CRM_TABLES.properties as BienBanc[]).find((p) => p.id === id)
const annonceBanc = (id: string | null | undefined) => (CRM_TABLES.market_listings as AnnonceBanc[]).find((x) => x.id === id)
/** `coalesce(r.match_ids, array[r.match_id])` : les biens qu'une relance couvre. */
const couvertsBanc = (r: RappelBanc): string[] => r.match_ids ?? (r.match_id ? [r.match_id] : [])
/** Les biens d'une relance qui attendent encore leur réponse (`sent`) — de l'agence seule. */
const envoyesBanc = (ids: readonly string[]) => matchsBanc().filter((m) => ids.includes(m.id) && m.status === 'sent')
/**
 * Une relance de PROPOSITION dont plus aucun bien n'attend : la base l'aurait close (`fermer_relance_proposition`, quand
 * son dernier bien quitte `sent`) ; le banc, qui ne joue pas ce trigger, la garde `pending`. Lue ouverte, elle sortait de
 * `today_absence` avec `nb_biens: 0`, le hook en faisait un rappel ordinaire, et « Reprendre » l'écrivait `done` —
 * exactement ce que le lot D1 a retiré.
 * ⚠ Seulement si elle COUVRE des biens. `automation-engine` (§4, l'acheteur chaud inactif) en pose une sans aucun
 * (`match_id` nul) : aucun bien ne la désigne, le trigger ne la ferme jamais, et la base la rend avec `nb_biens: 0` —
 * un rappel ordinaire, qui se reprend.
 * ⚠ Rejouée à la LECTURE seulement : la table la garde `pending`, et « Dossiers », qui lit `reminders` sans passer par
 * ces miroirs (`useReminders`), la montre encore — le banc n'a pas de déclencheur.
 */
const relanceClose = (r: RappelBanc): boolean =>
  r.type === 'follow_up_sent_property' && couvertsBanc(r).length > 0 && envoyesBanc(couvertsBanc(r)).length === 0
/**
 * La date d'une réponse : `response_at`, que la base pose au passage du statut (`set_match_response_at`). Le banc ne joue
 * pas ce trigger, mais son PATCH pose `updated_at` (`ecrire`, `bancSupabase.ts`) : l'heure du geste qui a consigné la
 * réponse. ⚠ Au plus près, pas à l'identique : la base fige la PREMIÈRE réponse, `updated_at` suit le dernier PATCH.
 */
const reponduLe = (m: MatchBanc): string | null => m.response_at ?? m.updated_at ?? null

/** `matching_actions_du_jour(p_limite)`, sur le banc. */
function actionsDuJourBanc(a: Record<string, unknown>) {
  const maintenant = Date.now()
  const limite = borneBanc(a.p_limite, 5, 1, 20)
  const vide = {
    contact_id: null, match_id: null, property_id: null, market_listing_id: null, statut: null, titre: null, ville: null,
    nombre: null, nouveaux: null, baisses: null, montant: null, location: null, quand: null,
  }
  const lignes: ActionBanc[] = []

  // 1. Les retours dus : une relance de proposition échue dont un bien au moins attend encore sa réponse. Une ligne par
  //    acheteur, datée de la plus ancienne de SES relances qui comptent (une relance sans bien `sent` ne compte pas).
  const retours = new Map<string, { ids: Set<string>; quand: string }>()
  for (const r of CRM_TABLES.reminders as RappelBanc[]) {
    if (r.agency_id !== AGENCE_BANC.id || r.type !== 'follow_up_sent_property' || !['pending', 'triggered', 'snoozed'].includes(r.status)) continue
    if (r.contact_id == null || r.trigger_at == null || !(Date.parse(r.trigger_at) <= maintenant)) continue
    // Sans bien `sent`, rien ne se consigne : la jointure de la RPC sur les biens `sent` l'écarte des retours, qu'elle
    // ait couvert des biens répondus depuis (la base l'aurait close : `relanceClose`) ou aucun (celle d'`automation-engine`).
    const envoyes = envoyesBanc(couvertsBanc(r))
    if (!envoyes.length) continue
    const e = retours.get(r.contact_id) ?? { ids: new Set<string>(), quand: r.trigger_at }
    for (const m of envoyes) e.ids.add(m.id)
    if (Date.parse(r.trigger_at) < Date.parse(e.quand)) e.quand = r.trigger_at
    retours.set(r.contact_id, e)
  }
  for (const [contact, e] of retours) lignes.push({ ...vide, genre: 'retour', rang: 1, contact_id: contact, nombre: e.ids.size, quand: e.quand })

  // 2. Un prix passé sous le prix de proposition : proposé sans réponse, ou refusé pour le prix et revenu à proposer (son
  //    report échu). Ni prix nul, ni annonce retirée, ni mandat vendu, retiré, supprimé — ou absent.
  for (const m of matchsBanc()) {
    if (m.prix_propose == null) continue
    const revenu = m.status === 'suggested' && m.reaction_motif === 'prix'
      && (m.snoozed_until == null || Date.parse(m.snoozed_until) <= maintenant)
    if (m.status !== 'sent' && !revenu) continue
    const bien = bienBanc(m.property_id)
    const annonce = annonceBanc(m.market_listing_id)
    if (annonce?.status === 'removed') continue
    if (m.property_id != null && !(bien?.status === 'active' && bien.deleted_at == null)) continue
    const brut = m.property_id != null ? bien?.price : annonce?.current_price ?? annonce?.price
    const prix = brut == null ? null : Number(brut)
    if (prix == null || !(prix > 0) || !(prix < m.prix_propose)) continue
    lignes.push({
      ...vide, genre: 'prix', rang: 2, contact_id: m.contact_id, match_id: m.id, property_id: m.property_id,
      market_listing_id: m.market_listing_id, statut: m.status,
      titre: nonVideBanc(bien?.title) ?? nonVideBanc(annonce?.title) ?? bien?.address ?? annonce?.address ?? null,
      ville: bien?.city ?? annonce?.city ?? null, montant: m.prix_propose - prix,
      location: locationBanc(bien?.transaction_type ?? annonce?.transaction_type), quand: m.sent_at,
    })
  }

  // 3. Les nouveaux mandats : signés ou mis en service il y a 7 jours au plus (la plus récente des deux dates), actifs,
  //    non supprimés, avec au moins un acquéreur compatible.
  for (const p of CRM_TABLES.properties as BienBanc[]) {
    if (p.agency_id !== AGENCE_BANC.id || p.status !== 'active' || p.deleted_at != null) continue
    const quand = plusRecenteBanc([p.mandate_signed_at, p.published_at])
    if (!recenteBanc(quand, JOURS_MANDAT, maintenant)) continue
    const acheteurs = new Set(matchsBanc().filter((m) => m.property_id === p.id && STATUTS_COMPATIBLES_BANC.has(m.status)).map((m) => m.contact_id))
    if (!acheteurs.size) continue
    lignes.push({
      ...vide, genre: 'mandat', rang: 3, property_id: p.id, titre: nonVideBanc(p.title) ?? p.address ?? null,
      ville: p.city ?? null, nombre: acheteurs.size, location: locationBanc(p.transaction_type), quand,
    })
  }

  // 4. Le marché, par acheteur : ses annonces jamais proposées (sans `prix_propose` — une baisse sur un bien déjà
  //    proposé est l'action 2), nouvelles (3 jours) ou en baisse (14 jours). En baisse ne compte pas aussi en nouvelle.
  const parContact = new Map<string, { annonce: AnnonceBanc; nouveau: boolean; enBaisse: boolean }[]>()
  for (const m of matchsBanc()) {
    if (m.status !== 'suggested' || m.market_listing_id == null || m.prix_propose != null) continue
    if (m.snoozed_until != null && Date.parse(m.snoozed_until) > maintenant) continue
    const x = annonceBanc(m.market_listing_id)
    if (!x || x.status === 'removed') continue
    const prix = Number(x.current_price ?? x.price ?? 0)
    const enBaisse = recenteBanc(x.price_reduced_at, JOURS_BAISSE, maintenant) && Number(x.price_at_first_seen ?? 0) > prix && prix > 0
    const nouveau = recenteBanc(x.first_seen_at, JOURS_NOUVEAU, maintenant)
    if (!enBaisse && !nouveau) continue
    parContact.set(m.contact_id, [...(parContact.get(m.contact_id) ?? []), { annonce: x, nouveau, enBaisse }])
  }
  for (const [contact, s] of parContact) {
    // UNE annonce est nommée ; au-delà, on compte.
    const seule = s.length === 1 ? s[0]!.annonce : null
    const locations = s.map((x) => locationBanc(x.annonce.transaction_type))
    lignes.push({
      ...vide, genre: 'marche', rang: 4, contact_id: contact, market_listing_id: seule?.id ?? null,
      titre: seule ? nonVideBanc(seule.title) ?? seule.address ?? null : null, ville: seule ? seule.city ?? null : null,
      nombre: s.length, nouveaux: s.filter((x) => x.nouveau && !x.enBaisse).length, baisses: s.filter((x) => x.enBaisse).length,
      // `bool_or` : vraie si l'une l'est, nulle si toutes le sont.
      location: locations.includes(true) ? true : locations.includes(false) ? false : null,
      quand: plusRecenteBanc(s.map((x) => (x.enBaisse ? x.annonce.price_reduced_at : x.annonce.first_seen_at))),
    })
  }

  // L'ordre de la RPC : la sorte ; dans une sorte, la plus ancienne échéance, la plus forte baisse, le plus récent ; puis
  // les identifiants, absents en dernier.
  lignes.sort((x, y) => (x.rang - y.rang)
    || (x.rang === 1 ? ordreBanc(tempsOuNulBanc(x.quand), tempsOuNulBanc(y.quand))
      : x.rang === 2 ? ordreBanc(x.montant, y.montant, -1)
        : ordreBanc(tempsOuNulBanc(x.quand), tempsOuNulBanc(y.quand), -1))
    || ordreBanc(x.contact_id, y.contact_id) || ordreBanc(x.property_id, y.property_id) || ordreBanc(x.match_id, y.match_id))
  // `count(*) over ()` : le total AVANT la coupe — ce que « Voir les N actions » promet.
  const total = lignes.length
  return lignes.slice(0, limite).map(({ rang: _rang, ...l }) => {
    const c = contactBanc(l.contact_id)
    return { ...l, prenom: c?.first_name ?? null, nom: c?.last_name ?? null, total }
  })
}

/** `pige_acheteurs_compatibles(p_annonces)`, sur le banc : les 30 premiers identifiants, une ligne par annonce qui a un acheteur. */
function acheteursPigeBanc(a: Record<string, unknown>) {
  const ids = new Set((Array.isArray(a.p_annonces) ? a.p_annonces : []).slice(0, 30).filter((x): x is string => typeof x === 'string'))
  const parAnnonce = new Map<string, Set<string>>()
  for (const m of matchsBanc()) {
    if (m.market_listing_id == null || !ids.has(m.market_listing_id) || !STATUTS_COMPATIBLES_BANC.has(m.status)) continue
    parAnnonce.set(m.market_listing_id, (parAnnonce.get(m.market_listing_id) ?? new Set<string>()).add(m.contact_id))
  }
  return [...parAnnonce].map(([market_listing_id, acheteurs]) => ({ market_listing_id, acheteurs: acheteurs.size }))
}

/**
 * `today_absence(p_fallback_hours)`, sur le banc. L'agent du banc n'a pas de présence (`agent_presence`) : la fenêtre est
 * celle du repli. Les réactions y sont bornées ; les rappels échus NON, comme dans la fonction — ce qui attend attend
 * d'autant plus qu'il est vieux.
 */
function absenceBanc(a: Record<string, unknown>) {
  const maintenant = Date.now()
  const depuis = maintenant - borneBanc(a.p_fallback_hours, 72, 1, 720) * 3_600_000
  const reactions = matchsBanc().flatMap((m) => {
    const le = reponduLe(m)
    if ((m.status !== 'interested' && m.status !== 'rejected') || le == null || !(Date.parse(le) > depuis)) return []
    // `join contacts` : une réponse sans acheteur n'est pas un signal.
    const c = contactBanc(m.contact_id)
    if (!c) return []
    const p = bienBanc(m.property_id)
    const x = annonceBanc(m.market_listing_id)
    return [{
      id: `match:${m.id}`, kind: m.status === 'interested' ? 'like' : 'skip', contact_id: m.contact_id,
      first_name: c.first_name, last_name: c.last_name, subject: p?.title ?? p?.address ?? x?.title ?? null,
      motif: m.reaction_motif ?? null, occurred_at: le, late: false, ref_id: m.id, reminder_type: null, nb_biens: null,
    }]
  })
  const rappels = (CRM_TABLES.reminders as RappelBanc[]).flatMap((r) => {
    if (r.agency_id !== AGENCE_BANC.id || (r.status !== 'pending' && r.status !== 'triggered')) return []
    if (r.trigger_at == null || !(Date.parse(r.trigger_at) <= maintenant)) return []
    // Close en base, elle n'attend plus rien : ce n'est plus un signal (`relanceClose`).
    if (relanceClose(r)) return []
    const c = contactBanc(r.contact_id)
    const p = bienBanc(r.property_id)
    return [{
      id: `reminder:${r.id}`, kind: 'reminder', contact_id: r.contact_id, first_name: c?.first_name ?? null,
      last_name: c?.last_name ?? null, subject: p?.title ?? p?.address ?? null, motif: null, occurred_at: r.trigger_at,
      late: true, ref_id: r.id, reminder_type: r.type,
      // Une relance de PROPOSITION dit combien de ses biens attendent encore leur réponse : « Reprendre » la consigne.
      nb_biens: r.type === 'follow_up_sent_property' ? envoyesBanc(couvertsBanc(r)).length : null,
    }]
  })
  const signals = [...reactions, ...rappels].sort((x, y) => Date.parse(y.occurred_at) - Date.parse(x.occurred_at)).slice(0, 50)
  return { since: new Date(depuis).toISOString(), signals }
}

/**
 * `focus_top_matches` : la file Focus des meilleurs matchs. ⚠ Le BUREAU ne la lit plus depuis le lot D1 (`useHotDeals` →
 * `useFocusQueue({ matchs: false })` : la requête ne part pas, les matchs vivent dans le segment Matching). Son seul
 * lecteur restant, `MobileTodayScreen`, n'est monté que par le banc `/dev/mobile`, en démo — le mobile routé
 * (`MobileTodayHScreen`) ne la lit pas. Ces deux lignes font de ce banc un TÉMOIN : si le bureau relisait la file, deux
 * matchs de Florissant (Anastasia, Emma) entreraient dans celle de « Dossiers ».
 * ⚠ Une CONSTANTE, pas un miroir : deux lignes à la forme de la RPC, pour deux matchs RÉELS du banc (m22, m23), et
 * écrites comme elle les écrirait — `reason_keys` en ordre alphabétique, les seuls axes tenus (Emma n'a ni pièces ni
 * équipements dans sa recherche), la première photo du bien, et `kyc_risk_high` nul faute de dossier KYC.
 */
const FOCUS_TOP_BANC = [
  { match_id: 'm22', contact_id: 'c11', contact_name: 'Anastasia Volkova', kind: 'internal', score: 100, lead_score: null, reasons_match_count: 5, reason_keys: ['budget', 'features', 'rooms', 'type', 'zone'], property_title: 'Attique 5,5 pièces · Florissant', property_price: 2_350_000, property_photo: unsplash(PHOTOS_APPART[9]!), city: 'Genève', kyc_risk_high: null, kyc_days_to_expiry: null },
  { match_id: 'm23', contact_id: 'c7', contact_name: 'Emma Schneider', kind: 'internal', score: 100, lead_score: null, reasons_match_count: 3, reason_keys: ['budget', 'type', 'zone'], property_title: 'Attique 5,5 pièces · Florissant', property_price: 2_350_000, property_photo: unsplash(PHOTOS_APPART[9]!), city: 'Genève', kyc_risk_high: null, kyc_days_to_expiry: null },
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

/** Les trois tables d'événements du Calendrier, par `source` de libellé. */
const TABLE_DE_SOURCE: Record<string, string> = { visit: 'visits', reminder: 'reminders', appointment: 'appointments' }
type LigneLibellee = { id: string; calendar_label_id?: string | null }

export const CRM_RPC: Record<string, unknown> = {
  claim_pending_role: null,
  matching_fil_marche_resume: () => resumeMarcheBanc(),
  // Lot D1 — les surfaces du CRM (miroirs des RPC : voir `actionsDuJourBanc`). À l'état « Vide », `today_absence`
  // retombe sur `null`, que son hook lit comme « aucun signal », et les trois autres sur `[]` : rien à ajouter à
  // `CRM_RPC_VIDE`.
  matching_actions_du_jour: (a: Record<string, unknown>) => actionsDuJourBanc(a),
  pige_acheteurs_compatibles: (a: Record<string, unknown>) => acheteursPigeBanc(a),
  today_absence: (a: Record<string, unknown>) => absenceBanc(a),
  focus_top_matches: FOCUS_TOP_BANC,
  // Les crédits du studio Labs. ⚠ Sous `/dev/crm`, `useCredits` passe par les fixtures du
  // studio (`LabsFixturesContext`) et n'atteint pas ces deux entrées ; elles répondent
  // aux surfaces qui liraient la RPC HORS de ce contexte — le solde d'une agence Pro
  // à mi-mois, le même que celui des fixtures.
  credits_balance: {
    included: 903, purchased: 340, total: 1243, month: '2026-09', plan: 'pro', monthly_allowance: 1500,
    auto_topup_enabled: false, auto_topup_threshold: 100, auto_topup_pack: '500',
    auto_topup_last_error: null, auto_topup_last_error_at: null, has_card: true, card_brand: 'visa', card_last4: '4242',
  },
  credits_set_auto_topup: { ok: true },
  // Les destinataires suggérés du composeur de la Messagerie. Mêmes jetons que la RPC —
  // minuscules, cinq au plus, TOUS présents, chacun dans le prénom, le nom, l'adresse ou le
  // téléphone. Sans elle, la saisie « comme Google » ne proposait AUCUN contact au banc.
  mail_search_contacts: (a: Record<string, unknown>) => {
    const jetons = String(a.p_q ?? '').toLowerCase().replace(/[,()%*_\\]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5)
    if (jetons.length === 0) return []
    return (CRM_TABLES.contacts as typeof CONTACTS)
      .filter((c) => jetons.every((j) => [c.first_name, c.last_name, c.email, c.phone].some((v) => (v ?? '').toLowerCase().includes(j))))
      .sort((x, y) => `${x.last_name} ${x.first_name}`.localeCompare(`${y.last_name} ${y.first_name}`))
      .slice(0, 10)
      .map(({ id, first_name, last_name, email, phone }) => ({ id, first_name, last_name, email, phone }))
  },
  // ⚠ LUES À CHAQUE APPEL, sur les fixtures VIVANTES : un libellé créé ou supprimé
  // dans le rail (`calendar_labels` est écrivable), ou posé par un clic droit,
  // doit se voir au rafraîchissement suivant. Une affectation vers un libellé
  // supprimé disparaît ici, comme le `ON DELETE SET NULL` de la base.
  calendar_label_assignments: () => {
    const vivants = new Set((CRM_TABLES.calendar_labels as { id: string }[]).map((l) => l.id))
    return Object.entries(TABLE_DE_SOURCE).flatMap(([source, table]) =>
      (CRM_TABLES[table] as LigneLibellee[])
        .filter((r) => r.calendar_label_id && vivants.has(r.calendar_label_id))
        .map((r) => ({ source, event_id: r.id, label_id: r.calendar_label_id })))
  },
  calendar_set_event_label: (a: Record<string, unknown>) => {
    const table = TABLE_DE_SOURCE[String(a.p_source)]
    const ligne = table ? (CRM_TABLES[table] as LigneLibellee[]).find((r) => r.id === a.p_event_id) : undefined
    if (ligne) ligne.calendar_label_id = typeof a.p_label_id === 'string' ? a.p_label_id : null
    return null
  },
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
  // Les doublons de la fiche express — la logique de `find_contact_duplicates` : e-mail
  // exact (casse ignorée), téléphone normalisé (chiffres seuls, `0` suisse ⇒ `41`),
  // prénom + nom exacts ; un contact par ligne, sa meilleure raison d'abord.
  find_contact_duplicates: (a: Record<string, unknown>) => {
    const bas = (v: unknown) => String(v ?? '').trim().toLowerCase()
    const tel = (v: unknown) => String(v ?? '').replace(/\D/g, '').replace(/^00/, '').replace(/^0(?=\d{9}$)/, '41')
    const email = bas(a.p_email)
    const phone = tel(a.p_phone)
    const prenom = bas(a.p_first_name)
    const nom = bas(a.p_last_name)
    return (CRM_TABLES.contacts as typeof CONTACTS).flatMap((c) => {
      const kind = email && bas(c.email) === email ? ['email', 1] as const
        : phone && tel(c.phone) === phone ? ['phone', 2] as const
        : prenom.length >= 2 && nom.length >= 2 && bas(c.first_name) === prenom && bas(c.last_name) === nom ? ['name', 3] as const
        : null
      return kind ? [{ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, type: c.type, created_at: c.created_at, user_id: null, match_kind: kind[0], match_priority: kind[1] }] : []
    }).sort((x, y) => x.match_priority - y.match_priority).slice(0, 5)
  },
  kyc_latest_screening_decision: (a: Record<string, unknown>) => {
    const pour = KYC_DECISIONS.filter(
      (d) => d.kyc_case_id === a.p_kyc_case_id && d.decision_target === a.p_target,
    )
    // La plus récente d'abord — c'est celle que la fiche et la Vigie lisent.
    return [...pour].sort((x, y) => (x.decided_at < y.decided_at ? 1 : -1)).slice(0, 1)
  },
}
