/**
 * L'adaptateur IMAP rejoué contre une BOÎTE EN MÉMOIRE — un faux serveur qui parle le
 * sous-ensemble d'IMAP4rev1 que le client emploie (et un faux SMTP), branchés sur un
 * faux PostgREST qui garde ce qu'on y écrit.
 *
 * ⚠ Ce que ces tests prouvent : que la synchro, les gestes et l'envoi s'enchaînent — quels
 * UID sont lus, dans quel ordre, ce qui est écrit en base, où en est le curseur. Ce qu'ils
 * ne prouvent pas : le comportement d'un VRAI serveur, qui ne se mesure qu'avec une vraie
 * boîte (épreuve T3.8 du plan).
 */
import { describe, it, expect } from 'vitest'
import type { Duplex } from './duplex.ts'
import type { MailAccountRow } from './types.ts'
import {
  cleDeFil, decodeMUtf7, imapApply, imapSecurite, imapSend, imapSyncPass, imapTestConnexion, resolveFolders, smtpSecurite, splitProviderId,
} from './imap.ts'

// ── Une boîte en mémoire ──────────────────────────────────────────────────────
interface Msg { uid: number; flags: string[]; raw: string; date: string }
interface Dossier { uidValidity: number; uidNext: number; attrs: string[]; messages: Msg[] }

const MOT_DE_PASSE = 'bon-mot-de-passe'

/** Un message RFC 822 minimal. */
function courrier(o: { id: string; de?: string; a?: string; objet?: string; refs?: string; corps?: string }): string {
  return [
    `From: ${o.de ?? 'Zoé <zoe@ex.ch>'}`,
    `To: ${o.a ?? 'g@agence.ch'}`,
    `Subject: ${o.objet ?? 'Visite'}`,
    `Message-ID: ${o.id}`,
    ...(o.refs ? [`References: ${o.refs}`, `In-Reply-To: ${o.refs.split(' ').pop()}`] : []),
    'Date: Thu, 10 Sep 2026 10:00:00 +0200',
    'Content-Type: text/plain; charset=utf-8',
    '',
    o.corps ?? 'Bonjour',
    '',
  ].join('\r\n')
}

