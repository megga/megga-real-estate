// ─── Seller Portal Mock Data ───────────────────────────────────────────────

export interface SellerProperty {
  title: string
  address: string
  city: string
  type: string
  price: number
  mandate_type: string
  mandate_status: 'active' | 'expired' | 'pending'
  photo_url: string
  rooms: number
  surface_m2: number
  published_at: string
}

export const SELLER_PROPERTY: SellerProperty = {
  title: 'Appartement 4.5 pièces avec vue',
  address: 'Avenue de Champel 45',
  city: 'Genève',
  type: 'Appartement',
  price: 1350000,
  mandate_type: 'Exclusif',
  mandate_status: 'active',
  photo_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
  rooms: 4.5,
  surface_m2: 115,
  published_at: '2026-02-11T10:00:00Z',
}

export interface SellerKPI {
  label: string
  value: string | number
  sub?: string
  color: 'success' | 'accent' | 'warning' | 'primary'
}

export const SELLER_KPIS: SellerKPI[] = [
  { label: 'Statut du mandat', value: 'Actif', color: 'success' },
  { label: 'Visites réalisées', value: 7, color: 'accent' },
  { label: 'Offres reçues', value: 2, color: 'warning' },
  { label: 'Jours en ligne', value: 34, color: 'primary' },
]

export interface SellerTimelineEvent {
  id: string
  type: 'visit_planned' | 'visit_done' | 'offer' | 'document' | 'message'
  title: string
  description: string
  timestamp: string
}

export const SELLER_TIMELINE: SellerTimelineEvent[] = [
  {
    id: 'tl1',
    type: 'offer',
    title: 'Nouvelle offre reçue',
    description: 'Une offre de CHF 1\'280\'000 a été déposée par un acquéreur qualifié.',
    timestamp: '2026-03-16T14:30:00Z',
  },
  {
    id: 'tl2',
    type: 'visit_done',
    title: 'Visite réalisée — retour positif',
    description: 'Famille R. : très intéressés par la luminosité et la vue. Souhaitent revoir le bien.',
    timestamp: '2026-03-15T11:00:00Z',
  },
  {
    id: 'tl3',
    type: 'message',
    title: 'Message de votre agent',
    description: 'Gregory a partagé un compte-rendu de la visite de samedi.',
    timestamp: '2026-03-15T16:00:00Z',
  },
  {
    id: 'tl4',
    type: 'visit_planned',
    title: 'Visite planifiée',
    description: 'M. B. visitera le bien le 20 mars à 10h00.',
    timestamp: '2026-03-14T09:00:00Z',
  },
  {
    id: 'tl5',
    type: 'document',
    title: 'Document ajouté',
    description: 'Le procès-verbal d\'estimation a été téléversé dans vos documents.',
    timestamp: '2026-03-12T10:30:00Z',
  },
  {
    id: 'tl6',
    type: 'visit_done',
    title: 'Visite réalisée',
    description: 'Couple D. : bien apprécié, mais budget légèrement inférieur. Pas de suite immédiate.',
    timestamp: '2026-03-10T14:00:00Z',
  },
]

export interface SellerVisit {
  id: string
  date: string
  time: string
  visitor_name: string
  status: 'planned' | 'done' | 'cancelled'
  agent_feedback: string | null
}

export const SELLER_VISITS: SellerVisit[] = [
  {
    id: 'v1',
    date: '2026-03-20',
    time: '10:00',
    visitor_name: 'M. B.',
    status: 'planned',
    agent_feedback: null,
  },
  {
    id: 'v2',
    date: '2026-03-22',
    time: '14:30',
    visitor_name: 'Famille T.',
    status: 'planned',
    agent_feedback: null,
  },
  {
    id: 'v3',
    date: '2026-03-15',
    time: '10:30',
    visitor_name: 'Famille R.',
    status: 'done',
    agent_feedback: 'Très intéressés par la luminosité et la vue sur le parc. Souhaitent revenir pour une deuxième visite. Financement en cours de validation auprès de leur banque.',
  },
  {
    id: 'v4',
    date: '2026-03-10',
    time: '14:00',
    visitor_name: 'Couple D.',
    status: 'done',
    agent_feedback: 'Ont apprécié l\'agencement et la cuisine. Budget légèrement en dessous du prix demandé. Pas de suite immédiate envisagée.',
  },
  {
    id: 'v5',
    date: '2026-03-08',
    time: '11:00',
    visitor_name: 'M. L.',
    status: 'done',
    agent_feedback: 'Cherche un bien plus grand (5+ pièces). Ne correspond pas à ses critères.',
  },
  {
    id: 'v6',
    date: '2026-03-05',
    time: '16:00',
    visitor_name: 'Mme K.',
    status: 'cancelled',
    agent_feedback: 'Annulé par le visiteur — empêchement professionnel.',
  },
  {
    id: 'v7',
    date: '2026-03-01',
    time: '10:00',
    visitor_name: 'Famille P.',
    status: 'done',
    agent_feedback: 'Première visite positive. Intéressés mais en attente de la vente de leur bien actuel.',
  },
  {
    id: 'v8',
    date: '2026-02-25',
    time: '14:00',
    visitor_name: 'M. & Mme S.',
    status: 'done',
    agent_feedback: 'Bonne impression générale. Trouvent le prix juste. Demandent un délai de réflexion.',
  },
  {
    id: 'v9',
    date: '2026-02-20',
    time: '11:30',
    visitor_name: 'Couple A.',
    status: 'done',
    agent_feedback: 'Recherchent un rez-de-chaussée — étage trop élevé pour eux.',
  },
]

