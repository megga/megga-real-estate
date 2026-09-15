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
import type { DialOptions, Duplex } from './duplex.ts'
import type { MailAccountRow } from './types.ts'
import {
  cleDeFil, decodeMUtf7, dialVerifie, imapApply, imapAttachment, imapSecurite, imapSend, imapSyncPass, imapTestConnexion, resolveFolders, rienRetrouve, smtpSecurite, splitProviderId,
} from './imap.ts'
import { applyRemoteChanges } from './ingest.ts'
import { syncAccount } from './sync.ts'

// ── Une boîte en mémoire ──────────────────────────────────────────────────────
interface Msg { uid: number; flags: string[]; raw: string; date: string }
interface Dossier { uidValidity: number; uidNext: number; attrs: string[]; messages: Msg[] }

const MOT_DE_PASSE = 'bon-mot-de-passe'

/** Un message RFC 822 minimal. */
function courrier(o: { id: string; de?: string; a?: string; repondreA?: string; objet?: string; refs?: string; corps?: string }): string {
  return [
    `From: ${o.de ?? 'Zoé <zoe@ex.ch>'}`,
    `To: ${o.a ?? 'g@agence.ch'}`,
    ...(o.repondreA ? [`Reply-To: ${o.repondreA}`] : []),
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

/** `refusLogin` : la réponse du serveur au LOGIN, quel que soit le mot de passe (`NO [INUSE] …`). */
function fauxImap(boite: Record<string, Dossier>, caps = 'IMAP4rev1 UIDPLUS MOVE', refusLogin?: string) {
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
        dire(refusLogin ? `${tag} ${refusLogin}\r\n`
          : m[2] === MOT_DE_PASSE ? `${tag} OK [CAPABILITY ${caps}] Logged in\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Authentication failed.\r\n`)
      } else if (cmd === 'CAPABILITY') {
        dire(`* CAPABILITY ${caps}\r\n${tag} OK\r\n`)
      } else if (cmd === 'LIST "" "*"') {
        dire(Object.entries(boite).map(([n, x]) => `* LIST (${x.attrs.join(' ')}) "/" "${n}"\r\n`).join('') + `${tag} OK\r\n`)
      } else if ((m = cmd.match(/^(SELECT|EXAMINE) "(.*)"$/))) {
        const x = boite[m[2]]
        if (!x) { dire(`${tag} NO no such mailbox\r\n`); return }
        courant = m[2]
        dire(`* ${x.messages.length} EXISTS\r\n* OK [UIDVALIDITY ${x.uidValidity}] ok\r\n* OK [UIDNEXT ${x.uidNext}] ok\r\n${tag} OK done\r\n`)
      } else if (d && (m = cmd.match(/^UID SEARCH SINCE (\S+)$/))) {
        // SINCE compare des JOURS (RFC 3501) : la date interne, sans l'heure.
        const jour = (x: string) => Date.parse(x.split(' ')[0].replace(/-/g, ' '))
        dire(`* SEARCH ${d.messages.filter((x) => jour(x.date) >= jour(m![1])).map((x) => x.uid).join(' ')}\r\n${tag} OK\r\n`)
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
type Reponse = { data: unknown; error: { message: string } | null }

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

/** `contacts` : adresse → contact, ce que la RPC de rapprochement rendrait (vide par défaut). */
function fauxAdmin(tables: Record<string, Ligne[]> = {}, contacts: Record<string, string> = {}) {
  const t = (n: string) => (tables[n] ??= [])
  let seq = 0
  const from = (table: string) => {
    const filtres: ((l: Ligne) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let charge: Ligne | Ligne[] | null = null
    let conflit: { col: string; ignorer: boolean } | null = null
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
      if (op === 'upsert') {
        const l = charge as Ligne
        const la = conflit ? t(table).find((x) => x[conflit!.col] === l[conflit!.col]) : undefined
        if (la) { if (!conflit!.ignorer) Object.assign(la, l); return [] }
        t(table).push({ id: `${table}-${++seq}`, ...l })
        return []
      }
      if (op === 'delete') { tables[table] = t(table).filter((l) => !lignes.includes(l)); return lignes }
      if (tri) { const { col, asc } = tri; lignes = [...lignes].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1)) }
      return lignes.slice(0, limite)
    }
    /** L'index unique (compte, identifiant) de `mail_messages`, comme la vraie table : un doublon est REFUSÉ. */
    const refus = (): Reponse | null => {
      if (table !== 'mail_messages' || (op !== 'insert' && op !== 'update')) return null
      const visees = op === 'update' ? t(table).filter((l) => filtres.every((f) => f(l))) : []
      const apres = op === 'insert' ? (Array.isArray(charge) ? charge : [charge!]) : visees.map((l) => ({ ...l, ...(charge as Ligne) }))
      const doublon = apres.some((n) => t(table).some((l) => !visees.includes(l) && l.account_id === n.account_id && l.provider_message_id === n.provider_message_id))
      return doublon ? { data: null, error: { message: 'duplicate key value violates unique constraint "mail_messages_account_provider_uniq"' } } : null
    }
    const b = {
      select: () => b,
      insert: (l: Ligne | Ligne[]) => { op = 'insert'; charge = l; return b },
      update: (l: Ligne) => { op = 'update'; charge = l; return b },
      delete: () => { op = 'delete'; return b },
      eq: (c: string, v: unknown) => { filtres.push((l) => l[c] === v); return b },
      neq: (c: string, v: unknown) => { filtres.push((l) => l[c] !== v); return b },
      lt: (c: string, v: unknown) => { filtres.push((l) => String(l[c]) < String(v)); return b },
      upsert: (l: Ligne, o?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
        op = 'upsert'; charge = l; conflit = o?.onConflict ? { col: o.onConflict, ignorer: !!o.ignoreDuplicates } : null; return b
      },
      in: (c: string, v: unknown[]) => { filtres.push((l) => v.includes(l[c])); return b },
      is: (c: string, v: unknown) => { filtres.push((l) => (l[c] ?? null) === v); return b },
      like: (c: string, motif: string) => { const re = likeEnRegex(motif); filtres.push((l) => re.test(String(l[c]))); return b },
      order: (col: string, o?: { ascending?: boolean }) => { tri = { col, asc: o?.ascending !== false }; return b },
      limit: (n: number) => { limite = n; return b },
      maybeSingle: async (): Promise<Reponse> => refus() ?? { data: applique()[0] ?? null, error: null },
      single: async (): Promise<Reponse> => { const e = refus(); if (e) return e; const r = applique(); return r[0] ? { data: r[0], error: null } : { data: null, error: { message: 'no rows' } } },
      then: (res: (v: Reponse) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then((): Reponse => refus() ?? { data: applique(), error: null }).then(res, rej),
    }
    return b
  }
  const rpc = async (fn: string, args?: { p_emails?: string[] }) => {
    if (fn === 'mail_secret_read') return { data: JSON.stringify({ password: MOT_DE_PASSE }), error: null }
    if (fn === 'mail_match_contact_by_emails') return { data: [...new Set((args?.p_emails ?? []).map((e) => contacts[e]).filter(Boolean))], error: null }
    return { data: [], error: null }
  }
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

/** L'horloge des tests, figée : les fenêtres d'import (90 jours, 30 pour le Spam) se comptent depuis elle. */
const MAINTENANT = Date.parse('2026-09-14T12:00:00Z')

const branche = (imap: ReturnType<typeof fauxImap>, smtp?: ReturnType<typeof fauxSmtp>) => ({
  dial: async (host: string) => (host.startsWith('smtp') ? smtp!.duplex : imap.duplex),
  now: () => MAINTENANT,
})

// ── Dossiers ──────────────────────────────────────────────────────────────────
describe('les dossiers', () => {
  it('l’usage spécial d’abord, puis les noms — sous INBOX. et en UTF-7 modifié compris', () => {
    expect(resolveFolders([
      { name: 'INBOX', attributes: [] }, { name: 'INBOX.Envoy&AOk-s', attributes: [] },
      { name: 'Corbeille', attributes: [] }, { name: 'Tout', attributes: ['\\Archive'] },
    ])).toEqual({ inbox: 'INBOX', sent: 'INBOX.Envoy&AOk-s', archive: 'Tout', trash: 'Corbeille', junk: null, prefixe: 'INBOX.' })
  })
  it('le Spam : l usage spécial \\Junk d abord, puis les noms — « Bulk Mail » de Yahoo, « Spamverdacht » de GMX', () => {
    expect(resolveFolders([{ name: 'INBOX', attributes: [] }, { name: 'Indésirables', attributes: ['\\Junk'] }, { name: 'Spam', attributes: [] }]).junk).toBe('Indésirables')
    expect(resolveFolders([{ name: 'INBOX', attributes: [] }, { name: 'INBOX.Spam', attributes: [] }]).junk).toBe('INBOX.Spam')
    expect(resolveFolders([{ name: 'INBOX', attributes: [] }, { name: 'Bulk Mail', attributes: [] }]).junk).toBe('Bulk Mail')
    expect(resolveFolders([{ name: 'INBOX', attributes: [] }, { name: 'Spamverdacht', attributes: [] }]).junk).toBe('Spamverdacht')
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
    expect(renomme).toEqual({ renamed: { 'INBOX:7:1': 'Archive:9:1' }, introuvables: [] })
    expect(boite.Archive.messages.map((m) => m.uid)).toEqual([1])
    expect(boite.Sent.messages).toHaveLength(1)
  })

  it('marquer lu pose \\Seen dans la vraie boîte', async () => {
    const boite = boiteType()
    const { admin } = fauxAdmin()
    await imapApply(admin, compte(), 'mark_read', [{ provider_message_id: 'INBOX:7:2', direction: 'inbound' }], branche(fauxImap(boite)))
    expect(boite.INBOX.messages.find((m) => m.uid === 2)!.flags).toContain('\\Seen')
  })

  // ⛔ Un UID ne vaut que sous son UIDVALIDITY : après un dossier recréé (ou un changement
  // d'hébergeur, que la reconnexion ne voit pas), « Supprimer » envoyait à la corbeille le
  // courrier d'un autre, et l'aperçu servait la pièce d'un autre message.
  it('⛔ un dossier RECRÉÉ (autre UIDVALIDITY) : gestes et pièces refusés, rien ne bouge dans la boîte', async () => {
    const boite = boiteType()
    boite.INBOX.uidValidity = 70
    const { admin } = fauxAdmin()
    for (const [geste, pid] of [['trash', 'INBOX:7:1'], ['mark_read', 'INBOX:7:2'], ['archive', 'INBOX:7:3']] as const) {
      const imap = fauxImap(boite)
      await expect(imapApply(admin, compte(), geste, [{ provider_message_id: pid, direction: 'inbound' }], branche(imap))).rejects.toThrow(/recréé/)
      expect(imap.journal.some((l) => /UID (MOVE|STORE)/.test(l)), geste).toBe(false)
    }
    expect(boite.INBOX.messages.map((m) => [m.uid, m.flags])).toEqual([[1, ['\\Seen']], [2, []], [3, ['\\Flagged']]])
    expect(boite.Trash.messages).toHaveLength(0)
    const imap = fauxImap(boite)
    await expect(imapAttachment(admin, compte(), 'INBOX:7:1', 0, branche(imap))).rejects.toThrow(/recréé/)
    expect(imap.journal.some((l) => /BODY\.PEEK/.test(l))).toBe(false)
    // Témoin : sous la bonne UIDVALIDITY, le même geste passe.
    await imapApply(admin, compte(), 'mark_read', [{ provider_message_id: 'INBOX:70:2', direction: 'inbound' }], branche(fauxImap(boite)))
    expect(boite.INBOX.messages.find((m) => m.uid === 2)!.flags).toContain('\\Seen')
  })

  // ⛔ Archivé depuis le téléphone ou le webmail, un message quitte la Réception sous un nouvel
  // UID que la synchro ne voit pas : la ligne gardait `INBOX:…`. « Désarchiver » visait la
  // Réception, n'y trouvait rien à déplacer, répondait ok — et la passe suivante ré-archivait.
  describe('⛔ un message rangé ailleurs depuis un autre client', () => {
    const M3 = { provider_message_id: 'INBOX:7:3', direction: 'inbound' as const, rfc822_message_id: '<m3@ex.ch>', sent_at: '2026-09-10T08:00:00+00:00' }
    /** Le webmail range le message : même INTERNALDATE (RFC 6851), un nouvel UID là-bas. */
    const ranger = (boite: Record<string, Dossier>, uid: number, vers: string) => {
      const m = boite.INBOX.messages.find((x) => x.uid === uid)!
      boite.INBOX.messages = boite.INBOX.messages.filter((x) => x !== m)
      boite[vers].messages.push({ ...m, uid: boite[vers].uidNext++ })
    }

    it('« Désarchiver » le trouve dans l Archive et le RAMÈNE — son identifiant suit', async () => {
      const boite = boiteType()
      ranger(boite, 3, 'Archive')
      const imap = fauxImap(boite)
      const r = await imapApply(fauxAdmin().admin, compte(), 'unarchive', [M3], branche(imap))
      expect(boite.INBOX.messages.map((m) => m.raw.includes('<m3@ex.ch>') ? m.uid : null).filter(Boolean)).toEqual([4])
      expect(boite.Archive.messages).toEqual([])
      expect(r).toEqual({ renamed: { 'INBOX:7:3': 'INBOX:7:4' }, introuvables: [] })
    })

    it('« Supprimer » le déplace de l Archive, où il est — pas un UID absent de la Réception', async () => {
      const boite = boiteType()
      ranger(boite, 3, 'Archive')
      const imap = fauxImap(boite)
      const r = await imapApply(fauxAdmin().admin, compte(), 'trash', [M3], branche(imap))
      expect(boite.Archive.messages).toEqual([])
      expect(boite.Trash.messages.map((m) => m.raw.includes('<m3@ex.ch>'))).toEqual([true])
      expect(r.renamed).toEqual({ 'INBOX:7:3': 'Trash:10:1' })
      expect(imap.journal.filter((l) => /UID MOVE/.test(l)), 'un seul déplacement, depuis l Archive').toEqual([expect.stringMatching(/UID MOVE 1 "Trash"$/)])
    })

    // Ouvrir un fil le marque lu : un message supprimé dans le webmail coûterait, à chaque
    // ouverture, une recherche dans quatre dossiers.
    it('un DRAPEAU ne cherche pas : il se pose là où la base le croit, sans vérifier ni fouiller', async () => {
      const boite = boiteType()
      ranger(boite, 3, 'Archive')
      const imap = fauxImap(boite)
      const r = await imapApply(fauxAdmin().admin, compte(), 'mark_read', [M3], branche(imap))
      expect(imap.journal.filter((l) => /UID SEARCH/.test(l))).toEqual([])
      expect(imap.journal.filter((l) => /UID STORE/.test(l))).toEqual([expect.stringMatching(/UID STORE 3 \+FLAGS\.SILENT \(\\Seen\)$/)])
      expect(r).toEqual({ renamed: {}, introuvables: [] })
    })

    it('introuvable : RENDU pour un geste qui le ramènerait en Réception — jamais un ok muet', async () => {
      const boite = boiteType()
      boite.INBOX.messages = boite.INBOX.messages.filter((x) => x.uid !== 3) // supprimé dans le webmail
      const imap = fauxImap(boite)
      expect(await imapApply(fauxAdmin().admin, compte(), 'unarchive', [M3], branche(imap))).toEqual({ renamed: {}, introuvables: ['INBOX:7:3'] })
      // Archiver ou supprimer un message qui n'est plus en Réception atteint son but sans rien déplacer.
      expect(await imapApply(fauxAdmin().admin, compte(), 'trash', [M3], branche(fauxImap(boite)))).toEqual({ renamed: {}, introuvables: [] })
      expect(imap.journal.some((l) => /UID MOVE/.test(l))).toBe(false)
    })

    it('⛔ jamais par le seul Message-ID : un autre courrier qui le reprend, arrivé à une autre date, n est pas lui', async () => {
      const boite = boiteType()
      boite.INBOX.messages = boite.INBOX.messages.filter((x) => x.uid !== 3)
      boite.Archive.messages.push({ uid: boite.Archive.uidNext++, flags: [], raw: courrier({ id: '<m3@ex.ch>', de: 'Pirate <x@evil.ex>' }), date: '11-Sep-2026 10:00:00 +0200' })
      const r = await imapApply(fauxAdmin().admin, compte(), 'unarchive', [M3], branche(fauxImap(boite)))
      expect(r).toEqual({ renamed: {}, introuvables: ['INBOX:7:3'] })
      expect(boite.Archive.messages).toHaveLength(1)
    })

    it('avant un déplacement, la présence se vérifie en UNE commande par dossier', async () => {
      const imap = fauxImap(boiteType())
      await imapApply(fauxAdmin().admin, compte(), 'archive', [
        { provider_message_id: 'INBOX:7:1', direction: 'inbound' }, { provider_message_id: 'INBOX:7:2', direction: 'inbound' },
      ], branche(imap))
      expect(imap.journal.filter((l) => / UID SEARCH UID /.test(l))).toEqual([expect.stringMatching(/UID SEARCH UID 1,2$/)])
    })

    it('rienRetrouve : un fil échoue quand AUCUN de ses entrants n a été retrouvé — pas pour un seul disparu', () => {
      const fil = [
        { provider_message_id: 'INBOX:7:1', direction: 'inbound' as const }, { provider_message_id: 'INBOX:7:2', direction: 'inbound' as const },
        { provider_message_id: 'Sent:8:1', direction: 'outbound' as const }, { provider_message_id: 'pending:<x@a>', direction: 'outbound' as const },
      ]
      expect(rienRetrouve(fil, new Set(['INBOX:7:1', 'INBOX:7:2']))).toBe(true)
      expect(rienRetrouve(fil, new Set(['INBOX:7:1']))).toBe(false)
      expect(rienRetrouve(fil.slice(2), new Set()), 'sans entrant, rien à ramener').toBe(false)
    })

    it('la synchro le suit : archivé dans le webmail → Archivé sous son identifiant d Archive ; mis à la corbeille → Corbeille', async () => {
      const boite = boiteType()
      const { admin, tables } = fauxAdmin()
      const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
      const ligne = (pid: string) => (tables.mail_messages as Ligne[]).find((m) => m.provider_message_id === pid)
      const fil = (pid: string) => (tables.mail_threads as Ligne[]).find((f) => f.id === ligne(pid)!.thread_id)!
      const idM3 = ligne('INBOX:7:3')!.id
      ranger(boite, 3, 'Archive')
      const seconde = await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
      expect(ligne('Archive:9:1')?.id).toBe(idM3)
      expect(fil('Archive:9:1')).toMatchObject({ is_archived: true, is_trashed: false })
      // Désarchivé dans le CRM : le geste le ramène (mail-actions réécrit l'identifiant), et la
      // passe suivante ne le ré-archive PLUS.
      const r = await imapApply(admin, compte(), 'unarchive', [{ ...M3, provider_message_id: 'Archive:9:1' }], branche(fauxImap(boite)))
      expect(r.renamed).toEqual({ 'Archive:9:1': 'INBOX:7:4' })
      Object.assign(ligne('Archive:9:1')!, { provider_message_id: 'INBOX:7:4' })
      Object.assign(fil('INBOX:7:4'), { is_archived: false })
      await imapSyncPass(admin, compte(), seconde.cursor, 20_000, branche(fauxImap(boite)))
      expect(fil('INBOX:7:4').is_archived).toBe(false)
      expect((tables.mail_messages as Ligne[]).filter((m) => m.rfc822_message_id === '<m3@ex.ch>')).toHaveLength(1)

      // Le fil de m1/m2 : m2, son dernier entrant, part à la corbeille du webmail.
      ranger(boite, 2, 'Trash')
      await imapSyncPass(admin, compte(), seconde.cursor, 20_000, branche(fauxImap(boite)))
      expect(fil('Trash:10:1')).toMatchObject({ is_trashed: true, is_archived: false })
    })

    it('une AUTRE ligne porte déjà l identifiant d arrivée (un doublon du courrier) : archivé sans renommer — la passe ne lève pas', async () => {
      const boite = boiteType()
      const { admin, tables } = fauxAdmin()
      const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
      const x = (tables.mail_messages as Ligne[]).find((m) => m.provider_message_id === 'INBOX:7:3')!
      ;(tables.mail_messages as Ligne[]).push({ ...x, id: 'doublon', provider_message_id: 'Archive:9:1' })
      ranger(boite, 3, 'Archive')
      await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
      expect(x.provider_message_id).toBe('INBOX:7:3')
      expect((tables.mail_threads as Ligne[]).find((f) => f.id === x.thread_id)).toMatchObject({ is_archived: true })
    })
  })

  // ⛔ Courier (cPanel) range tout sous la Réception : `CREATE "Archive"` à la racine y est
  // refusé, et archiver rendait 502 (revue du 15.09.2026).
  it('une boîte dont les dossiers vivent sous INBOX. y crée son Archive et son Spam', async () => {
    const boite = boiteType()
    // Sans usage spécial annoncé : les dossiers se reconnaissent à leur nom, sous « INBOX. ».
    const cpanel: Record<string, Dossier> = { INBOX: boite.INBOX, 'INBOX.Sent': { ...boite.Sent, attrs: [] }, 'INBOX.Trash': { ...boite.Trash, attrs: [] } }
    const imap = fauxImap(cpanel)
    const { admin } = fauxAdmin()
    const r = await imapApply(admin, compte(), 'archive', [{ provider_message_id: 'INBOX:7:3', direction: 'inbound' }], branche(imap))
    expect(imap.journal.some((l) => / CREATE "INBOX\.Archive"$/.test(l))).toBe(true)
    expect(r.renamed['INBOX:7:3']).toBe('INBOX.Archive:99:1')
    const s2 = await imapApply(admin, compte(), 'spam', [{ provider_message_id: 'INBOX:7:2', direction: 'inbound' }], branche(fauxImap(cpanel)))
    expect(s2.renamed['INBOX:7:2']).toBe('INBOX.Junk:99:1')
    // Témoin : une boîte aux dossiers à la racine crée les siens à la racine.
    expect(resolveFolders([{ name: 'INBOX', attributes: [] }, { name: 'Sent', attributes: ['\\Sent'] }, { name: 'INBOX/Clients', attributes: [] }]).prefixe).toBe('')
  })

  it('une boîte sans dossier d’archive en reçoit un au premier archivage', async () => {
    const boite = boiteType()
    delete (boite as Partial<typeof boite>).Archive
    const imap = fauxImap(boite)
    const { admin } = fauxAdmin()
    const renomme = await imapApply(admin, compte(), 'archive', [{ provider_message_id: 'INBOX:7:3', direction: 'inbound' }], branche(imap))
    expect(imap.journal.some((l) => / CREATE "Archive"$/.test(l))).toBe(true)
    expect(renomme.renamed['INBOX:7:3']).toBe('Archive:99:1')
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

// ── Le dossier Spam (14.09.2026) ─────────────────────────────────────────────
describe('le dossier Spam', () => {
  /** La boîte type, plus un dossier Spam annoncé `\Junk` qui porte un courrier au nom de Zoé — une adresse CONNUE. */
  const boiteAvecSpam = (): Record<string, Dossier> => ({
    ...boiteType(),
    Junk: {
      uidValidity: 11, uidNext: 2, attrs: ['\\Junk'], messages: [
        { uid: 1, flags: [], raw: courrier({ id: '<s1@spam.ex>', objet: 'Votre colis est bloqué' }), date: '10-Sep-2026 12:00:00 +0200' },
      ],
    },
  })
  const CONTACTS = { 'zoe@ex.ch': 'c-zoe' }
  const messages = (t: Record<string, Ligne[]>) => (t.mail_messages ?? []) as Ligne[]
  const ligne = (t: Record<string, Ligne[]>, pid: string) => messages(t).find((m) => m.provider_message_id === pid)!
  const filDe = (t: Record<string, Ligne[]>, pid: string) => (t.mail_threads as Ligne[]).find((f) => f.id === ligne(t, pid).thread_id)!
  const auJournal = (t: Record<string, Ligne[]>, messageId: unknown) =>
    ((t.activity_events ?? []) as Ligne[]).filter((e) => (e.metadata as { message_id?: unknown } | null)?.message_id === messageId)

  it('⛔ reçu au Spam : au spam, jamais archivé, rattaché à PERSONNE — même au nom d une adresse connue', async () => {
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boiteAvecSpam())))
    expect(filDe(tables, 'Junk:11:1')).toMatchObject({ is_spam: true, is_archived: false, contact_id: null })
    expect(ligne(tables, 'Junk:11:1')).toMatchObject({ is_spam: true, contact_id: null })
    expect(auJournal(tables, ligne(tables, 'Junk:11:1').id)).toHaveLength(0)
    // Contrôle positif : le courrier de Zoé en Réception, lui, est rattaché et journalisé.
    expect(filDe(tables, 'INBOX:7:1').contact_id).toBe('c-zoe')
    expect(auJournal(tables, ligne(tables, 'INBOX:7:1').id)).toHaveLength(1)
  })

  it('envoyé au Spam dans le webmail : rebaptisé, au spam — et PLUS dans Archivé', async () => {
    const boite = boiteAvecSpam()
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const m3 = boite.INBOX.messages.find((m) => m.uid === 3)!
    boite.INBOX.messages = boite.INBOX.messages.filter((m) => m !== m3)
    boite.Junk.messages.push({ ...m3, uid: boite.Junk.uidNext++ })
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    const ids = messages(tables).map((m) => m.provider_message_id)
    expect(ids).toContain('Junk:11:2')
    expect(ids).not.toContain('INBOX:7:3')
    expect(filDe(tables, 'Junk:11:2')).toMatchObject({ is_spam: true, is_archived: false })
  })

  // ⛔ Le scénario de la revue du 15.09.2026 : un hameçonnage au nom de Zoé cite son échange
  // avec l'agence. Il rejoignait le vrai fil, qui partait ENTIER au Spam ; au courrier suivant
  // le fil revenait en Réception, l'hameçonnage glissé entre deux vrais messages.
  it('⛔ un hameçonnage au Spam n entre pas dans la conversation — ni par References, ni par un Message-ID repris', async () => {
    const boite = boiteType()
    boite.Junk = { uidValidity: 11, uidNext: 3, attrs: ['\\Junk'], messages: [
      { uid: 1, flags: [], raw: courrier({ id: '<iban@evil.ex>', de: 'Zoé <zoe@ex-ch.com>', objet: 'Re: Visite', refs: '<m1@ex.ch>', corps: 'Nouvel IBAN' }), date: '11-Sep-2026 10:00:00 +0200' },
      // Le Message-ID de m1 lui-même — la clé du vrai fil.
      { uid: 2, flags: [], raw: courrier({ id: '<m1@ex.ch>', de: 'Zoé <zoe@ex-ch.com>', objet: 'Re: Visite', corps: 'Nouvel IBAN' }), date: '12-Sep-2026 10:00:00 +0200' },
    ] }
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const conversation = filDe(tables, 'INBOX:7:1')
    expect(conversation).toMatchObject({ is_spam: false, contact_id: 'c-zoe' })
    expect(messages(tables).filter((m) => m.thread_id === conversation.id).map((m) => m.provider_message_id).sort()).toEqual(['INBOX:7:1', 'INBOX:7:2', 'Sent:8:1'])
    for (const pid of ['Junk:11:1', 'Junk:11:2']) {
      expect(filDe(tables, pid)).toMatchObject({ provider_thread_id: `spam:${pid}`, is_spam: true, contact_id: null })
    }
    // m1 n'a pas été pris pour un message DÉPLACÉ : sa ligne est intacte.
    expect(ligne(tables, 'INBOX:7:1')).toMatchObject({ from_email: 'zoe@ex.ch', is_spam: false })
  })

  it('un courrier qui ne cite QU UN spam ne l arrache pas au Spam', async () => {
    const boite = boiteAvecSpam()
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    boite.INBOX.messages.push({ uid: 4, flags: [], raw: courrier({ id: '<suite@spam.ex>', objet: 'Re: Votre colis est bloqué', refs: '<s1@spam.ex>' }), date: '12-Sep-2026 10:00:00 +0200' })
    boite.INBOX.uidNext = 5
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(filDe(tables, 'INBOX:7:4').id).not.toBe(filDe(tables, 'Junk:11:1').id)
    expect(filDe(tables, 'Junk:11:1')).toMatchObject({ is_spam: true })
  })

  // ⛔ Rattaché et journalisé, envoyé au Spam puis rendu : son contact effacé au passage, il se
  // rejournalisait — une seconde ligne, append-only, pour un seul courrier.
  it('rattaché, envoyé au Spam puis rendu dans le webmail : UNE seule ligne au journal', async () => {
    const boite = boiteAvecSpam()
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    let curseur = (await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))).cursor
    const id = ligne(tables, 'INBOX:7:1').id
    expect(auJournal(tables, id)).toHaveLength(1)
    const m1 = boite.INBOX.messages.find((m) => m.uid === 1)!
    boite.INBOX.messages = boite.INBOX.messages.filter((m) => m !== m1)
    boite.Junk.messages.push({ ...m1, uid: boite.Junk.uidNext++ })
    curseur = (await imapSyncPass(admin, compte(), curseur, 20_000, branche(fauxImap(boite)))).cursor
    expect(ligne(tables, 'Junk:11:2')).toMatchObject({ id, is_spam: true, contact_id: 'c-zoe' })
    // Parti au Spam, il a quitté la conversation : elle reste en Réception.
    expect(filDe(tables, 'INBOX:7:2').is_spam).toBe(false)
    const auSpam = boite.Junk.messages.find((m) => m.uid === 2)!
    boite.Junk.messages = boite.Junk.messages.filter((m) => m !== auSpam)
    boite.INBOX.messages.push({ ...auSpam, uid: boite.INBOX.uidNext++ })
    await imapSyncPass(admin, compte(), curseur, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ id, is_spam: false })
    expect(filDe(tables, 'INBOX:7:4').id).toBe(filDe(tables, 'INBOX:7:2').id)
    expect(auJournal(tables, id)).toHaveLength(1)
  })

  it('remis en Réception dans le webmail : sort du spam, rattaché, et journalisé UNE seule fois', async () => {
    const boite = boiteAvecSpam()
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const s1 = boite.Junk.messages.find((m) => m.uid === 1)!
    boite.Junk.messages = boite.Junk.messages.filter((m) => m !== s1)
    boite.INBOX.messages.push({ ...s1, uid: boite.INBOX.uidNext++ })
    const seconde = await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ is_spam: false, contact_id: 'c-zoe' })
    expect(filDe(tables, 'INBOX:7:4')).toMatchObject({ is_spam: false, is_archived: false, contact_id: 'c-zoe' })
    expect(auJournal(tables, ligne(tables, 'INBOX:7:4').id)).toHaveLength(1)
    await imapSyncPass(admin, compte(), seconde.cursor, 20_000, branche(fauxImap(boite)))
    expect(auJournal(tables, ligne(tables, 'INBOX:7:4').id)).toHaveLength(1)
  })

  it('⛔ purgé du Spam par le fournisseur : il quitte le CRM — jamais Archivé', async () => {
    const boite = boiteAvecSpam()
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    boite.Junk.messages = []
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(messages(tables).map((m) => m.provider_message_id)).not.toContain('Junk:11:1')
    expect((tables.mail_threads as Ligne[]).some((f) => f.subject === 'Votre colis est bloqué')).toBe(false)
  })

  it('sorti du spam chez Gmail ou Outlook (un drapeau, sans déplacement d UID) : rattaché et journalisé', async () => {
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boiteAvecSpam())))
    await applyRemoteChanges(admin, compte(), [{ kind: 'flags', providerMessageId: 'Junk:11:1', isSpam: false, inInbox: true }])
    expect(filDe(tables, 'Junk:11:1')).toMatchObject({ is_spam: false, is_archived: false, contact_id: 'c-zoe' })
    expect(auJournal(tables, ligne(tables, 'Junk:11:1').id)).toHaveLength(1)
    // Rejoué, le même changement n'écrit pas une seconde ligne.
    await applyRemoteChanges(admin, compte(), [{ kind: 'flags', providerMessageId: 'Junk:11:1', isSpam: false, inInbox: true }])
    expect(auJournal(tables, ligne(tables, 'Junk:11:1').id)).toHaveLength(1)
  })

  it('le Spam n est importé que sur 30 jours — la Réception, elle, sur 90', async () => {
    const boite = boiteAvecSpam()
    boite.INBOX = { uidValidity: 7, uidNext: 3, attrs: [], messages: [
      { uid: 1, flags: [], raw: courrier({ id: '<vieux@ex.ch>', objet: 'Il y a quarante jours' }), date: '05-Aug-2026 10:00:00 +0200' },
      { uid: 2, flags: [], raw: courrier({ id: '<m2@ex.ch>' }), date: '10-Sep-2026 10:00:00 +0200' },
    ] }
    boite.Junk = { uidValidity: 11, uidNext: 3, attrs: ['\\Junk'], messages: [
      { uid: 1, flags: [], raw: courrier({ id: '<vieux@spam.ex>', objet: 'Vieux spam' }), date: '05-Aug-2026 12:00:00 +0200' },
      { uid: 2, flags: [], raw: courrier({ id: '<s1@spam.ex>', objet: 'Votre colis est bloqué' }), date: '10-Sep-2026 12:00:00 +0200' },
    ] }
    const { admin, tables } = fauxAdmin()
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const ids = messages(tables).map((m) => m.provider_message_id)
    expect(ids).toEqual(expect.arrayContaining(['INBOX:7:1', 'INBOX:7:2', 'Junk:11:2']))
    expect(ids).not.toContain('Junk:11:1')
  })

  it('⛔ une purge SOUS la fenêtre des 200 plus récents quitte aussi le CRM — un spam par heure pendant neuf jours', async () => {
    const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const deux = (x: number) => String(x).padStart(2, '0')
    const dateImap = (ms: number) => { const d = new Date(ms); return `${deux(d.getUTCDate())}-${MOIS[d.getUTCMonth()]}-${d.getUTCFullYear()} ${deux(d.getUTCHours())}:00:00 +0000` }
    const n = 205
    const boite = boiteType()
    boite.Junk = { uidValidity: 12, uidNext: n + 1, attrs: ['\\Junk'], messages: Array.from({ length: n }, (_, i) => ({
      uid: i + 1, flags: [], raw: courrier({ id: `<p${i + 1}@spam.ex>`, objet: `Promo ${i + 1}` }), date: dateImap(Date.parse('2026-09-05T00:00:00Z') + i * 3_600_000),
    })) }
    const { admin, tables } = fauxAdmin()
    let curseur: Awaited<ReturnType<typeof imapSyncPass>>['cursor'] | null = null
    for (let i = 0; i < 20; i++) {
      const r = await imapSyncPass(admin, compte(), curseur, 20_000, branche(fauxImap(boite)))
      curseur = r.cursor
      if (r.done) break
    }
    const auSpam = () => messages(tables).map((m) => String(m.provider_message_id)).filter((id) => id.startsWith('Junk:12:'))
    expect(auSpam()).toHaveLength(n)
    // Le fournisseur purge les trois plus anciens : ils sont SOUS la fenêtre des 200 plus récents.
    boite.Junk.messages = boite.Junk.messages.filter((m) => m.uid > 3)
    await imapSyncPass(admin, compte(), curseur, 20_000, branche(fauxImap(boite)))
    expect(auSpam()).toHaveLength(n - 3)
    expect(auSpam()).not.toContain('Junk:12:1')
    expect(auSpam()).toContain('Junk:12:4')
  })

  it('les gestes : « Spam » déplace vers le dossier Spam, « Pas un spam » le rend à la Réception', async () => {
    const boite = boiteAvecSpam()
    const { admin } = fauxAdmin()
    const aller = await imapApply(admin, compte(), 'spam', [{ provider_message_id: 'INBOX:7:3', direction: 'inbound' }], branche(fauxImap(boite)))
    expect(aller.renamed).toEqual({ 'INBOX:7:3': 'Junk:11:2' })
    const retour = await imapApply(admin, compte(), 'not_spam', [{ provider_message_id: 'Junk:11:2', direction: 'inbound' }], branche(fauxImap(boite)))
    expect(retour.renamed).toEqual({ 'Junk:11:2': 'INBOX:7:4' })
  })

  it('une boîte sans dossier Spam en reçoit un au premier signalement', async () => {
    const imap = fauxImap(boiteType())
    const { admin } = fauxAdmin()
    const r = await imapApply(admin, compte(), 'spam', [{ provider_message_id: 'INBOX:7:3', direction: 'inbound' }], branche(imap))
    expect(imap.journal.some((l) => / CREATE "Junk"$/.test(l))).toBe(true)
    expect(r.renamed['INBOX:7:3']).toBe('Junk:99:1')
  })
})

