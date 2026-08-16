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
    photo_url: null,
    source_url: 'https://www.example.ch/annonce/12345',
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
    // Apostrophe ASCII (U+0027) — cf. le test de `formatCHF` juste dessous.
    expect(subject).toMatch(/^CHF 1'190'000 · 3\.5 pièces avec terrasse$/)
    expect(subject).not.toMatch(/[–—]/)
  })

  /**
   * ⚠ L'APOSTROPHE EST L'ASCII `U+0027`, ET CE TEST A LONGTEMPS FIGÉ L'INVERSE.
   *
   * Il attendait `’` (U+2019, la typographique), en accord avec le `formatCHF` de
   * `property-email.ts` — mais en désaccord avec TOUT le reste : `src/lib/utils.ts`,
   * le `formatCHF` de `weekly-digest.ts` et sa propre spec, le code de
   * `send-property-email` que ce module remplace, et l'exemple du CLAUDE.md §6.
   * Mesuré au point de code le 16 août 2026 : les quatre portent `U+0027`.
   *
   * Les deux caractères sont indiscernables dans un diff comme à la relecture ;
   * seul `ord()` les sépare. C'est pourquoi la valeur attendue est écrite ici en
   * ÉCHAPPEMENT plutôt qu'en littéral : le test doit dire lequel des deux il exige.
   */
  it('formatCHF suit l’apostrophe suisse (ASCII U+0027, pas U+2019)', () => {
    expect(formatCHF(720000)).toBe('CHF 720\u0027000')
    expect(formatCHF(1190000)).toBe('CHF 1\u0027190\u0027000')
    expect(formatCHF(720000)).not.toContain('’')
  })

  it('sans prix, dit « Prix sur demande » plutôt qu’un zéro', () => {
    const { subject, html } = buildPropertyEmail({ ...bien, property: { ...bien.property, price: 0 } })
    expect(subject).toMatch(/^Prix sur demande/)
    expect(html).toContain('Prix sur demande')
  })

  it('porte le lien de l’annonce', () => {
    const html = buildPropertyEmail(bien).html
    expect(html).toContain('https://www.example.ch/annonce/12345')
    expect(html).toContain('Voir l’annonce')
  })

  it('⛔ les faits (pièces · m² · type) ne figurent NULLE PART', () => {
    // Retirés le 16.08.2026 (décision Julien) : d'abord de la carte, où ils faisaient
    // doublon avec le titre, puis de l'aperçu de boîte. La carte se réduit au prix, au
    // titre, au lieu et au bouton.
    //
    // ⚠ Ce que la mesure disait au moment de la décision, pour qui voudrait revenir
    // dessus : sur les 76 353 annonces actives de `market_listings`, le titre ne porte le
    // nombre de pièces que dans 25 % des cas et la surface dans 11 %. Ces chiffres ne sont
    // donc pas récupérables ailleurs dans l'e-mail — le retrait est un choix, pas un
    // dédoublonnage.
    // ⚠ On n'assère PAS l'absence du mot « pièces » : il vit légitimement dans le TITRE de
    // l'annonce (« 3.5 pièces avec terrasse »), qui est la donnée de l'agence. Ce qu'on
    // garde, ce sont les deux faits qui ne venaient QUE de cette ligne — la surface et le
    // type — et la ligne composée elle-même.
    const { subject, html } = buildPropertyEmail(bien)
    for (const trace of ['m²', 'Appartement']) {
      expect(html, trace).not.toContain(trace)
      expect(subject, trace).not.toContain(trace)
    }
    expect(html).not.toMatch(/pièces\s*·\s*\d/)
  })

  it('⛔ n’attribue PLUS le bien à l’agence source ni au portail', () => {
    // Retiré le 16.08.2026 (décision Julien) : ce bloc annonçait au client « via <agence>
    // · <portail> » au bas de la carte. Le bouton « Voir l’annonce » mène toujours à la
    // source — le retrait enlève le libellé, il ne masque pas la provenance.
    const html = buildPropertyEmail(bien).html
    expect(html).not.toMatch(/>\s*via /)
    expect(html).not.toContain('Homegate')
  })

  it('⛔ échappe TOUT — rien ne l’était avant', () => {
    const html = buildPropertyEmail({
      ...bien,
      contactFirstName: '<img src=x>',
      agentName: '<script>alert(1)</script>',
      message: 'Regardez <b>ceci</b>',
      property: { ...bien.property, title: '<i>Titre</i>' },
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

describe('⛔ la relance : SEUL le chrome suit la langue, jamais le corps', () => {
  const LANGUES = ['fr', 'de', 'en', 'it'] as const
  // Un corps FRANÇAIS dans les quatre rendus, exprès : c'est le cas réel. L'agent (ou le
  // copilote) a écrit en français ; le traduire serait réécrire ses mots.
  const corpsAgent = 'Bonjour Marie,\n\nLe 3.5 pièces de Carouge est toujours disponible.'

  it('le corps de l’agent n’est JAMAIS réécrit', () => {
    for (const locale of LANGUES) {
      const { html } = buildRelanceEmail({ subject: 'Objet', body: corpsAgent, locale })
      expect(html, locale).toContain('Le 3.5 pièces de Carouge est toujours disponible.')
    }
  })

  it('l’objet non plus : le titre EST l’objet de l’agent', () => {
    for (const locale of LANGUES) {
      const r = buildRelanceEmail({ subject: 'Une visite la semaine prochaine ?', body: corpsAgent, locale })
      expect(r.subject, locale).toBe('Une visite la semaine prochaine ?')
    }
  })

  it('mais la MENTION LÉGALE suit la langue du destinataire', () => {
    // Elle était un littéral français en dur. C'est la seule prose que MEGGA écrit dans ce
    // gabarit, et une mention légale doit être comprise pour valoir quelque chose.
    const legal: Record<(typeof LANGUES)[number], RegExp> = {
      fr: /en relation avec cette agence via MEGGA/,
      de: /über MEGGA mit dieser Agentur in Kontakt/,
      en: /in contact with this agency via MEGGA/,
      it: /in contatto con questa agenzia tramite MEGGA/,
    }
    for (const locale of LANGUES) {
      const { html } = buildRelanceEmail({ subject: 'Objet', body: corpsAgent, locale })
      expect(html, locale).toMatch(legal[locale])
    }
  })

  it('⛔ et le document se DÉCLARE dans la langue de son chrome', () => {
    // Il annonçait `lang="fr"` en toutes circonstances : `shell()` ne recevait aucun `lang`.
    for (const locale of LANGUES) {
      const { html } = buildRelanceEmail({ subject: 'Objet', body: corpsAgent, locale })
      expect(html, locale).toContain(`lang="${locale}"`)
    }
  })
})
