// Normalise la PROSE générée par l'IA vers le style maison MEGGA (sobre suisse).
// DeepSeek produit, malgré la consigne, des « tells » typographiques : tiret
// cadratin (—), demi-cadratin (–), puces (· • ●). On les retire de façon
// déterministe — la consigne dans le prompt ne suffit pas (le modèle l'ignore par
// moments), même précédent que whatsapp-format.ts.
//
// Garde-fou clé : le « · » INLINE est un séparateur d'interface volontaire
// (« 80 m² · 3 pièces », footer, en-têtes). On ne touche qu'aux puces en DÉBUT de
// ligne, jamais au séparateur au milieu d'une ligne. Pur, déterministe, idempotent.

export function meggaProse(input: string | null | undefined): string {
  if (!input) return ''
  let s = input

  // 1. Puces en début de ligne (·, •, ●) → tiret standard « - ». Uniquement en
  //    début de ligne (après indentation éventuelle) pour protéger le séparateur
  //    « · » inline. Le groupe $1 préserve l'indentation.
  s = s.replace(/^([ \t]*)[·•●][ \t]+/gm, '$1- ')
  // 1b. Tiret cadratin/demi-cadratin utilisé comme puce en début de ligne → « - ».
  s = s.replace(/^([ \t]*)[—–][ \t]+/gm, '$1- ')

  // 2. Plage de chiffres avec tiret long collé ou espacé (24–48, 12 — 15) →
  //    trait d'union (format de plage suisse). AVANT la règle générale d'em dash.
  s = s.replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')

  // 3. Tiret cadratin/demi-cadratin en milieu de phrase (espacé « — » ou collé
  //    « mot—mot ») → virgule.
  s = s.replace(/\s+[—–]\s+/g, ', ')
  s = s.replace(/[—–]/g, ', ')

  // 4. Hygiène après substitution. On ne touche qu'à la virgule : la ponctuation
  //    haute française (; : ! ?) garde son espace insécable éventuel.
  s = s.replace(/ +,/g, ',')      // espace avant virgule
  s = s.replace(/,\s*\./g, '.')   // « , . » → « . »
  s = s.replace(/(,\s*){2,}/g, ', ') // virgules en cascade → une seule
  s = s.replace(/(?<=\S)[ \t]{2,}/g, ' ') // espaces multiples INTERNES (préserve l'indentation de début de ligne)
  s = s.replace(/[ \t]+$/gm, '')  // espaces en fin de ligne

  return s
}

// Bloc de style maison injecté dans les system prompts IA (copilote, WhatsApp,
// e-mails). Il réduit la fréquence des tells en amont ; meggaProse() garantit le
// résultat en aval. Garder court : c'est appendu à des prompts déjà longs.
export const MEGGA_STYLE_BLOCK = `STYLE D'ÉCRITURE MEGGA (obligatoire) :
- Ton sobre et direct, à la suisse. Phrases courtes. Va à l'essentiel, une recommandation claire plutôt qu'un survol.
- N'utilise JAMAIS le tiret cadratin (—) ni le demi-cadratin (–). À la place : virgule, deux-points ou point.
- Pas de puce « · » ni « • ». Pour énumérer, utilise une liste numérotée (1. 2. 3.).
- Format suisse : montants « CHF 720'000 » (apostrophe), surfaces « 120 m² », dates « JJ.MM.AAAA ».
- Vouvoiement dans les textes destinés au client, tutoiement quand tu t'adresses à l'agent.
- Pas de remplissage ni de formule creuse.`
