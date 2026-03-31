// Mock data for the Seller Portal (Portail Vendeur)
// This simulates a seller's view of their property sale

export interface SellerProperty {
  id: string
  title: string
  address: string
  city: string
  canton: string
  postal_code: string
  price: number
  rooms: number
  surface_m2: number
  type: string
  photo: string
  status: 'active' | 'reserved' | 'sold'
  mandate_type: 'exclusive' | 'simple'
  mandate_signed_at: string
  published_at: string
}

export interface SellerVisit {
  id: string
  date: string
  status: 'planned' | 'confirmed' | 'done' | 'cancelled' | 'no_show'
  feedback: string | null
  rating: number | null // 1-5
}

export interface SellerOffer {
  id: string
  amount: number
  status: 'pending' | 'accepted' | 'rejected' | 'counter_offer' | 'expired'
  received_at: string
  conditions: string | null
}

export interface SellerActivity {
  id: string
  type: 'visit_planned' | 'visit_done' | 'offer_received' | 'document_added' | 'price_update' | 'publication' | 'mandate_signed' | 'message'
  description: string
  date: string
}

export type MandateStep =
  | 'mandate_signed'
  | 'published'
  | 'visits'
  | 'offers'
  | 'negotiation'
  | 'notary'
  | 'sold'

export interface SellerKPIs {
  visits_total: number
  visits_this_month: number
  offers_total: number
  online_views: number
  days_on_market: number
  current_step: MandateStep
}

export interface SellerPortalData {
  property: SellerProperty
  kpis: SellerKPIs
  visits: SellerVisit[]
  offers: SellerOffer[]
  activities: SellerActivity[]
  agent: {
    name: string
    phone: string
    email: string
    photo: string | null
  }
  estimation?: {
    min: number | null
    max: number | null
    median: number | null
    confidence: string | null
    comparable_count: number | null
  }
}

// ── Mock data ────────────────────────────────────────────────────────────

