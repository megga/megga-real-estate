import { describe, it, expect } from 'vitest'
import {
  COPILOT_TOOLS, SHARED_READ_TOOLS, SHARED_WRITE_TOOLS, webToolTier, COPILOT_TOOLS_BLOCK,
  copilotTools, copilotToolsBlock,
} from './copilot-tools'
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
  it('mode lecture seule (compat) : annonce l\'absence d\'écriture', () => {
    expect(COPILOT_TOOLS_BLOCK).toMatch(/aucun outil d'écriture/i)
  })
})

describe('écritures gated (Phase 4a)', () => {
  it('copilotTools(false) = lecture seule, aucun outil d\'écriture', () => {
    const names = copilotTools(false).map((t) => t.function.name)
    for (const w of SHARED_WRITE_TOOLS) expect(names).not.toContain(w)
    // équivaut au catalogue read-only historique
    expect(names.sort()).toEqual(COPILOT_TOOLS.map((t) => t.function.name).sort())
  })

  it('copilotTools(true) ajoute les écritures internes (rappel/note + montage de bien) et AUCUN envoi/publication', () => {
    const names = copilotTools(true).map((t) => t.function.name)
    expect(names).toContain('create_reminder')
    expect(names).toContain('add_note')
    expect(names).toContain('create_property')
    expect(names).toContain('update_property')
    // aucun outil d'envoi client NI de publication externe ne s'y glisse (la
    // publication est confirm-tier, gated à part, jamais dans ce catalogue d'écritures)
    for (const forbidden of ['send_client_message', 'send_client_email', 'update_pipeline', 'record_offer', 'send_listings', 'publish_to_portals', 'withdraw_from_portals']) {
      expect(names).not.toContain(forbidden)
    }
  })

  it('les outils d\'écriture v1 sont bien tier auto (jamais read ni confirm)', () => {
    for (const w of SHARED_WRITE_TOOLS) expect(webToolTier(w)).toBe('auto')
  })

  it('copilotToolsBlock(true) autorise les 2 écritures et interdit l\'envoi client', () => {
    const b = copilotToolsBlock(true)
    expect(b).toMatch(/create_reminder/)
    expect(b).toMatch(/add_note/)
    expect(b).toMatch(/ne contactes JAMAIS un client/i)
  })

  it('copilotToolsBlock(false) reste lecture seule', () => {
    expect(copilotToolsBlock(false)).toMatch(/aucun outil d'écriture/i)
  })
})

describe('montage d\'annonce (Phase B — publication depuis le copilote CRM)', () => {
  it('draft_listing_copy est READ : présent même en lecture seule', () => {
    expect(webToolTier('draft_listing_copy')).toBe('read')
    expect(copilotTools(false).map((t) => t.function.name)).toContain('draft_listing_copy')
  })

  it('create_property / update_property sont AUTO : absents en read-only, présents sous écritures', () => {
    const ro = copilotTools(false).map((t) => t.function.name)
    const rw = copilotTools(true).map((t) => t.function.name)
    for (const tool of ['create_property', 'update_property']) {
      expect(webToolTier(tool), `${tool} doit être auto`).toBe('auto')
      expect(ro, `${tool} ne doit PAS être exposé en lecture seule`).not.toContain(tool)
      expect(rw, `${tool} doit être exposé sous écritures`).toContain(tool)
    }
  })

  it('les descriptions web de create/update ne renvoient pas vers attach_property_photos (outil WhatsApp absent du web)', () => {
    const rw = copilotTools(true)
    for (const name of ['create_property', 'update_property']) {
      const t = rw.find((x) => x.function.name === name)
      expect(t?.function.description, `${name} description`).not.toContain('attach_property_photos')
    }
  })
})

describe('publication immobilier.ch (Phase C — confirm-tier gated)', () => {
  it('publish/withdraw sont CONFIRM (jamais read ni auto : la boucle ne les exécute pas)', () => {
    expect(webToolTier('publish_to_portals')).toBe('confirm')
    expect(webToolTier('withdraw_from_portals')).toBe('confirm')
  })

  it('absents tant que publishEnabled=false, même avec les écritures activées', () => {
    for (const names of [copilotTools(false), copilotTools(true), copilotTools(true, false)].map((c) => c.map((t) => t.function.name))) {
      expect(names).not.toContain('publish_to_portals')
      expect(names).not.toContain('withdraw_from_portals')
    }
  })

  it('présents quand publishEnabled=true (indépendant des écritures internes)', () => {
    const namesPublishOnly = copilotTools(false, true).map((t) => t.function.name)
    expect(namesPublishOnly).toContain('publish_to_portals')
    expect(namesPublishOnly).toContain('withdraw_from_portals')
    // get_publication_status (lecture) reste toujours dispo dès que les outils sont là
    expect(namesPublishOnly).toContain('get_publication_status')
    const namesBoth = copilotTools(true, true).map((t) => t.function.name)
    expect(namesBoth).toContain('publish_to_portals')
    expect(namesBoth).toContain('create_property')
  })

  it('la description web publish interdit de se confirmer soi-même (carte HITL)', () => {
    const t = copilotTools(false, true).find((x) => x.function.name === 'publish_to_portals')
    expect(t?.function.description).toMatch(/carte|valid/i)
    expect(t?.function.description).toMatch(/ne te confirme jamais toi-même|ne te confirme pas/i)
  })

  it('copilotToolsBlock(_, true) décrit la publication ; jamais de contradiction « aucune écriture »', () => {
    // publish sans écritures internes : pas de bloc « aucun outil d'écriture »
    const publishOnly = copilotToolsBlock(false, true)
    expect(publishOnly).toMatch(/PUBLICATION/i)
    expect(publishOnly).not.toMatch(/aucun outil d'écriture/i)
    // écritures + publication : les deux volets présents
    const both = copilotToolsBlock(true, true)
    expect(both).toMatch(/create_property/)
    expect(both).toMatch(/PUBLICATION/i)
  })
})
