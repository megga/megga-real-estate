import type { CalendarEvent } from './calendar.types'

export const MOCK_CONTACTS = [
  'Famille Rochat', 'Marie Rochat', 'Jean-Marc Weber', 'Pierre Müller',
  'Sophie Dubois', 'Amina Bensalah', 'Famille Keller', 'Lucas Fernandez',
  'Marc Bianchi', 'Nadia Schmid',
]

export const MOCK_PROPERTIES = [
  '4 pièces Eaux-Vives', 'Studio Plainpalais', 'Villa 7 pièces Cologny',
  '3 pièces Carouge', '2 pièces Servette', 'Duplex Champel',
  'Loft 3 pièces Pâquis', 'Maison 5 pièces Thônex', 'Attique 5 pièces Champel',
]

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '1', type: 'visit', title: 'Visite Appartement Eaux-Vives',
    date: new Date(2026, 2, 2, 10, 0), endDate: new Date(2026, 2, 2, 11, 0),
    contact: 'Famille Rochat', property: '4 pièces Eaux-Vives', address: 'Rue du Lac 14, 1207 Genève',
    notes: 'Deuxième visite, intéressés par le balcon sud',
  },
  {
    id: '2', type: 'meeting', title: 'RDV Marie Rochat — signature mandat',
    date: new Date(2026, 2, 3, 14, 0), endDate: new Date(2026, 2, 3, 15, 30),
    contact: 'Marie Rochat', property: 'Studio Plainpalais', address: 'Agence MEGGA, Rue du Rhône 42',
    notes: 'Apporter le mandat exclusif signé + copie pièce identité',
  },
  {
    id: '3', type: 'reminder', title: 'Relance Jean-Marc Weber',
    date: new Date(2026, 2, 5, 9, 0), endDate: new Date(2026, 2, 5, 9, 30),
    contact: 'Jean-Marc Weber', notes: 'Relancer pour confirmation visite du 3 pièces Carouge',
  },
  {
    id: '4', type: 'visit', title: 'Visite Villa Cologny',
    date: new Date(2026, 2, 7, 11, 0), endDate: new Date(2026, 2, 7, 12, 30),
    contact: 'Pierre Müller', property: 'Villa 7 pièces Cologny', address: 'Chemin de la Colline 8, 1223 Cologny',
    notes: 'Client VIP, prévoir documentation complète + plan cadastral',
  },
  {
    id: '5', type: 'deadline', title: 'Expiration mandat Villa Cologny',
    date: new Date(2026, 2, 10, 18, 0), endDate: new Date(2026, 2, 10, 18, 0),
    property: 'Villa 7 pièces Cologny', notes: 'Mandat exclusif expire — renouveler ou archiver',
  },
  {
    id: '6', type: 'estimation', title: 'Estimation 3 pièces Carouge',
    date: new Date(2026, 2, 12, 14, 0), endDate: new Date(2026, 2, 12, 15, 0),
    contact: 'Sophie Dubois', property: '3 pièces Carouge', address: 'Place du Marché 6, 1227 Carouge',
    notes: 'Première estimation, propriétaire souhaite vendre avant été',
  },
  {
    id: '7', type: 'visit', title: 'Visite 2 pièces Servette',
    date: new Date(2026, 2, 14, 10, 30), endDate: new Date(2026, 2, 14, 11, 30),
    contact: 'Amina Bensalah', property: '2 pièces Servette', address: 'Rue de la Servette 78, 1202 Genève',
  },
  {
    id: '8', type: 'meeting', title: 'RDV Notaire — acte de vente',
    date: new Date(2026, 2, 17, 10, 0), endDate: new Date(2026, 2, 17, 12, 0),
    contact: 'Famille Rochat', property: '4 pièces Eaux-Vives', address: 'Étude Notariale Perrin, Rue Verdaine 3',
    notes: 'Acte de vente final — vérifier que tous les documents KYC sont validés',
  },
  {
    id: '9', type: 'reminder', title: 'Rappel offre Famille Keller',
    date: new Date(2026, 2, 17, 15, 0), endDate: new Date(2026, 2, 17, 15, 30),
    contact: 'Famille Keller', property: 'Duplex Champel', notes: 'Réponse attendue sur contre-offre',
  },
  {
    id: '10', type: 'visit', title: 'Visite Loft Pâquis',
    date: new Date(2026, 2, 19, 16, 0), endDate: new Date(2026, 2, 19, 17, 0),
    contact: 'Lucas Fernandez', property: 'Loft 3 pièces Pâquis', address: 'Rue de Berne 22, 1201 Genève',
  },
  {
    id: '11', type: 'estimation', title: 'Estimation Maison Thônex',
    date: new Date(2026, 2, 21, 9, 0), endDate: new Date(2026, 2, 21, 10, 30),
    contact: 'Marc Bianchi', property: 'Maison 5 pièces Thônex', address: 'Route de Jussy 45, 1226 Thônex',
    notes: 'Maison des années 70, potentiel de rénovation',
  },
  {
    id: '12', type: 'deadline', title: 'Deadline dossier KYC — Pierre Müller',
    date: new Date(2026, 2, 24, 17, 0), endDate: new Date(2026, 2, 24, 17, 0),
    contact: 'Pierre Müller', notes: 'Documents manquants : attestation de provenance des fonds',
  },
  {
    id: '13', type: 'meeting', title: 'RDV signature compromis',
    date: new Date(2026, 2, 26, 11, 0), endDate: new Date(2026, 2, 26, 12, 30),
    contact: 'Sophie Dubois', property: '3 pièces Carouge', address: 'Agence MEGGA, Rue du Rhône 42',
    notes: 'Compromis de vente — vérifier clauses suspensives',
  },
  {
    id: '14', type: 'visit', title: 'Visite Attique Champel',
    date: new Date(2026, 2, 28, 14, 0), endDate: new Date(2026, 2, 28, 15, 0),
    contact: 'Nadia Schmid', property: 'Attique 5 pièces Champel', address: 'Avenue de Champel 31, 1206 Genève',
    notes: 'Vue lac, terrasse 40m² — client avec budget confirmé',
  },
  {
    id: '15', type: 'reminder', title: 'Relance dossier financement',
    date: new Date(2026, 2, 30, 9, 0), endDate: new Date(2026, 2, 30, 9, 30),
    contact: 'Famille Rochat', notes: 'Vérifier avancement dossier hypothécaire auprès de la banque',
  },
]
