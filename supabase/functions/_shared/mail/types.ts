// supabase/functions/_shared/mail/types.ts
// Types de la Messagerie partagés par les adaptateurs, l'ingestion et les edges.
// PUR : aucun import runtime, importable sous Node (tests) et Deno (edges).

export type MailProviderId = 'gmail' | 'outlook' | 'imap'
export type MailVisibility = 'owner' | 'agency'
export type MailAccountStatus = 'active' | 'reauth_required' | 'error' | 'disabled'
export type MailDirection = 'inbound' | 'outbound'

export interface MailAddress {
  name: string | null
  email: string
}

/** Ligne de `mail_accounts` telle que lue en service-role. */
export interface MailAccountRow {
  id: string
  agency_id: string
  owner_id: string
  provider: MailProviderId
  email: string
  display_name: string | null
  visibility: MailVisibility
  status: MailAccountStatus
  vault_secret_id: string | null
  sync_cursor: SyncCursor | Record<string, never>
  next_sync_at: string
  last_sync_at: string | null
  last_error: string | null
  /**
   * Échecs consécutifs de synchronisation (remis à 0 dès qu'une passe aboutit).
   * Existe pour que `status` puisse dire « cette boîte est morte » : sans ce compteur,
   * seul `reauth_required` sortait du balayage, et un 403 de quota, un pointeur Vault
   * orphelin ou une erreur d'ingestion laissaient le compte `active` à réessayer toutes
   * les 10 minutes — indiscernable d'une boîte saine sans courrier neuf.
   * Optionnel : une lecture qui ne projette pas la colonne rend `undefined`.
   */
  sync_failures?: number
  imap_config: ImapConfig | null
}

/** Configuration IMAP/SMTP NON secrète (le mot de passe est dans Vault). */
export interface ImapConfig {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  user: string
  encryption: 'ssl' | 'starttls'
}

export interface NormalizedAttachment {
  providerAttachmentId: string
  filename: string
  mimeType: string
  sizeBytes: number
  isInline: boolean
  contentId: string | null
}

/** Un message tel que l'ingestion le consomme, quel que soit le fournisseur. */
export interface NormalizedMessage {
  providerMessageId: string
  providerThreadId: string
  rfc822MessageId: string | null
  inReplyTo: string | null
  references: string[]
  direction: MailDirection
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  replyTo: string | null
  subject: string
  snippet: string
  bodyText: string | null
  bodyHtml: string | null
  /** ISO 8601. */
  sentAt: string
  isRead: boolean
  isStarred: boolean
  inInbox: boolean
  isTrashed: boolean
  isDraft: boolean
  providerLabels: string[]
  attachments: NormalizedAttachment[]
}

/** Changement d'état venu du fournisseur (geste fait dans Gmail/Outlook). */
export type RemoteChange =
  | { kind: 'message_deleted'; providerMessageId: string }
  | {
      kind: 'flags'
      providerMessageId: string
      isRead?: boolean
      isStarred?: boolean
      inInbox?: boolean
      isTrashed?: boolean
    }

export interface GmailCursor {
  kind: 'gmail'
  /** historyId de départ de la prochaine synchro incrémentale. */
  historyId: string | null
  /** pageToken de la première passe (90 jours) tant qu'elle n'est pas finie. */
  initialPageToken: string | null
  initialDone: boolean
  /**
   * pageToken de la pagination `history.list` EN COURS, null quand elle est drainée.
   * ⚠ Sans lui, une pagination interrompue par le budget de temps n'était pas
   * reprenable : le tick suivant repartait sans pageToken et les pages restantes
   * n'étaient jamais lues (courrier perdu, en silence). Absent des curseurs écrits
   * avant le 04.09.2026 — toujours lu en `?? null`.
   */
  historyPageToken?: string | null
}

export interface GraphCursor {
  kind: 'outlook'
  inboxDelta: string | null
  sentDelta: string | null
  initialDone: boolean
  /** Ids opaques des dossiers connus (inbox, sentitems, archive, deleteditems), résolus une fois. */
  folderIds: Record<string, string> | null
}

export interface ImapCursor {
  kind: 'imap'
  folders: Record<string, { uidValidity: number; lastUid: number }>
  initialDone: boolean
}

export type SyncCursor = GmailCursor | GraphCursor | ImapCursor

/** Ce qu'une passe de synchro rend à l'orchestrateur. */
export interface SyncPass {
  messages: NormalizedMessage[]
  changes: RemoteChange[]
  cursor: SyncCursor
  /** false = il reste des pages ; l'orchestrateur rappelle au tick suivant. */
  done: boolean
}

export interface OAuthSecret {
  refresh_token: string
  access_token: string
  /** ISO 8601. */
  expires_at: string
}

export interface ImapSecret {
  password: string
}

export type AccountSecret = OAuthSecret | ImapSecret

/** Entrée de construction d'un message sortant. */
export interface OutgoingMessage {
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  subject: string
  text: string
  html: string
  inReplyTo: string | null
  references: string[]
  messageId: string
  attachments: { filename: string; mimeType: string; base64: string }[]
}
