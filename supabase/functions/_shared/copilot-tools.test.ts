import { describe, it, expect } from 'vitest'
import { COPILOT_TOOLS, SHARED_READ_TOOLS, webToolTier, COPILOT_TOOLS_BLOCK } from './copilot-tools'
import { toolTier } from './whatsapp-agent-router'

describe('catalogue copilote web — invariant lecture seule', () => {
  it('tous les outils WhatsApp réutilisés sont bien tier read', () => {
    for (const name of SHARED_READ_TOOLS) {
      expect(toolTier(name), `${name} doit être read`).toBe('read')
    }
  })

  it('webToolTier classe les 3 outils web comme read', () => {
    expect(webToolTier('suggest_priorities_today')).toBe('read')
    expect(webToolTier('get_analytics_snapshot')).toBe('read')
    expect(webToolTier('get_market_stats')).toBe('read')
  })

  it('webToolTier délègue au registre WhatsApp pour les écritures (jamais read)', () => {
    // Ces outils ne sont PAS dans le catalogue web, mais si le modèle les nomme,
    // le tier ne doit jamais être 'read' (la boucle read-only les refuserait).
    expect(webToolTier('send_client_message')).not.toBe('read')
    expect(webToolTier('update_pipeline')).not.toBe('read')
    expect(webToolTier('create_contact')).not.toBe('read')
  })

  it('outil inconnu → tier fail-safe ≠ read (confirm)', () => {
    expect(webToolTier('rm_rf_prod')).toBe('confirm')
  })
})

describe('COPILOT_TOOLS — composition du catalogue', () => {
  const names = COPILOT_TOOLS.map((t) => t.function.name)

  it('contient les 3 outils web spécifiques', () => {
    expect(names).toContain('suggest_priorities_today')
    expect(names).toContain('get_analytics_snapshot')
    expect(names).toContain('get_market_stats')
  })

  it('contient les outils read partagés (agenda, contacts, matches, marché…)', () => {
    for (const name of SHARED_READ_TOOLS) expect(names).toContain(name)
  })

  it('n\'expose AUCUN outil d\'écriture/envoi', () => {
    const forbidden = ['send_client_message', 'send_client_email', 'update_pipeline', 'create_contact', 'record_offer', 'open_kyc_case', 'send_listings']
    for (const f of forbidden) expect(names, `${f} ne doit pas être exposé`).not.toContain(f)
  })

  it('chaque outil expose un schéma function-calling valide', () => {
    for (const t of COPILOT_TOOLS) {
      expect(t.type).toBe('function')
      expect(typeof t.function.name).toBe('string')
      expect(typeof t.function.description).toBe('string')
      expect(t.function.parameters).toBeTruthy()
    }
  })

  it('la description web de search_listings ne renvoie pas vers send_listings', () => {
    const sl = COPILOT_TOOLS.find((t) => t.function.name === 'search_listings')
    expect(sl?.function.description).not.toContain('send_listings')
  })
})

describe('COPILOT_TOOLS_BLOCK', () => {
  it('rappelle la lecture seule et l\'absence d\'écriture', () => {
    expect(COPILOT_TOOLS_BLOCK).toMatch(/LECTURE/)
    expect(COPILOT_TOOLS_BLOCK).toMatch(/aucun outil d'écriture/i)
  })
})
