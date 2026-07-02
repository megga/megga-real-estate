// Tests purs du sérialiseur IDX 3.01 (Node+Vitest, aucun accès DB/réseau).
import { describe, it, expect } from 'vitest'
import {
  F,
  IDX_COLUMN_COUNT,
  IDX_VERSION,
  PICTURE_URL_INDICES,
  MAX_PICTURES,
  TYPE_MAP,
  propertyToIdxRow,
  serializeIdxFeed,
  buildIdxFeed,
  sanitizeIdxText,
  formatInt,
  formatNum,
  formatIdxDate,
  validateIdxProperty,
  toNum,
  propertyRowToIdxInput,
  agencyRowToIdxAgency,
  type IdxProperty,
  type IdxAgency,
} from './idx-mapper'

const agency: IdxAgency = {
  id: 'ag-1',
  name: 'Régie Test SA',
  street: 'Rue du Test 1',
  city: 'Genève',
  canton: 'GE',
  phone: '+41 22 000 00 00',
  email: 'contact@test.ch',
  logoUrl: 'https://cdn.example/logo.png',
}

function baseProperty(over: Partial<IdxProperty> = {}): IdxProperty {
  return {
    id: 'prop-1',
    type: 'apartment',
    transactionType: 'buy',
    title: 'Bel appartement',
    description: 'Lumineux',
    price: 720000,
    currency: 'CHF',
    rooms: 3.5,
    surfaceM2: 92,
    address: 'Rue des Eaux-Vives 10',
    postalCode: '1207',
    city: 'Genève',
    canton: 'GE',
    photos: ['https://cdn/p1.jpg', 'https://cdn/p2.jpg'],
    ...over,
  }
}

describe('propertyToIdxRow — structure', () => {
  it('produit exactement 183 colonnes', () => {
    const row = propertyToIdxRow(baseProperty(), agency)
    expect(row).toHaveLength(IDX_COLUMN_COUNT)
  })

  it('pose version + sender_id', () => {
    const row = propertyToIdxRow(baseProperty(), agency)
    expect(row[F.VERSION]).toBe(IDX_VERSION)
    expect(row[F.SENDER_ID]).toBe('MEGGA')
    expect(propertyToIdxRow(baseProperty(), agency, { senderId: 'CUSTOM' })[F.SENDER_ID]).toBe('CUSTOM')
  })

  it('pays = CH pour l\'objet et l\'agence', () => {
    const row = propertyToIdxRow(baseProperty(), agency)
    expect(row[F.OBJECT_COUNTRY]).toBe('CH')
    expect(row[F.AGENCY_COUNTRY]).toBe('CH')
  })
})

describe('mapping catégorie / type / offre', () => {
  it('apartment → APPT/1, SALE pour buy', () => {
    const row = propertyToIdxRow(baseProperty({ type: 'apartment', transactionType: 'buy' }), agency)
    expect(row[F.OBJECT_CATEGORY]).toBe('APPT')
    expect(row[F.OBJECT_TYPE]).toBe('1')
    expect(row[F.OFFER_TYPE]).toBe('SALE')
  })

  it('villa → HOUSE/5', () => {
    const row = propertyToIdxRow(baseProperty({ type: 'villa' }), agency)
    expect(row[F.OBJECT_CATEGORY]).toBe('HOUSE')
    expect(row[F.OBJECT_TYPE]).toBe('5')
  })

  it('chaque property_type connu a un mapping', () => {
    for (const t of ['apartment', 'house', 'villa', 'commercial', 'land']) {
      expect(TYPE_MAP[t]).toBeDefined()
    }
  })

  it('type inconnu retombe sur le fallback APPT/1', () => {
    const row = propertyToIdxRow(baseProperty({ type: 'chalet-bizarre' }), agency)
    expect(row[F.OBJECT_CATEGORY]).toBe('APPT')
    expect(row[F.OBJECT_TYPE]).toBe('1')
  })

  it('location → RENT, loyer net + charges, pas de selling_price', () => {
    const row = propertyToIdxRow(
      baseProperty({ transactionType: 'rent', price: 2400, chargesMonthly: 200 }),
      agency,
    )
    expect(row[F.OFFER_TYPE]).toBe('RENT')
    expect(row[F.RENT_NET]).toBe('2400')
    expect(row[F.RENT_EXTRA]).toBe('200')
    expect(row[F.SELLING_PRICE]).toBe('')
  })

  it('vente → selling_price, pas de loyer', () => {
    const row = propertyToIdxRow(baseProperty({ transactionType: 'buy', price: 720000 }), agency)
    expect(row[F.SELLING_PRICE]).toBe('720000')
    expect(row[F.RENT_NET]).toBe('')
  })
})

