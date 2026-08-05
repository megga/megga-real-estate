/**
 * Garde-fou : la délégation Workspace demande bien ce qu'il faut, et un agenda MEGGA
 * injoignable ne se déguise JAMAIS en agenda libre.
 *
 * POURQUOI CES DEUX PROPRIÉTÉS-LÀ. Le montage « compte de service + délégation à
 * l'échelle du domaine » tient à trois champs de l'assertion JWT, et se trompe en
 * silence si l'un manque :
 *   - `sub` porte la boîte à incarner. Sans lui, Google délivre un jeton parfaitement
 *     valide pour le compte de service LUI-MÊME, dont l'agenda est vide et que personne
 *     ne regarde. Le rendez-vous serait « créé », l'appel rendrait 200, et l'équipe ne
 *     verrait jamais rien arriver.
 *   - `scope` est comparé LITTÉRALEMENT à ce qui a été autorisé dans la console
 *     Workspace. Une portée qui dérive d'un caractère fait échouer l'échange en
 *     `unauthorized_client`, sans dire laquelle manque.
 *   - `aud` doit être l'URL du point d'échange, sinon Google refuse l'assertion.
 *
 * La seconde propriété est la plus coûteuse à rater : si une boîte déclarée mais
 * inaccessible se lisait comme « aucune occupation », le moteur de créneaux ouvrirait
 * TOUTES les heures ouvrables à la réservation. On préfère mille fois une journée qui
 * paraît pleine à un double booking chez l'hôte — c'est la règle que `degraded` encode,
 * et ce test la cloue.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import {
  WORKSPACE_SCOPE,
  workspaceAccessToken,
  workspaceClientEmail,
  workspaceConfigured,
} from '../../supabase/functions/_shared/google-workspace'
import { readHostBusy } from '../../supabase/functions/_shared/host-freebusy'

const CLIENT_EMAIL = 'megga-rdv@megga-platform.iam.gserviceaccount.com'

/** Clé RSA réelle : `importKey` refuse tout ce qui n'est pas un PKCS#8 valide. */
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

function serviceAccountJson(): string {
  return JSON.stringify({
    type: 'service_account',
    client_email: CLIENT_EMAIL,
    private_key: privateKey,
  })
}

/** `google-workspace.ts` lit `Deno.env` DANS la fonction : rejouable d'un test à l'autre. */
function poserEnv(valeurs: Record<string, string> = {}): void {
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => valeurs[k] },
  }
}

/** Décode un segment base64url d'un JWT. */
function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
}

const vraiFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = vraiFetch
})

describe('assertion de délégation', () => {
  /** Dernière assertion envoyée à Google, capturée sans laisser sortir la requête. */
  let assertionEnvoyee: string | null

  beforeEach(() => {
    assertionEnvoyee = null
    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: serviceAccountJson() })
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body ?? ''))
      assertionEnvoyee = params.get('assertion')
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'jeton-test', expires_in: 3600 }),
      }
    }) as unknown as typeof fetch
  })

  it('porte la boîte à incarner dans `sub` — sans quoi le rendez-vous atterrit dans le vide', async () => {
    // Une adresse par test : le module met les jetons en cache par boîte.
    const { token } = await workspaceAccessToken('rendez-vous@megga.ch')
    expect(token).toBe('jeton-test')

    const claims = decodeSegment(assertionEnvoyee!.split('.')[1])
    expect(claims.sub).toBe('rendez-vous@megga.ch')
    expect(claims.iss).toBe(CLIENT_EMAIL)
  })

  it('demande EXACTEMENT la portée autorisée dans la console Workspace', async () => {
    await workspaceAccessToken('portee@megga.ch')
    const claims = decodeSegment(assertionEnvoyee!.split('.')[1])
    expect(claims.scope).toBe(WORKSPACE_SCOPE)
    expect(WORKSPACE_SCOPE).toBe('https://www.googleapis.com/auth/calendar')
  })

  it("vise le point d'échange comme audience, et signe en RS256", async () => {
    await workspaceAccessToken('audience@megga.ch')
    const [entete, charge] = assertionEnvoyee!.split('.')
    expect(decodeSegment(entete)).toMatchObject({ alg: 'RS256', typ: 'JWT' })
    expect(decodeSegment(charge).aud).toBe('https://oauth2.googleapis.com/token')
  })

  it('normalise la casse de la boîte — une majuscule ne doit pas créer un second jeton', async () => {
    await workspaceAccessToken('  Casse@Megga.CH  ')
    expect(decodeSegment(assertionEnvoyee!.split('.')[1]).sub).toBe('casse@megga.ch')
  })
})

