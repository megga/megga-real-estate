/**
 * L'adaptateur IMAP/SMTP — vu de `sync.ts`, `mail-actions`, `mail-send` et
 * `mail-attachment`, la même forme que `gmail.ts` et `graph.ts`.
 *
 * Trois dossiers sont synchronisés, comme chez Graph : la Réception, les Envoyés et, depuis
 * le 14.09.2026, le Spam (`\Junk`). Chaque message y est désigné par
 * `<dossier>:<uidValidity>:<uid>` (`provider_message_id`) — ce qu'il faut pour le retrouver
 * et y agir.
 *
 * ⚠ Le FIL n'existe pas en IMAP : il se reconstruit par `References` / `In-Reply-To`
 * (`cleDeFil`). ⚠ Un message DÉPLACÉ change d'UID : il est reconnu par son Message-ID et
 * rebaptisé (`reconnaitreDeplace`), sans quoi chaque déplacement fait dans le webmail
 * créerait un doublon dans le CRM.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  ImapConfig, ImapCursor, ImapFolderCursor, ImapSecret, MailAccountRow, MailThreadAction, NormalizedMessage, RemoteChange,
} from './types.ts'
import { ImapAuthError, ImapClient, type ImapFolder, type ImapMeta } from './imap-client.ts'
import { denoTcpDuplex, denoTlsDuplex, type DialOptions, type Duplex } from './duplex.ts'
import { resolvePublicHost } from '../safe-fetch.ts'
import { attachmentFromRaw, internalDateIso, parseEntetesSeuls, parseRfc822 } from './mime-parse.ts'
import { nettoyerMessageId } from './mime.ts'
import { MailAuthError, readAccountSecret } from './secrets.ts'
import { applyRemoteChanges, ingestMessages } from './ingest.ts'
import { SmtpError, sansCci, smtpProbe, smtpSend, type SmtpSecurity } from './smtp.ts'

export interface ImapDeps {
  /** Ouvre une connexion — `clair` = à monter en TLS (STARTTLS). Remplacée par une fausse dans les tests. */
  dial?: (host: string, port: number, clair: boolean, opts?: DialOptions) => Promise<Duplex>
  now?: () => number
}

/** Une session hors synchro (geste, envoi, pièce) ne dure pas plus : au-delà, c'est un serveur qui retient. */
const SESSION_MAX_MS = 120_000

/**
 * Ouvre une connexion vers un serveur de courrier SAISI par l'agent.
 *
 * ⛔ L'HÔTE EST REVÉRIFIÉ À CHAQUE CONNEXION, et la socket s'ouvre sur l'IP vérifiée.
 * `assertPublicHost` ne tournait qu'à `connect_imap` : ensuite, synchro toutes les 2 min,
 * gestes, envois et pièces rouvraient le NOM, résolu à neuf. Il suffisait à l'agent de
 * pointer son DNS vers `10.0.0.12` après la connexion pour que nos serveurs y ouvrent une
 * socket à chaque tick — et la bannière du service interne lui revenait par `last_error`.
 * Le nom ne sert plus qu'au certificat (`address`, cf. `denoTlsDuplex`).
 */
export async function dialVerifie(
  host: string, port: number, clair: boolean, opts: DialOptions = {},
  net = { resoudre: resolvePublicHost, tls: denoTlsDuplex, tcp: denoTcpDuplex },
): Promise<Duplex> {
  const address = await net.resoudre(host)
  const o: DialOptions = { deadline: Date.now() + SESSION_MAX_MS, ...opts, address }
  return clair ? net.tcp(host, port, o) : net.tls(host, port, o)
}

const dialDefaut = (host: string, port: number, clair: boolean, opts?: DialOptions) => dialVerifie(host, port, clair, opts)

/** IMAP 143 se monte en TLS par STARTTLS ; tout autre port est chiffré d'emblée (993). */
export const imapSecurite = (port: number): SmtpSecurity => (port === 143 ? 'starttls' : 'tls')
/**
 * SMTP 587 se monte en TLS par STARTTLS ; 465 est chiffré d'emblée. ⚠ Le PORT décide, pas
 * `encryption` : le couple « STARTTLS sur 465 » que l'ancien réglage permettait n'existe
 * chez aucun fournisseur — il échouait au test sans que l'agent sache pourquoi.
 */
export const smtpSecurite = (cfg: Pick<ImapConfig, 'smtpPort'>): SmtpSecurity => (cfg.smtpPort === 587 ? 'starttls' : 'tls')

// ── Dossiers ──────────────────────────────────────────────────────────────────

/**
 * Décode un nom de dossier en UTF-7 modifié (RFC 3501 §5.1.3) : « Envoy&AOk-s » → « Envoyés ».
 * Sert à RECONNAÎTRE un dossier par son nom ; le nom brut reste celui qu'on envoie au serveur.
 */
export function decodeMUtf7(s: string): string {
  return s.replace(/&([^-]*)-/g, (_, b64: string) => {
    if (b64 === '') return '&'
    try {
      const bin = atob(b64.replace(/,/g, '/') + '==='.slice((b64.length + 3) % 4))
      let out = ''
      for (let i = 0; i + 1 < bin.length; i += 2) out += String.fromCharCode((bin.charCodeAt(i) << 8) | bin.charCodeAt(i + 1))
      return out
    } catch { return `&${b64}-` }
  })
}

export interface ImapFolders { inbox: string; sent: string | null; archive: string | null; trash: string | null; junk: string | null }

