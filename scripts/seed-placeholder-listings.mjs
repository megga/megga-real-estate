#!/usr/bin/env node

/**
 * Seed 27 placeholder listings into `market_listings` for demo / testing.
 * 12 for sale (transaction_type='buy') + 15 for rent (transaction_type='rent').
 *
 * To be run AFTER the TRUNCATE migration 20260415_002 has wiped the 38K real
 * scraped listings. Without this seed, /acheter and /louer would both be empty.
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-placeholder-listings.mjs
 *
 * Idempotent : source_id starts with `demo-buy-` or `demo-rent-`, re-runs
 * update rather than duplicate. To wipe them later :
 *   DELETE FROM market_listings WHERE source_portal = 'megga-demo';
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

// Real Unsplash photo URLs (free, high quality, relevant to Swiss real estate)
const PHOTO_POOLS = {
  apartment_modern: [
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80',
    'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&q=80',
  ],
  apartment_cozy: [
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80',
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80',
    'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=1200&q=80',
  ],
  house: [
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80',
    'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80',
    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  ],
  villa: [
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  ],
}

const RENT_LISTINGS = [
  // ── Genève (GE) ──
  {
    id: '01',
    type: 'apartment', pool: 'apartment_modern',
    title: 'Bel appartement 3.5 pièces aux Eaux-Vives',
    description: 'Lumineux 3.5 pièces au cœur des Eaux-Vives, proche des transports et commerces. Cuisine équipée, balcon sud, cave.',
    price: 2950, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 78,
    city: 'Genève', canton: 'GE', postal_code: '1207', address: 'Rue de la Terrassière 22',
    lat: 46.2012, lng: 6.1553,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Cave', 'Ascenseur'],
  },
  {
    id: '02',
    type: 'apartment', pool: 'apartment_cozy',
    title: 'Studio meublé proche Cornavin',
    description: 'Studio entièrement meublé et équipé, idéal pour étudiant ou professionnel en mission. À 5 min à pied de la gare Cornavin.',
    price: 1850, rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 28,
    city: 'Genève', canton: 'GE', postal_code: '1201', address: 'Rue de Lausanne 15',
    lat: 46.2118, lng: 6.1424,
    is_furnished: true, deposit_months: 2, features: ['Meublé', 'Ascenseur'],
  },
  {
    id: '03',
    type: 'apartment', pool: 'apartment_modern',
    title: '4.5 pièces avec vue sur le lac à Cologny',
    description: 'Magnifique 4.5 pièces dans résidence de standing. Grande terrasse, vue panoramique sur le lac et les Alpes. Parking inclus.',
    price: 5800, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 135,
    city: 'Cologny', canton: 'GE', postal_code: '1223', address: 'Chemin de la Gradelle 8',
    lat: 46.2336, lng: 6.1887,
    is_furnished: false, deposit_months: 3, features: ['Terrasse', 'Vue lac', 'Vue montagne', 'Parking', 'Ascenseur'],
  },

  // ── Vaud (VD) ──
  {
    id: '04',
    type: 'apartment', pool: 'apartment_cozy',
    title: 'Charmant 2.5 pièces à Ouchy',
    description: 'Appartement lumineux avec cachet, proche du quai d\'Ouchy et du métro. Parquet d\'origine, cuisine rénovée.',
    price: 2100, rooms: 2.5, bedrooms: 1, bathrooms: 1, surface_m2: 55,
    city: 'Lausanne', canton: 'VD', postal_code: '1006', address: 'Avenue d\'Ouchy 47',
    lat: 46.5094, lng: 6.6256,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Cave'],
  },
  {
    id: '05',
    type: 'house', pool: 'house',
    title: 'Maison individuelle 5.5 pièces à Lutry',
    description: 'Maison familiale avec jardin de 400 m², piscine, garage double. Quartier calme et résidentiel, proche écoles.',
    price: 4900, rooms: 5.5, bedrooms: 4, bathrooms: 2, surface_m2: 180,
    city: 'Lutry', canton: 'VD', postal_code: '1095', address: 'Chemin des Vignes 12',
    lat: 46.5034, lng: 6.6865,
    is_furnished: false, deposit_months: 3, features: ['Jardin', 'Piscine', 'Garage', 'Parking'],
  },
  {
    id: '06',
    type: 'apartment', pool: 'apartment_modern',
    title: '3 pièces rénové à Nyon centre',
    description: 'Appartement entièrement rénové en 2024, cuisine ouverte, grand salon. À 10 min à pied de la gare CFF.',
    price: 2450, rooms: 3, bedrooms: 2, bathrooms: 1, surface_m2: 72,
    city: 'Nyon', canton: 'VD', postal_code: '1260', address: 'Rue de la Gare 28',
    lat: 46.3838, lng: 6.2391,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Ascenseur', 'Cave'],
  },

  // ── Zurich (ZH) ──
  {
    id: '07',
    type: 'apartment', pool: 'apartment_modern',
    title: 'Modern 3.5-room apartment in Oerlikon',
    description: 'Bright modern apartment close to Oerlikon station. Fully equipped kitchen, balcony, parking available.',
    price: 3200, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 85,
    city: 'Zürich', canton: 'ZH', postal_code: '8050', address: 'Schaffhauserstrasse 315',
    lat: 47.4099, lng: 8.5442,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Parking', 'Ascenseur'],
  },
  {
    id: '08',
    type: 'apartment', pool: 'apartment_cozy',
    title: 'Furnished studio near ETH Zurich',
    description: 'Fully furnished studio, ideal for exchange students or professionals on assignment. All utilities included.',
    price: 2400, rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 32,
    city: 'Zürich', canton: 'ZH', postal_code: '8006', address: 'Universitätstrasse 88',
    lat: 47.3784, lng: 8.5487,
    is_furnished: true, deposit_months: 2, features: ['Meublé', 'Ascenseur'],
  },
  {
    id: '09',
    type: 'villa', pool: 'villa',
    title: 'Villa 7 pièces avec vue lac à Küsnacht',
    description: 'Villa d\'exception avec vue imprenable sur le lac de Zurich. Jardin paysager, piscine chauffée, cave à vin.',
    price: 8900, rooms: 7, bedrooms: 5, bathrooms: 3, surface_m2: 280,
    city: 'Küsnacht', canton: 'ZH', postal_code: '8700', address: 'Seestrasse 145',
    lat: 47.3155, lng: 8.5844,
    is_furnished: false, deposit_months: 3, features: ['Jardin', 'Piscine', 'Vue lac', 'Garage', 'Cave'],
  },

  // ── Bern (BE) ──
  {
    id: '10',
    type: 'apartment', pool: 'apartment_cozy',
    title: '3.5-Zimmer-Wohnung in Länggasse',
    description: 'Gemütliche Wohnung im beliebten Länggasse-Quartier. Nähe Universität, Läden und öffentliche Verkehrsmittel.',
    price: 1950, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 82,
    city: 'Bern', canton: 'BE', postal_code: '3012', address: 'Länggassstrasse 67',
    lat: 46.9561, lng: 7.4329,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Cave'],
  },

  // ── Basel (BS) ──
  {
    id: '11',
    type: 'apartment', pool: 'apartment_modern',
    title: '4-Zimmer-Wohnung im Gundeli',
    description: 'Schöne Altbauwohnung mit hohen Decken und Stuck. Nähe Bahnhof SBB und Zoo Basel.',
    price: 2300, rooms: 4, bedrooms: 3, bathrooms: 1, surface_m2: 98,
    city: 'Basel', canton: 'BS', postal_code: '4053', address: 'Gundeldingerstrasse 202',
    lat: 47.5428, lng: 7.5866,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Cave', 'Ascenseur'],
  },

  // ── Valais (VS) ──
  {
    id: '12',
    type: 'apartment', pool: 'apartment_modern',
    title: 'Appartement 4.5 pièces à Verbier',
    description: 'Pied-à-terre idéal en station, vue sur les Alpes. Meublé et équipé, cheminée, accès ski aux pieds.',
    price: 3500, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 105,
    city: 'Verbier', canton: 'VS', postal_code: '1936', address: 'Route de Médran 42',
    lat: 46.0965, lng: 7.2288,
    is_furnished: true, deposit_months: 3, features: ['Meublé', 'Vue montagne', 'Cheminée', 'Parking', 'Balcon'],
  },

  // ── Fribourg (FR) ──
  {
    id: '13',
    type: 'apartment', pool: 'apartment_cozy',
    title: '3.5 pièces proche EPFL Fribourg',
    description: 'Appartement fonctionnel dans quartier moderne, idéal pour famille ou colocation. Proche transports et commerces.',
    price: 1750, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 85,
    city: 'Fribourg', canton: 'FR', postal_code: '1700', address: 'Rue de Morat 12',
    lat: 46.8019, lng: 7.1509,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Cave'],
  },

  // ── Neuchâtel (NE) ──
  {
    id: '14',
    type: 'apartment', pool: 'apartment_cozy',
    title: '2.5 pièces vue lac à Neuchâtel',
    description: 'Charmant appartement au centre-ville avec vue dégagée sur le lac. Parquet, cuisine équipée, balcon plein sud.',
    price: 1650, rooms: 2.5, bedrooms: 1, bathrooms: 1, surface_m2: 60,
    city: 'Neuchâtel', canton: 'NE', postal_code: '2000', address: 'Avenue du Premier-Mars 8',
    lat: 46.9927, lng: 6.9316,
    is_furnished: false, deposit_months: 3, features: ['Balcon', 'Vue lac', 'Cave'],
  },

  // ── Ticino (TI) ──
  {
    id: '15',
    type: 'apartment', pool: 'apartment_modern',
    title: 'Appartamento 3.5 locali a Lugano',
    description: 'Luminoso appartamento con terrazza vista lago. Quartiere tranquillo, vicino al centro e ai trasporti pubblici.',
    price: 2800, rooms: 3.5, bedrooms: 2, bathrooms: 2, surface_m2: 95,
    city: 'Lugano', canton: 'TI', postal_code: '6900', address: 'Via Nassa 15',
    lat: 46.0037, lng: 8.9511,
    is_furnished: false, deposit_months: 3, features: ['Terrasse', 'Vue lac', 'Ascenseur', 'Parking'],
  },
]

// 12 biens à vendre répartis sur 8 cantons (repris du commit 2aa7218 / demoListings.ts)
const BUY_LISTINGS = [
  // ── Genève (GE) — 3 ──
  {
    id: '01', type: 'apartment', pool: 'apartment_modern',
    title: 'Appartement lumineux avec vue',
    description: 'Bel appartement traversant avec vue dégagée, proche des transports publics. Cuisine équipée, balcon, cave, parking inclus.',
    price: 1_250_000, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 112,
    city: 'Genève', canton: 'GE', postal_code: '1206', address: 'Rue de Champel 42',
    lat: 46.1933, lng: 6.1469,
    charges_monthly: 420, features: ['Balcon', 'Cave', 'Parking', 'Ascenseur'],
  },
  {
    id: '02', type: 'apartment', pool: 'apartment_cozy',
    title: 'Bel appartement rénové',
    description: 'Rénovation récente de qualité, quartier calme et résidentiel. Proche écoles, commerces et parcs.',
    price: 890_000, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 78,
    city: 'Carouge', canton: 'GE', postal_code: '1227', address: 'Rue Saint-Joseph 18',
    lat: 46.1811, lng: 6.1400,
    charges_monthly: 310, features: ['Balcon', 'Cave', 'Ascenseur'],
  },
  {
    id: '03', type: 'villa', pool: 'villa',
    title: 'Villa familiale avec jardin',
    description: 'Magnifique villa individuelle avec jardin arboré et piscine. Cadre verdoyant, proche lac et commodités.',
    price: 3_450_000, rooms: 7, bedrooms: 4, bathrooms: 3, surface_m2: 245,
    city: 'Collonge-Bellerive', canton: 'GE', postal_code: '1245', address: 'Chemin des Vignes 12',
    lat: 46.2453, lng: 6.2048,
    features: ['Jardin', 'Piscine', 'Garage', 'Cave', 'Véranda'],
  },

  // ── Vaud (VD) — 2 ──
  {
    id: '04', type: 'apartment', pool: 'apartment_modern',
    title: 'Grand appartement familial',
    description: 'Spacieux appartement idéal pour famille, lumineux et fonctionnel. Bâtiment récent, proche CHUV et EPFL.',
    price: 1_580_000, rooms: 5.5, bedrooms: 3, bathrooms: 2, surface_m2: 140,
    city: 'Lausanne', canton: 'VD', postal_code: '1005', address: 'Avenue de Rumine 55',
    lat: 46.5197, lng: 6.6323,
    charges_monthly: 480, features: ['Balcon', 'Cave', 'Parking', 'Ascenseur'],
  },
  {
    id: '05', type: 'house', pool: 'house',
    title: 'Maison de caractère rénovée',
    description: 'Maison de village entièrement rénovée avec cachet préservé. Jardin privatif, garage double, emplacement calme.',
    price: 2_180_000, rooms: 6, bedrooms: 4, bathrooms: 2, surface_m2: 185,
    city: 'Nyon', canton: 'VD', postal_code: '1260', address: 'Chemin de la Treille 7',
    lat: 46.3833, lng: 6.2391,
    features: ['Jardin', 'Cheminée', 'Garage', 'Cave'],
  },

  // ── Valais (VS) — 1 ──
  {
    id: '06', type: 'house', pool: 'house',
    title: 'Belle maison avec vue',
    description: 'Chalet de montagne avec vue panoramique sur les Alpes. Exposition plein sud, terrasse, garage.',
    price: 1_780_000, rooms: 5, bedrooms: 3, bathrooms: 2, surface_m2: 160,
    city: 'Crans-Montana', canton: 'VS', postal_code: '3963', address: 'Route de la Moubra 88',
    lat: 46.3118, lng: 7.4781,
    features: ['Vue montagne', 'Balcon', 'Garage', 'Cave'],
  },

  // ── Zurich (ZH) — 2 ──
  {
    id: '07', type: 'apartment', pool: 'apartment_modern',
    title: 'Moderne appartement à Zurich centre',
    description: 'Appartement contemporain au cœur de Zurich, à 5 min de la Hauptbahnhof. Finitions haut de gamme, cave.',
    price: 1_450_000, rooms: 4, bedrooms: 2, bathrooms: 2, surface_m2: 105,
    city: 'Zürich', canton: 'ZH', postal_code: '8001', address: 'Bahnhofstrasse 104',
    lat: 47.3769, lng: 8.5417,
    charges_monthly: 390, features: ['Balcon', 'Cave', 'Ascenseur', 'Proche transports'],
  },
  {
    id: '08', type: 'villa', pool: 'villa',
    title: 'Villa avec piscine vue lac',
    description: 'Villa d\'architecte avec piscine chauffée et vue imprenable sur le lac de Zurich. Jardin paysager.',
    price: 2_890_000, rooms: 6.5, bedrooms: 4, bathrooms: 3, surface_m2: 210,
    city: 'Küsnacht', canton: 'ZH', postal_code: '8700', address: 'Seestrasse 201',
    lat: 47.3180, lng: 8.5841,
    features: ['Jardin', 'Piscine', 'Vue lac', 'Garage'],
  },

  // ── Bern (BE) — 1 ──
  {
    id: '09', type: 'apartment', pool: 'apartment_cozy',
    title: 'Appartement traversant au calme',
    description: 'Appartement rénové en 2023 dans quartier résidentiel. Balcon plein sud, proche écoles et commerces.',
    price: 950_000, rooms: 4, bedrooms: 2, bathrooms: 1, surface_m2: 96,
    city: 'Bern', canton: 'BE', postal_code: '3011', address: 'Länggassstrasse 28',
    lat: 46.9480, lng: 7.4474,
    charges_monthly: 340, features: ['Balcon', 'Cave', 'Ascenseur'],
  },

  // ── Tessin (TI) — 1 ──
  {
    id: '10', type: 'apartment', pool: 'apartment_modern',
    title: 'Attico vista lago a Lugano',
    description: 'Magnifico attico con grande terrazza panoramica. Vista spettacolare sul lago e sulle montagne.',
    price: 2_150_000, rooms: 5, bedrooms: 3, bathrooms: 2, surface_m2: 155,
    city: 'Lugano', canton: 'TI', postal_code: '6900', address: 'Via San Salvatore 14',
    lat: 46.0037, lng: 8.9511,
    features: ['Terrasse', 'Vue lac', 'Parking', 'Ascenseur'],
  },

  // ── Fribourg (FR) — 1 ──
  {
    id: '11', type: 'apartment', pool: 'apartment_cozy',
    title: 'Appartement cosy centre-ville',
    description: 'Appartement avec cachet dans la vieille ville. Parquet massif, cuisine équipée, cave voûtée.',
    price: 720_000, rooms: 3.5, bedrooms: 2, bathrooms: 1, surface_m2: 82,
    city: 'Fribourg', canton: 'FR', postal_code: '1700', address: 'Rue de Lausanne 35',
    lat: 46.8019, lng: 7.1509,
    charges_monthly: 260, features: ['Cave', 'Ascenseur'],
  },

  // ── Neuchâtel (NE) — 1 ──
  {
    id: '12', type: 'apartment', pool: 'apartment_modern',
    title: 'Appartement moderne vue lac',
    description: 'Appartement lumineux avec vue dégagée sur le lac de Neuchâtel. Bâtiment récent, quartier calme.',
    price: 1_080_000, rooms: 4.5, bedrooms: 3, bathrooms: 2, surface_m2: 118,
    city: 'Neuchâtel', canton: 'NE', postal_code: '2000', address: 'Rue du Seyon 22',
    lat: 46.9927, lng: 6.9316,
    charges_monthly: 380, features: ['Balcon', 'Vue lac', 'Cave', 'Ascenseur'],
  },
]

function buildRecord(l, txType) {
  const isRent = txType === 'rent'
  const sourceId = `demo-${txType}-${l.id}`
  const photos = PHOTO_POOLS[l.pool]
  const pricePerM2 = Math.round((l.price / l.surface_m2) * 100) / 100

  const base = {
    source_id: sourceId,
    source_portal: 'megga-demo',
    source_url: `https://megga.ch/listing/market-${sourceId}`,
    title: l.title,
    description: l.description,
    type: l.type,
    transaction_type: txType,
    price: l.price,
    price_at_first_seen: l.price,
    current_price: l.price,
    price_per_m2: pricePerM2,
    rooms: l.rooms,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    surface_m2: l.surface_m2,
    address: l.address,
    city: l.city,
    canton: l.canton,
    postal_code: l.postal_code,
    lat: l.lat,
    lng: l.lng,
    photos,
    photos_count: photos.length,
    features: JSON.stringify(l.features),
    charges_monthly: l.charges_monthly ?? null,
    agency_name: 'MEGGA Demo Agency',
    agency_phone: '+41 22 545 00 00',
    status: 'active',
    quality_score: 90,
    quality_flags: '[]',
  }

  // Rental-only fields (deposit_months, is_furnished only relevant for rent)
  if (isRent) {
    base.is_furnished = l.is_furnished ?? false
    base.deposit_months = l.deposit_months ?? 3
  }

  return base
}

async function upsert(records) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?on_conflict=source_id`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY || SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Upsert failed: ${resp.status} — ${text.substring(0, 500)}`)
  }
}

async function main() {
  const buyRecords = BUY_LISTINGS.map((l) => buildRecord(l, 'buy'))
  const rentRecords = RENT_LISTINGS.map((l) => buildRecord(l, 'rent'))
  const records = [...buyRecords, ...rentRecords]

  console.log(`🌱 Seeding ${records.length} placeholder listings (${buyRecords.length} buy + ${rentRecords.length} rent) into market_listings...`)

  try {
    await upsert(records)
    console.log(`✅ Seeded ${records.length} placeholder listings successfully`)
    console.log('')

    console.log('── BUY (vente) ──')
    const buyByCanton = {}
    for (const r of buyRecords) buyByCanton[r.canton] = (buyByCanton[r.canton] || 0) + 1
    for (const [c, n] of Object.entries(buyByCanton).sort()) {
      console.log(`  ${c}: ${n}`)
    }
    const buyMin = Math.min(...buyRecords.map((r) => r.price))
    const buyMax = Math.max(...buyRecords.map((r) => r.price))
    console.log(`  Price: CHF ${buyMin.toLocaleString('fr-CH')} → ${buyMax.toLocaleString('fr-CH')}`)

    console.log('')
    console.log('── RENT (location) ──')
    const rentByCanton = {}
    for (const r of rentRecords) rentByCanton[r.canton] = (rentByCanton[r.canton] || 0) + 1
    for (const [c, n] of Object.entries(rentByCanton).sort()) {
      console.log(`  ${c}: ${n}`)
    }
    const rentMin = Math.min(...rentRecords.map((r) => r.price))
    const rentMax = Math.max(...rentRecords.map((r) => r.price))
    console.log(`  Price: CHF ${rentMin.toLocaleString('fr-CH')} → ${rentMax.toLocaleString('fr-CH')}/mois`)

    console.log('')
    console.log('Visit /acheter and /louer on the app to see them.')
    console.log('To remove: DELETE FROM market_listings WHERE source_portal = \'megga-demo\';')
  } catch (err) {
    console.error('❌', err.message)
    process.exit(1)
  }
}

main()
