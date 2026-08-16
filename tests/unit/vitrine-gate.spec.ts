/**
 * Garde-fou : la POLARITÉ du gate de la vitrine, et sa cascade de réglages.
 *
 * Pourquoi un test. Depuis le 16 août 2026, le mot de passe de megga.ch ne se
 * règle plus dans le code : il vient d'un KV (`VITRINE_CONFIG`, clé `gate`) ou,
 * à défaut, d'une variable d'environnement — deux plans de contrôle vivant dans
 * un tableau de bord que rien ici ne peut relire. Le seul endroit où la règle
 * reste vérifiable est ce fichier.
 *
 * Ce qui est gardé, et qui n'est pas symétrique : `off` OUVRE, et RIEN d'autre
 * n'ouvre. Écrite dans l'autre sens (« `on` ferme »), la même liste d'accidents
 * — clé jamais écrite, variable absente sur une préversion, valeur vide, faute
 * de frappe, KV en panne — publierait la vitrine de pré-lancement au lieu de la
 * fermer. C'est cette asymétrie que le test fige : les cas qui ferment y sont
 * plus nombreux que les cas qui ouvrent, exprès.
 *
 * Le gate est éprouvé à travers le vrai `fetch`, pas seulement `gateActif` : le
 * risque n'est pas la fonction, c'est son CÂBLAGE — un gate correct mais non
 * appelé rendrait 200 partout sans faire rougir un test de la seule fonction.
 */
import { describe, it, expect, vi } from 'vitest'
// @ts-expect-error -- worker Cloudflare en JS pur, sans déclaration de types
import * as worker from '../../sites/megga-vitrine/_worker.js'

type KV = { get: (cle: string, options?: unknown) => Promise<string | null> }
type Env = { VITRINE_GATE?: unknown; VITRINE_CONFIG?: unknown; ASSETS: { fetch: (r: Request) => Response } }

const { gateActif, default: handler } = worker as {
  gateActif: (env: unknown) => Promise<boolean>
  default: { fetch: (request: Request, env: Env) => Promise<Response> }
}

/** `env.ASSETS` sert le fichier statique : atteindre ce 200 prouve que le gate a laissé passer. */
const ASSETS = { fetch: () => new Response('ASSET', { status: 200 }) }

/** KV de test : rend toujours `valeur`, et enregistre comment il a été appelé. */
const kv = (valeur: string | null): KV & { get: ReturnType<typeof vi.fn> } => ({
  get: vi.fn(async () => valeur),
})

const kvEnPanne = (): KV => ({
  get: async () => {
    throw new Error('KV indisponible')
  },
})

const appeler = (path: string, env: Partial<Env> = {}) =>
  handler.fetch(new Request('https://megga.ch' + path), { ...env, ASSETS } as Env)

/** Une page de contenu, donc gatée : ni page d'auth, ni page légale, ni ressource. */
const PAGE_GATEE = '/pricing'

describe('gate de la vitrine — seule la valeur `off` ouvre', () => {
  it('ouvre sur `off`', async () => {
    const r = await appeler(PAGE_GATEE, { VITRINE_GATE: 'off' })
    expect(r.status).toBe(200)
    expect(r.headers.get('WWW-Authenticate')).toBeNull()
  })

  it.each(['OFF', 'Off', ' off ', '\toff\n'])('ouvre sur %o (casse et espaces normalisés)', async (valeur) => {
    expect((await appeler(PAGE_GATEE, { VITRINE_GATE: valeur })).status).toBe(200)
  })

  // Le cœur du test : tout ce qui n'est pas `off` doit FERMER.
  it.each([
    ['variable absente', undefined],
    ['valeur vide', ''],
    ['espaces seuls', '   '],
    ['faute de frappe', 'of'],
    ['mot voisin', 'offline'],
    ['booléen en texte', 'false'],
    ['valeur opposée', 'on'],
    ['zéro', '0'],
    ['null', null],
    ['booléen', false],
  ])('ferme quand %s', async (_cas, valeur) => {
    const r = await appeler(PAGE_GATEE, { VITRINE_GATE: valeur })
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toContain('Basic realm=')
  })

  it('ferme quand `env` lui-même manque', async () => {
    expect(await gateActif(undefined)).toBe(true)
    expect(await gateActif({})).toBe(true)
  })
})

