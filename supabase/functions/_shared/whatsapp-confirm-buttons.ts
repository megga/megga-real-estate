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
import { formatOutboundText } from './whatsapp-format.ts'
import { t, type WaLang } from './whatsapp-i18n.ts'
import type { OutboundPayload } from './whatsapp-outbound-guard.ts'

export type ConfirmChoice = 'yes' | 'no'

// Hex en MAJUSCULE OU minuscule (les deux casses dans la classe de caractères), mais le
// PRÉFIXE `pa:` et le CHOIX `yes|no` restent en minuscules strictes — aucun flag `i` sur les
// regex. Un bouton qu'on a nous-mêmes émis ne s'écrit que dans cette forme exacte
// (`confirmReplyId` la fige en minuscules) : accepter `PA:…:YES` élargirait ce qu'on reconnaît
// bien au-delà de ce qu'on peut jamais produire, sans aucun bénéfice — Meta renvoie l'id
// VERBATIM, il ne le rend jamais dans une autre casse que celle qu'on lui a postée.
const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const UUID_RE = new RegExp(`^${UUID}$`)
const REPLY_ID_RE = new RegExp(`^pa:(${UUID}):(yes|no)$`)

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
  // `choice` n'a plus besoin d'être normalisé : sans flag `i`, le groupe ne peut capturer que
  // le littéral `yes` ou `no` en minuscules — la regex a déjà refusé tout le reste.
  return { pendingId: m[1].toLowerCase(), choice: m[2] as ConfirmChoice }
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
 * ⚠ La limite de 1024 caractères se mesure sur le texte qui PART, c'est-à-dire après
 * `formatOutboundText` — la MÊME fonction que la garde applique avant de poster. Au-delà, la
 * question complète part en texte, puis un court « Tu confirmes ? » porte les boutons : un
 * brouillon n'est jamais tronqué, l'agent valide exactement ce qui partira.
 */
export function planConfirmation(prompt: string, pendingId: string, lang: WaLang): OutboundPayload[] {
  const buttons = [
    { id: confirmReplyId(pendingId, 'yes'), title: t(lang, 'btnYes') },
    { id: confirmReplyId(pendingId, 'no'), title: t(lang, 'btnNo') },
  ]
  const formatted = formatOutboundText(prompt)
  // Meta refuse un message à boutons sans corps : une question vide garde la formule courte.
  if (!formatted.trim()) return [{ type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
  if (formatted.length <= BUTTONS_BODY_MAX) return [{ type: 'buttons', body: prompt, buttons }]
  return [{ type: 'text', body: prompt }, { type: 'buttons', body: t(lang, 'confirmShort'), buttons }]
}

/** Ce que l'expéditeur injecté rend — le sous-ensemble du résultat de la garde utile ici. */
export type ConfirmSendOutcome = { ok: true } | { ok: false; blocked: boolean; error?: string }

/**
 * Livre le PLAN d'une confirmation (`planConfirmation`), `send` étant INJECTÉ — c'est ce qui
 * rend les trois règles ci-dessous testables sans réseau ni Supabase, au lieu de ne vivre que
 * dans la lecture du code :
 *
 *   1. des boutons ne partent QUE si le texte complet est parti (cas découpé — le texte est
 *      TOUJOURS le premier élément du plan, donc son échec arrête la boucle avant les boutons) ;
 *   2. un message à boutons SEUL, refusé HORS garde (Meta, réseau…), retombe sur la question en
 *      texte — jamais quand c'est la GARDE qui a refusé : le texte serait rejeté pour la même
 *      raison, un repli y serait une tentative perdue d'avance ;
 *   3. un refus de GARDE arrête tout, sans journal ni repli — ce n'est pas une panne à tracer.
 *
 * Les échecs sont RENDUS, pas journalisés ici : l'appelant sait sous quel nom écrire (« whatsapp
 * confirmation: … »), ce module PUR ne le sait pas.
 */
export async function deliverConfirmation(
  plan: OutboundPayload[],
  prompt: string,
  send: (payload: OutboundPayload) => Promise<ConfirmSendOutcome>,
): Promise<Array<{ type: OutboundPayload['type']; error: string }>> {
  const failures: Array<{ type: OutboundPayload['type']; error: string }> = []
  for (const payload of plan) {
    const r = await send(payload)
    if (r.ok) continue
    if (!r.blocked) failures.push({ type: payload.type, error: String(r.error ?? '').slice(0, 120) })
    if (!r.blocked && payload.type === 'buttons' && plan.length === 1) {
      const fallback = await send({ type: 'text', body: prompt })
      if (!fallback.ok && !fallback.blocked) {
        failures.push({ type: 'text', error: String(fallback.error ?? '').slice(0, 120) })
      }
    }
    return failures
  }
  return failures
}
