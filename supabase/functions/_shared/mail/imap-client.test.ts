/**
 * Le protocole IMAP éprouvé contre une connexion SCRIPTÉE.
 *
 * ⚠ Ce que ces tests couvrent : la grammaire (littéraux, réponses non taguées,
 * lignes taguées) et les DÉCISIONS du client (quelle voie prendre pour déplacer,
 * quoi faire d'un APPENDUID absent). Ce qu'ils NE couvrent PAS : l'ouverture de
 * la socket, mesurée séparément par la sonde T3.1 contre les vrais serveurs.
 */
import { describe, it, expect } from 'vitest'
import { ImapArgumentError, ImapAuthError, ImapClient, ImapRefusTemporaire } from './imap-client.ts'
import { LineReader, type Duplex } from './duplex.ts'

/**
 * Fausse connexion : pour chaque commande reçue, une réponse scriptée (`$TAG`
 * remplacé par le tag réel). Les écritures qui ne sont pas des commandes — le
 * corps d'un APPEND — sont enregistrées sans être scriptées.
 */
function fake(script: Record<string, string>, greeting = '* OK IMAP4rev1 ready\r\n') {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode(greeting)]
  const sent: string[] = []
  // Un APPEND se joue en deux temps : le serveur rend `+`, le client écrit le
  // corps puis un CRLF, et le serveur conclut seulement là. Une entrée de script
  // écrite « continuation || conclusion » porte les deux.
  let conclusion: string | null = null
  const conn: Duplex = {
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      const brut = new TextDecoder().decode(bytes)
      if (conclusion !== null) {
        sent.push(`<payload ${brut === '\r\n' ? 'crlf' : brut.replace(/\r\n$/, '')}>`)
        // La conclusion part quand la ligne se ferme : le CRLF final d'un APPEND, ou la
        // réponse SASL d'un AUTHENTICATE, écrite d'un seul tenant.
        if (brut.endsWith('\r\n')) { queue.push(enc.encode(conclusion)); conclusion = null }
        return
      }
      const cmd = brut.replace(/\r\n$/, '')
      sent.push(cmd)
      const tag = cmd.split(' ')[0]
      const verb = cmd.split(' ').slice(1).join(' ')
      const key = Object.keys(script).find((k) => verb.startsWith(k))
      if (!key) throw new Error(`unscripted: ${cmd}`)
      const [rep, suite] = script[key].replace(/\$TAG/g, tag).split('||')
      if (suite !== undefined) conclusion = suite
      queue.push(enc.encode(rep))
    },
    close() {},
  }
  return { conn, sent }
}

const ouvrir = async (script: Record<string, string>, greeting?: string) => {
  const f = fake(script, greeting)
  const c = new ImapClient(f.conn)
  await c.connect()
  return { c, ...f }
}

// ⛔ Tout NO au LOGIN était pris pour un mot de passe refusé : un « trop de connexions »
// passager mettait la boîte en « autorisation à renouveler » dès le premier refus.
describe('ImapClient — un refus au LOGIN : le mot de passe, ou un refus qui passera', () => {
  const refus = async (reponse: string) => {
    const { c } = await ouvrir({ LOGIN: `$TAG ${reponse}\r\n` })
    return c.login('u', 'p').then(() => null, (e: unknown) => e)
  }
  it.each([
    'NO [UNAVAILABLE] Temporary authentication failure',
    'NO [INUSE] Mailbox is locked by another session',
    'NO [LIMIT] Too many connections from your IP',
    'NO [SERVERBUG] Internal error occurred',
    'NO [ALERT] Too many simultaneous connections. (Failure)',
    'NO Server busy, try again later',
  ])('temporaire : %s', async (r) => {
    expect(await refus(r)).toBeInstanceOf(ImapRefusTemporaire)
  })
  it.each([
    'NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)',
    'NO [AUTHENTICATIONFAILED] Authentication failed, try again later.',
    'NO [EXPIRED] Password expired',
    'NO LOGIN failed.',
  ])('identifiants : %s', async (r) => {
    expect(await refus(r)).toBeInstanceOf(ImapAuthError)
  })
})