describe('lecture de la clé', () => {
  it('accepte le JSON brut ET sa version base64 — un secret recollé perd ses sauts de ligne', () => {
    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: serviceAccountJson() })
    expect(workspaceConfigured()).toBe(true)
    expect(workspaceClientEmail()).toBe(CLIENT_EMAIL)

    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: Buffer.from(serviceAccountJson()).toString('base64') })
    expect(workspaceConfigured()).toBe(true)
    expect(workspaceClientEmail()).toBe(CLIENT_EMAIL)
  })

  it('répare un `\\n` échappé dans la clé privée — sinon le PEM est refusé au signage', async () => {
    poserEnv({
      GOOGLE_WORKSPACE_SA_KEY: JSON.stringify({
        client_email: CLIENT_EMAIL,
        private_key: privateKey.replace(/\n/g, '\\n'),
      }),
    })
    let capturee: string | null = null
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      capturee = new URLSearchParams(String(init?.body ?? '')).get('assertion')
      return { ok: true, status: 200, json: async () => ({ access_token: 'ok', expires_in: 3600 }) }
    }) as unknown as typeof fetch

    // La preuve que le PEM a été réparé : la signature a pu être calculée.
    const { token } = await workspaceAccessToken('echappe@megga.ch')
    expect(token).toBe('ok')
    expect(capturee).not.toBeNull()
  })

  it('refuse ce qui n’est pas une clé exploitable, sans lever', async () => {
    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: 'pas du json' })
    expect(workspaceConfigured()).toBe(false)
    expect(await workspaceAccessToken('x@megga.ch')).toEqual({ token: null, reason: 'not_configured' })

    poserEnv({})
    expect(workspaceConfigured()).toBe(false)
    expect(workspaceClientEmail()).toBeNull()

    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: serviceAccountJson() })
    expect(await workspaceAccessToken('   ')).toEqual({ token: null, reason: 'no_subject' })
  })
})

describe('un agenda MEGGA illisible ne passe pas pour un agenda libre', () => {
  /** Client Supabase qui refuse d'être touché : la voie Workspace ne doit rien lui demander. */
  const dbInterdit = {
    from() {
      throw new Error('la voie Workspace ne doit PAS retomber sur les jetons personnels')
    },
  }

  it('rend `degraded` quand le secret manque, et ne retombe pas sur l’agenda personnel', async () => {
    poserEnv({})
    const resultat = await readHostBusy(
      dbInterdit as never,
      { profileId: 'un-profil-avec-google-connecte', calendarEmail: 'rendez-vous@megga.ch' },
      'Europe/Zurich',
      Date.UTC(2026, 7, 10),
      Date.UTC(2026, 7, 11),
    )

    // `degraded` écarte l'hôte du calcul : aucune heure n'est proposée, plutôt que
    // toutes. C'est l'inverse exact du comportement dangereux.
    expect(resultat).toEqual({ provider: 'workspace', busy: [], degraded: true })
  })

  it('traite un agenda en erreur comme illisible, pas comme vide', async () => {
    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: serviceAccountJson() })
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('oauth2.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'j', expires_in: 3600 }) }
      }
      // Forme réelle d'un refus `freeBusy` : 200, `busy` vide, et l'erreur À CÔTÉ.
      // Lire `busy` sans regarder `errors` conclurait « libre toute la journée ».
      return {
        ok: true,
        status: 200,
        json: async () => ({
          calendars: { 'erreur@megga.ch': { busy: [], errors: [{ reason: 'notFound' }] } },
        }),
      }
    }) as unknown as typeof fetch

    const resultat = await readHostBusy(
      dbInterdit as never,
      { profileId: null, calendarEmail: 'erreur@megga.ch' },
      'Europe/Zurich',
      Date.UTC(2026, 7, 10),
      Date.UTC(2026, 7, 11),
    )
    expect(resultat.degraded).toBe(true)
    expect(resultat.busy).toEqual([])
  })

  it('lit les occupations quand tout va bien', async () => {
    poserEnv({ GOOGLE_WORKSPACE_SA_KEY: serviceAccountJson() })
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('oauth2.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'j', expires_in: 3600 }) }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          calendars: {
            'ok@megga.ch': {
              busy: [{ start: '2026-08-10T08:00:00Z', end: '2026-08-10T09:00:00Z' }],
            },
          },
        }),
      }
    }) as unknown as typeof fetch

    const resultat = await readHostBusy(
      dbInterdit as never,
      { profileId: null, calendarEmail: 'ok@megga.ch' },
      'Europe/Zurich',
      Date.UTC(2026, 7, 10),
      Date.UTC(2026, 7, 11),
    )
    expect(resultat.degraded).toBe(false)
    expect(resultat.busy).toEqual([
      { startMs: Date.parse('2026-08-10T08:00:00Z'), endMs: Date.parse('2026-08-10T09:00:00Z') },
    ])
  })
})
