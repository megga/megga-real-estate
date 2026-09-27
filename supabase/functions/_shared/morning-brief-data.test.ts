/**
 * Le lecteur du point du jour, éprouvé sans base.
 *
 * POURQUOI CE BANC. Deux appelants le partagent depuis le 15.09.2026 — le push de 07h30 et
 * l'outil `get_daily_brief` — et tous deux lisent en SERVICE ROLE : la RLS est contournée, le
 * filtre d'agence posé sur chaque requête est la seule garde de tenant. Un filtre oublié ici
 * ferait lire à un agent la journée d'une autre agence, sans qu'aucune erreur ne le signale.
 */
import { describe, it, expect } from 'vitest'
import { loadAgencyData, lireMatching } from './morning-brief-data'

const AGENCY = 'a0000000-0000-4000-8000-000000000001'
const NOW = new Date('2026-07-05T05:30:00Z')

type Appel = { table: string; op: string; args: unknown[] }

/**
 * Un tout petit évaluateur du filtre PostgREST `.or(...)` — seulement les opérateurs dont ce fichier se sert
 * (`neq`, `gt`, `is`, `eq`), `and(...)`/`or(...)` imbriqués compris. Groupe = une liste de termes séparés par des
 * virgules AU PREMIER NIVEAU (les groupes imbriqués ne se coupent pas) ; un terme est `col.op.valeur` — la valeur
 * peut elle-même contenir des points (une date ISO), d'où la recherche des deux PREMIERS points seulement.
 */
function evalPostgrest(groupe: string, mode: 'and' | 'or', ligne: Record<string, unknown>): boolean {
  const termes: string[] = []
  let profondeur = 0
  let debut = 0
  for (let i = 0; i < groupe.length; i++) {
    const c = groupe[i]
    if (c === '(') profondeur++
    else if (c === ')') profondeur--
    else if (c === ',' && profondeur === 0) { termes.push(groupe.slice(debut, i)); debut = i + 1 }
  }
  termes.push(groupe.slice(debut))
  const verdicts = termes.map((t) => evalTerme(t.trim(), ligne))
  return mode === 'and' ? verdicts.every(Boolean) : verdicts.some(Boolean)
}
function evalTerme(t: string, ligne: Record<string, unknown>): boolean {
  if (t.startsWith('and(')) return evalPostgrest(t.slice(4, -1), 'and', ligne)
  if (t.startsWith('or(')) return evalPostgrest(t.slice(3, -1), 'or', ligne)
  const i1 = t.indexOf('.')
  const col = t.slice(0, i1)
  const i2 = t.indexOf('.', i1 + 1)
  const op = t.slice(i1 + 1, i2)
  const val = t.slice(i2 + 1)
  const v = ligne[col]
  switch (op) {
    case 'neq': return String(v ?? '') !== val
    // `{}` : littéral tableau vide PostgreSQL — `match_ids` posé à `{}` (jamais NULL par défaut) ne doit PAS
    // passer pour « couvre un match », comme dans la CTE de la migration (`any('{}')` ne joint aucune ligne).
    case 'eq': return val === '{}' ? Array.isArray(v) && v.length === 0 : String(v ?? '') === val
    case 'gt': return v != null && Date.parse(String(v)) > Date.parse(val)
    case 'is': return val === 'null' ? v == null : String(v) === val
    default: throw new Error(`évaluateur de test : opérateur PostgREST non simulé ici : ${op}`)
  }
}

/**
 * Un filtre `.eq('<alias>.<col>', valeur)` sur une ressource EMBARQUÉE — `contact.agency_id`, ici. `inner` distingue
 * les DEUX comportements PostgREST d'un tel filtre : SANS `!inner`, l'embarqué qui ne correspond pas (absent, ou
 * d'une autre valeur) devient `null` et la ligne PARENTE reste ; AVEC `!inner`, la ligne parente est écartée. Une
 * ligne dont l'embarqué est déjà `null` (rien à embarquer) n'a rien à comparer : gardée sans `!inner` (une relance
 * sans acheteur), écartée avec (un match SANS acheteur n'existe pas en pratique, mais la sémantique d'une
 * jointure stricte reste : rien à joindre).
 */
