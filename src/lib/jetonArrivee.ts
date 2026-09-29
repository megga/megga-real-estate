/**
 * Le jeton d'arrivée (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.2) — module PUR : ni React,
 * ni routeur, ni Supabase.
 *
 * Une ARRIVÉE est ce qu'un lien demande à l'écran où il mène : une place du fil de matchs (`?onglet`, `?ligne`,
 * `?attente`, `?contact`, `?annonce=p:`), la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche
 * (`?qui=1`), la création d'un contact (`?nouveau=1`). L'adresse la porte, et la garde : ⛔ l'écran ne la réécrit
 * jamais — la réconciliation des onglets du CRM lirait l'adresse réécrite comme celle d'un autre onglet.
 *
 * Elle s'applique UNE fois par navigation, et dans l'onglet qui porte son adresse (`useArrivee`). La navigation qui y
 * mène porte un jeton neuf dans son état (`avecArrivee`), que le navigateur garde avec l'entrée d'historique
 * (`history.state`) ; l'écran range dans la tranche de son onglet la dernière arrivée appliquée, et n'applique que
 * celle qui est neuve (`arriveeNeuve`, par `useArrivee`). Donc :
 *   · revenir sur l'onglet, un retour arrière, une éviction au-delà des six écrans vivants ne la rejouent pas ;
 *   · un rechargement non plus : le navigateur rend la même entrée d'historique, donc le même état, que le routeur
 *     relit au démarrage (`location.state`) ; la dernière arrivée appliquée, elle, revient avec la pile d'onglets du
 *     SERVEUR (`crm_open_tabs`), que l'hydratation substitue au miroir de session — lequel ne sert que la première
 *     image, ou tient lieu de pile quand le serveur n'en rend aucune ;
 *   · un NOUVEAU clic sur le même lien la rejoue, même vers un onglet déjà ouvert sur cette adresse : son jeton est neuf.
 *
 * ⚠ UNE ADRESSE SANS JETON — tapée, collée, ouverte hors du CRM — s'applique une fois aussi : sa clé est l'adresse
 * elle-même (chemin et requête), rapportée à celle de la dernière arrivée appliquée. Un rechargement la rend telle
 * quelle, sans état : même clé, pas rejouée. Et un onglet que la barre réactive, qui navigue vers son adresse sans jeton,
 * ne rejoue pas l'arrivée appliquée sur cette adresse, avec ou sans jeton.
 * ⚠ Seule la DERNIÈRE est retenue : revenir, par l'historique, sur une arrivée plus ancienne du même onglet la rejoue.
 */

/** L'état d'une navigation vers une arrivée : son jeton. */
export interface EtatArrivee {
  arrivee: string
}

/** Une arrivée : le jeton de sa navigation (`null` pour une adresse sans jeton) et son adresse, chemin et requête. */
export interface Arrivee {
  jeton: string | null
  adresse: string
}

/**
 * Les options d'une navigation vers une arrivée : un jeton neuf dans son état. Chaque lien d'arrivée s'écrit
 * `navigate(<gabarit ancré>, avecArrivee())` — sa cible reste un gabarit ancré (`redirection-ouverte.spec.ts`).
 */
export function avecArrivee(): { state: EtatArrivee } {
  return { state: { arrivee: crypto.randomUUID() } }
}

/** L'arrivée que porte une localisation du routeur : le jeton de son état, s'il en porte un, et son adresse. */
export function arriveeDe(l: { pathname: string; search: string; state: unknown }): Arrivee {
  const jeton = typeof l.state === 'object' && l.state !== null ? (l.state as { arrivee?: unknown }).arrivee : undefined
  return { jeton: typeof jeton === 'string' ? jeton : null, adresse: `${l.pathname}${l.search}` }
}

/** Ce que l'onglet restitue peut venir d'un schéma antérieur : seule une arrivée bien formée compte. */
function estArrivee(v: unknown): v is Arrivee {
  if (typeof v !== 'object' || v === null) return false
  const a = v as { jeton?: unknown; adresse?: unknown }
  return typeof a.adresse === 'string' && (a.jeton === null || typeof a.jeton === 'string')
}

/**
 * L'arrivée est-elle NEUVE au regard de la dernière appliquée dans l'onglet ? Avec un jeton : si ce n'est pas le sien.
 * Sans jeton : si son adresse n'est pas la sienne. Une valeur malformée ne compte pour rien : l'arrivée est neuve.
 */
export function arriveeNeuve(a: Arrivee, derniere: unknown): boolean {
  if (!estArrivee(derniere)) return true
  return a.jeton != null ? a.jeton !== derniere.jeton : a.adresse !== derniere.adresse
}
