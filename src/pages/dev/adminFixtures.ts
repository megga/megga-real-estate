/**
 * Données de démonstration du banc `/dev/admin`.
 *
 * ⛔ RIEN ICI NE VIENT DE LA BASE, et rien n'y retourne. Les noms, adresses et
 * montants sont inventés ; aucune donnée de conformité réelle n'y figure.
 *
 * ── POURQUOI UNE TABLE D'APPELS ET NON DES PROPS ─────────────────────────────
 * Les 19 pages de la console ne partagent AUCUNE couture de données : mesuré, la
 * console lit **38 hooks distincts**, qui frappent **42 RPC, 18 tables et
 * 5 edge functions**. Leur donner un slot `banc` — l'idiome du Pipeline — aurait
 * demandé 19 substitutions dans du code de production.
 *
 * Le seul point commun des 38 hooks est le client `supabase`, dont le
 * `global.fetch` (`authAwareFetch`) appelle le `fetch` **global** au moment de
 * l'appel. Une seule interception de `window.fetch` couvre donc les 42 RPC d'un
 * coup, sans toucher une ligne de production. C'est l'économie que le plan
 * demandait de MESURER avant de la supposer : elle existe, et elle est ici.
 *
 * ⚠ CE QUE LE BANC NE PROUVE PAS. Une RPC sans entrée dans `RPC` rend une
 * réponse VIDE — la page affiche alors son `AdminEmpty`, qui est un état réel,
 * pas une panne. Ces appels sont COMPTÉS et affichés dans les commandes du banc
 * (« n sans fixture ») : un banc qui tronque en silence se lit « tout couvert ».
 */

/** Décalage horaire lisible : les écrans affichent « il y a 2 h », pas une date fixe. */
const T0 = Date.now()
const ilYA = (minutes: number): string => new Date(T0 - minutes * 60_000).toISOString()
const dans = (jours: number): string => new Date(T0 + jours * 86_400_000).toISOString()

/** Les trois états que le banc sait produire, pour toute la console d'un coup. */
export type AdminBancEtat = 'nominal' | 'vide' | 'erreur'

/* ─── Agences ─────────────────────────────────────────────────────────────── */

const AGENCES = [
  {
    id: 'a1000000-0000-4000-8000-000000000001', name: 'Rive Gauche Immobilier',
    slug: 'rive-gauche', email: 'contact@rive-gauche.demo', phone: '+41 22 000 00 01',
    city: 'Genève', canton: 'GE', plan: 'pro', status: 'active', sub: 'active',
    agents: 7, properties: 34, deals: 12, mrr: 349, score: 82,
    since: ilYA(60 * 24 * 280), last: ilYA(45), logo_url: null,
    current_period_end: dans(19), verification_status: 'verified',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002', name: 'Lavaux Résidences SA',
    slug: 'lavaux-residences', email: 'info@lavaux-residences.demo', phone: '+41 21 000 00 02',
    city: 'Lutry', canton: 'VD', plan: 'starter', status: 'active', sub: 'trialing',
    agents: 3, properties: 11, deals: 4, mrr: 0, score: 61,
    since: ilYA(60 * 24 * 21), last: ilYA(60 * 6), logo_url: null,
    current_period_end: dans(6), verification_status: 'manual_review',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003', name: 'Alpes & Vallées Immobilier',
    slug: 'alpes-vallees', email: null, phone: null,
    city: 'Sion', canton: 'VS', plan: 'pro', status: 'suspended', sub: 'past_due',
    agents: 5, properties: 22, deals: 2, mrr: 349, score: 38,
    since: ilYA(60 * 24 * 410), last: ilYA(60 * 24 * 31), logo_url: null,
    current_period_end: ilYA(60 * 24 * 4), verification_status: 'rejected',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004', name: 'Zurichberg Wohnen AG',
    slug: 'zurichberg-wohnen', email: 'hallo@zurichberg.demo', phone: '+41 44 000 00 04',
    city: 'Zürich', canton: 'ZH', plan: 'enterprise', status: 'active', sub: 'active',
    agents: 18, properties: 96, deals: 27, mrr: 890, score: 94,
    since: ilYA(60 * 24 * 520), last: ilYA(12), logo_url: null,
    current_period_end: dans(24), verification_status: 'verified',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005', name: 'Ticino Case Sagl',
    slug: 'ticino-case', email: 'info@ticino-case.demo', phone: null,
    city: 'Lugano', canton: 'TI', plan: 'starter', status: 'active', sub: 'active',
    agents: 2, properties: 8, deals: 1, mrr: 129, score: 55,
    since: ilYA(60 * 24 * 95), last: ilYA(60 * 50), logo_url: null,
    current_period_end: dans(11), verification_status: 'pending',
  },
]

/* ─── Personnes ───────────────────────────────────────────────────────────── */

