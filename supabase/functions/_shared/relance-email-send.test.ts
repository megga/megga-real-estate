// @vitest-environment node
// (Node et non jsdom : le module testé est du code Deno, dont `fetch`, `Response` et
// `AbortSignal` sont ceux de la plateforme.)
/**
 * L'envoi d'une relance, éprouvé sans base ni réseau — et sa porte WhatsApp, le « oui ».
 *
 * POURQUOI CE BANC. Constaté à l'audit du 13.09.2026 : l'exécuteur WhatsApp
 * `executeSendClientEmail` appelait l'edge `send-relance-email` sous la clé de SERVICE, et
 * cette fonction exige un JWT d'agent — 401 à chaque « oui », aucune relance post-oui jamais
 * partie. Aucun banc ne couvrait ce chemin : tout y était « vert » faute d'être exercé.
 *
 * Ce qu'il verrouille :
 *   · l'ORDRE périmètre → suppression → quota → Resend, lu sur UN journal commun aux RPC et
 *     aux `fetch` — deux compteurs séparés ne verraient pas Resend partir avant le quota ;
 *   · le refus d'un destinataire hors périmètre, sans suppression, ni quota, ni Resend ;
 *   · la porte WhatsApp : le « oui » part sans aucun appel de fonction à fonction, sous
 *     l'agence et l'agent du contexte VÉRIFIÉ — jamais ceux du payload.
 * Le faux `fetch` répond à un appel de `send-relance-email` ce que l'edge répond vraiment à
 * la clé de service (401) : réintroduire l'appel HTTP fait rougir la porte WhatsApp.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const env: Record<string, string | undefined> = {
  MEGGA_MAGIC_LINK_HMAC_SECRET: 'x'.repeat(40),
  RESEND_API_KEY: 're_test',
  SUPABASE_URL: 'https://projet.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'cle-de-service-test',
}
// Deno.env est lu à l'appel ; en Node on l'injecte par un shim, avant l'import des modules.
;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => env[k] },
}

const { sendRelanceEmail } = await import('./relance-email-send.ts')
const { executeSendClientEmail } = await import('./whatsapp-actions.ts')

const AGENCY = 'a0000000-0000-4000-8000-000000000001'
const CONTACT = 'c0000000-0000-4000-8000-000000000002'
const AGENT = 'p0000000-0000-4000-8000-000000000007'
const RESEND = 'https://api.resend.com/emails'

type RpcReply = { data?: unknown; error?: { message: string } | null }
type Evenement =
  | { kind: 'rpc'; fn: string; args: Record<string, unknown> }
  | { kind: 'fetch'; url: string; init: RequestInit | undefined }

const SCOPE_OK = { data: 'contact' }
const SCOPE_NONE = { data: null }
const STOP_NON = { data: [{ allowed: true, reason: 'ok' }] }
const STOP_OUI = { data: [{ allowed: false, reason: 'unsubscribed' }] }
const QUOTA_OK = { data: [{ allowed: true, reason: 'ok', hour_count: 1, day_count: 1 }] }
const QUOTA_HEURE = { data: [{ allowed: false, reason: 'hourly_cap', hour_count: 60, day_count: 61 }] }
const GARDE_OK = { email_recipient_scope: SCOPE_OK, email_send_allowed: STOP_NON, email_send_quota_take: QUOTA_OK }

let journal: Evenement[]
let resendRepond: () => Response

beforeEach(() => {
  vi.restoreAllMocks()
  env.RESEND_API_KEY = 're_test'
  journal = []
  resendRepond = () => new Response(JSON.stringify({ id: 'em_1' }), { status: 200 })
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    journal.push({ kind: 'fetch', url: u, init })
    if (u === RESEND) return resendRepond()
    // Ce que l'edge `send-relance-email` répond à la clé de service : `requireAgentAuth` la
    // refuse (`isNonUserToken`). C'est le défaut du 13.09.2026, rejoué.
    if (u.includes('/functions/v1/send-relance-email')) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), { status: 401 })
    }
    return new Response('{}', { status: 404 })
  }))
})

/** RPC du faux client : chaque appel entre au journal commun, dans l'ordre. */
function rpcDe(replies: Record<string, RpcReply>) {
  return vi.fn(async (fn: string, args: Record<string, unknown>) => {
    journal.push({ kind: 'rpc', fn, args })
    const r = replies[fn]
    if (!r) return { data: null, error: { message: `rpc inattendue : ${fn}` } }
    return { data: r.data ?? null, error: r.error ?? null }
  })
}

