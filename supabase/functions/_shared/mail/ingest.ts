// supabase/functions/_shared/mail/ingest.ts
// Écrit ce que les adaptateurs ont lu : fils, messages, pièces (métadonnées),
// rattachement au contact (D11), événement d'audit (timeline). Service-role :
// TOUT est filtré par account.agency_id, jamais par une valeur venue du réseau.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MailAccountRow, MailAddress, NormalizedMessage, RemoteChange } from './types.ts'

export const HTML_CAP = 512 * 1024

export interface ThreadRow {
  id: string
  account_id: string
  subject: string | null
  snippet: string | null
  participants: MailAddress[]
  from_name: string | null
  from_email: string | null
  last_message_at: string
  last_inbound_at: string | null
  last_outbound_at: string | null
  message_count: number
  has_attachments: boolean
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
  is_trashed: boolean
  label_id: string | null
  contact_id: string | null
}
export type ThreadPatch = Omit<ThreadRow, 'id' | 'account_id' | 'label_id' | 'contact_id'>

export function externalParticipants(m: NormalizedMessage, boxEmail: string): MailAddress[] {
  const box = boxEmail.toLowerCase()
  const seen = new Set<string>()
  const out: MailAddress[] = []
  for (const a of [m.from, ...m.to, ...m.cc]) {
    const e = a.email.toLowerCase()
    if (!e || e === box || seen.has(e)) continue
    seen.add(e)
    out.push({ name: a.name, email: e })
  }
  return out
}

export function capHtml(html: string | null): { html: string | null; truncated: boolean } {
  if (!html) return { html: null, truncated: false }
  return html.length > HTML_CAP ? { html: html.slice(0, HTML_CAP), truncated: true } : { html, truncated: false }
}

/**
 * ⛔ ON COMPARE DES INSTANTS, PAS DES CHAÎNES — les deux côtés ne parlent pas la même
 * langue. `m.sentAt` sort d'un `new Date().toISOString()`
 * (`2026-09-03T08:00:00.000Z`) ; `existing.last_message_at` sort de PostgREST, qui
 * sérialise un `timestamptz` selon le fuseau de la SESSION
 * (`2026-09-03T08:00:00+00:00`). Les deux chaînes divergent à l'index 19 (`.` contre
 * `+`), si bien que `>=` n'était juste QUE par le préfixe date-heure : à la seconde
 * près, `'.' > '+'` faisait toujours gagner le message entrant. Sous une session non
 * UTC, PostgREST rendrait `+02:00` et l'ordre serait faux de deux heures — le fil
 * cesserait de suivre son dernier message. Les tests unitaires ne le voient pas : leurs
 * fixtures écrivent la forme `Z` des deux côtés ; seul un aller-retour réel l'expose.
 *
 * ⚠ `laterThan(iso, at)` répond « cet ISO est POSTÉRIEUR à cet instant ». Une date
 * illisible (`NaN`) vaut « le message entrant est le plus récent », comme un `existing`
 * absent : le défaut écrit une valeur fraîche au lieu d'en figer une vieille.
 */
const laterThan = (iso: string | null | undefined, at: number): boolean => !!iso && Date.parse(iso) > at

