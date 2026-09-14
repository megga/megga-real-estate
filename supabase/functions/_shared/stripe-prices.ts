// supabase/functions/_shared/stripe-prices.ts
//
// La table des prix Stripe de MEGGA — la SEULE que le checkout accepte et que le webhook lit.
//
// ⛔ Avant l'audit du 13.09.2026 (point S15), `stripe-checkout` transmettait à Stripe le
// `priceId` envoyé par le navigateur, sans le confronter à rien : n'importe quel prix du
// compte Stripe (un prix de test, un ancien tarif, un prix créé pour un autre usage) ouvrait
// un abonnement. Le webhook, lui, ramenait tout prix inconnu à « starter » — la table vivait
// donc déjà ici, mais d'un seul côté. Elle est désormais commune : un prix que le webhook ne
// saurait pas traduire en plan ne peut plus être souscrit.
//
// Les identifiants viennent des secrets de la fonction, jamais du corps d'une requête. Une
// clé absente ou vide ne crée aucune entrée : l'ancien code posait `''` en clé, et le dernier
// secret manquant gagnait (`''` → 'entreprise').
//
// Module pur, sans dépendance Deno : testé par `stripe-prices.test.ts`.

/** Plan payant qu'un prix Stripe ouvre. */
export type PlanPaye = 'pro' | 'entreprise'

/** Ce qu'un prix Stripe connu signifie pour MEGGA. */
export interface PrixStripe {
  plan: PlanPaye
  periode: 'monthly' | 'yearly'
}

/** Nom du secret → signification. Miroir de `STRIPE_PRICES` (src/lib/constants.ts) côté front. */
export const SECRETS_PRIX: Readonly<Record<string, PrixStripe>> = {
  STRIPE_PRICE_PRO_MONTHLY: { plan: 'pro', periode: 'monthly' },
  STRIPE_PRICE_PRO_YEARLY: { plan: 'pro', periode: 'yearly' },
  STRIPE_PRICE_ENTREPRISE_MONTHLY: { plan: 'entreprise', periode: 'monthly' },
  STRIPE_PRICE_ENTREPRISE_YEARLY: { plan: 'entreprise', periode: 'yearly' },
}

/** Identifiant de prix Stripe → plan et période, pour les seuls secrets posés et non vides. */
export function tablePrixStripe(lireSecret: (nom: string) => string | undefined): Map<string, PrixStripe> {
  const table = new Map<string, PrixStripe>()
  for (const [nom, sens] of Object.entries(SECRETS_PRIX)) {
    const id = lireSecret(nom)?.trim()
    if (id) table.set(id, sens)
  }
  return table
}

/** Verdict du checkout sur un `priceId` reçu du navigateur. */
export type VerdictPrix =
  | { ok: true; prix: PrixStripe }
  | { ok: false; status: 400 | 503; error: 'price_not_allowed' | 'stripe_prices_not_configured' }

/**
 * Le checkout n'ouvre que des prix de la table. Table vide = facturation non configurée :
 * 503, bruyant et lisible, plutôt qu'un abonnement sur un prix que le webhook ne saurait pas lire.
 */
export function verifierPrix(priceId: unknown, table: Map<string, PrixStripe>): VerdictPrix {
  if (table.size === 0) return { ok: false, status: 503, error: 'stripe_prices_not_configured' }
  const prix = typeof priceId === 'string' ? table.get(priceId) : undefined
  return prix ? { ok: true, prix } : { ok: false, status: 400, error: 'price_not_allowed' }
}
