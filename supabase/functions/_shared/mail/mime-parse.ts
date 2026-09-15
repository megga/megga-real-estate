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
import { htmlToText, nettoyerMessageId, nettoyerReferences, sensDuMessage, snippetOf } from './mime.ts'

export interface ParseCtx {
  providerMessageId: string
  boxEmail: string
  /** Le dossier dit « Envoyés » (`inSent`, et le sens) et le spam (`junk`) — cf. `sensDuMessage`. */
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

/** Les extensions d'un nom de pièce absent, pour les types courants. */
const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'text/plain': 'txt',
  'text/html': 'html', 'text/calendar': 'ics', 'message/rfc822': 'eml', 'application/zip': 'zip',
}

/**
 * Le nom d'une pièce qui n'en porte pas : `ATT00001.pdf`, la convention d'Outlook.
 *
 * ⚠ Neutre, parce qu'il est ÉCRIT en base et relu partout — dans le lecteur, dans le nom d'un
 * document classé au dossier : `piece-1` restait en français sous un agent germanophone (revue
 * du 15.09.2026).
 */
export function nomDePiece(rang: number, mimeType: string | null | undefined): string {
  const ext = EXTENSIONS[(mimeType ?? '').toLowerCase()] ?? 'bin'
  return `ATT${String(rang + 1).padStart(5, '0')}.${ext}`
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
 * Analyse un message brut. La synchro ne garde des pièces que leur nom, leur type et leur
 * taille — lue sur les OCTETS (`arraybuffer`). ⛔ Le mode `base64` n'évitait aucun décodage :
 * postal-mime décode toujours la pièce, puis la RÉ-ENCODAIT, et la taille se recalculait sur la
 * chaîne — trois fois le travail, et le triple de mémoire (mesuré le 15.09.2026 : 155 ms contre
 * 50 ms pour un message de 8 Mo, sous le plafond de 2 s par requête de l'edge).
 */
export async function parseRfc822(raw: Uint8Array, ctx: ParseCtx): Promise<NormalizedMessage> {
  const e = (await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer', ...LIMITES })) as unknown as PmEmail
  const from = adresse(e.from) ?? { name: null, email: '' }
  const replyTo = adresses(e.replyTo)[0]?.email ?? null
  const attachments: NormalizedAttachment[] = e.attachments.map((a, i) => ({
    providerAttachmentId: String(i),
    filename: a.filename || nomDePiece(i, a.mimeType),
    mimeType: a.mimeType || 'application/octet-stream',
    sizeBytes: typeof a.content === 'string' ? new TextEncoder().encode(a.content).byteLength : a.content.byteLength,
    isInline: a.disposition === 'inline' || (!!a.contentId && a.disposition !== 'attachment'),
    contentId: a.contentId ?? null,
  }))
  const bodyText = e.text ?? (e.html ? htmlToText(e.html) : null)
  // ⛔ postal-mime DÉCODE les mots RFC 2047 de ces en-têtes : un CR/LF peut y naître
  // (`nettoyerMessageId` dit pourquoi ça compte — une commande IMAP, un en-tête de réponse).
  const rfc822MessageId = nettoyerMessageId(e.messageId)
  return {
    providerMessageId: ctx.providerMessageId,
    providerThreadId: rfc822MessageId ?? ctx.providerMessageId,
    rfc822MessageId,
    inReplyTo: nettoyerMessageId(e.inReplyTo),
    references: nettoyerReferences(e.references),
    direction: sensDuMessage({ dansEnvoyes: ctx.dossier === 'sent', spam: ctx.dossier === 'junk', from: from.email, replyTo, boite: ctx.boxEmail }),
    inSent: ctx.dossier === 'sent',
    from,
    to: adresses(e.to), cc: adresses(e.cc), bcc: adresses(e.bcc),
    replyTo,
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
 * Un message trop lourd pour être téléchargé, ou dont le corps ne s'analyse pas : ses seuls
 * EN-TÊTES, et `corpsNonLu`. Le fil, l'expéditeur et la date restent justes ; l'écran dit, dans
 * la langue de l'agent, d'ouvrir le message dans son webmail.
 *
 * ⛔ Le corps était une PHRASE FRANÇAISE écrite en base (revue du 15.09.2026) — « Message de
 * 12 Mo, trop volumineux… » —, lue telle quelle par un agent germanophone, jusque dans l'extrait
 * de la liste.
 */
export async function parseEntetesSeuls(entetes: Uint8Array, ctx: ParseCtx): Promise<NormalizedMessage> {
  const m = await parseRfc822(entetes, ctx)
  return { ...m, bodyText: null, bodyHtml: null, snippet: '', attachments: [], corpsNonLu: true }
}

/**
 * Les octets des pièces demandées (par leur rang, `providerAttachmentId`), dans l'ordre demandé,
 * d'UNE analyse du message brut ; un rang absent est omis. ⛔ Le transfert en analysait le
 * message entier une fois PAR PIÈCE : 0,5 s de CPU pour un dossier de dix PDF (15.09.2026).
 */
export async function piecesDuBrut(raw: Uint8Array, rangs: number[]): Promise<{ rang: number; bytes: Uint8Array; mimeType: string; filename: string }[]> {
  if (rangs.length === 0) return []
  const e = (await PostalMime.parse(raw, { attachmentEncoding: 'arraybuffer', ...LIMITES })) as unknown as PmEmail
  return rangs.flatMap((rang) => {
    const a = e.attachments[rang]
    if (!a) return []
    const bytes = typeof a.content === 'string' ? new TextEncoder().encode(a.content) : new Uint8Array(a.content)
    return [{ rang, bytes, mimeType: a.mimeType || 'application/octet-stream', filename: a.filename || nomDePiece(rang, a.mimeType) }]
  })
}