// ⛔ Le sens d'un message se décidait sur `From`, que l'expéditeur écrit (revue du 15.09.2026) :
// « Envoyés » OU `From` = la boîte. Rejoué ici de bout en bout — la synchro, le fil, le journal.
describe('le sens d un message ne se lit plus sur From', () => {
  const CONTACTS = { 'zoe@ex.ch': 'c-zoe' }
  const messages = (t: Record<string, Ligne[]>) => (t.mail_messages ?? []) as Ligne[]
  const ligne = (t: Record<string, Ligne[]>, pid: string) => messages(t).find((m) => m.provider_message_id === pid)!
  const filDe = (t: Record<string, Ligne[]>, pid: string) => (t.mail_threads as Ligne[]).find((f) => f.id === ligne(t, pid).thread_id)!
  const journal = (t: Record<string, Ligne[]>) => (t.activity_events ?? []) as Ligne[]
  const auJournal = (t: Record<string, Ligne[]>, messageId: unknown) => journal(t).filter((e) => (e.metadata as { message_id?: unknown } | null)?.message_id === messageId)
  const recu = (boite: Record<string, Dossier>, dossier: string, raw: string, date = '12-Sep-2026 10:00:00 +0200') => {
    boite[dossier].messages.push({ uid: boite[dossier].uidNext++, flags: [], raw, date })
  }

  it('⛔ l arnaque qui usurpe l adresse de la boîte, rangée au Spam : au Spam, entrante — jamais dans « Envoyés »', async () => {
    const boite = boiteType()
    boite.Junk = { uidValidity: 11, uidNext: 1, attrs: ['\\Junk'], messages: [] }
    recu(boite, 'Junk', courrier({ id: '<pirate@evil.ex>', de: 'G <g@agence.ch>', a: 'g@agence.ch', objet: 'J ai piraté votre compte' }))
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'Junk:11:1')).toMatchObject({ direction: 'inbound', is_spam: true, contact_id: null })
    expect(filDe(tables, 'Junk:11:1')).toMatchObject({ is_spam: true, last_outbound_at: null })
    expect(auJournal(tables, ligne(tables, 'Junk:11:1').id)).toEqual([])
  })

  it('⛔ un tiers écrit au nom de la boîte, un client en destinataire : jamais un « e-mail envoyé » au dossier du client', async () => {
    const boite = boiteType()
    recu(boite, 'INBOX', courrier({ id: '<faux@evil.ex>', de: 'Gregory <g@agence.ch>', a: 'Zoé <zoe@ex.ch>', objet: 'Je confirme la réduction de commission' }))
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ direction: 'outbound', contact_id: 'c-zoe' })
    expect(auJournal(tables, ligne(tables, 'INBOX:7:4').id)).toEqual([])
    // Témoin : la vraie réponse de l'agent, rangée dans « Envoyés », est l'envoi — et au journal.
    expect(auJournal(tables, ligne(tables, 'Sent:8:1').id).map((e) => e.action)).toEqual(['email_sent'])
  })

  it('un formulaire de site qui écrit au nom de la boîte, Reply-To = le prospect : en Réception, pas dans « Envoyés »', async () => {
    const boite = boiteType()
    recu(boite, 'INBOX', courrier({ id: '<form-1@agence.ch>', de: 'Site <g@agence.ch>', a: 'g@agence.ch', repondreA: 'Prospect <prospect@ex.ch>', objet: 'Demande de visite' }))
    const { admin, tables } = fauxAdmin()
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ direction: 'inbound', reply_to: 'prospect@ex.ch' })
    expect(filDe(tables, 'INBOX:7:4')).toMatchObject({ last_outbound_at: null, is_archived: false })
    expect(filDe(tables, 'INBOX:7:4').last_inbound_at).not.toBeNull()
  })

  it('un envoi du CRM en copie à soi : l exemplaire de la Réception ne prend pas la ligne pending:, la copie « Envoyés » la prend', async () => {
    const MID = '<crm-1@agence.ch>'
    const boite = boiteType()
    const envoi = courrier({ id: MID, de: 'G <g@agence.ch>', a: 'zoe@ex.ch', objet: 'Dossier de vente' })
    recu(boite, 'INBOX', envoi, '12-Sep-2026 10:00:00 +0200')
    recu(boite, 'Sent', envoi, '12-Sep-2026 10:00:01 +0200')
    // Ce que `mail-send` a laissé : la ligne provisoire, rattachée, et SA ligne au journal.
    const { admin, tables } = fauxAdmin({
      mail_threads: [{ id: 'T-p', account_id: 'acc-1', agency_id: 'ag-1', provider_thread_id: `pending-thread:${MID}`, subject: 'Dossier de vente', participants: [], message_count: 1, last_message_at: '2026-09-12T08:00:00.000Z', last_inbound_at: null, last_outbound_at: '2026-09-12T08:00:00.000Z', is_read: true, is_starred: false, is_archived: false, is_trashed: false, is_spam: false, has_attachments: false, contact_id: 'c-zoe' }],
      mail_messages: [{ id: 'M-p', thread_id: 'T-p', account_id: 'acc-1', agency_id: 'ag-1', provider_message_id: `pending:${MID}`, rfc822_message_id: MID, direction: 'outbound', contact_id: 'c-zoe', is_spam: false, is_read: true, sent_at: '2026-09-12T08:00:00.000Z' }],
      activity_events: [{ id: 'ev-crm', agency_id: 'ag-1', action: 'email_sent', actor_kind: 'user', metadata: { message_id: 'M-p' } }],
    }, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(ligne(tables, 'Sent:8:2').id, 'la copie « Envoyés » reprend la ligne de l envoi').toBe('M-p')
    expect(ligne(tables, 'INBOX:7:4').id).not.toBe('M-p')
    expect(messages(tables).some((m) => String(m.provider_message_id).startsWith('pending:'))).toBe(false)
    expect(journal(tables).filter((e) => e.action === 'email_sent' && [ligne(tables, 'Sent:8:2').id, ligne(tables, 'INBOX:7:4').id].includes((e.metadata as { message_id: string }).message_id)), 'un envoi, une ligne — celle de l agent').toHaveLength(1)
  })

  it('envoyé DEPUIS le webmail en copie à soi : la copie « Envoyés » a sa ligne, l exemplaire de la Réception n en a pas', async () => {
    const MID = '<webmail-1@agence.ch>'
    const boite = boiteType()
    const envoi = courrier({ id: MID, de: 'G <g@agence.ch>', a: 'zoe@ex.ch', objet: 'Votre offre' })
    // Arrivés dans la MÊME seconde : seul le côté de la boîte (« Envoyés » ou non) les distingue —
    // sans lui, la copie « Envoyés » passait pour l'exemplaire de la Réception DÉPLACÉ.
    recu(boite, 'INBOX', envoi, '12-Sep-2026 10:00:00 +0200')
    recu(boite, 'Sent', envoi, '12-Sep-2026 10:00:00 +0200')
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(auJournal(tables, ligne(tables, 'INBOX:7:4').id)).toEqual([])
    expect(auJournal(tables, ligne(tables, 'Sent:8:2').id).map((e) => e.action)).toEqual(['email_sent'])
    // Rejoué, rien ne s'ajoute.
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    expect(journal(tables).filter((e) => e.action === 'email_sent')).toHaveLength(2)
  })

  // ⛔ Le sens suit le dossier : écrit au nom de la boîte, il est entrant au Spam et sortant en
  // Réception. La reconnaissance d'un déplacement exigeait le MÊME sens : remis en Réception, il
  // naissait une seconde fois, et la passe du Spam voulait donner à l'ancienne ligne l'identifiant
  // de la nouvelle — l'unicité refusait, la passe levait, à chaque tick.
  it('⛔ un courrier au nom de la boîte, remis du Spam en Réception : reconnu, pas dupliqué — la passe ne lève pas', async () => {
    const boite = boiteType()
    boite.Junk = { uidValidity: 11, uidNext: 1, attrs: ['\\Junk'], messages: [] }
    recu(boite, 'Junk', courrier({ id: '<soi@agence.ch>', de: 'G <g@agence.ch>', a: 'g@agence.ch', objet: 'Note à moi-même' }), '11-Sep-2026 09:00:00 +0200')
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const id = ligne(tables, 'Junk:11:1').id
    const m = boite.Junk.messages.pop()!
    boite.INBOX.messages.push({ ...m, uid: boite.INBOX.uidNext++ })
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(messages(tables).filter((x) => x.rfc822_message_id === '<soi@agence.ch>').map((x) => [x.id, x.provider_message_id])).toEqual([[id, 'INBOX:7:4']])
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ is_spam: false, direction: 'outbound' })
  })

  it('⛔ déjà repris en Réception comme un courrier neuf (date d arrivée changée) : la ligne du Spam s efface au lieu de heurter l unicité', async () => {
    const boite = boiteType()
    boite.Junk = { uidValidity: 11, uidNext: 1, attrs: ['\\Junk'], messages: [] }
    recu(boite, 'Junk', courrier({ id: '<colis@ex.ch>', objet: 'Votre colis' }), '11-Sep-2026 09:00:00 +0200')
    const { admin, tables } = fauxAdmin({}, CONTACTS)
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const m = boite.Junk.messages.pop()!
    // Recopié plutôt que déplacé (un client qui télécharge puis redépose) : une autre INTERNALDATE.
    boite.INBOX.messages.push({ ...m, uid: boite.INBOX.uidNext++, date: '13-Sep-2026 08:00:00 +0200' })
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    expect(messages(tables).filter((x) => x.rfc822_message_id === '<colis@ex.ch>').map((x) => x.provider_message_id)).toEqual(['INBOX:7:4'])
    expect(ligne(tables, 'INBOX:7:4')).toMatchObject({ is_spam: false, contact_id: 'c-zoe' })
    expect(auJournal(tables, ligne(tables, 'INBOX:7:4').id)).toHaveLength(1)
  })
})

