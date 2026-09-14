/**
 * Un message RFC 822 brut (ce que rend IMAP) → `NormalizedMessage`, la forme que
 * l'ingestion consomme déjà pour Gmail et Graph.
 *
 * L'analyse est confiée à `postal-mime` : pur JavaScript, sans module natif, donc la même
 * sous Deno (edge) et sous Node (tests). Écrire un analyseur MIME à la main, c'est
 * réécrire les jeux de caractères, le quoted-printable et les en-têtes RFC 2047 — là où
 * vivent les courriers mal formés qu'un vrai client doit quand même lire.
 *
 * ⚠ `providerThreadId` n'est PAS décidé ici : il dépend de ce que la base connaît déjà
 * (`imap.ts`, par `References` / `In-Reply-To`). Il vaut provisoirement le Message-ID.
 */
import PostalMime from 'npm:postal-mime@3.0.0'
import type { MailAddress, NormalizedAttachment, NormalizedMessage } from './types.ts'
import { htmlToText, snippetOf } from './mime.ts'

export interface ParseCtx {
  providerMessageId: string
  boxEmail: string
  /** Le dossier dit la direction (un message de « Envoyés » est sortant) et le spam (`junk`). */
  dossier: 'inbox' | 'sent' | 'junk'
  flags: string[]
  /** INTERNALDATE — la date d'ARRIVÉE, celle que Gmail donne aussi ; l'en-tête `Date` est un repli. */
  internalDate: string | null
}

interface PmMailbox { name?: string; address?: string; group?: PmMailbox[] }
interface PmAttachment {
  filename: string | null; mimeType: string; disposition: 'attachment' | 'inline' | null
  contentId?: string; content: ArrayBuffer | Uint8Array | string; encoding?: 'base64' | 'utf8'
}
interface PmEmail {
  from?: PmMailbox; to?: PmMailbox[]; cc?: PmMailbox[]; bcc?: PmMailbox[]; replyTo?: PmMailbox[]
  subject?: string; messageId?: string; inReplyTo?: string; references?: string; date?: string
  text?: string; html?: string; attachments: PmAttachment[]
}

/** Les garde-fous de l'analyseur : un courrier piégé ne doit pas épuiser la mémoire de l'edge. */
const LIMITES = { maxNestingDepth: 50, maxHeadersSize: 2 * 1024 * 1024 }

const adresse = (a?: PmMailbox): MailAddress | null =>
  a?.address ? { name: a.name?.trim() || null, email: a.address.trim().toLowerCase() } : null

/** Une liste d'adresses, groupes dépliés (« Équipe: a@b.ch, c@d.ch; ») et groupes vides écartés. */
function adresses(liste?: PmMailbox[]): MailAddress[] {
  return (liste ?? []).flatMap((a) => (a.group ? a.group : [a])).map(adresse).filter((x): x is MailAddress => !!x)
}

/** Taille décodée d'un contenu base64 (sans le décoder : c'est tout l'objet du mode base64). */
function tailleBase64(b64: string): number {
  const net = b64.replace(/[^A-Za-z0-9+/=]/g, '')
  const remplissage = net.endsWith('==') ? 2 : net.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((net.length * 3) / 4) - remplissage)
}

const MOIS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
/** `05-Sep-2026 10:00:00 +0200` (INTERNALDATE, RFC 3501) → ISO 8601 ; `null` si illisible. */
export function internalDateIso(s: string | null): string | null {
  const m = (s ?? '').trim().match(/^\s?(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/)
  if (!m) return null
  const mois = MOIS[m[2].toLowerCase()]
  if (mois === undefined) return null
  const decalage = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9]))
  const t = Date.UTC(Number(m[3]), mois, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6])) - decalage * 60_000
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/**
 * Analyse un message brut. Les pièces restent en base64 (`attachmentEncoding`) : la
 * synchro n'a besoin que de leur nom, de leur type et de leur taille, et décoder chaque
 * PDF à chaque passe coûterait le temps CPU que l'edge mesure (2 s par requête).
 */
export async function parseRfc822(raw: Uint8Array, ctx: ParseCtx): Promise<NormalizedMessage> {
  const e = (await PostalMime.parse(raw, { attachmentEncoding: 'base64', ...LIMITES })) as unknown as PmEmail
  const from = adresse(e.from) ?? { name: null, email: '' }
  const sortant = ctx.dossier === 'sent' || from.email === ctx.boxEmail.toLowerCase()
  const attachments: NormalizedAttachment[] = e.attachments.map((a, i) => ({
    providerAttachmentId: String(i),
    filename: a.filename || `piece-${i + 1}`,
    mimeType: a.mimeType || 'application/octet-stream',
    sizeBytes: typeof a.content === 'string'
      ? (a.encoding === 'base64' ? tailleBase64(a.content) : new TextEncoder().encode(a.content).byteLength)
      : a.content.byteLength,
    isInline: a.disposition === 'inline' || (!!a.contentId && a.disposition !== 'attachment'),
    contentId: a.contentId ?? null,
  }))
  const bodyText = e.text ?? (e.html ? htmlToText(e.html) : null)
  const rfc822MessageId = e.messageId?.trim() || null
  return {
    providerMessageId: ctx.providerMessageId,
    providerThreadId: rfc822MessageId ?? ctx.providerMessageId,
    rfc822MessageId,
    inReplyTo: e.inReplyTo?.trim().split(/\s+/)[0] || null,
    references: (e.references ?? '').split(/\s+/).filter(Boolean),
    direction: sortant ? 'outbound' : 'inbound',
    from,
    to: adresses(e.to), cc: adresses(e.cc), bcc: adresses(e.bcc),
    replyTo: adresses(e.replyTo)[0]?.email ?? null,
    subject: e.subject ?? '',
    snippet: snippetOf(bodyText ?? ''),
    bodyText,
    bodyHtml: e.html ?? null,
    sentAt: internalDateIso(ctx.internalDate) ?? (e.date && !Number.isNaN(Date.parse(e.date)) ? new Date(e.date).toISOString() : new Date().toISOString()),
    isRead: ctx.flags.includes('\\Seen'),
    isStarred: ctx.flags.includes('\\Flagged'),
    inInbox: ctx.dossier === 'inbox',
    isTrashed: false,
    isSpam: ctx.dossier === 'junk',
    isDraft: ctx.flags.includes('\\Draft'),
    providerLabels: [],
    attachments,
  }
}

/**
 * Un message trop lourd pour être téléchargé : ses seuls EN-TÊTES, et un corps qui dit
 * pourquoi il manque. Le fil, l'expéditeur et la date restent justes ; l'agent ouvre le
 * message dans son webmail.
 */
export async function parseEntetesSeuls(entetes: Uint8Array, ctx: ParseCtx, corps: string): Promise<NormalizedMessage> {
  const m = await parseRfc822(entetes, ctx)
  return { ...m, bodyText: corps, bodyHtml: null, snippet: snippetOf(corps), attachments: [] }
}

/** Les octets d'une pièce (par son rang, `providerAttachmentId`) dans un message brut. */
export async function attachmentFromRaw(raw: Uint8Array, index: number): Promise<{ bytes: Uint8Array; mimeType: string; filename: string } | null> {
  const e = (await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer', ...LIMITES })) as unknown as PmEmail
  const a = e.attachments[index]
  if (!a) return null
  const bytes = typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content)
  return { bytes, mimeType: a.mimeType || 'application/octet-stream', filename: a.filename || `piece-${index + 1}` }
}