/**
 * Les dossiers utiles : l'usage spécial annoncé (RFC 6154) d'abord, puis les noms usuels
 * des quatre langues, sous « INBOX. » ou « INBOX/ » compris (hiérarchies de Courier et
 * de Dovecot).
 */
export function resolveFolders(list: ImapFolder[]): ImapFolders {
  const parAttribut = (a: string) => list.find((f) => f.attributes.some((x) => x.toLowerCase() === a.toLowerCase()))?.name ?? null
  const parNom = (noms: string[]) => list.find((f) => {
    const n = decodeMUtf7(f.name).toLowerCase()
    return noms.some((x) => { const v = x.toLowerCase(); return n === v || n.endsWith(`.${v}`) || n.endsWith(`/${v}`) })
  })?.name ?? null
  return {
    inbox: list.find((f) => f.name.toLowerCase() === 'inbox')?.name ?? 'INBOX',
    sent: parAttribut('\\Sent') ?? parNom(['Sent', 'Sent Messages', 'Sent Items', 'Sent Mail', 'Envoyés', 'Éléments envoyés', 'Messages envoyés', 'Gesendet', 'Gesendete Elemente', 'Inviati', 'Posta inviata']),
    archive: parAttribut('\\Archive') ?? parNom(['Archive', 'Archives', 'Archiv', 'Archivio']),
    trash: parAttribut('\\Trash') ?? parNom(['Trash', 'Deleted Messages', 'Deleted Items', 'Corbeille', 'Éléments supprimés', 'Papierkorb', 'Gelöschte Elemente', 'Cestino', 'Posta eliminata']),
    // Le dossier « Spam » du CRM (14.09.2026). « Bulk Mail » est celui de Yahoo, « Spamverdacht »
    // celui de GMX et WEB.DE.
    junk: parAttribut('\\Junk') ?? parNom(['Junk', 'Spam', 'Junk E-mail', 'Junk Email', 'Junk Mail', 'Bulk Mail', 'Courrier indésirable', 'Pourriel', 'Indésirables', 'Spamverdacht', 'Junk-E-Mail', 'Unerwünscht', 'Posta indesiderata']),
  }
}

/** `<dossier>:<uidValidity>:<uid>` — le dossier peut lui-même contenir des deux-points. */
export function splitProviderId(pid: string): { folder: string; uidValidity: number; uid: number } | null {
  const m = pid.match(/^(.*):(\d+):(\d+)$/)
  return m ? { folder: m[1], uidValidity: Number(m[2]), uid: Number(m[3]) } : null
}
export const providerId = (folder: string, uidValidity: number, uid: number) => `${folder}:${uidValidity}:${uid}`

// ── Connexion ─────────────────────────────────────────────────────────────────

/** Connexion, STARTTLS au besoin, authentification, liste des dossiers. Referme sur tout échec. */
export async function imapOpen(cfg: ImapConfig, password: string, deps: ImapDeps = {}, dialOpts: DialOptions = {}): Promise<{ client: ImapClient; folders: ImapFolders }> {
  const securite = imapSecurite(cfg.imapPort)
  const client = new ImapClient(await (deps.dial ?? dialDefaut)(cfg.imapHost, cfg.imapPort, securite === 'starttls', dialOpts))
  try {
    await client.connect()
    if (securite === 'starttls') await client.starttls()
    await client.login(cfg.user, password)
    return { client, folders: resolveFolders(await client.list()) }
  } catch (e) {
    await client.logout()
    throw e
  }
}

/** Le mot de passe de la boîte, dans Vault. Absent = la boîte ne peut plus rien. */
async function motDePasse(admin: SupabaseClient, account: MailAccountRow): Promise<string> {
  if (!account.vault_secret_id) throw new MailAuthError('no_secret', 'imap: aucun secret')
  const s = await readAccountSecret<ImapSecret>(admin, account.vault_secret_id)
  if (!s || typeof s.password !== 'string') throw new MailAuthError('no_secret', 'imap: secret illisible')
  return s.password
}

/**
 * Ouvre la boîte d'un compte. ⚠ Un refus d'identifiants devient `reauth_required` — le
 * même verdict qu'un jeton OAuth révoqué : le mot de passe a changé, la boîte attend
 * qu'on la reconnecte, et le balayage cesse de la marteler.
 */
async function ouvrirCompte(admin: SupabaseClient, account: MailAccountRow, deps: ImapDeps, dialOpts: DialOptions = {}): Promise<{ client: ImapClient; folders: ImapFolders; password: string }> {
  const cfg = account.imap_config
  if (!cfg) throw new Error('imap: configuration absente')
  const password = await motDePasse(admin, account)
  try {
    return { ...(await imapOpen(cfg, password, deps, dialOpts)), password }
  } catch (e) {
    if (e instanceof ImapAuthError) throw new MailAuthError('reauth_required', `imap: identifiants refusés (${e.message.slice(0, 120)})`)
    throw e
  }
}

/**
 * Le test de l'assistant : IMAP (connexion, identifiants, dossiers) puis SMTP
 * (identifiants, sans rien envoyer). Rend un CODE par étape en échec, jamais le texte du
 * serveur — l'écran le traduit ; le texte va au journal de la fonction.
 */
export type EchecConnexion =
  | 'imap_auth' | 'imap_unreachable' | 'imap_starttls' | 'imap_certificate'
  | 'smtp_auth' | 'smtp_unreachable' | 'smtp_starttls' | 'smtp_certificate'

/**
 * Le certificat du serveur ne vaut pas pour le nom saisi. ⚠ Le cas COURANT d'un domaine
 * d'agence : `mail.agence.ch` pointe chez l'hébergeur, dont le certificat ne couvre que ses
 * propres noms. Deno le dit au premier échange, pas à la connexion (mesuré le 14.09.2026 :
 * « invalid peer certificate: certificate not valid for name … »).
 */
