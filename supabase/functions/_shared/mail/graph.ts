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

/**
 * ⛔ AUCUN APPEL PORTANT LE JETON NE SORT DE `graph.microsoft.com`.
 *
 * `gcall` accepte une URL ABSOLUE, et ces URLs-là ne viennent pas du code : ce sont les
 * `@odata.nextLink` / `@odata.deltaLink` que `sync.ts` persiste dans
 * `mail_accounts.sync_cursor` et rejoue au tick suivant avec `Authorization: Bearer
 * <jeton Graph de l'utilisateur>`. Aujourd'hui aucun appelant ne peut écrire ce curseur —
 * `sync_cursor` est hors de la liste de colonnes accordée à `authenticated`, et la table
 * n'a aucun grant d'UPDATE : seul le service-role l'écrit. C'est pourquoi ce n'est pas un
 * trou, et c'est aussi pourquoi l'invariant se pose ICI : il suffirait d'un futur chemin
 * qui laisse « réparer » un curseur depuis un corps de requête pour que ce `fetch`
 * devienne une exfiltration de jeton vers l'hôte d'un tiers. Une promesse tenue au
 * bord ne se vérifie pas ; une promesse tenue au point d'appel, si.
 *
 * L'hôte est comparé sur l'URL ANALYSÉE, jamais par préfixe de chaîne :
 * `https://graph.microsoft.com.evil.ch/` et `https://graph.microsoft.com@evil.ch/`
 * passent un `startsWith` naïf.
 */
export function graphUrl(url: string): string {
  const target = url.startsWith('https://') ? url : `${BASE}${url}`
  let host: string
  try { host = new URL(target).host } catch { throw new GraphApiError(0, `graph: URL illisible (${target.slice(0, 60)})`) }
  if (host !== 'graph.microsoft.com') throw new GraphApiError(0, `graph: hôte refusé (${host})`)
  return target
}

