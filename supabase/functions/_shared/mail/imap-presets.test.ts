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

  it('une adresse sans domaine valable ne part pas au DNS', async () => {
    expect(await detecterServeurs('pas-une-adresse', aucunMx)).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@localhost', aucunMx)).toEqual({ oauth: null, preset: null })
    expect(await detecterServeurs('g@exemple_.ch', aucunMx)).toEqual({ oauth: null, preset: null })
  })
})