/** Dérive l'état du fil après ce message. `isNew` = le message n'était pas connu. */
export function deriveThreadPatch(existing: ThreadRow | null, m: NormalizedMessage, boxEmail: string, isNew: boolean): ThreadPatch {
  const parts = externalParticipants(m, boxEmail)
  const at = Date.parse(m.sentAt)
  const newer = !existing || !laterThan(existing.last_message_at, at)
  const mergedParticipants = (() => {
    const acc: MailAddress[] = [...(existing?.participants ?? [])]
    for (const p of parts) if (!acc.some((x) => x.email === p.email)) acc.push(p)
    return acc.slice(0, 8)
  })()
  const inboundSender = m.direction === 'inbound' ? m.from : null
  const from = inboundSender && (newer || !existing?.from_email) ? inboundSender : (existing ? { name: existing.from_name, email: existing.from_email ?? '' } : (parts[0] ?? { name: null, email: '' }))
  /**
   * ⛔ « ARCHIVÉ » SE LIT SUR LE MESSAGE ENTRANT LE PLUS RÉCENT, jamais sur le dernier
   * message tout court. La condition était `m.direction === 'inbound' && newer` : dès
   * que le dernier mot du fil était celui de l'AGENT, plus aucun message ne pouvait
   * jamais décider, et `is_archived` restait à sa valeur de semis. Or la passe
   * initiale de Gmail liste du plus récent au plus ancien : le premier message ingéré
   * d'un tel fil est sortant, `existing` est null, `is_archived` naît donc `false` —
   * et les messages suivants, plus vieux, ne peuvent plus le corriger même s'ils
   * n'ont AUCUN libellé INBOX. Comme « l'agent a eu le dernier mot » décrit la
   * plupart des conversations réglées, le tout premier écran après la connexion d'une
   * boîte était une Réception pleine de fils clos vieux de plusieurs mois, et Archivé
   * quasi vide. Invisible en incrémental — `applyRemoteChanges` traite bien un archivage
   * ultérieur — donc introuvable autrement qu'à l'accueil d'un nouvel agent.
   */
  const newestInbound = m.direction === 'inbound' && !laterThan(existing?.last_inbound_at, at)
  return {
    subject: existing?.subject ?? m.subject,
    snippet: newer ? m.snippet : (existing?.snippet ?? m.snippet),
    participants: mergedParticipants,
    from_name: from.name,
    from_email: from.email || null,
    last_message_at: newer ? m.sentAt : existing!.last_message_at,
    last_inbound_at: m.direction === 'inbound'
      ? (laterThan(existing?.last_inbound_at, at) ? existing!.last_inbound_at : m.sentAt)
      : (existing?.last_inbound_at ?? null),
    last_outbound_at: m.direction === 'outbound'
      ? (laterThan(existing?.last_outbound_at, at) ? existing!.last_outbound_at : m.sentAt)
      : (existing?.last_outbound_at ?? null),
    message_count: (existing?.message_count ?? 0) + (isNew ? 1 : 0),
    has_attachments: (existing?.has_attachments ?? false) || m.attachments.some((a) => !a.isInline),
    is_read: (existing?.is_read ?? true) && m.isRead,
    is_starred: (existing?.is_starred ?? false) || m.isStarred,
    is_archived: newestInbound ? (!m.inInbox && !m.isTrashed) : (existing?.is_archived ?? false),
    is_trashed: newer ? m.isTrashed : (existing?.is_trashed ?? false),
  }
}

export function pickContact(rows: { contact_id: string }[]): string | null {
  const ids = Array.from(new Set(rows.map((r) => r.contact_id)))
  return ids.length === 1 ? ids[0] : null
}

/**
 * Cherche LE contact d'une adresse, dans la fiche puis dans les alias appris.
 *
 * ⚠ La recherche dans `contacts` passe par la RPC `mail_match_contact_by_emails` et
 * non par un `.in('email', …)`. Deux raisons mesurées le 03.09.2026, la première
 * muette : (1) `.in('email', …)` compare EN RESPECTANT LA CASSE et rien ne normalise
 * `contacts.email` à l'écriture — un contact « Jean.Dupont@ex.ch » ne serait jamais
 * rattaché à un « jean.dupont@ex.ch » entrant, sans erreur, le fil restant « Adresse
 * non rattachée » ; (2) l'index est `btree (agency_id, lower(email))`, une EXPRESSION,
 * qu'un prédicat sur la colonne nue ne peut pas utiliser — et ce chemin tourne à
 * chaque message de chaque synchro.
 *
 * `mail_contact_aliases`, lui, garde son filtre direct : sa colonne porte un CHECK
 * `email = lower(email)` et son index unique est sur la colonne nue.
 */