const certificatRefuse = (m: string) => /peer certificate/i.test(m)
export async function imapTestConnexion(cfg: ImapConfig, password: string, deps: ImapDeps = {}): Promise<{ ok: true } | { ok: false; code: EchecConnexion; detail: string }> {
  const texte = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)
  try {
    const { client } = await imapOpen(cfg, password, deps)
    await client.logout()
  } catch (e) {
    const m = texte(e)
    const code = e instanceof ImapAuthError ? 'imap_auth'
      : certificatRefuse(m) ? 'imap_certificate'
      : /starttls_unavailable/.test(m) ? 'imap_starttls'
      : 'imap_unreachable'
    return { ok: false, code, detail: m }
  }
  const securite = smtpSecurite(cfg)
  try {
    await smtpProbe(await (deps.dial ?? dialDefaut)(cfg.smtpHost, cfg.smtpPort, securite === 'starttls'), securite, { user: cfg.user, password })
  } catch (e) {
    const m = texte(e)
    // 535 : identifiants refusés ; 534 : le fournisseur exige un mot de passe d'application.
    const auth = e instanceof SmtpError && (e.code === 535 || e.code === 534)
    const code = auth ? 'smtp_auth'
      : certificatRefuse(m) ? 'smtp_certificate'
      : /starttls/.test(m) ? 'smtp_starttls'
      : 'smtp_unreachable'
    return { ok: false, code, detail: m }
  }
  return { ok: true }
}

// ── Synchronisation ───────────────────────────────────────────────────────────

const FENETRE_INITIALE_JOURS = 90
/**
 * Le Spam, sur 30 jours seulement : c'est ce que Gmail en garde, et ce que la plupart des
 * hébergeurs purgent. Au-delà, chaque spam importé serait du budget pris au vrai courrier.
 */
const FENETRE_SPAM_JOURS = 30
/** Au-delà, le message est ingéré SANS son corps : l'edge a 256 Mo et 2 s de CPU par requête. */
const POIDS_MAX = 8 * 1024 * 1024
/** Les seuls en-têtes d'un message trop lourd : postal-mime n'en lit pas plus de 2 Mo. */
const ENTETES_MAX = 4 * 1024 * 1024
/**
 * Plafond par dossier, par front et par passe. Le budget de temps décide d'abord ; ceci
 * borne le CPU — l'edge coupe une requête à 2 s de calcul, et une passe coupée ne sauve
 * pas son curseur : elle recommencerait le même travail, pour être coupée au même endroit.
 */
const MESSAGES_PAR_PASSE = 25
/** Métadonnées lues par commande : une ligne `UID FETCH 1,2,3…` raisonnable. */
const TRANCHE = 20
/** Les messages de la Réception dont on relit les drapeaux à chaque passe. */
const FENETRE_DRAPEAUX = 200
/** Les plus anciens messages du Spam dont on vérifie, à chaque passe, qu'ils n'ont pas été purgés. */
const PURGES_PAR_PASSE = 500

export interface ImapPassResult { cursor: ImapCursor; inserted: number; updated: number; changes: number; auditFailures: number; done: boolean }

/** Échappe `%`, `_` et `\` pour un motif LIKE : un dossier « 100%_perso » ne doit rien apparier d'autre. */
const echapperLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * La clé de fil d'un message : celle du fil d'un message qu'il cite et que la base
 * connaît déjà ; sinon la RACINE de ses `References` — la même pour toute la
 * conversation, que la racine soit arrivée avant ou après.
 *
 * ⚠ Un message au SPAM n'ancre aucune conversation : un courrier qui ne cite que lui ne
 * rejoint pas son fil, qui repasserait alors en Réception avec lui (l'ingestion range le
 * spam dans un fil à part, `cleDeFilSpam`).
 */
export async function cleDeFil(admin: SupabaseClient, accountId: string, m: NormalizedMessage): Promise<string> {
  const cites = [...new Set([...m.references.slice(0, 1), ...m.references.slice(-20), ...(m.inReplyTo ? [m.inReplyTo] : [])])]
  if (cites.length) {
    const { data, error } = await admin.from('mail_messages').select('thread_id').eq('account_id', accountId).eq('is_spam', false).in('rfc822_message_id', cites).limit(1)
    if (error) throw new Error(`fil, recherche par référence: ${error.message}`)
    const threadId = (data as { thread_id: string }[] | null)?.[0]?.thread_id
    if (threadId) {
      const { data: t, error: e2 } = await admin.from('mail_threads').select('provider_thread_id').eq('id', threadId).maybeSingle()
      if (e2) throw new Error(`fil, lecture: ${e2.message}`)
      if (t) return (t as { provider_thread_id: string }).provider_thread_id
    }
  }
  return m.references[0] ?? m.inReplyTo ?? m.rfc822MessageId ?? m.providerMessageId
}

