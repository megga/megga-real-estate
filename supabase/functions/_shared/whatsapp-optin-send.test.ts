/**
 * L'envoi de l'invitation d'opt-in `click_to_wa`, éprouvé sans base ni réseau.
 *
 * POURQUOI CE BANC EXISTE. C'est le SEUL chemin d'opt-in du dispositif, partagé par le bouton
 * du CRM et l'exécuteur du copilote, et il n'avait aucun banc : seule la RPC SQL était
 * couverte. Or ce que ce module tient n'est pas dans la RPC — l'ORDRE des refus, le fait que
 * le jeton ne sorte JAMAIS vers l'appelant, et la forme du lien `wa.me` que la personne
 * cliquera. Un lien mal formé mène nulle part et l'agent croit l'invitation partie.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const env: Record<string, string | undefined> = {
  MEGGA_MAGIC_LINK_HMAC_SECRET: 'x'.repeat(40),
  RESEND_API_KEY: 're_test',
}
;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => env[k] },
}

const { sendOptinInvite, INVITE_DAYS } = await import('./whatsapp-optin-send.ts')
const { OPTIN_PREFIX } = await import('./whatsapp-optin.ts')

type Tables = {
  contact?: Record<string, unknown> | null
  waNumber?: Record<string, unknown> | null
  agency?: Record<string, unknown> | null
}

interface Harness {
  admin: Parameters<typeof sendOptinInvite>[0]
  rpc: ReturnType<typeof vi.fn>
  inserted: Array<{ table: string; row: Record<string, unknown> }>
  /** Chaque `.eq(col, val)` observé, par table. Sans ça, aucun test ne peut voir un filtre. */
  filtres: Array<{ table: string; col: string; val: unknown }>
}

/**
 * Faux client. `inviteError` RETOURNE `{ error }` — `supabase-js` ne jette pas, et un faux
 * qui ne sait que lever ne reproduirait aucun des défauts qu'on éprouve ici.
 */
function harness(t: Tables = {}, o: { inviteError?: string; eventError?: string } = {}): Harness {
  const inserted: Harness['inserted'] = []
  const filtres: Harness['filtres'] = []
  const rpc = vi.fn(async (name: string) => {
    if (name !== 'create_wa_optin_invite') return { data: null, error: null }
    if (o.inviteError) return { data: null, error: { message: o.inviteError } }
    return { data: [{ id: 'inv-1', wa_phone: '41791112233', agency_id: 'a-1' }], error: null }
  })
  const rows: Record<string, unknown> = {
    contacts: 'contact' in t ? t.contact : { id: 'c-1', email: 'client@exemple.ch', phone: '+41 79 111 22 33', language: 'de' },
    agency_wa_numbers: 'waNumber' in t ? t.waNumber : { wa_number: '+41 22 000 00 00' },
    agencies: 'agency' in t ? t.agency : { name: 'Régie du Lac' },
  }
  const chain = (table: string) => {
    const self: Record<string, unknown> = {}
    for (const k of ['select', 'limit']) self[k] = () => self
    // ⚠ `eq` ENREGISTRE. Un faux qui se contente de se rendre lui-même ne peut témoigner
    // d'aucun filtre : le banc resterait vert si la garde cross-agence disparaissait.
    self.eq = (col: string, val: unknown) => { filtres.push({ table, col, val }); return self }
    self.maybeSingle = async () => ({ data: rows[table] ?? null, error: null })
    return self
  }
  const from = (table: string) => ({
    ...chain(table),
    insert: async (row: Record<string, unknown>) => {
      if (o.eventError) return { error: { message: o.eventError } }
      inserted.push({ table, row }); return { error: null }
    },
  })
  return { admin: { from, rpc } as never, rpc, inserted, filtres }
}

const ARGS = { contactId: 'c-1', agencyId: 'a-1', sentBy: 'p-7' }

let resend: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.restoreAllMocks()
  env.RESEND_API_KEY = 're_test'
  resend = vi.fn(async () => new Response('{"id":"em_1"}', { status: 200 }))
  vi.stubGlobal('fetch', resend)
})

