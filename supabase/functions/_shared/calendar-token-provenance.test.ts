/**
 * Provenance des jetons d'agenda (calendar-token-provenance.ts) — faux `fetch`,
 * aucun appel réseau. Chaque refus a son contrôle positif : la même liaison,
 * corrigée du seul défaut testé, passe.
 */
import { describe, it, expect } from 'vitest'
import {
  compteLie,
  statutDuRefus,
  verifierLiaisonGoogle,
  verifierLiaisonMicrosoft,
  type FetchLike,
} from './calendar-token-provenance.ts'

const CLIENT = '833483825712-test.apps.googleusercontent.com'
const SUB = '109876543210'
const COMPTE = { sub: SUB, email: 'agent@example.org' }

interface Appel { url: string; methode: string; corps: string; auth: string | null }

/** Faux fournisseur : chaque URL (sans query) a sa réponse ; `throw` simule une panne réseau. */
function faux(routes: Record<string, { statut: number; corps: unknown } | 'throw'>): { fetchImpl: FetchLike; appels: Appel[] } {
  const appels: Appel[] = []
  const fetchImpl: FetchLike = async (input, init) => {
    const url = input.split('?')[0]
    const headers = new Headers(init?.headers)
    appels.push({ url, methode: init?.method ?? 'GET', corps: String(init?.body ?? ''), auth: headers.get('authorization') })
    const r = routes[url]
    if (!r || r === 'throw') throw new TypeError('réseau coupé')
    return new Response(JSON.stringify(r.corps), { status: r.statut, headers: { 'Content-Type': 'application/json' } })
  }
  return { fetchImpl, appels }
}

const TOKEN_G = 'https://oauth2.googleapis.com/token'
const INFO_G = 'https://oauth2.googleapis.com/tokeninfo'
const echangeOk = { statut: 200, corps: { access_token: 'AT_NEUF', expires_in: 3599, scope: 'x' } }
const infoOk = {
  statut: 200,
  corps: { aud: CLIENT, azp: CLIENT, sub: SUB, email: 'Agent@Example.org', email_verified: 'true', scope: 'openid https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy' },
}
const google = (routes: Parameters<typeof faux>[0], compte: typeof COMPTE | null = COMPTE, secret = 'secret') => {
  const f = faux(routes)
  return { f, run: () => verifierLiaisonGoogle('RT_ORIGINE', { clientId: CLIENT, clientSecret: secret, compte, fetchImpl: f.fetchImpl }) }
}

describe('verifierLiaisonGoogle', () => {
  it('CONTRÔLE POSITIF : une liaison conforme passe, avec le jeton d’accès NEUF', async () => {
    const { f, run } = google({ [TOKEN_G]: echangeOk, [INFO_G]: infoOk })
    const v = await run()
    expect(v).toEqual({ ok: true, jetons: { accessToken: 'AT_NEUF', refreshToken: 'RT_ORIGINE', expiresIn: 3599, email: 'agent@example.org' } })
    // L'échange porte les identifiants de MEGGA et le jeton reçu ; tokeninfo est un
    // POST dont le CORPS porte le jeton neuf — jamais l'URL.
    const echange = new URLSearchParams(f.appels[0].corps)
    expect(echange.get('client_id')).toBe(CLIENT)
    expect(echange.get('client_secret')).toBe('secret')
    expect(echange.get('refresh_token')).toBe('RT_ORIGINE')
    expect(f.appels[1]).toMatchObject({ url: INFO_G, methode: 'POST' })
    expect(new URLSearchParams(f.appels[1].corps).get('access_token')).toBe('AT_NEUF')
  })

  it('refuse sans identifiants de projet, sans rien appeler', async () => {
    const { f, run } = google({ [TOKEN_G]: echangeOk, [INFO_G]: infoOk }, COMPTE, '')
    expect(await run()).toEqual({ ok: false, refus: 'non_configure' })
    expect(f.appels).toEqual([])
  })

  it('refuse un utilisateur sans compte Google lié', async () => {
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: infoOk }, null).run()).toEqual({ ok: false, refus: 'identite_absente' })
  })

  it('refuse un jeton de rafraîchissement que Google rejette (autre application, révoqué)', async () => {
    const v = await google({ [TOKEN_G]: { statut: 400, corps: { error: 'invalid_grant' } }, [INFO_G]: infoOk }).run()
    expect(v).toEqual({ ok: false, refus: 'rafraichissement_refuse' })
  })

  it('distingue la panne du refus : réseau coupé ou 5xx', async () => {
    expect(await google({ [TOKEN_G]: 'throw', [INFO_G]: infoOk }).run()).toEqual({ ok: false, refus: 'fournisseur_injoignable' })
    expect(await google({ [TOKEN_G]: { statut: 503, corps: {} }, [INFO_G]: infoOk }).run()).toEqual({ ok: false, refus: 'fournisseur_injoignable' })
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: { statut: 500, corps: {} } }).run()).toEqual({ ok: false, refus: 'fournisseur_injoignable' })
  })

  it('refuse un jeton émis pour une autre application', async () => {
    const info = { statut: 200, corps: { ...infoOk.corps, aud: 'autre.apps.googleusercontent.com', azp: 'autre.apps.googleusercontent.com' } }
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: info }).run()).toEqual({ ok: false, refus: 'mauvais_client' })
  })

  it('refuse le compte d’un TIERS — le cas de la session volée', async () => {
    const info = { statut: 200, corps: { ...infoOk.corps, sub: '555000111222', email: 'attaquant@example.net' } }
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: info }).run()).toEqual({ ok: false, refus: 'mauvais_compte' })
  })

  it('ne se contente jamais d’une adresse quand le sub diffère', async () => {
    const info = { statut: 200, corps: { ...infoOk.corps, sub: '555000111222' } } // même adresse, autre sub
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: info }).run()).toEqual({ ok: false, refus: 'mauvais_compte' })
  })

  it('sans sub, n’accepte l’adresse que certifiée par Google', async () => {
    const { sub: _ignore, ...sansSub } = infoOk.corps
    void _ignore
    const nonCertifiee = { statut: 200, corps: { ...sansSub, email_verified: 'false' } }
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: nonCertifiee }).run()).toEqual({ ok: false, refus: 'mauvais_compte' })
    const certifiee = { statut: 200, corps: { ...sansSub, email_verified: true } }
    expect((await google({ [TOKEN_G]: echangeOk, [INFO_G]: certifiee }).run()).ok).toBe(true)
  })

  it('refuse un consentement donné sans la portée agenda', async () => {
    const info = { statut: 200, corps: { ...infoOk.corps, scope: 'openid email profile' } }
    expect(await google({ [TOKEN_G]: echangeOk, [INFO_G]: info }).run()).toEqual({ ok: false, refus: 'portee_insuffisante' })
  })
})

