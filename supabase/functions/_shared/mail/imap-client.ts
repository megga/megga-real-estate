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
/** Ce qu'on lit d'un message AVANT de le télécharger : ses drapeaux, sa taille, sa date d'arrivée. */
export interface ImapMeta extends ImapFlags { size: number; internalDate: string | null }
/** Où un message déplacé a atterri — `null` quand le serveur ne l'annonce pas (sans UIDPLUS). */
export interface ImapMoved { voie: 'move' | 'copy+uid-expunge' | 'copy-only'; uid: number | null; uidValidity: number | null }

/** Une réponse NO/BAD à une commande — la ligne du serveur, telle quelle. */
export class ImapCommandError extends Error {
  constructor(readonly reponse: string) { super(`imap: ${reponse}`) }
}
/**
 * Le serveur a REFUSÉ les identifiants. Distingué des autres refus parce que la suite
 * diffère du tout au tout : un mot de passe changé met la boîte en « autorisation à
 * renouveler », une panne passagère se réessaie.
 */
export class ImapAuthError extends Error {}

/**
 * Le serveur a refusé la connexion pour une raison qui PASSE : trop de connexions ouvertes,
 * service indisponible, quota de connexions atteint. Ce n'est pas le mot de passe — la boîte
 * se réessaie plus tard, elle n'attend pas qu'on la reconnecte.
 */
export class ImapRefusTemporaire extends Error {}

/**
 * Un NO au LOGIN qui ne dit rien des identifiants (RFC 5530) : `UNAVAILABLE` (un service en
 * panne), `INUSE`, `LIMIT` (plafond de connexions), `SERVERBUG` — ou l'un de ces textes que
 * les serveurs mettent derrière un `[ALERT]` (« Too many simultaneous connections »).
 *
 * ⛔ TOUT NO ÉTAIT PRIS POUR UN MOT DE PASSE REFUSÉ (revue du 15.09.2026) : un `NO [INUSE]`
 * passager, ou un « too many connections » quand l'agent a son téléphone et son webmail
 * ouverts, mettait la boîte en « autorisation à renouveler » dès le premier refus — la
 * synchro s'arrêtait jusqu'à ce que l'agent retape un mot de passe qui était bon.
 */
const REFUS_TEMPORAIRE = /\[(?:UNAVAILABLE|INUSE|LIMIT|SERVERBUG)\]|too many|try again|temporar|unavailable|later|overload|busy|throttl/i
export const refusTemporaire = (reponse: string): boolean => REFUS_TEMPORAIRE.test(reponse) && !/\[(?:AUTHENTICATIONFAILED|AUTHORIZATIONFAILED|EXPIRED)\]/i.test(reponse)

/**
 * Un argument qu'aucune commande IMAP ne peut porter — refusé AVANT d'écrire quoi que ce
 * soit sur la connexion.
 */
export class ImapArgumentError extends Error {}

/** CR, LF ou NUL : ce qui ferait d'une commande IMAP plusieurs lignes, donc plusieurs commandes. */
const HORS_LIGNE = /[\r\n\0]/

/**
 * Une chaîne entre guillemets (RFC 3501 §9 : `\` et `"` s'y échappent, CR et LF n'y ont PAS
 * de place). ⛔ Elle n'échappait que les deux premiers : un Message-ID reçu à plusieurs
 * lignes, cité dans `UID SEARCH HEADER Message-ID "…"`, faisait exécuter ses lignes suivantes
 * dans la vraie boîte de l'agent (`UID MOVE 1:* Trash`, `DELETE Trash`…).
 */
const quote = (s: string) => {
  if (HORS_LIGNE.test(s)) throw new ImapArgumentError('imap: caractère de contrôle dans une chaîne')
  return `"${s.replace(/[\\"]/g, (c) => '\\' + c)}"`
}

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

