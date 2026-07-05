import { describe, it, expect } from 'vitest'
import {
  buildTemplateMessage,
  configuredTemplateKeys,
  templateBodyText,
  WA_TEMPLATE_KEYS,
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
    expect(msg?.bodyParams).toEqual(['Bonjour', 'votre agent'])
    expect(msg?.bodyParams?.every((p) => p.trim().length > 0)).toBe(true)
  })

  it('new_listings : count → chaîne, minimum 1', () => {
    const env = mkEnv({ WA_TEMPLATE_NEW_LISTINGS: 'nouveaux_biens_v1' })
    expect(buildTemplateMessage('new_listings', '4179', { count: 3 }, env)?.bodyParams).toEqual(['Bonjour', '3'])
    expect(buildTemplateMessage('new_listings', '4179', { count: 0 }, env)?.bodyParams).toEqual(['Bonjour', '1'])
    expect(buildTemplateMessage('new_listings', '4179', {}, env)?.bodyParams).toEqual(['Bonjour', '1'])
  })

  it('configuredTemplateKeys ne liste que les templates activés', () => {
    expect(configuredTemplateKeys(mkEnv({}))).toEqual([])
    expect(configuredTemplateKeys(mkEnv({ WA_TEMPLATE_AVAILABILITY: 'creneau_v1' }))).toEqual(['availability'])
    const all = mkEnv({ WA_TEMPLATE_FOLLOWUP: 'a', WA_TEMPLATE_AVAILABILITY: 'b', WA_TEMPLATE_NEW_LISTINGS: 'c' })
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

  it('provider OpenWA n\'expose pas buildSendTemplateRequest (méthode absente)', () => {
    const openwa = getProvider('openwa')
    expect(openwa.buildSendTemplateRequest).toBeUndefined()
  })
})
