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

// ⛔ `formatWaBusinessNumber` a été RETIRÉ d'ici le 17.08.2026. Il ne savait grouper que
// le suisse à onze chiffres, ce qui était juste tant qu'il ne servait qu'au numéro
// ci-dessus — suisse par construction. Réemployé pour le numéro PERSONNEL de l'agent sur
// trois surfaces, il rendait « +33612345678 » d'un bloc à un agent français, à l'endroit
// même où le champ de saisie venait de lui montrer « 6 12 34 56 78 ». La mise en forme
// vit désormais dans `@/lib/countries` sous le nom `formatInternationalPhone`, avec les
// indicatifs et les exemples dont elle dérive son groupement. Ce module ne garde que ce
// qui lui appartient vraiment : LE numéro de MEGGA.