async function matchContact(admin: SupabaseClient, agencyId: string, emails: string[]): Promise<string | null> {
  if (emails.length === 0) return null
  const lowered = emails.map((e) => e.toLowerCase())
  // ⛔ « JE N'AI PAS PU CHERCHER » N'EST PAS « IL N'Y A PERSONNE ». Les deux lectures
  // laissaient tomber leur `error` : sur un échec, `contact_id` était écrit null sur le
  // fil ET sur le message, et comme `audit()` est gardé par `&& contactId`, le courrier
  // n'entrait pas non plus dans la timeline du contact — une trace d'audit
  // append-only à laquelle il manque une entrée ne se rattrape pas, même si la passe
  // suivante rattache enfin le fil. L'agent, lui, lisait « Adresse non rattachée » sur
  // un contact parfaitement appariable, sans un mot nulle part. Ironie du fichier :
  // trente lignes plus haut, on corrige une AUTRE cause du même symptôme muet.
  const { data: direct, error: eDirect } = await admin.rpc('mail_match_contact_by_emails', { p_agency_id: agencyId, p_emails: lowered })
  if (eDirect) throw new Error(`contact match: ${eDirect.message}`)
  const byContact = pickContact(((direct ?? []) as string[]).map((id) => ({ contact_id: id })))
  if (byContact) return byContact
  const { data: alias, error: eAlias } = await admin.from('mail_contact_aliases').select('contact_id').eq('agency_id', agencyId).in('email', lowered)
  if (eAlias) throw new Error(`contact alias match: ${eAlias.message}`)
  return pickContact((alias ?? []) as { contact_id: string }[])
}

/**
 * Écrit l'entrée de timeline. Rend `false` si `activity_events` a refusé la ligne.
 *
 * ⚠ ON CONTINUE SUR ÉCHEC — perdre le courrier pour sauver la ligne d'audit serait pire —
 * MAIS ON LE COMPTE. `console.error` seul rendait l'échec INDÉCOUVRABLE : il atterrit dans
 * les journaux d'edge, que rien n'alerte, et le `SyncOutcome` du balayage ne portait aucun
 * compteur. Dans un produit LAB/KYC où CLAUDE.md fait de `activity_events` la trace de
 * CHAQUE action, un courrier reçu sans son entrée de timeline se découvre à l'audit, des
 * mois plus tard. Le compte remonte désormais jusqu'au `results` de `mail-sync`.
 */
async function audit(admin: SupabaseClient, account: MailAccountRow, action: 'email_received' | 'email_sent', threadId: string, messageId: string, contactId: string, m: NormalizedMessage): Promise<boolean> {
  const { error } = await admin.from('activity_events').insert({
    agency_id: account.agency_id,
    actor_id: null,
    actor_kind: 'system',
    action,
    category: 'messaging',
    severity: 'info',
    entity_type: 'contact',
    entity_id: contactId,
    object_label: m.subject || '(sans objet)',
    metadata: { thread_id: threadId, message_id: messageId, account_id: account.id, from: m.from.email, to: m.to.map((a) => a.email) },
  })
  if (error) console.error(`[mail ingest] activity_events refuse ${action} (fil ${threadId}, message ${messageId}):`, error.message)
  return !error
}

export interface IngestOptions {
  /** true = ne journalise pas (mail-send écrit lui-même l'événement avec l'acteur). */
  skipAudit?: boolean
}

interface KnownMessageRow { id: string; thread_id: string; provider_message_id: string }

/**
 * Le message est-il déjà en base ? Deux lectures `.eq()` SÉPARÉES, jamais un `.or()`.
 *
 * ⛔ `.or('provider_message_id.eq.X,and(provider_message_id.eq.pending:Y)')` recopiait
 * `Y` — l'en-tête `Message-ID` de l'EXPÉDITEUR, du texte d'attaquant qui traverse même
 * `decodeRfc2047` — tel quel dans le paramètre `or=(…)` : postgrest-js n'échappe rien
 * dans `or()` (contrairement à `in()`, qui cite les caractères réservés). Une virgule
 * suffisait à ajouter un terme au OU : `Message-ID: <a),provider_message_id.not.is.null`
 * rendait un message QUELCONQUE de la boîte, que la suite écrasait avec le contenu de
 * l'attaquant (`update … .eq('id', known.id)`) et dont elle supprimait les pièces —
 * un e-mail reçu, une conversation cliente détruite. Une virgule NUE, elle, rendait le
 * filtre invalide : PostgREST 400, erreur jetée faute d'être destructurée, insertion,
 * puis 23505 à chaque tick — la boîte ne se synchronisait plus jamais.
 *
 * Une valeur dans un paramètre `col=eq.valeur` est percent-encodée par URLSearchParams :
 * elle ne peut ni ouvrir un terme ni en fermer un. Et l'erreur est LEVÉE, pour qu'un
 * défaut futur casse bruyamment au lieu de se déguiser en « message inconnu ».
 */
