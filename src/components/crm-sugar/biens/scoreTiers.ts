/**
 * Teintes des paliers de SCORE DE BIEN, par thème.
 *
 * ⚠ Dans son propre module, et non dans `BnScoreBadge.tsx` : un fichier de
 * composant qui exporte aussi une constante casse le rafraîchissement à chaud
 * (`react-refresh/only-export-components`). Le garde-fou
 * `biens-contraste.spec.ts` lit cette table pour en mesurer le contraste, il
 * lui faut donc un export.
 *
 * ⛔ DEUX JEUX, PARCE QUE LA PASTILLE EST DU TEXTE. La teinte sert d'encre sur
 * un fond qui n'est qu'elle-même à 10 % : le contraste vient donc du THÈME sous
 * elle, pas de la couleur. Mesuré le 12 août 2026, le jeu unique rendait
 * **2,41 / 2,51 / 2,80:1** en clair, quand le seuil du texte est 4,5 — la
 * pastille qui porte le score du bien était l'élément le moins lisible de sa
 * propre carte.
 *
 * Pourquoi personne ne l'avait vu : en SOMBRE les mêmes valeurs tenaient
 * (6,74 / 6,48 / 5,81). Le défaut n'existait que dans le thème par DÉFAUT.
 *
 * Les teintes claires sont les mêmes couleurs assombries jusqu'à passer l'AA
 * (5,21 / 5,54 / 5,66:1) : le palier reste reconnaissable, il cesse d'être
 * décoratif.
 *
 * ⚠ Ces trois teintes sortent SCIEMMENT de l'échelle MEGGA X — elles disent un
 * état (chaud / à animer / en veille) que les neutres et l'accent ne savent pas
 * dire, comme `danger` ou `goal` côté mobile. Ce qui se vérifie sur elles est
 * leur lisibilité, pas leur provenance.
 */
export const TIER_COLORS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    chaud: '#127055',
    a_animer: '#8A5108',
    en_veille: '#565E6E',
  },
  dark: {
    chaud: '#2FB389',
    a_animer: '#D98A2B',
    en_veille: '#8A93A6',
  },
}
