// ─── PLACEHOLDER DATA ─────────────────────────────────────────────────────
// Remplace les données visuelles (photos, adresses, descriptions, agences, titres)
// par des placeholders pour le mode démo.
// Les données numériques (prix, pièces, surface, coords, canton, ville) restent réelles.
//
// Pour restaurer les vraies données :
//   → Retirer les appels à applyPlaceholders() dans useMarketListings.ts et ListingPage.tsx

// ─── PHOTOS (Unsplash libre de droits — immobilier varié) ────────────────

export const PLACEHOLDER_PHOTOS: string[] = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600573472591-ee6981cf81f0?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1598228723793-52759bba239c?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1600585153490-76fb20a32601?w=800&h=600&fit=crop',
]

// ─── ADRESSES SUISSES FICTIVES ──────────────────────────────────────────

export const PLACEHOLDER_ADDRESSES: string[] = [
  'Rue de la Fontaine 12',
  'Chemin des Vignes 8',
  'Avenue du Léman 45',
  'Route de Lausanne 23',
  'Rue du Rhône 78',
  'Chemin des Crêts 5',
  'Avenue de la Gare 31',
  'Rue des Alpes 17',
  'Boulevard Helvétique 56',
  'Chemin du Vallon 9',
  'Rue de la Paix 42',
  'Avenue des Bains 63',
  'Route du Signal 14',
  'Chemin de Bellevue 27',
  'Rue du Marché 3',
  'Avenue de Champel 88',
  'Route de Chêne 51',
  'Chemin des Tulipiers 19',
  'Rue du Stand 36',
  'Avenue de Frontenex 7',
  'Chemin des Colombettes 22',
  'Rue de Carouge 95',
  'Boulevard Carl-Vogt 44',
  'Chemin de la Montagne 11',
  'Avenue de Miremont 68',
  'Rue des Pâquis 29',
  'Route de Florissant 53',
  'Chemin du Petit-Saconnex 16',
  'Rue de Rive 61',
  'Avenue de la Praille 34',
]

// ─── DESCRIPTIONS IMMOBILIÈRES GÉNÉRIQUES ────────────────────────────────

export const PLACEHOLDER_DESCRIPTIONS: string[] = [
  "Bel appartement traversant au 3ème étage d'un immeuble bien entretenu. Séjour lumineux avec vue dégagée, cuisine équipée, chambres spacieuses, salle de bains rénovée. Cave et place de parc en sous-sol.",
  "Magnifique villa familiale avec jardin arboré et piscine. Espace de vie généreux, finitions de qualité, cuisine ouverte sur le séjour. Garage double et buanderie. Quartier résidentiel calme.",
  "Studio idéal pour investissement ou première acquisition. Bien agencé avec coin nuit séparé, kitchenette équipée et salle d'eau moderne. Proche transports et commerces.",
  "Superbe duplex en attique avec terrasse panoramique. Double hauteur sous plafond dans le séjour, suite parentale avec dressing, deux chambres supplémentaires. Prestations haut de gamme.",
  "Appartement familial rénové avec goût dans un quartier prisé. Parquet chêne, cuisine contemporaine, trois chambres à coucher, deux salles de bains. Balcon couvert avec vue sur le lac.",
  "Charmante maison de village entièrement rénovée. Poutres apparentes, sol en pierre naturelle, cheminée. Jardin privatif et terrasse ensoleillée. Cadre bucolique à proximité des commodités.",
  "Loft contemporain dans un ancien bâtiment industriel reconverti. Grands volumes, lumière naturelle exceptionnelle, finitions brutes et élégantes. Place de parc intérieure.",
  "Propriété d'exception avec vue imprenable sur les Alpes. Architecture contemporaine, matériaux nobles, domotique intégrée. Terrain paysager avec espace wellness privatif.",
  "Appartement de standing au cœur de la ville. Hauts plafonds, moulures d'époque, parquet point de Hongrie. Réception spacieuse, chambres en enfilade, cave voûtée.",
  "Joli 3 pièces au dernier étage avec ascenseur. Lumineux et calme, vue dégagée sur les toits. Cuisine semi-ouverte, chambre avec placard intégré. Disponible de suite.",
  "Belle propriété avec vue panoramique sur le vignoble. Pièces de réception généreuses, suite parentale, bureau. Terrasse couverte, pool house et jardin paysager.",
  "Appartement neuf dans résidence de standing. Minergie, triple vitrage, chauffage au sol. Finitions personnalisables. Deux places de parc en sous-sol et local vélo.",
  "Maison mitoyenne récente dans un quartier familial. Salon cathédrale, cuisine ouverte, quatre chambres, bureau. Jardin clôturé, terrasse BBQ et carport double.",
  "Penthouse exclusif avec terrasse de 80 m². Vue à 360° sur la ville et les montagnes. Finitions luxueuses, hammam privatif, deux places de parc.",
  "Chalet authentique rénové avec matériaux d'exception. Ambiance chaleureuse, poêle suédois, jacuzzi extérieur. Accès ski aux pieds en hiver, randonnée en été.",
]