describe('ImapClient — grammaire', () => {
  it('login + select lit UIDVALIDITY / UIDNEXT, et cite le mot de passe', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK LOGIN done\r\n',
      CAPABILITY: '* CAPABILITY IMAP4rev1 UIDPLUS\r\n$TAG OK\r\n',
      SELECT: '* 3 EXISTS\r\n* OK [UIDVALIDITY 42] UIDs valid\r\n* OK [UIDNEXT 100] Predicted next UID\r\n$TAG OK [READ-WRITE] SELECT completed\r\n',
    })
    await c.login('u@ex.ch', 'p"w')
    expect(sent[0]).toBe('a1 LOGIN "u@ex.ch" "p\\"w"')
    expect(await c.select('INBOX')).toEqual({ exists: 3, uidValidity: 42, uidNext: 100 })
  })

  it('uidSearchSince rend les UID ; uidFetchFlags lit les drapeaux', async () => {
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      SELECT: '* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 10]\r\n$TAG OK\r\n',
      'UID SEARCH': '* SEARCH 7 8 9\r\n$TAG OK SEARCH completed\r\n',
      'UID FETCH 7:9 (FLAGS)': '* 1 FETCH (UID 7 FLAGS (\\Seen))\r\n* 2 FETCH (UID 8 FLAGS ())\r\n* 3 FETCH (UID 9 FLAGS (\\Seen \\Flagged))\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p'); await c.select('INBOX')
    expect(await c.uidSearchSince(new Date('2026-06-05T00:00:00Z'))).toEqual([7, 8, 9])
    expect(await c.uidFetchFlags('7:9')).toEqual([
      { uid: 7, flags: ['\\Seen'] }, { uid: 8, flags: [] }, { uid: 9, flags: ['\\Seen', '\\Flagged'] },
    ])
  })

  it('⛔ recolle les UID quand SEARCH répond sur PLUSIEURS lignes', async () => {
    // Le plan ne lisait que la PREMIÈRE ligne `* SEARCH` (`.find`). Une boîte de
    // quelques milliers de messages en rend couramment plusieurs : la moitié des
    // UID serait perdue en silence, et ces messages jamais ingérés, sans erreur.
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      SELECT: '* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 99]\r\n$TAG OK\r\n',
      'UID SEARCH': '* SEARCH 1 2 3\r\n* SEARCH 4 5\r\n* SEARCH 6\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p'); await c.select('INBOX')
    expect(await c.uidSearchRange(1)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('uidFetchRaw lit un littéral exactement, CRLF du corps compris', async () => {
    const raw = 'From: a@b\r\nSubject: hi\r\n\r\nCorps sur\r\ndeux lignes'
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      SELECT: '* OK [UIDVALIDITY 1]\r\n* OK [UIDNEXT 2]\r\n$TAG OK\r\n',
      'UID FETCH 7 (BODY.PEEK[])': `* 1 FETCH (UID 7 BODY[] {${raw.length}}\r\n${raw})\r\n$TAG OK\r\n`,
    })
    await c.login('u', 'p'); await c.select('INBOX')
    expect(new TextDecoder().decode(await c.uidFetchRaw(7))).toBe(raw)
  })

  it('list expose les usages spéciaux ; un NO lève', async () => {
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      LIST: '* LIST (\\HasNoChildren) "." INBOX\r\n* LIST (\\HasNoChildren \\Sent) "." "Sent Messages"\r\n* LIST (\\Trash) "." Trash\r\n$TAG OK\r\n',
      SELECT: '$TAG NO Mailbox does not exist\r\n',
    })
    await c.login('u', 'p')
    expect(await c.list()).toEqual([
      { name: 'INBOX', attributes: ['\\HasNoChildren'] },
      { name: 'Sent Messages', attributes: ['\\HasNoChildren', '\\Sent'] },
      { name: 'Trash', attributes: ['\\Trash'] },
    ])
    await expect(c.select('Nope')).rejects.toThrow(/NO Mailbox/)
  })
})