/**
 * Un message déjà en base sous un AUTRE identifiant (déplacé dans le webmail, dossier
 * recréé) est rebaptisé au lieu d'être dupliqué. Reconnu par son Message-ID, sa direction —
 * un envoi en copie à soi-même garde ses deux exemplaires, entrant et sortant — et sa DATE
 * D'ARRIVÉE.
 *
 * ⛔ LE MESSAGE-ID SEUL N'EST PAS UNE IDENTITÉ : l'expéditeur l'écrit comme il veut. Un
 * courrier NEUF qui reprenait celui d'un message connu — un co-destinataire en copie le
 * connaît — rebaptisait sa ligne, puis l'ingestion l'ÉCRASAIT avec l'expéditeur, le corps
 * et les pièces du nouveau : l'IBAN de la notaire devenait celui de l'attaquant, sans une
 * ligne au journal. L'INTERNALDATE, elle, est posée par le serveur de l'agent à l'arrivée ;
 * un déplacement la garde (RFC 3501 §6.4.7, RFC 6851), un courrier neuf en reçoit une autre.
 * Sans elle, ou quand elle diffère, on n'identifie rien : un doublon visible vaut mieux
 * qu'un message réécrit.
 */
async function reconnaitreDeplace(admin: SupabaseClient, accountId: string, m: NormalizedMessage, internalDate: string | null): Promise<void> {
  if (!m.rfc822MessageId) return
  const arrivee = Date.parse(internalDateIso(internalDate) ?? '')
  if (Number.isNaN(arrivee)) return
  const { data, error } = await admin.from('mail_messages').select('id, provider_message_id, sent_at')
    .eq('account_id', accountId).eq('rfc822_message_id', m.rfc822MessageId).eq('direction', m.direction).limit(5)
  if (error) throw new Error(`message déplacé, recherche: ${error.message}`)
  const lignes = (data ?? []) as { id: string; provider_message_id: string; sent_at: string | null }[]
  if (lignes.some((l) => l.provider_message_id === m.providerMessageId)) return
  // Une ligne `pending:` est l'affaire de l'ingestion (copie « Envoyés » d'un envoi du CRM).
  const ancien = lignes.find((l) => !l.provider_message_id.startsWith('pending:') && Date.parse(l.sent_at ?? '') === arrivee)
  if (!ancien) return
  const { error: e2 } = await admin.from('mail_messages').update({ provider_message_id: m.providerMessageId }).eq('id', ancien.id)
  if (e2) throw new Error(`message déplacé, renommage: ${e2.message}`)
}

/**
 * Une passe sur un compte IMAP : pour la Réception puis les Envoyés, le courrier NEUF
 * d'abord (au-dessus de `lastUid`), puis l'import des 90 jours à reculons, puis — pour la
 * Réception — les drapeaux posés ailleurs.
 */
export async function imapSyncPass(admin: SupabaseClient, account: MailAccountRow, cursorIn: ImapCursor | null, budgetMs: number, deps: ImapDeps = {}): Promise<ImapPassResult> {
  const now = deps.now ?? Date.now
  const debut = now()
  const reste = () => budgetMs - (now() - debut)
  const out: ImapPassResult = {
    cursor: cursorIn?.kind === 'imap' ? { ...cursorIn, folders: { ...cursorIn.folders } } : { kind: 'imap', folders: {}, initialDone: false },
    inserted: 0, updated: 0, changes: 0, auditFailures: 0, done: true,
  }
  // La session ne survit pas à la passe (et à son bail) : au-delà du budget et d'une marge, un
  // serveur qui distille ses octets fait lever la lecture en cours au lieu de tenir l'edge.
  const { client, folders } = await ouvrirCompte(admin, account, deps, { deadline: Date.now() + budgetMs + 15_000 })
  try {
    const dossiers: [string, 'inbox' | 'sent' | 'junk'][] = [[folders.inbox, 'inbox']]
    if (folders.sent) dossiers.push([folders.sent, 'sent'])
    // Le spam APRÈS la Réception : un message remis en Réception dans le webmail y est déjà
    // rebaptisé quand le dossier Spam constate son départ (`resynchroniserSpam`).
    if (folders.junk) dossiers.push([folders.junk, 'junk'])
    for (const [nom, role] of dossiers) {
      if (reste() <= 0) { out.done = false; break }
      const sel = await client.examine(nom)
      let etat: ImapFolderCursor = out.cursor.folders[nom] ?? { uidValidity: -1, lastUid: 0 }
      if (etat.uidValidity !== sel.uidValidity) {
        // Premier passage, ou dossier RECRÉÉ côté serveur (UIDVALIDITY changé : les anciens
        // UID ne désignent plus rien). On repart de la fenêtre initiale, du plus récent au
        // plus ancien.
        const jours = role === 'junk' ? FENETRE_SPAM_JOURS : FENETRE_INITIALE_JOURS
        const depuis = await client.uidSearchSince(new Date(now() - jours * 86_400_000))
        const haut = depuis.length ? Math.max(...depuis) : 0
        etat = {
          uidValidity: sel.uidValidity,
          lastUid: sel.uidNext > 0 ? Math.max(sel.uidNext - 1, haut) : haut,
          backfillBelow: depuis.length ? haut + 1 : null,
          floorUid: depuis.length ? Math.min(...depuis) : null,
        }
      }
      const ingerer = async (uids: number[]): Promise<number[]> => {
        const faits: number[] = []
        for (let i = 0; i < uids.length && reste() > 0; i += TRANCHE) {
          const tranche = uids.slice(i, i + TRANCHE)
          const metas = new Map((await client.uidFetchMeta(tranche.join(','))).map((m) => [m.uid, m]))
          const lot: NormalizedMessage[] = []
          const lus: number[] = []
          for (const uid of tranche) {
            if (reste() <= 0) break
            const meta = metas.get(uid)
            lus.push(uid)
            // Expurgé entre la recherche et la lecture, ou marqué supprimé sans être expurgé :
            // un message que tous les clients cachent n'entre pas dans le CRM.
            if (!meta || meta.flags.includes('\\Deleted')) continue
            const m = await lire(client, account, nom, sel.uidValidity, role, meta)
            // Illisible jusque dans ses en-têtes : sauté — il reste dans la boîte, et la passe
            // continue au lieu de buter sur lui à chaque tick (cf. `lire`).
            if (!m || m.isDraft) continue
            // Le spam a son propre fil, décidé à l'ingestion (`cleDeFilSpam`).
            if (!m.isSpam) m.providerThreadId = await cleDeFil(admin, account.id, m)
            await reconnaitreDeplace(admin, account.id, m, meta.internalDate)
            lot.push(m)
          }
          const r = await ingestMessages(admin, account, lot)
          out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
          faits.push(...lus)
        }
        return faits
      }

      // 1. Le courrier neuf, dans l'ordre : `lastUid` n'avance que sur ce qui est écrit.
      const neufs = (await client.uidSearchRange(etat.lastUid + 1)).filter((u) => u > etat.lastUid).sort((a, b) => a - b)
      const neufsFaits = await ingerer(neufs.slice(0, MESSAGES_PAR_PASSE))
      if (neufsFaits.length) etat.lastUid = Math.max(etat.lastUid, ...neufsFaits)
      if (neufsFaits.length < neufs.length) out.done = false

      // 2. L'import de la fenêtre initiale (90 jours, 30 pour le Spam), du plus récent au plus ancien.
      if (etat.backfillBelow != null && etat.floorUid != null && reste() > 0) {
        const anciens = (await client.uidSearchBetween(etat.floorUid, etat.backfillBelow - 1)).sort((a, b) => b - a)
        if (anciens.length === 0) {
          etat.backfillBelow = null
        } else {
          const faits = await ingerer(anciens.slice(0, MESSAGES_PAR_PASSE))
          if (faits.length) etat.backfillBelow = Math.min(...faits)
          if (faits.length === anciens.length) etat.backfillBelow = null
          else out.done = false
        }
      } else if (etat.backfillBelow != null) {
        out.done = false
      }
      out.cursor.folders[nom] = etat

      // 3. Les drapeaux posés ailleurs (webmail, téléphone) — Réception ; et, pour le Spam,
      //    les messages qui l'ont QUITTÉ (remis en Réception, ou purgés par le fournisseur).
      if (role === 'inbox' && reste() > 0) out.changes += await resynchroniserDrapeaux(admin, account, client, nom, etat)
      if (role === 'junk' && reste() > 0) out.changes += await resynchroniserSpam(admin, account, client, nom, etat, folders.inbox)
    }
  } finally {
    await client.logout()
  }
  out.cursor.initialDone = Object.values(out.cursor.folders).every((f) => f.backfillBelow == null)
  if (!out.cursor.initialDone) out.done = false
  return out
}