describe('sendOptinInvite — les refus, dans l’ordre', () => {
  it('un contact d’une AUTRE agence est simplement introuvable', async () => {
    const h = harness({ contact: null })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'contact_not_found' })
    expect(h.rpc).not.toHaveBeenCalled()
    expect(resend).not.toHaveBeenCalled()
  })

  it('⛔ la lecture du contact est FILTRÉE par agence — c’est la SEULE garde de tenant du chemin', async () => {
    // L'appelant construit son client avec la SERVICE_ROLE_KEY (whatsapp-optin-invite:53-55),
    // donc la RLS est contournée : ce `.eq('agency_id', …)` est tout ce qui empêche l'agence B
    // d'envoyer une invitation d'opt-in au client de l'agence A. Le retirer doit faire ROUGIR
    // ce banc — c'était le cas contraire avant, faute d'un faux capable d'observer un filtre.
    const h = harness()
    await sendOptinInvite(h.admin, ARGS)
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'agency_id', val: 'a-1' })
    expect(h.filtres).toContainEqual({ table: 'contacts', col: 'id', val: 'c-1' })
    // Le numéro Business, lui, se prend dans l'agence de l'APPELANT : router la réponse
    // ailleurs enverrait le consentement obtenu vers un fil qui ne lui revient pas.
    expect(h.filtres).toContainEqual({ table: 'agency_wa_numbers', col: 'agency_id', val: 'a-1' })
  })

  it('sans adresse, il n’y a pas de canal déjà consenti par lequel inviter', async () => {
    const h = harness({ contact: { id: 'c-1', email: null, phone: '+41791112233', language: null } })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'contact_without_email' })
  })

  it('sans numéro, il n’y a personne à inviter sur WhatsApp', async () => {
    const h = harness({ contact: { id: 'c-1', email: 'a@b.ch', phone: null, language: null } })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'contact_without_phone' })
  })

  it('⛔ sans numéro Business, on ÉCHOUE au lieu de replier sur META_PHONE_NUMBER_ID', async () => {
    // C'est un identifiant de compte Meta, pas un numéro : le lien `wa.me` mènerait nulle
    // part et l'agent croirait l'invitation partie.
    const h = harness({ waNumber: null })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'agency_wa_number_missing' })
    expect(h.rpc).not.toHaveBeenCalled()
  })

  it('un numéro BLOQUÉ remonte comme tel — on ne réinvite pas qui a dit STOP', async () => {
    const h = harness({}, { inviteError: 'phone_suppressed' })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'phone_suppressed' })
    expect(resend).not.toHaveBeenCalled()
  })

  it('toute autre erreur de création reste distincte du blocage', async () => {
    const h = harness({}, { inviteError: 'invalid_contact_phone' })
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'invite_not_created' })
  })

  it('sans clé Resend, on le dit — et l’invitation créée reste inerte, elle expire seule', async () => {
    env.RESEND_API_KEY = undefined
    const h = harness()
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'email_not_configured' })
    expect(h.rpc).toHaveBeenCalled()   // l'invitation porte la PREUVE : elle est créée d'abord
  })

  it('un refus de Resend n’est pas un succès', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 422 })))
    const h = harness()
    expect(await sendOptinInvite(h.admin, ARGS)).toEqual({ ok: false, error: 'email_send_failed' })
  })
})

