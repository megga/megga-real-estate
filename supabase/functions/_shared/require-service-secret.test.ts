/**
 * `isServiceSecret` — la garde partagée des fonctions cron / service-à-service.
 *
 * CE QUE CES TESTS VERROUILLENT. Ce projet fait circuler DEUX secrets de service
 * distincts : `app_config.service_role_key` (que pg_cron rejoue en Bearer) et
 * `SUPABASE_SERVICE_ROLE_KEY` (que les edge functions s'envoient entre elles).
 * Ils coïncident aujourd'hui, mais rien ne le garantit : le jour où l'un tourne
 * sans l'autre, une garde qui n'en reconnaît qu'un cesse d'authentifier la moitié
 * de ses appelants — en silence, sous forme de tâches muettes.
 * Constat : docs/audits/2026-08-04-blast-radius-service-role.md §4.3.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const ENV_SECRET = 'env-service-role-key-0123456789'
const CONFIG_SECRET = 'sb_secret_app_config_value_98765'

// `Deno.env` est lu par le module ; en Node/Vitest on l'injecte via un shim,
// même motif que magic-link-token.test.ts.
const originalDeno = (globalThis as Record<string, unknown>).Deno
beforeEach(() => {
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => (k === 'SUPABASE_SERVICE_ROLE_KEY' ? ENV_SECRET : undefined) },
  }
})
afterEach(() => {
  ;(globalThis as Record<string, unknown>).Deno = originalDeno
})

/** Client minimal : ne sait répondre qu'à la lecture d'`app_config`. */
function fakeAdmin(configValue: string | null) {
  return {
    from(table: string) {
      if (table !== 'app_config') throw new Error(`table inattendue : ${table}`)
      return {
        select: () => ({
          eq: (_col: string, key: string) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: key === 'service_role_key' && configValue !== null ? { value: configValue } : null,
                error: null,
              }),
          }),
        }),
      }
    },
  }
}

function reqWith(bearer: string | null): Request {
  return new Request('https://example.test/', {
    method: 'POST',
    headers: bearer === null ? {} : { Authorization: `Bearer ${bearer}` },
  })
}

// Import après le shim : le module lit Deno.env à l'appel, pas au chargement,
// mais on garde l'ordre explicite pour ne pas dépendre de ce détail.
const { isServiceSecret, safeEqual } = await import('./require-service-secret.ts')

describe('isServiceSecret — les DEUX secrets de service sont acceptés', () => {
  it("accepte le secret d'app_config (ce que rejoue pg_cron)", async () => {
    const ok = await isServiceSecret(fakeAdmin(CONFIG_SECRET) as never, reqWith(CONFIG_SECRET))
    expect(ok).toBe(true)
  })

  it("accepte le secret de l'env (ce que s'envoient les edge functions)", async () => {
    const ok = await isServiceSecret(fakeAdmin(CONFIG_SECRET) as never, reqWith(ENV_SECRET))
    expect(ok).toBe(true)
  })

  it("accepte encore l'env quand app_config est vide — la garde ne dépend pas de la table", async () => {
    const ok = await isServiceSecret(fakeAdmin(null) as never, reqWith(ENV_SECRET))
    expect(ok).toBe(true)
  })
})

describe('isServiceSecret — refus', () => {
  it.each([
    ['un secret inconnu', 'pas-le-bon-secret-du-tout-00000'],
    ['une chaîne vide', ''],
    ['un préfixe du bon secret', ENV_SECRET.slice(0, 10)],
    ['le bon secret avec un caractère en plus', `${ENV_SECRET}x`],
  ])('refuse %s', async (_label, bearer) => {
    expect(await isServiceSecret(fakeAdmin(CONFIG_SECRET) as never, reqWith(bearer))).toBe(false)
  })

  it("refuse une requête sans en-tête Authorization", async () => {
    expect(await isServiceSecret(fakeAdmin(CONFIG_SECRET) as never, reqWith(null))).toBe(false)
  })

  it('refuse tout quand aucune source ne porte de secret', async () => {
    ;(globalThis as unknown as { Deno: { env: { get: () => undefined } } }).Deno = {
      env: { get: () => undefined },
    }
    expect(await isServiceSecret(fakeAdmin(null) as never, reqWith('n-importe-quoi'))).toBe(false)
  })
})

describe('safeEqual — comparaison à temps constant', () => {
  it('vrai seulement pour deux chaînes identiques', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
  })

  it('faux dès que les longueurs diffèrent, sans lever', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', 'a')).toBe(false)
  })

  it('ne court-circuite pas au premier caractère différent (toute la chaîne est parcourue)', () => {
    // Deux paires de même longueur, l'une divergeant au 1er caractère, l'autre au
    // dernier : les deux doivent rendre false. C'est la propriété observable d'un
    // XOR accumulé — un `!==` naïf la satisferait aussi, mais l'inverse (un
    // court-circuit) la casserait dès qu'on remplacerait la boucle par un `some`.
    expect(safeEqual('Xbcdef', 'abcdef')).toBe(false)
    expect(safeEqual('abcdeX', 'abcdef')).toBe(false)
  })
})
