// Normalise un texte sortant pour WhatsApp. DeepSeek écrit parfois en Markdown
// (**gras**, ### titres) qui s'affiche en clair sur WhatsApp. On convertit vers la
// syntaxe WhatsApp (*gras*) de façon déterministe — la consigne dans le prompt ne
// suffit pas (le modèle l'ignore par moments). Pur, testable.

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
