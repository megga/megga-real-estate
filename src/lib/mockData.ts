export interface MockListing {
  id: string
  title: string
  price: number
  charges_monthly: number
  address: string
  city: string
  canton: string
  postal_code: string
  rooms: number
  bedrooms: number
  bathrooms: number
  surface_m2: number
  floor: number | null
  total_floors: number | null
  year_built: number
  photos: string[]
  is_hot?: boolean
  is_new?: boolean
  is_exclusive?: boolean
  type: 'apartment' | 'house' | 'villa' | 'commercial' | 'land'
  status: 'active' | 'reserved' | 'sold'
  description: string
  features: Record<string, string>
  lat: number
  lng: number
  agent: {
    name: string
    agency: string
    phone: string
    email: string
    photo: string
  }
}

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: '1',
    title: 'Appartement lumineux aux Eaux-Vives',
    price: 720000,
    charges_monthly: 350,
    address: 'Rue du Lac 12',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1207',
    rooms: 4,
    bedrooms: 2,
    bathrooms: 1,
    surface_m2: 95,
    floor: 3,
    total_floors: 5,
    year_built: 2018,
    type: 'apartment',
    status: 'active',
    is_hot: true,
    photos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop',
    ],
    description: `Magnifique appartement de 4 pièces entièrement rénové, situé au cœur du quartier des Eaux-Vives à Genève. L'appartement bénéficie d'une luminosité exceptionnelle grâce à ses grandes baies vitrées orientées sud-ouest, offrant une vue dégagée sur le lac Léman.\n\nLe séjour spacieux de 35 m² s'ouvre sur un balcon de 8 m², idéal pour profiter des soirées d'été. La cuisine équipée haut de gamme (Siemens) est ouverte sur le salon. Les deux chambres sont de belles dimensions avec parquet en chêne massif.\n\nL'immeuble dispose d'un ascenseur, d'une buanderie commune et d'un local à vélos. Une place de parking souterrain est incluse dans le prix. Proximité immédiate des transports publics, commerces et écoles.`,
    features: {
      'Année de construction': '2018',
      'Chauffage': 'Sol, pompe à chaleur',
      'Parking': '1 place souterraine incluse',
      'Cave': 'Oui',
      'Balcon': '8 m², orienté sud-ouest',
      'Vue': 'Lac Léman',
      'Ascenseur': 'Oui',
      'État': 'Rénové en 2023',
    },
    lat: 46.2044,
    lng: 6.1621,
    agent: {
      name: 'Gregory Lyonnet',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 12 34',
      email: 'gregory@megga.ch',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '2',
    title: 'Duplex moderne à Champel',
    price: 1250000,
    charges_monthly: 520,
    address: 'Avenue de Champel 45',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1206',
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    surface_m2: 140,
    floor: 4,
    total_floors: 5,
    year_built: 2020,
    type: 'apartment',
    status: 'active',
    is_exclusive: true,
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
    ],
    description: `Superbe duplex de 5 pièces en attique avec vue panoramique sur le Salève et les Alpes. Cet appartement d'exception combine modernité et élégance dans l'un des quartiers les plus prisés de Genève.\n\nLe niveau inférieur comprend un vaste séjour-salon avec cheminée, une cuisine ouverte design, un WC visiteurs et un accès direct à la terrasse de 25 m². Le niveau supérieur abrite trois chambres dont une suite parentale avec dressing et salle de bains privative.\n\nFinitions haut de gamme : parquet chevron, domotique, stores électriques, triple vitrage. Deux places de parking souterrain et une cave. Résidence sécurisée avec conciergerie.`,
    features: {
      'Année de construction': '2020',
      'Chauffage': 'Sol, géothermie',
      'Parking': '2 places souterraines',
      'Cave': 'Oui, 8 m²',
      'Terrasse': '25 m², vue Alpes',
      'Vue': 'Salève, Alpes',
      'Ascenseur': 'Oui, privé',
      'État': 'Neuf',
    },
    lat: 46.1940,
    lng: 6.1540,
    agent: {
      name: 'Gregory Lyonnet',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 12 34',
      email: 'gregory@megga.ch',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '3',
    title: 'Studio rénové à Plainpalais',
    price: 385000,
    charges_monthly: 180,
    address: 'Rue de Carouge 78',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1205',
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    surface_m2: 42,
    floor: 2,
    total_floors: 4,
    year_built: 1965,
    type: 'apartment',
    status: 'active',
    is_new: true,
    photos: [
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&h=600&fit=crop',
    ],
    description: `Charmant studio entièrement rénové au cœur de Plainpalais, à deux pas du parc des Bastions et de l'Université. Idéal pour un premier achat ou un investissement locatif avec un excellent rendement.\n\nL'espace a été intelligemment optimisé : coin nuit séparé par une verrière, cuisine américaine équipée, salle de douche moderne. Les finitions sont soignées : parquet clair, peinture fraîche, luminaires design.\n\nSituation idéale pour les transports (tram 12 et 18 à 50m), les commerces de la rue de Carouge et la vie culturelle du quartier.`,
    features: {
      'Année de construction': '1965, rénové 2024',
      'Chauffage': 'Radiateurs, gaz',
      'Parking': 'Non inclus',
      'Cave': 'Oui',
      'Balcon': 'Non',
      'Vue': 'Cour intérieure calme',
      'Ascenseur': 'Non',
      'État': 'Entièrement rénové',
    },
    lat: 46.1980,
    lng: 6.1400,
    agent: {
      name: 'Sophie Martin',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 56 78',
      email: 'sophie@megga.ch',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '4',
    title: 'Villa avec vue sur le lac',
    price: 2950000,
    charges_monthly: 0,
    address: 'Chemin des Crêts 5',
    city: 'Cologny',
    canton: 'GE',
    postal_code: '1223',
    rooms: 7,
    bedrooms: 4,
    bathrooms: 3,
    surface_m2: 280,
    floor: null,
    total_floors: null,
    year_built: 2015,
    type: 'villa',
    status: 'active',
    is_hot: true,
    photos: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
    ],
    description: `Villa d'architecte exceptionnelle nichée sur les hauteurs de Cologny, offrant une vue imprenable à 180° sur le lac Léman et le jet d'eau. Cette propriété de standing allie design contemporain et matériaux nobles.\n\nLe rez-de-chaussée s'articule autour d'un grand séjour de 60 m² avec baies vitrées du sol au plafond, ouvrant sur une terrasse avec piscine chauffée. La cuisine professionnelle (La Cornue) jouxte une salle à manger formelle. À l'étage, la suite parentale offre un dressing de 12 m² et une salle de bains en marbre de Carrare.\n\nJardin paysager de 800 m², garage double, cave à vin climatisée, local technique. Système de sécurité, domotique complète. Quartier résidentiel calme, à 5 min de la vieille ville.`,
    features: {
      'Année de construction': '2015',
      'Chauffage': 'Sol, géothermie',
      'Parking': 'Garage double',
      'Cave': 'Cave à vin climatisée',
      'Piscine': 'Chauffée, extérieure',
      'Terrain': '800 m²',
      'Vue': 'Lac Léman, jet d\'eau, panoramique',
      'État': 'Excellent',
    },
    lat: 46.2180,
    lng: 6.1800,
    agent: {
      name: 'Gregory Lyonnet',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 12 34',
      email: 'gregory@megga.ch',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '5',
    title: 'Loft industriel aux Pâquis',
    price: 890000,
    charges_monthly: 400,
    address: 'Rue de Berne 22',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1201',
    rooms: 3,
    bedrooms: 1,
    bathrooms: 1,
    surface_m2: 110,
    floor: 4,
    total_floors: 4,
    year_built: 1920,
    type: 'apartment',
    status: 'active',
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop',
    ],
    description: `Loft atypique de caractère dans un ancien bâtiment industriel reconverti. Hauts plafonds de 4m, poutres métalliques apparentes, grandes fenêtres industrielles — un espace unique aux Pâquis.\n\nL'espace ouvert de 110 m² comprend un séjour cathédrale, une mezzanine aménagée en chambre, une cuisine design en béton ciré et une salle de bains contemporaine. Le cachet industriel est préservé : murs en briques, sol en béton poli, tuyauteries apparentes.\n\nEn plein cœur du quartier des Pâquis, à proximité de la gare Cornavin, du lac et de tous les commerces. Idéal pour un profil créatif ou un couple.`,
    features: {
      'Année de construction': '1920, reconverti 2019',
      'Chauffage': 'Radiateurs, gaz de ville',
      'Parking': 'Non (places à louer à proximité)',
      'Cave': 'Oui',
      'Hauteur plafond': '4 mètres',
      'Vue': 'Toits de Genève',
      'Ascenseur': 'Oui (monte-charge reconverti)',
      'État': 'Rénové, caractère préservé',
    },
    lat: 46.2100,
    lng: 6.1450,
    agent: {
      name: 'Sophie Martin',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 56 78',
      email: 'sophie@megga.ch',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '6',
    title: 'Appartement familial à Carouge',
    price: 650000,
    charges_monthly: 320,
    address: 'Place du Marché 8',
    city: 'Carouge',
    canton: 'GE',
    postal_code: '1227',
    rooms: 4,
    bedrooms: 2,
    bathrooms: 1,
    surface_m2: 88,
    floor: 1,
    total_floors: 3,
    year_built: 1985,
    type: 'apartment',
    status: 'active',
    photos: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=800&h=600&fit=crop',
    ],
    description: `Bel appartement familial de 4 pièces idéalement situé sur la Place du Marché de Carouge, au cœur de la vie de quartier. Le charme de Carouge avec ses ruelles piétonnes, ses boutiques et restaurants, à votre porte.\n\nL'appartement offre un séjour traversant lumineux, une cuisine séparée récemment refaite, deux chambres spacieuses et une salle de bains avec baignoire. Un balcon couvert donne sur la place et son marché animé.\n\nEmplacement exceptionnel : écoles à 200m, tram à 100m, autoroute à 5 min. Copropriété bien entretenue avec jardin commun.`,
    features: {
      'Année de construction': '1985',
      'Chauffage': 'Radiateurs, mazout',
      'Parking': '1 place extérieure',
      'Cave': 'Oui',
      'Balcon': '6 m², vue place du Marché',
      'Vue': 'Place du Marché',
      'Ascenseur': 'Non',
      'État': 'Bon, cuisine rénovée 2022',
    },
    lat: 46.1830,
    lng: 6.1390,
    agent: {
      name: 'Gregory Lyonnet',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 12 34',
      email: 'gregory@megga.ch',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '7',
    title: 'Penthouse avec terrasse panoramique',
    price: 3200000,
    charges_monthly: 750,
    address: 'Quai du Mont-Blanc 18',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1201',
    rooms: 6,
    bedrooms: 3,
    bathrooms: 2,
    surface_m2: 210,
    floor: 7,
    total_floors: 7,
    year_built: 2022,
    type: 'apartment',
    status: 'active',
    is_hot: true,
    photos: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
    ],
    description: `Penthouse d'exception au dernier étage d'une résidence prestigieuse sur le Quai du Mont-Blanc. Vue panoramique à 360° sur le lac Léman, le Mont-Blanc et la rade de Genève depuis une terrasse de 80 m².\n\nIntérieur signé par un architecte de renom : séjour de 55 m² triple exposition, cuisine Bulthaup, suite parentale avec jacuzzi et terrasse privée. Matériaux d'exception : marbre italien, boiseries en noyer, cuivre brossé.\n\nServices de la résidence : conciergerie 24h/24, spa avec piscine intérieure, salle de fitness, parking souterrain sécurisé. Adresse parmi les plus prestigieuses de Genève.`,
    features: {
      'Année de construction': '2022',
      'Chauffage': 'Sol, CAD (chauffage à distance)',
      'Parking': '2 places souterraines sécurisées',
      'Cave': 'Oui, 15 m²',
      'Terrasse': '80 m², panoramique',
      'Vue': 'Lac, Mont-Blanc, rade — 360°',
      'Ascenseur': 'Privatif',
      'État': 'Neuf, standing',
    },
    lat: 46.2085,
    lng: 6.1520,
    agent: {
      name: 'Gregory Lyonnet',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 12 34',
      email: 'gregory@megga.ch',
      photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
  },
  {
    id: '8',
    title: 'Maison de ville rénovée',
    price: 1450000,
    charges_monthly: 0,
    address: 'Rue Ancienne 34',
    city: 'Carouge',
    canton: 'GE',
    postal_code: '1227',
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    surface_m2: 160,
    floor: null,
    total_floors: null,
    year_built: 1890,
    type: 'house',
    status: 'active',
    photos: [
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&h=800&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1588854337236-6889d631faa8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
    ],
    description: `Maison de ville de caractère entièrement restaurée dans la vieille ville de Carouge, inscrite au patrimoine. Trois niveaux avec cour intérieure privée, alliant charme historique et confort moderne.\n\nRez-de-chaussée : entrée avec tomettes d'origine, séjour double avec cheminée en pierre, cuisine avec accès direct à la cour. Premier étage : deux chambres avec parquet ancien, salle de bains design. Deuxième étage : suite parentale mansardée avec poutres apparentes et salle d'eau.\n\nCour intérieure de 30 m² avec terrasse et plantation. Situation exceptionnelle en zone piétonne, au cœur de la vie carougeoise.`,
    features: {
      'Année de construction': '1890, restaurée 2021',
      'Chauffage': 'Sol (rez) + radiateurs (étages)',
      'Parking': 'Place louable à 100m',
      'Cave': 'Voûtée, d\'origine',
      'Cour': '30 m², aménagée',
      'Vue': 'Vieille ville de Carouge',
      'Patrimoine': 'Inscrite à l\'inventaire',
      'État': 'Restaurée avec soin',
    },
    lat: 46.1845,
    lng: 6.1420,
    agent: {
      name: 'Sophie Martin',
      agency: 'MEGGA Immobilier',
      phone: '+41 22 700 56 78',
      email: 'sophie@megga.ch',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    },
  },
]