const UTILISATEURS = [
  {
    id: 'u1000000-0000-4000-8000-000000000001', name: 'Camille Roulet',
    email: 'camille.roulet@rive-gauche.demo', role: 'admin', phone: '+41 79 000 00 11',
    agency: 'Rive Gauche Immobilier', agency_id: AGENCES[0]!.id, avatar_url: null,
    since: ilYA(60 * 24 * 270), last: ilYA(38), invited_at: null, never: false,
    stale_days: 0, suspended: false, marketing: true, deleted_at: null,
    consents: { terms: 'v3', privacy: 'v2' },
  },
  {
    id: 'u1000000-0000-4000-8000-000000000002', name: 'Yannis Perreten',
    email: 'yannis.perreten@rive-gauche.demo', role: 'agent', phone: null,
    agency: 'Rive Gauche Immobilier', agency_id: AGENCES[0]!.id, avatar_url: null,
    since: ilYA(60 * 24 * 130), last: ilYA(60 * 29), invited_at: null, never: false,
    stale_days: 1, suspended: false, marketing: false, deleted_at: null,
    consents: { terms: 'v3' },
  },
  {
    id: 'u1000000-0000-4000-8000-000000000003', name: 'Noor Benali',
    email: 'noor.benali@lavaux-residences.demo', role: 'manager', phone: '+41 79 000 00 13',
    agency: 'Lavaux Résidences SA', agency_id: AGENCES[1]!.id, avatar_url: null,
    since: ilYA(60 * 24 * 20), last: null, invited_at: ilYA(60 * 24 * 20), never: true,
    stale_days: 20, suspended: false, marketing: false, deleted_at: null,
    consents: {},
  },
  {
    id: 'u1000000-0000-4000-8000-000000000004', name: 'Théo Nussbaum',
    email: 'theo.nussbaum@alpes-vallees.demo', role: 'agent', phone: null,
    agency: 'Alpes & Vallées Immobilier', agency_id: AGENCES[2]!.id, avatar_url: null,
    since: ilYA(60 * 24 * 390), last: ilYA(60 * 24 * 96), invited_at: null, never: false,
    stale_days: 96, suspended: true, marketing: false, deleted_at: null,
    consents: { terms: 'v2', privacy: 'v1' },
  },
  {
    id: 'u1000000-0000-4000-8000-000000000005', name: 'Sarah Wyss',
    email: 'sarah.wyss@zurichberg.demo', role: 'admin', phone: '+41 79 000 00 15',
    agency: 'Zurichberg Wohnen AG', agency_id: AGENCES[3]!.id, avatar_url: null,
    since: ilYA(60 * 24 * 500), last: ilYA(9), invited_at: null, never: false,
    stale_days: 0, suspended: false, marketing: true, deleted_at: null,
    consents: { terms: 'v3', privacy: 'v2' },
  },
]

/* ─── Journal ─────────────────────────────────────────────────────────────── */

const JOURNAL = [
  { id: 'e01', ts: ilYA(6), action: 'agency_verification_submitted', severity: 'info', category: 'agency', agency_name: 'Ticino Case Sagl', actor_label: 'Alessia Motta', actor_kind: 'user', entity_type: 'agency', object_label: 'Ticino Case Sagl' },
  { id: 'e02', ts: ilYA(24), action: 'edge_function_error', severity: 'crit', category: 'platform', agency_name: null, actor_label: 'système', actor_kind: 'system', entity_type: 'function', object_label: 'stripe-webhook' },
  { id: 'e03', ts: ilYA(51), action: 'subscription_payment_failed', severity: 'warn', category: 'billing', agency_name: 'Alpes & Vallées Immobilier', actor_label: 'Stripe', actor_kind: 'system', entity_type: 'subscription', object_label: 'sub_demo_003' },
  { id: 'e04', ts: ilYA(96), action: 'property_moderation_flagged', severity: 'warn', category: 'moderation', agency_name: 'Lavaux Résidences SA', actor_label: 'Noor Benali', actor_kind: 'user', entity_type: 'property', object_label: 'Appartement 4,5 p. — Lutry' },
  { id: 'e05', ts: ilYA(140), action: 'admin_console_entered', severity: 'info', category: 'security', agency_name: null, actor_label: 'Super-admin', actor_kind: 'user', entity_type: 'console', object_label: 'Vue d’ensemble' },
  { id: 'e06', ts: ilYA(200), action: 'user_role_changed', severity: 'warn', category: 'security', agency_name: 'Rive Gauche Immobilier', actor_label: 'Super-admin', actor_kind: 'user', entity_type: 'profile', object_label: 'Yannis Perreten' },
  { id: 'e07', ts: ilYA(310), action: 'agency_created', severity: 'info', category: 'agency', agency_name: 'Ticino Case Sagl', actor_label: 'Super-admin', actor_kind: 'user', entity_type: 'agency', object_label: 'Ticino Case Sagl' },
  { id: 'e08', ts: ilYA(420), action: 'cron_job_failed', severity: 'crit', category: 'platform', agency_name: null, actor_label: 'pg_cron', actor_kind: 'system', entity_type: 'cron', object_label: 'realadvisor-probe-collect' },
]