/** Les octets d'en-tête d'un message brut : tout ce qui précède la première ligne vide. */
function entetesDe(raw: Uint8Array): Uint8Array {
  for (let i = 0; i + 3 < raw.length; i++) {
    if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) return raw.subarray(0, i + 2)
  }
  return raw
}

/**
 * Télécharge et analyse un message — ou ses seuls en-têtes quand il est trop lourd, ou quand
 * l'analyse de son corps échoue. `null` s'il est illisible jusque dans ses en-têtes.
 *
 * ⛔ UN COURRIER PIÉGÉ BLOQUAIT LA BOÎTE POUR TOUJOURS. L'analyse n'était isolée de rien :
 * 51 niveaux de multipart (postal-mime lève), un `&#1114112;` dans un HTML… et c'est la
 * passe ENTIÈRE qui échouait, avant d'écrire son curseur, au même message à chaque tick,
 * jusqu'à `status='error'` — que ni `update` ni une reconnexion ne levaient. N'importe quel
 * expéditeur éteignait ainsi la synchro d'une boîte d'un seul envoi (un spam suffit, le
 * dossier Spam est synchronisé). Seule l'ANALYSE est isolée : une coupure réseau pendant le
 * téléchargement fait toujours échouer la passe, qui la rejouera.
 */
async function lire(client: ImapClient, account: MailAccountRow, dossier: string, uidValidity: number, role: 'inbox' | 'sent' | 'junk', meta: ImapMeta): Promise<NormalizedMessage | null> {
  const ctx = { providerMessageId: providerId(dossier, uidValidity, meta.uid), boxEmail: account.email, dossier: role, flags: meta.flags, internalDate: meta.internalDate }
  const enTetesSeuls = async (entetes: Uint8Array, corps: string): Promise<NormalizedMessage | null> => {
    try {
      return await parseEntetesSeuls(entetes, ctx, corps)
    } catch (e) {
      console.warn(`[mail-sync] imap ${account.id} : message ${ctx.providerMessageId} illisible, sauté (${e instanceof Error ? e.name : 'erreur'})`)
      return null
    }
  }
  if (meta.size > POIDS_MAX) {
    return enTetesSeuls(await client.uidFetchHeader(meta.uid, ENTETES_MAX), `Message de ${Math.round(meta.size / 1024 / 1024)} Mo, trop volumineux pour être affiché ici : ouvrez-le dans votre messagerie.`)
  }
  // Le serveur a ANNONCÉ au plus POIDS_MAX : un littéral bien plus gros n'est pas ce message-là.
  const raw = await client.uidFetchRaw(meta.uid, POIDS_MAX * 2)
  try {
    return await parseRfc822(raw, ctx)
  } catch {
    return enTetesSeuls(entetesDe(raw), `Ce message n'a pas pu être lu ici : ouvrez-le dans votre messagerie.`)
  }
}

