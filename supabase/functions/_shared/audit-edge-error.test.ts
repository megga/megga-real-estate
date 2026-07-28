import { describe, it, expect } from 'vitest'
import { buildEdgeErrorEvent } from './audit-edge-error.ts'

describe('buildEdgeErrorEvent', () => {
  it('produit la forme que le monitoring sait lire', () => {
    const evt = buildEdgeErrorEvent('flatfox-sync', new Error('boom'))

    // Ces clés SONT le contrat : useAdminMonitoring regroupe par
    // metadata.function_name et affiche metadata.error.
    expect(evt.metadata.function_name).toBe('flatfox-sync')
    expect(evt.metadata.error).toBe('boom')
    expect(evt.action).toBe('edge_function_error')
    expect(evt.entity_type).toBe('edge_function')
    // Le bento d'alertes ne lit que warn/critical : une panne est critique.
    expect(evt.severity).toBe('critical')
  })

  it("respecte la contrainte de cohérence d'acteur", () => {
    const evt = buildEdgeErrorEvent('kyc-screening', new Error('x'))
    // activity_events_actor_kind_coherence : actor_id non nul ⇒ actor_kind='user'.
    // Une panne n'a pas d'auteur humain, donc actor_id DOIT rester nul.
    expect(evt.actor_id).toBeNull()
    expect(evt.actor_kind).toBe('system')
  })

  it('caviarde les secrets recopiés dans le message', () => {
    const evt = buildEdgeErrorEvent(
      'stripe-webhook',
      new Error('auth refusée pour sk-abcdefghijklmnopqrstuvwxyz012345'),
    )
    expect(evt.metadata.error).not.toContain('sk-abcdefghijklmnopqrstuvwxyz012345')
    expect(String(evt.metadata.error)).toContain('REDACTED')
  })

  it('tronque un message trop long plutôt que de stocker une stack entière', () => {
    const evt = buildEdgeErrorEvent('x', new Error('a'.repeat(2000)))
    const msg = String(evt.metadata.error)
    expect(msg.length).toBeLessThanOrEqual(501)
    expect(msg.endsWith('…')).toBe(true)
  })

  it("n'ajoute la durée que si un début est fourni", () => {
    expect(buildEdgeErrorEvent('x', new Error('e')).metadata.duration_ms).toBeUndefined()
    const timed = buildEdgeErrorEvent('x', new Error('e'), { startedAt: Date.now() - 50 })
    expect(timed.metadata.duration_ms as number).toBeGreaterThanOrEqual(50)
  })

  it('reste lisible sur une erreur qui n\'est pas une Error', () => {
    expect(buildEdgeErrorEvent('x', 'panne texte').metadata.error).toBe('panne texte')
    expect(buildEdgeErrorEvent('x', { code: 500 }).metadata.error).toBe('{"code":500}')
  })

  it('rattache à une agence quand la fonction en sert une', () => {
    expect(buildEdgeErrorEvent('x', new Error('e')).agency_id).toBeNull()
    expect(buildEdgeErrorEvent('x', new Error('e'), { agencyId: 'ag-1' }).agency_id).toBe('ag-1')
  })
})