describe('sendOptinInvite — l’invitation qui part', () => {
  it('⛔ RÉGRESSION — `sent_by` est ÉCRIT dans la table de preuve, pas seulement dans l’audit', async () => {
    // La colonne était déclarée et jamais renseignée : la question « qui a invité ? » n'avait
    // de réponse que dans `activity_events`, écrit en best-effort.
    const h = harness()
    await sendOptinInvite(h.admin, ARGS)
    expect(h.rpc).toHaveBeenCalledWith('create_wa_optin_invite', expect.objectContaining({
      p_contact_id: 'c-1', p_purpose: 'marketing', p_days: INVITE_DAYS, p_sent_by: 'p-7',
    }))
  })

  it('archive le texte EXACTEMENT montré, dans la langue du contact', async () => {
    // C'est la preuve exigée par l'art. 6 al. 6 nLPD : un opt-in sans trace de ce qui a été
    // présenté ne prouve rien.
    const h = harness()
    const r = await sendOptinInvite(h.admin, ARGS)
    expect(r).toMatchObject({ ok: true, lang: 'de', inviteId: 'inv-1' })
    const p = h.rpc.mock.calls[0][1] as { p_shown_text: string; p_lang: string }
    expect(p.p_lang).toBe('de')
    expect(p.p_shown_text).toContain('Régie du Lac')
    const envoye = JSON.parse(resend.mock.calls[0][1].body as string)
    expect(envoye.html).toContain('Régie du Lac')
  })

  it('⛔ le jeton ne sort JAMAIS vers l’appelant — il ne vit que dans le lien envoyé', async () => {
    // Un agent qui pourrait se le faire remettre fabriquerait le consentement du contact
    // depuis son propre téléphone.
    const h = harness()
    const r = await sendOptinInvite(h.admin, ARGS)
    expect(Object.keys(r)).toEqual(['ok', 'inviteId', 'lang', 'email'])
    // Le jeton RÉELLEMENT émis, repris du lien envoyé, ne doit se retrouver nulle part dans
    // ce que la fonction rend à son appelant.
    const html = JSON.parse(resend.mock.calls[0][1].body as string).html as string
    const lien = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/)![1]
    const jeton = decodeURIComponent(new URL(lien).searchParams.get('text')!).slice(OPTIN_PREFIX.length + 1)
    expect(jeton.length).toBeGreaterThan(20)
    expect(JSON.stringify(r)).not.toContain(jeton)
  })

  it('le lien `wa.me` compose le numéro de l’AGENCE et pré-remplit le marqueur d’opt-in', async () => {
    // `agency_wa_numbers` fait autorité : c'est lui qui route déjà les entrants. S'en écarter
    // enverrait la personne vers un numéro dont les réponses ne reviendraient pas chez elle.
    const h = harness()
    await sendOptinInvite(h.admin, ARGS)
    const html = JSON.parse(resend.mock.calls[0][1].body as string).html as string
    const lien = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/)![1]
    expect(lien.startsWith('https://wa.me/41220000000?text=')).toBe(true)
    const texte = decodeURIComponent(new URL(lien).searchParams.get('text')!)
    expect(texte.startsWith(`${OPTIN_PREFIX} `)).toBe(true)
    expect(texte.length).toBeGreaterThan(OPTIN_PREFIX.length + 20)   // un jeton, pas un vide
  })

  it('l’e-mail part à l’adresse du CONTACT, depuis le domaine signé', async () => {
    const h = harness()
    await sendOptinInvite(h.admin, ARGS)
    const p = JSON.parse(resend.mock.calls[0][1].body as string)
    expect(p.to).toEqual(['client@exemple.ch'])
    expect(p.from).toContain('noreply@megga.ch')
    expect(p.tags).toContainEqual({ name: 'kind', value: 'wa_optin_invite' })
  })

  it('sans agence nommée, la copie ne laisse pas un trou — elle dit « notre agence »', async () => {
    const h = harness({ agency: null })
    await sendOptinInvite(h.admin, { ...ARGS })
    const p = h.rpc.mock.calls[0][1] as { p_shown_text: string }
    expect(p.p_shown_text).toContain('notre agence')
  })

  it('⛔ un audit refusé par la base est SIGNALÉ, pas avalé — et n’annule pas l’invitation', async () => {
    // Le `.then(() => {}, () => {})` d'origine avalait tout, `{ error }` compris : l'audit de
    // l'invitation pouvait être inexistant sans qu'aucune ligne ne le dise.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = harness({}, { eventError: 'violates check constraint' })
    const r = await sendOptinInvite(h.admin, ARGS)
    expect(r.ok).toBe(true)
    expect(err).toHaveBeenCalledWith(
      'optin invite: audit non écrit:', expect.stringContaining('check constraint'))
  })
})
