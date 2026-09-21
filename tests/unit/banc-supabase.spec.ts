/**
 * Garde-fou : l'interception PostgREST des bancs `/dev/*` rend la BONNE FORME.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `bancSupabase` décide entre « rendre la ligne » et « rendre le tableau » sur un
 * seul signal : l'en-tête `Accept: application/vnd.pgrst.object+json`, que
 * `postgrest-js` pose quand le hook appelle `.single()` / `.maybeSingle()`.
 *
 * ⛔ IL NE CONNAISSAIT QU'UNE NOTATION D'EN-TÊTE. Le code lisait
 * `init.headers.Accept ?? init.headers.accept` — ce qui ne fonctionne que si
 * `headers` est un OBJET NU. Or `supabase-js` passe une instance de `Headers`,
 * sur laquelle ces deux propriétés valent `undefined` : la valeur n'est
 * atteignable que par `.get('accept')`. Mesuré dans le navigateur, sur
 * `/dev/crm` : `typeDeHeaders: "Headers"`, `litParPointAccept: "(undefined)"`,
 * `litParGet: "application/vnd.pgrst.object+json"`.
 *
 * Conséquence : `objetSeul` était TOUJOURS faux, donc **tout** `.single()` de
 * **tous** les bancs recevait un TABLEAU là où le hook attend un objet — 35
 * appels dans 24 fichiers de hooks. Et l'échec est SILENCIEUX : aucune exception,
 * aucun type faux, la page se dessine avec ses champs à `undefined`. Sur la fiche
 * stricte du KYC, les cinq contrôles s'affichaient « Automatique — en attente »
 * sur un dossier dont le screening était fait — un écran cohérent en apparence et
 * faux en substance. C'est la forme n°14 de `megga/gardes-vacuites` (« ne connaît
 * qu'une notation ») appliquée non plus à une garde mais à un BANC : le mode
 * d'échec est le même — silencieux, et du bon côté du seuil.
 *
 * La garde exige donc les DEUX notations. Une seule aurait laissé passer celle
 * que le dépôt emploie réellement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { installerBanc, desinstallerBanc, reglerBanc } from '@/pages/dev/bancSupabase'

const BASE = SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')
const REST = `${BASE}/rest/v1/`

/** L'en-tête que `postgrest-js` pose sur `.single()`. */
const OBJET_SEUL = 'application/vnd.pgrst.object+json'

const LIGNES = [
  { id: 'a', nom: 'Alpha', statut: 'match' },
  { id: 'b', nom: 'Bravo', statut: 'clear' },
]

/**
 * Les deux façons dont un appelant peut porter ses en-têtes.
 *
 * ⚠ `Headers` d'abord : c'est celle que `supabase-js` emploie, donc la seule qui
 * décrive le dépôt. L'objet nu reste éprouvé parce qu'il est la notation que le
 * code connaissait — une garde qui l'abandonnerait rouvrirait l'autre moitié.
 */
const NOTATIONS: { nom: string; porter: (v: string) => HeadersInit }[] = [
  { nom: 'Headers (ce que supabase-js passe)', porter: (v) => new Headers({ Accept: v }) },
  { nom: 'objet nu', porter: (v) => ({ Accept: v }) },
  { nom: 'objet nu, clé minuscule', porter: (v) => ({ accept: v }) },
]

beforeAll(() => {
  installerBanc()
  reglerBanc({ etat: 'nominal', tables: { essais: LIGNES }, rpc: { une_rpc: LIGNES }, rpcVide: {}, session: null })
})
afterAll(() => { desinstallerBanc() })

async function lire(chemin: string, headers?: HeadersInit): Promise<unknown> {
  const r = await window.fetch(`${REST}${chemin}`, headers ? { headers } : undefined)
  return r.json()
}