/**
 * Relit les drapeaux des messages récents de la Réception et rend ce qui a changé ailleurs :
 * lu / non lu, suivi, et le message SORTI de la Réception (archivé ou supprimé dans le
 * webmail) — jugé sur le message ENTRANT le plus récent de chaque fil, pour qu'un vieux
 * message rangé ailleurs n'archive pas une conversation encore vivante.
 */
async function resynchroniserDrapeaux(admin: SupabaseClient, account: MailAccountRow, client: ImapClient, dossier: string, etat: ImapFolderCursor): Promise<number> {
  const { data, error } = await admin.from('mail_messages').select('provider_message_id, is_read, thread_id, direction')
    .eq('account_id', account.id).like('provider_message_id', `${echapperLike(`${dossier}:${etat.uidValidity}:`)}%`)
    .order('sent_at', { ascending: false }).limit(FENETRE_DRAPEAUX)
  if (error) throw new Error(`drapeaux, messages connus: ${error.message}`)
  const connus = ((data ?? []) as { provider_message_id: string; is_read: boolean; thread_id: string; direction: string }[])
    .map((r) => ({ ...r, uid: splitProviderId(r.provider_message_id)?.uid ?? 0 }))
    .filter((r) => r.uid > 0 && r.uid <= etat.lastUid)
  if (connus.length === 0) return 0
  const distants = new Map((await client.uidFetchFlags(connus.map((c) => c.uid).join(','))).map((f) => [f.uid, f.flags]))

  const threadIds = [...new Set(connus.map((c) => c.thread_id))]
  const { data: fils, error: eFils } = await admin.from('mail_threads').select('id, is_starred, is_archived').in('id', threadIds)
  if (eFils) throw new Error(`drapeaux, fils: ${eFils.message}`)
  const etatFil = new Map(((fils ?? []) as { id: string; is_starred: boolean; is_archived: boolean }[]).map((f) => [f.id, f]))

  const changes: RemoteChange[] = []
  const suivis = new Map<string, boolean>()
  const plusRecentEntrant = new Map<string, (typeof connus)[number]>()
  for (const c of connus) {
    const flags = distants.get(c.uid)
    if (flags) {
      const lu = flags.includes('\\Seen')
      if (lu !== c.is_read) changes.push({ kind: 'flags', providerMessageId: c.provider_message_id, isRead: lu })
      suivis.set(c.thread_id, (suivis.get(c.thread_id) ?? false) || flags.includes('\\Flagged'))
    }
    // La requête est triée du plus récent au plus ancien : le premier entrant vu par fil est le bon.
    if (c.direction === 'inbound' && !plusRecentEntrant.has(c.thread_id)) plusRecentEntrant.set(c.thread_id, c)
  }
  for (const [threadId, suivi] of suivis) {
    const f = etatFil.get(threadId)
    const temoin = connus.find((c) => c.thread_id === threadId && distants.has(c.uid))
    if (f && temoin && f.is_starred !== suivi) changes.push({ kind: 'flags', providerMessageId: temoin.provider_message_id, isStarred: suivi })
  }
  for (const [threadId, c] of plusRecentEntrant) {
    const f = etatFil.get(threadId)
    if (f && !f.is_archived && !distants.has(c.uid)) changes.push({ kind: 'flags', providerMessageId: c.provider_message_id, inInbox: false })
  }
  return applyRemoteChanges(admin, account, changes)
}

/**
 * Le dossier Spam : les messages qui l'ont QUITTÉ. Remis en Réception dans le webmail
 * (« ce n'est pas un spam »), un message y a un nouvel UID — la passe de la Réception l'a
 * normalement déjà rebaptisé ; sinon on l'y cherche par son Message-ID. Introuvable, il a
 * été purgé (le fournisseur vide son spam) ou supprimé : il quitte le CRM.
 *
 * ⛔ JAMAIS « archivé » — c'est ce que la Réception fait d'un message qui la quitte, et un
 * spam purgé réapparaîtrait alors dans Archivé, le défaut même que le dossier Spam répare.
 */
