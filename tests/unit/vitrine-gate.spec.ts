/**
 * Garde-fou : la cascade de réglages du gate de la vitrine, et son DÉFAUT.
 *
 * Pourquoi un test. Le mot de passe de megga.ch ne se règle plus dans le code :
 * il vient d'un KV (`VITRINE_CONFIG`, clé `gate`) ou, à défaut, d'une variable
 * d'environnement — deux plans de contrôle vivant dans un tableau de bord que
 * rien ici ne peut relire. Le seul endroit où la règle reste vérifiable est ce
 * fichier.
 *
 * ⚠ LE DÉFAUT A BASCULÉ DEUX FOIS EN DEUX JOURS — fermé, puis ouvert le 16 août
 * 2026 (#1240), puis refermé le 17 (#1250). Il vaut `on` aujourd'hui, mais ce
 * n'est pas sur quoi ce fichier s'appuie : **toute assertion demande son état
 * explicitement**, `FERMÉ` ou `OUVERT`. Ne rien passer n'éprouverait que le
 * défaut du moment, et la moitié du fichier passerait au vert pour la mauvaise
 * raison à la bascule suivante — laquelle, on le sait maintenant, arrive.
 *
 * Un seul test lit le défaut sans le demander, et c'est son objet : il dit à
 * voix haute ce que vaut la production quand aucun réglage n'est posé.
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

/** Les deux réglages explicites. À passer partout où l'assertion porte sur un état donné. */
const FERMÉ = { VITRINE_GATE: 'on' }
const OUVERT = { VITRINE_GATE: 'off' }

const appeler = (path: string, env: Partial<Env> = {}) =>
  handler.fetch(new Request('https://megga.ch' + path), { ...env, ASSETS } as Env)

/** Une page de contenu, donc gatée : ni page d'auth, ni page légale, ni ressource. */
const PAGE_GATEE = '/pricing'

describe('gate de la vitrine — le défaut, quand aucun réglage ne répond', () => {
  // ⚠ C'est l'état de la production : ni binding KV, ni variable. Ce test dit
  // à voix haute ce que vaut le site sans réglage — si quelqu'un s'interroge,
  // c'est ici qu'il faut le lire, pas dans un tableau de bord.
  it('FERME la vitrine sans aucun réglage', async () => {
    const r = await appeler(PAGE_GATEE)
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toContain('Basic realm=')
  })

  it('ferme aussi quand `env` lui-même manque', async () => {
    expect(await gateActif(undefined)).toBe(true)
    expect(await gateActif({})).toBe(true)
  })

  it('se laisse ouvrir par la variable, sans toucher au code', async () => {
    expect((await appeler(PAGE_GATEE, OUVERT)).status).toBe(200)
  })
})

describe('gate de la vitrine — seule la valeur `off` ouvre', () => {
  it.each(['off', 'OFF', 'Off', ' off ', '\toff\n'])('ouvre sur %o', async (valeur) => {
    expect((await appeler(PAGE_GATEE, { VITRINE_GATE: valeur })).status).toBe(200)
  })

  // Une valeur POSÉE mais illisible ferme : on n'ouvre pas sur un doute.
  it.each([
    ['valeur vide', ''],
    ['espaces seuls', '   '],
    ['faute de frappe', 'of'],
    ['mot voisin', 'offline'],
    ['booléen en texte', 'false'],
    ['valeur opposée', 'on'],
    ['zéro', '0'],
    ['booléen', false],
  ])('ferme sur %s', async (_cas, valeur) => {
    const r = await appeler(PAGE_GATEE, { VITRINE_GATE: valeur })
    expect(r.status).toBe(401)
    expect(r.headers.get('WWW-Authenticate')).toContain('Basic realm=')
  })
})

describe('gate de la vitrine — le KV est la bascule vive, et il prime', () => {
  it('ouvre sur `off` dans le KV, même si la variable ferme', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv('off'), ...FERMÉ })).status).toBe(200)
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
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv(null), ...FERMÉ })).status).toBe(401)
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kv(null), ...OUVERT })).status).toBe(200)
  })

  // ⛔ L'invariant qui coûterait le plus cher à perdre : une panne n'est pas une
  // absence d'avis. Elle ferme, et elle ne descend PAS au repli — y compris
  // quand le repli, aujourd'hui, ouvrirait.
  it('ferme quand la lecture KV échoue, même si la variable dit `off`', async () => {
    expect(
      (await appeler(PAGE_GATEE, { VITRINE_CONFIG: kvEnPanne(), VITRINE_GATE: 'off' })).status
    ).toBe(401)
  })

  it('ferme quand la lecture KV échoue et qu’aucune variable ne répond', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: kvEnPanne() })).status).toBe(401)
  })

  it('ignore un binding qui n’est pas un KV et retombe sur la variable', async () => {
    expect((await appeler(PAGE_GATEE, { VITRINE_CONFIG: {}, ...FERMÉ })).status).toBe(401)
  })

  // Le nom de la clé et le cacheTtl ne sont pas décoratifs : une clé mal
  // nommée retomberait SILENCIEUSEMENT sur le repli, et la bascule vive
  // n'existerait plus sans que rien ne le signale.
  it('lit la clé `gate` avec un cacheTtl de 60 s', async () => {
    const espion = kv('off')
    await appeler(PAGE_GATEE, { VITRINE_CONFIG: espion, ...FERMÉ })
    expect(espion.get).toHaveBeenCalledWith('gate', { cacheTtl: 60 })
  })

  it('ne lit pas le KV pour un chemin public', async () => {
    const espion = kv('off')
    await appeler('/login', { VITRINE_CONFIG: espion, ...FERMÉ })
    await appeler('/css/styles.css', { VITRINE_CONFIG: espion, ...FERMÉ })
    expect(espion.get).not.toHaveBeenCalled()
  })
})

describe('gate de la vitrine — ce que le réglage ne doit PAS changer', () => {
  it.each([
    ['pages d’auth', '/login'],
    ['pages légales', '/privacy'],
    ['sitemap', '/sitemap.xml'],
    ['ressources', '/css/styles.css'],
  ])('laisse passer les %s gate FERMÉ', async (_cas, path) => {
    expect((await appeler(path, FERMÉ)).status).toBe(200)
  })

  it('répond à /api/geo gate FERMÉ (sinon le CRM ne détecte plus la langue)', async () => {
    expect((await appeler('/api/geo', FERMÉ)).status).toBe(200)
  })

  it.each([
    ['gate fermé', FERMÉ],
    ['gate ouvert par la variable', OUVERT],
    ['gate ouvert par KV', { VITRINE_CONFIG: kv('off') }],
  ])('redirige les anciennes URLs — %s', async (_cas, env) => {
    const r = await appeler('/tarifs', env)
    expect(r.status).toBe(301)
    expect(r.headers.get('Location')).toBe('/pricing')
  })

  it('ne laisse pas un préfixe ouvert servir de tunnel vers une page gatée', async () => {
    expect((await appeler('/css/%2e%2e/pricing', FERMÉ)).status).toBe(401)
  })
})