interface FiltreEmbed { alias: string; col: string; val: string }
function appliquerFiltresEmbed(
  lignes: Array<Record<string, unknown>>, filtres: FiltreEmbed[], inner: (alias: string) => boolean,
): Array<Record<string, unknown>> {
  return lignes.flatMap((ligne) => {
    const copie = { ...ligne }
    for (const f of filtres) {
      const embarque = copie[f.alias] as Record<string, unknown> | null | undefined
      const estInner = inner(f.alias)
      if (embarque == null) {
        if (estInner) return []
        continue
      }
      // Un champ que la fixture ne déclare pas n'est pas une valeur À COMPARER : ce test-ci ne porte pas dessus.
      if (!(f.col in embarque)) continue
      if (String(embarque[f.col]) !== f.val) {
        if (estInner) return []
        copie[f.alias] = null
      }
    }
    return [copie]
  })
}

/**
 * Faux client : chaque maillon de la chaîne est ENREGISTRÉ, et la chaîne se résout comme celle de supabase-js —
 * `{ data, error }`, jamais une exception.
 *
 * ⛔ CE QU'IL NE VÉRIFIE PAS. `.limit(...)` et `.order(...)` sont enregistrés mais JAMAIS appliqués : les lignes
 * rendues sont toutes celles de la fixture, dans l'ordre où elle les écrit. `.select(...)` n'est confronté à
 * AUCUN schéma : une colonne inexistante (une faute de frappe dans un `.or(...)`) ou un alias mal formé s'y
 * comportent comme une colonne simplement absente de la ligne — traités `null`/vide — SANS jamais produire
 * l'erreur qu'un vrai PostgREST rendrait (400). Garantir la chaîne EXACTE d'un `.or`/`.order`/`.limit` (pas
 * seulement l'effet que CE simulateur lui prête) demande soit de figer cette chaîne dans une assertion, soit de
 * passer par une vraie base (`tests/backend/matching-whatsapp.spec.ts`, W6).
 *
 * ⚠ `.or(...)` est réellement ÉVALUÉ contre les lignes, mais SEULEMENT pour la table `reminders` : c'est la SEULE
 * dont ce module confie sa déduplication à la requête elle-même plutôt qu'à un filtre après coup. Ailleurs
 * (`calendar_events`, `seller_leads`), `.or(...)` reste un simple ENREGISTREMENT d'appel, comme les autres
 * opérations — un test qui prétendrait prouver le filtre des relances sur un simulateur qui ne filtre RIEN
 * d'autre ne prouverait rien.
 *
 * ⚠ Un `.eq('<alias>.<colonne>', valeur)` — un filtre sur une ressource EMBARQUÉE — est lui aussi réellement
 * ÉVALUÉ, et lit le `.select(...)` de LA MÊME requête pour savoir si cet alias porte `!inner` : sans cette
 * distinction, un test peut rester vert alors que le `!inner` du select change le comportement réel. Voir
 * `appliquerFiltresEmbed`.
 */
