/**
 * Client IMAP4rev1 MINIMAL — ce que la synchro et les gestes exigent, rien de plus.
 *
 * Pas d'IDLE, pas de compression, pas de commandes en vol simultanées : chaque
 * commande attend sa réponse taguée, les réponses non taguées (`* …`) sont
 * collectées au passage. C'est lent et c'est voulu — une passe de synchronisation
 * a 20 s de budget, pas 200 ms, et un client concurrent se déboguerait à l'aveugle
 * contre un serveur qu'on ne contrôle pas.
 *
 * ⚠ QUATRE ÉCARTS AU PLAN, tous nés de ce que la sonde T3.1 a mesuré sur les
 * serveurs RÉELS d'Infomaniak et de Bluewin. Ils sont signalés un par un à
 * l'endroit où ils vivent ; le plus important est celui de `uidMove`, qui
 * évitait une perte de données.
 */
import { LineReader, type Duplex } from './duplex.ts'

export interface ImapFolder { name: string; attributes: string[] }
export interface ImapSelect { exists: number; uidValidity: number; uidNext: number }
export interface ImapFlags { uid: number; flags: string[] }

const quote = (s: string) => `"${s.replace(/[\\"]/g, (c) => '\\' + c)}"`

const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Date au format IMAP (`5-Sep-2026`), telle que `SEARCH SINCE` l'attend. */
export function imapDate(d: Date): string {
  return `${d.getUTCDate()}-${MOIS[d.getUTCMonth()]}-${d.getUTCFullYear()}`
}

/** Extrait `[CAPABILITY a b c]` d'une ligne, s'il y est. */
function capsDe(ligne: string): string[] | null {
  const m = ligne.match(/\[CAPABILITY ([^\]]*)\]/i)
  return m ? m[1].trim().split(/\s+/).filter(Boolean) : null
}

export class ImapClient {
  private reader: LineReader
  private n = 0
  /** Capacités annoncées, en MAJUSCULES. Vide tant que rien n'a été annoncé. */
  private caps: string[] = []

  constructor(private conn: Duplex) { this.reader = new LineReader(conn) }

  /** Le serveur annonce-t-il cette extension ? Comparaison insensible à la casse. */
  has(cap: string): boolean { return this.caps.includes(cap.toUpperCase()) }
  /** Les capacités connues à cet instant — pour journaliser ce qu'on a vu. */
  capabilities(): string[] { return [...this.caps] }

  private noteCaps(ligne: string): void {
    const c = capsDe(ligne)
    if (c) this.caps = c.map((x) => x.toUpperCase())
  }

  async connect(): Promise<void> {
    const greeting = await this.reader.line()
    if (!greeting || !greeting.startsWith('* OK')) throw new Error(`imap: bad greeting ${greeting ?? '(eof)'}`)
    // ⚠ ÉCART 1 — la bannière PORTE souvent les capacités, et c'est gratuit.
    // Mesuré le 05.09.2026 : Bluewin ouvre par `* OK [CAPABILITY IMAP4rev1 SASL-IR
    // … AUTH=PLAIN AUTH=OAUTHBEARER AUTH=XOAUTH2] Ser…`, Infomaniak par un simple
    // `* OK IMAP4 ready`. Le plan ne lisait ni l'un ni l'autre et appelait
    // `CAPABILITY` en commande séparée — un aller-retour de plus par passe.
    this.noteCaps(greeting)
  }

