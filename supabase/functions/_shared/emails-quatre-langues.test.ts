// Les quatre gabarits où MEGGA écrit de ses propres mots, dans les quatre langues.
//
// Ce banc ne juge pas la qualité d'une traduction — aucun test ne le peut. Il fige les
// invariants qu'un oeil ne tient pas de façon fiable sur 4 gabarits × 4 langues :
// qu'aucune langue ne retombe en français, que le document se déclare dans sa langue, et
// les trois défauts précis qu'une relecture adverse a écartés.
import { describe, it, expect } from 'vitest'
import { buildDeviceAlertEmail } from './device-alert-email'
import { buildTeamInviteEmail } from './team-invite-email'
import { buildVerificationNotice } from './agency-verification-notice'
import { buildBookingEmail } from './booking-email'
import type { AppLocale } from './recipient-language'

const LANGUES: AppLocale[] = ['fr', 'de', 'en', 'it']

const rendus = (locale: AppLocale) => [
  buildDeviceAlertEmail({
    name: 'Julien', browser: 'Chrome 128', os: 'macOS 15', city: 'Genève',
    country: 'Suisse', ip: '81.2.3.4', when: '16.08.2026 00:12', locale,
  }),
  buildTeamInviteEmail({
    inviterName: 'Gregory Lyonnet', agencyName: 'Régie du Rhône', role: 'agent',
    acceptUrl: 'https://app.megga.ch/accept-invite/jeton', locale,
  }),
  buildVerificationNotice({
    status: 'correction_requested', agencyName: 'Régie du Rhône',
    reason: 'Le numéro IDE ne correspond pas au registre.',
    appUrl: 'https://app.megga.ch', locale,
  }),
  buildBookingEmail({
    kind: 'confirmed', contactName: 'Marie Dupont', agentName: 'Gregory Lyonnet',
    agencyName: 'Régie du Rhône', startIso: '2026-08-17T07:00:00.000Z',
    timeZone: 'Europe/Zurich', mode: 'video', videoLink: 'https://meet.google.com/abc',
    to: 'marie@example.ch', locale,
  }),
]

describe('quatre gabarits, quatre langues', () => {
  it('aucune langue ne retombe en français', () => {
    // Le défaut d'origine : ces gabarits n'existaient QU'EN français. Un mot propre à
    // chaque langue suffit à prouver que la bascule a lieu partout.
    const temoin: Record<AppLocale, RegExp> = {
      fr: /connexion|invitation|identité|rendez-vous/i,
      de: /Anmeldung|Einladung|Identität|Termin/,
      en: /sign-in|invitation|identity|appointment/i,
      it: /accesso|invito|identità|appuntamento/i,
    }
    for (const l of LANGUES) {
      for (const r of rendus(l)) {
        expect(`${r.subject} ${r.html}`, `langue ${l}`).toMatch(temoin[l])
      }
    }
  })

  it('le document se DÉCLARE dans sa langue', () => {
    // Annoncer « fr » sur un texte allemand casse la césure, la synthèse vocale et
    // WCAG 3.1.1 — le même défaut que `<html lang>` du CRM.
    for (const l of LANGUES) {
      for (const r of rendus(l)) expect(r.html).toContain(`lang="${l}"`)
    }
  })

  it('aucun tiret cadratin ni demi-cadratin, objet compris', () => {
    for (const l of LANGUES) {
      for (const { subject, html } of rendus(l)) {
        expect(subject).not.toMatch(/[–—]/)
        expect(html).not.toMatch(/[–—]/)
      }
    }
  })

  it('la coquille MEGGA X, dans les quatre langues', () => {
    for (const l of LANGUES) {
      for (const { html } of rendus(l)) {
        expect(html).toContain('https://app.megga.ch/email/megga-logo-white.png')
        expect(html).not.toContain('https://megga.ch/email')
      }
    }
  })
})

describe('les trois défauts que la relecture adverse a écartés', () => {
  it('⛔ [de] la mention du RDV KYC n’attribue la prise de rendez-vous à personne', () => {
    // Le français dit « un rendez-vous PRIS avec votre agence », participe sans agent.
    // « den Sie vereinbart haben » affirmerait que le destinataire l'a fixé lui-même :
    // faux pour quelqu'un convoqué par son agence.
    const { html } = buildBookingEmail({
      kind: 'confirmed', contactName: 'Marie', agentName: 'Gregory', agencyName: 'Régie',
      startIso: '2026-08-17T07:00:00.000Z', timeZone: 'Europe/Zurich', mode: 'onsite',
      to: 'm@e.ch', locale: 'de',
    })
    expect(html).toContain('vereinbart wurde')
    expect(html).not.toContain('vereinbart haben')
  })

  it('⛔ AUCUN accord de genre dans l’invitation, en français comme en italien', () => {
    // Le gabarit ne connaît pas le genre du destinataire — il n'a pas encore de compte.
    // Une version disait « Lei è invitatO » puis « L'ha invitatA » quinze lignes plus bas.
    const fr = buildTeamInviteEmail({ inviterName: 'G', agencyName: 'R', role: 'agent', acceptUrl: 'https://x', locale: 'fr' })
    const it = buildTeamInviteEmail({ inviterName: 'G', agencyName: 'R', role: 'agent', acceptUrl: 'https://x', locale: 'it' })
    expect(fr.html).not.toMatch(/invité|invitée/)
    expect(it.html).not.toMatch(/invitato|invitata/)
    expect(fr.html).toContain('Invitation à rejoindre une équipe')
    expect(it.html).toContain('Invito a unirsi a un team')
  })

  it('⛔ [it] aucun tutoiement : « Vai » est un impératif de deuxième personne', () => {
    // Le reste de l'italien du produit emploie la forme de courtoisie ou l'infinitif
    // (« Prenoti », « Partecipare », « Scegliere ») ; « Vai al mio spazio » y était
    // l'anomalie, reprise telle quelle de l'interface.
    for (const r of rendus('it')) expect(r.html).not.toContain('Vai al mio spazio')
    expect(buildDeviceAlertEmail({
      name: null, browser: 'C', os: 'M', city: null, country: null, ip: null,
      when: '16.08.2026 00:12', locale: 'it',
    }).html).toContain('Aprire il mio spazio')
  })
})

describe('ce que la langue change au-delà des mots', () => {
  it('la date du rendez-vous est écrite dans la langue du contact', () => {
    const de = buildBookingEmail({
      kind: 'confirmed', contactName: 'M', agentName: 'G', agencyName: 'R',
      startIso: '2026-08-17T07:00:00.000Z', timeZone: 'Europe/Zurich', mode: 'onsite',
      to: 'm@e.ch', locale: 'de',
    })
    expect(de.html).toContain('August')
  })

  it('l’alerte de sécurité garde SA mention légale, jamais la transactionnelle', () => {
    // Sa seconde moitié (« même si vous vous êtes désabonné ») n'existe nulle part
    // ailleurs : elle dit pourquoi le message arrive sans action ni abonnement.
    for (const l of LANGUES) {
      const { html } = buildDeviceAlertEmail({
        name: null, browser: 'C', os: 'M', city: null, country: null, ip: null,
        when: '16.08.2026 00:12', locale: l,
      })
      expect(html).toMatch(/désabonné|abgemeldet|unsubscribed|disiscritto/)
    }
  })
})