export const MOCK_SELLER_DATA: SellerPortalData = {
  property: {
    id: 'prop-seller-1',
    title: 'Appartement 5 pièces avec vue lac',
    address: 'Quai du Mont-Blanc 14',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1201',
    price: 1850000,
    rooms: 5,
    surface_m2: 145,
    type: 'apartment',
    photo: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop',
    status: 'active',
    mandate_type: 'exclusive',
    mandate_signed_at: '2026-02-10T10:00:00Z',
    published_at: '2026-02-14T09:00:00Z',
  },

  kpis: {
    visits_total: 8,
    visits_this_month: 3,
    offers_total: 2,
    online_views: 347,
    days_on_market: 36,
    current_step: 'offers',
  },

  visits: [
    {
      id: 'v1',
      date: '2026-03-25T14:00:00Z',
      status: 'confirmed',
      feedback: null,
      rating: null,
    },
    {
      id: 'v2',
      date: '2026-03-20T10:30:00Z',
      status: 'done',
      feedback: 'Très intéressé par la luminosité et la vue. Souhaite revenir avec son partenaire.',
      rating: 5,
    },
    {
      id: 'v3',
      date: '2026-03-18T15:00:00Z',
      status: 'done',
      feedback: 'Bien apprécié dans l\'ensemble. Quelques réserves sur le bruit de la rue.',
      rating: 3,
    },
    {
      id: 'v4',
      date: '2026-03-14T11:00:00Z',
      status: 'done',
      feedback: 'A trouvé l\'appartement magnifique. En réflexion pour une offre.',
      rating: 4,
    },
    {
      id: 'v5',
      date: '2026-03-10T09:00:00Z',
      status: 'done',
      feedback: 'Budget insuffisant, ne donnera pas suite.',
      rating: 2,
    },
    {
      id: 'v6',
      date: '2026-03-07T16:00:00Z',
      status: 'cancelled',
      feedback: null,
      rating: null,
    },
    {
      id: 'v7',
      date: '2026-03-03T14:00:00Z',
      status: 'done',
      feedback: 'Coup de cœur. Souhaite faire une offre rapidement.',
      rating: 5,
    },
    {
      id: 'v8',
      date: '2026-02-25T10:00:00Z',
      status: 'done',
      feedback: 'Visite de découverte. Le quartier plaît beaucoup.',
      rating: 4,
    },
  ],

  offers: [
    {
      id: 'o1',
      amount: 1780000,
      status: 'pending',
      received_at: '2026-03-19T14:00:00Z',
      conditions: 'Sous réserve de financement bancaire. Délai de réponse souhaité : 10 jours.',
    },
    {
      id: 'o2',
      amount: 1700000,
      status: 'rejected',
      received_at: '2026-03-05T10:00:00Z',
      conditions: null,
    },
    {
      id: 'o3',
      amount: 1820000,
      status: 'counter_offer',
      received_at: '2026-03-21T09:00:00Z',
      conditions: 'Contre-proposition à CHF 1\'810\'000 envoyée. En attente de réponse de l\'acquéreur.',
    },
  ],

  activities: [
    {
      id: 'a1',
      type: 'visit_planned',
      description: 'Nouvelle visite programmée pour le 25 mars à 14h00',
      date: '2026-03-22T09:00:00Z',
    },
    {
      id: 'a2',
      type: 'offer_received',
      description: 'Offre reçue à CHF 1\'780\'000 (sous réserve de financement)',
      date: '2026-03-19T14:00:00Z',
    },
    {
      id: 'a3',
      type: 'visit_done',
      description: 'Visite effectuée — retour très positif, intérêt confirmé',
      date: '2026-03-18T15:30:00Z',
    },
    {
      id: 'a4',
      type: 'visit_done',
      description: 'Visite effectuée — acquéreur potentiel en réflexion',
      date: '2026-03-14T12:00:00Z',
    },
    {
      id: 'a5',
      type: 'offer_received',
      description: 'Offre reçue à CHF 1\'700\'000 — refusée (trop basse)',
      date: '2026-03-05T10:00:00Z',
    },
    {
      id: 'a6',
      type: 'publication',
      description: 'Votre bien a été publié sur 4 portails immobiliers',
      date: '2026-02-14T09:00:00Z',
    },
    {
      id: 'a7',
      type: 'mandate_signed',
      description: 'Mandat exclusif signé — bienvenue chez MEGGA',
      date: '2026-02-10T10:00:00Z',
    },
  ],

  agent: {
    name: 'Gregory Lyonnet',
    phone: '+41 22 310 00 00',
    email: 'gregory@megga.ch',
    photo: null,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────

export const MANDATE_STEPS: { key: MandateStep; label: string }[] = [
  { key: 'mandate_signed', label: 'Mandat signé' },
  { key: 'published', label: 'Publié' },
  { key: 'visits', label: 'Visites' },
  { key: 'offers', label: 'Offres' },
  { key: 'negotiation', label: 'Négociation' },
  { key: 'notary', label: 'Notaire' },
  { key: 'sold', label: 'Vendu' },
]

export function getStepIndex(step: MandateStep): number {
  return MANDATE_STEPS.findIndex(s => s.key === step)
}

// ── Messages mock data ───────────────────────────────────────────────────

export interface SellerMessage {
  id: string
  sender: 'agent' | 'seller'
  sender_name: string
  content: string
  created_at: string
  read: boolean
}

export const MOCK_SELLER_MESSAGES: SellerMessage[] = [
  {
    id: 'msg-1',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Bonjour ! Je vous confirme que votre bien a été publié sur Homegate, ImmoScout24, Comparis et Anibis. Les premières demandes de visites ne devraient pas tarder.',
    created_at: '2026-02-14T10:30:00Z',
    read: true,
  },
  {
    id: 'msg-2',
    sender: 'seller',
    sender_name: 'Vous',
    content: 'Merci Gregory ! Les photos sont superbes. Est-ce qu\'il y a déjà des retours ?',
    created_at: '2026-02-14T14:15:00Z',
    read: true,
  },
  {
    id: 'msg-3',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Oui, déjà 3 demandes de visites reçues ce matin ! Je vous tiens au courant. La première est planifiée pour lundi prochain.',
    created_at: '2026-02-14T15:00:00Z',
    read: true,
  },
  {
    id: 'msg-4',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Suite à la visite de ce matin, le retour est très positif. L\'acquéreur a trouvé l\'appartement lumineux et bien agencé. Il souhaite revenir avec sa femme.',
    created_at: '2026-03-03T16:00:00Z',
    read: true,
  },
  {
    id: 'msg-5',
    sender: 'seller',
    sender_name: 'Vous',
    content: 'Excellent ! Et pour la visite de demain, tout est confirmé ?',
    created_at: '2026-03-03T17:30:00Z',
    read: true,
  },
  {
    id: 'msg-6',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Oui c\'est confirmé pour demain 10h30. Pensez à laisser les volets ouverts pour la luminosité, c\'est un atout majeur de votre bien.',
    created_at: '2026-03-03T17:45:00Z',
    read: true,
  },
  {
    id: 'msg-7',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Bonne nouvelle ! Nous avons reçu une première offre à CHF 1\'700\'000. C\'est en dessous du prix demandé, je recommande de décliner et d\'attendre. Le bien génère beaucoup d\'intérêt.',
    created_at: '2026-03-05T10:30:00Z',
    read: true,
  },
  {
    id: 'msg-8',
    sender: 'seller',
    sender_name: 'Vous',
    content: 'D\'accord, CHF 1\'700\'000 c\'est trop bas. On attend de meilleures offres.',
    created_at: '2026-03-05T11:00:00Z',
    read: true,
  },
  {
    id: 'msg-9',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Parfait, c\'est ce que je recommandais aussi. Je vais décliner poliment et maintenir la pression avec les autres acquéreurs intéressés.',
    created_at: '2026-03-05T11:15:00Z',
    read: true,
  },
  {
    id: 'msg-10',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Nouvelle offre reçue à CHF 1\'780\'000 ! Cette fois c\'est bien plus sérieux. L\'acquéreur est pré-approuvé pour le financement. Sous réserve d\'obtention du prêt. Je vous recommande de considérer cette offre — on est à 96% du prix demandé.',
    created_at: '2026-03-19T14:30:00Z',
    read: true,
  },
  {
    id: 'msg-11',
    sender: 'seller',
    sender_name: 'Vous',
    content: 'Intéressant. Est-ce qu\'on peut négocier à CHF 1\'800\'000 ?',
    created_at: '2026-03-19T16:00:00Z',
    read: true,
  },
  {
    id: 'msg-12',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Je vais faire une contre-proposition à CHF 1\'810\'000 pour laisser une marge de négociation. L\'acquéreur est motivé, je pense qu\'on peut trouver un accord autour de CHF 1\'800\'000. Je vous tiens au courant dès que j\'ai une réponse.',
    created_at: '2026-03-19T16:30:00Z',
    read: false,
  },
]
