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
}

/**
 * L'implémentation Deno. ⚠ `Deno` est atteint par `globalThis` et JAMAIS au
 * corps du module : ce fichier est importé par les specs, qui tournent sous
 * Node. Une référence directe le ferait échouer au chargement.
 */
export async function denoTlsDuplex(hostname: string, port: number): Promise<Duplex> {
  const D = (globalThis as unknown as {
    Deno: {
      connectTls(o: { hostname: string; port: number }): Promise<{
        read(b: Uint8Array): Promise<number | null>
        write(b: Uint8Array): Promise<number>
        close(): void
      }>
    }
  }).Deno
  const conn = await D.connectTls({ hostname, port })
  return {
    async read() {
      const buf = new Uint8Array(16 * 1024)
      const n = await conn.read(buf)
      return n === null ? null : buf.subarray(0, n)
    },
    async write(bytes) {
      // ⚠ `write` peut n'écrire qu'une PARTIE du tampon. Sans cette boucle, un
      // message volumineux (un APPEND de pièce jointe) partirait tronqué, et le
      // serveur attendrait des octets qui ne viendraient jamais.
      let off = 0
      while (off < bytes.length) off += await conn.write(bytes.subarray(off))
    },
    close() { try { conn.close() } catch { /* déjà fermée */ } },
  }
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