/** base64 d'une chaîne UTF-8, sous Node comme sous Deno. */
function base64Utf8(s: string): string {
  let bin = ''
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Lit les éléments d'une réponse FETCH, dans N'IMPORTE QUEL ordre.
 *
 * ⚠ La RFC 3501 ne fixe pas l'ordre des éléments : `(UID 7 FLAGS (\Seen))` et
 * `(FLAGS (\Seen) UID 7)` sont la même réponse. Le motif d'origine exigeait l'UID
 * AVANT les drapeaux — un serveur qui répond dans l'autre ordre rendait zéro message,
 * sans erreur, et ses drapeaux ne se synchronisaient jamais.
 */
function lireFetch(ligne: string): { uid: number | null; flags: string[] | null; size: number | null; internalDate: string | null } {
  const uid = ligne.match(/\bUID (\d+)/)
  const flags = ligne.match(/\bFLAGS \(([^)]*)\)/)
  const size = ligne.match(/\bRFC822\.SIZE (\d+)/)
  const date = ligne.match(/\bINTERNALDATE "([^"]+)"/)
  return {
    uid: uid ? Number(uid[1]) : null,
    flags: flags ? flags[1].split(' ').filter(Boolean) : null,
    size: size ? Number(size[1]) : null,
    internalDate: date ? date[1] : null,
  }
}

/** `[COPYUID <uidvalidity> <source> <destination>]`, sur une ligne taguée ou non. */
function lireCopyUid(lignes: string[]): { uid: number; uidValidity: number } | null {
  for (const l of lignes) {
    const m = l.match(/\[COPYUID (\d+) \S+ (\d+)\]/i)
    if (m) return { uidValidity: Number(m[1]), uid: Number(m[2]) }
  }
  return null
}

/**
 * Découpe une ligne `* LIST` : `(attributs) délimiteur nom`.
 *
 * ⚠ Le nom peut être un atome, une chaîne entre guillemets (avec `\"` et `\\` échappés),
 * ou un LITTÉRAL — que `cmd()` a déjà remplacé par `<literal n>`. Le motif d'origine ne
 * connaissait que les deux premiers et gardait les antislashs : « Envoyés \"clients\" »
 * devenait un nom qu'aucun SELECT ne retrouvait.
 */
