import { describe, it, expect } from 'vitest'
import {
  sanitizeIntercomArgs,
  INTERCOM_ALLOWED_KEYS,
  INTERCOM_ALLOWED_CONFIG_KEYS,
} from '@/lib/intercom-allowlist'

// Garde-fou LPD : aucune donnée hors allowlist ne doit pouvoir partir vers Intercom
// (workspace US). Ce test échoue si quelqu'un élargit le payload sans passer par l'allowlist.
describe('Intercom LPD allowlist — sanitizeIntercomArgs', () => {
  it('laisse passer les attributs SaaS agent autorisés', () => {
    const { sanitized, dropped } = sanitizeIntercomArgs({
      user_id: 'u1',
      email: 'agent@megga.ch',
      name: 'Agent Test',
      role: 'agent',
      canton: 'GE',
    })
    expect(dropped).toEqual([])
    expect(sanitized).toMatchObject({ user_id: 'u1', role: 'agent', canton: 'GE' })
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
    expect(sanitized.company).toEqual({ company_id: 'a1', name: 'Agence X', stripe_customer_id: 'cus_1' })
    expect(dropped).toContain('company.client_name')
  })

  it('gère un payload vide sans rien casser', () => {
    expect(sanitizeIntercomArgs()).toEqual({ sanitized: {}, dropped: [] })
  })

  // Les clés de config traversent le MÊME filtre que les données : oublier d'y
  // inscrire `hide_default_launcher` le ferait supprimer en silence (le
  // `console.error` de intercom.ts ne parle qu'en DEV), et la bulle native
  // resterait à l'écran sans qu'aucun test ne rougisse.
  it('laisse passer les clés de configuration du SDK', () => {
    const { sanitized, dropped } = sanitizeIntercomArgs({ hide_default_launcher: true })
    expect(dropped).toEqual([])
    expect(sanitized).toEqual({ hide_default_launcher: true })
  })

  // La séparation des deux listes n'a de valeur que si elle tient : une clé de
  // donnée glissée parmi la config échapperait à la relecture LPD, qui ne
  // regarde que `INTERCOM_ALLOWED_KEYS`.
  it('ne mélange jamais config et données dans la même liste', () => {
    const data: readonly string[] = INTERCOM_ALLOWED_KEYS
    const config: readonly string[] = INTERCOM_ALLOWED_CONFIG_KEYS
    expect(config.filter(k => data.includes(k))).toEqual([])
    // Une clé de config ne porte aucune valeur venant d'un humain : elle est
    // écrite en dur par le code, jamais dérivée d'un profil ou d'un contact.
    expect(config).toEqual(['app_id', 'region', 'hide_default_launcher'])
  })
})
