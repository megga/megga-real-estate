// supabase/functions/_shared/mail/graph.ts
// Adaptateur Microsoft Graph v1.0 (délégué, jeton utilisateur). Voir l'en-tête de
// la tâche 1.7 du plan pour les cinq faits Graph qui décident de ce code.
import type { NormalizedAttachment, NormalizedMessage, RemoteChange } from './types.ts'
import { htmlToText, snippetOf } from './mime.ts'
import { MailAuthError } from './secrets.ts'

const BASE = 'https://graph.microsoft.com/v1.0'
export const GRAPH_PAGE_SIZE = 50
const DELTA_SELECT = 'id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,flag,parentFolderId'
export const GRAPH_FOLDERS = ['inbox', 'sentitems', 'archive', 'deleteditems'] as const
export type GraphFolder = 'inbox' | 'sentitems'

export interface GraphDeps { fetch?: typeof fetch }
export interface GraphRecipient { emailAddress: { name: string | null; address: string } }
export interface GraphMessage {
  id: string
  conversationId?: string
  internetMessageId?: string
  subject?: string | null
  bodyPreview?: string
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  isDraft?: boolean
  hasAttachments?: boolean
  parentFolderId?: string
  flag?: { flagStatus?: 'notFlagged' | 'flagged' | 'complete' }
  from?: GraphRecipient
  toRecipients?: GraphRecipient[]
  ccRecipients?: GraphRecipient[]
  bccRecipients?: GraphRecipient[]
  replyTo?: GraphRecipient[]
  '@removed'?: { reason: string }
}
export interface GraphBody {
  body?: { contentType: string; content: string }
  internetMessageHeaders?: { name: string; value: string }[]
}
export interface GraphAttachment {
  id: string
  name: string
  contentType: string | null
  size: number
  isInline: boolean
  contentId?: string | null
  '@odata.type': string
}

export class GraphApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/**
 * ⛔ SUR CHAQUE APPEL, SANS EXCEPTION. Par défaut l'id d'un message Outlook CHANGE
 * quand l'item change de dossier (« this value changes when the item is moved from one
 * container … to another. To change this behavior, use the Prefer: IdType header »,
 * concepts/outlook-immutable-id). Or le delta est PAR DOSSIER : archiver — le geste
 * Outlook le plus courant — sortait le message de la Réception, qui le signalait
 * `@removed` sous son ANCIEN id ; l'ancien id ne résolvait plus, et le code supprimait
 * la ligne (puis le fil, en cascade). Avec l'id immuable, l'id survit au déplacement,
 * donc un `@removed` peut être LEVÉ EN DOUTE par un simple GET : 404 ⇒ vraiment parti,
 * 200 ⇒ déplacé, et son `parentFolderId` dit où.
 *
 * L'en-tête ne vaut que pour la requête qui le porte. Les `@odata.nextLink` /
 * `@odata.deltaLink` sont compatibles avec les deux formats d'id : aucun resynchro à
 * prévoir. Les dossiers (mailFolder) ne connaissent pas l'id immuable — leurs ids
 * étaient déjà constants, `graphFolderIds` est donc inchangé.
 */
export const IMMUTABLE_ID_PREFER = 'IdType="ImmutableId"'

/** Fusionne notre `Prefer` avec celui de l'appelant (odata.maxpagesize) — un seul en-tête. */
function withImmutableId(headers: Record<string, string> = {}): Record<string, string> {
  const own = headers.Prefer
  return { ...headers, Prefer: own ? `${own}, ${IMMUTABLE_ID_PREFER}` : IMMUTABLE_ID_PREFER }
}

