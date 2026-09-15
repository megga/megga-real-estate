/**
 * Le client SMTP éprouvé contre une connexion SCRIPTÉE — la grammaire (réponses
 * multi-lignes, dot-stuffing) et les décisions (mécanisme d'authentification, montée
 * STARTTLS, refus du clair). L'ouverture de la socket, elle, a été mesurée par la sonde
 * T3.1 contre les vrais serveurs.
 */
import { describe, it, expect } from 'vitest'
import { sansCci, smtpProbe, smtpSend, SmtpError } from './smtp.ts'
import type { Duplex } from './duplex.ts'

/** Pour chaque écriture, la première règle qui l'apparie donne la réponse du serveur. */
function fake(script: [RegExp, string][], opts: { banniere?: string; clair?: boolean } = {}) {
  const enc = new TextEncoder()
  const queue: Uint8Array[] = [enc.encode(opts.banniere ?? '220 mail.exemple.ch ESMTP ready\r\n')]
  const sent: string[] = []
  const monte = { fait: false }
  const duplex = (chiffre: boolean): Duplex => ({
    async read() { return queue.shift() ?? null },
    async write(bytes) {
      const brut = new TextDecoder().decode(bytes)
      sent.push(`${chiffre ? '' : 'clair:'}${brut}`)
      const regle = script.find(([re]) => re.test(brut))
      if (!regle) throw new Error(`unscripted: ${brut.slice(0, 40)}`)
      queue.push(enc.encode(regle[1]))
    },
    close() {},
    ...(chiffre ? {} : { startTls: async () => { monte.fait = true; return duplex(true) } }),
  })
  return { conn: duplex(!opts.clair), sent, monte }
}

const EHLO_OK = '250-mail.exemple.ch\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 52428800\r\n'

describe('smtpSend', () => {
  it('EHLO, AUTH PLAIN, MAIL, RCPT ×2, DATA (dot-stuffing), QUIT', async () => {
    const { conn, sent } = fake([
      [/^EHLO /, EHLO_OK],
      [/^AUTH PLAIN /, '235 2.7.0 Authentication successful\r\n'],
      [/^MAIL FROM:/, '250 OK\r\n'],
      [/^RCPT TO:/, '250 OK\r\n'],
      [/^DATA/, '354 End data with <CR><LF>.<CR><LF>\r\n'],
      [/\r\n\.\r\n$/, '250 OK queued\r\n'],
      [/^QUIT/, '221 Bye\r\n'],
    ])
    await smtpSend(conn, 'tls', { user: 'u@ex.ch', password: 'pw', from: 'u@ex.ch', rcpts: ['a@b.ch', 'c@d.ch'], raw: 'Subject: x\r\n\r\n.ligne à point\nfin' })
    expect(sent[0]).toBe('EHLO getmegga.com\r\n')
    expect(sent[1]).toBe(`AUTH PLAIN ${btoa('\0u@ex.ch\0pw')}\r\n`)
    expect(sent.filter((s) => s.startsWith('RCPT TO:'))).toEqual(['RCPT TO:<a@b.ch>\r\n', 'RCPT TO:<c@d.ch>\r\n'])
    // Un point en tête de ligne en prend un second ; le LF nu devient CRLF.
    expect(sent.find((s) => s.includes('ligne à point'))).toBe('Subject: x\r\n\r\n..ligne à point\r\nfin\r\n.\r\n')
  })

  it('un refus 535 lève avec son CODE — ce sont les identifiants', async () => {
    const { conn } = fake([[/^EHLO /, EHLO_OK], [/^AUTH PLAIN /, '535 5.7.8 Authentication credentials invalid\r\n']])
    const e = await smtpSend(conn, 'tls', { user: 'u', password: 'x', from: 'u@ex.ch', rcpts: ['a@b.ch'], raw: 'x' }).catch((x) => x)
    expect(e).toBeInstanceOf(SmtpError)
    expect(e.code).toBe(535)
  })

  it('AUTH LOGIN quand le serveur ne propose pas PLAIN', async () => {
    const { conn, sent } = fake([
      [/^EHLO /, '250-mail.exemple.ch\r\n250 AUTH LOGIN\r\n'],
      [/^AUTH LOGIN/, '334 VXNlcm5hbWU6\r\n'],
      [/^dQ==/, '334 UGFzc3dvcmQ6\r\n'],
      [/^cMOp/, '235 ok\r\n'],
      [/^QUIT/, '221 Bye\r\n'],
    ])
    await smtpProbe(conn, 'tls', { user: 'u', password: 'pé' })
    expect(sent.slice(1, 4)).toEqual(['AUTH LOGIN\r\n', 'dQ==\r\n', `${btoa('pÃ©')}\r\n`])
  })
})

