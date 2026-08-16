// MEGGA — Jetons de la face PUBLIQUE : parcours client KYC Magic Link
// (`/kyc/<token>`) et gestion de rendez-vous (`/rendez-vous/<token>`).
//
// Séparés de MlkPrimitives.tsx : un fichier qui exporte des composants ET des
// constantes casse le Fast Refresh de Vite (toute édition recharge la page au
// lieu de préserver l'état). Les jetons vivent donc à part.
//
// ── LA PALETTE DESCEND DE MEGGA X (15 août 2026) ─────────────────────────────
// Elle ne descendait de RIEN : quinze clés, douze littéraux hexadécimaux, aucune
// spec ne la gardait. C'était le troisième objet de jetons dans ce cas après
// `DossierTokens` et `AX` — un objet n'est pas une ZONE, et les huit specs de
// contraste du dépôt gardent des zones. Trois familles étaient sous l'AA :
//
//   · `muted` #7A8088 — 3,98:1 sur la carte, 17 emplois en `color:`. Troisième
//     mesure sous le seuil de cette valeur exacte dans le dépôt.
//   · `ghost` #B5BAC2 en encre — 1,95:1, et c'est le LIBELLÉ d'un bouton
//     désactivé.
//   · `ghost` en APLAT sous encre blanche — 1,95:1 aussi. Le même jeton échouait
//     donc dans les deux sens de son couple.
//
// Le noir de Sugar (#0B0C0E) et le gris-bleu slate-900 (rgba(15,23,42,…) des
// quatre ombres) partent avec : ce sont les deux marqueurs de la direction
// RETIRÉE, et leur présence ici disait que cette face n'avait jamais été touchée
// par la bascule du 10 août — pas qu'elle avait dérivé depuis.
//
// ⚠ CE QUI RESTE HORS DE L'ÉCHELLE, ET POURQUOI. Ce sont les deux seules choses
// qui distinguent cet écran du CRM, et elles sont gardées PAR DÉCISION (Julien,
// 15 août 2026) : cette face est vue par des CLIENTS, pas par des agents.
//   · `font` — Manrope, pas l'Inter Tight du CRM.
//   · `bgGradient` — le dégradé bleuté de la page.
//   · `inkSoft` #3A3D44 n'est pas une décision mais une MESURE, et c'est celle
//     d'Analytics, au même rôle : entre l'encre et le texte secondaire, `n400`
//     sort à 1,16:1 de `n100` en clair — un DOUBLON, pas un cran. La valeur
//     d'ici tient 10,88:1 sur la carte, et le dépôt la portait déjà.
//
// ⚠ MONO-THÈME, et `mlk-contraste.spec.ts` le DIT au lieu de le supposer : il
// rougira le jour où cette face gagne une branche sombre.
//
// ⚠ CE QUI RESTE À FAIRE : les composants écrivent encore le noir de Sugar en
// décimal (`rgba(11,12,14,…)`) dans leurs ombres locales, et `kyc-magic-link/`
// n'est sous aucune racine du cliquet de grammaire. C'est le lot 1.
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

/**
 * ⛔ LA FAMILLE QUI ENCODE — et elle est SÉPARÉE de `MLK` pour une raison.
 *
 * `MLK` descend de l'échelle et ne porte que des NEUTRES ; l'erreur, l'alerte
 * et le succès ne décorent pas, ils disent un ÉTAT. Les mêler à la palette
 * neutre reviendrait à prétendre que la direction les gouverne — elle ne le
 * fait pas, et c'est l'arbitrage rendu quatre fois dans ce dépôt (teintes
 * d'étape du pipeline, pastilles de groupe, TYPE_COLOR, tons de galStatus).
 *
 * ⛔ MAIS « HORS DIRECTION » NE VEUT PAS DIRE « HORS LISIBILITÉ », et deux des
 * trois valeurs sortantes étaient sous l'AA. Mesuré sur la carte blanche :
 *
 *   red-500     #EF4444 → 3,76:1  ⛔     →  #B91C1C → 6,47:1  ✅
 *   emerald-600 #059669 → 3,77:1  ⛔     →  #047857 → 5,48:1  ✅
 *   amber-800   #92400E → 7,09:1  ✅     →  #B45309 → 5,02:1  ✅
 *
 * ⚠ LE TROISIÈME EST UN ARBITRAGE, PAS UNE CORRECTION, et il se lit à l'envers
 * des deux autres : l'ambre sortant était MEILLEUR (7,09 contre 5,02). J'ai pris
 * quand même la valeur du dépôt, parce qu'elle est nommée à ce rôle sur TROIS
 * surfaces (`DossierTokens.warnDarker`, `EtatVide.aFaire`, `PDF.warnFg`) et qu'une
 * encre d'alerte qui diffère d'un écran à l'autre est exactement l'incohérence
 * que ce chantier retire. Les deux passent l'AA ; ce qui les départage est
 * l'unicité, et le chiffre est écrit pour qu'on puisse revenir dessus.
 *
 * ⚠ LES DEUX ÉTOILES RESTENT TELLES QUELLES, ET C'EST ÉCRIT PLUTÔT QUE SUBI :
 * l'or rend 1,67:1 et le vide 1,24:1, très en dessous du seuil non-texte de
 * 3:1. Aucune teinte dorée n'atteint 3:1 sur blanc sans virer au brun. Ce qui
 * porte l'information ici n'est pas le contraste d'une étoile mais la POSITION
 * de la coupure dans une rangée de cinq — et la note est aussi rendue en texte
 * juste à côté.
 */
