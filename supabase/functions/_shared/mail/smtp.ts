/**
 * Client SMTP minimal — envoyer un message déjà construit (`buildMime`), ou seulement
 * vérifier des identifiants à l'ajout d'une boîte (`smtpProbe`).
 *
 * Deux sécurités : TLS dès l'ouverture (465), ou connexion en clair montée par
 * `STARTTLS` (587). ⚠ Mesuré en T3.1 depuis l'edge : 465 et 587 répondent, 25 est
 * filtré — le « 587 interdit » de la documentation Supabase était faux. 465 reste la voie
 * par défaut de l'assistant, parce que c'est la seule que la sonde a menée jusqu'au bout.
 *
 * ⛔ Aucun mot de passe ne part sur un canal en clair : un serveur 587 qui n'annonce pas
 * `STARTTLS` est refusé (`starttls_unavailable`) au lieu d'être servi en clair.
 */
import { LineReader, type Duplex } from './duplex.ts'

export type SmtpSecurity = 'tls' | 'starttls'
export interface SmtpAuth { user: string; password: string }
export interface SmtpSendInput extends SmtpAuth { from: string; rcpts: string[]; raw: string }

/** Un refus du serveur, avec son code (535 = identifiants refusés) — ou `null` hors protocole. */
export class SmtpError extends Error {
  constructor(readonly code: number | null, message: string) { super(message) }
}

/** Le nom annoncé en `EHLO` : celui du produit, jamais un nom de machine. */
const EHLO = 'getmegga.com'

function base64Utf8(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin)
}

class Session {
  private reader: LineReader
  private ehlo: string[] = []
  constructor(private conn: Duplex) { this.reader = new LineReader(conn) }

  /** Une réponse (multi-ligne `250-…` jusqu'à `250 …`), dont le code doit être attendu. */
  private async reponse(codes: number[]): Promise<string[]> {
    const lignes: string[] = []
    for (;;) {
      const l = await this.reader.line()
      if (l === null) throw new SmtpError(null, 'smtp: connection closed')
      lignes.push(l)
      if (!/^\d{3}-/.test(l)) break
    }
    const code = Number(lignes[lignes.length - 1].slice(0, 3))
    if (!codes.includes(code)) throw new SmtpError(Number.isFinite(code) ? code : null, `smtp: ${lignes.join(' | ')}`)
    return lignes
  }

  private async envoyer(ligne: string): Promise<void> {
    await this.conn.write(new TextEncoder().encode(`${ligne}\r\n`))
  }

  private async bonjour(): Promise<void> {
    await this.envoyer(`EHLO ${EHLO}`)
    this.ehlo = (await this.reponse([250])).map((l) => l.slice(4).trim().toUpperCase())
  }

  private annonce(mot: string): string | null {
    return this.ehlo.find((l) => l === mot || l.startsWith(`${mot} `)) ?? null
  }

  async ouvrir(securite: SmtpSecurity): Promise<void> {
    await this.reponse([220])
    await this.bonjour()
    if (securite === 'starttls') {
      if (!this.conn.startTls) throw new SmtpError(null, 'smtp: connexion déjà chiffrée')
      if (!this.annonce('STARTTLS')) throw new SmtpError(null, 'smtp: starttls_unavailable')
      await this.envoyer('STARTTLS')
      await this.reponse([220])
      this.conn = await this.conn.startTls()
      this.reader = new LineReader(this.conn)
      // Ce que le serveur annonçait en clair ne vaut plus (RFC 3207 §4.2) : on redemande.
      await this.bonjour()
    }
    if (this.conn.startTls) throw new SmtpError(null, 'smtp: canal en clair')
  }

