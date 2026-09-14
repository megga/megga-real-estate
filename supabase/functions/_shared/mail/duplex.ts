/**
 * Une connexion en octets, et de quoi la lire ligne par ligne.
 *
 * ⛔ POURQUOI CETTE ABSTRACTION EXISTE. Les clients IMAP et SMTP tournent sous
 * Deno (edge) mais leurs tests tournent sous Node (`vitest`) — la porte de ce
 * dépôt est là, pas ailleurs. Un client qui appellerait `Deno.connectTls` dans
 * son corps ne pourrait être exercé par RIEN : `deno check` type-vérifie mais
 * n'exécute pas, et vitest ne connaît pas `Deno`. En passant par un `Duplex`,
 * le protocole s'éprouve contre une connexion SCRIPTÉE, et seule l'ouverture de
 * la socket reste non testée — c'est ce que la sonde T3.1 a mesuré séparément.
 */

export interface Duplex {
  /** Le prochain paquet d'octets, ou `null` à la fin du flux. */
  read(): Promise<Uint8Array | null>
  write(bytes: Uint8Array): Promise<void>
  close(): void
  /**
   * Monte une connexion EN CLAIR vers TLS, sur la même socket (STARTTLS). Absente d'une
   * connexion déjà chiffrée : sa présence DIT que le canal est en clair — c'est ce que
   * les clients lisent pour refuser d'y envoyer un mot de passe.
   */
  startTls?(): Promise<Duplex>
}

export interface DialOptions { connectTimeoutMs?: number; ioTimeoutMs?: number }

/**
 * ⛔ SANS DÉLAI, UN SERVEUR MUET TIENT L'EDGE JUSQU'À SA MORT. `read()` attend un paquet
 * qui peut ne jamais venir (un pare-feu qui avale, un serveur qui oublie de répondre) :
 * la passe de synchro ne rendait alors ni succès ni échec, son bail de compte courait
 * jusqu'au bout, et l'assistant « Ajouter une boîte » tournait sans fin. Mesuré en
 * T3.1 : un port filtré ne répond qu'au bout de 8 s — d'où 10 s pour ouvrir.
 */
const CONNECT_TIMEOUT_MS = 10_000
const IO_TIMEOUT_MS = 20_000

type DenoConn = { read(b: Uint8Array): Promise<number | null>; write(b: Uint8Array): Promise<number>; close(): void }
interface DenoNet {
  connect(o: { hostname: string; port: number }): Promise<DenoConn>
  connectTls(o: { hostname: string; port: number }): Promise<DenoConn>
  startTls(conn: DenoConn, o: { hostname: string }): Promise<DenoConn>
}
/**
 * ⚠ `Deno` est atteint par `globalThis` et JAMAIS au corps du module : ce fichier est
 * importé par les specs, qui tournent sous Node. Une référence directe le ferait échouer
 * au chargement.
 */
const deno = () => (globalThis as unknown as { Deno: DenoNet }).Deno

/** `p`, bornée à `ms` : au-delà, `auDela` (fermer la socket) puis l'erreur `code`. */
function borne<T>(p: Promise<T>, ms: number, code: string, auDela?: () => void): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => { auDela?.(); rejeter(new Error(code)) }, ms)
  })
  return Promise.race([p, delai]).finally(() => clearTimeout(minuteur))
}

/** Ouvre, borné — et referme une socket qui aboutirait APRÈS le délai, au lieu de la laisser fuir. */
async function ouvrir(dial: () => Promise<DenoConn>, ms: number): Promise<DenoConn> {
  const p = dial()
  try { return await borne(p, ms, 'timeout_connect') }
  catch (e) { p.then((c) => { try { c.close() } catch { /* déjà fermée */ } }, () => {}); throw e }
}

function enDuplex(conn: DenoConn, hostname: string, o: Required<DialOptions>, clair: boolean): Duplex {
  const fermer = () => { try { conn.close() } catch { /* déjà fermée */ } }
  const d: Duplex = {
    async read() {
      const buf = new Uint8Array(16 * 1024)
      const n = await borne(conn.read(buf), o.ioTimeoutMs, 'timeout_read', fermer)
      return n === null ? null : buf.subarray(0, n)
    },
    async write(bytes) {
      // ⚠ `write` peut n'écrire qu'une PARTIE du tampon. Sans cette boucle, un
      // message volumineux (un APPEND de pièce jointe) partirait tronqué, et le
      // serveur attendrait des octets qui ne viendraient jamais.
      let off = 0
      while (off < bytes.length) off += await borne(conn.write(bytes.subarray(off)), o.ioTimeoutMs, 'timeout_write', fermer)
    },
    close: fermer,
  }
  // La socket en clair est CONSOMMÉE par la montée : seul le duplex rendu reste valable.
  if (clair) d.startTls = async () => enDuplex(await borne(deno().startTls(conn, { hostname }), o.connectTimeoutMs, 'timeout_tls', fermer), hostname, o, false)
  return d
}

