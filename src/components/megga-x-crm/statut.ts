/**
 * Les couleurs d'ÉTAT calibrées pour le BLANC — erreur, alerte, succès, et les
 * deux étoiles de notation. Une famille qui ENCODE, que la direction ne
 * gouverne pas.
 *
 * ── POURQUOI ICI, ET POURQUOI PAS DANS `tokens.ts` ───────────────────────────
 * Elle est née le 15 août 2026 dans les jetons de la face publique
 * (`kyc-magic-link/mlkTokens.ts`, sous le nom `MLK_STATUT`), puis a été
 * empruntée par la messagerie, l'écran de retour d'identité et la ligne console
 * de la barre latérale. Au troisième lecteur hors de sa face, elle a déménagé
 * (13 septembre 2026) : un jeton de CRM importé depuis un dossier nommé
 * « magic link » faisait croire qu'il appartenait au parcours client.
 *
 * ⛔ À CÔTÉ de `tokens.ts`, JAMAIS DEDANS. `couleur-barreaux.spec.ts` dérive les
 * barreaux de MEGGA X de CE fichier-là : y écrire ces onze valeurs les ferait
 * passer pour des barreaux PARTOUT dans le dépôt — `#B91C1C` recopié dans une
 * autre palette deviendrait « conforme » sans que rien n'ait été décidé. Ce
 * sont des teintes Tailwind (red-700, amber-700, emerald-700…), pas des
 * barreaux de la vitrine, et le cliquet doit continuer de les compter.
 *
 * ⚠ LE COMPLÉMENT DE `MXC_SYSTEM`, pas son double. Les couleurs de système de la
 * vitrine sont PÂLES, réglées pour un canvas noir : sur blanc, aucune ne porte
 * du texte à l'AA (mesuré le 05.09.2026 : le rouge le plus foncé rend 4,09:1,
 * le vert 1,89:1). Les
 * surfaces à deux thèmes les apparient donc — `dark ? MXC_SYSTEM.red400 :
 * STATUT_CLAIR.errInk` — et celles qui n'ont qu'un thème clair (la face
 * publique) lisent cette famille seule.
 */

/**
 * ⛔ « HORS DIRECTION » NE VEUT PAS DIRE « HORS LISIBILITÉ », et deux des trois
 * encres d'origine étaient sous l'AA. Mesuré sur la carte blanche :
 *
 *   red-500     #EF4444 → 3,76:1  ⛔     →  #B91C1C → 6,47:1  ✅
 *   emerald-600 #059669 → 3,77:1  ⛔     →  #047857 → 5,48:1  ✅
 *   amber-800   #92400E → 7,09:1  ✅     →  #B45309 → 5,02:1  ✅
 *
 * ⚠ LE TROISIÈME EST UN ARBITRAGE, PAS UNE CORRECTION, et il se lit à l'envers
 * des deux autres : l'ambre sortant était MEILLEUR (7,09 contre 5,02). La valeur
 * du dépôt l'a emporté parce qu'elle est nommée à ce rôle sur TROIS surfaces
 * (`DossierTokens.warnDarker`, `EtatVide.aFaire`, `PDF.warnFg`) et qu'une encre
 * d'alerte qui diffère d'un écran à l'autre est exactement l'incohérence que ce
 * chantier retirait. Les deux passent l'AA ; ce qui les départage est l'unicité,
 * et le chiffre est écrit pour qu'on puisse revenir dessus.
 *
 * ⚠ LES DEUX ÉTOILES RESTENT TELLES QUELLES, ET C'EST ÉCRIT PLUTÔT QUE SUBI :
 * l'or rend 1,67:1 et le vide 1,24:1, très en dessous du seuil non-texte de
 * 3:1. Aucune teinte dorée n'atteint 3:1 sur blanc sans virer au brun. Ce qui
 * porte l'information n'est pas le contraste d'une étoile mais la POSITION de la
 * coupure dans une rangée de cinq — et la note est aussi rendue en texte juste
 * à côté.
 */
export const STATUT_CLAIR = {
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
