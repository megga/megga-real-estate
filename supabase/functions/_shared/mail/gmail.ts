// supabase/functions/_shared/mail/gmail.ts
// Adaptateur Gmail API v1 (https://gmail.googleapis.com/gmail/v1/users/me).
// Première passe : messages.list `newer_than:90d` par pages de 50 ; ensuite
// history.list depuis le dernier historyId. Un 404 sur history = historique
// expiré côté Google : on repart en passe initiale (jamais une boucle d'erreur).
// PUR : `fetch` injectable ; aucune écriture en base ici (c'est ingest.ts).
import type { MailDirection, MailThreadAction, NormalizedAttachment, NormalizedMessage, RemoteChange } from './types.ts'
import { base64UrlDecodeToString, decodeRfc2047, htmlToText, parseAddress, parseAddressList, snippetOf } from './mime.ts'
import { MailAuthError } from './secrets.ts'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
export const GMAIL_INITIAL_QUERY = 'newer_than:90d -in:spam -in:trash -in:chats'
export const GMAIL_PAGE_SIZE = 50

export interface GmailDeps { fetch?: typeof fetch }

export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}
export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload: GmailPart
}
export interface GmailHistoryRecord {
  id: string
  messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[]
  messagesDeleted?: { message: { id: string; threadId: string } }[]
  labelsAdded?: { message: { id: string; threadId: string }; labelIds: string[] }[]
  labelsRemoved?: { message: { id: string; threadId: string }; labelIds: string[] }[]
}
export interface GmailHistoryPage {
  historyId?: string
  history?: GmailHistoryRecord[]
  nextPageToken?: string
}

export class GmailApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function gcall<T>(token: string, path: string, deps: GmailDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'gmail: 401')
  if (!res.ok) throw new GmailApiError(res.status, `gmail ${path}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export async function gmailIdentity(token: string, deps: GmailDeps = {}): Promise<{ email: string; historyId: string }> {
  const j = await gcall<{ emailAddress: string; historyId: string }>(token, '/profile', deps)
  return { email: j.emailAddress.toLowerCase(), historyId: String(j.historyId) }
}

export async function gmailListInitial(token: string, pageToken: string | null, deps: GmailDeps = {}): Promise<{ ids: string[]; nextPageToken: string | null }> {
  const q = new URLSearchParams({ q: GMAIL_INITIAL_QUERY, maxResults: String(GMAIL_PAGE_SIZE) })
  if (pageToken) q.set('pageToken', pageToken)
  const j = await gcall<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${q}`, deps)
  return { ids: (j.messages ?? []).map((m) => m.id), nextPageToken: j.nextPageToken ?? null }
}

