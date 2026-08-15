// Lien magique KYC — l'e-mail le plus lu du produit, et le seul en quatre langues.
//
// Il n'avait AUCUN test avant sa sortie de `magic-link-send-email/index.ts` (15.08.2026),
// où son gabarit était privé. Ce qui est vérifié ici tient en une phrase : le lien doit
// partir juste, dans la bonne langue, sans jamais promettre un compte au destinataire.
import { describe, it, expect } from 'vitest'
import {
  buildMagicLinkEmail,
  normalizeLocale,
  type MagicLinkLocale,
} from '../../supabase/functions/_shared/magic-link-email'

const LANGUES: MagicLinkLocale[] = ['fr', 'de', 'en', 'it']

const base = {
  locale: 'fr' as MagicLinkLocale,
  firstName: 'Marie',
  agentFullName: 'Gregory Lyonnet',
  agencyName: 'Régie du Rhône',
  url: 'https://app.megga.ch/kyc/jeton-abc',
  customMessage: null,
}

describe('normalizeLocale', () => {
  it('reconnaît les quatre langues, y compris avec une région', () => {
    expect(normalizeLocale('de-CH')).toBe('de')
    expect(normalizeLocale('IT')).toBe('it')
    expect(normalizeLocale('en-GB')).toBe('en')
  })

  it('retombe sur le français sur une langue inconnue, vide ou absente', () => {
    for (const v of [null, undefined, '', 'es', 'zz']) expect(normalizeLocale(v)).toBe('fr')
  })
})

describe('buildMagicLinkEmail — les quatre langues', () => {
  it('déclare la langue du document, jamais « fr » pour tout le monde', () => {
    // Un e-mail allemand annoncé lang="fr" se fait lire avec une prononciation française
    // par un lecteur d'écran, et trompe la traduction automatique du client de messagerie.
    for (const locale of LANGUES) {
      expect(buildMagicLinkEmail({ ...base, locale }).html).toContain(`lang="${locale}"`)
    }
  })

  it('l’objet s’ouvre sur L’AGENCE dans les quatre langues', () => {
    // Le destinataire connaît son agence, pas MEGGA : un objet au nom d'un tiers inconnu
    // se lit comme un message non sollicité, et celui-ci demande des papiers d'identité.
    for (const locale of LANGUES) {
      expect(buildMagicLinkEmail({ ...base, locale }).subject).toMatch(/^Régie du Rhône/)
    }
  })

  it('⛔ aucun tiret cadratin ni demi-cadratin, objet compris (règle maison)', () => {
    for (const locale of LANGUES) {
      const { subject, html } = buildMagicLinkEmail({ ...base, locale })
      expect(subject).not.toMatch(/[–—]/)
      expect(html).not.toMatch(/[–—]/)
    }
  })

  it('porte le lien dans le bouton, dans les quatre langues', () => {
    for (const locale of LANGUES) {
      expect(buildMagicLinkEmail({ ...base, locale }).html).toContain('https://app.megga.ch/kyc/jeton-abc')
    }
  })

  it('garde la grille de réassurance : elle répond à la question que le destinataire se pose', () => {
    // Un inconnu demande ses papiers par e-mail. Où vivent les données, qui les voit,
    // combien de temps : c'est la meilleure idée de l'ancien gabarit, elle survit.
    const html = buildMagicLinkEmail(base).html
    expect(html).toContain('Données en Suisse')
    expect(html).toContain('Vu par 2 personnes')
    expect(html).toContain('Conservé 10 ans')
  })

  it('annonce l’expiration du lien : c’est ce qui rend l’attente coûteuse', () => {
    expect(buildMagicLinkEmail(base).html).toContain('expire dans 7 jours')
  })
})

describe('buildMagicLinkEmail — ce qu’il ne doit jamais faire', () => {
  it('⛔ AUCUNE pilule « Ouvrir mon espace » : le destinataire n’a pas de compte MEGGA', () => {
    for (const locale of LANGUES) {
      expect(buildMagicLinkEmail({ ...base, locale }).html).not.toContain('Ouvrir mon espace')
    }
  })

  it('échappe le prénom, le nom de l’agent et celui de l’agence', () => {
    const html = buildMagicLinkEmail({
      ...base,
      firstName: '<img src=x>',
      agentFullName: '<script>alert(1)</script>',
      agencyName: 'Régie <b>du</b> Rhône',
    }).html
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('échappe le message libre de l’agent — c’est une saisie, pas du gabarit', () => {
    const html = buildMagicLinkEmail({ ...base, customMessage: 'Bonjour <img src=x> !' }).html
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
  })

  it('sans message de l’agent, aucun bloc vide', () => {
    // Le bloc encadré est la seule surface creusée du corps : vide, il se lirait comme
    // une erreur de rendu.
    const avec = buildMagicLinkEmail({ ...base, customMessage: 'Un mot de moi' }).html
    const sans = buildMagicLinkEmail({ ...base, customMessage: null }).html
    expect(avec).toContain('Un mot de moi')
    expect(sans.length).toBeLessThan(avec.length)
  })

  it('porte l’habillage commun, jamais l’ancien fond clair', () => {
    const html = buildMagicLinkEmail(base).html
    expect(html).toContain('app.megga.ch/email/megga-logo-white.png')
    expect(html).not.toContain('#EDEFF3')
    expect(html).not.toContain('Manrope')
  })
})