/** Helper: get a listing by id */
export function getListingById(id: string): MockListing | undefined {
  return MOCK_LISTINGS.find((l) => l.id === id)
}

/** Convert MockListing to the lighter ListingCardData format */
export function toCardData(l: MockListing) {
  return {
    id: l.id,
    title: l.title,
    price: l.price,
    address: l.address,
    city: l.city,
    rooms: l.rooms,
    bedrooms: l.bedrooms,
    surface_m2: l.surface_m2,
    is_hot: l.is_hot,
    photos: l.photos,
  }
}

// ─── CONTACTS ────────────────────────────────────────────────────────────────

export interface MockContact {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  type: 'buyer' | 'seller' | 'both' | 'lead'
  score: 'hot' | 'warm' | 'cold'
  source: string
  tags: string[]
  notes: string
  address: string
  city: string
  canton: string
  created_at: string
  last_activity: string
  /** Buyer-specific search criteria */
  search_criteria?: {
    property_type: string
    budget_min: number
    budget_max: number
    location: string
    rooms_min: number
    surface_min: number
  }
  /** Linked transactions */
  transactions: {
    id: string
    property_title: string
    stage: string
    price: number
    updated_at: string
  }[]
  /** Activity history */
  activities: {
    id: string
    action: string
    description: string
    date: string
  }[]
}