async function findKnownMessage(admin: SupabaseClient, accountId: string, m: NormalizedMessage): Promise<KnownMessageRow | null> {
  const base = () => admin.from('mail_messages').select('id, thread_id, provider_message_id').eq('account_id', accountId)
  const { data: byProvider, error: e1 } = await base().eq('provider_message_id', m.providerMessageId).maybeSingle()
  if (e1) throw new Error(`message lookup: ${e1.message}`)
  if (byProvider) return byProvider as KnownMessageRow
  if (!m.rfc822MessageId) return null
  const { data: byPending, error: e2 } = await base().eq('provider_message_id', `pending:${m.rfc822MessageId}`).maybeSingle()
  if (e2) throw new Error(`message lookup (pending): ${e2.message}`)
  return (byPending as KnownMessageRow | null) ?? null
}

/** Ingère des messages normalisés (idempotent sur (account_id, provider_message_id)). */
export async function ingestMessages(admin: SupabaseClient, account: MailAccountRow, msgs: NormalizedMessage[], opts: IngestOptions = {}): Promise<{ inserted: number; updated: number; auditFailures: number }> {
  let inserted = 0
  let updated = 0
  let auditFailures = 0
  for (const m of msgs) {
    if (m.isDraft) continue

    // Message déjà connu ? (ou copie « Envoyés » d'un envoi CRM en attente : pending:<Message-ID>)
    const known = await findKnownMessage(admin, account.id, m)
    const isNew = !known

    if (known && known.provider_message_id.startsWith('pending:')) {
      // Copie « Envoyés » d'un envoi CRM (Graph) : le fil provisoire prend l'id de
      // conversation réel s'il n'existe pas encore sous ce nom.
      const { data: real, error: eReal } = await admin.from('mail_threads').select('id').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
      if (eReal) throw new Error(`thread lookup (pending): ${eReal.message}`)
      if (!real) {
        const { error } = await admin.from('mail_threads').update({ provider_thread_id: m.providerThreadId }).eq('id', known.thread_id)
        if (error) throw new Error(`thread rename: ${error.message}`)
      }
    }

    // Fil — une lecture en échec vaudrait « fil inconnu », donc une INSERTION d'un
    // fil jumeau (ou un 23505) : on lève au lieu de deviner.
    const { data: existing, error: eThread } = await admin.from('mail_threads').select('*').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
    if (eThread) throw new Error(`thread lookup: ${eThread.message}`)
    const patch = deriveThreadPatch((existing as ThreadRow | null) ?? null, m, account.email, isNew)
    let threadId: string
    let contactId: string | null = existing?.contact_id ?? null
    if (contactId === null) contactId = await matchContact(admin, account.agency_id, externalParticipants(m, account.email).map((a) => a.email))
    if (existing) {
      threadId = existing.id
      const { error } = await admin.from('mail_threads').update({ ...patch, contact_id: contactId }).eq('id', threadId)
      if (error) throw new Error(`thread update: ${error.message}`)
    } else {
      const { data: t, error } = await admin.from('mail_threads').insert({
        account_id: account.id, agency_id: account.agency_id, provider_thread_id: m.providerThreadId, ...patch, contact_id: contactId,
      }).select('id').single()
      if (error) throw new Error(`thread insert: ${error.message}`)
      threadId = t.id
    }

    // Message
    const { html, truncated } = capHtml(m.bodyHtml)
    const row = {
      thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
      provider_message_id: m.providerMessageId, rfc822_message_id: m.rfc822MessageId, in_reply_to: m.inReplyTo,
      direction: m.direction, from_name: m.from.name, from_email: m.from.email,
      to: m.to, cc: m.cc, bcc: m.bcc, reply_to: m.replyTo, subject: m.subject, snippet: m.snippet,
      body_text: m.bodyText, body_html: html, body_truncated: truncated, sent_at: m.sentAt,
      is_read: m.isRead, has_attachments: m.attachments.some((a) => !a.isInline), provider_labels: m.providerLabels,
      contact_id: contactId,
    }
    let messageId: string
    if (known) {
      const { error } = await admin.from('mail_messages').update(row).eq('id', known.id)
      if (error) throw new Error(`message update: ${error.message}`)
      messageId = known.id
      updated++
    } else {
      const { data: ins, error } = await admin.from('mail_messages').insert(row).select('id').single()
      if (error) throw new Error(`message insert: ${error.message}`)
      messageId = ins.id
      inserted++
    }

    // Pièces (remplacement intégral : la liste du fournisseur fait foi)
    const { error: eDelAtt } = await admin.from('mail_attachments').delete().eq('message_id', messageId)
    if (eDelAtt) throw new Error(`attachments delete: ${eDelAtt.message}`)
    if (m.attachments.length) {
      const { error } = await admin.from('mail_attachments').insert(m.attachments.map((a) => ({
        message_id: messageId, account_id: account.id, agency_id: account.agency_id,
        provider_attachment_id: a.providerAttachmentId, filename: a.filename, mime_type: a.mimeType,
        size_bytes: a.sizeBytes, is_inline: a.isInline, content_id: a.contentId,
      })))
      if (error) throw new Error(`attachments insert: ${error.message}`)
    }

    if (isNew && contactId && !opts.skipAudit) {
      if (!await audit(admin, account, m.direction === 'inbound' ? 'email_received' : 'email_sent', threadId, messageId, contactId, m)) auditFailures++
    }
  }
  return { inserted, updated, auditFailures }
}

