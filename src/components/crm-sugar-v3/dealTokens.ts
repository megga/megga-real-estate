/**
 * Jetons de la FICHE DEAL (`DealDetailPage`) — dérivés de MEGGA X.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE, ET POURQUOI C'EST UNE FONCTION.
 * La fiche portait deux objets figés, `DsLIGHT` et `DsDARK`, recopiés de
 * l'échelle grise de `SugarV3` : quatorze valeurs par thème, dont le noir Sugar
 * (`#0B0C0E`, plus sa forme décimale `rgba(11,12,14,…)`) et le gris-bleu
 * slate-900 (`rgba(15,23,42,…)`, B−R = 27) — les deux teintes que les gardes du
 * dépôt interdisent déjà ailleurs. C'était le second système de jetons de
 * l'écran, et le plan l'avait attribué à `SugarV3` : la mesure a montré que la
 * fiche n'importe de `SugarV3` qu'un formateur de DATE.
 *
 * Le passer en FONCTION de `SugarPalette` est ce qui empêche la recopie de
 * revenir : il n'y a plus de valeur à recopier, seulement un barreau à
 * désigner. Même geste que `ndPalette`, et que `crmSugarPalette` elle-même.
 *
 * ⚠ Il vit hors du fichier de page pour une raison mécanique : une page qui
 * exporte autre chose qu'un composant fait rougir `react-refresh`, et une
 * palette qu'on ne peut pas importer ne peut pas être gardée.
 */
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

export interface DsPal {
  /** Surfaces. */
  card: string
  sub: string
  /** Encres, du plus fort au plus faible — même ordre que `SugarPalette`. */
  ink: string
  soft: string
  muted: string
  /**
   * Aplat DÉSACTIVÉ (pouce d'ascenseur, liseré d'une offre non courante).
   * ⚠ Il porte parfois du texte : son encre se dérive, jamais ne se choisit.
   */
  ghost: string
  /**
   * ⛔ L'ÉLÉMENT ACTIF PORTE L'ACCENT — règle tranchée par Julien le 10 août
   * 2026, qui remplace « l'accent EST l'encre » de Sugar Pure.
   *
   * L'ancien jeton `black` servait CINQ rôles et une seule teinte. Trois d'entre
   * eux ne sont PAS actifs et gardent donc l'encre : la pastille de score du
   * meilleur match et la pastille « en cours » disent une DONNÉE, le toast est
   * une SURFACE flottante inversée. Les peindre en bleu parce qu'elles étaient
   * noires aurait été une régression de sens déguisée en mise à jour de teinte —
   * c'est l'arbitrage rendu sur les sept `--black` du Matching, refait ici.
   */
  accent: string
  accentHover: string
  accentInk: string
  /** Encre posée sur un aplat d'ENCRE (pastilles de donnée, toast). */
  onInk: string
  /** Voile d'encre — pastille de critère, pastille de match non prioritaire. */
  chip: string
  /** Filet. ⛔ C'était le gris-bleu slate-900 ; c'est une bordure de carte. */
  hair: string
  shadow: string
  /** Teintes SÉMANTIQUES : elles disent un état que l'échelle ne sait pas dire. */
  err: string
  ok: string
}

/**
 * Teintes sémantiques — ⚠ AUCUNE N'EST INVENTÉE : ce sont les quatre
 * `--color-*-dark` de `globals.css`, c'est-à-dire le système de couleurs que le
 * dépôt possède déjà. Même geste que `MRH_PRICE_DROP` sur le Matching : on
 * n'écarte pas une couleur fonctionnelle vers un gris, on la prend dans sa
 * propre famille, à la valeur que la feuille connaît.
 *
 * ⛔ ET L'ANCIEN VERT ÉTAIT SOUS L'AA : `#059669` rendait 3,77:1 sur la carte
 * blanche. Le Lot 1 ne l'avait pas vu — `err` et `ok` n'étaient pas dans la
 * liste des encres de sa garde, qui ne connaissait que `ink`/`soft`/`muted`.
 * Une garde ne mesure que ce qu'on lui a nommé.
 *
 * Mesuré ici : 6,47 et 5,48 en clair, 7,46 et 10,73 en sombre.
 */
const ERR = { clair: '#B91C1C', sombre: '#F87171' } // --color-danger-dark
const OK = { clair: '#047857', sombre: '#34D399' } // --color-success-dark

export function dsPalette(dark: boolean, sp: SugarPalette): DsPal {
  return {
    card: sp.cardBg,
    sub: sp.cardSubBg,
    ink: sp.ink,
    soft: sp.soft,
    muted: sp.sub,
    ghost: dark ? sp.focusSurface : sp.cardBorder,
    accent: sp.accent,
    accentHover: dark ? '#5961fb' : '#3a42dd',
    accentInk: sp.accentInk,
    onInk: encreSur(sp.ink),
    chip: dark ? 'rgba(255,255,255,0.07)' : 'rgba(3,3,3,0.05)',
    hair: sp.cardBorder,
    shadow: sp.shadow,
    err: dark ? ERR.sombre : ERR.clair,
    ok: dark ? OK.sombre : OK.clair,
  }
}
