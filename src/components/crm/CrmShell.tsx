// MEGGA CRM — types et animations partagés de la coquille d'écran.
//
// ⛔ CE FICHIER PORTAIT LA BARRE DU HAUT (`CrmTopNav`) ET LA RÉ-EXPORTAIT LE
// RAIL. Les deux ont été retirés le 4 septembre 2026 : le chrome du CRM de
// bureau est désormais UNE barre latérale repliable, `CrmSidebar.tsx`, qui
// porte les pages, les outils transverses et le compte. Ce qui vivait ici et
// n'a pas suivi :
//
//   • les 7 onglets horizontaux        → lignes de nav de la barre
//   • le cluster droit (loupe, aide,   → outils de la barre, et menu du compte
//     ✦ MEGGA AI, cloche, avatar)        en pied
//   • `CrmRoundIconBtn`                → sans consommateur, supprimé
//   • `AnimatedTopIcon`                → sans consommateur, supprimé de son
//                                        module (le jeu de glyphes reste : la
//                                        barre en monte le rendu STATIQUE,
//                                        `RailIcon`)
//   • ~85 lignes de détachement de la  → SANS OBJET. Elles existaient parce que
//     barre pendant le dock MEGGA AI     `paddingRight: COPILOT_WIDTH` rétrécit
//     (`barLifted`, `clipAncestor`,       la racine d'écran PAR LA DROITE et
//     sonde rAF, ResizeObserver)          rognait une barre pleine largeur. Une
//                                         colonne de GAUCHE n'est jamais rognée
//                                         par une compression de droite.
//
// Restent ici les deux choses que les écrans partagent vraiment : l'union des
// clés d'écran et les keyframes globales.

import type { CrmPalette } from './tokens'

// ─── Clés d'écran ──────────────────────────────────────────────────────
// ⚠ L'union est LUE PAR UN TEST : `help-articles.spec.ts` l'extrait d'ici pour
// vérifier que chaque article du catalogue est bien émis par une surface. La
// déplacer, la renommer, ou coller la ligne suivante à sa dernière valeur
// (l'extraction s'arrête à la ligne vide) fait rougir la porte.
export type CrmScreenId =
  | 'today' | 'pipeline' | 'matching' | 'parcours' | 'contacts'
  | 'biens' | 'calendar'

/** Palette d'écran — ré-exportée pour les surfaces qui typaient leur `sp` d'ici. */
export type { CrmPalette }

// ─── Orb background — soft floating gradient blobs behind the glass ────
// ─── Sugar global animations (mounted once at the page root) ───────────
export const CRM_KEYFRAMES = `
  @keyframes crm-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes crm-slide-in {
    from { transform: translateX(100%); }
    to   { transform: translateX(0); }
  }
  @keyframes crm-bento-in {
    from { opacity: 0; transform: translateX(40px) scale(0.96); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  @keyframes crm-overlay-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes crm-toast {
    from { opacity: 0; transform: translate(-50%, 12px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes crm-dash-flow {
    to { stroke-dashoffset: -14; }
  }
  @keyframes sgSignVeil {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sgSealIn {
    from { opacity: 0; transform: scale(.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes sgSignExit {
    0%   { opacity: 1; transform: translateY(0) scale(1); max-height: 340px; margin-top: 0; }
    30%  { opacity: 1; transform: translateY(-6px) scale(1.015); }
    100% { opacity: 0; transform: translateY(-26px) scale(.9); max-height: 0; margin-top: -10px; padding-top: 0; padding-bottom: 0; }
  }
  @keyframes sfPop {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes qaFade {
    from { opacity: 0; transform: translateY(-2px); }
    to   { opacity: 1; transform: none; }
  }
`

