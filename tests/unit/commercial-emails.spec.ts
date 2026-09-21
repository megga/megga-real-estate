// L'e-mail COMMERCIAL du produit : la relance écrite par l'agent.
//
// Il se distingue de tous les autres sur un point qui n'est pas cosmétique : il porte un
// lien de DÉSINSCRIPTION. Sa mention de pied ne peut donc pas être celle des
// transactionnels, qui affirme l'absence d'un tel lien — c'est le premier invariant testé.
//
// ⚠ La « fiche de bien » (`_shared/property-email.ts`, `send-property-email`) en était le
// second ; elle est partie le 21.09.2026 : le matching reste chez l'agent, rien ne part plus
// vers l'acheteur (docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md).
import { describe, it, expect } from 'vitest'
import { buildRelanceEmail } from '../../supabase/functions/_shared/relance-email'

const DESINSCRIPTION = '<a href="https://app.getmegga.com/desinscription/jeton">Se désinscrire</a>'

describe('⛔ la mention de pied doit être VRAIE pour ce message', () => {
  it('un e-mail commercial ne prétend pas être sans désinscription', () => {
    // La mention des transactionnels dit « c'est pourquoi il ne contient pas de lien de
    // désinscription ». L'écrire ici serait faux : le lien est juste en dessous.
    const html = buildRelanceEmail({ subject: 'Objet', body: 'Corps', unsubscribeHtml: DESINSCRIPTION }).html
    expect(html).not.toContain('ne contient pas de lien de désinscription')
    expect(html).toContain('desinscription/jeton')
  })

  it('sans bloc de désinscription fourni, aucun bloc vide', () => {
    expect(buildRelanceEmail({ subject: 'Objet', body: 'Corps' }).html).not.toContain('desinscription')
  })
})

describe('buildRelanceEmail', () => {
  const base = { subject: 'Une visite la semaine prochaine ?', body: 'Bonjour Marie,\n\nÇa tient toujours ?' }

  it('le titre EST l’objet : l’agent a écrit un propos, on n’en invente pas un second', () => {
    const { subject, html } = buildRelanceEmail(base)
    expect(subject).toBe(base.subject)
    expect(html).toContain(base.subject)
  })

  it('préserve les sauts de ligne du texte libre', () => {
    expect(buildRelanceEmail(base).html).toContain('white-space:pre-line')
  })

  it('l’aperçu reprend le début du corps, sur une seule ligne', () => {
    const html = buildRelanceEmail(base).html
    expect(html).toContain('Bonjour Marie, Ça tient toujours ?')
  })

  it('échappe le corps, l’objet et la signature', () => {
    const html = buildRelanceEmail({
      subject: '<img src=x>', body: '<script>alert(1)</script>', agentSignature: '<b>Greg</b>',
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>Greg</b>')
  })

  it('la signature configurée l’emporte sur le simple nom', () => {
    const avecSignature = buildRelanceEmail({ ...base, agentName: 'Greg', agentSignature: 'Gregory Lyonnet\nRégie du Rhône' }).html
    expect(avecSignature).toContain('Régie du Rhône')
    const nomSeul = buildRelanceEmail({ ...base, agentName: 'Greg' }).html
    expect(nomSeul).toContain('Greg')
  })

  it('sans nom ni signature, aucun bloc de signature vide', () => {
    const html = buildRelanceEmail(base).html
    expect(html).not.toContain('border-top:1px solid #181818;font-family')
  })
})