describe('ImapClient — les capacités décident, il faut donc les avoir', () => {
  it('lit les capacités de la BANNIÈRE quand elle les porte (cas Bluewin, mesuré le 05.09.2026)', async () => {
    const { c } = await ouvrir({}, '* OK [CAPABILITY IMAP4rev1 SASL-IR IDLE LITERAL+ AUTH=PLAIN] Server ready\r\n')
    expect(c.has('SASL-IR')).toBe(true)
    expect(c.has('IMAP4REV1')).toBe(true)
    expect(c.has('UIDPLUS')).toBe(false)
  })

  it('REDEMANDE les capacités après login quand la bannière ne promettait ni MOVE ni UIDPLUS', async () => {
    // Bluewin dit lui-même « post-login capabilities have more » : décider sur la
    // liste pré-login prendrait le repli dégradé alors que le serveur offre mieux.
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK LOGIN completed\r\n',
      CAPABILITY: '* CAPABILITY IMAP4rev1 UIDPLUS MOVE\r\n$TAG OK\r\n',
    }, '* OK [CAPABILITY IMAP4rev1 SASL-IR] ready\r\n')
    expect(c.has('UIDPLUS')).toBe(false)
    await c.login('u', 'p')
    expect(sent.some((s) => s.endsWith('CAPABILITY'))).toBe(true)
    expect(c.has('UIDPLUS')).toBe(true)
    expect(c.has('MOVE')).toBe(true)
  })

  it('ne redemande RIEN quand la réponse au LOGIN porte déjà la liste', async () => {
    const { c, sent } = await ouvrir({ LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS MOVE] logged in\r\n' })
    await c.login('u', 'p')
    expect(sent.filter((s) => s.endsWith('CAPABILITY'))).toEqual([])
    expect(c.has('MOVE')).toBe(true)
  })
})

describe('ImapClient — déplacer sans détruire ce que personne n\u0027a demandé', () => {
  it('MOVE annoncé : une seule commande', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 MOVE UIDPLUS]\r\n',
      'UID MOVE': '$TAG OK MOVE completed\r\n',
    })
    await c.login('u', 'p')
    expect(await c.uidMove(7, 'Archive')).toEqual({ voie: 'move', uid: null, uidValidity: null })
    expect(sent.filter((s) => /MOVE|COPY|EXPUNGE/.test(s))).toEqual(['a2 UID MOVE 7 "Archive"'])
  })

  it('sans MOVE mais avec UIDPLUS : COPY + \\Deleted + UID EXPUNGE — ciblé sur NOTRE uid', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      'UID COPY': '$TAG OK [COPYUID 1 7 20] COPY completed\r\n',
      'UID STORE': '$TAG OK STORE completed\r\n',
      'UID EXPUNGE': '$TAG OK EXPUNGE completed\r\n',
    })
    await c.login('u', 'p')
    // L'UID d'arrivée vient du `[COPYUID 1 7 20]` : « désarchiver » retrouvera le message.
    expect(await c.uidMove(7, 'Archive')).toEqual({ voie: 'copy+uid-expunge', uid: 20, uidValidity: 1 })
    expect(sent.filter((s) => /COPY|STORE|EXPUNGE/.test(s))).toEqual([
      'a2 UID COPY 7 "Archive"',
      'a3 UID STORE 7 +FLAGS.SILENT (\\Deleted)',
      'a4 UID EXPUNGE 7',
    ])
  })

  it('⛔ SANS UIDPLUS : COPY + \\Deleted et AUCUN EXPUNGE NU', async () => {
    // Le plan prescrivait ici `EXPUNGE` sans argument, qui supprime TOUS les
    // messages `\Deleted` du dossier — donc tout ce que l'agent avait supprimé
    // sans confirmer dans sa vraie boîte. Un doublon visible vaut mieux qu'une
    // destruction qu'il n'a pas demandée.
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1]\r\n',
      CAPABILITY: '* CAPABILITY IMAP4rev1\r\n$TAG OK\r\n',
      'UID COPY': '$TAG OK COPY completed\r\n',
      'UID STORE': '$TAG OK STORE completed\r\n',
    })
    await c.login('u', 'p')
    expect(await c.uidMove(7, 'Archive')).toEqual({ voie: 'copy-only', uid: null, uidValidity: null })
    expect(sent.some((s) => /\bEXPUNGE\b/.test(s))).toBe(false)
  })
})

