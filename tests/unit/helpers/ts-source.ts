/**
 * Découpe de source TypeScript pour les gardes qui lisent le CODE, et pas
 * seulement les valeurs qu'il produit.
 *
 * POURQUOI CES GARDES EXISTENT. Une garde qui vérifie qu'une fonction rend une
 * bonne valeur ne dit rien de qui l'appelle : `biens-contraste.spec.ts` testait
 * `encreSur` sur la palette d'avatar, il était vert, et « Contacts » peignait
 * ses avatars en blanc sans jamais appeler la fonction. Lier la règle au code
 * qui la porte demande de lire le source.
 *
 * ⚠ ET IL FAUT LE LIRE PAR PORTÉE, PAS PAR FENÊTRE DE LIGNES. Un détecteur qui
 * regarde ±3 lignes autour d'un motif attrape le barreau de l'élément voisin :
 * mesuré sur « Mes biens », il s'est trompé cinq fois sur un seul balayage. Les
 * accolades équilibrées, elles, ne se trompent pas de composant.
 */

/**
 * Corps de `function <nom>(…) { … }`, accolades comprises.
 *
 * Rend `null` si la fonction n'existe pas — l'appelant DOIT le traiter comme un
 * échec de garde et non comme une absence de faute : une garde qui ne trouve
 * plus sa cible ne mesure plus rien, et passerait au vert en silence.
 *
 * ⚠ Compte les accolades sans comprendre les chaînes ni les gabarits. Suffisant
 * pour les composants de ce dépôt (styles en ligne, pas d'accolade dans une
 * chaîne), et le test `le source est bien lu` de chaque garde attrape le cas où
 * ça ne le serait plus.
 */
/**
 * Valeur d'une prop JSX `<nom>={ … }`, accolades comprises.
 *
 * ⚠ Par équilibrage, pas par motif. Une expression régulière qui s'arrêterait à
 * une accolade suivie d'un retour à la ligne dépendrait de l'INDENTATION du
 * fichier : reformater le composant désarmerait la garde sans que rien ne le
 * dise. (Et une telle regex se fait refuser par `no-regex-spaces`, ce qui est
 * l'ESLint du dépôt qui pointe le même défaut.)
 */
export function valeurDePropJsx(code: string, prop: string): string | null {
  const debut = code.indexOf(`${prop}={`)
  if (debut === -1) return null
  const ouvrante = code.indexOf('{', debut)
  let profondeur = 0
  for (let i = ouvrante; i < code.length; i++) {
    if (code[i] === '{') profondeur++
    else if (code[i] === '}' && --profondeur === 0) return code.slice(ouvrante, i + 1)
  }
  return null
}

export function corpsDeFonction(code: string, nom: string): string | null {
  const debut = code.indexOf(`function ${nom}(`)
  if (debut === -1) return null
  const ouvrante = code.indexOf('{', code.indexOf(')', debut))
  if (ouvrante === -1) return null
  let profondeur = 0
  for (let i = ouvrante; i < code.length; i++) {
    if (code[i] === '{') profondeur++
    else if (code[i] === '}' && --profondeur === 0) return code.slice(ouvrante, i + 1)
  }
  return null
}