export const MLK_STATUT = {
  errInk: '#B91C1C',
  errFill: '#FEF2F2',
  errLine: '#FECACA',
  warnInk: '#B45309',
  warnFill: '#FFFBEB',
  warnLine: '#FDE68A',
  okInk: '#047857',
  okFill: '#ECFDF5',
  okLine: '#6EE7B7',
  starOn: '#FBBF24',
  starOff: '#E5E7EB',
} as const

export const MLK = {
  /**
   * ⚠ GARDÉ HORS ÉCHELLE. Le dégradé de la page client — avec Manrope, la seule
   * chose qui distingue cette face du CRM. Aucune encre ne s'y pose : tout le
   * contenu des six écrans vit dans un `MlkShell`, qui est une carte blanche.
   */
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: MXC_COLOR.n1000,
  /**
   * La carte étant le blanc pur, la sous-surface ne peut que DESCENDRE. `n900`
   * rend 1,05:1 — la douceur qu'elle avait déjà (1,06). C'est l'idiome CLAIR :
   * l'écart de luminance ne sépare pas, l'ombre le fait.
   */
  cardSubtle: MXC_COLOR.n900,
  /**
   * ⛔ L'ÉLÉMENT ACTIF PORTE L'ACCENT — arbitrage rendu site par site le
   * 15 août 2026, sur les NEUF emplois de l'ancien `black`.
   *
   * SEPT le prennent, parce qu'ils disent « vous avez agi sur ceci » : la pilule
   * (le bouton principal de tout le parcours), l'anneau et le point radio de la
   * tuile de type de pièce sélectionnée, l'anneau de la zone de dépôt pendant le
   * glisser, le jour et le créneau choisis, et le filet de ce créneau.
   *
   * DEUX gardent l'encre, et ce sont des DONNÉES : le disque de confirmation —
   * rien ne s'y actionne — et la pastille de rendez-vous, dont le couple avec
   * `ghost` ENCODE « annulé » contre « confirmé ». Les repeindre les ferait
   * mentir ; c'est l'arbitrage rendu quatre fois dans ce dépôt.
   *
   * ⚠ `black` DISPARAÎT avec cet arbitrage, et pas seulement parce qu'il n'a
   * plus de lecteur : il portait le MÊME barreau qu'`ink`. C'était le nom d'une
   * RÈGLE — « l'accent EST l'encre », celle de Sugar Pure — et pas d'une
   * couleur. La règle partie, le jeton n'avait plus de raison d'exister à côté
   * d'`ink`. Même retrait que `DossierTokens.black` au chantier KYC ; `tsc` interdit
   * désormais son retour.
   *
   * ⚠ Le composant garde son nom, `MlkBlackPill` : renommer est un geste
   * lexical à part.
   */
  accent: MXC_COLOR.accent,
  ink: MXC_COLOR.n100,
  /** ⚠ Hors échelle par MESURE — voir l'en-tête. */
  inkSoft: '#3A3D44',
  /**
   * ⛔ `muted` ET `ghost` PRENNENT LE MÊME BARREAU, et ce n'est pas une fusion
   * par paresse : le barreau plus clair qui les distinguait ÉTAIT le défaut.
   * `ghost` sert d'encre à un libellé désactivé et de fond à deux pastilles sous
   * encre blanche — les trois rôles portent un seuil, et seul `n500` les tient
   * (5,57:1 dans les deux sens). Le barreau le plus proche par la couleur était
   * `n700`, qui rend 1,61:1 : la proximité ne décide pas d'un rôle.
   * Les clés restent séparées parce que leurs RÔLES le sont.
   */
  muted: MXC_COLOR.n500,
  ghost: MXC_COLOR.n500,
  /**
   * ⚠ LA GÉOMÉTRIE NE BOUGE PAS, seule la TEINTE descend. Ces trois ombres
   * portaient le gris-bleu slate-900, qui entre toujours par la même porte —
   * une fraction d'opacité, que personne ne relit en cherchant une couleur.
   * `crmVoileEncre` est le rôle que le Pipeline a nommé pour ça.
   */
  shadowSm: `0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  shadow: `0 12px 40px ${crmVoileEncre(false, 0.06)}, 0 2px 8px ${crmVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${crmVoileEncre(false, 0.08)}, 0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  /** ⚠ GARDÉE HORS ÉCHELLE par décision — voir l'en-tête. */
  font: 'Manrope, system-ui, sans-serif',
} as const