describe('bancSupabase — la forme rendue suit l’en-tête Accept', () => {
  /**
   * ⛔ CONTRÔLE POSITIF, et il n'est pas décoratif : sans lui, une interception
   * qui ne répondrait RIEN (URL mal reconstruite, module non installé) laisserait
   * les assertions ci-dessous tomber sur `undefined` — et `undefined` n'est pas un
   * tableau, donc la clause « rend un objet » passerait au VERT sur un banc mort.
   */
  it('l’interception répond, et sur les bonnes lignes', async () => {
    const tout = await lire('essais?select=*')
    expect(Array.isArray(tout), 'le banc ne répond pas : URL REST ou installation cassée').toBe(true)
    expect(tout).toHaveLength(2)
    const filtre = await lire('essais?select=*&id=eq.a')
    expect(filtre, 'le prédicat n’est pas appliqué').toEqual([LIGNES[0]])
  })

  for (const { nom, porter } of NOTATIONS) {
    it(`.single() rend un OBJET — notation « ${nom} »`, async () => {
      const rendu = await lire('essais?select=*&id=eq.a', porter(OBJET_SEUL))
      expect(
        Array.isArray(rendu),
        `un TABLEAU est rendu là où .single() attend un objet — l'en-tête n'a pas été lu (${nom})`,
      ).toBe(false)
      expect(rendu).toEqual(LIGNES[0])
    })

    it(`une RPC .single() rend un OBJET — notation « ${nom} »`, async () => {
      const r = await window.fetch(`${REST}rpc/une_rpc`, { method: 'POST', body: '{}', headers: porter(OBJET_SEUL) })
      const rendu: unknown = await r.json()
      expect(Array.isArray(rendu), `RPC : tableau rendu au lieu d'un objet (${nom})`).toBe(false)
      expect(rendu).toEqual(LIGNES[0])
    })
  }

  /**
   * Le pendant : SANS l'en-tête, la forme doit rester un tableau. Sans cette
   * clause, « rendre toujours un objet » passerait les précédentes tout en
   * cassant les 100+ appels de liste.
   */
  it('sans l’en-tête, la forme reste un TABLEAU', async () => {
    expect(Array.isArray(await lire('essais?select=*&id=eq.a'))).toBe(true)
    expect(Array.isArray(await lire('essais?select=*', new Headers({ Accept: 'application/json' })))).toBe(true)
  })

  /**
   * ⛔ L'ÉTAT « VIDE » NE DOIT PAS VIDER LA SESSION — sinon il ne montre pas ce
   * qu'il annonce.
   *
   * Son libellé dit « chaque source rend zéro ligne — les états vides de chaque
   * surface ». Mesuré sur `/dev/crm` : en vidant AUSSI `profiles` et `agencies`,
   * il faisait tomber le KYC sur le mur d'identité (`useIdentityGate` →
   * `/dashboard/identite`), et l'écran montrait « Vérifiez l'identité de votre
   * agence » au lieu d'un seul état vide. Le troisième mur du banc se relève
   * quand on retire la donnée qui le tenait ouvert.
   *
   * L'identité de la session n'est pas de la donnée de DOMAINE : sans elle il n'y
   * a pas d'écran du tout, donc pas d'état vide à regarder. Ces tables-là
   * traversent l'état vide ; toutes les autres rendent bien zéro ligne.
   */
  it('l’état « Vide » garde le socle de session et ne vide que le domaine', async () => {
    reglerBanc({
      etat: 'vide',
      tables: { profiles: [{ id: 'p1' }], agencies: [{ id: 'a1' }], essais: LIGNES },
      socle: ['profiles', 'agencies'],
    })
    expect(await lire('profiles?select=*'), 'la session a été vidée : le mur se relève').toHaveLength(1)
    expect(await lire('agencies?select=*'), 'l’agence a été vidée : le gate LAB se relève').toHaveLength(1)
    expect(await lire('essais?select=*'), 'une table de DOMAINE doit bien rendre zéro ligne').toEqual([])
    // …et `.single()` sur le socle rend toujours l'objet, pas un tableau.
    const p = await lire('profiles?select=*&id=eq.p1', new Headers({ Accept: OBJET_SEUL }))
    expect(Array.isArray(p)).toBe(false)
    reglerBanc({ etat: 'nominal', tables: { essais: LIGNES }, socle: [] })
  })

  /**
   * Une table sans fixture rend `[]`, et `.single()` dessus rend `null` — jamais
   * `undefined`, que `JSON.stringify` transforme en corps illisible.
   */
  it('une table sans fixture rend une forme lisible dans les deux cas', async () => {
    expect(await lire('inconnue?select=*')).toEqual([])
    expect(await lire('inconnue?select=*', new Headers({ Accept: OBJET_SEUL }))).toBeNull()
  })
})

/**
 * Le journal d'audit se lit par PAGES (14.09.2026) : deux `.order()` à la suite et
 * `.range(a, b)`. Le banc lisait `order=created_at.desc,id.desc` comme une seule
 * colonne — sens `desc,id`, donc croissant — et ignorait `offset` : chaque page
 * rendait la première, et le bouton « Charger les plus anciens » aurait répété
 * l'historique au lieu de le prolonger.
 */
describe('bancSupabase — le tri sur plusieurs colonnes et les pages', () => {
  const JOURNAL = [
    { id: 'a', created_at: '2026-09-14T10:00:00Z' },
    { id: 'c', created_at: '2026-09-14T10:00:00Z' },
    { id: 'b', created_at: '2026-09-14T09:00:00Z' },
    { id: 'd', created_at: '2026-09-13T08:00:00Z' },
    { id: 'e', created_at: '2026-09-12T08:00:00Z' },
  ]
  beforeAll(() => { reglerBanc({ tables: { essais: LIGNES, journal: JOURNAL } }) })

  const ids = async (requete: string) => ((await lire(`journal?select=*&${requete}`)) as { id: string }[]).map((l) => l.id)

  it('deux colonnes : la date d’abord, l’id départage les ex æquo', async () => {
    expect(await ids('order=created_at.desc,id.desc')).toEqual(['c', 'a', 'b', 'd', 'e'])
    expect(await ids('order=created_at.desc,id.asc')).toEqual(['a', 'c', 'b', 'd', 'e'])
  })

  it('`offset` + `limit` (ce que `.range()` écrit) rendent la page demandée, sans recouvrement', async () => {
    const ordre = 'order=created_at.desc,id.desc'
    expect(await ids(`${ordre}&offset=0&limit=2`)).toEqual(['c', 'a'])
    expect(await ids(`${ordre}&offset=2&limit=2`)).toEqual(['b', 'd'])
    expect(await ids(`${ordre}&offset=4&limit=2`)).toEqual(['e'])
    expect(await ids(`${ordre}&offset=6&limit=2`)).toEqual([])
  })
})