async function gcall<T>(token: string, url: string, deps: GraphDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(url.startsWith('https://') ? url : `${BASE}${url}`, {
    ...init,
    headers: withImmutableId({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((init.headers ?? {}) as Record<string, string>) }),
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (res.status === 202 || res.status === 204) return undefined as T
  if (!res.ok) throw new GraphApiError(res.status, `graph ${url.slice(0, 80)}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export async function graphFolderIds(token: string, deps: GraphDeps = {}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of GRAPH_FOLDERS) {
    const j = await gcall<{ id: string }>(token, `/me/mailFolders/${f}?$select=id`, deps)
    out[f] = j.id
  }
  return out
}

/** Une passe de delta : suit les nextLink jusqu'au deltaLink (ou jusqu'à `maxPages`). */
export async function graphDelta(
  token: string, folder: GraphFolder, deltaLink: string | null, sinceIso: string, deps: GraphDeps = {}, maxPages = 4,
): Promise<{ items: GraphMessage[]; deltaLink: string | null; nextLink: string | null }> {
  let url = deltaLink ?? `/me/mailFolders/${folder}/messages/delta?$select=${DELTA_SELECT}&$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}`
  const items: GraphMessage[] = []
  let pages = 0
  while (url && pages < maxPages) {
    const j = await gcall<{ value: GraphMessage[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(
      token, url, deps, { headers: { Prefer: `odata.maxpagesize=${GRAPH_PAGE_SIZE}` } },
    )
    items.push(...(j.value ?? []))
    pages++
    if (j['@odata.deltaLink']) return { items, deltaLink: j['@odata.deltaLink'], nextLink: null }
    url = j['@odata.nextLink'] ?? ''
  }
  // Budget de pages épuisé : on garde le nextLink comme curseur provisoire.
  return { items, deltaLink: null, nextLink: url || null }
}

export async function graphGetBody(token: string, id: string, deps: GraphDeps = {}): Promise<GraphBody> {
  return gcall<GraphBody>(token, `/me/messages/${encodeURIComponent(id)}?$select=body,internetMessageHeaders`, deps)
}

export async function graphListAttachments(token: string, id: string, deps: GraphDeps = {}): Promise<GraphAttachment[]> {
  const j = await gcall<{ value: GraphAttachment[] }>(token, `/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline,contentId`, deps)
  return (j.value ?? []).filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
}

export async function graphAttachmentBytes(token: string, messageId: string, attachmentId: string, deps: GraphDeps = {}): Promise<Uint8Array> {
  const f = deps.fetch ?? globalThis.fetch
  // Même en-tête que partout ailleurs : les ids stockés (message ET pièce) viennent
  // d'appels immuables, cette lecture doit vivre dans le même espace d'identifiants.
  const res = await f(`${BASE}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`, { headers: withImmutableId({ Authorization: `Bearer ${token}` }) })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (!res.ok) throw new GraphApiError(res.status, `graph attachment: http ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function graphPatch(token: string, id: string, patch: { isRead?: boolean; flagged?: boolean }, deps: GraphDeps = {}): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.isRead !== undefined) body.isRead = patch.isRead
  if (patch.flagged !== undefined) body.flag = { flagStatus: patch.flagged ? 'flagged' : 'notFlagged' }
  await gcall(token, `/me/messages/${encodeURIComponent(id)}`, deps, { method: 'PATCH', body: JSON.stringify(body) })
}

/** Déplace et rend le NOUVEL id. */
export async function graphMove(token: string, id: string, destination: 'inbox' | 'archive' | 'deleteditems', deps: GraphDeps = {}): Promise<string> {
  const j = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(id)}/move`, deps, { method: 'POST', body: JSON.stringify({ destinationId: destination }) })
  return j.id
}

export interface GraphOutgoing {
  subject: string
  html: string
  to: { name: string | null; email: string }[]
  cc: { name: string | null; email: string }[]
  bcc: { name: string | null; email: string }[]
  internetMessageId: string
  attachments: { filename: string; mimeType: string; base64: string }[]
}
const rcpt = (a: { name: string | null; email: string }) => ({ emailAddress: { address: a.email, name: a.name ?? undefined } })

/**
 * Envoi : brouillon (POST /me/messages ou createReply/createForward) → PATCH du
 * contenu → POST send. Le brouillon porte notre internetMessageId, ce qui permet
 * de rapprocher la copie « Envoyés » quand le delta la rend.
 */
export async function graphSend(
  token: string, m: GraphOutgoing, mode: { kind: 'new' } | { kind: 'reply' | 'forward'; providerMessageId: string }, deps: GraphDeps = {},
): Promise<{ draftId: string }> {
  const payload = {
    subject: m.subject,
    body: { contentType: 'HTML', content: m.html },
    toRecipients: m.to.map(rcpt),
    ccRecipients: m.cc.map(rcpt),
    bccRecipients: m.bcc.map(rcpt),
    internetMessageId: m.internetMessageId,
    attachments: m.attachments.map((a) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.mimeType, contentBytes: a.base64 })),
  }
  let draftId: string
  if (mode.kind === 'new') {
    const d = await gcall<{ id: string }>(token, '/me/messages', deps, { method: 'POST', body: JSON.stringify(payload) })
    draftId = d.id
  } else {
    const verb = mode.kind === 'reply' ? 'createReply' : 'createForward'
    const d = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(mode.providerMessageId)}/${verb}`, deps, { method: 'POST', body: '{}' })
    draftId = d.id
    await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'PATCH', body: JSON.stringify(payload) })
  }
  await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/send`, deps, { method: 'POST' })
  return { draftId }
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
const addr = (r?: GraphRecipient) => (r?.emailAddress?.address ? { name: r.emailAddress.name || null, email: r.emailAddress.address.toLowerCase() } : null)
const addrs = (rs?: GraphRecipient[]) => (rs ?? []).map(addr).filter((a): a is { name: string | null; email: string } => !!a)

export function normalizeGraphMessage(
  m: GraphMessage, body: GraphBody, atts: GraphAttachment[], folderIds: Record<string, string>, boxEmail: string,
): NormalizedMessage {
  const from = addr(m.from) ?? { name: null, email: '' }
  const inSent = m.parentFolderId === folderIds.sentitems
  const outbound = inSent || from.email === boxEmail.toLowerCase()
  const html = body.body?.contentType?.toLowerCase() === 'html' ? body.body.content : null
  const text = html ? htmlToText(html) : (body.body?.content ?? null)
  const hdr = (n: string) => (body.internetMessageHeaders ?? []).find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? ''
  const attachments: NormalizedAttachment[] = atts.map((a) => ({
    providerAttachmentId: a.id, filename: a.name, mimeType: a.contentType ?? 'application/octet-stream',
    sizeBytes: a.size ?? 0, isInline: !!a.isInline, contentId: a.contentId ?? null,
  }))
  return {
    providerMessageId: m.id,
    providerThreadId: m.conversationId ?? m.id,
    rfc822MessageId: m.internetMessageId ?? null,
    inReplyTo: hdr('In-Reply-To') || null,
    references: hdr('References').split(/\s+/).filter(Boolean),
    direction: outbound ? 'outbound' : 'inbound',
    from,
    to: addrs(m.toRecipients),
    cc: addrs(m.ccRecipients),
    bcc: addrs(m.bccRecipients),
    replyTo: addr(m.replyTo?.[0])?.email ?? null,
    subject: m.subject ?? '',
    snippet: snippetOf(m.bodyPreview ?? text ?? ''),
    bodyText: text,
    bodyHtml: html,
    sentAt: new Date(m.receivedDateTime ?? m.sentDateTime ?? Date.now()).toISOString(),
    isRead: !!m.isRead,
    isStarred: m.flag?.flagStatus === 'flagged',
    inInbox: m.parentFolderId === folderIds.inbox,
    isTrashed: m.parentFolderId === folderIds.deleteditems,
    isDraft: !!m.isDraft,
    providerLabels: m.parentFolderId ? [m.parentFolderId] : [],
    attachments,
  }
}

/** Un item que le delta du dossier ne voit plus : à lever en doute, pas à supprimer. */
export interface GraphRemoval { id: string; reason: string }

/**
 * Items du delta → nouveaux à charger (inconnus) / drapeaux (connus) / DISPARUS.
 *
 * ⛔ Les disparus sortent dans leur propre panier, PAS en `message_deleted`. Le delta
 * est une opération PAR DOSSIER : un message archivé, mis à la corbeille ou rangé dans
 * un dossier personnel quitte la Réception et y est signalé `@removed` exactement comme
 * un message effacé. Les confondre supprimait la ligne — et le fil entier quand c'était
 * le seul message —, si bien qu'archiver un courrier client dans Outlook le faisait
 * disparaître du CRM, de la Réception, du dossier Archivé et de la fiche contact. Même
 * `reason: "changed"`, que Graph documente comme une suppression RESTAURABLE, était
 * détruit. Qui tranche, c'est `resolveGraphRemoval` : un GET sur l'id (immuable, donc
 * il survit au déplacement).
 */
export function deltaToChanges(items: GraphMessage[], known: Set<string>, folderIds: Record<string, string>): { added: GraphMessage[]; changes: RemoteChange[]; removed: GraphRemoval[] } {
  const added: GraphMessage[] = []
  const changes: RemoteChange[] = []
  const removed: GraphRemoval[] = []
  for (const it of items) {
    if (it['@removed']) { removed.push({ id: it.id, reason: it['@removed'].reason ?? 'unknown' }); continue }
    if (!known.has(it.id)) { added.push(it); continue }
    changes.push({
      kind: 'flags', providerMessageId: it.id,
      isRead: !!it.isRead, isStarred: it.flag?.flagStatus === 'flagged',
      inInbox: it.parentFolderId === folderIds.inbox, isTrashed: it.parentFolderId === folderIds.deleteditems,
    })
  }
  return { added, changes, removed }
}

/**
 * Que faire d'un `@removed` : GET du message par son id immuable.
 *   404            ⇒ il n'existe plus dans la boîte : suppression (`message_deleted`).
 *   200 + dossier  ⇒ il a DÉMÉNAGÉ : on reclasse le fil (archivé / corbeille), on ne
 *                    supprime rien. `graphFolderIds` résout déjà les quatre dossiers.
 *   autre erreur   ⇒ INDÉTERMINÉ : `null`, on ne touche à rien. Détruire sur un 500 ou
 *                    un 429 serait irréversible ; lever bloquerait la boîte à chaque
 *                    passe sur ce seul message. Le delta l'a consommé, mais un état de
 *                    drapeau raté se rattrape, une conversation perdue non.
 * ⚠ Le 401 continue de remonter (MailAuthError levée par `gcall`) : c'est bien une
 * demande de reconnexion, pas une incertitude sur un message.
 */
export async function resolveGraphRemoval(
  token: string, r: GraphRemoval, folderIds: Record<string, string>, deps: GraphDeps = {},
): Promise<RemoteChange | null> {
  let parentFolderId: string | undefined
  try {
    const j = await gcall<{ parentFolderId?: string }>(token, `/me/messages/${encodeURIComponent(r.id)}?$select=id,parentFolderId`, deps)
    parentFolderId = j?.parentFolderId
  } catch (e) {
    if (e instanceof GraphApiError && e.status === 404) return { kind: 'message_deleted', providerMessageId: r.id }
    if (e instanceof GraphApiError) {
      console.error(`[mail graph] @removed ${r.reason} non résolu (http ${e.status}) — aucun changement appliqué`)
      return null
    }
    throw e
  }
  if (!parentFolderId) return null
  return {
    kind: 'flags', providerMessageId: r.id,
    inInbox: parentFolderId === folderIds.inbox,
    isTrashed: parentFolderId === folderIds.deleteditems,
  }
}
