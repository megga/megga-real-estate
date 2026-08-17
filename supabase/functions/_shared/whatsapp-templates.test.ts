import { describe, it, expect } from 'vitest'
import {
  buildTemplateMessage,
  configuredTemplateKeys,
  templateBodyText,
  WA_TEMPLATE_KEYS,
  WA_TEMPLATE_LANGS,
} from './whatsapp-templates.ts'
import { getProvider } from './whatsapp-gateway.ts'

// env factice : renvoie undefined pour toute clé absente de la map.
const mkEnv = (map: Record<string, string>) => (k: string): string | undefined => map[k]

describe('whatsapp-templates — registre', () => {
  it('renvoie null si le template n\'est pas configuré (nom approuvé absent)', () => {
    expect(buildTemplateMessage('followup', '41790000000', {}, mkEnv({}))).toBeNull()
  })

  it('construit le message quand le nom approuvé est posé en env', () => {
    const env = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'relance_suivi_v1' })
    const msg = buildTemplateMessage('followup', '41790000000', { clientFirstName: 'Jean', agentName: 'Gregory' }, env)
    expect(msg).toEqual({
      toPhone: '41790000000',
      templateName: 'relance_suivi_v1',
      languageCode: 'fr',
      bodyParams: ['Jean', 'Gregory'],
    })
  })

  it('langue par défaut fr, surchargée par l\'env _LANG', () => {
    const base = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'relance_suivi_v1' })
    expect(buildTemplateMessage('followup', '4179', {}, base)?.languageCode).toBe('fr')
    const de = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'relance_suivi_v1', WA_TEMPLATE_FOLLOWUP_LANG: 'de' })
    expect(buildTemplateMessage('followup', '4179', {}, de)?.languageCode).toBe('de')
  })

  it('remplit des paramètres NON VIDES (repli si contexte manquant — Meta rejette un param vide)', () => {
    const env = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'relance_suivi_v1' })
    const msg = buildTemplateMessage('followup', '4179', { clientFirstName: '  ', agentName: '' }, env)
    // Le repli n'est PAS « Bonjour » : le corps commence déjà par « Bonjour {{1}} »,
    // ce qui donnait « Bonjour Bonjour, ». C'est une formule d'adresse.
    expect(msg?.bodyParams).toEqual(['Madame, Monsieur', 'votre agent'])
    expect(msg?.bodyParams?.every((p) => p.trim().length > 0)).toBe(true)
  })

  it('les replis suivent la LANGUE du message (jamais de français dans un corps allemand)', () => {
    const env = mkEnv({ WA_TEMPLATE_AVAILABILITY: 'creneau_v1' })
    const de = buildTemplateMessage('availability', '4179', { lang: 'de' }, env)
    expect(de?.languageCode).toBe('de')
    expect(de?.bodyParams).toEqual(['geschätzte Kundin, geschätzter Kunde', 'Ihr Ansprechpartner', 'eine Besichtigung'])
    // Aucun repli ne doit contenir de mot français quand la langue ne l'est pas.
    for (const lang of ['de', 'en', 'it']) {
      const m = buildTemplateMessage('availability', '4179', { lang }, env)
      expect(m?.bodyParams?.join(' ')).not.toMatch(/votre|une visite|Madame/)
    }
  })

  it('la langue du destinataire prime sur la surcharge d\'env', () => {
    const env = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'relance_suivi_v1', WA_TEMPLATE_FOLLOWUP_LANG: 'de' })
    expect(buildTemplateMessage('followup', '4179', { lang: 'it' }, env)?.languageCode).toBe('it')
    // Une langue inconnue est ignorée, elle ne doit pas être transmise à Meta.
    expect(buildTemplateMessage('followup', '4179', { lang: 'es' }, env)?.languageCode).toBe('de')
  })

  it('new_listings : count → chaîne, minimum 1', () => {
    const env = mkEnv({ WA_TEMPLATE_NEW_LISTINGS: 'nouveaux_biens_v1' })
    expect(buildTemplateMessage('new_listings', '4179', { count: 3 }, env)?.bodyParams).toEqual(['Madame, Monsieur', '3'])
    expect(buildTemplateMessage('new_listings', '4179', { count: 0 }, env)?.bodyParams).toEqual(['Madame, Monsieur', '1'])
    expect(buildTemplateMessage('new_listings', '4179', {}, env)?.bodyParams).toEqual(['Madame, Monsieur', '1'])
  })

  it('chaque template existe dans les 4 langues, avec les MÊMES variables dans le même ordre', () => {
    // Le garde-fou qui compte : bodyParams produit UN tableau ordonné pour toutes
    // les langues. Une traduction qui inverse {{1}} et {{2}} enverrait le nom de
    // l'agence à la place du prénom du client — invisible à la relecture.
    for (const k of WA_TEMPLATE_KEYS) {
      const fr = templateBodyText(k, 'fr')
      const refs = [...fr.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])
      for (const lang of WA_TEMPLATE_LANGS) {
        const body = templateBodyText(k, lang)
        expect(body.length, `${k}/${lang} vide`).toBeGreaterThan(0)
        expect([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]), `${k}/${lang}`).toEqual(refs)
        // Règles Meta de forme : pas de variable en tout début ni en toute fin.
        expect(body.trimStart().startsWith('{{'), `${k}/${lang} commence par une variable`).toBe(false)
        expect(body.trimEnd().endsWith('}}'), `${k}/${lang} finit par une variable`).toBe(false)
        expect(body, `${k}/${lang} variables adjacentes`).not.toMatch(/\}\}\s*\{\{/)
      }
      // Usage suisse : ß interdit en allemand.
      expect(templateBodyText(k, 'de'), `${k}/de contient un ß`).not.toMatch(/ß/)
    }
  })

  it('configuredTemplateKeys ne liste que les templates activés', () => {
    expect(configuredTemplateKeys(mkEnv({}))).toEqual([])
    expect(configuredTemplateKeys(mkEnv({ WA_TEMPLATE_AVAILABILITY: 'creneau_v1' }))).toEqual(['availability'])
    const all = mkEnv({
      WA_TEMPLATE_FOLLOWUP: 'a',
      WA_TEMPLATE_AVAILABILITY: 'b',
      WA_TEMPLATE_NEW_LISTINGS: 'c',
      WA_TEMPLATE_AGENT_DAILY_BRIEF: 'd',
      WA_TEMPLATE_KYC_DOCUMENTS_MISSING: 'e',
      WA_TEMPLATE_NUMBER_VERIFICATION: 'f',
    })
    expect(configuredTemplateKeys(all)).toEqual(WA_TEMPLATE_KEYS)
  })

  it('templateBodyText documente le corps type (pour la soumission Meta)', () => {
    for (const k of WA_TEMPLATE_KEYS) {
      expect(templateBodyText(k)).toContain('{{1}}')
    }
  })
})