describe('STARTTLS (587)', () => {
  it('monte en TLS avant d’authentifier, puis redemande EHLO', async () => {
    const { conn, sent, monte } = fake([
      [/^EHLO /, '250-mail.exemple.ch\r\n250-STARTTLS\r\n250 AUTH PLAIN\r\n'],
      [/^STARTTLS/, '220 2.0.0 Ready to start TLS\r\n'],
      [/^AUTH PLAIN /, '235 ok\r\n'],
      [/^QUIT/, '221 Bye\r\n'],
    ], { clair: true })
    await smtpProbe(conn, 'starttls', { user: 'u', password: 'p' })
    expect(monte.fait).toBe(true)
    expect(sent.map((s) => s.replace(/\r\n$/, '')).slice(0, 4)).toEqual([
      'clair:EHLO getmegga.com', 'clair:STARTTLS', 'EHLO getmegga.com', `AUTH PLAIN ${btoa('\0u\0p')}`,
    ])
  })

  it('⛔ un serveur qui n’annonce pas STARTTLS n’obtient AUCUN mot de passe', async () => {
    const { conn, sent } = fake([[/^EHLO /, '250-mail.exemple.ch\r\n250 AUTH PLAIN\r\n']], { clair: true })
    await expect(smtpProbe(conn, 'starttls', { user: 'u', password: 'secret' })).rejects.toThrow(/starttls_unavailable/)
    expect(sent.some((s) => s.includes('AUTH'))).toBe(false)
  })

  it('⛔ une connexion en clair annoncée « TLS » est refusée avant l’authentification', async () => {
    const { conn, sent } = fake([[/^EHLO /, EHLO_OK]], { clair: true })
    await expect(smtpProbe(conn, 'tls', { user: 'u', password: 'secret' })).rejects.toThrow(/canal en clair/)
    expect(sent.some((s) => s.includes('AUTH'))).toBe(false)
  })
})

describe('sansCci', () => {
  it('retire Bcc (replié compris) des en-têtes, et seulement des en-têtes', () => {
    const raw = 'From: a@b.ch\r\nTo: c@d.ch\r\nBcc: x@y.ch,\r\n z@y.ch\r\nSubject: s\r\n\r\nBcc: dans le corps, intact\r\n'
    expect(sansCci(raw)).toBe('From: a@b.ch\r\nTo: c@d.ch\r\nSubject: s\r\n\r\nBcc: dans le corps, intact\r\n')
  })
  it('un message sans Bcc ressort à l’identique', () => {
    const raw = 'From: a@b.ch\r\nSubject: s\r\n\r\ncorps'
    expect(sansCci(raw)).toBe(raw)
  })
})

describe('⛔ la bannière refusée ne remonte jamais', () => {
  it('le code reste, le texte du service ne part pas dans l’erreur', async () => {
    const { conn } = fake([], { banniere: '554 service-interne v4.2 prêt\r\n' })
    const e = await smtpProbe(conn, 'tls', { user: 'g@agence.ch', password: 'x' }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(SmtpError)
    expect((e as SmtpError).code).toBe(554)
    expect((e as SmtpError).message).not.toContain('service-interne')
  })
})