describe('ImapClient — append', () => {
  it('rend l\u0027UID attribué quand le serveur annonce APPENDUID', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      APPEND: '+ Ready for literal data\r\n||$TAG OK [APPENDUID 42 100] APPEND completed\r\n',
    })
    await c.login('u', 'p')
    expect(await c.append('Sent', new TextEncoder().encode('From: a@b\r\n\r\nhi'))).toBe(100)
    expect(sent[1]).toBe('a2 APPEND "Sent" (\\Seen) {15}')
  })

  it('rend null sans APPENDUID — l\u0027appelant doit SAVOIR qu\u0027il ne sait pas', async () => {
    // Sans UIDPLUS le serveur n'annonce aucun UID. Rendre 0 laisserait croire à
    // un identifiant ; `null` dit l'ignorance, et le lot 3 devra la gérer.
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1]\r\n',
      CAPABILITY: '* CAPABILITY IMAP4rev1\r\n$TAG OK\r\n',
      APPEND: '+ go\r\n||$TAG OK APPEND completed\r\n',
    })
    await c.login('u', 'p')
    expect(await c.append('Sent', new TextEncoder().encode('x'))).toBeNull()
  })

  it('lève quand le serveur REFUSE le littéral', async () => {
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      APPEND: '$TAG NO [OVERQUOTA] mailbox full\r\n',
    })
    await c.login('u', 'p')
    await expect(c.append('Sent', new TextEncoder().encode('x'))).rejects.toThrow(/append refused|OVERQUOTA/)
  })
})