/** `activity_events` brut — la forme de la TABLE, pas celle du journal assemblé. */
const EVENEMENTS = JOURNAL.map((l, i) => ({
  id: `ev-${i + 1}`,
  action: l.action,
  entity_type: l.entity_type,
  entity_id: `ent-${i + 1}`,
  agency_id: i % 2 === 0 ? AGENCES[0]!.id : AGENCES[3]!.id,
  actor_id: UTILISATEURS[i % UTILISATEURS.length]!.id,
  object_label: l.object_label,
  created_at: l.ts,
  metadata: l.action === 'edge_function_error'
    ? { function_name: 'stripe-webhook', error: 'timeout après 8 s', duration_ms: 8042 }
    : { source: 'banc' },
}))

/* ─── Cron ────────────────────────────────────────────────────────────────── */

const CRON = [
  { jobname: 'flatfox-sync-daily', schedule: '0 4 * * *', active: true, last_start: ilYA(60 * 9), last_status: 'succeeded' },
  { jobname: 'realadvisor-fresh-daily', schedule: '30 3 * * *', active: true, last_start: ilYA(60 * 10), last_status: 'succeeded' },
  { jobname: 'realadvisor-probe-collect', schedule: '10 * * * *', active: true, last_start: ilYA(415), last_status: 'failed' },
  { jobname: 'platform-metrics-hourly', schedule: '15 * * * *', active: true, last_start: ilYA(22), last_status: 'succeeded' },
  { jobname: 'realadvisor-health-daily', schedule: '0 9 * * *', active: true, last_start: ilYA(60 * 4), last_status: 'succeeded' },
  { jobname: 'outbox-purge-weekly', schedule: '0 2 * * 0', active: false, last_start: null, last_status: null },
]

/* ─── Table des RPC ───────────────────────────────────────────────────────── */

/**
 * Réponse de chaque RPC, par nom. Une RPC absente rend `null` et se voit dans le
 * compteur « sans fixture » des commandes du banc.
 *
 * ⚠ Les GESTES (création, suspension, régénération de lien) rendent l'enveloppe
 * `admin_ok` du socle : elles doivent RÉUSSIR sans rien écrire, pour que la
 * modale de confirmation se ferme comme en production. Le banc n'éprouve pas la
 * base, il éprouve le rendu.
 */