export const MOCK_CONTACTS: MockContact[] = [
  {
    id: 'c1',
    first_name: 'Marie',
    last_name: 'Dupont',
    email: 'marie.dupont@gmail.com',
    phone: '+41 22 310 45 67',
    type: 'buyer',
    score: 'hot',
    source: 'Site web',
    tags: ['VIP', 'Genève'],
    notes: 'Recherche active, très motivée. Budget flexible si coup de cœur.',
    address: 'Rue du Rhône 42',
    city: 'Genève',
    canton: 'GE',
    created_at: '2025-11-15T10:30:00Z',
    last_activity: '2026-03-15T14:20:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 600000,
      budget_max: 900000,
      location: 'Genève centre, Eaux-Vives, Champel',
      rooms_min: 4,
      surface_min: 80,
    },
    transactions: [
      { id: 't1', property_title: 'Appartement lumineux aux Eaux-Vives', stage: 'visit_planned', price: 720000, updated_at: '2026-03-14T09:00:00Z' },
    ],
    activities: [
      { id: 'a1', action: 'visit_planned', description: 'Visite planifiée — Appartement Eaux-Vives', date: '2026-03-14T09:00:00Z' },
      { id: 'a2', action: 'call', description: 'Appel sortant — Confirmation critères de recherche', date: '2026-03-10T16:30:00Z' },
      { id: 'a3', action: 'email', description: 'Email envoyé — Sélection de 3 biens', date: '2026-03-08T11:00:00Z' },
      { id: 'a4', action: 'contact_created', description: 'Contact créé via formulaire site web', date: '2025-11-15T10:30:00Z' },
    ],
  },
  {
    id: 'c2',
    first_name: 'Pierre',
    last_name: 'Müller',
    email: 'p.mueller@bluewin.ch',
    phone: '+41 79 456 78 90',
    type: 'seller',
    score: 'warm',
    source: 'Recommandation',
    tags: ['Cologny', 'Villa'],
    notes: 'Vend sa villa pour déménager à Zurich. Pas pressé mais veut un bon prix.',
    address: 'Chemin des Crêts 5',
    city: 'Cologny',
    canton: 'GE',
    created_at: '2025-12-01T09:00:00Z',
    last_activity: '2026-03-12T11:15:00Z',
    transactions: [
      { id: 't2', property_title: 'Villa avec vue sur le lac', stage: 'offer', price: 2950000, updated_at: '2026-03-12T11:15:00Z' },
    ],
    activities: [
      { id: 'a5', action: 'offer_received', description: 'Offre reçue — CHF 2\'800\'000 (M. Schmid)', date: '2026-03-12T11:15:00Z' },
      { id: 'a6', action: 'visit', description: 'Visite effectuée avec M. et Mme Schmid', date: '2026-03-05T14:00:00Z' },
      { id: 'a7', action: 'document', description: 'Mandat de vente signé', date: '2025-12-15T10:00:00Z' },
      { id: 'a8', action: 'contact_created', description: 'Contact créé — Recommandation de M. Bonvin', date: '2025-12-01T09:00:00Z' },
    ],
  },
  {
    id: 'c3',
    first_name: 'Sophie',
    last_name: 'Favre',
    email: 'sophie.favre@protonmail.com',
    phone: '+41 76 234 56 78',
    type: 'buyer',
    score: 'hot',
    source: 'ImmoScout24',
    tags: ['Premier achat', 'Jeune couple'],
    notes: 'Jeune couple, premier achat. Pré-approuvé bancaire à CHF 500\'000.',
    address: 'Avenue de la Gare 15',
    city: 'Lausanne',
    canton: 'VD',
    created_at: '2026-01-20T14:00:00Z',
    last_activity: '2026-03-14T16:45:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 350000,
      budget_max: 500000,
      location: 'Genève, Carouge, Lancy',
      rooms_min: 3,
      surface_min: 60,
    },
    transactions: [
      { id: 't3', property_title: 'Studio rénové à Plainpalais', stage: 'negotiation', price: 385000, updated_at: '2026-03-14T16:45:00Z' },
    ],
    activities: [
      { id: 'a9', action: 'negotiation', description: 'Négociation en cours — Contre-offre à CHF 370\'000', date: '2026-03-14T16:45:00Z' },
      { id: 'a10', action: 'offer_sent', description: 'Offre envoyée — CHF 365\'000', date: '2026-03-11T10:00:00Z' },
      { id: 'a11', action: 'visit', description: 'Visite effectuée — Studio Plainpalais', date: '2026-03-06T15:30:00Z' },
      { id: 'a12', action: 'contact_created', description: 'Contact créé via ImmoScout24', date: '2026-01-20T14:00:00Z' },
    ],
  },
  {
    id: 'c4',
    first_name: 'Hans',
    last_name: 'Zimmermann',
    email: 'h.zimmermann@ubs.com',
    phone: '+41 44 567 89 01',
    type: 'buyer',
    score: 'warm',
    source: 'Salon immobilier',
    tags: ['Investisseur', 'Zurich'],
    notes: 'Investisseur zurichois, cherche du rendement à Genève. Peut acheter cash.',
    address: 'Bahnhofstrasse 120',
    city: 'Zürich',
    canton: 'ZH',
    created_at: '2026-02-10T11:00:00Z',
    last_activity: '2026-03-10T09:30:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 300000,
      budget_max: 800000,
      location: 'Genève, Carouge',
      rooms_min: 2,
      surface_min: 40,
    },
    transactions: [],
    activities: [
      { id: 'a13', action: 'call', description: 'Appel entrant — Demande de biens à rendement', date: '2026-03-10T09:30:00Z' },
      { id: 'a14', action: 'email', description: 'Email envoyé — Dossier investissement Carouge', date: '2026-02-25T14:00:00Z' },
      { id: 'a15', action: 'contact_created', description: 'Contact créé — Salon immobilier Palexpo', date: '2026-02-10T11:00:00Z' },
    ],
  },
  {
    id: 'c5',
    first_name: 'Isabelle',
    last_name: 'Rochat',
    email: 'isabelle.rochat@sunrise.ch',
    phone: '+41 22 789 01 23',
    type: 'both',
    score: 'hot',
    source: 'Site web',
    tags: ['Relocation', 'Urgent'],
    notes: 'Vend à Carouge et rachète plus grand à Champel. Timing serré, mutation professionnelle.',
    address: 'Place du Marché 8',
    city: 'Carouge',
    canton: 'GE',
    created_at: '2026-01-05T08:30:00Z',
    last_activity: '2026-03-15T17:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 900000,
      budget_max: 1400000,
      location: 'Champel, Florissant, Malagnou',
      rooms_min: 5,
      surface_min: 120,
    },
    transactions: [
      { id: 't4', property_title: 'Appartement familial à Carouge', stage: 'reserved', price: 650000, updated_at: '2026-03-10T10:00:00Z' },
      { id: 't5', property_title: 'Duplex moderne à Champel', stage: 'visit_planned', price: 1250000, updated_at: '2026-03-15T17:00:00Z' },
    ],
    activities: [
      { id: 'a16', action: 'visit_planned', description: 'Visite planifiée — Duplex Champel', date: '2026-03-15T17:00:00Z' },
      { id: 'a17', action: 'reserved', description: 'Bien réservé — Appartement Carouge (vente)', date: '2026-03-10T10:00:00Z' },
      { id: 'a18', action: 'call', description: 'Appel — Point sur les deux dossiers', date: '2026-03-07T11:00:00Z' },
      { id: 'a19', action: 'contact_created', description: 'Contact créé via formulaire site web', date: '2026-01-05T08:30:00Z' },
    ],
  },
  {
    id: 'c6',
    first_name: 'Jean-Marc',
    last_name: 'Bonvin',
    email: 'jm.bonvin@bcge.ch',
    phone: '+41 27 345 67 89',
    type: 'buyer',
    score: 'cold',
    source: 'Recommandation',
    tags: ['Résidence secondaire'],
    notes: 'Intéressé par une résidence secondaire à Genève. Pas de deadline.',
    address: 'Rue de la Dent-Blanche 4',
    city: 'Sion',
    canton: 'VS',
    created_at: '2025-10-20T09:00:00Z',
    last_activity: '2026-02-18T10:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 500000,
      budget_max: 1200000,
      location: 'Genève rive droite',
      rooms_min: 3,
      surface_min: 70,
    },
    transactions: [],
    activities: [
      { id: 'a20', action: 'email', description: 'Email envoyé — Nouveautés février', date: '2026-02-18T10:00:00Z' },
      { id: 'a21', action: 'call', description: 'Appel sortant — Pas de nouvelles depuis 2 mois', date: '2026-01-15T14:00:00Z' },
      { id: 'a22', action: 'contact_created', description: 'Contact créé — Recommandation de P. Müller', date: '2025-10-20T09:00:00Z' },
    ],
  },
  {
    id: 'c7',
    first_name: 'Nathalie',
    last_name: 'Schmid',
    email: 'nathalie.schmid@gmail.com',
    phone: '+41 78 901 23 45',
    type: 'buyer',
    score: 'hot',
    source: 'Site web',
    tags: ['Famille', 'Cologny'],
    notes: 'Cherche villa haut de gamme à Cologny. Budget confortable, décision rapide.',
    address: 'Route de Florissant 78',
    city: 'Genève',
    canton: 'GE',
    created_at: '2026-02-01T13:00:00Z',
    last_activity: '2026-03-13T15:30:00Z',
    search_criteria: {
      property_type: 'Villa',
      budget_min: 2000000,
      budget_max: 4000000,
      location: 'Cologny, Vandœuvres, Collonge-Bellerive',
      rooms_min: 6,
      surface_min: 200,
    },
    transactions: [
      { id: 't6', property_title: 'Villa avec vue sur le lac', stage: 'offer', price: 2950000, updated_at: '2026-03-13T15:30:00Z' },
    ],
    activities: [
      { id: 'a23', action: 'offer_sent', description: 'Offre envoyée — CHF 2\'800\'000', date: '2026-03-13T15:30:00Z' },
      { id: 'a24', action: 'visit', description: '2e visite — Villa Cologny avec architecte', date: '2026-03-08T10:00:00Z' },
      { id: 'a25', action: 'visit', description: '1re visite — Villa Cologny', date: '2026-02-20T14:00:00Z' },
      { id: 'a26', action: 'contact_created', description: 'Contact créé via site web', date: '2026-02-01T13:00:00Z' },
    ],
  },
  {
    id: 'c8',
    first_name: 'Laurent',
    last_name: 'Berset',
    email: 'laurent.berset@swisscom.com',
    phone: '+41 31 678 90 12',
    type: 'lead',
    score: 'warm',
    source: 'ImmoScout24',
    tags: ['Berne'],
    notes: 'Demande d\'information reçue, pas encore qualifié.',
    address: 'Bundesgasse 33',
    city: 'Berne',
    canton: 'BE',
    created_at: '2026-03-01T16:00:00Z',
    last_activity: '2026-03-01T16:00:00Z',
    transactions: [],
    activities: [
      { id: 'a27', action: 'contact_created', description: 'Lead entrant — Demande d\'info via ImmoScout24', date: '2026-03-01T16:00:00Z' },
    ],
  },
  {
    id: 'c9',
    first_name: 'Claudine',
    last_name: 'Thévenaz',
    email: 'c.thevenaz@bluewin.ch',
    phone: '+41 22 456 78 90',
    type: 'seller',
    score: 'warm',
    source: 'Recommandation',
    tags: ['Carouge', 'Succession'],
    notes: 'Vente dans le cadre d\'une succession. Plusieurs héritiers, décision collégiale.',
    address: 'Rue Ancienne 34',
    city: 'Carouge',
    canton: 'GE',
    created_at: '2025-09-10T10:00:00Z',
    last_activity: '2026-03-11T09:00:00Z',
    transactions: [
      { id: 't7', property_title: 'Maison de ville rénovée', stage: 'qualified', price: 1450000, updated_at: '2026-03-11T09:00:00Z' },
    ],
    activities: [
      { id: 'a28', action: 'call', description: 'Appel — Réunion héritiers prévue le 20 mars', date: '2026-03-11T09:00:00Z' },
      { id: 'a29', action: 'document', description: 'Estimation reçue — CHF 1\'450\'000', date: '2026-02-20T11:00:00Z' },
      { id: 'a30', action: 'visit', description: 'Visite d\'estimation du bien', date: '2026-01-10T14:00:00Z' },
      { id: 'a31', action: 'contact_created', description: 'Contact créé — Recommandation notaire', date: '2025-09-10T10:00:00Z' },
    ],
  },
  {
    id: 'c10',
    first_name: 'Marco',
    last_name: 'Bentivoglio',
    email: 'marco.b@ticino.com',
    phone: '+41 91 234 56 78',
    type: 'buyer',
    score: 'cold',
    source: 'Salon immobilier',
    tags: ['Tessin', 'Investissement'],
    notes: 'Rencontré au salon de Lugano. Intéressé par le marché genevois, phase exploratoire.',
    address: 'Via Nassa 21',
    city: 'Lugano',
    canton: 'TI',
    created_at: '2026-02-15T11:00:00Z',
    last_activity: '2026-02-28T14:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 400000,
      budget_max: 700000,
      location: 'Genève centre',
      rooms_min: 2,
      surface_min: 50,
    },
    transactions: [],
    activities: [
      { id: 'a32', action: 'email', description: 'Email envoyé — Présentation marché genevois', date: '2026-02-28T14:00:00Z' },
      { id: 'a33', action: 'contact_created', description: 'Contact créé — Salon immobilier Lugano', date: '2026-02-15T11:00:00Z' },
    ],
  },
  {
    id: 'c11',
    first_name: 'Élise',
    last_name: 'Reymond',
    email: 'elise.reymond@epfl.ch',
    phone: '+41 21 567 89 01',
    type: 'buyer',
    score: 'warm',
    source: 'Site web',
    tags: ['EPFL', 'Jeune pro'],
    notes: 'Chercheuse à l\'EPFL, relocalisée de Paris. Premier achat en Suisse.',
    address: 'Route de la Maladière 12',
    city: 'Lausanne',
    canton: 'VD',
    created_at: '2026-01-25T09:30:00Z',
    last_activity: '2026-03-09T11:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 300000,
      budget_max: 450000,
      location: 'Genève, Nyon, Lausanne',
      rooms_min: 3,
      surface_min: 55,
    },
    transactions: [],
    activities: [
      { id: 'a34', action: 'visit', description: 'Visite effectuée — Studio Plainpalais (pas convaincu)', date: '2026-03-09T11:00:00Z' },
      { id: 'a35', action: 'call', description: 'Appel entrant — Définition critères', date: '2026-02-05T15:00:00Z' },
      { id: 'a36', action: 'contact_created', description: 'Contact créé via site web', date: '2026-01-25T09:30:00Z' },
    ],
  },
  {
    id: 'c12',
    first_name: 'Thomas',
    last_name: 'Wenger',
    email: 'thomas.wenger@credit-suisse.com',
    phone: '+41 44 789 01 23',
    type: 'buyer',
    score: 'hot',
    source: 'Recommandation',
    tags: ['Expat', 'Premium'],
    notes: 'Expat britannique, directeur financier. Cherche standing et vue lac. Budget illimité.',
    address: 'Talstrasse 62',
    city: 'Zürich',
    canton: 'ZH',
    created_at: '2026-02-20T10:00:00Z',
    last_activity: '2026-03-14T14:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 2000000,
      budget_max: 5000000,
      location: 'Genève rive gauche, Cologny',
      rooms_min: 5,
      surface_min: 150,
    },
    transactions: [
      { id: 't8', property_title: 'Penthouse avec terrasse panoramique', stage: 'visit_planned', price: 3200000, updated_at: '2026-03-14T14:00:00Z' },
    ],
    activities: [
      { id: 'a37', action: 'visit_planned', description: 'Visite planifiée — Penthouse Quai du Mont-Blanc', date: '2026-03-14T14:00:00Z' },
      { id: 'a38', action: 'call', description: 'Appel — Discussion critères haut de gamme', date: '2026-03-05T10:00:00Z' },
      { id: 'a39', action: 'contact_created', description: 'Contact créé — Recommandation CS Private Banking', date: '2026-02-20T10:00:00Z' },
    ],
  },
  {
    id: 'c13',
    first_name: 'Françoise',
    last_name: 'Delamuraz',
    email: 'f.delamuraz@vtx.ch',
    phone: '+41 22 345 67 89',
    type: 'seller',
    score: 'cold',
    source: 'Site web',
    tags: ['Retraite'],
    notes: 'Envisage de vendre pour partir en Valais. Pas urgente, veut d\'abord estimer.',
    address: 'Chemin de la Gradelle 28',
    city: 'Genève',
    canton: 'GE',
    created_at: '2026-01-10T15:00:00Z',
    last_activity: '2026-02-05T11:00:00Z',
    transactions: [],
    activities: [
      { id: 'a40', action: 'email', description: 'Email envoyé — Proposition d\'estimation gratuite', date: '2026-02-05T11:00:00Z' },
      { id: 'a41', action: 'contact_created', description: 'Contact créé — Demande estimation via site web', date: '2026-01-10T15:00:00Z' },
    ],
  },
  {
    id: 'c14',
    first_name: 'Andreas',
    last_name: 'Huber',
    email: 'andreas.huber@gmx.ch',
    phone: '+41 43 901 23 45',
    type: 'lead',
    score: 'cold',
    source: 'ImmoScout24',
    tags: [],
    notes: 'Demande automatique ImmoScout24. Pas de réponse au premier appel.',
    address: 'Langstrasse 88',
    city: 'Zürich',
    canton: 'ZH',
    created_at: '2026-03-05T08:00:00Z',
    last_activity: '2026-03-07T09:00:00Z',
    transactions: [],
    activities: [
      { id: 'a42', action: 'call', description: 'Tentative d\'appel — Pas de réponse', date: '2026-03-07T09:00:00Z' },
      { id: 'a43', action: 'contact_created', description: 'Lead entrant — ImmoScout24 auto', date: '2026-03-05T08:00:00Z' },
    ],
  },
  {
    id: 'c15',
    first_name: 'Catherine',
    last_name: 'Nobs',
    email: 'catherine.nobs@outlook.com',
    phone: '+41 26 456 78 90',
    type: 'buyer',
    score: 'warm',
    source: 'Site web',
    tags: ['Famille', 'École internationale'],
    notes: 'Cherche proche école internationale. Mari travaille chez Procter & Gamble.',
    address: 'Route de Villars 45',
    city: 'Fribourg',
    canton: 'FR',
    created_at: '2026-02-08T10:00:00Z',
    last_activity: '2026-03-12T16:00:00Z',
    search_criteria: {
      property_type: 'Maison',
      budget_min: 800000,
      budget_max: 1500000,
      location: 'Grand-Saconnex, Pregny-Chambésy, Vernier',
      rooms_min: 5,
      surface_min: 130,
    },
    transactions: [],
    activities: [
      { id: 'a44', action: 'visit', description: 'Visite effectuée — Maison Grand-Saconnex (pas retenu)', date: '2026-03-12T16:00:00Z' },
      { id: 'a45', action: 'email', description: 'Email envoyé — Sélection 4 maisons proches écoles', date: '2026-02-28T09:00:00Z' },
      { id: 'a46', action: 'contact_created', description: 'Contact créé via site web', date: '2026-02-08T10:00:00Z' },
    ],
  },
  {
    id: 'c16',
    first_name: 'Philippe',
    last_name: 'Grosjean',
    email: 'philippe.grosjean@nestle.com',
    phone: '+41 21 678 90 12',
    type: 'both',
    score: 'warm',
    source: 'Recommandation',
    tags: ['Nestlé', 'Vevey'],
    notes: 'Mutation Nestlé de Vevey à Genève. Vend à Vevey, achète à Genève.',
    address: 'Avenue Nestlé 55',
    city: 'Vevey',
    canton: 'VD',
    created_at: '2026-02-12T14:00:00Z',
    last_activity: '2026-03-08T10:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 700000,
      budget_max: 1100000,
      location: 'Genève rive gauche',
      rooms_min: 4,
      surface_min: 90,
    },
    transactions: [],
    activities: [
      { id: 'a47', action: 'call', description: 'Appel — Timing mutation confirmé pour juin', date: '2026-03-08T10:00:00Z' },
      { id: 'a48', action: 'email', description: 'Email envoyé — Comparatif quartiers rive gauche', date: '2026-02-25T11:00:00Z' },
      { id: 'a49', action: 'contact_created', description: 'Contact créé — Recommandation RH Nestlé', date: '2026-02-12T14:00:00Z' },
    ],
  },
  {
    id: 'c17',
    first_name: 'Amir',
    last_name: 'Khoury',
    email: 'amir.khoury@gmail.com',
    phone: '+41 79 012 34 56',
    type: 'buyer',
    score: 'hot',
    source: 'Site web',
    tags: ['Pâquis', 'Artiste'],
    notes: 'Architecte d\'intérieur, coup de cœur pour le loft aux Pâquis.',
    address: 'Rue des Alpes 18',
    city: 'Genève',
    canton: 'GE',
    created_at: '2026-02-28T11:00:00Z',
    last_activity: '2026-03-15T10:00:00Z',
    search_criteria: {
      property_type: 'Appartement',
      budget_min: 600000,
      budget_max: 1000000,
      location: 'Pâquis, Eaux-Vives, Plainpalais',
      rooms_min: 3,
      surface_min: 80,
    },
    transactions: [
      { id: 't9', property_title: 'Loft industriel aux Pâquis', stage: 'offer', price: 890000, updated_at: '2026-03-15T10:00:00Z' },
    ],
    activities: [
      { id: 'a50', action: 'offer_sent', description: 'Offre envoyée — CHF 860\'000', date: '2026-03-15T10:00:00Z' },
      { id: 'a51', action: 'visit', description: '2e visite — Loft Pâquis avec mesures', date: '2026-03-10T14:00:00Z' },
      { id: 'a52', action: 'visit', description: '1re visite — Loft Pâquis', date: '2026-03-04T11:00:00Z' },
      { id: 'a53', action: 'contact_created', description: 'Contact créé via site web', date: '2026-02-28T11:00:00Z' },
    ],
  },
  {
    id: 'c18',
    first_name: 'Brigitte',
    last_name: 'Zufferey',
    email: 'b.zufferey@valais.ch',
    phone: '+41 27 567 89 01',
    type: 'lead',
    score: 'cold',
    source: 'Salon immobilier',
    tags: ['Valais'],
    notes: 'Rencontrée au salon de Sion. Curiosité, pas de projet concret.',
    address: 'Rue de Conthey 7',
    city: 'Sion',
    canton: 'VS',
    created_at: '2026-03-08T14:00:00Z',
    last_activity: '2026-03-08T14:00:00Z',
    transactions: [],
    activities: [
      { id: 'a54', action: 'contact_created', description: 'Contact créé — Salon immobilier Sion', date: '2026-03-08T14:00:00Z' },
    ],
  },
]