function fauxImap(boite: Record<string, Dossier>, caps = 'IMAP4rev1 UIDPLUS MOVE') {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode(`* OK [CAPABILITY ${caps}] ready\r\n`)]
  const journal: string[] = []
  let courant: string | null = null
  let depot: { tag: string; dossier: string; flags: string[]; taille: number; octets: number[] } | null = null
  const dire = (s: string) => { queue.push(enc.encode(s)) }
  const ensemble = (set: string, d: Dossier): Msg[] => set.split(',').flatMap((p) => {
    const [a, b] = p.split(':')
    const max = Math.max(0, ...d.messages.map((m) => m.uid))
    const bas = Number(a)
    const haut = b === undefined ? bas : b === '*' ? max : Number(b)
    return d.messages.filter((m) => m.uid >= Math.min(bas, haut) && m.uid <= Math.max(bas, haut))
  })
  const seq = (d: Dossier, m: Msg) => d.messages.indexOf(m) + 1
  const duplex: Duplex = {
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      if (depot) {
        if (depot.octets.length < depot.taille) { depot.octets.push(...bytes); return }
        const d = boite[depot.dossier]
        const uid = d.uidNext++
        d.messages.push({ uid, flags: depot.flags, raw: new TextDecoder().decode(new Uint8Array(depot.octets)), date: '11-Sep-2026 09:00:00 +0200' })
        dire(`${depot.tag} OK [APPENDUID ${d.uidValidity} ${uid}] APPEND completed\r\n`)
        depot = null
        return
      }
      const ligne = new TextDecoder().decode(bytes).replace(/\r\n$/, '')
      journal.push(ligne)
      const [tag, ...reste] = ligne.split(' ')
      const cmd = reste.join(' ')
      const d = courant ? boite[courant] : null
      let m: RegExpMatchArray | null
      if ((m = cmd.match(/^LOGIN "(.*)" "(.*)"$/))) {
        dire(m[2] === MOT_DE_PASSE ? `${tag} OK [CAPABILITY ${caps}] Logged in\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Authentication failed.\r\n`)
      } else if (cmd === 'CAPABILITY') {
        dire(`* CAPABILITY ${caps}\r\n${tag} OK\r\n`)
      } else if (cmd === 'LIST "" "*"') {
        dire(Object.entries(boite).map(([n, x]) => `* LIST (${x.attrs.join(' ')}) "/" "${n}"\r\n`).join('') + `${tag} OK\r\n`)
      } else if ((m = cmd.match(/^(SELECT|EXAMINE) "(.*)"$/))) {
        const x = boite[m[2]]
        if (!x) { dire(`${tag} NO no such mailbox\r\n`); return }
        courant = m[2]
        dire(`* ${x.messages.length} EXISTS\r\n* OK [UIDVALIDITY ${x.uidValidity}] ok\r\n* OK [UIDNEXT ${x.uidNext}] ok\r\n${tag} OK done\r\n`)
      } else if (d && cmd.startsWith('UID SEARCH SINCE')) {
        dire(`* SEARCH ${d.messages.map((x) => x.uid).join(' ')}\r\n${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID SEARCH UID (\S+)$/))) {
        dire(`* SEARCH ${ensemble(m[1], d).map((x) => x.uid).join(' ')}\r\n${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID SEARCH HEADER Message-ID "(.*)"$/))) {
        dire(`* SEARCH ${d.messages.filter((x) => x.raw.includes(`Message-ID: ${m![1]}`)).map((x) => x.uid).join(' ')}\r\n${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID FETCH (\S+) \(UID FLAGS RFC822\.SIZE INTERNALDATE\)$/))) {
        dire(ensemble(m[1], d).map((x) => `* ${seq(d, x)} FETCH (UID ${x.uid} FLAGS (${x.flags.join(' ')}) RFC822.SIZE ${x.raw.length} INTERNALDATE "${x.date}")\r\n`).join('') + `${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID FETCH (\S+) \(FLAGS\)$/))) {
        dire(ensemble(m[1], d).map((x) => `* ${seq(d, x)} FETCH (FLAGS (${x.flags.join(' ')}) UID ${x.uid})\r\n`).join('') + `${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID FETCH (\d+) \(BODY\.PEEK\[\]\)$/))) {
        const x = d.messages.find((y) => y.uid === Number(m![1]))!
        dire(`* ${seq(d, x)} FETCH (UID ${x.uid} BODY[] {${enc.encode(x.raw).length}}\r\n${x.raw})\r\n${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID STORE (\d+) ([+-])FLAGS\.SILENT \((.*)\)$/))) {
        const x = d.messages.find((y) => y.uid === Number(m![1]))
        if (x) x.flags = m[2] === '+' ? [...new Set([...x.flags, m[3]])] : x.flags.filter((f) => f !== m![3])
        dire(`${tag} OK\r\n`)
      } else if (d && (m = cmd.match(/^UID MOVE (\d+) "(.*)"$/))) {
        const x = d.messages.find((y) => y.uid === Number(m![1]))!
        const dest = boite[m[2]]
        const uid = dest.uidNext++
        dest.messages.push({ ...x, uid })
        d.messages = d.messages.filter((y) => y !== x)
        dire(`* OK [COPYUID ${dest.uidValidity} ${x.uid} ${uid}] Moved\r\n${tag} OK MOVE completed\r\n`)
      } else if ((m = cmd.match(/^CREATE "(.*)"$/))) {
        boite[m[1]] = { uidValidity: 99, uidNext: 1, attrs: [], messages: [] }
        dire(`${tag} OK\r\n`)
      } else if (cmd.startsWith('SUBSCRIBE')) {
        dire(`${tag} OK\r\n`)
      } else if ((m = cmd.match(/^APPEND "(.*)" \((.*)\) \{(\d+)\}$/))) {
        depot = { tag, dossier: m[1], flags: m[2].split(' ').filter(Boolean), taille: Number(m[3]), octets: [] }
        dire('+ Ready for literal data\r\n')
      } else if (cmd === 'LOGOUT') {
        dire(`* BYE\r\n${tag} OK\r\n`)
      } else {
        dire(`${tag} BAD unknown ${cmd}\r\n`)
      }
    },
    close() {},
  }
  return { duplex, journal }
}