export const RPC: Record<string, unknown | ((args: Record<string, unknown>) => unknown)> = {
  is_super_admin: true,

  admin_overview: {
    pulse: { healthy: false, functions_err: 1, crons_failed: 1, errors_24h: 3 },
    kpis: {
      agencies: 5, users: 35, properties: 171, transactions: 46, mrr: 1717,
      new_agencies_this_month: 1, new_users_this_month: 4,
    },
    signals: [
      { id: 'kyb', kind: 'kyb_review', tone: 'warn', count: 2, go: '/kyb-review' },
      { id: 'unpaid', kind: 'unpaid', tone: 'err', count: 1, go: '/plans' },
      { id: 'moderation', kind: 'moderation', tone: 'info', count: 3, go: '/moderation' },
    ],
    journal: JOURNAL,
    activation: { total: 5, active: 3, at_risk: 1, dormant: 1 },
    kyc_funnel: { links_sent: 24, links_opened: 19, links_submitted: 14, links_expired: 3, conversion_pct: 58 },
    revenue: { mrr: 1717, subscriptions: 4, arpu: 429, failed: 1 },
    unavailable: ['mrr_trend', 'churn'],
  },

  get_admin_agencies: AGENCES,
  get_admin_users: UTILISATEURS,

  // ⚠ Résolue depuis l'ARGUMENT : une fixture fixe affichait « Rive Gauche »
  // en en-tête d'une fiche ouverte depuis la ligne « Zurichberg ». Un écran
  // incohérent se lit comme un défaut de la page — ici c'était le banc.
  get_admin_agency_detail: (args: Record<string, unknown>) => {
    const cible = AGENCES.find((a) => a.id === args.p_agency_id) ?? AGENCES[0]!
    const equipe = UTILISATEURS.filter((u) => u.agency_id === cible.id)
    return {
      found: true,
      agency: cible,
      usage: {
        active_properties: cible.properties, contacts_count: cible.properties * 6,
        ai_cost_month_usd: 12.4, ai_calls_month: 964, wa_messages_month: 312,
        storage_est_mb: 1840, last_activity_at: cible.last,
      },
      team: (equipe.length > 0 ? equipe : UTILISATEURS.slice(0, 1)).map((u) => ({
        id: u.id, name: u.name, email: u.email, role: u.role,
        phone: u.phone, suspended: u.suspended, since: u.since, deleted_at: null,
      })),
      invitations: [
        { id: 'inv-1', email: `nouvelle.recrue@${cible.slug}.demo`, role: 'agent', status: 'pending', created_at: ilYA(60 * 30), expires_at: dans(4) },
      ],
      subscription: {
        plan: cible.plan, status: cible.sub, billing_period: 'monthly',
        current_period_end: cible.current_period_end,
        trial_end: cible.sub === 'trialing' ? dans(6) : null,
        last_invoice_status: cible.sub === 'past_due' ? 'open' : 'paid',
      },
      note: { note: 'Agence pilote — contact direct par Grégory.', updated_at: ilYA(60 * 24 * 3), updated_by: 'Super-admin' },
      activation: { properties_30d: 6, deals_30d: 3, logins_30d: 41 },
    }
  },

  get_admin_plans_board: {
    mrr: 1717, subscriptions: 4, arpu: 429,
    portfolio: AGENCES.map((a) => ({
      id: a.id, name: a.name, agency_status: a.status, plan: a.plan,
      billing_period: 'monthly', sub_status: a.sub,
      current_period_end: a.current_period_end, trial_end: a.sub === 'trialing' ? dans(6) : null,
      last_invoice_status: a.sub === 'past_due' ? 'open' : 'paid',
      seats_used: a.agents,
      state: a.sub === 'trialing' ? 'trial' : a.sub === 'past_due' ? 'unpaid' : 'active',
      mrr: a.mrr,
    })),
    queues: {
      unpaid: [{
        id: AGENCES[2]!.id, name: AGENCES[2]!.name, agency_status: 'suspended', plan: 'pro',
        billing_period: 'monthly', sub_status: 'past_due', current_period_end: ilYA(60 * 24 * 4),
        trial_end: null, last_invoice_status: 'open', seats_used: 5, state: 'unpaid', mrr: 349,
      }],
      trials: [{
        id: AGENCES[1]!.id, name: AGENCES[1]!.name, agency_status: 'active', plan: 'starter',
        billing_period: 'monthly', sub_status: 'trialing', current_period_end: dans(6),
        trial_end: dans(6), last_invoice_status: null, seats_used: 3, state: 'trial', mrr: 0,
      }],
    },
    plans: [
      { plan: 'starter', count: 2, mrr: 129 },
      { plan: 'pro', count: 2, mrr: 698 },
      { plan: 'enterprise', count: 1, mrr: 890 },
    ],
    pricing_source: {
      starter: { monthly: 129, yearly: 1290 },
      pro: { monthly: 349, yearly: 3490 },
      enterprise: { monthly: 890, yearly: 8900 },
    },
    unavailable: ['seats_saturated'],
  },

  get_admin_monitoring_health: [{
    errors_last_24h: 3, emails_sent_today: 48, api_requests_today: 12_940,
    last_scraping_at: ilYA(60 * 9), db_size_mb: 2140, storage_used_mb: 8_420,
    db_limit_mb: 8000, storage_limit_mb: 100_000,
  }],

  get_cron_health: CRON,

  // ⚠ Ces trois RPC rendent un TABLEAU d'une ligne en `snake_case`, que le hook
  // remappe en `camelCase`. Les fixtures écrites dans la forme du hook rendaient
  // des compteurs à zéro à côté de listes pleines — un écran incohérent qu'on
  // aurait pu lire comme un défaut de la page.
  get_admin_compliance_stats: [{ total: 18, pending: 4, screening_match: 1, avg_completion: 72 }],
  get_admin_consent_stats: {
    coverage: [
      { consent_type: 'terms', version: 'v3', accepted: 28 },
      { consent_type: 'privacy', version: 'v2', accepted: 24 },
    ],
    users_with_terms: 28, users_with_privacy: 24, users_total: 35,
  },

  get_admin_moderation_stats: [{ published_count: 171, flags_this_month: 3, removes_this_month: 1 }],

  get_admin_end_user_stats: {
    magic_links: { total_30d: 24, opened: 19, uploaded: 14, confirmed: 11, expired: 3, conversion_pct: 58 },
    leads: {
      by_status: [{ status: 'new', count: 12 }, { status: 'contacted', count: 7 }, { status: 'lost', count: 3 }],
      by_source: [{ source: 'vitrine', count: 14 }, { source: 'whatsapp', count: 8 }],
      total: 22, new_30d: 9,
    },
    contact_messages: { by_status: [{ status: 'open', count: 2 }, { status: 'answered', count: 6 }], total: 8 },
  },

  get_admin_kyc_magic_links: [
    { id: 'ml-1', status: 'confirmed', mode: 'full', sent_at: ilYA(60 * 40), opened_at: ilYA(60 * 39), uploaded_at: ilYA(60 * 38), confirmed_at: ilYA(60 * 36), expires_at: dans(2), agency_name: 'Rive Gauche Immobilier', contact_name: 'M. Delacroix' },
    { id: 'ml-2', status: 'opened', mode: 'light', sent_at: ilYA(60 * 5), opened_at: ilYA(60 * 4), uploaded_at: null, confirmed_at: null, expires_at: dans(5), agency_name: 'Zurichberg Wohnen AG', contact_name: 'Frau Steiner' },
    { id: 'ml-3', status: 'expired', mode: 'full', sent_at: ilYA(60 * 24 * 12), opened_at: null, uploaded_at: null, confirmed_at: null, expires_at: ilYA(60 * 24 * 5), agency_name: 'Lavaux Résidences SA', contact_name: 'Mme Progin' },
  ],

  get_admin_security_journal: JOURNAL.map((l, i) => ({
    id: l.id,
    ts: l.ts,
    sev: l.severity === 'crit' ? 'crit' : l.severity === 'warn' ? 'warn' : 'info',
    fam: l.category === 'security' ? 'access' : l.category === 'billing' ? 'billing' : 'platform',
    action: l.action,
    action_params: null,
    entity: l.object_label ?? '—',
    actor: l.actor_label,
    meta: [['agence', l.agency_name ?? '—'], ['origine', 'banc']],
    total_count: JOURNAL.length,
    _i: i,
  })),

  get_admin_agency_review_queue: [
    { agency_id: AGENCES[1]!.id, agency_name: AGENCES[1]!.name, country: 'CH', verification_status: 'manual_review', verification_score: 4.5, identity_submitted_at: ilYA(60 * 30), verification_sweep_attempts: 1, total_count: 2 },
    { agency_id: AGENCES[4]!.id, agency_name: AGENCES[4]!.name, country: 'CH', verification_status: 'manual_review', verification_score: null, identity_submitted_at: ilYA(60 * 8), verification_sweep_attempts: 0, total_count: 2 },
  ],

  // ⚠ `result` appartient à un vocabulaire FERMÉ — match / partial / mismatch /
  // unavailable / pending_manual_review. Écrit `pass`, il tombait dans la
  // branche par défaut de `checkRowTone` et sortait un véto SATISFAIT en
  // ROUGE : une fixture hors vocabulaire ne casse rien, elle ment.
  get_admin_agency_review_detail: [
    { check_id: 'c1', related_person_id: null, check_type: 'registry_lookup', source: 'lindas', result: 'partial', raw_response: { uid: 'CHE-000.000.000' }, checked_at: ilYA(60 * 29), applicable_weight: 2, is_veto: false },
    { check_id: 'c2', related_person_id: null, check_type: 'vat_lookup', source: 'uid_register', result: 'unavailable', raw_response: null, checked_at: ilYA(60 * 29), applicable_weight: 3, is_veto: false },
    { check_id: 'c3', related_person_id: null, check_type: 'address_geocode', source: 'mapbox', result: 'unavailable', raw_response: null, checked_at: ilYA(60 * 29), applicable_weight: 1.5, is_veto: false },
    { check_id: 'c4', related_person_id: 'p1', check_type: 'sanctions_screening', source: 'dilisense', result: 'match', raw_response: { hits: 0 }, checked_at: ilYA(60 * 29), applicable_weight: 0, is_veto: true },
  ],

  // ⚠ Les statuts sont `confirmed` / `done` / `no_show` / `cancelled`. Écrits
  // `scheduled` / `completed`, les quatre compteurs de tête restaient à zéro
  // au-dessus d'une liste pleine.
  get_admin_onboarding_calls: [
    { id: 'oc-1', agency_id: AGENCES[4]!.id, agency_name: AGENCES[4]!.name, agency_slug: AGENCES[4]!.slug, verification_status: 'pending', booked_by: UTILISATEURS[4]!.id, booked_by_name: 'Alessia Motta', booked_by_email: 'alessia@ticino-case.demo', host_id: 'h-1', host_name: 'Grégory Lyonnet', scheduled_at: dans(2), duration_minutes: 30, status: 'confirmed', meeting_url: 'https://meet.demo/abc', attendee_phone: '+41 79 000 00 21', attendee_note: 'Premier contact — questions sur le KYB.', rescheduled_count: 0, cancel_reason: null, created_at: ilYA(60 * 20) },
    { id: 'oc-2', agency_id: AGENCES[1]!.id, agency_name: AGENCES[1]!.name, agency_slug: AGENCES[1]!.slug, verification_status: 'manual_review', booked_by: UTILISATEURS[2]!.id, booked_by_name: 'Noor Benali', booked_by_email: 'noor.benali@lavaux-residences.demo', host_id: 'h-1', host_name: 'Grégory Lyonnet', scheduled_at: ilYA(60 * 26), duration_minutes: 30, status: 'done', meeting_url: null, attendee_phone: null, attendee_note: null, rescheduled_count: 1, cancel_reason: null, created_at: ilYA(60 * 24 * 5) },
    { id: 'oc-3', agency_id: AGENCES[2]!.id, agency_name: AGENCES[2]!.name, agency_slug: AGENCES[2]!.slug, verification_status: 'rejected', booked_by: UTILISATEURS[3]!.id, booked_by_name: 'Théo Nussbaum', booked_by_email: 'theo.nussbaum@alpes-vallees.demo', host_id: 'h-1', host_name: 'Grégory Lyonnet', scheduled_at: ilYA(60 * 24 * 3), duration_minutes: 30, status: 'no_show', meeting_url: null, attendee_phone: null, attendee_note: null, rescheduled_count: 0, cancel_reason: null, created_at: ilYA(60 * 24 * 9) },
  ],

  get_admin_onboarding_hosts: [{
    id: 'h-1', profile_id: UTILISATEURS[0]!.id, display_name: 'Grégory Lyonnet',
    profile_email: 'gregory@megga.demo', timezone: 'Europe/Zurich', is_active: true,
    weekly_hours: [{ dow: 2, start: '09:00', end: '12:00' }, { dow: 4, start: '14:00', end: '17:00' }],
    slot_minutes: 30, duration_minutes: 30, buffer_after_minutes: 10,
    min_notice_hours: 24, horizon_days: 21, max_per_day: 4,
    upcoming_calls: 1, created_at: ilYA(60 * 24 * 90),
  }],

  get_admin_integrations_health: {
    emails: { sent_24h: 48, sent_7d: 291, errors_7d: 2 },
    stripe_webhook: { last_event_at: ilYA(180), age_hours: 3, events_7d: 41, payment_failed_7d: 1, active_subscriptions: 4 },
    calendar: {
      google: { connected: 6, stale: 1, expired: 0 },
      outlook: { connected: 2, stale: 0, expired: 1 },
      stale_total: 1,
    },
  },

  get_admin_syndication_health: {
    by_status: [
      { portal: 'flatfox', status: 'published', count: 128 },
      { portal: 'flatfox', status: 'error', count: 2 },
    ],
    recent_errors: [
      { property_id: 'p-9', agency_name: 'Lavaux Résidences SA', error: 'photo principale absente', updated_at: ilYA(60 * 7) },
    ],
    agencies: [
      { agency_name: 'Rive Gauche Immobilier', idx_enabled: true, transport: 'api', ftp_configured: false },
      { agency_name: 'Zurichberg Wohnen AG', idx_enabled: false, transport: 'ftp', ftp_configured: true },
    ],
    last_push_at: ilYA(60 * 6),
  },

  get_admin_whatsapp_health: {
    sent_24h: 142, failed_24h: 3, sent_7d: 908, failed_7d: 11,
    last_inbound_at: ilYA(18), last_status_update_at: ilYA(16),
    top_errors: [{ error: 'template non approuvé', count: 6 }, { error: 'numéro invalide', count: 5 }],
    unmapped_inbound_7d: 2, cron_locks: [],
    processing_failed: 1, processing_deadletter: 0, agent_errors_24h: 2,
    delivery_failed_24h: 3, async_jobs_failed_24h: 0, webhook_stale: false,
  },

  get_admin_ai_costs: [
    { month: '2026-08', agency_id: AGENCES[0]!.id, agency_name: 'Rive Gauche Immobilier', provider: 'deepseek', module: 'copilote', calls: 964, tokens_in: 412_000, tokens_out: 118_000, cost_usd: 12.4 },
    { month: '2026-08', agency_id: AGENCES[3]!.id, agency_name: 'Zurichberg Wohnen AG', provider: 'gemini', module: 'vision', calls: 210, tokens_in: 96_000, tokens_out: 21_000, cost_usd: 6.1 },
    { month: '2026-07', agency_id: AGENCES[0]!.id, agency_name: 'Rive Gauche Immobilier', provider: 'deepseek', module: 'copilote', calls: 881, tokens_in: 390_000, tokens_out: 104_000, cost_usd: 11.2 },
  ],

  get_whatsapp_autonomy_suggestions: [
    { profile_id: UTILISATEURS[0]!.id, agent_name: 'Camille Roulet', agency_id: AGENCES[0]!.id, autonomy: 'assisted', tool: 'send_message', yes_count: 41, no_count: 2, last_no_at: ilYA(60 * 70), suggest_resume: true },
    { profile_id: UTILISATEURS[1]!.id, agent_name: 'Yannis Perreten', agency_id: AGENCES[0]!.id, autonomy: 'manual', tool: 'book_visit', yes_count: 6, no_count: 9, last_no_at: ilYA(60 * 12), suggest_resume: false },
  ],

  // ⚠ `error_rate` est une FRACTION, pas un pourcentage : la page rend
  // `rate * 100`. Écrit en pourcentage, `8.7` sortait « 870,0 % » — une valeur
  // qu'aucune donnée réelle ne peut prendre, et qui aurait envoyé chercher un
  // défaut dans la page.
  get_whatsapp_tool_usage_stats: [
    { tool: 'send_message', total_calls: 1204, error_count: 12, error_rate: 0.01, last_used_at: ilYA(14) },
    { tool: 'book_visit', total_calls: 218, error_count: 19, error_rate: 0.087, last_used_at: ilYA(96) },
    { tool: 'send_kyc_link', total_calls: 64, error_count: 0, error_rate: 0, last_used_at: ilYA(60 * 5) },
  ],

  get_agent_learned_styles: [
    {
      agent_id: UTILISATEURS[0]!.id, agent_name: 'Camille Roulet', agency_id: AGENCES[0]!.id,
      learned_style: { language: 'fr', formality: 'vouvoiement', emoji: false, traits: 'phrases courtes, confirme toujours l’heure', status: 'active', updated_at: ilYA(60 * 30), sample_count: 84 },
    },
    { agent_id: UTILISATEURS[4]!.id, agent_name: 'Sarah Wyss', agency_id: AGENCES[3]!.id, learned_style: null },
  ],

  admin_kyc_link_lookup: {
    code: 'ok',
    matches: [{
      id: 'ml-2', status: 'opened', mode: 'light',
      sent_at: ilYA(60 * 5), opened_at: ilYA(60 * 4),
      uploaded_at: null, confirmed_at: null, expires_at: dans(5),
      agency_name: 'Zurichberg Wohnen AG',
    }],
  },

  /* ── Gestes : réussissent, n'écrivent rien ────────────────────────────── */
  admin_create_agency: { code: 'ok', id: 'a1000000-0000-4000-8000-00000000000f' },
  // ⚠ Enveloppe §10.1 complète, et c'est le banc qui l'a exigée : `{ code: 'ok' }`
  // ne respecte pas le contrat de `readCronRunNow`, qui LÈVE — l'écran affichait
  // « Réponse inattendue du serveur ». Un banc qui rend une enveloppe
  // approximative éprouve la branche d'échec en croyant éprouver le succès.
  admin_cron_run_now: {
    ok: true, code: 'ok', message_fr: null,
    data: { scheduled_for: dans(0.02) },
  },
  admin_kyc_link_regenerate: { code: 'ok', queued: true },
  admin_log_impersonation: { code: 'ok' },
  admin_set_user_role: { code: 'ok' },
  admin_set_onboarding_call_outcome: { code: 'ok' },
  admin_set_onboarding_host_active: { code: 'ok' },
  admin_upsert_onboarding_host: { code: 'ok' },
  admin_changelog_save: { code: 'ok' },
  admin_changelog_publish: { code: 'ok' },
  admin_changelog_unpublish: { code: 'ok' },
  admin_changelog_schedule: { code: 'ok' },
  admin_changelog_delete: { code: 'ok' },
  claim_pending_role: { code: 'ok' },
  set_agent_learned_style: { code: 'ok' },
  submit_agency_identity: { code: 'ok' },
}

