// Fiche annonce Matching · Recherche — verrouille les garde-fous d'HONNÊTETÉ des
// champs affichés. Cette couche est invisible : si elle régresse, personne ne le
// voit passer — la fiche affiche simplement « Meublé : Non » sur la quasi-totalité
// de la base, ou une disponibilité au « 01.08.0206 ». L'UI authentifiée n'étant pas
// prévisualisable, ces cas SONT la vérification de la refonte.
//
// Chiffres mesurés le 25 juillet 2026 sur les 78 354 annonces actives :
//   · is_furnished VRAI 2 964, mais NON-NUL 78 342 (la colonne a un DEFAULT false)
//     → le composant gate sur `=== true`, donc le mapper doit préserver `false`
//     TEL QUEL. « Corriger » le mapper en coercant false→null casserait le gate.
//   · floor de -6 à 99 (2 455 négatifs, 39 au-dessus de 20)
//   · availability_date contient des années 206 et 2926
//   · year_built porte 12 valeurs à 3 chiffres
//
// Complémentaire de `fitNumeric` côté sync (#955), qui borne la CAPACITÉ DE COLONNE
// avant l'upsert RealAdvisor : ici on filtre l'absurdité SÉMANTIQUE, à l'affichage,
// et sur les deux sources (RealAdvisor ET Flatfox).

import { describe, it, expect } from 'vitest'
import {
  plausible,
  plausibleDate,
  mapListingDetailRow,
  mapListingRow,
} from '@/components/matching-recherche/types'

describe('plausible', () => {
  it('keeps a value inside the range, bounds included', () => {
    expect(plausible(5, 1, 10)).toBe(5)
    expect(plausible(1, 1, 10)).toBe(1)
    expect(plausible(10, 1, 10)).toBe(10)
    expect(plausible(0, -6, 40)).toBe(0)
    expect(plausible(-6, -6, 40)).toBe(-6)
  })
  it('neutralises anything outside the range', () => {
    expect(plausible(99, -6, 40)).toBeNull()
    expect(plausible(-7, -6, 40)).toBeNull()
    expect(plausible(0, 1, 20)).toBeNull()
  })
  it('passes null and undefined through', () => {
    expect(plausible(null, 1, 10)).toBeNull()
    expect(plausible(undefined, 1, 10)).toBeNull()
  })
})

describe('plausibleDate', () => {
  it('keeps a plausible ISO date', () => {
    expect(plausibleDate('2026-09-01')).toBe('2026-09-01')
    expect(plausibleDate('2000-01-01')).toBe('2000-01-01')
    expect(plausibleDate('2100-12-31')).toBe('2100-12-31')
  })
  it('rejects the parse failures actually present in market_listings', () => {
    expect(plausibleDate('0206-08-01')).toBeNull()
    expect(plausibleDate('2926-09-01')).toBeNull()
  })
  it('rejects the years just outside the window', () => {
    expect(plausibleDate('1999-12-31')).toBeNull()
    expect(plausibleDate('2101-01-01')).toBeNull()
  })
  it('rejects null, empty and non-dates', () => {
    expect(plausibleDate(null)).toBeNull()
    expect(plausibleDate('')).toBeNull()
    expect(plausibleDate('bientôt')).toBeNull()
  })
})

describe('mapListingDetailRow — « Meublé » (le piège du DEFAULT false)', () => {
  it('preserves false as false — NOT null', () => {
    // Si ce test tombe, la fiche affichera « Meublé : Non » sur ~96 % de la base
    // ou masquera l'info pour les 2 964 annonces réellement meublées.
    expect(mapListingDetailRow({ is_furnished: false }).is_furnished).toBe(false)
  })
  it('preserves true', () => {
    expect(mapListingDetailRow({ is_furnished: true }).is_furnished).toBe(true)
  })
  it('yields null when the column is absent or not a boolean', () => {
    expect(mapListingDetailRow({}).is_furnished).toBeNull()
    expect(mapListingDetailRow({ is_furnished: null }).is_furnished).toBeNull()
    expect(mapListingDetailRow({ is_furnished: 'oui' }).is_furnished).toBeNull()
  })
})