/** Le journal réduit à ce qui a eu lieu : `rpc:<nom>` ou `fetch:<url sans requête>`. */
const deroule = () => journal.map((e) => (e.kind === 'rpc' ? `rpc:${e.fn}` : `fetch:${e.url.split('?')[0]}`))
const argsRpc = (fn: string) => (journal.find((e) => e.kind === 'rpc' && e.fn === fn) as { args: Record<string, unknown> } | undefined)?.args
const corpsResend = () => {
  const e = journal.find((x) => x.kind === 'fetch' && x.url === RESEND) as { init?: RequestInit } | undefined
  return e ? JSON.parse(String(e.init?.body)) as Record<string, unknown> : null
}

const APPELANT = { agencyId: AGENCY, actorId: AGENT, sender: 'send-relance-email' as const }
const RELANCE = { to: 'marie@exemple.ch', subject: 'Votre recherche', body: 'Bonjour Marie,\nToujours intéressée ?', agentName: 'Julie', leadId: CONTACT }
const CORS = { 'Access-Control-Allow-Origin': '*' }

describe('sendRelanceEmail — la garde, puis Resend, dans cet ordre', () => {
  it('laisse partir un contact connu, non désinscrit, sous quota — Resend en DERNIER', async () => {
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const res = await sendRelanceEmail(admin, APPELANT, RELANCE, CORS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, emailId: 'em_1', to: 'marie@exemple.ch' })
    expect(deroule()).toEqual([
      'rpc:email_recipient_scope', 'rpc:email_send_allowed', 'rpc:email_send_quota_take', `fetch:${RESEND}`,
    ])
    // Le périmètre et le quota sont jugés sur l'agence de l'APPELANT ; l'expéditeur et
    // l'acteur sont journalisés tels que la porte les a vérifiés.
    expect(argsRpc('email_recipient_scope')).toEqual({ p_agency_id: AGENCY, p_email: 'marie@exemple.ch' })
    expect(argsRpc('email_send_quota_take')).toMatchObject({
      p_agency_id: AGENCY, p_actor_id: AGENT, p_sender: 'send-relance-email', p_purpose: 'relance',
    })
    const envoi = corpsResend()!
    expect(envoi).toMatchObject({ from: 'MEGGA Immobilier <noreply@getmegga.com>', to: ['marie@exemple.ch'], subject: 'Votre recherche' })
    expect(envoi.tags).toEqual([
      { name: 'kind', value: 'relance' }, { name: 'lead_id', value: CONTACT }, { name: 'agency_id', value: AGENCY },
    ])
    expect(String(envoi.html)).toContain('Toujours intéressée ?')
    // Une relance porte sa sortie : le lien pointe sur le hôte des edge functions.
    expect((envoi.headers as Record<string, string>)['List-Unsubscribe']).toMatch(/^<https:\/\/projet\.supabase\.co\/functions\/v1\/email-unsubscribe\?/)
  })

  it('refuse (403) un destinataire hors périmètre — ni suppression, ni quota, ni Resend', async () => {
    const admin = { rpc: rpcDe({ ...GARDE_OK, email_recipient_scope: SCOPE_NONE }) } as never
    const res = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, to: 'inconnu@ailleurs.ch' }, CORS)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'recipient_out_of_scope' })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(deroule()).toEqual(['rpc:email_recipient_scope'])
  })

  it('refuse (409) une personne qui a dit STOP — ni quota pris, ni Resend', async () => {
    const admin = { rpc: rpcDe({ ...GARDE_OK, email_send_allowed: STOP_OUI }) } as never
    const res = await sendRelanceEmail(admin, APPELANT, RELANCE)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'unsubscribed', blocked: true })
    expect(deroule()).toEqual(['rpc:email_recipient_scope', 'rpc:email_send_allowed'])
  })

  it('refuse (429) au plafond de l’agence — sans Resend', async () => {
    const admin = { rpc: rpcDe({ ...GARDE_OK, email_send_quota_take: QUOTA_HEURE }) } as never
    const res = await sendRelanceEmail(admin, APPELANT, RELANCE)
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({ error: 'hourly_cap' })
    expect(deroule()).not.toContain(`fetch:${RESEND}`)
  })

  it('refuse (400) une relance incomplète ou une adresse invalide, AVANT toute RPC', async () => {
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const vide = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, subject: '' })
    expect(vide.status).toBe(400)
    const invalide = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, to: 'pas-une-adresse' })
    expect(invalide.status).toBe(400)
    expect(await invalide.json()).toEqual({ error: 'Invalid email address' })
    expect(journal).toEqual([])
  })

  it('⛔ refuse (422) un bien dans la relance — lien d’annonce ou référence —, avant toute RPC ni Resend', async () => {
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const lien = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, body: 'Voici un bien : https://www.homegate.ch/acheter/4001234567' }, CORS)
    expect(lien.status).toBe(422)
    expect(await lien.json()).toMatchObject({ error: 'property_in_message' })
    const reference = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, subject: 'Le MG-IN-3F2A1C pour vous' })
    expect(reference.status).toBe(422)
    // Ni périmètre, ni quota consommé, ni Resend : un refus de contenu ne coûte rien.
    expect(journal).toEqual([])
  })

  it('laisse partir une relance qui parle d’une visite fixée, sans lien ni référence', async () => {
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const res = await sendRelanceEmail(admin, APPELANT, { ...RELANCE, body: 'Bonjour Marie,\nJe vous confirme la visite de jeudi 14h.' })
    expect(res.status).toBe(200)
  })

  it('refuse (500) sans clé Resend, avant de consommer une place de quota', async () => {
    env.RESEND_API_KEY = undefined
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const res = await sendRelanceEmail(admin, APPELANT, RELANCE)
    expect(res.status).toBe(500)
    expect(journal).toEqual([])
  })

  it('rend le statut de Resend quand le fournisseur refuse', async () => {
    resendRepond = () => new Response(JSON.stringify({ message: 'domain not verified' }), { status: 422 })
    const admin = { rpc: rpcDe(GARDE_OK) } as never
    const res = await sendRelanceEmail(admin, APPELANT, RELANCE)
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: 'domain not verified' })
  })
})