function fauxClient(rows: Record<string, unknown[]>, erreurSur?: string) {
  const appels: Appel[] = []
  const from = (table: string) => {
    const self: Record<string, unknown> = {}
    let filtreOr: string | null = null
    let selectStr = ''
    const filtresEmbed: FiltreEmbed[] = []
    for (const op of ['select', 'in', 'gte', 'gt', 'lt', 'lte', 'not', 'order', 'limit']) {
      self[op] = (...args: unknown[]) => {
        appels.push({ table, op, args })
        if (op === 'select') selectStr = args[0] as string
        return self
      }
    }
    self.eq = (...args: unknown[]) => {
      appels.push({ table, op: 'eq', args })
      const [col, val] = args as [string, unknown]
      if (col.includes('.')) {
        const [alias, sousCol] = col.split('.')
        filtresEmbed.push({ alias, col: sousCol, val: String(val) })
      }
      return self
    }
    self.or = (...args: unknown[]) => {
      appels.push({ table, op: 'or', args })
      if (table === 'reminders') filtreOr = args[0] as string
      return self
    }
    self.then = (resolve: (r: unknown) => void) => {
      if (table === erreurSur) return resolve({ data: null, error: { message: 'canceling statement due to statement timeout' } })
      let data = (rows[table] ?? []) as Array<Record<string, unknown>>
      if (filtresEmbed.length) {
        data = appliquerFiltresEmbed(data, filtresEmbed, (alias) => new RegExp(`${alias}:\\w+!inner\\(`).test(selectStr))
      }
      if (filtreOr) data = data.filter((ligne) => evalPostgrest(filtreOr as string, 'or', ligne))
      resolve({ data, error: null })
    }
    return self
  }
  // Lot D2 : `matching_actions_agence`, appelée par `rpc` ; ses lignes sous la clé `rpc:<nom>`.
  const rpc = (nom: string, args: unknown) => {
    appels.push({ table: `rpc:${nom}`, op: 'rpc', args: [args] })
    return {
      then: (resolve: (r: unknown) => void) => resolve(`rpc:${nom}` === erreurSur
        ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
        : { data: rows[`rpc:${nom}`] ?? [], error: null }),
    }
  }
  return { client: { from, rpc } as never, appels }
}

describe('loadAgencyData — les six sources du point du jour', () => {
  it('⛔ chaque lecture porte le filtre d’agence (service role : c’est la seule garde de tenant)', async () => {
    const { client, appels } = fauxClient({})
    await loadAgencyData(client, AGENCY, '2026-07-04T22:00:00.000Z', '2026-07-05T22:00:00.000Z', NOW)
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers']) {
      expect(appels, table).toContainEqual({ table, op: 'eq', args: ['agency_id', AGENCY] })
    }
    // Leads vendeurs : pool partagé, mais JAMAIS celui d'une autre agence.
    const or = appels.find((a) => a.table === 'seller_leads' && a.op === 'or')
    expect(or?.args[0]).toBe(`assigned_agency_id.eq.${AGENCY},assigned_agency_id.is.null`)
  })

  it('⛔ le contact EMBARQUÉ (relances, intéressés) est revérifié de la même agence — la RLS de `matches`/`reminders` ne borne que leur PROPRE agency_id, jamais celui du contact qu\'ils embarquent', async () => {
    const { client, appels } = fauxClient({})
    await loadAgencyData(client, AGENCY, '2026-07-04T22:00:00.000Z', '2026-07-05T22:00:00.000Z', NOW)
    for (const table of ['reminders', 'matches']) {
      expect(appels, table).toContainEqual({ table, op: 'eq', args: ['contact.agency_id', AGENCY] })
    }
  })

  it('met les lignes à plat : nom du contact, repli sur le nom du formulaire, bien, agent', async () => {
    const { client } = fauxClient({
      visits: [
        {
          scheduled_at: '2026-07-05T08:00:00Z', buyer_name: 'Formulaire', agent_id: 'p-1',
          contact: { first_name: 'Anne', last_name: 'Dubois' }, property: { title: 'Les Vergers', city: 'Meyrin' },
        },
        { scheduled_at: '2026-07-05T12:00:00Z', buyer_name: 'Paul Visiteur', agent_id: null, contact: null, property: null },
      ],
      calendar_events: [
        { type: 'notary', starts_at: '2026-07-05T12:00:00Z', all_day: false, status: null, recurrence: null, contact: { first_name: 'Anne', last_name: 'Dubois' } },
      ],
      reminders: [{ type: 'post_visit_feedback', trigger_at: '2026-07-05T07:00:00Z', contact: { first_name: 'Jean', last_name: null } }],
      crm_offers: [{ amount: 1450000, by_label: 'M. Keller', expires_at: '2026-07-06T10:00:00Z' }],
      seller_leads: [{ contact_name: 'Marie Curie', property_data: { city: 'Carouge' }, estimation_median: 1250000 }],
    })
    const d = await loadAgencyData(client, AGENCY, '2026-07-04T22:00:00.000Z', '2026-07-05T22:00:00.000Z', NOW)
    expect(d).toEqual({
      visits: [
        { scheduledAt: '2026-07-05T08:00:00Z', who: 'Anne Dubois', propertyTitle: 'Les Vergers', city: 'Meyrin', agentId: 'p-1' },
        { scheduledAt: '2026-07-05T12:00:00Z', who: 'Paul Visiteur', propertyTitle: null, city: null, agentId: null },
      ],
      events: [{ startsAt: '2026-07-05T12:00:00.000Z', allDay: false, type: 'notary', who: 'Anne Dubois' }],
      eventsAtLimit: false,
      reminders: [{ type: 'post_visit_feedback', who: 'Jean' }],
      remindersAtLimit: false,
      offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-06T10:00:00Z' }],
      sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
      // Lot D2 : aucune action de matching ce jour-là.
      matching: { actions: [], total: 0, interesses: [], interessesAtLimit: false },
    })
  })

  it('⛔ une seule lecture en échec rend null : une section vide en silence ferait croire la journée libre', async () => {
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers', 'seller_leads', 'matches']) {
      const { client } = fauxClient({ visits: [{ scheduled_at: 'x', buyer_name: null, agent_id: null, contact: null, property: null }] }, table)
      expect(await loadAgencyData(client, AGENCY, 'a', 'b', NOW), table).toBeNull()
    }
  })
})