describe('LineReader — un littéral tronqué doit LEVER', () => {
  it('lève quand le flux se coupe au milieu d\u0027un littéral', async () => {
    const enc = new TextEncoder()
    const queue: (Uint8Array | null)[] = [enc.encode('abc'), null]
    const conn: Duplex = { async read() { return queue.shift() ?? null }, async write() {}, close() {} }
    // Le plan rendait ici 3 octets sur 10 EN SILENCE : un message tronqué serait
    // ingéré comme complet, marqué lu, et jamais relu.
    await expect(new LineReader(conn).bytes(10)).rejects.toThrow(/flux coupé dans un littéral \(3\/10/)
  })
})

describe('ImapClient — ce que les vrais serveurs rendent', () => {
  it('⛔ lit un FETCH dont les éléments arrivent dans l’AUTRE ordre', async () => {
    // La RFC 3501 ne fixe pas l'ordre. Le motif d'origine exigeait UID avant FLAGS :
    // un serveur qui répond l'inverse rendait zéro message, sans erreur.
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      'UID FETCH': '* 1 FETCH (FLAGS (\\Seen) UID 7)\r\n* 2 FETCH (FLAGS () UID 8)\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p')
    expect(await c.uidFetchFlags('7:8')).toEqual([{ uid: 7, flags: ['\\Seen'] }, { uid: 8, flags: [] }])
  })

  it('uidFetchMeta lit drapeaux, taille et date d’arrivée', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      'UID FETCH': '* 4 FETCH (RFC822.SIZE 2048 INTERNALDATE "05-Sep-2026 10:00:00 +0200" UID 12 FLAGS (\\Flagged))\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p')
    expect(await c.uidFetchMeta('12')).toEqual([{ uid: 12, flags: ['\\Flagged'], size: 2048, internalDate: '05-Sep-2026 10:00:00 +0200' }])
    expect(sent[1]).toBe('a2 UID FETCH 12 (UID FLAGS RFC822.SIZE INTERNALDATE)')
  })

  it('MOVE : l’UID d’arrivée se lit dans le COPYUID NON tagué (RFC 6851)', async () => {
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 MOVE UIDPLUS]\r\n',
      'UID MOVE': '* OK [COPYUID 5 7 31] Moved\r\n* 3 EXPUNGE\r\n$TAG OK MOVE completed\r\n',
    })
    await c.login('u', 'p')
    expect(await c.uidMove(7, 'Archive')).toEqual({ voie: 'move', uid: 31, uidValidity: 5 })
  })

  it('list : noms entre guillemets échappés, en littéral (UTF-8), et sans nom écartés', async () => {
    const { c } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      LIST: '* LIST () "." "Clients \\"VIP\\""\r\n* LIST (\\HasNoChildren) "/" {8}\r\nEnvoyés\r\n* LIST (\\Noselect) NIL ""\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p')
    expect(await c.list()).toEqual([
      { name: 'Clients "VIP"', attributes: [] },
      { name: 'Envoyés', attributes: ['\\HasNoChildren'] },
    ])
  })

  it('examine ouvre en LECTURE SEULE ; la recherche par Message-ID cite l’identifiant', async () => {
    const { c, sent } = await ouvrir({
      LOGIN: '$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS]\r\n',
      EXAMINE: '* 2 EXISTS\r\n* OK [UIDVALIDITY 9]\r\n* OK [UIDNEXT 3]\r\n$TAG OK [READ-ONLY] done\r\n',
      'UID SEARCH HEADER': '* SEARCH 2\r\n$TAG OK\r\n',
    })
    await c.login('u', 'p')
    expect(await c.examine('INBOX')).toEqual({ exists: 2, uidValidity: 9, uidNext: 3 })
    expect(await c.uidSearchHeaderMessageId('<a"b@ex.ch>')).toEqual([2])
    expect(sent[2]).toBe('a3 UID SEARCH HEADER Message-ID "<a\\"b@ex.ch>"')
  })
})

