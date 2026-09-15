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

export interface DialOptions {
  connectTimeoutMs?: number
  ioTimeoutMs?: number
  /**
   * Échéance ABSOLUE de toute la session (ms depuis l'époque). ⚠ Le délai de 20 s vaut PAR
   * lecture : un serveur qui distille un octet toutes les 19 s tenait la passe jusqu'à la
   * limite d'horloge de l'edge. Passée l'échéance, chaque lecture ou écriture lève.
   */
  deadline?: number
  /**
   * L'adresse IP, déjà VÉRIFIÉE publique, à laquelle se connecter — le nom d'hôte ne sert
   * plus qu'au certificat (SNI). Sans elle, le nom serait résolu une seconde fois à la
   * connexion, et un DNS changé entre-temps mènerait ailleurs.
   */
  address?: string
}

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

type Reglages = Required<Pick<DialOptions, 'connectTimeoutMs' | 'ioTimeoutMs'>> & Pick<DialOptions, 'deadline'>

function enDuplex(conn: DenoConn, hostname: string, o: Reglages, clair: boolean): Duplex {
  const fermer = () => { try { conn.close() } catch { /* déjà fermée */ } }
  /** Le délai d'une lecture ou d'une écriture : 20 s, et jamais au-delà de l'échéance de session. */
  const delai = (): number => {
    const reste = o.deadline === undefined ? Infinity : o.deadline - Date.now()
    if (reste <= 0) { fermer(); throw new Error('timeout_session') }
    return Math.min(o.ioTimeoutMs, reste)
  }
  const d: Duplex = {
    async read() {
      const buf = new Uint8Array(16 * 1024)
      const n = await borne(conn.read(buf), delai(), 'timeout_read', fermer)
      return n === null ? null : buf.subarray(0, n)
    },
    async write(bytes) {
      // ⚠ `write` peut n'écrire qu'une PARTIE du tampon. Sans cette boucle, un
      // message volumineux (un APPEND de pièce jointe) partirait tronqué, et le
      // serveur attendrait des octets qui ne viendraient jamais.
      let off = 0
      while (off < bytes.length) off += await borne(conn.write(bytes.subarray(off)), delai(), 'timeout_write', fermer)
    },
    close: fermer,
  }
  // La socket en clair est CONSOMMÉE par la montée : seul le duplex rendu reste valable.
  if (clair) d.startTls = async () => enDuplex(await borne(deno().startTls(conn, { hostname }), o.connectTimeoutMs, 'timeout_tls', fermer), hostname, o, false)
  return d
}

const reglages = (opts: DialOptions): Reglages => ({
  connectTimeoutMs: opts.connectTimeoutMs ?? CONNECT_TIMEOUT_MS,
  ioTimeoutMs: opts.ioTimeoutMs ?? IO_TIMEOUT_MS,
  deadline: opts.deadline,
})

/**
 * Une connexion chiffrée d'emblée (IMAP 993, SMTP 465). Avec `address`, la socket s'ouvre sur
 * cette IP et le TLS se monte ensuite pour `hostname` : le certificat est vérifié pour le NOM
 * saisi, sans que ce nom soit résolu une seconde fois.
 */
export async function denoTlsDuplex(hostname: string, port: number, opts: DialOptions = {}): Promise<Duplex> {
  const o = reglages(opts)
  const ip = opts.address
  const dial = ip
    ? async () => {
      const tcp = await deno().connect({ hostname: ip, port })
      try { return await deno().startTls(tcp, { hostname }) } catch (e) { try { tcp.close() } catch { /* déjà fermée */ } throw e }
    }
    : () => deno().connectTls({ hostname, port })
  return enDuplex(await ouvrir(dial, o.connectTimeoutMs), hostname, o, false)
}

/**
 * Une connexion EN CLAIR, à monter en TLS par `startTls()` (SMTP 587, IMAP 143).
 * ⚠ Mesuré en T3.1 : le port 587 est OUVERT depuis l'edge (bannière en 60 ms), le 25
 * est filtré. Ce qui ne l'est pas encore : la montée elle-même depuis l'edge — un échec
 * y remonte à l'ajout de la boîte, avec le motif, jamais en silence.
 */
export async function denoTcpDuplex(hostname: string, port: number, opts: DialOptions = {}): Promise<Duplex> {
  const o = reglages(opts)
  return enDuplex(await ouvrir(() => deno().connect({ hostname: opts.address ?? hostname, port }), o.connectTimeoutMs), hostname, o, true)
}

/**
 * Au-delà, ce n'est plus une ligne de réponse mais un déversement : la plus longue que ces
 * clients attendent est un `* SEARCH` de boîte très fournie (quelques centaines de Ko).
 */
export const LIGNE_MAX = 8 * 1024 * 1024
/**
 * Au-delà, ce n'est plus un message : le plus gros littéral légitime est un courrier entier
 * relu pour une pièce jointe (25 Mo de pièce, ~34 Mo encodés en base64) et sa marge.
 */
export const LITTERAL_MAX = 48 * 1024 * 1024