async function resynchroniserSpam(admin: SupabaseClient, account: MailAccountRow, client: ImapClient, dossier: string, etat: ImapFolderCursor, reception: string): Promise<number> {
  const motif = `${echapperLike(`${dossier}:${etat.uidValidity}:`)}%`
  const { data, error } = await admin.from('mail_messages').select('provider_message_id, is_read, rfc822_message_id')
    .eq('account_id', account.id).like('provider_message_id', motif)
    .order('sent_at', { ascending: false }).limit(FENETRE_DRAPEAUX)
  if (error) throw new Error(`spam, messages connus: ${error.message}`)
  const connus = ((data ?? []) as { provider_message_id: string; is_read: boolean; rfc822_message_id: string | null }[])
    .map((r) => ({ ...r, uid: splitProviderId(r.provider_message_id)?.uid ?? 0 }))
    .filter((r) => r.uid > 0 && r.uid <= etat.lastUid)
  if (connus.length === 0) return 0
  const distants = new Map((await client.uidFetchFlags(connus.map((c) => c.uid).join(','))).map((f) => [f.uid, f.flags]))

  const changes: RemoteChange[] = []
  const partis: typeof connus = []
  for (const c of connus) {
    const flags = distants.get(c.uid)
    if (!flags) { partis.push(c); continue }
    const lu = flags.includes('\\Seen')
    if (lu !== c.is_read) changes.push({ kind: 'flags', providerMessageId: c.provider_message_id, isRead: lu })
  }

  // Sous cette fenêtre, les PURGES. Un serveur vide son spam par le bas — le plus ancien
  // d'abord, souvent à 30 jours —, là où la fenêtre des plus récents ne regarde jamais : une
  // boîte qui reçoit plus de FENETRE_DRAPEAUX spams par mois les verrait sinon s'accumuler
  // ici sans fin. Une seule recherche sur leur plage rend les UID encore présents. Un
  // message remis en Réception y a pris un nouvel UID : la passe de la Réception l'a déjà
  // rebaptisé, ou le reprendra comme un courrier neuf.
  const vus = new Set(connus.map((c) => c.provider_message_id))
  const { data: bas, error: e1 } = await admin.from('mail_messages').select('provider_message_id')
    .eq('account_id', account.id).like('provider_message_id', motif)
    .order('sent_at', { ascending: true }).limit(PURGES_PAR_PASSE)
  if (e1) throw new Error(`spam, messages anciens: ${e1.message}`)
  const anciens = ((bas ?? []) as { provider_message_id: string }[])
    .filter((r) => !vus.has(r.provider_message_id))
    .map((r) => ({ ...r, uid: splitProviderId(r.provider_message_id)?.uid ?? 0 }))
    .filter((r) => r.uid > 0 && r.uid <= etat.lastUid)
  if (anciens.length) {
    const uids = anciens.map((a) => a.uid)
    const presents = new Set(await client.uidSearchBetween(Math.min(...uids), Math.max(...uids)))
    for (const a of anciens) if (!presents.has(a.uid)) changes.push({ kind: 'message_deleted', providerMessageId: a.provider_message_id })
  }

  if (partis.length) {
    const sel = await client.examine(reception)
    for (const c of partis) {
      // Relu en base : une ligne écrite AVANT le nettoyage à l'analyse peut encore porter un
      // Message-ID à plusieurs lignes — il ne part jamais tel quel vers le serveur.
      const mid = nettoyerMessageId(c.rfc822_message_id)
      const trouves = mid ? await client.uidSearchHeaderMessageId(mid) : []
      if (trouves.length === 0) { changes.push({ kind: 'message_deleted', providerMessageId: c.provider_message_id }); continue }
      const nouveau = providerId(reception, sel.uidValidity, Math.max(...trouves))
      const { error: e } = await admin.from('mail_messages').update({ provider_message_id: nouveau })
        .eq('account_id', account.id).eq('provider_message_id', c.provider_message_id)
      if (e) throw new Error(`spam, renommage: ${e.message}`)
      changes.push({ kind: 'flags', providerMessageId: nouveau, isSpam: false, inInbox: true })
    }
  }
  return applyRemoteChanges(admin, account, changes)
}

// ── Gestes ────────────────────────────────────────────────────────────────────

export interface ImapMsg { provider_message_id: string; direction: 'inbound' | 'outbound'; rfc822_message_id?: string | null }

/**
 * Le dossier d'un message a été RECRÉÉ depuis que la base l'a lu : son UID désigne peut-être
 * un autre message.
 *
 * ⛔ UN UID NE VAUT QUE SOUS SON UIDVALIDITY (RFC 3501 §2.3.1.1). Les gestes, l'aperçu d'une
 * pièce et le transfert agissaient sur l'UID stocké sans la comparer : après un changement
 * d'hébergeur (la reconnexion garde lignes et curseur) ou un dossier recréé, « Supprimer »
 * envoyait à la corbeille le courrier d'un autre, et l'aperçu servait la pièce d'un autre
 * message — celui d'un autre client. Le geste est refusé ; la synchronisation suivante,
 * qui repart de la nouvelle UIDVALIDITY, rebaptise les lignes.
 */
export class ImapDossierRecree extends Error {
  constructor(dossier: string) {
    super(`imap: le dossier « ${dossier} » a été recréé, geste refusé jusqu'à la prochaine synchronisation`)
    this.name = 'ImapDossierRecree'
  }
}

/**
 * Répercute un geste sur les messages d'un fil, en UNE connexion. Rend les identifiants
 * qui ont changé (un déplacement change l'UID) : `mail-actions` les réécrit en base, sans
 * quoi le geste suivant — « désarchiver » — viserait un message qui n'est plus là.
 *
 * ⚠ Seuls les messages ENTRANTS se déplacent, comme chez Graph : une copie « Envoyés »
 * reste dans les Envoyés.
 */