describe('imapTestConnexion', () => {
  it('rend un CODE par étape : identifiants IMAP refusés', async () => {
    const cfg = compte().imap_config!
    const r = await imapTestConnexion(cfg, 'faux', branche(fauxImap(boiteType()), fauxSmtp()))
    expect(r).toMatchObject({ ok: false, code: 'imap_auth' })
  })
  it('un refus qui passera se dit comme tel : imap_temporaire, pas « mot de passe refusé »', async () => {
    const cfg = compte().imap_config!
    const r = await imapTestConnexion(cfg, MOT_DE_PASSE, branche(fauxImap(boiteType(), undefined, 'NO [UNAVAILABLE] Temporary authentication failure'), fauxSmtp()))
    expect(r).toMatchObject({ ok: false, code: 'imap_temporaire' })
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


describe('⛔ un Message-ID à plusieurs lignes, relu en base', () => {
  const CRLF = String.fromCharCode(13, 10)
  const JUNK = `${String.fromCharCode(92)}Junk`

  it('ne part jamais tel quel vers le serveur : la recherche porte l’identifiant nettoyé', async () => {
    const boite: Record<string, Dossier> = {
      ...boiteType(),
      Junk: {
        uidValidity: 11, uidNext: 2, attrs: [JUNK], messages: [
          { uid: 1, flags: [], raw: courrier({ id: '<s1@spam.ex>' }), date: '10-Sep-2026 12:00:00 +0200' },
        ],
      },
    }
    const { admin, tables } = fauxAdmin()
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    // Une ligne écrite AVANT le nettoyage à l'analyse : son Message-ID porte des lignes.
    const l = (tables.mail_messages as Ligne[]).find((m) => m.provider_message_id === 'Junk:11:1')!
    l.rfc822_message_id = `<s1@spam.ex>${CRLF}Z9 DELETE INBOX`
    boite.Junk.messages = [] // le fournisseur l'a purgé : la passe le cherche en Réception
    const imap = fauxImap(boite)
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(imap))
    expect(imap.journal.join('|')).not.toContain('Z9')
    expect(imap.journal.some((c) => c.endsWith('UID SEARCH HEADER Message-ID "<s1@spam.ex>"'))).toBe(true)
  })
})

describe('⛔ un Message-ID repris par un inconnu', () => {
  it('n’écrase pas le message connu : le nouveau courrier est un message de plus', async () => {
    const boite = boiteType()
    const { admin, tables } = fauxAdmin()
    const premiere = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    // Mallory, en copie du courrier de Zoé, en renvoie un au MÊME Message-ID, arrivé plus tard.
    boite.INBOX.messages.push({ uid: 4, flags: [], raw: courrier({ id: '<m1@ex.ch>', de: 'Zoé <mallory@evil.ch>', corps: 'Nouvel IBAN CH00' }), date: '12-Sep-2026 09:00:00 +0200' })
    boite.INBOX.uidNext = 5
    await imapSyncPass(admin, compte(), premiere.cursor, 20_000, branche(fauxImap(boite)))
    const lignes = tables.mail_messages as Ligne[]
    const original = lignes.find((l) => l.provider_message_id === 'INBOX:7:1')!
    expect(original).toMatchObject({ from_email: 'zoe@ex.ch' })
    expect(String(original.body_text)).not.toContain('IBAN')
    expect(lignes.find((l) => l.provider_message_id === 'INBOX:7:4')).toMatchObject({ from_email: 'mallory@evil.ch' })
  })
})

describe('⛔ un courrier piégé ne bloque plus la boîte', () => {
  /** n niveaux de multipart imbriqués : postal-mime refuse au-delà de 50. */
  function gigogne(n: number): string {
    let corps = 'Content-Type: text/plain\r\n\r\nfond\r\n'
    for (let i = 0; i < n; i++) corps = `Content-Type: multipart/mixed; boundary="b${i}"\r\n\r\n--b${i}\r\n${corps}--b${i}--\r\n`
    return ['From: Inconnu <x@evil.com>', 'To: g@agence.ch', 'Subject: Colis', 'Message-ID: <piege@evil.com>', 'Date: Thu, 10 Sep 2026 10:00:00 +0200', corps].join('\r\n')
  }

  it('l’analyse qui échoue n’arrête pas la passe : le message entre par ses en-têtes, les suivants aussi', async () => {
    const boite = boiteType()
    boite.INBOX.messages.push(
      { uid: 4, flags: [], raw: gigogne(51), date: '11-Sep-2026 10:00:00 +0200' },
      { uid: 5, flags: [], raw: courrier({ id: '<m5@ex.ch>', objet: 'Après le piège' }), date: '11-Sep-2026 11:00:00 +0200' },
    )
    boite.INBOX.uidNext = 6
    const { admin, tables } = fauxAdmin()
    const r = await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const lignes = tables.mail_messages as Ligne[]
    const piege = lignes.find((l) => l.provider_message_id === 'INBOX:7:4')!
    expect(piege).toMatchObject({ subject: 'Colis', from_email: 'x@evil.com', body_text: null, body_truncated: true })
    expect(lignes.some((l) => l.provider_message_id === 'INBOX:7:5')).toBe(true)
    expect(r.cursor.folders.INBOX.lastUid).toBe(5)
  })

  it('un caractère NUL dans l’objet ou le corps n’atteint pas la base', async () => {
    const NUL = String.fromCharCode(0)
    const boite = boiteType()
    boite.INBOX.messages.push({
      uid: 4, flags: [], date: '11-Sep-2026 10:00:00 +0200',
      raw: courrier({ id: '<nul@ex.ch>', objet: '=?utf-8?B?aGkAdGhlcmU=?=', corps: 'avant=00apres' }).replace('Content-Type: text/plain; charset=utf-8', 'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable'),
    })
    boite.INBOX.uidNext = 5
    const { admin, tables } = fauxAdmin()
    await imapSyncPass(admin, compte(), null, 20_000, branche(fauxImap(boite)))
    const l = (tables.mail_messages as Ligne[]).find((x) => x.provider_message_id === 'INBOX:7:4')!
    expect(l.subject).toBe('hithere')
    expect(String(l.body_text)).not.toContain(NUL)
    expect(String(l.snippet)).not.toContain(NUL)
  })
})

describe('⛔ dialVerifie : l’hôte saisi est revérifié à CHAQUE connexion', () => {
  const faux = (resoudre: (h: string) => Promise<string>) => {
    const appels: { voie: string; host: string; port: number; opts: DialOptions }[] = []
    const conn = { async read() { return null }, async write() {}, close() {} }
    const net = {
      resoudre,
      tls: async (host: string, port: number, opts: DialOptions = {}) => { appels.push({ voie: 'tls', host, port, opts }); return conn },
      tcp: async (host: string, port: number, opts: DialOptions = {}) => { appels.push({ voie: 'tcp', host, port, opts }); return conn },
    }
    return { net, appels }
  }

  it('un nom qui résout vers une adresse interne n’ouvre AUCUNE socket', async () => {
    const { net, appels } = faux(async () => { throw new Error('ssrf: blocked_ip') })
    await expect(dialVerifie('imap.son-domaine.ch', 993, false, {}, net)).rejects.toThrow(/blocked_ip/)
    expect(appels).toEqual([])
  })

  it('la socket s’ouvre sur l’IP vérifiée, le nom ne sert qu’au certificat, et la session a une échéance', async () => {
    const { net, appels } = faux(async () => '203.0.113.5')
    await dialVerifie('imap.son-domaine.ch', 993, false, {}, net)
    await dialVerifie('smtp.son-domaine.ch', 587, true, { deadline: 42 }, net)
    expect(appels[0]).toMatchObject({ voie: 'tls', host: 'imap.son-domaine.ch', port: 993, opts: { address: '203.0.113.5' } })
    expect(typeof appels[0].opts.deadline).toBe('number')
    expect(appels[1]).toMatchObject({ voie: 'tcp', host: 'smtp.son-domaine.ch', port: 587, opts: { address: '203.0.113.5', deadline: 42 } })
  })
})

describe('⛔ une passe tuée ne laisse plus le compte en tête de file', () => {
  const tablesDe = (sync_failures: number) => ({
    mail_accounts: [{ ...compte(), sync_failures }] as Ligne[],
    profiles: [{ id: 'u-1', agency_id: 'ag-1' }] as Ligne[],
    mail_cron_locks: [] as Ligne[],
  })

  it('l’échec est présumé AVANT le travail — backoff et compte d’échecs posés —, puis effacé par le succès', async () => {
    const { admin, tables } = fauxAdmin(tablesDe(0))
    const imap = fauxImap(boiteType())
    let vuAuDial: Ligne | null = null
    await syncAccount(admin, { ...compte(), sync_failures: 0 }, {} as never, 20_000, {
      now: () => MAINTENANT,
      // Un worker abattu ici n'écrirait plus rien : c'est l'état de la ligne À CET INSTANT qui compte.
      dial: async () => { vuAuDial = { ...(tables.mail_accounts as Ligne[])[0] }; return imap.duplex },
    })
    expect(vuAuDial).toMatchObject({ sync_failures: 1 })
    expect(Date.parse(String((vuAuDial as unknown as Ligne).next_sync_at))).toBeGreaterThan(MAINTENANT)
    expect((tables.mail_accounts as Ligne[])[0]).toMatchObject({ sync_failures: 0, last_error: null })
  })

  // ⛔ Un « trop de connexions » passager n'est pas un mot de passe refusé : la boîte ne passe
  // pas en « autorisation à renouveler », la passe suivante réessaie.
  it('un refus TEMPORAIRE au LOGIN laisse la boîte active — échec compté, jamais « à renouveler »', async () => {
    const { admin, tables } = fauxAdmin(tablesDe(0))
    const imap = fauxImap(boiteType(), undefined, 'NO [LIMIT] Too many simultaneous connections')
    const r = await syncAccount(admin, { ...compte(), sync_failures: 0 }, {} as never, 20_000, { now: () => MAINTENANT, dial: async () => imap.duplex })
    expect(r.error).toMatch(/pour un temps/)
    expect(r.error, 'le texte du serveur ne remonte pas').not.toMatch(/simultaneous/)
    expect((tables.mail_accounts as Ligne[])[0]).toMatchObject({ status: 'active', sync_failures: 1 })
    // Témoin : un vrai refus d'identifiants, lui, demande de reconnecter.
    const t2 = fauxAdmin(tablesDe(0))
    await syncAccount(t2.admin, { ...compte(), sync_failures: 0 }, {} as never, 20_000, {
      now: () => MAINTENANT, dial: async () => fauxImap(boiteType(), undefined, 'NO [AUTHENTICATIONFAILED] Invalid credentials').duplex,
    })
    expect((t2.tables.mail_accounts as Ligne[])[0]).toMatchObject({ status: 'reauth_required' })
  })

  it('après cinq passes mortes d’affilée, le compte quitte le balayage sans rouvrir de connexion', async () => {
    const { admin, tables } = fauxAdmin(tablesDe(5))
    let dials = 0
    const r = await syncAccount(admin, { ...compte(), sync_failures: 5 }, {} as never, 20_000, {
      now: () => MAINTENANT, dial: async () => { dials++; throw new Error('jamais atteint') },
    })
    expect(dials).toBe(0)
    expect(r.error).toMatch(/interrompues/)
    expect((tables.mail_accounts as Ligne[])[0]).toMatchObject({ status: 'error' })
  })
})