function lireList(ligne: string, literals: Uint8Array[]): ImapFolder | null {
  const m = ligne.match(/^\* LIST \(([^)]*)\) (?:"(?:[^"\\]|\\.)*"|NIL) (.+)$/i)
  if (!m) return null
  const brut = m[2].trim()
  let name: string
  const lit = brut.match(/^<literal (\d+)>$/)
  if (lit) name = new TextDecoder().decode(literals[Number(lit[1])] ?? new Uint8Array())
  else if (brut.startsWith('"')) name = brut.slice(1, -1).replace(/\\(.)/g, '$1')
  else name = brut
  return name ? { name, attributes: m[1] ? m[1].split(' ').filter(Boolean) : [] } : null
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
  /** La connexion est-elle encore en clair ? (Elle l'est tant qu'elle sait monter en TLS.) */
  enClair(): boolean { return typeof this.conn.startTls === 'function' }

  private noteCaps(ligne: string): void {
    const c = capsDe(ligne)
    if (c) this.caps = c.map((x) => x.toUpperCase())
  }

  async connect(): Promise<void> {
    const greeting = await this.reader.line()
    // ⛔ La bannière n'est JAMAIS recopiée dans l'erreur : elle remontait jusqu'à l'agent
    // (`last_error`, réponse de `sync_now`) — et, pour un hôte qui aurait mené ailleurs qu'à
    // un serveur de courrier, c'était la première ligne d'un service interne.
    if (!greeting || !greeting.startsWith('* OK')) throw new Error(greeting === null ? 'imap: connexion fermée avant la bannière' : 'imap: bannière inattendue')
    // ⚠ ÉCART 1 — la bannière PORTE souvent les capacités, et c'est gratuit.
    // Mesuré le 05.09.2026 : Bluewin ouvre par `* OK [CAPABILITY IMAP4rev1 SASL-IR
    // … AUTH=PLAIN AUTH=OAUTHBEARER AUTH=XOAUTH2] Ser…`, Infomaniak par un simple
    // `* OK IMAP4 ready`. Le plan ne lisait ni l'un ni l'autre et appelait
    // `CAPABILITY` en commande séparée — un aller-retour de plus par passe.
    this.noteCaps(greeting)
  }

  /**
   * Envoie une commande, rend les lignes non taguées, les littéraux et la ligne taguée. Lève sur
   * NO/BAD. `litteralMax` resserre le plafond des littéraux de CETTE réponse (cf. `LineReader`).
   */
  private async cmd(command: string, litteralMax?: number): Promise<{ untagged: string[]; literals: Uint8Array[]; tagged: string }> {
    // Seconde barrière, pour tout argument qui ne passerait pas par `quote()` : une commande
    // est UNE ligne, et rien de ce qu'elle porte ne doit pouvoir en ouvrir une autre.
    if (HORS_LIGNE.test(command)) throw new ImapArgumentError('imap: commande sur plusieurs lignes refusée')
    const tag = `a${++this.n}`
    await this.conn.write(new TextEncoder().encode(`${tag} ${command}\r\n`))
    return this.attendre(tag, litteralMax)
  }

  /** Lit jusqu'à la réponse taguée `tag`. */
  private async attendre(tag: string, litteralMax?: number): Promise<{ untagged: string[]; literals: Uint8Array[]; tagged: string }> {
    const untagged: string[] = []
    const literals: Uint8Array[] = []
    for (;;) {
      let line = await this.reader.line()
      if (line === null) throw new Error('imap: connection closed')
      // Littéral en fin de ligne : n octets bruts, puis la suite de la ligne.
      let lit = line.match(/\{(\d+)\}$/)
      while (lit) {
        literals.push(await this.reader.bytes(Number(lit[1]), litteralMax))
        const rest = await this.reader.line()
        line = `${line.slice(0, -lit[0].length)}<literal ${literals.length - 1}>${rest ?? ''}`
        lit = line.match(/\{(\d+)\}$/)
      }
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) throw new ImapCommandError(line)
        return { untagged, literals, tagged: line }
      }
      if (line.startsWith('* CAPABILITY')) {
        this.caps = line.replace('* CAPABILITY', '').trim().split(/\s+/).filter(Boolean).map((c) => c.toUpperCase())
      }
      untagged.push(line)
    }
  }

  /**
   * Monte la connexion en TLS (port 143). Les capacités d'avant la montée ne valent plus
   * rien (RFC 3501 §6.2.1) : elles sont oubliées, puis redemandées.
   */
  async starttls(): Promise<void> {
    if (!this.conn.startTls) throw new Error('imap: connexion déjà chiffrée')
    // ⚠ Une bannière muette n'est pas un refus : Infomaniak ouvre par un simple
    // `* OK IMAP4 ready` (mesuré en T3.1). On demande avant de conclure.
    if (!this.caps.length) await this.refreshCapabilities()
    if (!this.has('STARTTLS')) throw new Error('imap: starttls_unavailable')
    await this.cmd('STARTTLS')
    this.conn = await this.conn.startTls()
    this.reader = new LineReader(this.conn)
    this.caps = []
    await this.refreshCapabilities()
  }

  /**
   * S'authentifie. `LOGIN` d'IMAP4rev1 par défaut ; `AUTHENTICATE PLAIN` quand le serveur
   * refuse `LOGIN` (`LOGINDISABLED`) ou quand l'identifiant ou le mot de passe sort de
   * l'ASCII — une chaîne entre guillemets n'en porte pas, et « Zürich2026! » y aurait été
   * refusé sans que l'agent comprenne pourquoi.
   *
   * ⛔ Jamais sur une connexion EN CLAIR : le mot de passe de la boîte passerait lisible sur
   * le réseau. L'appelant doit monter en TLS d'abord.
   */
  async login(user: string, password: string): Promise<void> {
    if (this.enClair()) throw new Error('imap: login refusé sur une connexion en clair')
    const horsAscii = /[^\x20-\x7e]/.test(user + password)
    let tagged: string
    try {
      if (horsAscii || this.has('LOGINDISABLED')) tagged = await this.authenticatePlain(user, password)
      else tagged = (await this.cmd(`LOGIN ${quote(user)} ${quote(password)}`)).tagged
    } catch (e) {
      // Un NO à l'authentification, c'est le mot de passe ou l'identifiant — sauf quand il dit
      // lui-même qu'il passera (`refusTemporaire`). Le reste (connexion coupée, BAD de
      // syntaxe) garde son erreur d'origine.
      if (e instanceof ImapCommandError && / NO /.test(` ${e.reponse} `)) {
        throw refusTemporaire(e.reponse) ? new ImapRefusTemporaire(e.reponse) : new ImapAuthError(e.reponse)
      }
      throw e
    }
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

  /** SASL PLAIN, en une ligne quand le serveur accepte l'argument initial (`SASL-IR`), en deux sinon. */
  private async authenticatePlain(user: string, password: string): Promise<string> {
    const tag = `a${++this.n}`
    const jeton = base64Utf8(`\0${user}\0${password}`)
    const enc = new TextEncoder()
    if (this.has('SASL-IR')) {
      await this.conn.write(enc.encode(`${tag} AUTHENTICATE PLAIN ${jeton}\r\n`))
    } else {
      await this.conn.write(enc.encode(`${tag} AUTHENTICATE PLAIN\r\n`))
      const suite = await this.reader.line()
      if (suite === null) throw new Error('imap: connection closed')
      if (!suite.startsWith('+')) {
        // Refusé d'emblée (pas de PLAIN, ou identifiants refusés sans relance).
        if (suite.startsWith(`${tag} `)) throw new ImapCommandError(suite)
        throw new Error(`imap: authenticate refused ${suite}`)
      }
      await this.conn.write(enc.encode(`${jeton}\r\n`))
    }
    return (await this.attendre(tag)).tagged
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
    const { untagged, literals } = await this.cmd('LIST "" "*"')
    return untagged.filter((l) => l.startsWith('* LIST ')).map((l) => lireList(l, literals)).filter((f): f is ImapFolder => !!f)
  }

  /** Crée un dossier (l'« Archive » d'une boîte qui n'en a pas) et s'y abonne. */
  async create(folder: string): Promise<void> {
    await this.cmd(`CREATE ${quote(folder)}`)
    try { await this.cmd(`SUBSCRIBE ${quote(folder)}`) } catch { /* l'abonnement est un confort */ }
  }

  private async ouvrirDossier(verbe: 'SELECT' | 'EXAMINE', folder: string): Promise<ImapSelect> {
    const { untagged, tagged } = await this.cmd(`${verbe} ${quote(folder)}`)
    const num = (re: RegExp) => {
      const l = [...untagged, tagged].map((u) => u.match(re)).find(Boolean)
      return l ? Number(l[1]) : 0
    }
    return { exists: num(/^\* (\d+) EXISTS/), uidValidity: num(/\[UIDVALIDITY (\d+)\]/), uidNext: num(/\[UIDNEXT (\d+)\]/) }
  }

  /** Ouvre un dossier pour y AGIR (drapeaux, déplacements). */
  async select(folder: string): Promise<ImapSelect> { return this.ouvrirDossier('SELECT', folder) }

  /**
   * Ouvre un dossier en LECTURE SEULE — la synchro n'a rien à y changer, et `EXAMINE`
   * garantit qu'elle ne le peut pas : un `\Seen` posé par erreur marquerait lu, dans la
   * vraie boîte, un courrier que l'agent n'a jamais ouvert.
   */
  async examine(folder: string): Promise<ImapSelect> { return this.ouvrirDossier('EXAMINE', folder) }

  async uidSearchSince(since: Date): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH SINCE ${imapDate(since)}`)
    return lireSearch(untagged)
  }

  async uidSearchRange(fromUid: number): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH UID ${fromUid}:*`)
    return lireSearch(untagged)
  }

  /** Les UID existants entre `de` et `a`, bornes comprises. */
  async uidSearchBetween(de: number, a: number): Promise<number[]> {
    if (a < de) return []
    const { untagged } = await this.cmd(`UID SEARCH UID ${de}:${a}`)
    return lireSearch(untagged).filter((u) => u >= de && u <= a)
  }

  /** Ceux de ces UID qui existent encore dans le dossier ouvert — une commande pour tous. */
  async uidPresents(uids: number[]): Promise<number[]> {
    if (uids.length === 0) return []
    const { untagged } = await this.cmd(`UID SEARCH UID ${uids.join(',')}`)
    const voulus = new Set(uids)
    return lireSearch(untagged).filter((u) => voulus.has(u))
  }

  /** Le message qui porte cet en-tête `Message-ID` dans le dossier ouvert. */
  async uidSearchHeaderMessageId(messageId: string): Promise<number[]> {
    const { untagged } = await this.cmd(`UID SEARCH HEADER Message-ID ${quote(messageId)}`)
    return lireSearch(untagged)
  }

  async uidFetchFlags(set: string): Promise<ImapFlags[]> {
    const { untagged } = await this.cmd(`UID FETCH ${set} (FLAGS)`)
    return untagged.filter((l) => /^\* \d+ FETCH /.test(l)).map(lireFetch)
      .filter((f) => f.uid !== null && f.flags !== null)
      .map((f) => ({ uid: f.uid!, flags: f.flags! }))
  }

  /** Drapeaux, taille et date d'arrivée — de quoi décider de télécharger, avant de le faire. */
  async uidFetchMeta(set: string): Promise<ImapMeta[]> {
    const { untagged } = await this.cmd(`UID FETCH ${set} (UID FLAGS RFC822.SIZE INTERNALDATE)`)
    return untagged.filter((l) => /^\* \d+ FETCH /.test(l)).map(lireFetch)
      .filter((f) => f.uid !== null)
      .map((f) => ({ uid: f.uid!, flags: f.flags ?? [], size: f.size ?? 0, internalDate: f.internalDate }))
  }

  /** Le message entier. `max` : la taille au-delà de laquelle le littéral est refusé (cf. `LineReader.bytes`). */
  async uidFetchRaw(uid: number, max?: number): Promise<Uint8Array> {
    const { literals } = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[])`, max)
    if (!literals[0]) throw new Error(`imap: no body for uid ${uid}`)
    return literals[0]
  }

  /** Les seuls en-têtes — pour un message trop lourd pour être téléchargé en entier. */
  async uidFetchHeader(uid: number, max?: number): Promise<Uint8Array> {
    const { literals } = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[HEADER])`, max)
    if (!literals[0]) throw new Error(`imap: no header for uid ${uid}`)
    return literals[0]
  }

  async uidStore(uid: number, flags: string[], mode: 'add' | 'remove'): Promise<void> {
    await this.cmd(`UID STORE ${uid} ${mode === 'add' ? '+' : '-'}FLAGS.SILENT (${flags.join(' ')})`)
  }

  /**
   * Déplace un message. Trois voies, de la meilleure à la moins bonne — et l'UID
   * d'arrivée quand le serveur l'annonce (`COPYUID`, extension UIDPLUS), pour que le
   * geste suivant (« désarchiver ») retrouve le message sans relire le dossier.
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
  async uidMove(uid: number, folder: string): Promise<ImapMoved> {
    if (this.has('MOVE')) {
      const r = await this.cmd(`UID MOVE ${uid} ${quote(folder)}`)
      const c = lireCopyUid([...r.untagged, r.tagged])
      return { voie: 'move', uid: c?.uid ?? null, uidValidity: c?.uidValidity ?? null }
    }
    const r = await this.cmd(`UID COPY ${uid} ${quote(folder)}`)
    const c = lireCopyUid([...r.untagged, r.tagged])
    await this.uidStore(uid, ['\\Deleted'], 'add')
    const arrivee = { uid: c?.uid ?? null, uidValidity: c?.uidValidity ?? null }
    if (this.has('UIDPLUS')) {
      await this.cmd(`UID EXPUNGE ${uid}`)
      return { voie: 'copy+uid-expunge', ...arrivee }
    }
    return { voie: 'copy-only', ...arrivee }
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
        if (!line.startsWith(`${tag} OK`)) throw new ImapCommandError(line)
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