  /** Envoie une commande, rend les lignes non taguées, les littéraux et la ligne taguée. Lève sur NO/BAD. */
  private async cmd(command: string): Promise<{ untagged: string[]; literals: Uint8Array[]; tagged: string }> {
    const tag = `a${++this.n}`
    await this.conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`))
    const untagged: string[] = []
    const literals: Uint8Array[] = []
    for (;;) {
      let line = await this.reader.line()
      if (line === null) throw new Error('imap: connection closed')
      // Littéral en fin de ligne : n octets bruts, puis la suite de la ligne.
      let lit = line.match(/\{(\d+)\}$/)
      while (lit) {
        literals.push(await this.reader.bytes(Number(lit[1])))
        const rest = await this.reader.line()
        line = `${line.slice(0, -lit[0].length)}<literal ${literals.length - 1}>${rest ?? ''}`
        lit = line.match(/\{(\d+)\}$/)
      }
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new Error(`imap: ${line}`)
        return { untagged, literals, tagged: line }
      }
      if (line.startsWith('* CAPABILITY')) {
        this.caps = line.replace('* CAPABILITY', '').trim().split(/\s+/).filter(Boolean).map((c) => c.toUpperCase())
      }
      untagged.push(line)
    }
  }

  async login(user: string, password: string): Promise<void> {
    const { tagged } = await this.cmd(`LOGIN ${quote(user)} ${quote(password)}`)
    // ⚠ ÉCART 2 — LES CAPACITÉS D'AVANT LOGIN NE SONT PAS CELLES D'APRÈS, et le
    // serveur le DIT : mesuré le 05.09.2026, Bluewin termine sa réponse par
    // « post-login capabilities have more ». Or `uidMove` et `append` décident
    // sur `MOVE` et `UIDPLUS` — décider sur une liste pré-login, c'est prendre
    // le repli dégradé alors que le serveur offrait mieux. La réponse au LOGIN
    // porte souvent la liste à jour ; sinon on la redemande.
    this.noteCaps(tagged)
    if (!this.caps.length || (!this.has('UIDPLUS') && !this.has('MOVE'))) {
      try { await this.refreshCapabilities() } catch { /* le serveur a le droit de refuser */ }
    }
  }

  /** Redemande les capacités (après LOGIN, quand la bannière ne les portait pas). */
  async refreshCapabilities(): Promise<string[]> {
    const { untagged, tagged } = await this.cmd('CAPABILITY')
    const l = untagged.find((u) => u.startsWith('* CAPABILITY'))
    if (l) this.caps = l.replace('* CAPABILITY', '').trim().split(/\s+/).filter(Boolean).map((c) => c.toUpperCase())
    else this.noteCaps(tagged)
    return this.capabilities()
  }

  async list(): Promise<ImapFolder[]> {
    const { untagged } = await this.cmd('LIST "" "*"')
    return untagged.filter((l) => l.startsWith('* LIST ')).map((l) => {
      const m = l.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (?:"([^"]*)"|(\S+))$/)
      return { name: m ? (m[2] ?? m[3]) : '', attributes: m && m[1] ? m[1].split(' ') : [] }
    }).filter((f) => f.name)
  }

  async select(folder: string): Promise<ImapSelect> {
    const { untagged } = await this.cmd(`SELECT ${quote(folder)}`)
    const num = (re: RegExp) => {
      const l = untagged.map((u) => u.match(re)).find(Boolean)
      return l ? Number(l[1]) : 0
    }
    return { exists: num(/^\* (\d+) EXISTS/), uidValidity: num(/\[UIDVALIDITY (\d+)\]/), uidNext: num(/\[UIDNEXT (\d+)\]/) }
  }

  async uidSearchSince(since: Date): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH SINCE ${imapDate(since)}`)
    return lireSearch(untagged)
  }

  async uidSearchRange(fromUid: number): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH UID ${fromUid}:*`)
    return lireSearch(untagged)
  }

  async uidFetchFlags(set: string): Promise<ImapFlags[]> {
    const { untagged } = await this.cmd(`UID FETCH ${set} (FLAGS)`)
    return untagged.map((l) => l.match(/UID (\d+) FLAGS \(([^)]*)\)/)).filter(Boolean)
      .map((m) => ({ uid: Number(m![1]), flags: m![2].split(' ').filter(Boolean) }))
  }

  async uidFetchRaw(uid: number): Promise<Uint8Array> {
    const { literals } = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[])`)
    if (!literals[0]) throw new Error(`imap: no body for uid ${uid}`)
    return literals[0]
  }

  async uidStore(uid: number, flags: string[], mode: 'add' | 'remove'): Promise<void> {
    await this.cmd(`UID STORE ${uid} ${mode === 'add' ? '+' : '-'}FLAGS.SILENT (${flags.join(' ')})`)
  }

  /**
   * Déplace un message. Trois voies, de la meilleure à la moins bonne.
   *
   * ⛔ ÉCART 3, ET C'EST UNE PERTE DE DONNÉES QUE LE PLAN PRESCRIVAIT. Le repli
   * qu'il donnait était `UID COPY` + `\Deleted` + **`EXPUNGE`**. Or `EXPUNGE`
   * SANS ARGUMENT supprime définitivement TOUS les messages du dossier portant
   * `\Deleted` — pas seulement le nôtre. Beaucoup de clients (Thunderbird et
   * Apple Mail par défaut, entre autres) marquent `\Deleted` sans expurger et
   * laissent l'utilisateur vider la corbeille quand il veut : archiver UN fil
   * depuis le CRM aurait alors détruit tout ce que l'agent avait supprimé sans
   * confirmer, dans sa vraie boîte, sans un mot. Pour un produit dont la thèse
   * est la conformité, c'est le pire mode d'échec possible.
   *
   * `UID EXPUNGE` (extension UIDPLUS) ne vise QUE les UID donnés. Quand ni
   * `MOVE` ni `UIDPLUS` ne sont annoncés — ce qui pourrait être le cas de
   * Bluewin, dont la bannière pré-login n'annonce pas UIDPLUS — on copie et on
   * marque `\Deleted`, et on N'EXPURGE PAS. Le message reste dans le dossier
   * source, masqué par la plupart des clients, et disparaîtra au prochain
   * `EXPUNGE` que l'utilisateur déclenchera lui-même. Un doublon visible vaut
   * mieux qu'une suppression qu'il n'a pas demandée.
   */
  async uidMove(uid: number, folder: string): Promise<'move' | 'copy+uid-expunge' | 'copy-only'> {
    if (this.has('MOVE')) {
      await this.cmd(`UID MOVE ${uid} ${quote(folder)}`)
      return 'move'
    }
    await this.cmd(`UID COPY ${uid} ${quote(folder)}`)
    await this.uidStore(uid, ['\\Deleted'], 'add')
    if (this.has('UIDPLUS')) {
      await this.cmd(`UID EXPUNGE ${uid}`)
      return 'copy+uid-expunge'
    }
    return 'copy-only'
  }

  /**
   * Dépose un message (la copie dans « Envoyés » après un envoi SMTP).
   *
   * ⚠ ÉCART 4 — rend l'UID attribué quand le serveur l'annonce. Le plan rendait
   * `void` et jetait le `[APPENDUID <uidvalidity> <uid>]` de la ligne taguée,
   * alors que l'architecture du lot en a besoin pour rattacher la copie au fil
   * sans relire tout le dossier. `null` quand le serveur n'annonce pas UIDPLUS :
   * l'appelant doit alors savoir qu'il ne saura pas, plutôt que de croire à un 0.
   */
  async append(folder: string, raw: Uint8Array, flags = ['\\Seen']): Promise<number | null> {
    const tag = `a${++this.n}`
    await this.conn.write(new TextEncoder().encode(`${tag} APPEND ${quote(folder)} (${flags.join(' ')}) {${raw.length}}\r\n`))
    const cont = await this.reader.line()
    if (!cont || !cont.startsWith('+')) throw new Error(`imap: append refused ${cont ?? '(eof)'}`)
    await this.conn.write(raw)
    await this.conn.write(new TextEncoder().encode('\r\n'))
    for (;;) {
      const line = await this.reader.line()
      if (line === null) throw new Error('imap: connection closed')
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new Error(`imap: ${line}`)
        const m = line.match(/\[APPENDUID (\d+) (\d+)\]/i)
        return m ? Number(m[2]) : null
      }
    }
  }

  async logout(): Promise<void> {
    try { await this.cmd('LOGOUT') } catch { /* le serveur ferme parfois avant le OK */ }
    this.conn.close()
  }
}

/**
 * ⚠ Les UID d'un `SEARCH` peuvent arriver sur PLUSIEURS lignes `* SEARCH` — le
 * plan n'en lisait que la première (`.find`). Une boîte à quelques milliers de
 * messages en rend couramment plusieurs, et la moitié des UID serait perdue en
 * silence : les messages manquants ne seraient jamais ingérés, sans erreur.
 */
function lireSearch(untagged: string[]): number[] {
  return untagged
    .filter((u) => u.startsWith('* SEARCH'))
    .flatMap((u) => u.replace('* SEARCH', '').trim().split(/\s+/))
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n))
}