// ─── La porte WhatsApp : le « oui » ────────────────────────────────────────

interface Porte {
  ctx: Parameters<typeof executeSendClientEmail>[0]
  audits: Array<Record<string, unknown>>
  /** Chaque `.eq(col, val)`, par table : le filtre d'agence est la seule garde de tenant d'un client service-role. */
  filtres: Array<{ table: string; col: string; val: unknown }>
}

/**
 * Faux client service-role : `contacts` et `profiles` en lecture, `activity_events` en écriture,
 * et les RPC de la garde, au journal commun.
 */
function porte(o: {
  contact?: Record<string, unknown> | null
  rpc?: Record<string, RpcReply>
  lang?: 'fr' | 'en'
} = {}): Porte {
  const audits: Porte['audits'] = []
  const filtres: Porte['filtres'] = []
  const lignes: Record<string, unknown> = {
    contacts: 'contact' in o ? o.contact : { first_name: 'Marie', email: 'marie@exemple.ch' },
    profiles: { full_name: 'Julie Agent' },
  }
  const from = (table: string) => {
    const self: Record<string, unknown> = {}
    self.select = () => self
    self.eq = (col: string, val: unknown) => { filtres.push({ table, col, val }); return self }
    self.maybeSingle = async () => ({ data: lignes[table] ?? null, error: null })
    self.insert = (row: Record<string, unknown>) => { audits.push(row); return Promise.resolve({ error: null }) }
    return self
  }
  return {
    ctx: { supabase: { from, rpc: rpcDe(o.rpc ?? GARDE_OK) } as never, profileId: AGENT, agencyId: AGENCY, lang: o.lang ?? 'fr' },
    audits,
    filtres,
  }
}

/** Le brouillon figé au « tu confirmes ? » — `agencyId` y est FORGÉ : il ne doit servir à rien. */
const PAYLOAD = {
  contact_id: CONTACT, to: 'marie@exemple.ch', subject: 'Votre recherche', body: 'Bonjour Marie,\nToujours intéressée ?',
  agencyId: 'agence-forgee', agency_id: 'agence-forgee',
}