/**
 * Recalcule les agrégats d'un fil depuis ses messages ; supprime le fil s'il est vide.
 *
 * ⛔ La suppression est conditionnée à un COMPTE de zéro POSITIVEMENT constaté, jamais
 * à `!msgs`. La lecture ne destructurait pas son `error` : un timeout, un cache de
 * schéma PostgREST périmé (donc les minutes qui suivent le déploiement de la migration)
 * ou une connexion coupée rendaient `data = null`, ce que le code lisait « ce fil n'a
 * plus de message » — il supprimait alors le fil, et les deux `on delete cascade`
 * emportaient objet, corps et pièces. Une simple « marquer comme lu » pouvait ainsi
 * faire disparaître une conversation, et l'edge répondait `{ ok: true }`. Lever est le
 * bon geste ici : le catch de `syncAccount` le transforme en `last_error` + backoff.
 */
export async function recomputeThread(admin: SupabaseClient, threadId: string): Promise<void> {
  const { data: msgs, error } = await admin.from('mail_messages')
    .select('sent_at, direction, is_read, has_attachments, snippet')
    .eq('thread_id', threadId).order('sent_at', { ascending: true })
  if (error) throw new Error(`recompute select: ${error.message}`)
  if (!msgs) throw new Error('recompute select: aucune ligne rendue et aucune erreur')
  if (msgs.length === 0) {
    const { error: eDel } = await admin.from('mail_threads').delete().eq('id', threadId)
    if (eDel) throw new Error(`recompute delete: ${eDel.message}`)
    return
  }
  const last = msgs[msgs.length - 1]
  const inbound = msgs.filter((x) => x.direction === 'inbound')
  const outbound = msgs.filter((x) => x.direction === 'outbound')
  const { error: eUpd } = await admin.from('mail_threads').update({
    message_count: msgs.length,
    last_message_at: last.sent_at,
    snippet: last.snippet,
    last_inbound_at: inbound.length ? inbound[inbound.length - 1].sent_at : null,
    last_outbound_at: outbound.length ? outbound[outbound.length - 1].sent_at : null,
    has_attachments: msgs.some((x) => x.has_attachments),
    is_read: msgs.every((x) => x.is_read),
  }).eq('id', threadId)
  if (eUpd) throw new Error(`recompute update: ${eUpd.message}`)
}