describe('photos → emplacements URL IDX', () => {
  it('place les URLs aux indices 99, 100, …', () => {
    const row = propertyToIdxRow(baseProperty({ photos: ['https://a/1.jpg', 'https://a/2.jpg'] }), agency)
    expect(row[PICTURE_URL_INDICES[0]]).toBe('https://a/1.jpg')
    expect(row[PICTURE_URL_INDICES[1]]).toBe('https://a/2.jpg')
    expect(row[PICTURE_URL_INDICES[2]]).toBe('')
  })

  it('cape à 13 photos sans déborder', () => {
    const many = Array.from({ length: 20 }, (_, i) => `https://a/${i}.jpg`)
    const row = propertyToIdxRow(baseProperty({ photos: many }), agency)
    expect(row).toHaveLength(IDX_COLUMN_COUNT)
    expect(row[PICTURE_URL_INDICES[MAX_PICTURES - 1]]).toBe('https://a/12.jpg')
  })

  it('ignore les entrées photo vides', () => {
    const row = propertyToIdxRow(baseProperty({ photos: ['', '  ', 'https://a/ok.jpg'] }), agency)
    expect(row[PICTURE_URL_INDICES[0]]).toBe('https://a/ok.jpg')
  })
})

describe('bloc agence', () => {
  it('mappe nom/adresse/contact/logo', () => {
    const row = propertyToIdxRow(baseProperty(), agency)
    expect(row[F.AGENCY_ID]).toBe('ag-1')
    expect(row[F.AGENCY_NAME]).toBe('Régie Test SA')
    expect(row[F.AGENCY_CITY]).toBe('Genève')
    expect(row[F.AGENCY_PHONE]).toBe('+41 22 000 00 00')
    expect(row[F.AGENCY_EMAIL]).toBe('contact@test.ch')
    expect(row[F.AGENCY_LOGO]).toBe('https://cdn.example/logo.png')
  })
})

describe('helpers de formatage', () => {
  it('sanitizeIdxText neutralise ; et sauts de ligne', () => {
    expect(sanitizeIdxText('a;b\nc\td')).toBe('a,b c d')
    expect(sanitizeIdxText(null)).toBe('')
    expect(sanitizeIdxText('  trop   espace ')).toBe('trop espace')
  })

  it('formatInt arrondit, formatNum strip les zéros', () => {
    expect(formatInt(720000.4)).toBe('720000')
    expect(formatInt(null)).toBe('')
    expect(formatNum(120)).toBe('120')
    expect(formatNum(3.5)).toBe('3.5')
    expect(formatNum(92.0)).toBe('92')
  })

  it('formatIdxDate ISO → DD.MM.YYYY', () => {
    expect(formatIdxDate('2026-03-16')).toBe('16.03.2026')
    expect(formatIdxDate('2026-03-16T10:00:00Z')).toBe('16.03.2026')
    expect(formatIdxDate(null)).toBe('')
  })
})