describe('loadAgencyData — le matching du jour (lot D2)', () => {
  const START = '2026-07-04T22:00:00.000Z'
  const END = '2026-07-05T22:00:00.000Z'
  const ACTIONS = [
    { genre: 'retour', contact_id: 'c-julie', prenom: 'Julie', nom: 'Martin', statut: null, titre: null, ville: null, nombre: 2, nouveaux: null, baisses: null, montant: null, total: 3 },
    // La ligne « prix » porte un `match_id` : la copie du point du matin exige un match, comme « Aujourd'hui » (`versAction`).
    // `location: true` : cette annonce est une location — le montant doit ressortir marqué, jusqu'au bout de la lecture.
    { genre: 'prix', contact_id: 'c-antoine', prenom: 'Antoine', nom: 'Roux', match_id: 'm-antoine', statut: 'sent', titre: 'Attique', ville: 'Genève', nombre: null, nouveaux: null, baisses: null, montant: '900000', location: true, total: 3 },
    { genre: 'marche', contact_id: 'c-ana', prenom: 'Anastasia', nom: 'K', statut: null, titre: null, ville: null, nombre: 3, nouveaux: 0, baisses: 0, montant: null, total: 3 },
  ]

  it('lit les actions par la fonction d’agence, sur SON agence ; les intéressés, filtrés par agence', async () => {
    const { client, appels } = fauxClient({
      'rpc:matching_actions_agence': ACTIONS,
      matches: [{ contact: { first_name: 'Léa', last_name: 'Blanc' } }, { contact: { first_name: 'Léa', last_name: 'Blanc' } }],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(appels).toContainEqual({ table: 'rpc:matching_actions_agence', op: 'rpc', args: [{ p_agency: AGENCY, p_limite: 20 }] })
    expect(appels).toContainEqual({ table: 'matches', op: 'eq', args: ['agency_id', AGENCY] })
    expect(d!.matching.total).toBe(3)
    // Un marché sans nouveauté ni baisse n'a pas de raison d'être : écarté, comme dans « Aujourd'hui ».
    expect(d!.matching.actions.map((a) => a.genre)).toEqual(['retour', 'prix'])
    expect(d!.matching.actions[1]).toMatchObject({ who: 'Antoine', montant: 900000, statut: 'sent', titre: 'Attique', location: true })
    expect(d!.matching.interesses).toEqual(['Léa Blanc'])
  })

  it('⛔ une relance échue qui couvre un match EST un retour par définition (section 1) : exclue, celle de l’après-midi (pas encore due) et le retour de visite restent', async () => {
    const julie = { first_name: 'Julie', last_name: 'Martin' }
    const { client } = fauxClient({
      'rpc:matching_actions_agence': ACTIONS,
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-julie', match_id: 'm-julie', contact: julie },
        { type: 'follow_up_sent_property', trigger_at: '2026-07-05T15:00:00Z', contact_id: 'c-julie', match_id: 'm-julie', contact: julie },
        { type: 'post_visit_feedback', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-julie', contact: julie },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([
      { type: 'follow_up_sent_property', who: 'Julie Martin' },
      { type: 'post_visit_feedback', who: 'Julie Martin' },
    ])
    expect(d!.remindersAtLimit).toBe(false)
  })

  it('une relance qui ne couvre aucun match reste lue, même parmi 20 qui EN couvrent un — l’exclusion tient à la ligne elle-même, jamais à un rang (ce faux client n’applique ni `.order` ni `.limit` ; la vraie limite SQL est éprouvée par W6, tests/backend/matching-whatsapp.spec.ts)', async () => {
    const retours = Array.from({ length: 20 }, (_, i) => ({
      type: 'follow_up_sent_property', trigger_at: new Date(Date.parse('2026-06-01T00:00:00Z') + i * 3600_000).toISOString(),
      contact_id: `c-r${i}`, match_id: `m-r${i}`, contact: { first_name: `R${i}`, last_name: 'X' },
    }))
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        ...retours,
        { type: 'follow_up_sent_property', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-chaud', contact: { first_name: 'Marc', last_name: 'Roux' } },
        { type: 'post_visit_feedback', trigger_at: '2026-07-04T08:00:00Z', contact_id: 'c-visite', contact: { first_name: 'Léa', last_name: 'Blanc' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([
      { type: 'follow_up_sent_property', who: 'Marc Roux' },
      { type: 'post_visit_feedback', who: 'Léa Blanc' },
    ])
    expect(d!.remindersAtLimit).toBe(false)
  })

  it('une relance qui couvre un match reste exclue même si le RPC ne rend AUCUN retour pour son acheteur (coupé par sa propre limite, ou simplement absent) — l’exclusion ne lit que la relance elle-même, jamais `matching.actions`', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-01T08:00:00Z', contact_id: 'c-coupe', match_id: 'm-coupe', contact: { first_name: 'Paul', last_name: 'Keller' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([])
  })

  it('une relance échue « acheteur chaud », SANS match nommé, reste — elle ne couvre rien, ce n’est pas un retour', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-01T08:00:00Z', contact_id: 'c-chaud', contact: { first_name: 'Marc', last_name: 'Roux' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'follow_up_sent_property', who: 'Marc Roux' }])
  })

  it('⛔ `match_ids` VIDE (`{}`) ne couvre rien — comme la CTE de la migration (`any(\'{}\')` ne joint aucune ligne) : un `.is.null` seul l’aurait exclue à tort', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-01T08:00:00Z', contact_id: 'c-vide', match_ids: [], contact: { first_name: 'Nina', last_name: 'Roth' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'follow_up_sent_property', who: 'Nina Roth' }])
  })

  it('⛔ une relance multi-biens couvre par `match_ids` MÊME quand `match_id` (son meilleur match, `ON DELETE SET NULL`) est nul — le meilleur a pu être supprimé sans vider les autres', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [{
        type: 'follow_up_sent_property', trigger_at: '2026-07-01T08:00:00Z', contact_id: 'c-multi',
        match_id: null, match_ids: ['m-encore-la', 'm-aussi'], contact: { first_name: 'Omar', last_name: 'Nasri' },
      }],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([])
  })

  it('une relance SANS acheteur (`contact_id` nul) n’est pas un retour par définition — la CTE de la section 1 exige un acheteur : reste', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        { type: 'follow_up_sent_property', trigger_at: '2026-07-01T08:00:00Z', contact_id: null, match_id: 'm-orphelin', contact: null },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'follow_up_sent_property', who: null }])
  })

  it('une relance sans acheteur (une relance d’agence, « rappeler le notaire ») reste lue, `who: null` — l’embarquement du contact n’est pas `!inner`', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [{ type: 'custom', trigger_at: '2026-07-01T08:00:00Z', contact_id: null, contact: null }],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'custom', who: null }])
  })

  it('une relance dont le contact est d’une AUTRE agence reste lue, SANS nom — l’embarquement (pas `!inner`) le met à `null`, la ligne ne disparaît pas', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [{
        type: 'custom', trigger_at: '2026-07-01T08:00:00Z', contact_id: 'c-etranger',
        contact: { first_name: 'Foreign', last_name: 'Buyer', agency_id: 'a9999999-0000-4000-8000-000000000009' },
      }],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'custom', who: null }])
  })

  it('un intéressé dont le contact est d’une AUTRE agence n’apparaît pas — `matches` reste `!inner`, ce n’est pas un cas légitime comme une relance sans acheteur', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      matches: [
        { id: 'm-ok', contact_id: 'c-ok', contact: { first_name: 'Léa', last_name: 'Blanc', agency_id: AGENCY } },
        {
          id: 'm-etranger', contact_id: 'c-etranger',
          contact: { first_name: 'Foreign', last_name: 'Buyer', agency_id: 'a9999999-0000-4000-8000-000000000009' },
        },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.matching.interesses).toEqual(['Léa Blanc'])
  })

  // ⚠ Le test ci-dessus ne distingue PAS `!inner` d'un embarquement simple pour `matches` : `lireMatching` écarte
  // déjà tout intéressé dont le nom ne se résout pas (`contact: null`), que la ligne soit écartée EN AMONT (`!inner`)
  // ou gardée sans contact (embarquement simple) — le nom, lui, manque dans les deux cas. Ce que `!inner` change
  // vraiment ici est mesurable sur `interessesAtLimit` : SANS lui, une ligne étrangère PLEINE compterait quand même
  // dans la lecture brute, gonflant faussement le plafond sans jamais produire de nom.
  it('⛔ `interessesAtLimit` ne compte PAS un intéressé d’une autre agence — `!inner` l’écarte de la lecture brute elle-même, pas seulement du nom affiché', async () => {
    const legitimes = Array.from({ length: 19 }, (_, i) => ({
      id: `m-${i}`, contact_id: `c-${i}`, contact: { first_name: `P${i}`, last_name: 'X', agency_id: AGENCY },
    }))
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      // 19 légitimes + 1 étranger = 20 lignes BRUTES (la limite) : si `!inner` ne jouait pas son rôle, la lecture
      // brute vaudrait 20 et déclarerait le plafond atteint pour un décompte qui n'a que 19 vrais intéressés.
      matches: [
        ...legitimes,
        { id: 'm-etranger', contact_id: 'c-etranger', contact: { first_name: 'Foreign', last_name: 'Buyer', agency_id: 'a9999999-0000-4000-8000-000000000009' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.matching.interesses).toHaveLength(19)
    expect(d!.matching.interessesAtLimit).toBe(false)
  })

  it('une relance qui COUVRE un match mais n’est pas encore due reste — la clôture n’a pas encore pu jouer', async () => {
    const { client } = fauxClient({
      'rpc:matching_actions_agence': [],
      reminders: [
        // NOW = 05:30 ; celle-ci tombe à 18:00 le même jour : pas encore échue.
        { type: 'follow_up_sent_property', trigger_at: '2026-07-05T18:00:00Z', contact_id: 'c-tard', match_id: 'm-tard', contact: { first_name: 'Sara', last_name: 'Blum' } },
      ],
    })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toEqual([{ type: 'follow_up_sent_property', who: 'Sara Blum' }])
  })

  it('remindersAtLimit : vrai quand la lecture UTILE (après exclusion des retours) atteint la limite', async () => {
    const nonRetours = Array.from({ length: 20 }, (_, i) => ({
      type: 'post_visit_feedback', trigger_at: '2026-07-01T08:00:00Z', contact_id: `c-v${i}`, contact: { first_name: `V${i}`, last_name: 'X' },
    }))
    const { client } = fauxClient({ 'rpc:matching_actions_agence': [], reminders: nonRetours })
    const d = await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(d!.reminders).toHaveLength(20)
    expect(d!.remindersAtLimit).toBe(true)
  })

  it('la lecture des intéressés : select, agence du contact, statut, ordre (réponse puis id), limite', async () => {
    const { client, appels } = fauxClient({ 'rpc:matching_actions_agence': [] })
    await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(appels).toContainEqual({ table: 'matches', op: 'select', args: ['id, contact_id, contact:contacts!inner(first_name, last_name, agency_id)'] })
    expect(appels).toContainEqual({ table: 'matches', op: 'eq', args: ['status', 'interested'] })
    expect(appels).toContainEqual({ table: 'matches', op: 'order', args: ['response_at', { ascending: true, nullsFirst: false }] })
    expect(appels).toContainEqual({ table: 'matches', op: 'order', args: ['id', { ascending: true }] })
    expect(appels).toContainEqual({ table: 'matches', op: 'limit', args: [20] })
  })

  it('la lecture des relances : select (contact_id, sans `!inner`), la chaîne EXACTE du `.or`, son tri et sa limite — ce faux client n’appliquant ni schéma ni `.order`/`.limit`, seule une chaîne figée en prouve la syntaxe ici', async () => {
    const { client, appels } = fauxClient({ 'rpc:matching_actions_agence': [] })
    await loadAgencyData(client, AGENCY, START, END, NOW)
    expect(appels).toContainEqual({
      table: 'reminders', op: 'select',
      args: ['type, trigger_at, contact_id, contact:contacts(first_name, last_name, agency_id)'],
    })
    expect(appels).toContainEqual({
      table: 'reminders', op: 'or',
      args: [`type.neq.follow_up_sent_property,trigger_at.gt.${NOW.toISOString()},contact_id.is.null,and(or(match_ids.is.null,match_ids.eq.{}),match_id.is.null)`],
    })
    expect(appels).toContainEqual({ table: 'reminders', op: 'order', args: ['trigger_at', { ascending: true }] })
    expect(appels).toContainEqual({ table: 'reminders', op: 'limit', args: [20] })
  })

  it('une lecture du matching en échec : pas de brief — une section manquante en silence mentirait', async () => {
    const { client } = fauxClient({}, 'rpc:matching_actions_agence')
    expect(await loadAgencyData(client, AGENCY, START, END, NOW)).toBeNull()
  })
})