/** Un faux SMTP qui accepte tout et garde le message transmis. */
function fauxSmtp() {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode('220 smtp.ex.ch ESMTP\r\n')]
  const recu: { rcpts: string[]; data: string | null } = { rcpts: [], data: null }
  let enDonnees = false
  const duplex: Duplex = {
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      const s = new TextDecoder().decode(bytes)
      if (enDonnees) { recu.data = s; enDonnees = false; queue.push(enc.encode('250 queued\r\n')); return }
      if (s.startsWith('EHLO')) queue.push(enc.encode('250-smtp.ex.ch\r\n250 AUTH PLAIN\r\n'))
      else if (s.startsWith('AUTH PLAIN')) queue.push(enc.encode(s.includes(btoa(`\0g@agence.ch\0${MOT_DE_PASSE}`)) ? '235 ok\r\n' : '535 5.7.8 bad\r\n'))
      else if (s.startsWith('MAIL FROM')) queue.push(enc.encode('250 ok\r\n'))
      else if (s.startsWith('RCPT TO:')) { recu.rcpts.push(s.slice(9, -3)); queue.push(enc.encode('250 ok\r\n')) }
      else if (s.startsWith('DATA')) { enDonnees = true; queue.push(enc.encode('354 go\r\n')) }
      else if (s.startsWith('QUIT')) queue.push(enc.encode('221 bye\r\n'))
    },
    close() {},
  }
  return { duplex, recu }
}

// ── Un faux PostgREST qui GARDE ce qu'on y écrit ─────────────────────────────
type Ligne = Record<string, unknown>

/** Un motif LIKE (`%`, `_`, échappés par `\\`) en expression régulière. */
function likeEnRegex(motif: string): RegExp {
  const lit = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let re = ''
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i]
    if (c === '\\' && i + 1 < motif.length) re += lit(motif[++i])
    else re += c === '%' ? '.*' : c === '_' ? '.' : lit(c)
  }
  return new RegExp(`^${re}$`)
}