describe('executeSendClientEmail — le « oui » part, en direct', () => {
  it('⛔ le cas du 13.09 : le mail part, sans AUCUN appel de fonction à fonction', async () => {
    const p = porte()
    const reponse = await executeSendClientEmail(p.ctx, PAYLOAD)
    expect(reponse).toBe('Email envoyé à Marie.')
    expect(journal.filter((e) => e.kind === 'fetch' && e.url.includes('/functions/v1/'))).toEqual([])
    expect(deroule()).toEqual([
      'rpc:email_recipient_scope', 'rpc:email_send_allowed', 'rpc:email_send_quota_take', `fetch:${RESEND}`,
    ])
    // L'agence et l'agent du lien VÉRIFIÉ, jamais ceux du payload.
    expect(argsRpc('email_recipient_scope')).toEqual({ p_agency_id: AGENCY, p_email: 'marie@exemple.ch' })
    expect(argsRpc('email_send_quota_take')).toMatchObject({ p_agency_id: AGENCY, p_actor_id: AGENT, p_sender: 'whatsapp-webhook' })
    expect((corpsResend()!.tags as Array<{ name: string; value: string }>)).toContainEqual({ name: 'agency_id', value: AGENCY })
    // L'attente est bornée : l'agent attend cette réponse sur WhatsApp.
    const appel = journal.find((e) => e.kind === 'fetch' && e.url === RESEND) as { init?: RequestInit }
    expect(appel.init?.signal).toBeInstanceOf(AbortSignal)
    // La fiche relue au « oui » l'est DANS l'agence du lien — un contact_id d'ailleurs est introuvable.
    expect(p.filtres).toContainEqual({ table: 'contacts', col: 'agency_id', val: AGENCY })
    expect(p.audits).toHaveLength(1)
    expect(p.audits[0]).toMatchObject({ agency_id: AGENCY, action: 'whatsapp_ai_send_client_email', actor_kind: 'ai' })
    expect((p.audits[0].metadata as Record<string, unknown>).email_sent).toBe(true)
  })

  it('⛔ un bien dans l’email ne part pas, et l’agent lit pourquoi — pas un code', async () => {
    const p = porte()
    const reponse = await executeSendClientEmail(p.ctx, { ...PAYLOAD, body: 'Bonjour Marie,\nJe vous propose le MG-MK-99887.' })
    expect(reponse).toMatch(/^Rien n'est parti : ce message contient un bien/)
    expect(reponse).not.toContain('property_in_message')
    expect(deroule()).toEqual([])
    expect((p.audits[0].metadata as Record<string, unknown>).email_sent).toBe(false)
  })

  it('un STOP arrête l’envoi, et l’agent le lit en clair — pas un code', async () => {
    const p = porte({ rpc: { ...GARDE_OK, email_send_allowed: STOP_OUI } })
    const reponse = await executeSendClientEmail(p.ctx, PAYLOAD)
    expect(reponse).toBe("Rien n'est parti — Marie a demandé à ne plus recevoir d'e-mails.")
    expect(deroule()).toEqual(['rpc:email_recipient_scope', 'rpc:email_send_allowed'])
    expect((p.audits[0].metadata as Record<string, unknown>).email_sent).toBe(false)
  })

  it('un destinataire hors périmètre ne part pas — ni STOP, ni quota, ni Resend', async () => {
    const p = porte({ rpc: { ...GARDE_OK, email_recipient_scope: SCOPE_NONE } })
    const reponse = await executeSendClientEmail(p.ctx, PAYLOAD)
    expect(reponse).toContain('recipient_out_of_scope')
    expect(deroule()).toEqual(['rpc:email_recipient_scope'])
  })

  it('le plafond se dit dans la langue de l’agent', async () => {
    const p = porte({ rpc: { ...GARDE_OK, email_send_quota_take: QUOTA_HEURE }, lang: 'en' })
    expect(await executeSendClientEmail(p.ctx, PAYLOAD))
      .toBe("The email didn't go out — your agency reached its hourly email cap. Try again in an hour.")
    expect(deroule()).not.toContain(`fetch:${RESEND}`)
  })

  it('une adresse changée depuis le brouillon ne part pas — rien n’est consulté ni envoyé', async () => {
    const p = porte({ contact: { first_name: 'Marie', email: 'nouvelle@exemple.ch' } })
    const reponse = await executeSendClientEmail(p.ctx, PAYLOAD)
    expect(reponse).toContain('a changé depuis le brouillon')
    expect(journal).toEqual([])
    expect(p.audits).toEqual([])
  })

  it('la casse et les espaces d’une fiche ne passent pas pour un changement d’adresse', async () => {
    const p = porte({ contact: { first_name: 'Marie', email: ' Marie@Exemple.CH ' } })
    expect(await executeSendClientEmail(p.ctx, PAYLOAD)).toBe('Email envoyé à Marie.')
  })
})