// ─── AGENCES FICTIVES ────────────────────────────────────────────────────

export const PLACEHOLDER_AGENCIES: string[] = [
  'Immobilier Léman SA',
  'Swiss Alps Properties',
  'Helvetia Immobilier',
  'Lac & Montagne Courtage',
  'Prestige Realty Suisse',
  'Alpine Estate Partners',
  'Riviera Immobilier',
  'Prime Swiss Properties',
  'Horizon Immobilier',
  'Capital Immo Group',
]

// ─── TITRES DE BIENS GÉNÉRIQUES ──────────────────────────────────────────

const TITLES_APARTMENT: string[] = [
  'Appartement lumineux avec vue',
  'Bel appartement rénové',
  'Grand appartement familial',
  'Appartement de charme',
  'Appartement traversant au calme',
  'Spacieux appartement avec balcon',
  'Appartement moderne et fonctionnel',
  'Appartement avec terrasse',
]

const TITLES_HOUSE: string[] = [
  'Villa familiale avec jardin',
  'Maison de caractère rénovée',
  'Belle maison avec vue',
  'Maison contemporaine',
  'Villa avec piscine',
  'Maison individuelle au calme',
]

const TITLES_OTHER: string[] = [
  'Bien immobilier de qualité',
  'Propriété de standing',
  'Opportunité rare',
  'Bien d\'exception',
  'Emplacement privilégié',
]

function getPlaceholderTitle(type: string, index: number): string {
  if (type === 'apartment' || type === 'flat') {
    return TITLES_APARTMENT[index % TITLES_APARTMENT.length]
  }
  if (type === 'house' || type === 'villa') {
    return TITLES_HOUSE[index % TITLES_HOUSE.length]
  }
  return TITLES_OTHER[index % TITLES_OTHER.length]
}

// ─── APPLY PLACEHOLDERS ──────────────────────────────────────────────────
// Remplace les champs visuels en utilisant l'index pour la rotation
// deterministe (même index = mêmes placeholders à chaque render)

interface PlaceholderTarget {
  title?: string
  address?: string
  description?: string
  agency_name?: string
  photos?: string[]
  type?: string
  agent?: {
    name: string
    agency: string
    phone: string
    email: string
    photo: string
  }
}

export function applyPlaceholders<T extends PlaceholderTarget>(listing: T, index: number): T {
  // Photos : 3-5 photos par bien, en rotation
  const photoStart = (index * 3) % PLACEHOLDER_PHOTOS.length
  const photoCount = 3 + (index % 3) // 3, 4 ou 5 photos
  const photos: string[] = []
  for (let i = 0; i < photoCount; i++) {
    photos.push(PLACEHOLDER_PHOTOS[(photoStart + i) % PLACEHOLDER_PHOTOS.length])
  }

  const result = {
    ...listing,
    title: getPlaceholderTitle(listing.type || 'apartment', index),
    address: PLACEHOLDER_ADDRESSES[index % PLACEHOLDER_ADDRESSES.length],
    description: PLACEHOLDER_DESCRIPTIONS[index % PLACEHOLDER_DESCRIPTIONS.length],
    agency_name: PLACEHOLDER_AGENCIES[index % PLACEHOLDER_AGENCIES.length],
    photos,
  }

  // Si le listing a un agent, remplacer aussi
  if (result.agent) {
    result.agent = {
      ...result.agent,
      name: PLACEHOLDER_AGENCIES[index % PLACEHOLDER_AGENCIES.length],
      agency: PLACEHOLDER_AGENCIES[index % PLACEHOLDER_AGENCIES.length],
    }
  }

  return result
}