export function getContactById(id: string): MockContact | undefined {
  return MOCK_CONTACTS.find((c) => c.id === id)
}

// ─── PIPELINE DEALS ──────────────────────────────────────────────────────────

export interface MockDeal {
  id: string
  contact_name: string
  contact_avatar_color: string
  property_title: string
  property_address: string
  price: number
  stage: 'lead' | 'qualified' | 'visit_planned' | 'offer' | 'negotiation' | 'signed'
  agent: string
  agent_avatar_color: string
  updated_at: string
}

// ─── DASHBOARD DATA ─────────────────────────────────────────────────────────

export interface DashboardKpi {
  label: string
  value: string
  trend: { value: string; positive: boolean }
  iconName: 'Building2' | 'TrendingUp' | 'Users' | 'CalendarDays'
  iconBg: string
}

export const DASHBOARD_KPIS: DashboardKpi[] = [
  { label: 'Biens actifs', value: '12', trend: { value: '+2 ce mois', positive: true }, iconName: 'Building2', iconBg: 'bg-accent/10 text-accent' },
  { label: 'Transactions en cours', value: '8', trend: { value: '+12% ce mois', positive: true }, iconName: 'TrendingUp', iconBg: 'bg-success/10 text-success' },
  { label: 'Contacts', value: '156', trend: { value: '+8 cette semaine', positive: true }, iconName: 'Users', iconBg: 'bg-warning/10 text-warning' },
  { label: 'Visites ce mois', value: '23', trend: { value: '-3 vs dernier mois', positive: false }, iconName: 'CalendarDays', iconBg: 'bg-danger/10 text-danger' },
]

