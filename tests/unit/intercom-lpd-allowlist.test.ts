import { describe, it, expect } from 'vitest'
import { sanitizeIntercomArgs } from '@/lib/intercom-allowlist'

// Garde-fou LPD : aucune donnée hors allowlist ne doit pouvoir partir vers Intercom
// (workspace US). Ce test échoue si quelqu'un élargit le payload sans passer par l'allowlist.
describe('Intercom LPD allowlist — sanitizeIntercomArgs', () => {
  it('laisse passer les attributs SaaS agent autorisés', () => {
    const { sanitized, dropped } = sanitizeIntercomArgs({
      user_id: 'u1',
      email: 'agent@getmegga.com',
      name: 'Agent Test',
      role: 'agent',
      canton: 'GE',
    })
    expect(dropped).toEqual([])
    expect(sanitized).toMatchObject({ user_id: 'u1', role: 'agent', canton: 'GE' })
  })

  it("laisse passer `produit`, le libellé qui trie l'espace Intercom partagé", () => {
    // Un seul espace Intercom sert la holding ('holding'), le CRM ('crm') et Shield
    // ('shield'). Si `produit` était strippé, les conversations du CRM arriveraient
    // sans étiquette dans la boîte commune — et rien ne le dirait.
    const { sanitized, dropped } = sanitizeIntercomArgs({ user_id: 'u1', produit: 'crm' })
    expect(dropped).toEqual([])
    expect(sanitized).toEqual({ user_id: 'u1', produit: 'crm' })
  })

  it('STRIP toute clé hors allowlist (PII / donnée client final potentielle)', () => {
    const { sanitized, dropped } = sanitizeIntercomArgs({
      user_id: 'u1',
      client_email: 'buyer@example.com', // contact d'un client final → interdit
      kyc_status: 'flagged', // donnée KYC → interdit
      deal_amount: 720000, // montant d'affaire → interdit
    })
    expect(sanitized).toEqual({ user_id: 'u1' })
    expect(dropped).toEqual(expect.arrayContaining(['client_email', 'kyc_status', 'deal_amount']))
  })

  it("filtre aussi les clés non autorisées DANS l'objet company", () => {
    const { sanitized, dropped } = sanitizeIntercomArgs({
      company: { company_id: 'a1', name: 'Agence X', stripe_customer_id: 'cus_1', client_name: 'M. Acheteur' },
    })
    expect(sanitized.company).toEqual({ company_id: 'a1', name: 'Agence X' })
    expect(dropped).toContain('company.client_name')
    // Audit S13 : un identifiant Stripe posé par le navigateur est falsifiable — il ne part
    // plus vers Intercom, le client Stripe se résout côté serveur depuis company_id.
    expect(dropped).toContain('company.stripe_customer_id')
  })

  it('gère un payload vide sans rien casser', () => {
    expect(sanitizeIntercomArgs()).toEqual({ sanitized: {}, dropped: [] })
  })
})
