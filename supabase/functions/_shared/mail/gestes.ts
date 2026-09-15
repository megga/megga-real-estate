// supabase/functions/_shared/mail/gestes.ts
// Un geste de `mail-actions` (lu, étoile, archive, corbeille, spam) chez Gmail ou Graph, pour
// les messages d'un fil ou d'un LOT. IMAP a sa voie (`imapApply`, une connexion par geste).
//
// ⛔ UN APPEL HTTP PAR MESSAGE, À LA FILE (revue du 15.09.2026) : « Supprimer » douze fils de
// cinq messages enchaînait soixante appels — six à quinze secondes de modale occupée. Les
// appels sont désormais GROUPÉS : `messages.batchModify` par jeu de libellés, `$batch` par
// vingt. Le fournisseur rend ce qu'il a refusé ; `mail-actions` en tire un verdict PAR FIL.
import { gmailBatchModify, gmailLabelPatch, type GmailDeps } from './gmail.ts'
import { graphBatch, type GraphDeps, type GraphSousRequete } from './graph.ts'
import type { MailDirection, MailProviderId, MailThreadAction } from './types.ts'

/** Ce qu'un geste touche d'un message. */
export interface MessageDuGeste { provider_message_id: string; direction: MailDirection }

/** Ce que Gmail ou Graph a fait d'un geste : les nouveaux ids (déplacement Graph), et les messages refusés. */
export interface GesteFournisseur { renamed: Record<string, string>; refuses: ReadonlySet<string> }

/**
 * Répercute `action` sur `msgs` chez Gmail ou Graph, en appels groupés. Une ligne `pending:`
 * (copie provisoire d'un envoi) n'existe pas encore chez le fournisseur : elle est sautée.
 */
export async function gesteChezLeFournisseur(
  provider: MailProviderId, token: string, action: MailThreadAction, msgs: MessageDuGeste[], deps: GmailDeps & GraphDeps = {},
): Promise<GesteFournisseur> {
  const vises = msgs.filter((m) => !m.provider_message_id.startsWith('pending:'))
  if (provider === 'gmail') {
    // La table des libellés dépend de la DIRECTION du message (INBOX ne se pose jamais sur une
    // copie « Envoyés », `gmailLabelPatch`) : un appel par jeu de libellés, pas un pour tous.
    const parJeu = new Map<string, { add: string[]; remove: string[]; ids: string[] }>()
    for (const m of vises) {
      const { add, remove } = gmailLabelPatch(action, m.direction)
      if (add.length === 0 && remove.length === 0) continue
      const cle = JSON.stringify([add, remove])
      const jeu = parJeu.get(cle) ?? { add, remove, ids: [] }
      jeu.ids.push(m.provider_message_id)
      parJeu.set(cle, jeu)
    }
    const refuses = new Set<string>()
    for (const j of parJeu.values()) for (const id of await gmailBatchModify(token, j.ids, j.add, j.remove, deps)) refuses.add(id)
    return { renamed: {}, refuses }
  }
  if (provider === 'outlook') {
    const cibles: { id: string; requete: GraphSousRequete; deplace: boolean }[] = []
    for (const m of vises) {
      const url = `/me/messages/${encodeURIComponent(m.provider_message_id)}`
      if (action === 'mark_read' || action === 'mark_unread') {
        cibles.push({ id: m.provider_message_id, requete: { method: 'PATCH', url, body: { isRead: action === 'mark_read' } }, deplace: false })
      } else if (action === 'star' || action === 'unstar') {
        cibles.push({ id: m.provider_message_id, requete: { method: 'PATCH', url, body: { flag: { flagStatus: action === 'star' ? 'flagged' : 'notFlagged' } } }, deplace: false })
      } else if (m.direction === 'inbound') {
        // Seuls les ENTRANTS se déplacent : une copie « Envoyés » reste dans les Envoyés.
        const dest = action === 'archive' ? 'archive' : action === 'trash' ? 'deleteditems' : action === 'spam' ? 'junkemail' : 'inbox'
        cibles.push({ id: m.provider_message_id, requete: { method: 'POST', url: `${url}/move`, body: { destinationId: dest } }, deplace: true })
      }
    }
    const reponses = await graphBatch(token, cibles.map((c) => c.requete), deps)
    const renamed: Record<string, string> = {}
    const refuses = new Set<string>()
    cibles.forEach((c, i) => {
      const r = reponses[i]
      if (!r || r.status < 200 || r.status >= 300) { refuses.add(c.id); return }
      if (c.deplace && typeof r.body?.id === 'string') renamed[c.id] = r.body.id
    })
    return { renamed, refuses }
  }
  throw new Error(`provider ${provider} not supported by this build`)
}

/**
 * Le verdict d'UN fil : refusé si le fournisseur a refusé l'un de ses messages — la moitié
 * d'un fil archivée n'est pas un fil archivé. `null` s'il est passé.
 */
export function refusDuFil(msgs: MessageDuGeste[], fait: GesteFournisseur): 'provider_failed' | null {
  return msgs.some((m) => fait.refuses.has(m.provider_message_id)) ? 'provider_failed' : null
}

/** Les renommages qui concernent CES messages — un fil à la fois, pour un verdict par fil. */
export function renommagesDe(renamed: Record<string, string>, msgs: MessageDuGeste[]): Record<string, string> {
  return Object.fromEntries(msgs.flatMap((m) => (renamed[m.provider_message_id] ? [[m.provider_message_id, renamed[m.provider_message_id]]] : [])))
}