const TOKEN_M = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const ME = 'https://graph.microsoft.com/v1.0/me'
const microsoft = (routes: Parameters<typeof faux>[0], secret = 'secret') => {
  const f = faux(routes)
  return { f, run: () => verifierLiaisonMicrosoft('RT_ORIGINE', { clientId: 'ms-client', clientSecret: secret, compte: { sub: 'pairwise-sub', email: 'agent@example.org' }, fetchImpl: f.fetchImpl }) }
}

describe('verifierLiaisonMicrosoft', () => {
  it('CONTRÔLE POSITIF : l’adresse du compte lié, et le jeton de rafraîchissement ROTÉ est gardé', async () => {
    const { f, run } = microsoft({
      [TOKEN_M]: { statut: 200, corps: { access_token: 'AT_MS', refresh_token: 'RT_ROTE', expires_in: 4000 } },
      [ME]: { statut: 200, corps: { id: 'graph-object-id', mail: null, userPrincipalName: 'AGENT@example.org' } },
    })
    expect(await run()).toEqual({ ok: true, jetons: { accessToken: 'AT_MS', refreshToken: 'RT_ROTE', expiresIn: 4000, email: 'agent@example.org' } })
    expect(f.appels[1].auth).toBe('Bearer AT_MS')
  })

  it('refuse sans identifiants de projet — l’état actuel de la production', async () => {
    expect(await microsoft({}, '').run()).toEqual({ ok: false, refus: 'non_configure' })
  })

  it('refuse le compte d’un tiers', async () => {
    const v = await microsoft({
      [TOKEN_M]: { statut: 200, corps: { access_token: 'AT_MS', expires_in: 4000 } },
      [ME]: { statut: 200, corps: { id: 'autre', mail: 'attaquant@example.net', userPrincipalName: 'attaquant@example.net' } },
    }).run()
    expect(v).toEqual({ ok: false, refus: 'mauvais_compte' })
  })
})

describe('compteLie', () => {
  it('lit le sub dans identity_data, avec repli sur id, et l’adresse en minuscules', () => {
    expect(compteLie([{ provider: 'email' }, { provider: 'google', id: 'X', identity_data: { sub: SUB, email: 'A@B.CH' } }], 'google'))
      .toEqual({ sub: SUB, email: 'a@b.ch' })
    expect(compteLie([{ provider: 'google', id: '4242', identity_data: {} }], 'google')).toEqual({ sub: '4242', email: null })
  })

  it('rend null sans identité du fournisseur demandé', () => {
    expect(compteLie([{ provider: 'google', id: 'X' }], 'azure')).toBeNull()
    expect(compteLie(null, 'google')).toBeNull()
  })
})

describe('statutDuRefus', () => {
  it('503 pour une panne ou un projet non configuré, 403 pour un refus du jeton', () => {
    expect(statutDuRefus('non_configure')).toBe(503)
    expect(statutDuRefus('fournisseur_injoignable')).toBe(503)
    for (const r of ['identite_absente', 'rafraichissement_refuse', 'mauvais_client', 'mauvais_compte', 'portee_insuffisante'] as const) {
      expect(statutDuRefus(r)).toBe(403)
    }
  })
})
