/**
 * La garde du canal E-MAIL, éprouvée sans base ni réseau.
 *
 * POURQUOI CE BANC EXISTE. Le module portait deux promesses légales — « on ne réécrit pas à
 * qui a dit non » et « chaque envoi porte un moyen de sortir » — et aucun banc. Seule la RPC
 * SQL était couverte, c'est-à-dire la moitié qui décide, jamais celle qui CÂBLE. Or le défaut
 * réel était dans le câblage : le lien de désinscription pointait sur le fallback SPA de
 * `app.megga.ch`, qui rend `200 text/html` sans rien écrire.
 *
 * La décision de conformité elle-même vit en SQL et a son propre banc
 * (tests/backend/whatsapp-consent-registry.spec.ts) ; la dupliquer ici ne prouverait que la
 * fidélité du mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SUPABASE_URL = 'https://eayczugyrvmtqnnmvjod.supabase.co'
const env: Record<string, string | undefined> = {
  MEGGA_MAGIC_LINK_HMAC_SECRET: 'x'.repeat(40),
  SUPABASE_URL,
}
// Deno.env est lu au corps du module ; en Node/Vitest on l'injecte par un shim, comme
// magic-link-token.test.ts.
;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => env[k] },
}

const { emailSendAllowed, unsubscribeHeaders, unsubscribeFooterHtml } =
  await import('./email-guard.ts')

/** Faux client : seulement `rpc`, seule chose que la garde touche. */
function admin(reply: { data?: unknown; error?: { message: string } }) {
  const rpc = vi.fn(async () => ({ data: reply.data ?? null, error: reply.error ?? null }))
  return { client: { rpc } as never, rpc }
}

const verdict = (allowed: boolean, reason: string) => ({ data: [{ allowed, reason }] })

beforeEach(() => {
  vi.restoreAllMocks()
  env.SUPABASE_URL = SUPABASE_URL
  env.MEGGA_MAGIC_LINK_HMAC_SECRET = 'x'.repeat(40)
})

describe('emailSendAllowed — le verdict', () => {
  it('interroge la RPC avec l’adresse, la finalité et le contact', async () => {
    const a = admin(verdict(true, 'ok'))
    await emailSendAllowed(a.client, { to: 'A@Exemple.CH', purpose: 'relance', contactId: 'c-1' })
    expect(a.rpc).toHaveBeenCalledWith('email_send_allowed', {
      p_email: 'A@Exemple.CH', p_purpose: 'relance', p_contact_id: 'c-1',
    })
  })

  it('rend le refus TEL QUEL — `unsubscribed` n’est pas une panne', async () => {
    const a = admin(verdict(false, 'unsubscribed'))
    expect(await emailSendAllowed(a.client, { to: 'a@b.ch', purpose: 'relance' }))
      .toEqual({ allowed: false, reason: 'unsubscribed' })
  })

  it('⛔ échoue FERMÉ sur un verdict indisponible — une relance ne part pas dans le doute', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const panne of [{ error: { message: 'connection reset' } }, { data: [] }, { data: null }]) {
      const a = admin(panne)
      expect(await emailSendAllowed(a.client, { to: 'a@b.ch', purpose: 'relance' }))
        .toEqual({ allowed: false, reason: 'guard_unavailable' })
    }
    expect(err).toHaveBeenCalled()
  })

  it('⛔ échoue OUVERT en TRANSACTIONNEL — refuser priverait la personne d’une réponse attendue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const a = admin({ error: { message: 'timeout' } })
    expect(await emailSendAllowed(a.client, { to: 'a@b.ch', purpose: 'transactional' }))
      .toEqual({ allowed: true, reason: 'ok_transactional' })
  })
})

describe('unsubscribeHeaders — le lien qui doit ÉCRIRE', () => {
  it('⛔ RÉGRESSION — pointe sur le hôte des EDGE FUNCTIONS, jamais sur app.megga.ch', async () => {
    // `app.megga.ch` est du Cloudflare Pages avec fallback SPA : mesuré le 15.08.2026, le GET
    // du pied de page y rend la coquille de l'app en `200 text/html` et le POST one-click de
    // Gmail rend `405`. La personne voyait « c'est fait » et AUCUNE ligne
    // `contact_suppressions` n'était écrite — un mécanisme légalement exigé qui échoue en
    // signalant le succès.
    const u = await unsubscribeHeaders('a@b.ch')
    expect(u).not.toBeNull()
    expect(u!.url.startsWith(`${SUPABASE_URL}/functions/v1/email-unsubscribe?t=`)).toBe(true)
    expect(u!.url).not.toContain('app.megga.ch')
  })

  it('porte le couple RFC 8058 que Gmail et Outlook attendent', async () => {
    const u = await unsubscribeHeaders('a@b.ch')
    expect(u!.headers['List-Unsubscribe']).toBe(`<${u!.url}>`)
    expect(u!.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('le jeton porte l’ADRESSE en minuscules, pas seulement un identifiant de ligne', async () => {
    // La personne qui se désinscrit n'existe pas forcément dans nos contacts (destinataire
    // transféré, adresse de suivi) : sans l'adresse, il n'y aurait rien à bloquer.
    const { verifyMagicLinkToken } = await import('./magic-link-token.ts')
    const u = await unsubscribeHeaders('  Alice@Exemple.CH ', 'c-9')
    const t = new URL(u!.url).searchParams.get('t')!
    const v = await verifyMagicLinkToken(t)
    expect(v.valid).toBe(true)
    expect(v.payload?.k).toBe('unsub')
    expect(v.payload?.e).toBe('alice@exemple.ch')
    expect(v.payload?.id).toBe('c-9')
  })

  it('sans contact, le jeton reste valide — l’adresse suffit', async () => {
    const { verifyMagicLinkToken } = await import('./magic-link-token.ts')
    const u = await unsubscribeHeaders('a@b.ch')
    const v = await verifyMagicLinkToken(new URL(u!.url).searchParams.get('t')!)
    expect(v.payload?.id).toBe('-')
  })

  it('rend null — et le DIT — plutôt que de fabriquer un lien mort', async () => {
    // Un lien non signé, ou construit sur une base absente, serait pire que pas de lien :
    // il ferait croire à la personne que son refus a été pris en compte.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    env.SUPABASE_URL = undefined
    expect(await unsubscribeHeaders('a@b.ch')).toBeNull()
    env.SUPABASE_URL = SUPABASE_URL
    env.MEGGA_MAGIC_LINK_HMAC_SECRET = undefined
    expect(await unsubscribeHeaders('a@b.ch')).toBeNull()
    expect(err).toHaveBeenCalledTimes(2)
  })
})

describe('unsubscribeFooterHtml — le pied de page', () => {
  it('rend le lien dans les quatre langues du produit', async () => {
    const url = 'https://x.test/u?t=1'
    for (const [lang, mot] of [['fr', 'désinscrire'], ['en', 'Unsubscribe'], ['de', 'Abmelden'], ['it', 'Cancellarsi']]) {
      const html = unsubscribeFooterHtml(url, lang)
      expect(html, lang).toContain(`href="${url}"`)
      expect(html, lang).toContain(mot)
    }
  })

  it('retombe sur le français pour une langue inconnue, jamais sur du vide', async () => {
    // Un pied de page vide serait un e-mail sans porte de sortie — le défaut qu'on ferme.
    const html = unsubscribeFooterHtml('https://x.test/u', 'rm')
    expect(html).toContain('désinscrire')
  })
})