describe('gate de la vitrine — le KV est la bascule vive, et il prime', () => {
  it('ouvre sur `off` dans le KV, même si la variable dit le contraire', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv('off'), VITRINE_GATE: 'on' })).status).toBe(200)
  })

  it.each(['on', '', 'of', 'true'])(
    'ferme sur %o dans le KV, même si la variable dit `off`',
    async (valeur) => {
      expect(
        (await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv(valeur), VITRINE_GATE: 'off' })).status
      ).toBe(401)
    }
  )

  // Clé pas encore écrite : c'est l'état juste après la création du namespace.
  // Il ne doit RIEN changer — sinon brancher le KV refermerait un site ouvert.
  it('descend à la variable quand la clé est absente du KV', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv(null), VITRINE_GATE: 'off' })).status).toBe(200)
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv(null) })).status).toBe(401)
  })

  // ⛔ L'invariant qui coûterait le plus cher à perdre : une panne n'est pas une
  // absence d'avis. Elle ferme, et elle ne descend PAS à la variable.
  it('ferme quand la lecture KV échoue, même si la variable dit `off`', async () => {
    expect(
      (await appeler(PAGE_GATEE, { VITRINE_CONFIG: kvEnPanne(), VITRINE_GATE: 'off' })).status
    ).toBe(401)
  })

  it('ignore un binding qui n’est pas un KV et retombe sur la variable', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: {}, VITRINE_GATE: 'off' })).status).toBe(200)
  })

  // Le nom de la clé et le cacheTtl ne sont pas décoratifs : une clé mal
  // nommée retomberait SILENCIEUSEMENT sur la variable, et la bascule vive
  // n'existerait plus sans que rien ne le signale.
  it('lit la clé `gate` avec un cacheTtl de 60 s', async () => {
    const espion = kv('off')
    await appeler(PAGE_GATEE, { VITRINE_CONFIG: espion })
    expect(espion.get).toHaveBeenCalledWith('gate', { cacheTtl: 60 })
  })

  it('ne lit pas le KV pour un chemin public', async () => {
    const espion = kv('off')
    await appeler('/login', { VITRINE_CONFIG: espion })
    await appeler('/css/styles.css', { VITRINE_CONFIG: espion })
    expect(espion.get).not.toHaveBeenCalled()
  })
})

describe('gate de la vitrine — ce que le drapeau ne doit PAS changer', () => {
  it.each([
    ['pages d’auth', '/login'],
    ['pages légales', '/privacy'],
    ['sitemap', '/sitemap.xml'],
    ['ressources', '/css/styles.css'],
  ])('laisse passer les %s même gate fermé', async (_cas, path) => {
    expect((await appeler(path)).status).toBe(200)
  })

  it('répond à /api/geo gate fermé (sinon le CRM ne détecte plus la langue)', async () => {
    expect((await appeler('/api/geo')).status).toBe(200)
  })

  it.each([
    ['gate fermé', {}],
    ['gate ouvert par variable', { VITRINE_GATE: 'off' }],
    ['gate ouvert par KV', { VITRINE_CONFIG: kv('off') }],
  ])('redirige les anciennes URLs — %s', async (_cas, env) => {
    const r = await appeler('/tarifs', env)
    expect(r.status).toBe(301)
    expect(r.headers.get('Location')).toBe('/pricing')
  })

  it('ne laisse pas un préfixe ouvert servir de tunnel vers une page gatée', async () => {
    expect((await appeler('/css/%2e%2e/pricing')).status).toBe(401)
  })
})