export async function gmailHistory(
  token: string, startHistoryId: string, pageToken: string | null, deps: GmailDeps = {},
): Promise<{ expired: boolean; page: GmailHistoryPage | null }> {
  const q = new URLSearchParams({ startHistoryId, maxResults: '100' })
  for (const t of ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']) q.append('historyTypes', t)
  if (pageToken) q.set('pageToken', pageToken)
  try {
    const page = await gcall<GmailHistoryPage>(token, `/history?${q}`, deps)
    return { expired: false, page }
  } catch (e) {
    if (e instanceof GmailApiError && e.status === 404) return { expired: true, page: null }
    throw e
  }
}

export async function gmailGetMessage(token: string, id: string, deps: GmailDeps = {}): Promise<GmailMessage> {
  return gcall<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`, deps)
}

export async function gmailModify(
  token: string, id: string, add: string[], remove: string[], deps: GmailDeps = {}, scope: 'message' | 'thread' = 'message',
): Promise<void> {
  const path = scope === 'thread' ? `/threads/${encodeURIComponent(id)}/modify` : `/messages/${encodeURIComponent(id)}/modify`
  await gcall(token, path, deps, { method: 'POST', body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }) })
}

/**
 * Les libellés à poser et à retirer pour un geste, SUR CE MESSAGE-LÀ.
 *
 * ⛔ INBOX NE SE POSE QUE SUR UN MESSAGE ENTRANT, et c'est tout l'objet de cette fonction.
 * Un geste de `mail-actions` s'applique à TOUS les messages du fil, copies « Envoyés »
 * comprises — or celles-ci n'ont jamais porté INBOX. La table était pourtant
 * `untrash: [['INBOX'], ['TRASH']]` sans distinction : après avoir restauré une
 * conversation depuis la corbeille, l'agent retrouvait ses PROPRES réponses dans sa
 * Réception Gmail. `unarchive` avait la même forme et le même défaut. Retirer un libellé
 * reste juste pour tout le monde (retirer INBOX d'un message qui ne l'a pas est sans
 * effet) ; c'est l'AJOUT qui doit être dirigé.
 *
 * ⚠ On reste sur `messages.modify` plutôt que sur les endpoints dédiés `/trash` et
 * `/untrash`. Le guide « Manage labels » donne TRASH « can be manually applied: yes »
 * (seuls SENT et DRAFT sont à « no » — relu le 04.09.2026) : la voie actuelle est légale
 * et ne rendra pas 502. `users.messages.untrash` serait plus élégant, puisqu'il rendrait
 * au message son état d'avant — mais sa référence ne documente NULLE PART qu'il restaure
 * les libellés, INBOX compris. Échanger un défaut mesuré contre un comportement non
 * documenté n'est pas un progrès.
 */
export function gmailLabelPatch(action: MailThreadAction, direction: MailDirection): { add: string[]; remove: string[] } {
  const inbox = direction === 'inbound' ? ['INBOX'] : []
  const table: Record<MailThreadAction, [string[], string[]]> = {
    mark_read: [[], ['UNREAD']], mark_unread: [['UNREAD'], []],
    star: [['STARRED'], []], unstar: [[], ['STARRED']],
    archive: [[], ['INBOX']], unarchive: [inbox, []],
    trash: [['TRASH'], ['INBOX']], untrash: [inbox, ['TRASH']],
  }
  const [add, remove] = table[action]
  return { add, remove }
}

export async function gmailSend(token: string, rawBase64Url: string, threadId: string | null, deps: GmailDeps = {}): Promise<{ id: string; threadId: string }> {
  const body: Record<string, string> = { raw: rawBase64Url }
  if (threadId) body.threadId = threadId
  return gcall<{ id: string; threadId: string }>(token, '/messages/send', deps, { method: 'POST', body: JSON.stringify(body) })
}

export async function gmailAttachment(token: string, messageId: string, attachmentId: string, deps: GmailDeps = {}): Promise<Uint8Array> {
  const j = await gcall<{ data: string }>(token, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, deps)
  const b64 = j.data.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
function header(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h ? decodeRfc2047(h.value) : ''
}

function walk(part: GmailPart, acc: { text: string | null; html: string | null; atts: NormalizedAttachment[] }): void {
  const mime = (part.mimeType ?? '').toLowerCase()
  if (part.parts?.length) {
    for (const p of part.parts) walk(p, acc)
    return
  }
  if (part.filename && part.body?.attachmentId) {
    const disp = header(part.headers, 'Content-Disposition').toLowerCase()
    const cid = header(part.headers, 'Content-ID') || null
    acc.atts.push({
      providerAttachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime || 'application/octet-stream',
      sizeBytes: part.body.size ?? 0,
      isInline: disp.startsWith('inline') || !!cid,
      contentId: cid,
    })
    return
  }
  if (!part.body?.data) return
  if (mime === 'text/plain' && acc.text === null) acc.text = base64UrlDecodeToString(part.body.data)
  else if (mime === 'text/html' && acc.html === null) acc.html = base64UrlDecodeToString(part.body.data)
}

export function normalizeGmailMessage(m: GmailMessage, boxEmail: string): NormalizedMessage {
  const h = m.payload.headers
  const labels = m.labelIds ?? []
  const acc = { text: null as string | null, html: null as string | null, atts: [] as NormalizedAttachment[] }
  walk(m.payload, acc)
  const from = parseAddress(header(h, 'From')) ?? { name: null, email: '' }
  const outbound = labels.includes('SENT') || from.email === boxEmail.toLowerCase()
  const bodyText = acc.text ?? (acc.html ? htmlToText(acc.html) : null)
  const snippet = snippetOf(htmlToText(m.snippet ?? '') || bodyText || '')
  const replyTo = parseAddress(header(h, 'Reply-To'))
  return {
    providerMessageId: m.id,
    providerThreadId: m.threadId,
    rfc822MessageId: header(h, 'Message-ID') || null,
    inReplyTo: header(h, 'In-Reply-To') || null,
    references: header(h, 'References').split(/\s+/).filter(Boolean),
    direction: outbound ? 'outbound' : 'inbound',
    from,
    to: parseAddressList(header(h, 'To')),
    cc: parseAddressList(header(h, 'Cc')),
    bcc: parseAddressList(header(h, 'Bcc')),
    replyTo: replyTo?.email ?? null,
    subject: header(h, 'Subject'),
    snippet,
    bodyText,
    bodyHtml: acc.html,
    sentAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    isRead: !labels.includes('UNREAD'),
    isStarred: labels.includes('STARRED'),
    inInbox: labels.includes('INBOX'),
    isTrashed: labels.includes('TRASH'),
    isDraft: labels.includes('DRAFT'),
    providerLabels: labels,
    attachments: acc.atts,
  }
}

/**
 * Où en est la synchro incrémentale APRÈS avoir traité une page d'historique.
 *
 * ⛔ `page.historyId` n'est PAS le dernier enregistrement de la page : la référence
 * Gmail le définit comme « the ID of the mailbox's current history record », donc la
 * TÊTE de la boîte au moment de la réponse — et Gmail le rend sur CHAQUE page, y
 * compris celles qui portent un `nextPageToken`. L'adopter après la page 1 sur N
 * faisait repartir le tick suivant de la tête : les pages 2..N n'étaient jamais lues,
 * définitivement, sans erreur ni `last_error` (mesuré comme la moitié du courrier
 * d'un retour de congés qui n'arrivait jamais dans le CRM). Le curseur n'avance donc
 * que quand la pagination est DRAINÉE ; tant qu'elle ne l'est pas, c'est le
 * `pageToken` qui est persisté et repris au tick suivant.
 */
export function nextHistoryCursor(
  current: string | null, page: GmailHistoryPage,
): { historyId: string | null; pageToken: string | null } {
  const pageToken = page.nextPageToken ?? null
  if (pageToken) return { historyId: current, pageToken }
  return { historyId: page.historyId ? String(page.historyId) : current, pageToken: null }
}

/** history.list → ids à charger + opérations d'état. Les libellés Gmail deviennent des drapeaux. */
export function historyToChanges(page: GmailHistoryPage): { added: string[]; changes: RemoteChange[] } {
  const added: string[] = []
  const flagsById = new Map<string, Extract<RemoteChange, { kind: 'flags' }>>()
  const order: RemoteChange[] = []
  const flags = (id: string) => {
    let f = flagsById.get(id)
    if (!f) { f = { kind: 'flags', providerMessageId: id }; flagsById.set(id, f); order.push(f) }
    return f
  }
  const apply = (id: string, labelIds: string[], on: boolean) => {
    for (const l of labelIds) {
      if (l === 'UNREAD') flags(id).isRead = !on
      else if (l === 'STARRED') flags(id).isStarred = on
      else if (l === 'INBOX') flags(id).inInbox = on
      else if (l === 'TRASH') flags(id).isTrashed = on
    }
  }
  for (const rec of page.history ?? []) {
    for (const a of rec.messagesAdded ?? []) if (!added.includes(a.message.id)) added.push(a.message.id)
    for (const d of rec.messagesDeleted ?? []) order.push({ kind: 'message_deleted', providerMessageId: d.message.id })
    for (const l of rec.labelsAdded ?? []) apply(l.message.id, l.labelIds, true)
    for (const l of rec.labelsRemoved ?? []) apply(l.message.id, l.labelIds, false)
  }
  // Un message ajouté puis supprimé dans la même fenêtre n'a pas à être chargé.
  const deleted = new Set(order.filter((c) => c.kind === 'message_deleted').map((c) => c.providerMessageId))
  return { added: added.filter((id) => !deleted.has(id)), changes: order.filter((c) => c.kind !== 'flags' || Object.keys(c).length > 2) }
}
