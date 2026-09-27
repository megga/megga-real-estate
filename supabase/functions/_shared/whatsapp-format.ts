// Normalise un texte sortant pour WhatsApp. DeepSeek écrit parfois en Markdown
// (**gras**, ### titres) qui s'affiche en clair sur WhatsApp. On convertit vers la
// syntaxe WhatsApp (*gras*) de façon déterministe — la consigne dans le prompt ne
// suffit pas (le modèle l'ignore par moments). Pur, testable.

import { meggaProse } from './megga-prose.ts'

export function toWhatsAppText(body: string | null | undefined): string {
  if (!body) return ''
  let s = body
  // Titres Markdown (#, ##, ### …) en début de ligne → gras WhatsApp.
  s = s.replace(/^[ \t]*#{1,6}[ \t]+(.+?)[ \t]*$/gm, '*$1*')
  // Gras Markdown **x** → gras WhatsApp *x* (non gourmand, pas à travers les sauts de ligne).
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
  // Étoiles doubles résiduelles (paires impaires) → simple.
  s = s.replace(/\*\*/g, '*')
  return s
}

/**
 * LA mise en forme qu'un texte sortant WhatsApp subit avant de partir — une seule fonction,
 * pas deux appels recopiés.
 *
 * Pourquoi ça compte : DEUX endroits doivent mesurer très exactement la même chaîne — la
 * garde qui construit et envoie la requête (whatsapp-outbound-guard.ts) et le découpage de
 * confirmation (whatsapp-confirm-buttons.ts), qui compare la longueur formatée à la limite
 * Meta AVANT de décider s'il coupe le message en deux. Si les deux appliquaient
 * `meggaProse`/`toWhatsAppText` séparément, un simple oubli ferait diverger la longueur
 * mesurée par le découpage de celle réellement postée — un message tomberait pile sur la
 * limite dans un sens mais pas dans l'autre. En factorisant, l'invariant devient structurel :
 * il n'y a plus qu'un seul endroit où l'ordre peut se tromper.
 *
 * L'ORDRE compte et n'est pas arbitraire : `meggaProse` (style maison — tirets cadratins,
 * puces) d'abord, PUIS `toWhatsAppText` (Markdown → syntaxe WhatsApp) ensuite. La sortie de
 * la première est le texte d'entrée attendu par la seconde ; inverser changerait le résultat
 * (ex. un gras autour d'un tiret cadratin glissé par la première passe).
 */
export function formatOutboundText(body: string | null | undefined): string {
  return toWhatsAppText(meggaProse(body))
}
