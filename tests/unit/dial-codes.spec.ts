/**
 * Indicatifs téléphoniques (src/lib/countries.ts) — la table et son découpeur.
 *
 * Ce qui est éprouvé ici n'est pas « la liste est complète » (elle se relit) mais les
 * deux règles qui se cassent en silence : le PLUS LONG indicatif doit gagner, et un
 * pays sans indicatif ne doit pas produire une option `+undefined` dans le sélecteur.
 */
import { describe, it, expect } from 'vitest'
import {
  COUNTRIES, COUNTRY_DIAL_CODES, PHONE_EXAMPLES,
  countriesInLanguage, countryName, dialCodeOptions, splitDialCode,
} from '@/lib/countries'

describe('COUNTRY_DIAL_CODES — la table couvre la liste des pays', () => {
  it('chaque pays de COUNTRIES a un indicatif', () => {
    const sans = COUNTRIES.filter((c) => !COUNTRY_DIAL_CODES[c.code]).map((c) => c.code)
    expect(sans).toEqual([])
  })

  it('aucun indicatif ne porte de « + » ni d\'espace — le « + » est ajouté à l\'affichage', () => {
    for (const [iso, dial] of Object.entries(COUNTRY_DIAL_CODES)) {
      expect(dial, iso).toMatch(/^\d{1,4}$/)
    }
  })

  it('la Suisse ouvre la liste : c\'est le marché, et le défaut du champ', () => {
    expect(dialCodeOptions('fr')[0]).toEqual({ value: 'CH', label: 'Suisse +41' })
  })

  it('⛔ la valeur d\'une option est l\'ISO, JAMAIS l\'indicatif', () => {
    // Dix pays portent +1. Un <select> dont deux options partagent une valeur
    // sélectionne toujours la PREMIÈRE : choisir « Canada » affichait « Bahamas »
    // au rendu suivant. L'ISO est aussi ce qui désigne le bon exemple de numéro.
    const opts = dialCodeOptions('fr')
    expect(new Set(opts.map((o) => o.value)).size).toBe(opts.length)
    expect(opts.find((o) => o.value === 'CA')?.label).toBe('Canada +1')
    expect(opts.find((o) => o.value === 'US')?.label).toBe('États-Unis +1')
  })

  it('les indicatifs PARTAGÉS sont assumés, pas dédupliqués', () => {
    // +1 couvre l'Amérique du Nord et les Caraïbes, +39 l'Italie et le Vatican : deux
    // pays peuvent porter le même indicatif, et la liste doit les proposer tous les
    // deux — c'est le NOM que le dirigeant cherche.
    expect(COUNTRY_DIAL_CODES.US).toBe('1')
    expect(COUNTRY_DIAL_CODES.CA).toBe('1')
    expect(COUNTRY_DIAL_CODES.IT).toBe('39')
    expect(COUNTRY_DIAL_CODES.VA).toBe('39')
    expect(dialCodeOptions('fr').filter((o) => o.label.endsWith(' +1')).length).toBeGreaterThan(1)
  })
})

describe('splitDialCode — le plus long indicatif gagne', () => {
  it('découpe un numéro suisse', () => {
    expect(splitDialCode('+41798749484')).toEqual({ dial: '+41', local: '798749484' })
  })

  it('⚠ Andorre (+376) ne se fait pas voler par un préfixe plus court', () => {
    // Le piège de la table : comparés du plus COURT au plus long, « +37 » n'existe pas
    // mais « +3 » le ferait si on tronquait, et surtout +1 est préfixe de rien alors
    // que +35x, +37x, +38x se ressemblent. Le tri par longueur décroissante est ce qui
    // rend le découpage stable.
    expect(splitDialCode('+376123456')).toEqual({ dial: '+376', local: '123456' })
    expect(splitDialCode('+35799123456')).toEqual({ dial: '+357', local: '99123456' })
    expect(splitDialCode('+38344123456')).toEqual({ dial: '+383', local: '44123456' })
  })

  it('ignore les espaces et la ponctuation de lecture', () => {
    expect(splitDialCode('+41 79 874 94 84')).toEqual({ dial: '+41', local: '798749484' })
    expect(splitDialCode('+33 (0)6 12 34 56 78')).toEqual({ dial: '+33', local: '0612345678' })
  })

  it('un numéro NATIONAL n\'invente pas d\'indicatif — tout part en local', () => {
    // « 079 874 94 84 » n'est pas international : lui coller un pays serait deviner.
    expect(splitDialCode('079 874 94 84')).toEqual({ dial: '', local: '0798749484' })
    expect(splitDialCode('')).toEqual({ dial: '', local: '' })
  })

  it('un indicatif inconnu ne se fait pas passer pour connu', () => {
    expect(splitDialCode('+99912345')).toEqual({ dial: '', local: '+99912345' })
  })
})

describe('countriesInLanguage — les pays se lisent et se trient dans la langue', () => {
  it('le FRANÇAIS garde les libellés du design, pas ceux de CLDR', () => {
    expect(countryName('KR', 'fr')).toBe('Corée du Sud')
    expect(countryName('US', 'fr')).toBe('États-Unis')
  })

  it('les autres langues viennent d\'Intl', () => {
    expect(countryName('DE', 'de')).toBe('Deutschland')
    expect(countryName('CH', 'it')).toBe('Svizzera')
    expect(countryName('ES', 'en')).toBe('Spain')
  })

  it('la Suisse reste en tête, le reste est trié DANS la langue', () => {
    for (const lang of ['fr', 'de', 'en', 'it']) {
      const liste = countriesInLanguage(lang)
      expect(liste[0].code, lang).toBe('CH')
      const noms = liste.slice(1).map((c) => c.name)
      expect(noms, lang).toEqual([...noms].sort((a, b) => a.localeCompare(b, lang)))
    }
  })

  it('un code inconnu d\'Intl retombe sur le français, jamais sur du vide', () => {
    expect(countryName('XK', 'de')).toBeTruthy()
    expect(countryName('', 'de')).toBe('')
  })
})

describe('PHONE_EXAMPLES — un exemple vérifié, ou pas d\'exemple', () => {
  it('la Suisse et ses voisins ont un exemple groupé à leur façon', () => {
    expect(PHONE_EXAMPLES.CH).toBe('79 874 94 84')
    expect(PHONE_EXAMPLES.FR).toBe('6 12 34 56 78')
    expect(PHONE_EXAMPLES.DE).toBe('151 23456789')
  })

  it('chaque exemple ne porte que des chiffres et des espaces', () => {
    for (const [iso, ex] of Object.entries(PHONE_EXAMPLES)) {
      expect(ex, iso).toMatch(/^[\d ]+$/)
    }
  })

  it('⛔ la couverture est PARTIELLE, et l\'absence est un choix', () => {
    // Un format inventé enseignerait une ponctuation fausse avec l'autorité d'un
    // placeholder. Les pays non vérifiés n'ont donc pas d'entrée, et le champ
    // affiche un exemple vide plutôt qu'un exemple faux.
    const couverts = Object.keys(PHONE_EXAMPLES)
    expect(couverts.length).toBeLessThan(COUNTRIES.length)
    expect(couverts.every((iso) => COUNTRY_DIAL_CODES[iso])).toBe(true)
  })
})
