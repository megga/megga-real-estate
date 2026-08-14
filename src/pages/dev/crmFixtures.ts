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

/** L'agence du banc : identité soumise et LAB validée, sinon la coquille retient l'écran. */
export const AGENCE_BANC = {
  id: '00000000-0000-4000-8000-000000000a11',
  name: 'Agence MEGGA · démonstration',
  verification_status: 'validated',
  identity_submitted_at: '2026-01-01T00:00:00Z',
  canton: 'GE',
  plan: 'pro',
} as const

/** Le compte du banc — la même personne que `MOCK_PROFILE`, pour ne pas inventer un second agent. */
export const AGENT_BANC = {
  id: '00000000-0000-4000-8000-000000000901',
  email: 'demo@megga.local',
  full_name: 'Gregory Lyonnet',
  role: 'agent',
  avatar_url: null,
  phone: null,
  canton: 'GE',
  agency_id: AGENCE_BANC.id,
  created_at: '2026-01-01T00:00:00Z',
} as const

/** Base64url sans rembourrage — l'alphabet des segments d'un JWT. */
function b64url(o: unknown): string {
  return btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Sème la session dans le stockage de `supabase-js` et la REND, pour que le banc
 * la serve aussi sur `/auth/v1/*` (voir `contrat.session` de `bancSupabase`).
 * Rend `null` si la clé n'a pas pu être dérivée ou écrite.
 *
 * ⚠ La clé se DÉRIVE de l'URL du projet (`sb-<ref>-auth-token`) : l'écrire en
 * dur ferait taire le banc le jour où l'on pointe une autre instance — un banc
 * qui échoue en silence se lit « la page est cassée ».
 *
 * ⚠ Et il faut poser `megga_remember` : le stockage du dépôt bascule sur
 * `sessionStorage` quand il vaut `'false'`, et la session semée dans
 * `localStorage` serait alors lue au mauvais endroit.
 */
export function semerSessionBanc(urlProjet: string): unknown {
  const ref = /https?:\/\/([^.]+)\./.exec(urlProjet)?.[1]
  if (!ref) return null
  const expire = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365
  const jeton = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: AGENT_BANC.id, aud: 'authenticated', role: 'authenticated', exp: expire }),
    'banc-non-signe',
  ].join('.')
  const session = {
    access_token: jeton,
    refresh_token: 'banc',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: expire,
    user: {
      id: AGENT_BANC.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: AGENT_BANC.email,
      app_metadata: {},
      user_metadata: { full_name: AGENT_BANC.full_name, role: AGENT_BANC.role },
      created_at: AGENT_BANC.created_at,
    },
  }
  try {
    window.localStorage.setItem('megga_remember', 'true')
    window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))
    return window.localStorage.getItem(`sb-${ref}-auth-token`) === null ? null : session
  } catch {
    return null
  }
}

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
export const CRM_RPC: Record<string, unknown> = {
  claim_pending_role: null,
  is_super_admin: false,
}