const reglages = (opts: DialOptions): Required<DialOptions> => ({
  connectTimeoutMs: opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS,
  ioTimeoutMs: opts.ioTimeoutMs ?? IO_TIMEOUT_MS,
})

/** Une connexion chiffrée d'emblée (IMAP 993, SMTP 465). */
export async function denoTlsDuplex(hostname: string, port: number, opts: DialOptions = {}): Promise<Duplex> {
  const o = reglages(opts)
  return enDuplex(await ouvrir(() => deno().connectTls({ hostname, port }), o.connectTimeoutMs), hostname, o, false)
}

/**
 * Une connexion EN CLAIR, à monter en TLS par `startTls()` (SMTP 587, IMAP 143).
 * ⚠ Mesuré en T3.1 : le port 587 est OUVERT depuis l'edge (bannière en 60 ms), le 25
 * est filtré. Ce qui ne l'est pas encore : la montée elle-même depuis l'edge — un échec
 * y remonte à l'ajout de la boîte, avec le motif, jamais en silence.
 */
export async function denoTcpDuplex(hostname: string, port: number, opts: DialOptions = {}): Promise<Duplex> {
  const o = reglages(opts)
  return enDuplex(await ouvrir(() => deno().connect({ hostname, port }), o.connectTimeoutMs), hostname, o, true)
}

/**
 * Lecteur de lignes CRLF, avec les littéraux IMAP (`{n}\r\n` suivi de n octets
 * bruts qui peuvent contenir n'importe quoi, CRLF compris).
 *
 * ⚠ C'est pour les littéraux que ce lecteur ne peut pas être un simple
 * `split('\r\n')` : le corps d'un message contient des CRLF, et seul le compteur
 * annoncé dit où il s'arrête.
 */
export class LineReader {
  private buf = new Uint8Array(0)
  private eof = false
  constructor(private conn: Duplex) {}

  private async fill(): Promise<boolean> {
    if (this.eof) return false
    const chunk = await this.conn.read()
    if (chunk === null) { this.eof = true; return false }
    const next = new Uint8Array(this.buf.length + chunk.length)
    next.set(this.buf); next.set(chunk, this.buf.length)
    this.buf = next
    return true
  }

  /** Une ligne sans son CRLF, ou `null` à la fin du flux. */
  async line(): Promise<string | null> {
    for (;;) {
      const i = indexOfCrlf(this.buf)
      if (i >= 0) {
        const s = new TextDecoder().decode(this.buf.subarray(0, i))
        this.buf = this.buf.subarray(i + 2)
        return s
      }
      if (!(await this.fill())) {
        if (this.buf.length === 0) return null
        // Flux coupé sans CRLF final : on rend ce qui reste plutôt que de le perdre.
        const s = new TextDecoder().decode(this.buf)
        this.buf = new Uint8Array(0)
        return s
      }
    }
  }

  /**
   * Exactement n octets — un littéral.
   *
   * ⚠ LÈVE si le flux se coupe avant. Le plan rendait ici un tampon COURT en
   * silence : un message tronqué serait alors ingéré comme un message complet,
   * puis marqué lu et jamais relu. Une connexion qui casse au milieu d'un corps
   * doit faire échouer la passe, pas produire un demi-message.
   */
  async bytes(n: number): Promise<Uint8Array> {
    while (this.buf.length < n) {
      if (!(await this.fill())) {
        throw new Error(`imap: flux coupé dans un littéral (${this.buf.length}/${n} octets)`)
      }
    }
    const out = this.buf.subarray(0, n)
    this.buf = this.buf.subarray(n)
    return out
  }
}

function indexOfCrlf(b: Uint8Array): number {
  for (let i = 0; i + 1 < b.length; i++) if (b[i] === 13 && b[i + 1] === 10) return i
  return -1
}