describe('ImapClient — le mot de passe', () => {
  it('un NO au LOGIN est un refus d’IDENTIFIANTS (ImapAuthError), pas une panne', async () => {
    const { c } = await ouvrir({ LOGIN: '$TAG NO [AUTHENTICATIONFAILED] Authentication failed.\r\n' })
    await expect(c.login('u', 'faux')).rejects.toMatchObject({ name: 'Error', message: expect.stringMatching(/AUTHENTICATIONFAILED/) })
    const { c: c2 } = await ouvrir({ LOGIN: '$TAG NO [AUTHENTICATIONFAILED] Authentication failed.\r\n' })
    const { ImapAuthError } = await import('./imap-client.ts')
    await expect(c2.login('u', 'faux')).rejects.toBeInstanceOf(ImapAuthError)
  })

  it('un mot de passe hors ASCII passe par AUTHENTICATE PLAIN — en deux temps sans SASL-IR', async () => {
    const { c, sent } = await ouvrir({
      'AUTHENTICATE PLAIN': '+ \r\n||$TAG OK [CAPABILITY IMAP4rev1 UIDPLUS] Logged in\r\n',
    }, '* OK IMAP4 ready\r\n')
    await c.login('zoé@ex.ch', 'Zürich2026!')
    expect(sent[0]).toBe('a1 AUTHENTICATE PLAIN')
    const jeton = sent[1].replace(/^<payload (.*)>$/, '$1')
    const octets = Uint8Array.from(atob(jeton), (x) => x.charCodeAt(0))
    expect(new TextDecoder().decode(octets)).toBe('\0zoé@ex.ch\0Zürich2026!')
    expect(c.has('UIDPLUS')).toBe(true)
  })

  it('⛔ refuse d’envoyer le mot de passe sur une connexion EN CLAIR ; STARTTLS d’abord', async () => {
    const enc = new TextEncoder()
    const queue: Uint8Array[] = [enc.encode('* OK [CAPABILITY IMAP4rev1 STARTTLS LOGINDISABLED] ready\r\n')]
    const sent: string[] = []
    let tls = false
    const reponses: Record<string, string> = {
      STARTTLS: '$TAG OK Begin TLS negotiation now\r\n',
      CAPABILITY: '* CAPABILITY IMAP4rev1 AUTH=PLAIN UIDPLUS\r\n$TAG OK\r\n',
      LOGIN: '$TAG OK Logged in\r\n',
    }
    const duplex = (chiffre: boolean): Duplex => ({
      async read() { return queue.shift() ?? null },
      async write(bytes) {
        const cmd = new TextDecoder().decode(bytes).replace(/\r\n$/, '')
        sent.push(`${chiffre ? 'tls' : 'clair'}:${cmd}`)
        const [tag, verbe] = cmd.split(' ')
        queue.push(enc.encode((reponses[verbe] ?? `${tag} BAD ?\r\n`).replace(/\$TAG/g, tag)))
      },
      close() {},
      ...(chiffre ? {} : { startTls: async () => { tls = true; return duplex(true) } }),
    })
    const c = new ImapClient(duplex(false))
    await c.connect()
    await expect(c.login('u', 'p')).rejects.toThrow(/en clair/)
    await c.starttls()
    expect(tls).toBe(true)
    // Les capacités d'avant la montée sont oubliées : LOGINDISABLED ne vaut plus.
    expect(c.has('LOGINDISABLED')).toBe(false)
    await c.login('u', 'p')
    expect(sent).toEqual(['clair:a1 STARTTLS', 'tls:a2 CAPABILITY', 'tls:a3 LOGIN "u" "p"'])
  })

  it('une bannière MUETTE n’est pas un refus de STARTTLS : on demande d’abord (cas Infomaniak)', async () => {
    const enc = new TextEncoder()
    const queue: Uint8Array[] = [enc.encode('* OK IMAP4 ready\r\n')]
    const sent: string[] = []
    const reponses: Record<string, string> = {
      CAPABILITY: '* CAPABILITY IMAP4rev1 STARTTLS\r\n$TAG OK\r\n',
      STARTTLS: '$TAG OK Begin TLS negotiation now\r\n',
    }
    const duplex = (chiffre: boolean): Duplex => ({
      async read() { return queue.shift() ?? null },
      async write(bytes) {
        const cmd = new TextDecoder().decode(bytes).replace(/\r\n$/, '')
        sent.push(`${chiffre ? 'tls' : 'clair'}:${cmd}`)
        const [tag, verbe] = cmd.split(' ')
        queue.push(enc.encode((reponses[verbe] ?? `${tag} BAD ?\r\n`).replace(/\$TAG/g, tag)))
      },
      close() {},
      ...(chiffre ? {} : { startTls: async () => duplex(true) }),
    })
    const c = new ImapClient(duplex(false))
    await c.connect()
    await c.starttls()
    expect(sent).toEqual(['clair:a1 CAPABILITY', 'clair:a2 STARTTLS', 'tls:a3 CAPABILITY'])
    expect(c.enClair()).toBe(false)
  })
})