export async function imapApply(admin: SupabaseClient, account: MailAccountRow, action: MailThreadAction, msgs: ImapMsg[], deps: ImapDeps = {}): Promise<Record<string, string>> {
  const renamed: Record<string, string> = {}
  const { client, folders } = await ouvrirCompte(admin, account, deps)
  try {
    let ouvert: string | null = null
    let validite = 0
    const ouvrir = async (dossier: string) => {
      if (ouvert !== dossier) { validite = (await client.select(dossier)).uidValidity; ouvert = dossier }
    }
    // Le dossier du message, et SON UIDVALIDITY : sinon l'UID vise un autre message.
    const viser = async (p: { folder: string; uidValidity: number }) => {
      await ouvrir(p.folder)
      if (validite !== p.uidValidity) throw new ImapDossierRecree(p.folder)
    }
    let archive = folders.archive
    let junk = folders.junk
    for (const m of msgs) {
      if (m.provider_message_id.startsWith('pending:')) continue
      const p = splitProviderId(m.provider_message_id)
      if (!p) continue
      if (action === 'mark_read' || action === 'mark_unread' || action === 'star' || action === 'unstar') {
        await viser(p)
        const drapeau = action === 'mark_read' || action === 'mark_unread' ? '\\Seen' : '\\Flagged'
        await client.uidStore(p.uid, [drapeau], action === 'mark_read' || action === 'star' ? 'add' : 'remove')
        continue
      }
      if (m.direction !== 'inbound') continue
      let dest: string | null
      if (action === 'archive') {
        // Une boîte sans dossier d'archive en reçoit un — c'est ce que font Thunderbird et
        // Apple Mail au premier archivage.
        if (!archive) { await client.create('Archive'); archive = 'Archive' }
        dest = archive
      } else if (action === 'trash') {
        dest = folders.trash
        if (!dest) throw new Error('imap: aucun dossier Corbeille sur ce serveur')
      } else if (action === 'spam') {
        // Même règle que l'archive : une boîte sans dossier de spam en reçoit un.
        if (!junk) { await client.create('Junk'); junk = 'Junk' }
        dest = junk
      } else {
        // unarchive, untrash, not_spam : retour en Réception.
        dest = folders.inbox
      }
      if (p.folder === dest) continue
      await viser(p)
      const arrivee = await client.uidMove(p.uid, dest)
      if (arrivee.uid !== null && arrivee.uidValidity !== null) {
        renamed[m.provider_message_id] = providerId(dest, arrivee.uidValidity, arrivee.uid)
      } else if (nettoyerMessageId(m.rfc822_message_id)) {
        // Sans UIDPLUS, le serveur ne dit pas où le message a atterri : on le cherche — par
        // un Message-ID NETTOYÉ, jamais la valeur lue en base telle quelle.
        const sel = await client.select(dest)
        ouvert = dest
        validite = sel.uidValidity
        const trouves = await client.uidSearchHeaderMessageId(nettoyerMessageId(m.rfc822_message_id)!)
        if (trouves.length) renamed[m.provider_message_id] = providerId(dest, sel.uidValidity, Math.max(...trouves))
      }
    }
  } finally {
    await client.logout()
  }
  return renamed
}

// ── Envoi ─────────────────────────────────────────────────────────────────────

/**
 * Envoie par SMTP, puis dépose la copie dans « Envoyés » — un serveur IMAP ne le fait pas
 * seul, et sans cette copie le message n'existerait ni dans le webmail de l'agent, ni pour
 * la synchro qui rapproche la ligne `pending:` du CRM.
 *
 * ⚠ La copie déposée GARDE l'en-tête Cci (l'expéditeur voit à qui il a écrit) ; la copie
 * transmise ne le porte pas (`sansCci`). ⚠ Un dépôt raté ne fait pas échouer l'envoi : le
 * message est PARTI — `appendError` le dit à l'appelant, qui le journalise.
 */
export async function imapSend(admin: SupabaseClient, account: MailAccountRow, raw: string, rcpts: string[], deps: ImapDeps = {}): Promise<{ appendError: string | null }> {
  const cfg = account.imap_config
  if (!cfg) throw new Error('imap: configuration absente')
  const password = await motDePasse(admin, account)
  const securite = smtpSecurite(cfg)
  await smtpSend(await (deps.dial ?? dialDefaut)(cfg.smtpHost, cfg.smtpPort, securite === 'starttls'), securite, {
    user: cfg.user, password, from: account.email, rcpts, raw: sansCci(raw),
  })
  try {
    const { client, folders } = await imapOpen(cfg, password, deps)
    try {
      if (!folders.sent) return { appendError: 'aucun dossier Envoyés' }
      await client.append(folders.sent, new TextEncoder().encode(raw))
    } finally {
      await client.logout()
    }
  } catch (e) {
    return { appendError: e instanceof Error ? e.message : String(e) }
  }
  return { appendError: null }
}

// ── Pièces ────────────────────────────────────────────────────────────────────

/** Le message brut, relu dans son dossier. */
async function brut(admin: SupabaseClient, account: MailAccountRow, pid: string, deps: ImapDeps): Promise<Uint8Array> {
  const p = splitProviderId(pid)
  if (!p) throw new Error('imap: identifiant de message illisible')
  const { client } = await ouvrirCompte(admin, account, deps)
  try {
    // Sous une autre UIDVALIDITY, cet UID est la pièce d'un AUTRE message (`ImapDossierRecree`).
    if ((await client.examine(p.folder)).uidValidity !== p.uidValidity) throw new ImapDossierRecree(p.folder)
    return await client.uidFetchRaw(p.uid)
  } finally {
    await client.logout()
  }
}

/** Les octets d'une pièce (`provider_attachment_id` = son rang dans le message). */
export async function imapAttachment(admin: SupabaseClient, account: MailAccountRow, pid: string, index: number, deps: ImapDeps = {}): Promise<Uint8Array> {
  const a = await attachmentFromRaw(await brut(admin, account, pid, deps), index)
  if (!a) throw new Error('imap: pièce introuvable')
  return a.bytes
}

/** Les pièces d'un message, pour un TRANSFERT (Graph les joint seul ; Gmail et IMAP, non). */
export async function imapPiecesPourTransfert(admin: SupabaseClient, account: MailAccountRow, pid: string, indices: number[], deps: ImapDeps = {}): Promise<{ filename: string; mimeType: string; bytes: Uint8Array }[]> {
  if (indices.length === 0) return []
  const raw = await brut(admin, account, pid, deps)
  const out: { filename: string; mimeType: string; bytes: Uint8Array }[] = []
  for (const i of indices) {
    const a = await attachmentFromRaw(raw, i)
    if (a) out.push({ filename: a.filename, mimeType: a.mimeType, bytes: a.bytes })
  }
  return out
}

