// MEGGA — Jetons de la RÉCEPTION ACHETEUR (`/reception/:token`), face publique.
//
// ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
// Ces jetons vivaient dans `BuyerReceptionPage.tsx`, sous le nom `RC`. Les en
// sortir n'est pas du rangement : c'était la CONDITION pour les garder. Une
// garde de contraste doit importer l'objet qu'elle mesure, et une page qui
// exporte sa palette fait rougir `react-refresh/only-export-components` — c'est
// exactement l'arbitrage rendu au lot 2 du Pipeline, qui a sorti `dealTokens`,
// `omTokens` et `ndTokens` de leurs pages pour la même raison.
//
// ⚠ LE MODULE ENTRE AU CLIQUET EN MÊME TEMPS QUE LA PAGE. Extraire les
// littéraux sans balayer leur nouveau domicile aurait fait passer les clauses de
// couleur pour rien : le cliquet n'aurait plus vu que le NOM des jetons. C'est
// le piège que `crm-dossiers/tokens.ts` a posé pendant six lots.
//
// ⚠ C'est un SECOND objet, pas une rallonge de `MLK`. Ils partagent la moitié de
// leurs valeurs et divergent sur le reste — la sous-surface (`#F4F6F9` contre
// `#F7F8FA`) et le filet, que `MLK` n'a pas. Les fondre masquerait la
// divergence ; les garder séparés la rend visible, et c'est elle qui dira si
// l'un doit disparaître dans l'autre.
//
// ── LA PALETTE DESCEND DE MEGGA X (15 août 2026) ─────────────────────────────
// Même décision que pour `MLK`, même geste. `muted` valait `#7A8088` — 3,98:1
// sur la carte, 15 emplois en `color:` — QUATRIÈME mesure sous l'AA de cette
// valeur exacte dans le dépôt, après `DossierTokens`, les trois palettes du Pipeline
// et `MLK`. Elle voyage par copier-coller, et aucune spec ne la cherchait ici.
//
// Le filet et les trois ombres portaient le gris-bleu slate-900 en DÉCIMAL :
// une teinte proscrite n'entre jamais autrement que par une fraction d'opacité.
//
// ⚠ CE QUI RESTE HORS DE L'ÉCHELLE, comme sur la face KYC : le dégradé et
// Manrope (l'identité de la face client, gardée par décision), et `soft`
// #3A3D44 par MESURE — `n400` sort à 1,16:1 de `n100` en clair, un doublon et
// pas un cran, tandis que cette valeur tient 10,88:1 sur la carte.
//
// Le nom `RC` ne bouge pas : renommer est un geste lexical à part.
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

export const RC = {
  /** ⚠ Gardé hors échelle — l'identité de la face client, avec Manrope. */
  bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 48%, #EDEFF3 100%)',
  card: MXC_COLOR.n1000,
  /** La carte étant le blanc pur, la sous-surface ne peut que descendre : 1,05:1, idiome clair. */
  sub: MXC_COLOR.n900,
  ink: MXC_COLOR.n100,
  /**
   * ⛔ L'ÉLÉMENT ACTIF PORTE L'ACCENT (`CLAUDE.md` §3, décision du 10 août 2026).
   *
   * Deux sites l'ont pris : le bouton principal (`blackBtn`) et la pastille de
   * motif SÉLECTIONNÉE. Les quatre autres aplats d'encre disent une DONNÉE — les
   * initiales de l'agent, la barre de progression, la pastille de compte, le
   * disque de confirmation — et gardent l'encre : les repeindre en accent les
   * ferait mentir.
   */
  accent: MXC_COLOR.accent,
  /** ⚠ Hors échelle par MESURE — voir l'en-tête. */
  soft: '#3A3D44',
  muted: MXC_COLOR.n500,
  /**
   * ⚠ LA GÉOMÉTRIE NE BOUGE PAS, seule la TEINTE descend. `crmVoileEncre` est le
   * rôle que le Pipeline a nommé pour cette porte d'entrée précise : personne ne
   * relit `rgba(15,23,42,0.06)` en cherchant une couleur.
   */
  line: crmVoileEncre(false, 0.06),
  shadow: `0 12px 40px ${crmVoileEncre(false, 0.06)}, 0 2px 8px ${crmVoileEncre(false, 0.03)}`,
  shadowSm: `0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  sheetShadow: `0 -18px 60px ${crmVoileEncre(false, 0.18)}, 0 -4px 16px ${crmVoileEncre(false, 0.08)}`,
}

/** ⚠ Gardée hors direction par décision du 15 août 2026 — voir l'en-tête. */
export const RC_FONT = 'Manrope, system-ui, sans-serif'
