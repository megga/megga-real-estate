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
// `SugarV3` et `AX` — un objet n'est pas une ZONE, et les huit specs de
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
import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

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
   * L'aplat d'affordance — le CTA, le disque de confirmation, la tuile de
   * créneau sélectionnée.
   *
   * ⚠ IL RESTE DE L'ENCRE, ET C'EST UNE QUESTION OUVERTE, PAS UN OUBLI. La règle
   * du 10 août 2026 dit que l'élément ACTIF porte l'accent `#424bfb` ; ici il
   * porte l'encre, ce qui est l'ancienne règle « l'accent EST l'encre » avec les
   * jetons de la nouvelle. Le lot du 15 août ne change que l'ALPHABET
   * (`#0B0C0E` → `n100`), comme `BiensFirstRun` et `ContactsFirstRun` avant lui :
   * peindre en accent le bouton principal que le CLIENT voit se décide, ça ne se
   * glisse pas dans un lot de descente.
   */
  black: MXC_COLOR.n100,
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
   * `sgVoileEncre` est le rôle que le Pipeline a nommé pour ça.
   */
  shadowSm: `0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadow: `0 12px 40px ${sgVoileEncre(false, 0.06)}, 0 2px 8px ${sgVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${sgVoileEncre(false, 0.08)}, 0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  /** ⚠ GARDÉE HORS ÉCHELLE par décision — voir l'en-tête. */
  font: 'Manrope, system-ui, sans-serif',
} as const