describe('ImapClient — une commande est UNE ligne', () => {
  it('⛔ un Message-ID à plusieurs lignes est refusé AVANT d’écrire quoi que ce soit', async () => {
    const { c, sent } = await ouvrir({ 'SELECT': '* OK [UIDVALIDITY 7] ok\r\n$TAG OK done\r\n' })
    await c.select('INBOX')
    const avant = sent.length
    await expect(c.uidSearchHeaderMessageId('<x@y>\r\nZ1 UID MOVE 1:* Trash\r\nZ2 DELETE Trash')).rejects.toBeInstanceOf(ImapArgumentError)
    expect(sent.length).toBe(avant)
    expect(sent.join('\n')).not.toMatch(/MOVE|DELETE/)
  })

  it('⛔ un nom de dossier porteur d’un LF ou d’un NUL ne part pas non plus', async () => {
    const { c, sent } = await ouvrir({})
    await expect(c.select('INBOX\nZ1 DELETE Trash')).rejects.toBeInstanceOf(ImapArgumentError)
    await expect(c.create(`Archive${String.fromCharCode(0)}`)).rejects.toBeInstanceOf(ImapArgumentError)
    expect(sent).toEqual([])
  })
})

describe('⛔ LineReader — c’est le SERVEUR qui annonce les tailles', () => {
  const flux = (paquets: (Uint8Array | null)[]): Duplex => ({ async read() { return paquets.length ? paquets.shift()! : null }, async write() {}, close() {} })
  const enc = new TextEncoder()

  it('un littéral au-delà du plafond est refusé sans rien lire', async () => {
    let lus = 0
    const conn: Duplex = { async read() { lus++; return new Uint8Array(1024) }, async write() {}, close() {} }
    await expect(new LineReader(conn).bytes(2_000_000_000)).rejects.toThrow(/refusé/)
    expect(lus).toBe(0)
  })

  it('une ligne sans fin au-delà du plafond est refusée', async () => {
    const conn: Duplex = { async read() { return new Uint8Array(4096).fill(65) }, async write() {}, close() {} }
    await expect(new LineReader(conn, { ligne: 64 * 1024, litteral: 1024 }).line()).rejects.toThrow(/ligne de plus/)
  })

  it('un CRLF coupé entre deux paquets reste une fin de ligne', async () => {
    const r = new LineReader(flux([enc.encode('a1 OK fin\r'), enc.encode('\nsuite\r\n')]))
    expect(await r.line()).toBe('a1 OK fin')
    expect(await r.line()).toBe('suite')
  })

  it('un littéral de 8 Mo en petits paquets se lit en temps LINÉAIRE, octet pour octet', async () => {
    const n = 8 * 1024 * 1024
    const source = new Uint8Array(n + 7)
    for (let i = 0; i < source.length; i++) source[i] = i % 251
    const paquets: Uint8Array[] = []
    for (let i = 0; i < source.length; i += 1448) paquets.push(source.subarray(i, i + 1448))
    const r = new LineReader(flux(paquets))
    const t0 = Date.now()
    const lu = await r.bytes(n)
    // L'ancien lecteur recopiait tout son tampon à chaque paquet : ~24 Go pour ce cas.
    expect(Date.now() - t0).toBeLessThan(1500)
    expect(lu.length).toBe(n)
    expect(lu[n - 1]).toBe((n - 1) % 251)
    // Le reste du dernier paquet n'est pas perdu.
    expect(Array.from(await r.bytes(7))).toEqual(Array.from(source.subarray(n)))
  })

  it('le plafond d’une commande resserre celui du lecteur : un corps bien plus gros qu’annoncé est refusé', async () => {
    const { c } = await ouvrir({ 'UID FETCH': '* 1 FETCH (UID 9 BODY[] {20}\r\n01234567890123456789)\r\n$TAG OK\r\n' })
    await expect(c.uidFetchRaw(9, 10)).rejects.toThrow(/refusé/)
  })
})

describe('⛔ la bannière d’un serveur ne remonte jamais', () => {
  it('IMAP : une bannière inattendue lève sans la recopier', async () => {
    const f = fake({}, '* BYE service-interne v4.2 prêt\r\n')
    const e = await new ImapClient(f.conn).connect().catch((x: unknown) => x)
    expect(e).toBeInstanceOf(Error)
    expect(String((e as Error).message)).not.toContain('service-interne')
  })
})
