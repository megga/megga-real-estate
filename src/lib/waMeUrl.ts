// Construction du lien `wa.me` (= zéro intégration, zéro API) : le visiteur
// clique, WhatsApp (mobile) ou WhatsApp Web (desktop) s'ouvre avec le message
// d'amorce pré-rempli. Aucun branchement OpenWA / Meta requis.
//
// Vit ici, et non dans PxWhatsAppButton : ses autres appelants (la fiche contact,
// « Planifier une visite ») n'ont rien à voir avec la marketplace Property X.
// ⛔ Le matching n'en est plus un (21.09.2026) : il n'écrit jamais à l'acheteur.

/**
 * Construit l'URL wa.me. `phone` peut contenir +, espaces, tirets, parenthèses
 * — on ne garde que les chiffres (wa.me veut le format international sans +).
 */
export function buildWaMeUrl(phone: string, message?: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  const base = `https://wa.me/${digits}`
  const text = message?.trim()
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