/* ─── Table des tables ────────────────────────────────────────────────────── */

/** Lignes rendues pour un `select` sur la table. Une table absente rend `[]`. */
export const TABLES: Record<string, unknown[]> = {
  agencies: AGENCES.map((a) => ({ id: a.id, name: a.name, email: a.email })),
  profiles: UTILISATEURS.map((u) => ({ id: u.id, full_name: u.name, email: u.email, role: u.role })),
  activity_events: EVENEMENTS,

  properties: [
    { id: 'p-1', title: 'Appartement 4,5 p. — Lutry', price: 1_290_000, city: 'Lutry', canton: 'VD', photos: [], published_at: ilYA(60 * 30), moderation_status: 'flagged', moderation_reason: 'photo non conforme', agency_id: AGENCES[1]!.id },
    { id: 'p-2', title: 'Villa contemporaine — Cologny', price: 4_600_000, city: 'Cologny', canton: 'GE', photos: [], published_at: ilYA(60 * 90), moderation_status: 'flagged', moderation_reason: 'prix incohérent', agency_id: AGENCES[0]!.id },
    { id: 'p-3', title: 'Duplex 3,5 p. — Lugano', price: 890_000, city: 'Lugano', canton: 'TI', photos: [], published_at: ilYA(60 * 24 * 3), moderation_status: 'flagged', moderation_reason: null, agency_id: AGENCES[4]!.id },
  ],

  admin_nps_responses: [
    { id: 'n-1', rating: 5, comment: 'Le pipeline nous fait gagner une matinée par semaine.', user_email: 'camille.roulet@rive-gauche.demo', user_name: 'Camille Roulet', agency_id: AGENCES[0]!.id, role: 'admin', submitted_at: ilYA(60 * 24 * 2) },
    { id: 'n-2', rating: 4, comment: '', user_email: 'sarah.wyss@zurichberg.demo', user_name: 'Sarah Wyss', agency_id: AGENCES[3]!.id, role: 'admin', submitted_at: ilYA(60 * 24 * 6) },
    { id: 'n-3', rating: 2, comment: 'Le KYC demande trop d’allers-retours au client.', user_email: 'theo.nussbaum@alpes-vallees.demo', user_name: 'Théo Nussbaum', agency_id: AGENCES[2]!.id, role: 'agent', submitted_at: ilYA(60 * 24 * 9) },
    { id: 'n-4', rating: 3, comment: 'Correct, il manque l’export comptable.', user_email: null, user_name: null, agency_id: AGENCES[1]!.id, role: 'manager', submitted_at: ilYA(60 * 24 * 14) },
  ],

  admin_changelog: [
    { id: 'cl-1', title: 'Pipeline : la fiche deal passe en MEGGA X', content: 'Nouvelle grammaire visuelle sur le tableau et la fiche.', version: '2026.08.13', published: true, created_at: ilYA(60 * 24), status: 'published', scheduled_for: null },
    { id: 'cl-2', title: 'Revue KYB : file de traitement', content: 'La file de revue liste les dossiers en attente de décision humaine.', version: '2026.08.20', published: false, created_at: ilYA(60 * 3), status: 'scheduled', scheduled_for: dans(6) },
    { id: 'cl-3', title: 'Brouillon — export comptable', content: '', version: '', published: false, created_at: ilYA(60 * 2), status: 'draft', scheduled_for: null },
  ],

  admin_feature_flags: [
    { id: 'ff-1', key: 'whatsapp_agent', label: 'Agent WhatsApp', description: 'Réponses assistées sur le canal WhatsApp.', enabled_globally: true, enabled_plans: ['pro', 'enterprise'], enabled_agencies: [], created_at: ilYA(60 * 24 * 40) },
    { id: 'ff-2', key: 'kyb_stripe_identity', label: 'Vérification d’identité Stripe', description: 'Parcours d’identité au lieu du dépôt manuel.', enabled_globally: false, enabled_plans: [], enabled_agencies: [AGENCES[0]!.id], created_at: ilYA(60 * 24 * 10) },
    { id: 'ff-3', key: 'export_comptable', label: 'Export comptable', description: null, enabled_globally: false, enabled_plans: [], enabled_agencies: [], created_at: ilYA(60 * 24 * 2) },
  ],

  platform_announcements: [
    { id: 'an-1', title: 'Maintenance planifiée', body: 'Interruption de 10 minutes dimanche à 03 h 00.', severity: 'info', audience_plans: [], audience_agencies: [], starts_at: ilYA(60 * 24), ends_at: dans(3), cta_label: null, cta_href: null, published: true, created_at: ilYA(60 * 26) },
    { id: 'an-2', title: 'Nouvelle grille tarifaire', body: 'Les plans évoluent au 1er septembre.', severity: 'warn', audience_plans: ['starter'], audience_agencies: [], starts_at: dans(2), ends_at: dans(20), cta_label: 'Voir les plans', cta_href: '/plans', published: false, created_at: ilYA(60 * 5) },
  ],

  kyc_cases: [
    { id: 'k-1', type: 'seller', risk_level: 'low', risk_score: 12, status: 'completed', completion_pct: 100, screening_status: 'clear', created_at: ilYA(60 * 24 * 8), contact_id: 'c-1', agency_id: AGENCES[0]!.id },
    { id: 'k-2', type: 'buyer', risk_level: 'high', risk_score: 71, status: 'pending', completion_pct: 45, screening_status: 'potential_match', created_at: ilYA(60 * 24 * 2), contact_id: 'c-2', agency_id: AGENCES[3]!.id },
    { id: 'k-3', type: 'seller', risk_level: 'medium', risk_score: 38, status: 'pending', completion_pct: 60, screening_status: 'clear', created_at: ilYA(60 * 20), contact_id: 'c-3', agency_id: AGENCES[1]!.id },
  ],
  contacts: [
    { id: 'c-1', first_name: 'Marc', last_name: 'Delacroix' },
    { id: 'c-2', first_name: 'Ingrid', last_name: 'Steiner' },
    { id: 'c-3', first_name: 'Claire', last_name: 'Progin' },
  ],

  ai_balance_snapshots: [
    { captured_at: ilYA(60 * 2), total_balance_usd: 184.2, topped_up_balance_usd: 150, granted_balance_usd: 34.2 },
  ],
  ai_usage_logs: [
    { created_at: ilYA(60 * 3), provider: 'deepseek', input_tokens: 412_000, output_tokens: 118_000, estimated_cost_usd: 12.4, was_fallback: false },
    { created_at: ilYA(60 * 26), provider: 'gemini', input_tokens: 96_000, output_tokens: 21_000, estimated_cost_usd: 6.1, was_fallback: false },
  ],

  moderation_actions: [
    { id: 'ma-1', property_id: 'p-1', action: 'flag', reason: 'photo non conforme', created_at: ilYA(60 * 29) },
  ],

  // Boîte de réception de la Modération : leads sans agence et messages du site.
  seller_leads: [
    { id: 'sl-1', contact_name: 'Fabienne Guex', contact_email: 'fabienne.guex@exemple.demo', contact_phone: '+41 79 000 00 31', source: 'vitrine', status: 'new', created_at: ilYA(60 * 4), assigned_agency_id: null },
    { id: 'sl-2', contact_name: 'Renzo Barbieri', contact_email: 'renzo.barbieri@exemple.demo', contact_phone: null, source: 'whatsapp', status: 'new', created_at: ilYA(60 * 33), assigned_agency_id: null },
  ],
  contact_messages: [
    { id: 'cm-1', name: 'Hélène Aubert', email: 'helene.aubert@exemple.demo', message: 'Bonjour, je cherche à estimer un appartement à Nyon.', source: 'vitrine', status: 'open', created_at: ilYA(60 * 7) },
  ],
  // Le compteur Flatfox du Monitoring : `count: 'exact', head: true` — c'est
  // l'en-tête `content-range` qui porte la valeur, pas le corps.
  market_listings: [{ last_seen_at: ilYA(60 * 9) }],

  agency_related_persons: [{
    id: 'p1', first_name: 'Noor', last_name: 'Benali',
    id_document_type: 'passport', id_document_expires_on: dans(900), id_document_read: null,
    roles: [{ role: 'director', valid_to: null }],
  }],
  agency_person_roles: [{ id: 'r1' }],
  verification_check_config: [
    { check_type: 'registry_lookup' }, { check_type: 'vat_lookup' },
    { check_type: 'address_geocode' }, { check_type: 'sanctions_screening' },
  ],
  verification_check_types: [
    { code: 'registry_lookup', scope: 'agency' }, { code: 'vat_lookup', scope: 'agency' },
    { code: 'address_geocode', scope: 'agency' }, { code: 'sanctions_screening', scope: 'person' },
  ],
  documents: [],
}