async function gcall<T>(token: string, url: string, deps: GraphDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(graphUrl(url), {
    ...init,
    headers: withImmutableId({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((init.headers ?? {}) as Record<string, string>) }),
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (res.status === 202 || res.status === 204) return undefined as T
  if (!res.ok) throw new GraphApiError(res.status, `graph ${url.slice(0, 80)}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

/**
 * Ids des quatre dossiers connus, résolus une fois puis persistés dans le curseur.
 *
 * ⛔ DEUX SONT PORTEURS, DEUX SONT DE CONFORT — et confondre les deux BRIQUAIT le compte.
 * `inbox` et `sentitems` sont les dossiers que le delta parcourt : sans eux il n'y a rien
 * à synchroniser. `archive` et `deleteditems` ne servent qu'à CLASSER (`inInbox`,
 * `isTrashed`). Or la boucle laissait `gcall` lever sur n'importe lequel des quatre : une
 * boîte sans dossier Archive — ou un 404/403 passager sur une seule recherche — faisait
 * échouer `syncGraph` AVANT le premier message. `syncAccount` écrivait `last_error` et un
 * backoff de 10 minutes, et comme `folderIds` n'est persisté qu'en cas de SUCCÈS, la passe
 * suivante rejouait la même recherche : le compte affichait `active`, portait un 404 Graph
 * en `last_error`, et ne synchronisait plus jamais un seul message.
 *
 * Un id de classement absent vaut donc « ni archivé ni en corbeille » — ce que
 * `sameFolder` traduit déjà d'une clé manquante, sans jamais faire d'`undefined ===
 * undefined` une égalité de dossiers.
 */
export async function graphFolderIds(token: string, deps: GraphDeps = {}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of GRAPH_FOLDERS) {
    const porteur = f === 'inbox' || f === 'sentitems'
    try {
      const j = await gcall<{ id: string }>(token, `/me/mailFolders/${f}?$select=id`, deps)
      out[f] = j.id
    } catch (e) {
      if (porteur || !(e instanceof GraphApiError && (e.status === 404 || e.status === 403))) throw e
      console.error(`[mail graph] dossier ${f} indisponible (http ${e.status}) — classement dégradé, synchro poursuivie`)
    }
  }
  return out
}

/**
 * Deux dossiers sont-ils le même ? ⚠ `a === b` ne suffit PAS : depuis que `graphFolderIds`
 * peut rendre une table incomplète, `undefined === undefined` dirait « oui » — un message
 * à `parentFolderId` absent (charge utile partielle, le cas NORMAL du delta) serait alors
 * déclaré dans la corbeille d'une boîte sans dossier Éléments supprimés.
 */
const sameFolder = (a: string | undefined, b: string | undefined): boolean => !!a && !!b && a === b

/**
 * Une passe de delta : suit les nextLink jusqu'au deltaLink (ou jusqu'à `maxPages`).
 *
 * ⚠ LE `$filter` DE 90 JOURS PLAFONNE L'IMPORT INITIAL À 5 000 MESSAGES PAR DOSSIER, et
 * c'est une limite du fournisseur, pas un défaut d'ici. La page « Get incremental changes
 * to messages in a folder » l'écrit juste après avoir autorisé
 * `$filter=receivedDateTime ge {value}` : « Applying `$filter` in a delta query returns
 * only up to 5,000 messages » (relu le 04.09.2026). Une Réception d'agence chargée dépasse
 * ce compte sur 90 jours ; la passe se termine alors sur un `deltaLink` normal,
 * `initialDone` passe à true, `last_error` reste nul — l'historique est tronqué SANS que
 * rien ne le dise, et Gmail, qui n'a pas d'équivalent, en importe davantage sur la même
 * fenêtre.
 *
 * NON CORRIGÉ, ET C'EST UN CHOIX (04.09.2026) : la seule parade est de retirer le
 * `$filter` et de borner la fenêtre en lisant la date de CHAQUE item — Graph ne garantit
 * l'ordre qu'avec `$orderby=receivedDateTime desc`, donc on ne peut pas s'arrêter au
 * premier message trop vieux. Cela remplace un plafond de 5 000 par le parcours de la
 * boîte ENTIÈRE (dix ans de courrier pour en garder trois mois), au budget de 20 s par
 * compte. Le plafond est le moindre mal tant que l'import initial n'a pas son propre
 * mécanisme de reprise ; ce qu'il faut, c'est que le lot 2 le DISE (« les 5 000 messages
 * les plus récents ») au lieu de laisser croire à un import complet.
 */
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
 * Plafond par pièce imposé par Graph : « This operation limits the size of the
 * attachment you can add to under 3 MB » (message: post attachments, v1.0). Au-delà il
 * faut `createUploadSession`, que ce build n'implémente pas — d'où un refus EXPLICITE
 * en amont, dans mail-send, plutôt qu'un 502 illisible au moment de l'envoi.
 */
export const GRAPH_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024

/**
 * Envoi : brouillon (POST /me/messages ou createReply/createForward) → PATCH du
 * contenu → POST des pièces → POST send. Le brouillon porte notre internetMessageId,
 * ce qui permet de rapprocher la copie « Envoyés » quand le delta la rend.
 *
 * ⛔ LES PIÈCES NE PASSENT PAS PAR LE PATCH. `attachments` est une propriété de
 * NAVIGATION : la référence « Update message » énumère ce qui est modifiable
 * (body, subject, toRecipients, internetMessageId… « Updatable only if isDraft =
 * true ») et `attachments` n'y figure pas. Les deux issues étaient mauvaises et
 * aucune n'était testée : ou Graph refusait le PATCH — 502 `send_failed`, et le
 * brouillon créé par createReply RESTAIT dans les Brouillons de l'agent —, ou il
 * ignorait la propriété et la réponse partait au client SANS sa pièce pendant que le
 * CRM enregistrait `has_attachments = true`. Chaque pièce est donc POSTée dans la
 * collection du brouillon, avant l'envoi.
 *
 * ⛔ Et le brouillon est NETTOYÉ si la suite échoue : sans cela, chaque tentative
 * ratée laissait un brouillon de plus dans la boîte de l'agent, sans rien pour dire
 * d'où il venait.
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
  }
  let draftId: string
  if (mode.kind === 'new') {
    const d = await gcall<{ id: string }>(token, '/me/messages', deps, { method: 'POST', body: JSON.stringify(payload) })
    draftId = d.id
  } else {
    const verb = mode.kind === 'reply' ? 'createReply' : 'createForward'
    const d = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(mode.providerMessageId)}/${verb}`, deps, { method: 'POST', body: '{}' })
    draftId = d.id
  }
  try {
    if (mode.kind !== 'new') {
      await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'PATCH', body: JSON.stringify(payload) })
    }
    for (const a of m.attachments) {
      await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/attachments`, deps, {
        method: 'POST',
        body: JSON.stringify({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.mimeType, contentBytes: a.base64 }),
      })
    }
    await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/send`, deps, { method: 'POST' })
  } catch (e) {
    // Le nettoyage ne doit JAMAIS masquer la cause : son propre échec se journalise,
    // l'erreur d'origine remonte telle quelle.
    try { await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'DELETE' }) }
    catch (e2) { console.error(`[mail graph] brouillon orphelin ${draftId} non supprimé:`, e2 instanceof Error ? e2.message : String(e2)) }
    throw e
  }
  return { draftId }
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
const addr = (r?: GraphRecipient) => (r?.emailAddress?.address ? { name: r.emailAddress.name || null, email: r.emailAddress.address.toLowerCase() } : null)
const addrs = (rs?: GraphRecipient[]) => (rs ?? []).map(addr).filter((a): a is { name: string | null; email: string } => !!a)