describe('lireMatching — les intéressés, dédoublonnés par CONTACT, jamais par le nom affiché', () => {
  it('deux acheteurs HOMONYMES restent deux lignes ; le même acheteur revu deux fois n’en fait qu’une', () => {
    const m = lireMatching([], [
      { contact_id: 'c-1', contact: { first_name: 'Marie', last_name: 'Dupont' } },
      { contact_id: 'c-2', contact: { first_name: 'Marie', last_name: 'Dupont' } }, // homonyme : un AUTRE contact
      { contact_id: 'c-1', contact: { first_name: 'Marie', last_name: 'Dupont' } }, // même contact, revu
    ])
    expect(m.interesses).toEqual(['Marie Dupont', 'Marie Dupont'])
  })
})

describe('lireMatching — le montant, comme `enNombre` du CRM', () => {
  const ligne = (montant: number | string | null) => ({
    genre: 'prix', contact_id: 'c', prenom: 'P', nom: 'N', match_id: 'm', property_id: null, market_listing_id: null,
    statut: 'sent', titre: null, ville: null, nombre: null, nouveaux: null, baisses: null, montant, total: 1,
  })

  // `1e400` littéral vaut déjà `Infinity` en JS (dépassement du double) : seule sa forme CHAÎNE (telle qu'un
  // `numeric` Postgres peut arriver côté client) exerce un chemin différent (`Number('1e400')`, pas un littéral).
  it.each([Infinity, 'Infinity', '1e400'])('montant non fini (%s) : écarté, comme `versAction`', (m) => {
    expect(lireMatching([ligne(m)], []).actions).toEqual([])
  })

  it('total : passé par `Number()`, comme `useMatchingDuJour.ts` du CRM sur la même colonne', () => {
    const m = lireMatching([{
      genre: 'retour', contact_id: 'c', prenom: null, nom: null, match_id: null, property_id: null, market_listing_id: null,
      statut: null, titre: null, ville: null, nombre: null, nouveaux: null, baisses: null, montant: null,
      total: '7' as unknown as number,
    }], [])
    expect(m.total).toBe(7)
  })
})

