/**
 * La reconnaissance du fournisseur d'une adresse — par le domaine, puis par le MX.
 * Les MX de ces tests sont ceux relevés le 14.09.2026 (`dig MX`), pas des inventions.
 */
import { describe, it, expect } from 'vitest'
import { detecterServeurs } from './imap-presets.ts'

const aucunMx = async () => { throw new Error('ne doit pas être interrogé') }
const mxFixe = (hotes: string[]) => async () => hotes

describe('detecterServeurs', () => {
  it('une adresse Bluewin est reconnue par son DOMAINE, sans requête DNS', async () => {
    const r = await detecterServeurs('Marie@Bluewin.ch', aucunMx)
    expect(r.oauth).toBeNull()
    expect(r.preset).toMatchObject({ imapHost: 'imaps.bluewin.ch', imapPort: 993, smtpHost: 'smtpauths.bluewin.ch', smtpPort: 465 })
  })

  it('un domaine d’agence hébergé chez Infomaniak est reconnu par son MX', async () => {
    const r = await detecterServeurs('g@agence-exemple.ch', mxFixe(['mta-gw.infomaniak.ch.']))
    expect(r.preset).toMatchObject({ nom: 'Infomaniak', imapHost: 'mail.infomaniak.com', smtpHost: 'mail.infomaniak.com' })
  })

  it('le premier MX apparié l’emporte, dans l’ordre des préférences', async () => {
    const r = await detecterServeurs('g@agence-exemple.ch', mxFixe(['filtre.passerelle-exemple.ch.', 'mx1.mail.hostpoint.ch.', 'mta-gw.infomaniak.ch.']))
    expect(r.preset?.nom).toBe('Hostpoint')
  })

  it('Google : la connexion OAuth est proposée, l’IMAP reste possible en mot de passe d’application', async () => {
    const r = await detecterServeurs('g@agence-exemple.ch', mxFixe(['smtp.google.com.']))
    expect(r.oauth).toBe('gmail')
    expect(r.preset).toMatchObject({ imapHost: 'imap.gmail.com', motDePasseApplication: true })
    expect((await detecterServeurs('zoe@gmail.com', aucunMx)).oauth).toBe('gmail')
  })

  it('⛔ Microsoft : renvoyé vers OAuth, AUCUN serveur IMAP proposé (mot de passe refusé chez lui)', async () => {
    expect(await detecterServeurs('g@agence-exemple.ch', mxFixe(['agence-exemple-ch.mail.protection.outlook.com.']))).toEqual({ oauth: 'outlook', preset: null })
    expect(await detecterServeurs('zoe@hotmail.ch', aucunMx)).toEqual({ oauth: 'outlook', preset: null })
  })

  it('iCloud n’envoie que par STARTTLS sur 587, et exige un mot de passe d’application', async () => {
    expect((await detecterServeurs('zoe@icloud.com', aucunMx)).preset).toMatchObject({ smtpHost: 'smtp.mail.me.com', smtpPort: 587, motDePasseApplication: true })
  })

  it('non reconnu : ni MX apparié, ni MX du tout, ni résolution — jamais une erreur', async () => {
    expect(await detecterServeurs('g@agence-exemple.ch', mxFixe(['mx.passerelle-exemple.ch.']))).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@agence-exemple.ch', mxFixe([]))).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@agence-exemple.ch', async () => { throw new Error('SERVFAIL') })).toEqual({ oauth: null, preset: null })
  })

  it('⛔ Swisscom n’est PAS déduit de son MX : un domaine d’entreprise chez Swisscom reste à saisir', async () => {
    expect(await detecterServeurs('g@agence-exemple.ch', mxFixe(['mx01.p.bluenet.ch.']))).toEqual({ oauth: null, preset: null })
  })

  it('⛔ AOL partage le MX de Yahoo mais PAS ses serveurs — la règle AOL passe avant', async () => {
    // MX relevé le 14.09.2026 pour aol.com, aim.com, aol.fr, aol.de et verizon.net.
    const aol = await detecterServeurs('g@agence-exemple.ch', mxFixe(['mx-aol.mail.gm0.yahoodns.net.']))
    expect(aol.preset).toMatchObject({ nom: 'AOL', imapHost: 'imap.aol.com', smtpHost: 'smtp.aol.com', motDePasseApplication: true })
    expect((await detecterServeurs('zoe@verizon.net', aucunMx)).preset?.nom).toBe('AOL')
    const yahoo = await detecterServeurs('g@agence-exemple.ch', mxFixe(['mx-eu.mail.am0.yahoodns.net.']))
    expect(yahoo.preset).toMatchObject({ nom: 'Yahoo', imapHost: 'imap.mail.yahoo.com' })
    expect((await detecterServeurs('zoe@yahoo.de', aucunMx)).preset?.nom).toBe('Yahoo')
  })

  it('les hébergeurs suisses d’un domaine d’agence, par le MX de leurs CLIENTS', async () => {
    const serveurDe = async (mx: string) => (await detecterServeurs('g@agence-exemple.ch', mxFixe([mx]))).preset?.imapHost
    expect(await serveurDe('mx01.cyon.ch.')).toBe('mail.cyon.ch')
    expect(await serveurDe('mx.prod.qlmail.ch.')).toBe('imap.quickline.ch')
    expect(await serveurDe('mx.netplus.ch.')).toBe('imap.netplus.ch')
    expect(await serveurDe('mx01.kolabnow.com.')).toBe('imap.kolabnow.com')
  })

  it('IONOS : le serveur suit le pays du MX ; OVH : le serveur de MX Plan, dit comme tel', async () => {
    const preset = async (mx: string) => (await detecterServeurs('g@agence-exemple.ch', mxFixe([mx]))).preset
    expect((await preset('mx00.ionos.de.'))?.imapHost).toBe('imap.ionos.de')
    expect((await preset('mx00.kundenserver.de.'))?.imapHost).toBe('imap.ionos.de')
    expect((await preset('mx00.ionos.fr.'))?.imapHost).toBe('imap.ionos.fr')
    expect((await preset('mx00.ionos.com.'))?.imapHost).toBe('imap.ionos.com')
    expect(await preset('mx1.mail.ovh.net.')).toMatchObject({ nom: 'OVH (MX Plan)', imapHost: 'ssl0.ovh.net' })
    expect((await preset('spool.mail.gandi.net.'))?.imapHost).toBe('mail.gandi.net')
    expect((await preset('mx1.hostinger.com.'))?.imapHost).toBe('imap.hostinger.com')
    expect((await preset('mx.zoho.eu.'))?.imapHost).toBe('imap.zoho.eu')
    expect((await preset('in1-smtp.messagingengine.com.'))?.nom).toBe('Fastmail')
  })

  it('les messageries de particuliers, sans requête ; GMX et consorts demandent d’activer l’IMAP', async () => {
    const attendus: [string, string][] = [
      ['a@web.de', 'imap.web.de'], ['a@gmx.fr', 'imap.gmx.com'], ['a@mail.com', 'imap.mail.com'], ['a@t-online.de', 'secureimap.t-online.de'],
      ['a@wanadoo.fr', 'imap.orange.fr'], ['a@free.fr', 'imap.free.fr'], ['a@neuf.fr', 'imap.sfr.fr'], ['a@laposte.net', 'imap.laposte.net'],
      ['a@libero.it', 'imapmail.libero.it'], ['a@virgilio.it', 'in.virgilio.it'], ['a@tiscali.it', 'imap.tiscali.it'],
      ['a@posteo.ch', 'posteo.de'], ['a@mailbox.org', 'imap.mailbox.org'], ['a@quickline.ch', 'imap.quickline.ch'],
    ]
    for (const [adresse, imap] of attendus) expect((await detecterServeurs(adresse, aucunMx)).preset?.imapHost, adresse).toBe(imap)
    expect((await detecterServeurs('a@gmx.ch', aucunMx)).preset?.activerImap).toBe(true)
    expect((await detecterServeurs('a@web.de', aucunMx)).preset?.activerImap).toBe(true)
    expect((await detecterServeurs('a@orange.fr', aucunMx)).preset?.activerImap).toBe(false)
  })

  it('chaque serveur reconnu vise un port que connect_imap accepte', async () => {
    const adresses = ['bluewin.ch', 'hispeed.ch', 'gmx.ch', 'gmx.fr', 'web.de', 'mail.com', 't-online.de', 'orange.fr', 'free.fr', 'sfr.fr',
      'laposte.net', 'libero.it', 'virgilio.it', 'tiscali.it', 'posteo.de', 'mailbox.org', 'fastmail.com', 'icloud.com', 'yahoo.com', 'aol.com',
      'gmail.com', 'kolabnow.com', 'quickline.ch', 'netplus.ch', 'ik.me']
    for (const d of adresses) {
      const p = (await detecterServeurs(`a@${d}`, aucunMx)).preset!
      expect([993, 143], d).toContain(p.imapPort)
      expect([465, 587], d).toContain(p.smtpPort)
    }
  })

  it('une adresse sans domaine valable ne part pas au DNS', async () => {
    expect(await detecterServeurs('pas-une-adresse', aucunMx)).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@localhost', aucunMx)).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@exemple_.ch', aucunMx)).toEqual({ oauth: null, preset: null })
  })
})
