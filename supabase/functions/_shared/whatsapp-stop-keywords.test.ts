import { describe, it, expect } from 'vitest'
import {
  normalizeForStop, detectStopRequest, resolveStopLang,
} from './whatsapp-stop-keywords'
import { buildStopAck } from './whatsapp-stop-ack'

describe('normalizeForStop', () => {
  it('retire les accents, la casse et la ponctuation', () => {
    expect(normalizeForStop('  ARRÊT !!! ')).toBe('arret')
    expect(normalizeForStop('Löschen')).toBe('loschen')
    expect(normalizeForStop('stop 🙏')).toBe('stop')
    expect(normalizeForStop('ne  plus   me contacter')).toBe('ne plus me contacter')
  })
  it('rend une chaîne vide pour null / vide / ponctuation seule', () => {
    expect(normalizeForStop(null)).toBe('')
    expect(normalizeForStop(undefined)).toBe('')
    expect(normalizeForStop('   ')).toBe('')
    expect(normalizeForStop('!!!')).toBe('')
  })
})

describe('detectStopRequest — le mot-clé renseigne la langue', () => {
  it('mots-clés internationaux → xx (la langue reste à déterminer)', () => {
    for (const s of ['stop', 'STOP', 'Stopp', 'unsubscribe', 'opt out', 'optout', 'remove me']) {
      expect(detectStopRequest(s), s).toBe('xx')
    }
  })

  it('reconnaît les quatre langues du corpus client', () => {
    expect(detectStopRequest('arrêtez')).toBe('fr')
    expect(detectStopRequest('me désinscrire')).toBe('fr')
    expect(detectStopRequest('abmelden')).toBe('de')
    // Les deux graphies : le tréma part à la normalisation, « oe » doit être listé à part.
    expect(detectStopRequest('löschen')).toBe('de')
    expect(detectStopRequest('loeschen')).toBe('de')
    expect(detectStopRequest('cancellami')).toBe('it')
    expect(detectStopRequest('Ne me contactez plus s’il vous plaît')).toBe('fr')
    expect(detectStopRequest('please do not contact me again')).toBe('en')
    expect(detectStopRequest('non contattarmi più')).toBe('it')
    expect(detectStopRequest('keine nachrichten mehr bitte')).toBe('de')
  })

  it('un message ordinaire n’est pas une désinscription', () => {
    for (const s of [
      'bonjour, je suis intéressé par l’appartement',
      'stopover à Genève la semaine prochaine',   // « stop » en sous-chaîne : régime EXACT seulement
      'on arrête les frais ?',                    // « arrête » noyé : pas le message ENTIER
      'guten tag, ich hätte eine frage',
      null, undefined, '', '   ',
    ]) {
      expect(detectStopRequest(s), String(s)).toBeNull()
    }
  })

  it('une phrase CITÉE au-delà de 160 caractères ne déclenche pas', () => {
    const court = 'do not contact me'
    expect(detectStopRequest(court)).toBe('en')
    // Même phrase, noyée dans un récit : elle est rapportée, pas demandée.
    const long = `hier j ai ecrit a une agence ${'x'.repeat(150)} do not contact me`
    expect(long.length).toBeGreaterThan(160)
    expect(detectStopRequest(long)).toBeNull()
  })

  it('le régime EXACT ignore la borne : « stop » reste « stop » quelle que soit la casse', () => {
    // La borne ne s'applique qu'aux PHRASES : un message qui EST le mot-clé est court par
    // construction, et le borner n'apporterait rien.
    expect(detectStopRequest('  Stop.  ')).toBe('xx')
  })
})

describe('resolveStopLang — « stop » nu ne dit rien de la langue', () => {
  it('un mot-clé localisé l’emporte sur la fiche', () => {
    expect(resolveStopLang('de', 'fr')).toBe('de')
    expect(resolveStopLang('it', null)).toBe('it')
  })
  it('xx retombe sur la langue déclarée du contact', () => {
    expect(resolveStopLang('xx', 'de')).toBe('de')
    expect(resolveStopLang('xx', 'IT')).toBe('it')
    expect(resolveStopLang('xx', 'en')).toBe('en')
  })
  it('sans langue déclarée ni mot-clé localisé → français', () => {
    expect(resolveStopLang('xx', null)).toBe('fr')
    expect(resolveStopLang('xx', '')).toBe('fr')
    expect(resolveStopLang('xx', 'es')).toBe('fr')   // hors domaine contacts.language
    expect(resolveStopLang(null, null)).toBe('fr')
  })
})

describe('buildStopAck — il porte l’avis LPD, pas un simple « c’est noté »', () => {
  const LANGS = ['fr', 'de', 'en', 'it'] as const

  it('les quatre langues nomment le responsable, le contact et la politique', () => {
    for (const lang of LANGS) {
      const t = buildStopAck({ lang, agencyName: 'Régie du Lac SA' })
      expect(t, lang).toContain('Régie du Lac SA')
      expect(t, lang).toContain('privacy@megga.ch')
      expect(t, lang).toContain('https://megga.ch/privacy')
      // Le retrait doit être confirmé : c'est la seule chose que la personne a demandée.
      expect(t.length, lang).toBeGreaterThan(200)
    }
  })

  it('sans agence identifiable, MEGGA est nommée — jamais une agence au hasard', () => {
    // pickTriageAgency rend délibérément null dès qu'il y a ≥2 agences vérifiées.
    for (const name of [null, undefined, '', '   ']) {
      expect(buildStopAck({ lang: 'fr', agencyName: name })).toContain('MEGGA')
    }
  })

  it('les quatre textes sont réellement distincts (pas de repli silencieux sur le français)', () => {
    const textes = LANGS.map((lang) => buildStopAck({ lang }))
    expect(new Set(textes).size).toBe(4)
  })

  it('aucun tiret cadratin : meggaProse les convertirait en virgules à l’envoi', () => {
    // Le texte doit être écrit DÉJÀ normalisé, sinon ce qui part diffère de ce qu'on lit ici.
    for (const lang of LANGS) {
      expect(buildStopAck({ lang }), lang).not.toMatch(/[—–]/)
    }
  })
})
