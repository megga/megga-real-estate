// @vitest-environment node
// La table des prix Stripe (audit S15, 13.09.2026) : le checkout n'ouvre que des prix connus,
// et un secret absent ne fabrique pas d'entrée fantôme.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SECRETS_PRIX, tablePrixStripe, verifierPrix } from './stripe-prices'

const env = (vals: Record<string, string | undefined>) => (nom: string) => vals[nom]

describe('tablePrixStripe', () => {
  it('traduit chaque secret posé en plan et période', () => {
    const table = tablePrixStripe(env({
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
      STRIPE_PRICE_PRO_YEARLY: 'price_pro_y',
      STRIPE_PRICE_ENTREPRISE_MONTHLY: 'price_ent_m',
      STRIPE_PRICE_ENTREPRISE_YEARLY: 'price_ent_y',
    }))
    expect(table.size).toBe(4)
    expect(table.get('price_pro_y')).toEqual({ plan: 'pro', periode: 'yearly' })
    expect(table.get('price_ent_m')).toEqual({ plan: 'entreprise', periode: 'monthly' })
  })

  it('un secret absent ou vide ne crée AUCUNE entrée (l’ancien code posait la clé vide)', () => {
    const table = tablePrixStripe(env({ STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m', STRIPE_PRICE_PRO_YEARLY: '  ' }))
    expect([...table.keys()]).toEqual(['price_pro_m'])
    expect(table.has('')).toBe(false)
  })
})

describe('verifierPrix', () => {
  const table = tablePrixStripe(env({ STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m' }))

  it('CONTRÔLE POSITIF — un prix de la table passe, avec sa signification', () => {
    expect(verifierPrix('price_pro_m', table)).toEqual({ ok: true, prix: { plan: 'pro', periode: 'monthly' } })
  })

  it('un prix hors table est refusé en 400 price_not_allowed', () => {
    expect(verifierPrix('price_ancien_tarif', table)).toEqual({ ok: false, status: 400, error: 'price_not_allowed' })
    expect(verifierPrix(42, table)).toEqual({ ok: false, status: 400, error: 'price_not_allowed' })
    expect(verifierPrix(undefined, table)).toEqual({ ok: false, status: 400, error: 'price_not_allowed' })
  })

  it('table vide = facturation non configurée : 503, jamais un abonnement à l’aveugle', () => {
    expect(verifierPrix('price_pro_m', new Map())).toEqual({ ok: false, status: 503, error: 'stripe_prices_not_configured' })
  })
})

describe('les deux edges lisent la MÊME table', () => {
  const lire = (fn: string) => readFileSync(new URL(`../${fn}/index.ts`, import.meta.url), 'utf8')

  it('stripe-checkout vérifie le prix AVANT de créer le client ou la session Stripe', () => {
    const src = lire('stripe-checkout')
    const verif = src.indexOf('verifierPrix(')
    expect(verif).toBeGreaterThan(-1)
    expect(verif).toBeLessThan(src.indexOf('stripe.customers.create'))
    expect(verif).toBeLessThan(src.indexOf('stripe.checkout.sessions.create'))
  })

  it('stripe-webhook traduit un prix par la table partagée, plus par sa propre copie', () => {
    const src = lire('stripe-webhook')
    expect(src).toContain("from '../_shared/stripe-prices.ts'")
    // Contrôle : aucun nom de secret de prix n'est plus lu en direct dans le webhook.
    for (const nom of Object.keys(SECRETS_PRIX)) expect(src).not.toContain(`'${nom}'`)
  })
})
