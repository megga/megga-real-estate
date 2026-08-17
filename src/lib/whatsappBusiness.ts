// Le numéro WhatsApp Business de MEGGA — celui auquel l'agent envoie son code
// d'appairage, et celui que le client compose.
//
// ⛔ POURQUOI CE FICHIER EXISTE. Le numéro était écrit en dur dans
// `WhatsAppPairingCard.tsx`, et il y est resté PÉRIMÉ : la bascule de portefeuille
// Meta du 14.08.2026 a remplacé toute la chaîne (nouveau WABA, nouveau numéro), mais
// la carte des Réglages continuait d'afficher l'ancien numéro pilote
// `+41 79 874 94 84`. Mesuré le 17.08.2026 sur `whatsapp_messages` : le dernier
// entrant sur l'ancien numéro date du 10.08, les entrants de prod arrivent depuis le
// 15.08 sur `+41 22 567 00 75`. Autrement dit, tout agent qui s'appariait depuis la
// bascule envoyait son code dans le vide, sans le moindre message d'erreur — le
// parcours ATTEND, il n'échoue pas.
//
// La leçon n'est pas « ce numéro-ci était faux » mais « un numéro d'infrastructure
// recopié dans un composant d'écran ne survit pas à un changement d'infrastructure ».
// D'où : une seule déclaration, nommée, datée, avec son identifiant Meta à côté pour
// qu'on puisse la confronter à la console.

/**
 * Numéro Business MEGGA, chiffres seuls (format `wa.me` / `wa_id` Meta).
 *
 * Source de vérité : WABA `1816378669743304`, `META_PHONE_NUMBER_ID=1325722760614638`
 * (portefeuille `2413061865797461`, vérifié le 14.08.2026).
 *
 * ⚠ À changer ICI, et nulle part ailleurs, le jour où le numéro Business change —
 * en même temps que le secret `META_PHONE_NUMBER_ID`. Les deux vont par paire : un
 * numéro affiché qui ne correspond pas au `phone_number_id` configuré redonne
 * exactement la panne silencieuse décrite plus haut.
 */
export const MEGGA_WA_BUSINESS_DIGITS = '41225670075'

/**
 * Mise en forme suisse d'un numéro international : `41225670075` → `+41 22 567 00 75`.
 *
 * Le groupement EST l'information — un Suisse reconnaît son propre format et recopie
 * sans faute ; une suite de onze chiffres collés se recopie de travers. Hypothèse
 * assumée : indicatif à 2 chiffres puis national à 9 (E.164 CH). Tout numéro qui ne
 * rentre pas dans ce moule est rendu tel quel, précédé d'un `+` — mieux vaut un
 * numéro non groupé qu'un numéro mal découpé.
 */
export function formatWaBusinessNumber(digits: string = MEGGA_WA_BUSINESS_DIGITS): string {
  const d = (digits || '').replace(/\D/g, '')
  if (d.length !== 11 || !d.startsWith('41')) return d ? `+${d}` : ''
  return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`
}