/** Applique les gestes faits chez le fournisseur (lu, étoile, archive, corbeille, suppression). */
export async function applyRemoteChanges(admin: SupabaseClient, account: MailAccountRow, changes: RemoteChange[]): Promise<number> {
  let applied = 0
  for (const c of changes) {
    // Une lecture en échec vaudrait « ce message n'existe pas ici » et le changement
    // serait perdu sans trace : on lève, le backoff de syncAccount rejouera la passe.
    const { data: msg, error: eMsg } = await admin.from('mail_messages').select('id, thread_id, direction')
      .eq('account_id', account.id).eq('provider_message_id', c.providerMessageId).maybeSingle()
    if (eMsg) throw new Error(`remote change lookup: ${eMsg.message}`)
    if (!msg) continue
    if (c.kind === 'message_deleted') {
      const { error } = await admin.from('mail_messages').delete().eq('id', msg.id)
      if (error) throw new Error(`remote delete: ${error.message}`)
      await recomputeThread(admin, msg.thread_id)
      applied++
      continue
    }
    if (c.isRead !== undefined) {
      const { error } = await admin.from('mail_messages').update({ is_read: c.isRead }).eq('id', msg.id)
      if (error) throw new Error(`remote read flag: ${error.message}`)
    }
    const patch: Record<string, unknown> = {}
    if (c.isStarred !== undefined) patch.is_starred = c.isStarred
    if (c.isTrashed !== undefined) patch.is_trashed = c.isTrashed
    if (c.inInbox !== undefined && msg.direction === 'inbound') patch.is_archived = !c.inInbox && !(c.isTrashed ?? false)
    if (Object.keys(patch).length) {
      const { error } = await admin.from('mail_threads').update(patch).eq('id', msg.thread_id)
      if (error) throw new Error(`remote flags: ${error.message}`)
    }
    if (c.isRead !== undefined) await recomputeThread(admin, msg.thread_id)
    applied++
  }
  return applied
}

/**
 * Apprend un alias et rattache le fil (modale « Rapprocher l'adresse »).
 *
 * ⛔ LES TROIS ÉCRITURES SONT VÉRIFIÉES. Aucune ne levait, et le `try` de mail-actions
 * ne rattrape que ce qui lève : l'edge répondait `{ ok: true, contact_id }` alors que
 * l'alias pouvait n'avoir pas été appris (violation d'unicité) ou le fil pas rattaché
 * (zéro ligne appariée). Le premier cas est le pire : l'agent voit « rattaché », et le
 * PROCHAIN courrier de la même adresse repart non apparié — c'est-à-dire exactement le
 * service que tout le mécanisme d'alias existe pour rendre. Levée : mail-actions la
 * convertit déjà en 400 portant le message.
 */
export async function linkThreadToContact(admin: SupabaseClient, account: MailAccountRow, threadId: string, contactId: string, email: string, learnedBy: string): Promise<void> {
  const { data: contact, error: eContact } = await admin.from('contacts').select('id').eq('id', contactId).eq('agency_id', account.agency_id).maybeSingle()
  // Une lecture en échec ne prouve PAS que le contact est hors agence : le dire
  // fermerait la porte sur une panne passagère avec un message de sécurité trompeur.
  if (eContact) throw new Error(`contact lookup: ${eContact.message}`)
  if (!contact) throw new Error('contact_not_in_agency')
  const { error: eAlias } = await admin.from('mail_contact_aliases').upsert(
    { agency_id: account.agency_id, email: email.toLowerCase(), contact_id: contactId, learned_by: learnedBy },
    { onConflict: 'agency_id,email', ignoreDuplicates: false },
  )
  if (eAlias) throw new Error(`alias upsert: ${eAlias.message}`)
  const { data: linked, error: eThread } = await admin.from('mail_threads').update({ contact_id: contactId }).eq('id', threadId).eq('account_id', account.id).select('id')
  if (eThread) throw new Error(`thread link: ${eThread.message}`)
  // Zéro ligne appariée = le fil n'appartient pas à ce compte, ou n'existe plus. Sans
  // ce contrôle, l'appelant lisait « rattaché » sur un fil que personne n'a touché.
  if (!linked || linked.length === 0) throw new Error('thread_not_in_account')
  const { error: eMsgs } = await admin.from('mail_messages').update({ contact_id: contactId }).eq('thread_id', threadId).is('contact_id', null)
  if (eMsgs) throw new Error(`messages backfill: ${eMsgs.message}`)
}