export interface DashboardPipelineStage {
  label: string
  count: number
  color: string
}

export const DASHBOARD_PIPELINE: DashboardPipelineStage[] = [
  { label: 'Lead', count: 5, color: 'bg-primary-300' },
  { label: 'Qualifié', count: 3, color: 'bg-accent' },
  { label: 'Visite', count: 4, color: 'bg-warning' },
  { label: 'Offre', count: 2, color: 'bg-warning' },
  { label: 'Signé', count: 1, color: 'bg-success' },
]

export interface DashboardActivity {
  id: string
  iconName: 'UserPlus' | 'Eye' | 'TrendingUp' | 'FileText' | 'HandshakeIcon'
  iconColor: string
  title: string
  description: string
  time: string
}

export const DASHBOARD_ACTIVITIES: DashboardActivity[] = [
  { id: '1', iconName: 'UserPlus', iconColor: 'text-accent bg-accent/10', title: 'Nouveau contact ajouté', description: 'Marie Dubois — acheteuse, recherche 4 pièces à Champel', time: 'Il y a 25 min' },
  { id: '2', iconName: 'Eye', iconColor: 'text-warning bg-warning/10', title: 'Visite planifiée', description: 'Appartement Eaux-Vives — Jean-Marc Weber, demain 14h', time: 'Il y a 2h' },
  { id: '3', iconName: 'TrendingUp', iconColor: 'text-success bg-success/10', title: 'Offre reçue', description: "Villa Cologny — CHF 2'800'000 par Famille Rossi", time: 'Il y a 4h' },
  { id: '4', iconName: 'FileText', iconColor: 'text-primary-500 bg-primary-100', title: 'Document uploadé', description: 'Passeport de Pierre Lefèvre — dossier KYC #12', time: 'Hier, 16:30' },
  { id: '5', iconName: 'HandshakeIcon', iconColor: 'text-success bg-success/10', title: 'Deal signé', description: "Duplex Champel — CHF 1'250'000, acheteur confirmé", time: 'Hier, 11:00' },
]

export interface DashboardTask {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  iconName: 'ShieldAlert' | 'Phone' | 'CalendarDays' | 'Clock'
}

export const DASHBOARD_TASKS: DashboardTask[] = [
  { id: '1', title: 'Dossier KYC incomplet', description: 'Pierre Lefèvre — documents manquants : justificatif de domicile', priority: 'high', iconName: 'ShieldAlert' },
  { id: '2', title: 'Relance client', description: "Jean-Marc Weber n'a pas répondu depuis 5 jours — visite à replanifier", priority: 'high', iconName: 'Phone' },
  { id: '3', title: 'Visite à confirmer', description: 'Appartement Plainpalais — Sophie Muller, vendredi 14h', priority: 'medium', iconName: 'CalendarDays' },
  { id: '4', title: 'Mandat à renouveler', description: 'Villa Cologny — mandat expire dans 10 jours', priority: 'medium', iconName: 'Clock' },
]

// ─── PIPELINE DEALS ──────────────────────────────────────────────────────────