  /**
   * AUTH PLAIN quand le serveur l'annonce (ou n'annonce rien), AUTH LOGIN sinon — les deux
   * mécanismes que proposent les serveurs qu'on a mesurés (Infomaniak, Bluewin).
   */
  async authentifier(a: SmtpAuth): Promise<void> {
    const auth = this.annonce('AUTH') ?? ''
    const mecanismes = auth.split(/\s+/).slice(1)
    if (mecanismes.length === 0 || mecanismes.includes('PLAIN')) {
      await this.envoyer(`AUTH PLAIN ${base64Utf8(`\0${a.user}\0${a.password}`)}`)
      await this.reponse([235])
      return
    }
    if (!mecanismes.includes('LOGIN')) throw new SmtpError(null, `smtp: aucun mécanisme pris en charge (${auth})`)
    await this.envoyer('AUTH LOGIN')
    await this.reponse([334])
    await this.envoyer(base64Utf8(a.user))
    await this.reponse([334])
    await this.envoyer(base64Utf8(a.password))
    await this.reponse([235])
  }

  async message(from: string, rcpts: string[], raw: string): Promise<void> {
    await this.envoyer(`MAIL FROM:<${from}>`)
    await this.reponse([250])
    for (const r of rcpts) {
      await this.envoyer(`RCPT TO:<${r}>`)
      await this.reponse([250, 251])
    }
    await this.envoyer('DATA')
    await this.reponse([354])
    // Fins de ligne CRLF, puis dot-stuffing (RFC 5321 §4.5.2) : une ligne qui commence par
    // un point en prend un second, sans quoi un « . » seul terminerait le message en route.
    const corps = raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..')
    await this.conn.write(new TextEncoder().encode(`${corps}${corps.endsWith('\r\n') ? '' : '\r\n'}.\r\n`))
    await this.reponse([250])
  }

  async quitter(): Promise<void> {
    try { await this.envoyer('QUIT'); await this.reponse([221]) } catch { /* certains serveurs ferment sans 221 */ }
    this.conn.close()
  }

  fermer(): void { this.conn.close() }
}

/** Envoie `raw` à `rcpts`. Lève `SmtpError` sur tout refus ; la connexion est toujours fermée. */
export async function smtpSend(conn: Duplex, securite: SmtpSecurity, a: SmtpSendInput): Promise<void> {
  const s = new Session(conn)
  try {
    await s.ouvrir(securite)
    await s.authentifier(a)
    await s.message(a.from, a.rcpts, a.raw)
  } catch (e) {
    s.fermer()
    throw e
  }
  await s.quitter()
}

/** Ouvre, s'authentifie, referme — sans rien envoyer. C'est le test de l'assistant. */
export async function smtpProbe(conn: Duplex, securite: SmtpSecurity, a: SmtpAuth): Promise<void> {
  const s = new Session(conn)
  try {
    await s.ouvrir(securite)
    await s.authentifier(a)
  } catch (e) {
    s.fermer()
    throw e
  }
  await s.quitter()
}

/**
 * Retire l'en-tête `Bcc` d'un message brut — pour la copie qui PART.
 *
 * ⛔ `buildMime` écrit `Bcc:` dans les en-têtes : Gmail l'ôte lui-même à l'envoi, un
 * serveur SMTP non. Transmis tel quel, chaque destinataire lisait la liste des copies
 * CACHÉES. Les destinataires Cci reçoivent le message par l'enveloppe (`RCPT TO`) ; la
 * copie déposée dans « Envoyés », elle, garde l'en-tête — c'est ce que font les clients
 * de messagerie, pour que l'expéditeur sache à qui il a écrit.
 */
export function sansCci(raw: string): string {
  const fin = raw.search(/\r?\n\r?\n/)
  if (fin < 0) return raw
  const entetes = raw.slice(0, fin)
  // Un en-tête replié continue sur les lignes qui commencent par une espace ou une tabulation.
  const nettoyes = entetes.replace(/^Bcc:.*(?:\r?\n[ \t].*)*(?:\r?\n|$)/gim, '').replace(/\r?\n$/, '')
  return nettoyes + raw.slice(fin)
}