describe('whatsapp-gateway — buildSendTemplateRequest (Meta)', () => {
  const config = { metaToken: 'TOK', metaPhoneNumberId: '123', metaApiVersion: 'v22.0' }

  it('construit le payload template Meta avec composant body quand il y a des paramètres', () => {
    const meta = getProvider('meta')
    const req = meta.buildSendTemplateRequest!(
      { toPhone: '41790000000', templateName: 'relance_suivi_v1', languageCode: 'fr', bodyParams: ['Jean', 'Gregory'] },
      config,
    )
    expect(req.url).toBe('https://graph.facebook.com/v22.0/123/messages')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '41790000000',
      type: 'template',
      template: {
        name: 'relance_suivi_v1',
        language: { code: 'fr' },
        components: [{
          type: 'body',
          parameters: [{ type: 'text', text: 'Jean' }, { type: 'text', text: 'Gregory' }],
        }],
      },
    })
  })

  it('omet le composant body pour un template SANS paramètre', () => {
    const meta = getProvider('meta')
    const req = meta.buildSendTemplateRequest!(
      { toPhone: '4179', templateName: 'ping_v1', languageCode: 'fr' },
      config,
    )
    const body = JSON.parse(req.body)
    expect(body.template.components).toBeUndefined()
    expect(body.template).toEqual({ name: 'ping_v1', language: { code: 'fr' } })
  })

  // Ce test vérifiait qu'OpenWA n'exposait pas buildSendTemplateRequest. OpenWA a
  // été retiré (audit §4.2) : la propriété qui reste utile est que Meta, lui,
  // l'expose — l'envoi hors fenêtre 24 h en dépend.
  it('Meta expose bien buildSendTemplateRequest — l\'envoi hors fenêtre 24 h en dépend', () => {
    expect(getProvider('meta').buildSendTemplateRequest).toBeTypeOf('function')
  })
})