/**
 * Lecteur de lignes CRLF, avec les littéraux IMAP (`{n}\r\n` suivi de n octets
 * bruts qui peuvent contenir n'importe quoi, CRLF compris).
 *
 * ⚠ C'est pour les littéraux que ce lecteur ne peut pas être un simple
 * `split('\r\n')` : le corps d'un message contient des CRLF, et seul le compteur
 * annoncé dit où il s'arrête.
 *
 * ⛔ BORNÉ ET LINÉAIRE, parce que c'est le SERVEUR qui annonce les tailles — et l'agent peut
 * brancher le sien. Le lecteur d'origine n'avait aucun plafond (`{2000000000}` était lu
 * jusqu'à épuiser la mémoire de l'edge) et recopiait TOUT son tampon à chaque paquet : lire
 * 8 Mo coûtait 2 Go de recopies, jusqu'à 1,7 s de CPU sur les 2 s d'une requête. Le worker
 * tué ne rendait rien, `next_sync_at` n'était jamais écrit, et ce compte revenait en tête de
 * chaque balayage : plus aucune boîte du produit ne se synchronisait. Désormais un littéral
 * se lit dans un tampon alloué une fois, chaque octet reçu n'est recopié qu'un nombre borné
 * de fois, et ce qui dépasse les plafonds lève.
 */
export class LineReader {
  private buf = new Uint8Array(16 * 1024)
  private debut = 0
  private fin = 0
  /** Octets déjà examinés sans CRLF depuis `debut` : la recherche reprend là, pas au début. */
  private vus = 0
  private eof = false
  constructor(private conn: Duplex, private limites: { ligne: number; litteral: number } = { ligne: LIGNE_MAX, litteral: LITTERAL_MAX }) {}

  /** Ajoute un paquet, en compactant ou en doublant le tampon — jamais une recopie par paquet. */
  private ajouter(chunk: Uint8Array): void {
    if (this.fin + chunk.length > this.buf.length) {
      const utile = this.fin - this.debut
      if (utile + chunk.length <= this.buf.length) {
        this.buf.copyWithin(0, this.debut, this.fin)
      } else {
        const neuf = new Uint8Array(Math.max(this.buf.length * 2, utile + chunk.length))
        neuf.set(this.buf.subarray(this.debut, this.fin))
        this.buf = neuf
      }
      this.debut = 0
      this.fin = utile
    }
    this.buf.set(chunk, this.fin)
    this.fin += chunk.length
  }

  private async fill(): Promise<boolean> {
    if (this.eof) return false
    const chunk = await this.conn.read()
    if (chunk === null) { this.eof = true; return false }
    this.ajouter(chunk)
    return true
  }

  /** Une ligne sans son CRLF, ou `null` à la fin du flux. */
  async line(): Promise<string | null> {
    for (;;) {
      // Un octet en arrière : le CR du paquet précédent peut attendre son LF dans celui-ci.
      const i = indexOfCrlf(this.buf, this.debut + Math.max(0, this.vus - 1), this.fin)
      if (i >= 0) {
        const s = new TextDecoder().decode(this.buf.subarray(this.debut, i))
        this.debut = i + 2
        this.vus = 0
        return s
      }
      this.vus = this.fin - this.debut
      if (this.vus > this.limites.ligne) throw new Error(`imap: ligne de plus de ${this.limites.ligne} octets refusée`)
      if (!(await this.fill())) {
        if (this.fin === this.debut) return null
        // Flux coupé sans CRLF final : on rend ce qui reste plutôt que de le perdre.
        const s = new TextDecoder().decode(this.buf.subarray(this.debut, this.fin))
        this.debut = this.fin
        this.vus = 0
        return s
      }
    }
  }

  /**
   * Exactement n octets — un littéral. `max` resserre le plafond pour une commande dont on
   * connaît la taille attendue (le message que la synchro a pesé avant de le télécharger).
   *
   * ⚠ LÈVE si le flux se coupe avant. Le plan rendait ici un tampon COURT en
   * silence : un message tronqué serait alors ingéré comme un message complet,
   * puis marqué lu et jamais relu. Une connexion qui casse au milieu d'un corps
   * doit faire échouer la passe, pas produire un demi-message.
   */
  async bytes(n: number, max = this.limites.litteral): Promise<Uint8Array> {
    if (!Number.isSafeInteger(n) || n < 0 || n > Math.min(max, this.limites.litteral)) {
      throw new Error(`imap: littéral de ${n} octets refusé (plafond ${Math.min(max, this.limites.litteral)})`)
    }
    const out = new Uint8Array(n)
    const deja = Math.min(n, this.fin - this.debut)
    out.set(this.buf.subarray(this.debut, this.debut + deja))
    this.debut += deja
    this.vus = 0
    let rempli = deja
    while (rempli < n) {
      const chunk = this.eof ? null : await this.conn.read()
      if (chunk === null) {
        this.eof = true
        throw new Error(`imap: flux coupé dans un littéral (${rempli}/${n} octets)`)
      }
      const pris = Math.min(n - rempli, chunk.length)
      out.set(chunk.subarray(0, pris), rempli)
      rempli += pris
      if (pris < chunk.length) this.ajouter(chunk.subarray(pris))
    }
    return out
  }
}

function indexOfCrlf(b: Uint8Array, de: number, a: number): number {
  for (let i = de; i + 1 < a; i++) if (b[i] === 13 && b[i + 1] === 10) return i
  return -1
}
