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

// Première photo exploitable d'un bien pour un envoi WhatsApp (image par lien Meta).
// Préfère le miroir R2 (photos_cf — variante detail 1200px, bon compromis qualité/poids),
// repli sur l'URL source (photos[], ex. CDN Flatfox). https uniquement : Meta refuse
// le reste, et on ne veut jamais glisser une valeur inattendue dans un send.
//
// SÉCURITÉ (opts.requireHost) : quand des hôtes sont imposés (= nos domaines : R2
// img.getmegga.com + Storage Supabase), on ne relaie QUE des URLs que nous hébergeons.
// Sinon un lien source tiers non vérifié (une annonce Flatfox dont l'image pointe
// ailleurs) partirait au client sous l'identité WhatsApp de l'agence sans que l'agent
// ait vu le contenu. Le repli tiers est alors écarté (le bien part en texte seul) ; nos
// photos R2 ET les uploads agents (staging Storage, même si le miroir R2 a échoué)
// passent. Comparaison d'hôte STRICTE (===) : un sosie (img.getmegga.com.attacker.example)
// est rejeté. Sans requireHost : comportement historique (https seul), pour les tests.
export interface ListingPhotoRow {
  photos_cf?: Array<{ detail?: string; hero?: string; thumb?: string }> | null
  photos?: string[] | null
}

export function firstListingPhotoUrl(
  row: ListingPhotoRow,
  opts?: { requireHost?: string | string[] | null },
): string | null {
  const cf = row.photos_cf?.[0]
  const url = cf?.detail ?? cf?.hero ?? cf?.thumb ?? row.photos?.[0] ?? null
  if (typeof url !== 'string' || !url.startsWith('https://')) return null
  const req = opts?.requireHost
  if (req) {
    const allowed = Array.isArray(req) ? req : [req]
    try { if (!allowed.includes(new URL(url).host)) return null } catch { return null }
  }
  return url
}
