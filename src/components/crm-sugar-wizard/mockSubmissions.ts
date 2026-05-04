// MEGGA CRM Sugar v2 Wizard — Mock submissions for the Step 0 "Reprendre" flow.
// Approximation of CRM_SUBMISSIONS used by the prototype — the prototype refers to
// `window.CRM_SUBMISSIONS` which isn't in the public bundle, so we ship a plausible
// dataset that exercises both code paths (linked contact + draft contact).

export interface CrmSubmission {
  id: string
  title: string
  contactId?: string
  contactDraft?: { firstName: string; lastName: string; email: string; phone: string; lang?: string }
  type: 'appartement' | 'maison' | 'villa' | 'terrain'
  transaction: 'vente' | 'location'
  addr: string
  canton: string
  area: number
  rooms: number
  beds: number
  baths: number
  year: number
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  features: string[]
  desc: string
  askingPrice: number
  accent: string
  receivedAt: string
}

export const CRM_SUBMISSIONS: CrmSubmission[] = [
  {
    id: 'sub-001',
    title: 'Maison succession · Carouge',
    contactId: 'c-006',
    type: 'maison', transaction: 'vente',
    addr: 'Chemin du Velours 12, Carouge', canton: 'Genève',
    area: 165, rooms: 6, beds: 4, baths: 2, year: 1958, energy: 'D',
    features: ['jardin', 'cave', 'cheminée'],
    desc: "Maison de famille héritée d'une succession. Bel emplacement à proximité du centre de Carouge. Travaux de rafraîchissement à prévoir.",
    askingPrice: 1750000,
    accent: '#E53935',
    receivedAt: '2026-04-26T10:00:00',
  },
  {
    id: 'sub-002',
    title: '4 pièces lumineux Plainpalais',
    contactDraft: {
      firstName: 'Lucien', lastName: 'Berthod',
      email: 'lucien.berthod@gmail.com', phone: '+41 76 414 88 22', lang: 'fr',
    },
    type: 'appartement', transaction: 'vente',
    addr: 'Rue de Carouge 45, Genève', canton: 'Genève',
    area: 92, rooms: 4, beds: 2, baths: 1, year: 1996, energy: 'C',
    features: ['balcon', 'ascenseur', 'cave'],
    desc: 'Appartement traversant 4 pièces, bien tenu, proche commerces et Plaine de Plainpalais. Idéal pour famille.',
    askingPrice: 1095000,
    accent: '#0041D9',
    receivedAt: '2026-04-29T14:30:00',
  },
  {
    id: 'sub-003',
    title: 'Villa Vésenaz vue lac',
    contactDraft: {
      firstName: 'Anouchka', lastName: 'Wirth',
      email: 'a.wirth@bluewin.ch', phone: '+41 79 605 22 14', lang: 'fr',
    },
    type: 'villa', transaction: 'vente',
    addr: 'Chemin des Hauts-Bois 3, Vésenaz', canton: 'Genève',
    area: 220, rooms: 7, beds: 4, baths: 3, year: 2010, energy: 'B',
    features: ['jardin', 'piscine', 'garage', 'vue', 'cheminée'],
    desc: 'Villa moderne avec vue dégagée sur le lac, jardin paysagé et piscine chauffée. Garage 2 voitures, finitions premium.',
    askingPrice: 4250000,
    accent: '#10B981',
    receivedAt: '2026-04-30T09:15:00',
  },
]