export const MOCK_DEALS: MockDeal[] = [
  {
    id: 'd1',
    contact_name: 'Laurent Berset',
    contact_avatar_color: 'bg-primary-600',
    property_title: 'Appartement Eaux-Vives',
    property_address: 'Rue du Lac 12, Genève',
    price: 720000,
    stage: 'lead',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-16T09:00:00Z',
  },
  {
    id: 'd2',
    contact_name: 'Andreas Huber',
    contact_avatar_color: 'bg-warning',
    property_title: 'Studio Plainpalais',
    property_address: 'Rue de Carouge 78, Genève',
    price: 385000,
    stage: 'lead',
    agent: 'Sophie M.',
    agent_avatar_color: 'bg-danger',
    updated_at: '2026-03-15T14:00:00Z',
  },
  {
    id: 'd3',
    contact_name: 'Brigitte Zufferey',
    contact_avatar_color: 'bg-success',
    property_title: 'Appartement Carouge',
    property_address: 'Place du Marché 8, Carouge',
    price: 650000,
    stage: 'lead',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-14T11:00:00Z',
  },
  {
    id: 'd4',
    contact_name: 'Claudine Thévenaz',
    contact_avatar_color: 'bg-primary-400',
    property_title: 'Maison de ville rénovée',
    property_address: 'Rue Ancienne 34, Carouge',
    price: 1450000,
    stage: 'qualified',
    agent: 'Sophie M.',
    agent_avatar_color: 'bg-danger',
    updated_at: '2026-03-11T09:00:00Z',
  },
  {
    id: 'd5',
    contact_name: 'Hans Zimmermann',
    contact_avatar_color: 'bg-accent',
    property_title: 'Duplex Champel',
    property_address: 'Av. de Champel 45, Genève',
    price: 1250000,
    stage: 'qualified',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-10T10:30:00Z',
  },
  {
    id: 'd6',
    contact_name: 'Marie Dupont',
    contact_avatar_color: 'bg-danger',
    property_title: 'Appartement Eaux-Vives',
    property_address: 'Rue du Lac 12, Genève',
    price: 720000,
    stage: 'visit_planned',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-14T09:00:00Z',
  },
  {
    id: 'd7',
    contact_name: 'Thomas Wenger',
    contact_avatar_color: 'bg-warning',
    property_title: 'Penthouse Quai du Mont-Blanc',
    property_address: 'Quai du Mont-Blanc 18, Genève',
    price: 3200000,
    stage: 'visit_planned',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-14T14:00:00Z',
  },
  {
    id: 'd8',
    contact_name: 'Isabelle Rochat',
    contact_avatar_color: 'bg-success',
    property_title: 'Duplex moderne Champel',
    property_address: 'Av. de Champel 45, Genève',
    price: 1250000,
    stage: 'visit_planned',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-15T17:00:00Z',
  },
  {
    id: 'd9',
    contact_name: 'Nathalie Schmid',
    contact_avatar_color: 'bg-primary-600',
    property_title: 'Villa vue lac Cologny',
    property_address: 'Chemin des Crêts 5, Cologny',
    price: 2950000,
    stage: 'offer',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-13T15:30:00Z',
  },
  {
    id: 'd10',
    contact_name: 'Amir Khoury',
    contact_avatar_color: 'bg-accent',
    property_title: 'Loft industriel Pâquis',
    property_address: 'Rue de Berne 22, Genève',
    price: 890000,
    stage: 'offer',
    agent: 'Sophie M.',
    agent_avatar_color: 'bg-danger',
    updated_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 'd11',
    contact_name: 'Sophie Favre',
    contact_avatar_color: 'bg-warning',
    property_title: 'Studio rénové Plainpalais',
    property_address: 'Rue de Carouge 78, Genève',
    price: 385000,
    stage: 'negotiation',
    agent: 'Sophie M.',
    agent_avatar_color: 'bg-danger',
    updated_at: '2026-03-14T16:45:00Z',
  },
  {
    id: 'd12',
    contact_name: 'Isabelle Rochat',
    contact_avatar_color: 'bg-success',
    property_title: 'Appartement familial Carouge',
    property_address: 'Place du Marché 8, Carouge',
    price: 650000,
    stage: 'signed',
    agent: 'Gregory L.',
    agent_avatar_color: 'bg-accent',
    updated_at: '2026-03-10T10:00:00Z',
  },
]

// ─── KYC Detail Mock Data ─────────────────────────────────────────────────────

export type KycType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycStatus = 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'
export type KycRiskLevel = 'low' | 'medium' | 'high' | 'unassessed'

export interface MockKycCase {
  id: string
  contactName: string
  type: KycType
  typeLabel: string
  status: KycStatus
  riskLevel: KycRiskLevel
  completionPct: number
  updatedAt: string
  createdAt: string
  documentsCount: number
  documentsTotal: number
  checklistItems: MockKycChecklistItem[]
  documents: MockKycDocument[]
  auditEvents: MockKycAuditEvent[]
  notes: MockKycNote[]
}

export interface MockKycChecklistItem {
  id: string
  label: string
  category: string
  isRequired: boolean
  isCompleted: boolean
  status: 'validated' | 'pending' | 'missing'
  documentName: string | null
  completedAt: string | null
  completedBy: string | null
}

export interface MockKycDocument {
  id: string
  name: string
  type: string
  sizeMb: number
  status: 'validated' | 'pending' | 'rejected'
  uploadedAt: string
  uploadedBy: string
}

export interface MockKycAuditEvent {
  id: string
  action: string
  description: string
  actor: string
  timestamp: string
  type: 'create' | 'upload' | 'checklist' | 'comment' | 'status' | 'validate'
}

export interface MockKycNote {
  id: string
  content: string
  author: string
  createdAt: string
}