function fauxAdmin(tables: Record<string, Ligne[]> = {}) {
  const t = (n: string) => (tables[n] ??= [])
  let seq = 0
  const from = (table: string) => {
    const filtres: ((l: Ligne) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let charge: Ligne | Ligne[] | null = null
    let limite = Infinity
    let tri: { col: string; asc: boolean } | null = null
    const applique = () => {
      let lignes = t(table).filter((l) => filtres.every((f) => f(l)))
      if (op === 'insert') {
        const nouvelles = (Array.isArray(charge) ? charge : [charge!]).map((l) => ({ id: `${table}-${++seq}`, ...l }))
        t(table).push(...nouvelles)
        return nouvelles
      }
      if (op === 'update') { for (const l of lignes) Object.assign(l, charge); return lignes }
      if (op === 'delete') { tables[table] = t(table).filter((l) => !lignes.includes(l)); return lignes }
      if (tri) { const { col, asc } = tri; lignes = [...lignes].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
      return lignes.slice(0, limite)
    }
    const b = {
      select: () => b,
      insert: (l: Ligne | Ligne[]) => { op = 'insert'; charge = l; return b },
      update: (l: Ligne) => { op = 'update'; charge = l; return b },
      delete: () => { op = 'delete'; return b },
      eq: (c: string, v: unknown) => { filtres.push((l) => l[c] === v); return b },
      neq: (c: string, v: unknown) => { filtres.push((l) => l[c] !== v); return b },
      in: (c: string, v: unknown[]) => { filtres.push((l) => v.includes(l[c])); return b },
      is: (c: string, v: unknown) => { filtres.push((l) => (l[c] ?? null) === v); return b },
      like: (c: string, motif: string) => { const re = likeEnRegex(motif); filtres.push((l) => re.test(String(l[c]))); return b },
      order: (col: string, o?: { ascending?: boolean }) => { tri = { col, asc: o?.ascending !== false }; return b },
      limit: (n: number) => { limite = n; return b },
      maybeSingle: async () => ({ data: applique()[0] ?? null, error: null }),
      single: async () => { const r = applique(); return r[0] ? { data: r[0], error: null } : { data: null, error: { message: 'no rows' } } },
      then: (res: (v: { data: unknown; error: null }) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => ({ data: applique(), error: null })).then(res, rej),
    }
    return b
  }
  const rpc = async (fn: string) => (fn === 'mail_secret_read' ? { data: JSON.stringify({ password: MOT_DE_PASSE }), error: null } : { data: [], error: null })
  return { admin: { from, rpc } as never, tables }
}

const compte = (over: Partial<MailAccountRow> = {}): MailAccountRow => ({
  id: 'acc-1', agency_id: 'ag-1', owner_id: 'u-1', provider: 'imap', email: 'g@agence.ch', display_name: null,
  visibility: 'owner', status: 'active', vault_secret_id: 'v-1', sync_cursor: {}, next_sync_at: '', last_sync_at: null, last_error: null,
  imap_config: { imapHost: 'imap.ex.ch', imapPort: 993, smtpHost: 'smtp.ex.ch', smtpPort: 465, user: 'g@agence.ch', encryption: 'ssl' },
  ...over,
})

const boiteType = (): Record<string, Dossier> => ({
  INBOX: {
    uidValidity: 7, uidNext: 4, attrs: ['\\HasNoChildren'], messages: [
      { uid: 1, flags: ['\\Seen'], raw: courrier({ id: '<m1@ex.ch>' }), date: '08-Sep-2026 10:00:00 +0200' },
      { uid: 2, flags: [], raw: courrier({ id: '<m2@ex.ch>', refs: '<m1@ex.ch>', objet: 'Re: Visite' }), date: '09-Sep-2026 10:00:00 +0200' },
      { uid: 3, flags: ['\\Flagged'], raw: courrier({ id: '<m3@ex.ch>', de: 'Banque <credit@banque.ch>', objet: 'Financement' }), date: '10-Sep-2026 10:00:00 +0200' },
    ],
  },
  Sent: {
    uidValidity: 8, uidNext: 2, attrs: ['\\HasNoChildren', '\\Sent'], messages: [
      { uid: 1, flags: ['\\Seen'], raw: courrier({ id: '<s1@agence.ch>', de: 'G <g@agence.ch>', a: 'zoe@ex.ch', refs: '<m1@ex.ch>', objet: 'Re: Visite' }), date: '08-Sep-2026 11:00:00 +0200' },
    ],
  },
  Archive: { uidValidity: 9, uidNext: 1, attrs: ['\\Archive'], messages: [] },
  Trash: { uidValidity: 10, uidNext: 1, attrs: ['\\Trash'], messages: [] },
})

const branche = (imap: ReturnType<typeof fauxImap>, smtp?: ReturnType<typeof fauxSmtp>) => ({
  dial: async (host: string) => (host.startsWith('smtp') ? smtp!.duplex : imap.duplex),
})

// ── Dossiers ──────────────────────────────────────────────────────────────────
describe('les dossiers', () => {
  it('l’usage spécial d’abord, puis les noms — sous INBOX. et en UTF-7 modifié compris', () => {
    expect(resolveFolders([
      { name: 'INBOX', attributes: [] }, { name: 'INBOX.Envoy&AOk-s', attributes: [] },
      { name: 'Corbeille', attributes: [] }, { name: 'Tout', attributes: ['\\Archive'] },
    ])).toEqual({ inbox: 'INBOX', sent: 'INBOX.Envoy&AOk-s', archive: 'Tout', trash: 'Corbeille' })
    expect(decodeMUtf7('Envoy&AOk-s &- Co')).toBe('Envoyés & Co')
  })
  it('un identifiant de message garde un dossier qui contient des deux-points', () => {
    expect(splitProviderId('Clients: 2026:7:42')).toEqual({ folder: 'Clients: 2026', uidValidity: 7, uid: 42 })
  })
})

// ── Synchronisation ───────────────────────────────────────────────────────────
describe('imapSyncPass', () => {
  it('première passe : les deux dossiers, du plus récent au plus ancien, et le fil recousu par References', async () => {
    const imap = fauxImap(boiteType())
    const { admin, tables } = fauxAdmin()
    const r = await imapSyncPass(admin, compte(), null, 20_000, branche(imap))

    const messages = tables.mail_messages as Ligne[]
    expect(messages.map((m) => m.provider_message_id).sort()).toEqual(['INBOX:7:1', 'INBOX:7:2', 'INBOX:7:3', 'Sent:8:1'])
    // L'import à reculons : la Réception est lue 3, 2, 1 — le plus récent d'abord.
    expect(imap.journal.filter((l) => /BODY\.PEEK\[\]/.test(l)).map((l) => l.match(/FETCH (\d+)/)![1])).toEqual(['3', '2', '1', '1'])
    // m1, sa réponse m2 et notre réponse s1 forment UN fil ; le courrier de la banque, un autre.
    const fil = (pid: string) => messages.find((m) => m.provider_message_id === pid)!.thread_id
    expect(fil('INBOX:7:2')).toBe(fil('INBOX:7:1'))
    expect(fil('Sent:8:1')).toBe(fil('INBOX:7:1'))
    expect(fil('INBOX:7:3')).not.toBe(fil('INBOX:7:1'))
    expect(messages.find((m) => m.provider_message_id === 'Sent:8:1')!.direction).toBe('outbound')
    expect(messages.find((m) => m.provider_message_id === 'INBOX:7:1')!.is_read).toBe(true)
    // ⛔ La synchro n'ouvre qu'en LECTURE SEULE : aucun drapeau posé dans la vraie boîte.
    expect(imap.journal.some((l) => /\bSELECT\b|STORE/.test(l))).toBe(false)

    expect(r.inserted).toBe(4)
    expect(r.done).toBe(true)
    expect(r.cursor.initialDone).toBe(true)
    expect(r.cursor.folders.INBOX).toEqual({ uidValidity: 7, lastUid: 3, backfillBelow: null, floorUid: 1 })
  })

  it('passe suivante : seul le courrier NEUF est téléchargé', async () => {
    const boite = boiteType()
    const { admin } = fauxAdmin()
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    boite.INBOX.messages.push({ uid: 4, flags: [], raw: courrier({ id: '<m4@ex.ch>', objet: 'Nouveau' }), date: '12-Sep-2026 10:00:00 +0200' })
    boite.INBOX.uidNext = 5
    const imap = fauxImap(boite)
    const r = await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(imap))
    expect(imap.journal.filter((l) => /BODY\.PEEK\[\]/.test(l))).toEqual([expect.stringContaining('UID FETCH 4 ')])
    expect(r.inserted).toBe(1)
    expect(r.cursor.folders.INBOX.lastUid).toBe(4)
  })

  it('un drapeau posé dans le webmail remonte ; un message sorti de la Réception archive son fil', async () => {
    const boite = boiteType()
    const { admin, tables } = fauxAdmin()
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    boite.INBOX.messages.find((m) => m.uid === 2)!.flags = ['\\Seen'] // lu ailleurs
    boite.INBOX.messages = boite.INBOX.messages.filter((m) => m.uid !== 3) // rangé ailleurs
    const r = await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(r.changes).toBe(2)
    expect((tables.mail_messages as Ligne[]).find((m) => m.provider_message_id === 'INBOX:7:2')!.is_read).toBe(true)
    const filBanque = (tables.mail_messages as Ligne[]).find((m) => m.provider_message_id === 'INBOX:7:3')!.thread_id
    expect((tables.mail_threads as Ligne[]).find((t) => t.id === filBanque)!.is_archived).toBe(true)
  })

  it('un message déplacé dans le webmail est REBAPTISÉ, pas dupliqué', async () => {
    const boite = boiteType()
    const { admin, tables } = fauxAdmin()
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    // Sorti puis remis en Réception dans le webmail : même message, nouvel UID.
    const m1 = boite.INBOX.messages.find((m) => m.uid === 1)!
    boite.INBOX.messages = boite.INBOX.messages.filter((m) => m !== m1)
    boite.INBOX.messages.push({ ...m1, uid: 4 })
    boite.INBOX.uidNext = 5
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    const ids = (tables.mail_messages as Ligne[]).map((m) => m.provider_message_id)
    expect(ids.filter((p) => p === 'INBOX:7:4')).toHaveLength(1)
    expect(ids).not.toContain('INBOX:7:1')
    expect(ids).toHaveLength(4)
  })

  it('⛔ un mot de passe refusé met la boîte en « autorisation à renouveler »', async () => {
    // Le mot de passe gardé dans Vault n'est plus le bon : il a été changé dans le webmail.
    const base = fauxAdmin().admin as unknown as { from: unknown }
    const admin = { from: base.from, rpc: async () => ({ data: JSON.stringify({ password: 'ancien' }), error: null }) } as never
    await expect(imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boiteType())))).rejects.toMatchObject({ code: 'reauth_required' })
  })
})