/**
 * La sélection du marché (21.09.2026) se lit `order=score.desc,created_at.desc.nullslast,id.asc`. Le
 * banc comparait les scores comme des CHAÎNES : « 100 » < « 97 », et le seul bien à 100 d'une sélection
 * s'affichait après les 97 — un ordre que la production ne rend jamais.
 */
describe('bancSupabase — deux nombres se rangent comme des nombres', () => {
  const SCORES = [
    { id: 'm8', score: 97, created_at: '2026-09-13T00:00:00Z' },
    { id: 'm9', score: 100, created_at: '2026-09-11T00:00:00Z' },
    { id: 'm10', score: 90, created_at: null },
    { id: 'm11', score: 100, created_at: null },
  ]
  beforeAll(() => { reglerBanc({ etat: 'nominal', tables: { essais: LIGNES, scores: SCORES } }) })

  const ids = async (requete: string) => ((await lire(`scores?select=*&${requete}`)) as { id: string }[]).map((l) => l.id)

  it('100 avant 97, dans les deux sens', async () => {
    expect(await ids('order=score.desc')).toEqual(['m9', 'm11', 'm8', 'm10'])
    expect(await ids('order=score.asc')).toEqual(['m10', 'm8', 'm9', 'm11'])
  })

  it('une valeur absente suit `nullslast` / `nullsfirst`, quel que soit le sens', async () => {
    expect(await ids('order=score.desc,created_at.desc.nullslast,id.asc')).toEqual(['m9', 'm11', 'm8', 'm10'])
    expect(await ids('order=score.desc,created_at.desc.nullsfirst,id.asc')).toEqual(['m11', 'm9', 'm8', 'm10'])
    expect(await ids('order=created_at.asc.nullslast,id.asc')).toEqual(['m9', 'm8', 'm10', 'm11'])
  })

  /**
   * ⛔ Sur une colonne MIXTE, comparer deux nombres en nombres et le reste en chaînes formait un cycle :
   * 97 < 100, 100 < '50' (« 100 » < « 50 »), '50' < 97. `sort` rendait alors un ordre qui dépendait de
   * l'ordre d'ENTRÉE. D'où deux entrées permutées, qui doivent rendre la même chose : l'absent, les
   * nombres, puis les chaînes.
   */
  it('une colonne mixte se range de la même façon quel que soit l’ordre d’entrée', async () => {
    const x1 = { id: 'x1', v: 100 }, x2 = { id: 'x2', v: '50' }, x3 = { id: 'x3', v: 97 }
    const x4 = { id: 'x4', v: null }, x5 = { id: 'x5', v: 'abc' }
    for (const entree of [[x1, x2, x3, x4, x5], [x5, x4, x3, x2, x1], [x2, x4, x1, x5, x3], [x3, x2, x1, x5, x4]]) {
      reglerBanc({ tables: { essais: LIGNES, mixte: entree } })
      const lus = async (ordre: string) => ((await lire(`mixte?select=*&order=${ordre}`)) as { id: string }[]).map((l) => l.id)
      expect(await lus('v.asc')).toEqual(['x4', 'x3', 'x1', 'x2', 'x5'])
      expect(await lus('v.desc')).toEqual(['x5', 'x2', 'x1', 'x3', 'x4'])
    }
  })
})

describe('bancSupabase — une écriture suivie de `.single()`', () => {
  /**
   * ⛔ `postgrest-js` pose le même `Accept` sur `.insert(…).select().single()` que sur une lecture.
   * Le banc rendait un TABLEAU après toute écriture : `created.id` valait `undefined` et le deal
   * créé par « Proposer » n'avait pas d'identifiant, sans rien dans la console.
   */
  it('POST rend un OBJET quand l’en-tête le demande, un tableau sinon', async () => {
    reglerBanc({ etat: 'nominal', tables: { essais: [...LIGNES] }, ecrivables: ['essais'] })
    const objet = await window.fetch(`${REST}essais?select=id`, {
      method: 'POST', headers: new Headers({ Accept: OBJET_SEUL }), body: JSON.stringify({ nom: 'Charlie' }),
    }).then((r) => r.json()) as Record<string, unknown>
    expect(Array.isArray(objet)).toBe(false)
    expect(objet).toMatchObject({ nom: 'Charlie' })

    const tableau = await window.fetch(`${REST}essais`, { method: 'POST', body: JSON.stringify({ nom: 'Delta' }) }).then((r) => r.json())
    expect(Array.isArray(tableau)).toBe(true)
    reglerBanc({ tables: { essais: LIGNES }, ecrivables: [] })
  })
})