describe('lireMatching — la sortie porte les valeurs de LA LIGNE, pas des constantes', () => {
  it('nombre et ville : ceux de la ligne', () => {
    const m = lireMatching([{
      genre: 'mandat', contact_id: null, prenom: null, nom: null, match_id: null, property_id: 'p1', market_listing_id: null,
      statut: null, titre: 'Villa', ville: 'Cologny', nombre: 4, nouveaux: null, baisses: null, montant: null, total: 1,
    }], [])
    expect(m.actions[0]).toMatchObject({ nombre: 4, ville: 'Cologny' })
  })

  // Comme `versAction` (matchingDuJour.ts, `const location = l.location === true`) : SEUL `true` compte,
  // `null`/absent devient `false`, jamais un défaut « location » qui écrirait « / mois » sur une vente.
  it.each([[true, true], [false, false], [null, false]])('location : la ligne dit %s → %s', (brut, attendu) => {
    const m = lireMatching([{
      genre: 'prix', contact_id: 'c1', prenom: 'P', nom: null, match_id: 'm1', property_id: null, market_listing_id: null,
      statut: 'sent', titre: null, ville: null, nombre: null, nouveaux: null, baisses: null, montant: 100, location: brut, total: 1,
    }], [])
    expect(m.actions[0]!.location).toBe(attendu)
  })

  it('un montant non fini devient null quel que soit le genre — `enNombre` s’applique à TOUTE ligne, pas seulement à `prix`, la seule dont la garde d’entrée regarde le montant', () => {
    const m = lireMatching([{
      genre: 'retour', contact_id: 'c1', prenom: null, nom: null, match_id: null, property_id: null, market_listing_id: null,
      statut: null, titre: null, ville: null, nombre: 1, nouveaux: null, baisses: null, montant: Infinity, total: 1,
    }], [])
    expect(m.actions[0]!.montant).toBeNull()
  })

  it('interessesAtLimit : vrai PILE à la limite (20), pas seulement au-delà', () => {
    const pile = Array.from({ length: 20 }, (_, i) => ({ contact_id: `c${i}`, contact: { first_name: `P${i}`, last_name: 'X' } }))
    expect(lireMatching([], pile).interessesAtLimit).toBe(true)
    expect(lireMatching([], pile.slice(0, 19)).interessesAtLimit).toBe(false)
  })
})