describe('cleDeFil', () => {
  it('sans message cité connu, la RACINE des References fait la clé — la même pour tout le fil', async () => {
    const { admin } = fauxAdmin()
    const m = { references: ['<racine@ex>', '<milieu@ex>'], inReplyTo: '<milieu@ex>', rfc822MessageId: '<fin@ex>', providerMessageId: 'INBOX:1:9' }
    expect(await cleDeFil(admin, 'acc-1', m as never)).toBe('<racine@ex>')
  })
})

// ── Gestes et envoi ───────────────────────────────────────────────────────────
describe('imapApply', () => {
  it('archiver déplace le message ENTRANT et rend son nouvel identifiant ; la copie « Envoyés » ne bouge pas', async () => {
    const boite = boiteType()
    const imap = fauxImap(boite)
    const { admin } = fauxAdmin()
    const renomme = await imapApply(admin, compte(), 'archive', [
      { provider_message_id: 'INBOX:7:1', direction: 'inbound', rfc822_message_id: '<m1@ex.ch>' },
      { provider_message_id: 'Sent:8:1', direction: 'outbound', rfc822_message_id: '<s1@agence.ch>' },
    ], branche(imap))
    expect(renomme).toEqual({ 'INBOX:7:1': 'Archive:9:1' })
    expect(boite.Archive.messages.map((m) => m.uid)).toEqual([1])
    expect(boite.Sent.messages).toHaveLength(1)
  })

  it('marquer lu pose \\Seen dans la vraie boîte', async () => {
    const boite = boiteType()
    const { admin } = fauxAdmin()
    await imapApply(admin, compte(), 'mark_read', [{ provider_message_id: 'INBOX:7:2', direction: 'inbound' }], branche(fauxImap(boite)))
    expect(boite.INBOX.messages.find((m) => m.uid === 2)!.flags).toContain('\\Seen')
  })

  it('une boîte sans dossier d’archive en reçoit un au premier archivage', async () => {
    const boite = boiteType()
    delete (boite as Partial<typeof boite>).Archive
    const imap = fauxImap(boite)
    const { admin } = fauxAdmin()
    const renomme = await imapApply(admin, compte(), 'archive', [{ provider_message_id: 'INBOX:7:3', direction: 'inbound' }], branche(imap))
    expect(imap.journal.some((l) => / CREATE "Archive"$/.test(l))).toBe(true)
    expect(renomme['INBOX:7:3']).toBe('Archive:99:1')
  })
})