export interface SellerOffer {
  id: string
  amount: number
  date: string
  status: 'pending' | 'accepted' | 'refused' | 'counter'
  conditions: string | null
  buyer_name: string
}

export const SELLER_OFFERS: SellerOffer[] = [
  {
    id: 'o1',
    amount: 1280000,
    date: '2026-03-16T14:30:00Z',
    status: 'pending',
    conditions: 'Sous réserve d\'obtention du financement hypothécaire sous 30 jours.',
    buyer_name: 'Famille R.',
  },
  {
    id: 'o2',
    amount: 1200000,
    date: '2026-03-08T10:00:00Z',
    status: 'refused',
    conditions: null,
    buyer_name: 'M. & Mme S.',
  },
]

export interface SellerDocument {
  id: string
  name: string
  type: string
  status: 'signed' | 'available' | 'pending'
  date: string
  size: string
}

export const SELLER_DOCUMENTS: SellerDocument[] = [
  { id: 'sd1', name: 'Mandat de vente exclusif', type: 'pdf', status: 'signed', date: '2026-02-10T09:00:00Z', size: '420 Ko' },
  { id: 'sd2', name: 'Procès-verbal d\'estimation', type: 'pdf', status: 'available', date: '2026-03-12T10:30:00Z', size: '1.8 Mo' },
  { id: 'sd3', name: 'Photos professionnelles', type: 'zip', status: 'available', date: '2026-02-12T14:00:00Z', size: '45 Mo' },
  { id: 'sd4', name: 'Plan de l\'appartement', type: 'pdf', status: 'available', date: '2026-02-11T11:00:00Z', size: '2.3 Mo' },
  { id: 'sd5', name: 'Extrait du registre foncier', type: 'pdf', status: 'available', date: '2026-02-15T09:30:00Z', size: '156 Ko' },
  { id: 'sd6', name: 'Bon de visite — Famille R.', type: 'pdf', status: 'signed', date: '2026-03-15T10:00:00Z', size: '89 Ko' },
  { id: 'sd7', name: 'Offre d\'achat — Famille R.', type: 'pdf', status: 'pending', date: '2026-03-16T14:30:00Z', size: '210 Ko' },
  { id: 'sd8', name: 'Diagnostic énergétique (CECB)', type: 'pdf', status: 'available', date: '2026-02-18T16:00:00Z', size: '3.1 Mo' },
]

export interface SellerMessage {
  id: string
  sender: 'agent' | 'seller'
  sender_name: string
  content: string
  timestamp: string
}

export const SELLER_MESSAGES: SellerMessage[] = [
  {
    id: 'm1',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Bonjour Marie, je vous confirme que votre bien est désormais en ligne sur notre plateforme et les principaux portails immobiliers. Je vous tiendrai informée de chaque visite.',
    timestamp: '2026-02-11T11:00:00Z',
  },
  {
    id: 'm2',
    sender: 'seller',
    sender_name: 'Marie Rochat',
    content: 'Merci Gregory ! Est-ce que les photos sont celles du photographe professionnel ?',
    timestamp: '2026-02-11T14:30:00Z',
  },
  {
    id: 'm3',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Oui, ce sont bien les photos de notre photographe. Elles mettent vraiment en valeur la luminosité et la vue. Nous avons déjà reçu plusieurs demandes de visites !',
    timestamp: '2026-02-11T15:00:00Z',
  },
  {
    id: 'm4',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Bonjour Marie, petite mise à jour : la visite de samedi avec la Famille R. s\'est très bien passée. Ils sont vraiment intéressés par l\'appartement, en particulier la luminosité et la vue sur le parc. Ils souhaitent revenir pour une deuxième visite. Je vous tiens au courant.',
    timestamp: '2026-03-15T16:00:00Z',
  },
  {
    id: 'm5',
    sender: 'seller',
    sender_name: 'Marie Rochat',
    content: 'Super nouvelle ! Est-ce qu\'ils ont évoqué un budget ou fait une remarque sur le prix ?',
    timestamp: '2026-03-15T17:30:00Z',
  },
  {
    id: 'm6',
    sender: 'agent',
    sender_name: 'Gregory Lyonnet',
    content: 'Ils n\'ont pas négocié à ce stade, mais ils m\'ont dit que le prix leur semblait cohérent avec le marché. Leur financement est en cours de validation. Je pense que nous recevrons une offre rapidement.',
    timestamp: '2026-03-15T18:00:00Z',
  },
]
