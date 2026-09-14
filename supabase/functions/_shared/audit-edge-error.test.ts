import { describe, it, expect } from 'vitest'
import { buildEdgeErrorEvent, redactedErrorMessage } from './audit-edge-error.ts'

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

// S14 (13.09.2026) : le texte que les fonctions JOURNALISENT au lieu de le renvoyer.
describe('redactedErrorMessage', () => {
  it('lit une erreur PostgREST par son code et son message, jamais par ses `details`', () => {
    // `details` porte la valeur fautive de la ligne — une adresse que redactPII ne
    // caviarde pas. La sérialiser entière l'aurait écrite dans les journaux.
    const pg = {
      message: 'duplicate key value violates unique constraint "mail_accounts_agency_email_key"',
      code: '23505',
      details: 'Key (email)=(prospect@example.org) already exists.',
      hint: null,
    }
    const texte = redactedErrorMessage(pg)
    expect(texte).toBe('[23505] duplicate key value violates unique constraint "mail_accounts_agency_email_key"')
    expect(texte).not.toContain('prospect@example.org')
  })

  it('caviarde un jeton recopié par un fournisseur, et tronque au plafond demandé', () => {
    // Forme émise par _shared/magic-link-token.ts : <base64url(payload)>.<base64url(HMAC)>.
    const jeton = 'eyJpZCI6ImFiY2QtMTIzNCIsImV4cCI6MTc1MDAwMDAwMH0.Q2hhbmdlTWVJbkEtVmFsaWQtU2lnbmF0dXJlLTEyMzQ1'
    const texte = redactedErrorMessage(new Error(`could not load https://app.example.org/kyc/${jeton}`))
    expect(texte).not.toContain(jeton)
    expect(texte).toContain('REDACTED')
    expect(redactedErrorMessage(new Error('x'.repeat(50)), 10)).toBe(`${'x'.repeat(10)}…`)
  })

  it('reste lisible sur une chaîne, un objet sans message, et rien du tout', () => {
    expect(redactedErrorMessage('panne texte')).toBe('panne texte')
    expect(redactedErrorMessage({ code: 500 })).toBe('{"code":500}')
    expect(redactedErrorMessage(undefined)).toBe('null')
  })
})
