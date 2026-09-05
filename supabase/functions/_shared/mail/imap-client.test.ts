/**
 * Le protocole IMAP éprouvé contre une connexion SCRIPTÉE.
 *
 * ⚠ Ce que ces tests couvrent : la grammaire (littéraux, réponses non taguées,
 * lignes taguées) et les DÉCISIONS du client (quelle voie prendre pour déplacer,
 * quoi faire d'un APPENDUID absent). Ce qu'ils NE couvrent PAS : l'ouverture de
 * la socket, mesurée séparément par la sonde T3.1 contre les vrais serveurs.
 */
import { describe, it, expect } from 'vitest'
import { ImapClient } from './imap-client.ts'
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
        sent.push(`<payload ${bytes.length}>`)
        if (brut === '\r\n') { queue.push(enc.encode(conclusion)); conclusion = null }
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
    expect(await c.uidMove(7, 'Archive')).toBe('move')
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
    expect(await c.uidMove(7, 'Archive')).toBe('copy+uid-expunge')
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
    expect(await c.uidMove(7, 'Archive')).toBe('copy-only')
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
