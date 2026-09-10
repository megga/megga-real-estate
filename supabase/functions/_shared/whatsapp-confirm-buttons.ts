// Boutons de confirmation du copilote WhatsApp — PUR (aucun I/O), testable Node et Deno.
//
// POURQUOI LE BOUTON PORTE L'IDENTIFIANT DE SON ACTION.
// Un « oui » tapé répond toujours à la question du moment. Un bouton, lui, RESTE dans la
// conversation : [Oui] peut être touché une semaine plus tard, sous une question périmée.
// Lire son seul libellé confirmerait l'action en attente AU MOMENT DE L'APPUI — une
// publication sur les portails, par exemple, quand l'agent avait sous les yeux un
// déplacement de deal. L'identifiant `pa:<uuid>:yes|no` lie chaque bouton à UNE action.
// Spec : docs/superpowers/specs/2026-09-10-whatsapp-boutons-confirmations-design.md

import { BUTTONS_BODY_MAX } from './whatsapp-gateway.ts'
import { toWhatsAppText } from './whatsapp-format.ts'
import { meggaProse } from './megga-prose.ts'
import { t, type WaLang } from './whatsapp-i18n.ts'
import type { OutboundPayload } from './whatsapp-outbound-guard.ts'

export type ConfirmChoice = 'yes' | 'no'

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(`^${UUID}$`, 'i')
const REPLY_ID_RE = new RegExp(`^pa:(${UUID}):(yes|no)$`, 'i')

/** Identifiant porté par un bouton : `pa:<uuid de whatsapp_pending_actions>:yes|no`. */
export function confirmReplyId(pendingId: string, choice: ConfirmChoice): string {
  // Un identifiant qu'on ne saurait pas relire ferait de chaque appui un bouton « périmé ».
  if (!UUID_RE.test(pendingId)) throw new RangeError(`confirmReplyId: uuid attendu (${pendingId})`)
  return `pa:${pendingId.toLowerCase()}:${choice}`
}

/** Relit un identifiant de bouton de confirmation ; `null` pour tout le reste. */
export function parseConfirmReplyId(
  replyId: string | null | undefined,
): { pendingId: string; choice: ConfirmChoice } | null {
  const m = REPLY_ID_RE.exec(replyId ?? '')
  if (!m) return null
  return { pendingId: m[1].toLowerCase(), choice: m[2].toLowerCase() as ConfirmChoice }
}

/**
 * Ce qu'un appui décide, face à l'action qui attend VRAIMENT.
 *
 * - `null`  : la réponse n'est pas un bouton de confirmation, le chemin tapé s'applique ;
 * - `stale` : le bouton vise une autre action, ou aucune n'attend. On le dit, sans rien
 *   consommer ni rien envoyer au copilote ;
 * - `yes` / `no` : le bouton vise l'action en attente.
 */
export function resolveButtonDecision(
  replyId: string | null | undefined,
  currentPendingId: string | null | undefined,
): ConfirmChoice | 'stale' | null {
  const parsed = parseConfirmReplyId(replyId)
  if (!parsed) return null
  if (!currentPendingId || parsed.pendingId !== currentPendingId.toLowerCase()) return 'stale'
  return parsed.choice
}

/**
 * Les messages à envoyer pour une demande de confirmation, dans l'ORDRE.
 *
 * ⚠ La limite de 1024 caractères se mesure sur le texte qui PART, c'est-à-dire après la mise
 * en forme que la garde appliquera (`meggaProse` puis `toWhatsAppText`). Au-delà, la question
 * complète part en texte, puis un court « Tu confirmes ? » porte les boutons : un brouillon
 * n'est jamais tronqué, l'agent valide exactement ce qui partira.
 */
export function planConfirmation(prompt: string, pendingId: string, lang: WaLang): OutboundPayload[] {
  const buttons = [
    { id: confirmReplyId(pendingId, 'yes'), title: t(lang, 'btnYes') },
    { id: confirmReplyId(pendingId, 'no'), title: t(lang, 'btnNo') },
  ]
  const formatted = toWhatsAppText(meggaProse(prompt))
  // Meta refuse un message à boutons sans corps : une question vide garde la formule courte.
  if (!formatted.trim()) return [{ type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
  if (formatted.length <= BUTTONS_BODY_MAX) return [{ type: 'buttons', body: prompt, buttons }]
  return [{ type: 'text', body: prompt }, { type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
}