const BUYER_PP_CHECKLIST: MockKycChecklistItem[] = [
  { id: 'ck1', label: 'Passeport ou carte d\'identité', category: 'Identité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'passeport_berset.pdf', completedAt: '2026-03-10T09:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck2', label: 'Attestation de domicile', category: 'Domicile', isRequired: true, isCompleted: true, status: 'validated', documentName: 'attestation_domicile.pdf', completedAt: '2026-03-11T14:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck3', label: '3 dernières fiches de salaire', category: 'Revenus', isRequired: true, isCompleted: true, status: 'validated', documentName: 'fiches_salaire_2026.pdf', completedAt: '2026-03-12T10:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck4', label: 'Dernier avis d\'imposition', category: 'Revenus', isRequired: true, isCompleted: true, status: 'validated', documentName: 'avis_imposition_2025.pdf', completedAt: '2026-03-12T10:30:00Z', completedBy: 'Gregory L.' },
  { id: 'ck5', label: 'Formulaire A — Origine des fonds', category: 'Origine des fonds', isRequired: true, isCompleted: false, status: 'pending', documentName: null, completedAt: null, completedBy: null },
  { id: 'ck6', label: 'Déclaration PEP', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
  { id: 'ck7', label: 'Vérification sanctions (SECO/UE/OFAC)', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
]

const BUYER_PM_CHECKLIST: MockKycChecklistItem[] = [
  { id: 'ck10', label: 'Extrait du Registre du Commerce', category: 'Société', isRequired: true, isCompleted: true, status: 'validated', documentName: 'extrait_rc_thevenaz.pdf', completedAt: '2026-03-08T09:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck11', label: 'Statuts de la société', category: 'Société', isRequired: true, isCompleted: true, status: 'validated', documentName: 'statuts_sarl.pdf', completedAt: '2026-03-08T10:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck12', label: 'Identité des représentants légaux', category: 'Représentants', isRequired: true, isCompleted: true, status: 'validated', documentName: 'id_representants.pdf', completedAt: '2026-03-09T11:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck13', label: 'Actionnariat et ayants droit économiques', category: 'Actionnariat', isRequired: true, isCompleted: true, status: 'validated', documentName: 'actionnariat.pdf', completedAt: '2026-03-10T14:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck14', label: 'Bilan et comptes annuels', category: 'Finances', isRequired: true, isCompleted: true, status: 'validated', documentName: 'bilan_2025.pdf', completedAt: '2026-03-10T15:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck15', label: 'Formulaire A — Origine des fonds', category: 'Origine des fonds', isRequired: true, isCompleted: true, status: 'validated', documentName: 'formulaire_a_pm.pdf', completedAt: '2026-03-11T09:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck16', label: 'Déclaration PEP des dirigeants', category: 'Conformité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'pep_dirigeants.pdf', completedAt: '2026-03-12T10:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck17', label: 'Vérification sanctions (SECO/UE/OFAC)', category: 'Conformité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'sanctions_check.pdf', completedAt: '2026-03-13T08:00:00Z', completedBy: 'Sophie M.' },
  { id: 'ck18', label: 'Procuration / pouvoir de signature', category: 'Représentants', isRequired: false, isCompleted: false, status: 'pending', documentName: null, completedAt: null, completedBy: null },
]

const SELLER_PP_VALIDATED_CHECKLIST: MockKycChecklistItem[] = [
  { id: 'ck30', label: 'Passeport ou carte d\'identité', category: 'Identité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'id_huber.pdf', completedAt: '2026-03-02T09:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck31', label: 'Attestation de domicile', category: 'Domicile', isRequired: true, isCompleted: true, status: 'validated', documentName: 'domicile_huber.pdf', completedAt: '2026-03-02T10:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck32', label: 'Titre de propriété', category: 'Propriété', isRequired: true, isCompleted: true, status: 'validated', documentName: 'titre_huber.pdf', completedAt: '2026-03-03T14:00:00Z', completedBy: 'Gregory L.' },
  { id: 'ck33', label: 'Extrait du Registre Foncier', category: 'Propriété', isRequired: true, isCompleted: true, status: 'validated', documentName: 'rf_huber.pdf', completedAt: '2026-03-04T11:00:00Z', completedBy: 'Gregory L.' },
]

const SELLER_PP_HIGH_RISK_CHECKLIST: MockKycChecklistItem[] = [
  { id: 'ck40', label: 'Passeport ou carte d\'identité', category: 'Identité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'id_muller.pdf', completedAt: '2026-03-10T09:00:00Z', completedBy: 'Sophie M.' },
  { id: 'ck41', label: 'Attestation de domicile', category: 'Domicile', isRequired: true, isCompleted: true, status: 'validated', documentName: 'domicile_muller.pdf', completedAt: '2026-03-10T10:00:00Z', completedBy: 'Sophie M.' },
  { id: 'ck42', label: 'Titre de propriété', category: 'Propriété', isRequired: true, isCompleted: true, status: 'validated', documentName: 'titre_muller.pdf', completedAt: '2026-03-11T14:00:00Z', completedBy: 'Sophie M.' },
  { id: 'ck43', label: 'Extrait du Registre Foncier', category: 'Propriété', isRequired: true, isCompleted: false, status: 'pending', documentName: null, completedAt: null, completedBy: null },
  { id: 'ck44', label: 'Justificatif d\'origine du bien', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
  { id: 'ck45', label: 'Déclaration PEP', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
  { id: 'ck46', label: 'Vérification sanctions (SECO/UE/OFAC)', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
]

export const MOCK_KYC_CASES: MockKycCase[] = [
  {
    id: '1',
    contactName: 'Laurent Berset',
    type: 'buyer_pp',
    typeLabel: 'Acheteur PP',
    status: 'in_progress',
    riskLevel: 'low',
    completionPct: 57,
    updatedAt: '2026-03-16T10:00:00Z',
    createdAt: '2026-03-09T08:00:00Z',
    documentsCount: 4,
    documentsTotal: 7,
    checklistItems: BUYER_PP_CHECKLIST,
    documents: [
      { id: 'doc1', name: 'passeport_berset.pdf', type: 'Identité', sizeMb: 1.2, status: 'validated', uploadedAt: '2026-03-10T09:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc2', name: 'attestation_domicile.pdf', type: 'Domicile', sizeMb: 0.8, status: 'validated', uploadedAt: '2026-03-11T14:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc3', name: 'fiches_salaire_2026.pdf', type: 'Revenus', sizeMb: 2.1, status: 'validated', uploadedAt: '2026-03-12T10:00:00Z', uploadedBy: 'Laurent Berset' },
      { id: 'doc4', name: 'avis_imposition_2025.pdf', type: 'Revenus', sizeMb: 1.5, status: 'validated', uploadedAt: '2026-03-12T10:30:00Z', uploadedBy: 'Laurent Berset' },
    ],
    auditEvents: [
      { id: 'ae1', action: 'Dossier créé', description: 'Dossier KYC créé pour Laurent Berset (Acheteur PP)', actor: 'Gregory L.', timestamp: '2026-03-09T08:00:00Z', type: 'create' },
      { id: 'ae2', action: 'Document uploadé', description: 'passeport_berset.pdf ajouté au dossier', actor: 'Gregory L.', timestamp: '2026-03-10T09:00:00Z', type: 'upload' },
      { id: 'ae3', action: 'Item validé', description: 'Passeport ou carte d\'identité marqué comme validé', actor: 'Gregory L.', timestamp: '2026-03-10T09:05:00Z', type: 'checklist' },
      { id: 'ae4', action: 'Document uploadé', description: 'attestation_domicile.pdf ajouté au dossier', actor: 'Gregory L.', timestamp: '2026-03-11T14:00:00Z', type: 'upload' },
      { id: 'ae5', action: 'Item validé', description: 'Attestation de domicile marquée comme validée', actor: 'Gregory L.', timestamp: '2026-03-11T14:05:00Z', type: 'checklist' },
      { id: 'ae6', action: 'Document uploadé', description: 'fiches_salaire_2026.pdf ajouté par le client', actor: 'Laurent Berset', timestamp: '2026-03-12T10:00:00Z', type: 'upload' },
      { id: 'ae7', action: 'Document uploadé', description: 'avis_imposition_2025.pdf ajouté par le client', actor: 'Laurent Berset', timestamp: '2026-03-12T10:30:00Z', type: 'upload' },
      { id: 'ae8', action: 'Items validés', description: 'Fiches de salaire et avis d\'imposition validés', actor: 'Gregory L.', timestamp: '2026-03-12T11:00:00Z', type: 'checklist' },
      { id: 'ae9', action: 'Commentaire ajouté', description: 'En attente du Formulaire A — relance envoyée par e-mail', actor: 'Gregory L.', timestamp: '2026-03-14T16:00:00Z', type: 'comment' },
      { id: 'ae10', action: 'Statut changé', description: 'Statut passé de "En attente" à "En cours"', actor: 'Système', timestamp: '2026-03-10T09:05:00Z', type: 'status' },
    ],
    notes: [
      { id: 'n1', content: 'Client très réactif, documents fournis rapidement. En attente du Formulaire A — relance envoyée le 14.03.', author: 'Gregory L.', createdAt: '2026-03-14T16:00:00Z' },
      { id: 'n2', content: 'PEP check et sanctions à effectuer une fois le Formulaire A reçu.', author: 'Gregory L.', createdAt: '2026-03-12T11:30:00Z' },
    ],
  },
  {
    id: '2',
    contactName: 'Claudine Thévenaz',
    type: 'buyer_pm',
    typeLabel: 'Acheteur PM',
    status: 'review',
    riskLevel: 'medium',
    completionPct: 89,
    updatedAt: '2026-03-15T14:00:00Z',
    createdAt: '2026-03-07T10:00:00Z',
    documentsCount: 8,
    documentsTotal: 9,
    checklistItems: BUYER_PM_CHECKLIST,
    documents: [
      { id: 'doc10', name: 'extrait_rc_thevenaz.pdf', type: 'Société', sizeMb: 0.5, status: 'validated', uploadedAt: '2026-03-08T09:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc11', name: 'statuts_sarl.pdf', type: 'Société', sizeMb: 3.2, status: 'validated', uploadedAt: '2026-03-08T10:00:00Z', uploadedBy: 'Claudine Thévenaz' },
      { id: 'doc12', name: 'id_representants.pdf', type: 'Représentants', sizeMb: 1.8, status: 'validated', uploadedAt: '2026-03-09T11:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc13', name: 'actionnariat.pdf', type: 'Actionnariat', sizeMb: 0.9, status: 'validated', uploadedAt: '2026-03-10T14:00:00Z', uploadedBy: 'Claudine Thévenaz' },
      { id: 'doc14', name: 'bilan_2025.pdf', type: 'Finances', sizeMb: 4.5, status: 'validated', uploadedAt: '2026-03-10T15:00:00Z', uploadedBy: 'Claudine Thévenaz' },
      { id: 'doc15', name: 'formulaire_a_pm.pdf', type: 'Origine des fonds', sizeMb: 1.1, status: 'validated', uploadedAt: '2026-03-11T09:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc16', name: 'pep_dirigeants.pdf', type: 'Conformité', sizeMb: 0.6, status: 'validated', uploadedAt: '2026-03-12T10:00:00Z', uploadedBy: 'Sophie M.' },
      { id: 'doc17', name: 'sanctions_check.pdf', type: 'Conformité', sizeMb: 0.4, status: 'validated', uploadedAt: '2026-03-13T08:00:00Z', uploadedBy: 'Sophie M.' },
    ],
    auditEvents: [
      { id: 'ae20', action: 'Dossier créé', description: 'Dossier KYC créé pour Thévenaz Sàrl (Acheteur PM)', actor: 'Gregory L.', timestamp: '2026-03-07T10:00:00Z', type: 'create' },
      { id: 'ae21', action: 'Document uploadé', description: 'extrait_rc_thevenaz.pdf ajouté', actor: 'Gregory L.', timestamp: '2026-03-08T09:00:00Z', type: 'upload' },
      { id: 'ae22', action: 'Document uploadé', description: 'statuts_sarl.pdf ajouté par le client', actor: 'Claudine Thévenaz', timestamp: '2026-03-08T10:00:00Z', type: 'upload' },
      { id: 'ae23', action: 'Items validés', description: 'Extrait RC et Statuts marqués validés', actor: 'Gregory L.', timestamp: '2026-03-08T11:00:00Z', type: 'checklist' },
      { id: 'ae24', action: 'Statut changé', description: 'Statut passé à "En cours"', actor: 'Système', timestamp: '2026-03-08T11:00:00Z', type: 'status' },
      { id: 'ae25', action: 'Documents uploadés', description: '6 documents supplémentaires ajoutés', actor: 'Plusieurs', timestamp: '2026-03-13T08:00:00Z', type: 'upload' },
      { id: 'ae26', action: 'Commentaire ajouté', description: 'Procuration optionnelle en attente — pas bloquant pour la validation', actor: 'Gregory L.', timestamp: '2026-03-14T09:00:00Z', type: 'comment' },
      { id: 'ae27', action: 'Statut changé', description: 'Statut passé à "En revue"', actor: 'Gregory L.', timestamp: '2026-03-15T14:00:00Z', type: 'status' },
    ],
    notes: [
      { id: 'n10', content: 'Dossier quasi complet. Procuration optionnelle en attente mais ne bloque pas la validation. Risque moyen dû à la structure actionnariale complexe.', author: 'Gregory L.', createdAt: '2026-03-15T14:00:00Z' },
    ],
  },
  {
    id: '3',
    contactName: 'Pierre Lefèvre',
    type: 'buyer_pp',
    typeLabel: 'Acheteur PP',
    status: 'pending',
    riskLevel: 'unassessed',
    completionPct: 20,
    updatedAt: '2026-03-14T09:00:00Z',
    createdAt: '2026-03-13T15:00:00Z',
    documentsCount: 1,
    documentsTotal: 7,
    checklistItems: [
      { id: 'ck50', label: 'Passeport ou carte d\'identité', category: 'Identité', isRequired: true, isCompleted: true, status: 'validated', documentName: 'id_lefevre.pdf', completedAt: '2026-03-14T09:00:00Z', completedBy: 'Gregory L.' },
      { id: 'ck51', label: 'Attestation de domicile', category: 'Domicile', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
      { id: 'ck52', label: '3 dernières fiches de salaire', category: 'Revenus', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
      { id: 'ck53', label: 'Dernier avis d\'imposition', category: 'Revenus', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
      { id: 'ck54', label: 'Formulaire A — Origine des fonds', category: 'Origine des fonds', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
      { id: 'ck55', label: 'Déclaration PEP', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
      { id: 'ck56', label: 'Vérification sanctions (SECO/UE/OFAC)', category: 'Conformité', isRequired: true, isCompleted: false, status: 'missing', documentName: null, completedAt: null, completedBy: null },
    ],
    documents: [
      { id: 'doc30', name: 'id_lefevre.pdf', type: 'Identité', sizeMb: 1.0, status: 'validated', uploadedAt: '2026-03-14T09:00:00Z', uploadedBy: 'Pierre Lefèvre' },
    ],
    auditEvents: [
      { id: 'ae30', action: 'Dossier créé', description: 'Dossier KYC créé pour Pierre Lefèvre (Acheteur PP)', actor: 'Gregory L.', timestamp: '2026-03-13T15:00:00Z', type: 'create' },
      { id: 'ae31', action: 'Document uploadé', description: 'id_lefevre.pdf ajouté par le client', actor: 'Pierre Lefèvre', timestamp: '2026-03-14T09:00:00Z', type: 'upload' },
      { id: 'ae32', action: 'Item validé', description: 'Pièce d\'identité validée', actor: 'Gregory L.', timestamp: '2026-03-14T09:10:00Z', type: 'checklist' },
    ],
    notes: [],
  },
  {
    id: '4',
    contactName: 'Andreas Huber',
    type: 'seller_pp',
    typeLabel: 'Vendeur PP',
    status: 'validated',
    riskLevel: 'low',
    completionPct: 100,
    updatedAt: '2026-03-10T16:00:00Z',
    createdAt: '2026-03-01T09:00:00Z',
    documentsCount: 4,
    documentsTotal: 4,
    checklistItems: SELLER_PP_VALIDATED_CHECKLIST,
    documents: [
      { id: 'doc40', name: 'id_huber.pdf', type: 'Identité', sizeMb: 1.3, status: 'validated', uploadedAt: '2026-03-02T09:00:00Z', uploadedBy: 'Andreas Huber' },
      { id: 'doc41', name: 'domicile_huber.pdf', type: 'Domicile', sizeMb: 0.7, status: 'validated', uploadedAt: '2026-03-02T10:00:00Z', uploadedBy: 'Andreas Huber' },
      { id: 'doc42', name: 'titre_huber.pdf', type: 'Propriété', sizeMb: 2.4, status: 'validated', uploadedAt: '2026-03-03T14:00:00Z', uploadedBy: 'Gregory L.' },
      { id: 'doc43', name: 'rf_huber.pdf', type: 'Propriété', sizeMb: 1.1, status: 'validated', uploadedAt: '2026-03-04T11:00:00Z', uploadedBy: 'Gregory L.' },
    ],
    auditEvents: [
      { id: 'ae40', action: 'Dossier créé', description: 'Dossier KYC créé pour Andreas Huber (Vendeur PP)', actor: 'Gregory L.', timestamp: '2026-03-01T09:00:00Z', type: 'create' },
      { id: 'ae41', action: 'Documents uploadés', description: '4 documents ajoutés au dossier', actor: 'Plusieurs', timestamp: '2026-03-04T11:00:00Z', type: 'upload' },
      { id: 'ae42', action: 'Checklist complétée', description: 'Tous les items obligatoires validés', actor: 'Gregory L.', timestamp: '2026-03-05T10:00:00Z', type: 'checklist' },
      { id: 'ae43', action: 'Statut changé', description: 'Statut passé à "En revue"', actor: 'Gregory L.', timestamp: '2026-03-08T09:00:00Z', type: 'status' },
      { id: 'ae44', action: 'Dossier validé', description: 'Dossier KYC validé par Gregory L.', actor: 'Gregory L.', timestamp: '2026-03-10T16:00:00Z', type: 'validate' },
    ],
    notes: [
      { id: 'n20', content: 'Dossier complet et conforme. Client coopératif, aucun risque identifié.', author: 'Gregory L.', createdAt: '2026-03-10T16:00:00Z' },
    ],
  },
  {
    id: '5',
    contactName: 'Sophie Müller',
    type: 'seller_pp',
    typeLabel: 'Vendeur PP',
    status: 'in_progress',
    riskLevel: 'high',
    completionPct: 43,
    updatedAt: '2026-03-13T11:00:00Z',
    createdAt: '2026-03-08T14:00:00Z',
    documentsCount: 3,
    documentsTotal: 7,
    checklistItems: SELLER_PP_HIGH_RISK_CHECKLIST,
    documents: [
      { id: 'doc50', name: 'id_muller.pdf', type: 'Identité', sizeMb: 1.1, status: 'validated', uploadedAt: '2026-03-10T09:00:00Z', uploadedBy: 'Sophie Müller' },
      { id: 'doc51', name: 'domicile_muller.pdf', type: 'Domicile', sizeMb: 0.6, status: 'validated', uploadedAt: '2026-03-10T10:00:00Z', uploadedBy: 'Sophie Müller' },
      { id: 'doc52', name: 'titre_muller.pdf', type: 'Propriété', sizeMb: 2.8, status: 'pending', uploadedAt: '2026-03-11T14:00:00Z', uploadedBy: 'Sophie M.' },
    ],
    auditEvents: [
      { id: 'ae50', action: 'Dossier créé', description: 'Dossier KYC créé pour Sophie Müller (Vendeur PP)', actor: 'Sophie M.', timestamp: '2026-03-08T14:00:00Z', type: 'create' },
      { id: 'ae51', action: 'Commentaire ajouté', description: 'Risque élevé — bien acquis récemment, origine à vérifier', actor: 'Sophie M.', timestamp: '2026-03-08T14:30:00Z', type: 'comment' },
      { id: 'ae52', action: 'Statut changé', description: 'Niveau de risque passé à "Élevé"', actor: 'Sophie M.', timestamp: '2026-03-08T14:35:00Z', type: 'status' },
      { id: 'ae53', action: 'Documents uploadés', description: '3 documents ajoutés', actor: 'Plusieurs', timestamp: '2026-03-11T14:00:00Z', type: 'upload' },
      { id: 'ae54', action: 'Items validés', description: 'Identité et domicile validés', actor: 'Sophie M.', timestamp: '2026-03-11T15:00:00Z', type: 'checklist' },
      { id: 'ae55', action: 'Commentaire ajouté', description: 'Titre de propriété en attente de validation — vérification en cours', actor: 'Sophie M.', timestamp: '2026-03-13T11:00:00Z', type: 'comment' },
    ],
    notes: [
      { id: 'n30', content: 'Risque élevé : bien acquis il y a moins de 2 ans, revente rapide suspecte. Vérification approfondie de l\'origine du bien nécessaire.', author: 'Sophie M.', createdAt: '2026-03-08T14:30:00Z' },
      { id: 'n31', content: 'Titre de propriété reçu — en attente de validation par le service compliance.', author: 'Sophie M.', createdAt: '2026-03-13T11:00:00Z' },
    ],
  },
]

export function getKycCaseById(id: string): MockKycCase | undefined {
  return MOCK_KYC_CASES.find((c) => c.id === id)
}
