// Détection d'une demande de désinscription dans un message ENTRANT.
//
// PUR : aucun I/O, testable sous Node (Vitest) comme sous Deno.
//
// ⛔ NE PAS passer par `detectLang` (whatsapp-i18n.ts) : il ne connaît que fr/en, parce
// qu'il sert le copilote AGENT, dont le CRM est bilingue. Le corpus CLIENT, lui, est en
// quatre langues — c'est la raison d'être des 20 templates déposés chez Meta. Un détecteur
// bâti dessus serait aveugle à « abmelden » et à « cancellami ».
//
// Le sens de lecture est inversé : ce n'est pas la langue qui décide du mot-clé, c'est le
// mot-clé qui RENSEIGNE la langue. Elle sert ensuite à choisir l'accusé de désinscription
// (whatsapp-stop-ack.ts), seul message que recevra jamais une personne dont le premier
// message est « stop ».

/** 'xx' = mot-clé international, il ne dit rien de la langue. Voir resolveStopLang. */
export type StopLang = 'xx' | 'fr' | 'de' | 'en' | 'it'

/** Langue effective d'un accusé — 'xx' n'en est pas une. */
export type AckLang = 'fr' | 'de' | 'en' | 'it'

/**
 * trim + minuscules + accents retirés + ponctuation/emoji → espace.
 *
 * Sans le retrait des accents, « arrêt » et « arret » divergent, et « löschen » n'entre
 * dans aucune liste. Même normalisation que parseConfirmation, pour que les deux
 * détecteurs ne se contredisent pas sur un même message.
 */
export function normalizeForStop(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Régime 1 : le message EST le mot-clé. Sans ambiguïté possible. */
const EXACT: Record<StopLang, string[]> = {
  xx: ['stop', 'stopp', 'stop promotions', 'stop all', 'unsubscribe',
       'opt out', 'optout', 'cancel', 'end', 'quit', 'remove me'],
  fr: ['arret', 'arrete', 'arretez', 'desabonnement', 'desabonner', 'me desabonner',
       'desinscription', 'desinscrire', 'me desinscrire'],
  // ⚠ Les deux graphies allemandes : « löschen » perd son tréma à la normalisation, mais
  // « loeschen » — la transcription usuelle au clavier — n'y passe pas et doit être listée.
  de: ['abmelden', 'abmeldung', 'abbestellen', 'keine werbung', 'stopp werbung',
       'loschen', 'loeschen'],
  it: ['cancellami', 'disiscrivimi', 'annulla iscrizione', 'cancella iscrizione', 'basta'],
  en: [],
}

/** Régime 2 : le message CONTIENT la demande. Borné en longueur (voir detectStopRequest). */
const PHRASES: Record<StopLang, string[]> = {
  fr: ['ne plus me contacter', 'ne me contactez plus', 'ne m ecrivez plus',
       'plus de messages', 'je ne veux plus recevoir', 'supprimez mes donnees',
       'retirez moi de votre liste'],
  de: ['nicht mehr kontaktieren', 'keine nachrichten mehr', 'keine weiteren nachrichten',
       'loschen sie meine daten', 'loeschen sie meine daten', 'von der liste nehmen'],
  en: ['do not contact me', 'dont contact me', 'stop messaging me', 'stop sending me',
       'take me off', 'remove me from your list', 'delete my data'],
  it: ['non contattarmi piu', 'non voglio piu ricevere', 'non inviatemi piu',
       'toglietemi dalla lista', 'cancellate i miei dati'],
  xx: [],
}

/**
 * Au-delà de cette longueur, « stop messaging me » est probablement CITÉ, pas demandé
 * (une personne qui raconte ce qu'elle a écrit ailleurs, une capture recopiée).
 *
 * L'asymétrie est assumée, et c'est elle qui fixe le seuil : un faux positif coûte un
 * contact silencieux, visible dans le CRM et réactivable par l'agent ; un faux négatif
 * coûte une plainte Meta sur un WABA partagé par TOUS les tenants.
 */
const PHRASE_MAX_CHARS = 160

/** Rend la LANGUE détectée (pour l'accusé), ou null si ce n'est pas une désinscription. */
export function detectStopRequest(raw: string | null | undefined): StopLang | null {
  const s = normalizeForStop(raw)
  if (!s) return null
  for (const [lang, words] of Object.entries(EXACT)) {
    if (words.includes(s)) return lang as StopLang
  }
  if (s.length > PHRASE_MAX_CHARS) return null
  for (const [lang, ps] of Object.entries(PHRASES)) {
    if (ps.some((p) => s.includes(p))) return lang as StopLang
  }
  return null
}

/**
 * Langue de l'accusé : celle du mot-clé s'il en désigne une, sinon celle déclarée sur la
 * fiche (`contacts.language`), sinon le français.
 *
 * « stop » nu ne dit rien de la langue de la personne, et lui répondre en français par
 * défaut alors que sa fiche la dit germanophone serait un choix, pas une absence de choix.
 */
export function resolveStopLang(
  detected: StopLang | null, contactLanguage?: string | null,
): AckLang {
  if (detected && detected !== 'xx') return detected
  const declared = (contactLanguage ?? '').trim().toLowerCase()
  return declared === 'de' || declared === 'en' || declared === 'it' ? declared : 'fr'
}