export function normalizeGraphMessage(
  m: GraphMessage, body: GraphBody, atts: GraphAttachment[], folderIds: Record<string, string>, boxEmail: string,
): NormalizedMessage {
  const from = addr(m.from) ?? { name: null, email: '' }
  const inSent = sameFolder(m.parentFolderId, folderIds.sentitems)
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
    inInbox: sameFolder(m.parentFolderId, folderIds.inbox),
    isTrashed: sameFolder(m.parentFolderId, folderIds.deleteditems),
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
 *
 * ⛔ ET UNE PROPRIÉTÉ ABSENTE N'EST PAS UNE PROPRIÉTÉ FAUSSE. La référence du delta est
 * explicite : « Updated instances are represented by their id with *at least* the
 * updated properties, but other properties might be included » — donc une charge utile
 * PARTIELLE est le cas NORMAL, pas l'exception. Le code construisait pourtant les
 * quatre drapeaux sans condition : `!!it.isRead` sur un `isRead` absent rendait `false`
 * (le CRM remettait en non-lu un message lu), un `flag` absent déétoilait, et surtout
 * un `parentFolderId` absent donnait `inInbox: false, isTrashed: false`, ce que
 * `applyRemoteChanges` écrit en `is_archived = true` : mettre un simple drapeau sur un
 * courrier dans Outlook faisait DISPARAÎTRE la conversation de la Réception du CRM.
 * On n'émet donc que ce que la charge utile PORTE — comme `historyToChanges` (gmail.ts)
 * qui laisse tomber les enregistrements de drapeaux vides.
 */
export function deltaToChanges(items: GraphMessage[], known: Set<string>, folderIds: Record<string, string>): { added: GraphMessage[]; changes: RemoteChange[]; removed: GraphRemoval[] } {
  const added: GraphMessage[] = []
  const changes: RemoteChange[] = []
  const removed: GraphRemoval[] = []
  for (const it of items) {
    if (it['@removed']) { removed.push({ id: it.id, reason: it['@removed'].reason ?? 'unknown' }); continue }
    if (!known.has(it.id)) { added.push(it); continue }
    const f: Extract<RemoteChange, { kind: 'flags' }> = { kind: 'flags', providerMessageId: it.id }
    if ('isRead' in it) f.isRead = !!it.isRead
    if (it.flag) f.isStarred = it.flag.flagStatus === 'flagged'
    // Les deux se lisent sur le MÊME champ : ou il est là, ou aucun des deux n'est su.
    if (it.parentFolderId !== undefined) {
      f.inInbox = sameFolder(it.parentFolderId, folderIds.inbox)
      f.isTrashed = sameFolder(it.parentFolderId, folderIds.deleteditems)
    }
    // `kind` + `providerMessageId` = un changement qui ne change RIEN : inutile de le
    // faire descendre jusqu'à une lecture en base (même seuil que historyToChanges).
    if (Object.keys(f).length > 2) changes.push(f)
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
    inInbox: sameFolder(parentFolderId, folderIds.inbox),
    isTrashed: sameFolder(parentFolderId, folderIds.deleteditems),
  }
}