describe('mapListingDetailRow — étage', () => {
  it('keeps ground floor and basements (2 455 listings are below zero)', () => {
    expect(mapListingDetailRow({ floor: 0 }).floor).toBe(0)
    expect(mapListingDetailRow({ floor: -1 }).floor).toBe(-1)
    expect(mapListingDetailRow({ floor: -6 }).floor).toBe(-6)
  })
  it('keeps a normal storey', () => {
    expect(mapListingDetailRow({ floor: 3 }).floor).toBe(3)
    expect(mapListingDetailRow({ floor: 40 }).floor).toBe(40)
  })
  it('drops the portal garbage (max observed: 99)', () => {
    expect(mapListingDetailRow({ floor: 99 }).floor).toBeNull()
    expect(mapListingDetailRow({ floor: 41 }).floor).toBeNull()
    expect(mapListingDetailRow({ floor: -7 }).floor).toBeNull()
  })
})

describe('mapListingDetailRow — bornes numériques', () => {
  it('requires at least one parking space to show the row', () => {
    expect(mapListingDetailRow({ parking_count: 0 }).parking_count).toBeNull()
    expect(mapListingDetailRow({ parking_count: 1 }).parking_count).toBe(1)
    expect(mapListingDetailRow({ parking_count: 20 }).parking_count).toBe(20)
    expect(mapListingDetailRow({ parking_count: 21 }).parking_count).toBeNull()
  })
  it('bounds the renovation year to a building-plausible window', () => {
    expect(mapListingDetailRow({ year_renovated: 1799 }).year_renovated).toBeNull()
    expect(mapListingDetailRow({ year_renovated: 1800 }).year_renovated).toBe(1800)
    expect(mapListingDetailRow({ year_renovated: 2024 }).year_renovated).toBe(2024)
    expect(mapListingDetailRow({ year_renovated: 2101 }).year_renovated).toBeNull()
  })
  it('bounds usable surface and monthly charges', () => {
    expect(mapListingDetailRow({ usable_surface: 0 }).usable_surface).toBeNull()
    expect(mapListingDetailRow({ usable_surface: 85 }).usable_surface).toBe(85)
    expect(mapListingDetailRow({ usable_surface: 10001 }).usable_surface).toBeNull()
    expect(mapListingDetailRow({ charges_monthly: 0 }).charges_monthly).toBeNull()
    expect(mapListingDetailRow({ charges_monthly: 420 }).charges_monthly).toBe(420)
    expect(mapListingDetailRow({ charges_monthly: 20001 }).charges_monthly).toBeNull()
  })
})

describe('mapListingDetailRow — description et champs texte', () => {
  it('trims the description and treats a blank one as absent', () => {
    expect(mapListingDetailRow({ description: '  Bel objet.  ' }).description).toBe('Bel objet.')
    expect(mapListingDetailRow({ description: '   ' }).description).toBeNull()
    expect(mapListingDetailRow({ description: '' }).description).toBeNull()
    expect(mapListingDetailRow({}).description).toBeNull()
  })
  it('passes the free-text fields through', () => {
    const d = mapListingDetailRow({ visit_contact_name: 'M. Dupont', agency_reference: 'REF-42' })
    expect(d.visit_contact_name).toBe('M. Dupont')
    expect(d.agency_reference).toBe('REF-42')
    expect(mapListingDetailRow({}).visit_contact_name).toBeNull()
    expect(mapListingDetailRow({}).agency_reference).toBeNull()
  })
  it('drops an availability date the portal failed to parse', () => {
    expect(mapListingDetailRow({ availability_date: '2026-10-01' }).availability_date).toBe('2026-10-01')
    expect(mapListingDetailRow({ availability_date: '0206-08-01' }).availability_date).toBeNull()
    expect(mapListingDetailRow({ availability_date: '2926-09-01' }).availability_date).toBeNull()
  })
})

describe('mapListingRow — année de construction', () => {
  const row = (year: unknown) => mapListingRow({ id: 'x', title: 'T', city: 'Genève', year_built: year })

  it('keeps a plausible construction year', () => {
    expect(row(1996).year).toBe(1996)
    expect(row(1200).year).toBe(1200)
    expect(row(2100).year).toBe(2100)
  })
  it('drops the 3-digit years (12 active listings carry one)', () => {
    expect(row(206).year).toBeNull()
    expect(row(19).year).toBeNull()
    expect(row(2101).year).toBeNull()
    expect(row(null).year).toBeNull()
  })
})