describe('imapSend', () => {
  it('SMTP sans l’en-tête Cci, puis dépôt dans « Envoyés » avec lui', async () => {
    const boite = boiteType()
    const smtp = fauxSmtp()
    const { admin } = fauxAdmin()
    const raw = courrier({ id: '<neuf@agence.ch>', de: 'G <g@agence.ch>' }).replace('Subject:', 'Bcc: secret@ex.ch\r\nSubject:')
    const r = await imapSend(admin, compte(), raw, ['zoe@ex.ch', 'secret@ex.ch'], branche(fauxImap(boite), smtp))
    expect(r.appendError).toBeNull()
    expect(smtp.recu.rcpts).toEqual(['zoe@ex.ch', 'secret@ex.ch'])
    expect(smtp.recu.data).not.toContain('Bcc:')
    const depose = boite.Sent.messages.find((m) => m.raw.includes('<neuf@agence.ch>'))!
    expect(depose.raw).toContain('Bcc: secret@ex.ch')
    expect(depose.flags).toEqual(['\\Seen'])
  })
})

describe('imapTestConnexion', () => {
  it('rend un CODE par étape : identifiants IMAP refusés', async () => {
    const cfg = compte().imap_config!
    const r = await imapTestConnexion(cfg, 'faux', branche(fauxImap(boiteType()), fauxSmtp()))
    expect(r).toMatchObject({ ok: false, code: 'imap_auth' })
  })
  it('les deux serveurs répondent : ok', async () => {
    const cfg = compte().imap_config!
    expect(await imapTestConnexion(cfg, MOT_DE_PASSE, branche(fauxImap(boiteType()), fauxSmtp()))).toEqual({ ok: true })
  })
  it('un certificat qui ne vaut pas pour le nom saisi se DIT : imap_certificate, smtp_certificate', async () => {
    const cfg = compte().imap_config!
    const refuse: Duplex = {
      async read() { throw new Error('invalid peer certificate: certificate not valid for name "mail.agence.ch"') },
      async write() {},
      close() {},
    }
    expect(await imapTestConnexion(cfg, MOT_DE_PASSE, { dial: async () => refuse })).toMatchObject({ ok: false, code: 'imap_certificate' })
    const imap = fauxImap(boiteType())
    expect(await imapTestConnexion(cfg, MOT_DE_PASSE, { dial: async (h) => (h.startsWith('smtp') ? refuse : imap.duplex) }))
      .toMatchObject({ ok: false, code: 'smtp_certificate' })
  })
  it('⛔ le port 143 sans STARTTLS annoncé : imap_starttls, et le mot de passe n’est jamais parti', async () => {
    const enc = new TextEncoder()
    const queue = [enc.encode('* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN] ready\r\n')]
    const envoye: string[] = []
    const clair: Duplex = {
      async read() { return queue.shift() ?? null },
      async write(b) { envoye.push(new TextDecoder().decode(b)) },
      close() {},
      startTls: async () => { throw new Error('ne doit pas monter') },
    }
    const r = await imapTestConnexion({ ...compte().imap_config!, imapPort: 143 }, MOT_DE_PASSE, { dial: async () => clair })
    expect(r).toMatchObject({ ok: false, code: 'imap_starttls' })
    expect(envoye.join('')).not.toContain(MOT_DE_PASSE)
  })
  it('le PORT décide du chiffrement : 993/465 d’emblée, 143/587 par STARTTLS', () => {
    expect([imapSecurite(993), imapSecurite(143)]).toEqual(['tls', 'starttls'])
    expect([smtpSecurite({ smtpPort: 465 }), smtpSecurite({ smtpPort: 587 })]).toEqual(['tls', 'starttls'])
  })
})

