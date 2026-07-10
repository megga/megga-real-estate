// Rédaction PII du TOUR LIVE de l'agent WhatsApp — la frontière DeepSeek.
// Module PUR (zéro I/O, zéro Deno) — testable vitest, miroir de copilot-redaction.ts.
//
// Périmètre (même invariant que le copilote : « aucun identifiant sensible vers
// DeepSeek ») : le message courant de l'agent, l'historique agent↔MEGGA (C1) et
// les résultats d'outils CRM réinjectés dans la boucle. Les identifiants
// catalogués par pii-redaction.ts (AVS, IBAN, carte, passeport, mot de passe,
// clé API, date de naissance EXPLICITE — jamais les dates de RDV) deviennent des
// marqueurs [REDACTED:*] ; les noms/téléphones/emails restent (nécessaires au
// travail CRM — même position que copilot-redaction.ts, résidence tranchée ailleurs).
//
// Choix d'architecture : on rédige AU FIL (dans callDeepSeek), pas à chaque site
// d'assemblage — un point d'étranglement unique que ni la passe finale forcée ni
// un futur site de push d'outil ne peuvent contourner. Le message SYSTEM est
// exclu : il est composé de parties déjà propres (voix/corrections rédigées au
// fetch, texte d'instruction statique) — le rédiger n'apporterait rien et
// exposerait les consignes aux faux positifs des regex.
//
// Trade-off assumé (identique au copilote) : si l'agent dicte un IBAN à stocker
// (« ajoute une note : IBAN CH93… »), DeepSeek ne le voit pas → la note stockée
// portera le marqueur, pas la valeur. La saisie d'identifiants sensibles se fait
// dans le CRM, pas via le chat MEGGA.

import { redactPII } from './pii-redaction.ts'

/** Message OpenAI-style minimal : seul un `content` string nous concerne. */
export interface LlmWireMessage extends Record<string, unknown> {
  role?: unknown
  content?: unknown
}

// Les UUID des résultats d'outils sont des CLÉS fonctionnelles (id de bien pour
// send_listings, contact_id…), pas des identifiants sensibles. Or le pattern CARD
// (13-19 chiffres) peut mordre la queue d'un UUID à segments tout-numériques
// (« …-2222-3333-444455556666 » → [REDACTED:CARD]) et casser l'outil en aval.
// On BLINDE donc les UUID avant redactPII (placeholders en zone Unicode privée,
// jamais produits par redactPII) puis on les restaure — sans toucher au catalogue
// partagé de pii-redaction.ts.
const UUID_RE = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g

function redactLlmText(rawInput: string): string {
  // Durcissement (revue) : strip des délimiteurs privés d'un texte ENTRANT : un message
  // forgé contenant "\uE000 N \uE001" ne peut donc jamais piloter la passe de restauration.
  const text = rawInput.replace(/[\uE000\uE001]/g, '')
  const uuids: string[] = []
  const shielded = text.replace(UUID_RE, (u) => {
    uuids.push(u)
    return `\uE000${uuids.length - 1}\uE001`
  })
  const redacted = redactPII(shielded).redactedText
  return uuids.length === 0
    ? redacted
    : redacted.replace(/\uE000(\d+)\uE001/g, (_, i) => uuids[Number(i)] ?? '')
}

/** Rend une COPIE du tableau où tout `content` string des messages NON-system
 *  est passé par redactPII (UUID blindés). Idempotent (les marqueurs
 *  [REDACTED:*] ne re-matchent pas). Ne touche ni les rôles, ni
 *  tool_calls/tool_call_id, ni les contents non-string (assistant à
 *  content:null porteur de tool_calls). */
export function redactLlmMessages<T extends LlmWireMessage>(messages: T[]): T[] {
  return messages.map((m) => {
    if (m.role === 'system') return m
    if (typeof m.content !== 'string' || m.content === '') return m
    return { ...m, content: redactLlmText(m.content) }
  })
}
