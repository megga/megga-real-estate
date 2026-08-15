// Les deux e-mails COMMERCIAUX du produit : fiche de bien et relance.
//
// Ils se distinguent de tous les autres sur un point qui n'est pas cosmétique : ils
// portent un lien de DÉSINSCRIPTION. Leur mention de pied ne peut donc pas être celle des
// transactionnels, qui affirme l'absence d'un tel lien — c'est le premier invariant testé
// de part et d'autre.
import { describe, it, expect } from 'vitest'
import { buildPropertyEmail, formatCHF } from '../../supabase/functions/_shared/property-email'
import { buildRelanceEmail } from '../../supabase/functions/_shared/relance-email'

const DESINSCRIPTION = '<a href="https://app.megga.ch/desinscription/jeton">Se désinscrire</a>'

const bien = {
  contactFirstName: 'Marie',
  agentName: 'Gregory Lyonnet',
  agentPhone: '+41 22 555 10 10',
  message: null,
  property: {
    title: '3.5 pièces avec terrasse',
    address: 'Rue Ancienne 12, 1227 Carouge',
    city: 'Carouge',
    price: 1_190_000,
    rooms: 3.5,
    surface_m2: 92,
    type: 'Appartement',
    photo_url: null,
    source_url: 'https://www.example.ch/annonce/12345',
    source_agency: 'Régie du Rhône',
    source_portal: 'Homegate',
  },
}

describe('⛔ la mention de pied doit être VRAIE pour ce message', () => {
  it('un e-mail commercial ne prétend pas être sans désinscription', () => {
    // La mention des transactionnels dit « c'est pourquoi il ne contient pas de lien de
    // désinscription ». L'écrire ici serait faux : le lien est juste en dessous.
    for (const html of [
      buildPropertyEmail({ ...bien, unsubscribeHtml: DESINSCRIPTION }).html,
      buildRelanceEmail({ subject: 'Objet', body: 'Corps', unsubscribeHtml: DESINSCRIPTION }).html,
    ]) {
      expect(html).not.toContain('ne contient pas de lien de désinscription')
      expect(html).toContain('desinscription/jeton')
    }
  })

  it('sans bloc de désinscription fourni, aucun bloc vide', () => {
    expect(buildPropertyEmail(bien).html).not.toContain('desinscription')
  })
})

describe('buildPropertyEmail', () => {
  it('le PRIX ouvre l’objet, sans tiret cadratin', () => {
    const { subject } = buildPropertyEmail(bien)
    expect(subject).toMatch(/^CHF 1’190’000 · 3\.5 pièces avec terrasse$/)
    expect(subject).not.toMatch(/[–—]/)
  })

  it('formatCHF suit l’apostrophe suisse', () => {
    expect(formatCHF(720000)).toBe('CHF 720’000')
    expect(formatCHF(1190000)).toBe('CHF 1’190’000')
  })

  it('sans prix, dit « Prix sur demande » plutôt qu’un zéro', () => {
    const { subject, html } = buildPropertyEmail({ ...bien, property: { ...bien.property, price: 0 } })
    expect(subject).toMatch(/^Prix sur demande/)
    expect(html).toContain('Prix sur demande')
  })

  it('porte les faits, la source et le lien de l’annonce', () => {
    const html = buildPropertyEmail(bien).html
    expect(html).toContain('3.5 pièces · 92 m² · Appartement')
    expect(html).toContain('Régie du Rhône')
    expect(html).toContain('https://www.example.ch/annonce/12345')
    expect(html).toContain('Voir l’annonce')
  })

  it('⛔ échappe TOUT — rien ne l’était avant', () => {
    const html = buildPropertyEmail({
      ...bien,
      contactFirstName: '<img src=x>',
      agentName: '<script>alert(1)</script>',
      message: 'Regardez <b>ceci</b>',
      property: { ...bien.property, title: '<i>Titre</i>', source_agency: '<u>Agence</u>' },
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>ceci</b>')
    expect(html).not.toContain('<i>Titre</i>')
    expect(html).toContain('&lt;img')
  })

  it('le mot de l’agent remplace la phrase par défaut, et garde ses sauts de ligne', () => {
    const html = buildPropertyEmail({ ...bien, message: 'Ligne un\nLigne deux' }).html
    expect(html).toContain('white-space:pre-line')
    expect(html).not.toContain('Voici un bien qui pourrait vous intéresser.')
  })

  it('⛔ aucune pilule : le contact n’a pas de compte MEGGA', () => {
    expect(buildPropertyEmail(bien).html).not.toContain('Ouvrir mon espace')
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