describe('sérialisation feed', () => {
  it('1 ligne = 182 séparateurs (183 colonnes)', () => {
    const feed = buildIdxFeed([baseProperty()], agency)
    const firstLine = feed.split('\r\n')[0]
    expect(firstLine.split(';')).toHaveLength(IDX_COLUMN_COUNT)
  })

  it('N biens = N lignes terminées CRLF', () => {
    const feed = buildIdxFeed([baseProperty({ id: 'a' }), baseProperty({ id: 'b' })], agency)
    expect(feed.endsWith('\r\n')).toBe(true)
    const lines = feed.split('\r\n').filter((l) => l !== '')
    expect(lines).toHaveLength(2)
  })

  it('feed vide pour 0 bien', () => {
    expect(serializeIdxFeed([])).toBe('')
  })

  it('le texte libre ne casse jamais le compte de colonnes', () => {
    const row = propertyToIdxRow(
      baseProperty({ title: 'A; B; C', description: 'ligne1\nligne2;suite' }),
      agency,
    )
    const feed = serializeIdxFeed([row])
    expect(feed.trim().split(';')).toHaveLength(IDX_COLUMN_COUNT)
  })
})

describe('validateIdxProperty', () => {
  it('bien complet = aucun manque', () => {
    expect(validateIdxProperty(baseProperty())).toEqual([])
  })

  it('liste les champs manquants', () => {
    const missing = validateIdxProperty({ id: 'x' })
    expect(missing).toContain('type')
    expect(missing).toContain('price')
    expect(missing).toContain('address')
    expect(missing).toContain('postal_code')
    expect(missing).toContain('city')
    expect(missing).toContain('photos')
    expect(missing).toContain('title')
  })

  it('prix ≤ 0 est invalide', () => {
    expect(validateIdxProperty(baseProperty({ price: 0 }))).toContain('price')
  })
})

describe('mappers ligne DB → contrat IDX', () => {
  it('toNum coerce les numeric PostgREST (string) et écarte les invalides', () => {
    expect(toNum('720000.00')).toBe(720000)
    expect(toNum(3.5)).toBe(3.5)
    expect(toNum('')).toBeNull()
    expect(toNum(null)).toBeNull()
    expect(toNum('abc')).toBeNull()
  })

  it('propertyRowToIdxInput coerce les prix/surfaces et mappe mandate_expires_at → publishUntil', () => {
    const input = propertyRowToIdxInput({
      id: 'p1',
      type: 'apartment',
      transaction_type: 'rent',
      title: 'T3',
      price: '2400.00',
      charges_monthly: '200',
      rooms: '3.5',
      surface_m2: '92.00',
      address: 'Rue 1',
      postal_code: '1200',
      city: 'Genève',
      photos: ['https://a/1.jpg'],
      mandate_expires_at: '2026-12-31',
      updated_at: '2026-06-29T10:00:00Z',
    })
    expect(input.price).toBe(2400)
    expect(input.chargesMonthly).toBe(200)
    expect(input.rooms).toBe(3.5)
    expect(input.surfaceM2).toBe(92)
    expect(input.transactionType).toBe('rent')
    expect(input.publishUntil).toBe('2026-12-31')
    expect(input.photos).toEqual(['https://a/1.jpg'])
  })

  it('propertyRowToIdxInput construit listingUrl seulement si base fournie', () => {
    expect(propertyRowToIdxInput({ id: 'p1' }).listingUrl).toBeNull()
    expect(
      propertyRowToIdxInput({ id: 'p1' }, { listingBaseUrl: 'https://x/listing' }).listingUrl,
    ).toBe('https://x/listing/p1')
  })

  it('le résultat est sérialisable en ligne 183 colonnes valide', () => {
    const input = propertyRowToIdxInput({
      id: 'p1', type: 'villa', transaction_type: 'buy', title: 'V', price: '1200000',
      address: 'A', postal_code: '1000', city: 'C', photos: ['https://a/1.jpg'],
    })
    const agency = agencyRowToIdxAgency({ id: 'a', name: 'Régie', address: 'R', city: 'C', phone: '0', email: 'e@x.ch', logo_url: 'l' })
    const feed = buildIdxFeed([input], agency)
    expect(feed.split('\r\n')[0].split(';')).toHaveLength(IDX_COLUMN_COUNT)
  })

  it('agencyRowToIdxAgency mappe address → street', () => {
    const a = agencyRowToIdxAgency({ id: 'a', name: 'Régie SA', address: 'Rue 9', city: 'GE' })
    expect(a.street).toBe('Rue 9')
    expect(a.name).toBe('Régie SA')
  })
})
