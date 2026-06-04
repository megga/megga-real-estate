// MEGGA CRM Sugar v2 — Notifications mock data + types.
// 1:1 port from the Claude Design bundle (crm-notifications.jsx).

import type { MEIconName } from '@/components/propertyx/MEIcon'

export type NotifKind = 'kyc' | 'visite' | 'offre' | 'mandat' | 'ai' | 'doc' | 'team' | 'system'
export type NotifPriority = 'high' | 'med' | 'low'
export type NotifGroup = 'today' | 'yesterday' | 'older'

export interface SugarNotif {
  id: string
  kind: NotifKind
  priority: NotifPriority
  read: boolean
  title: string
  body: string
  time: string
  group: NotifGroup
  cta: string
  ctaTo: string
}

export const KIND_META: Record<NotifKind, { dot: string; icon: MEIconName; label: string }> = {
  kyc:    { dot: '#E53935', icon: 'shield',   label: 'KYC' },
  visite: { dot: '#0891B2', icon: 'calendar',   label: 'Visite' },
  offre:  { dot: '#C45A00', icon: 'bolt',  label: 'Offre' },
  mandat: { dot: '#1E5BC6', icon: 'file',  label: 'Mandat' },
  ai:     { dot: '#0B0C0E', icon: 'sparkle', label: 'MEGGA AI' },
  doc:    { dot: '#059669', icon: 'file',  label: 'Document' },
  team:   { dot: '#7A4FD8', icon: 'share', label: 'Équipe' },
  system: { dot: '#7A8088', icon: 'bell',  label: 'Système' },
}

export const SUGAR_NOTIFS: SugarNotif[] = [
  {
    id: 'n1', kind: 'kyc', priority: 'high', read: false,
    title: 'KYC bloquant sur Élodie Schmidt',
    body: "Sa pièce d'identité a expiré, le dossier reste gelé tant qu'elle n'est pas re-vérifiée",
    time: 'Il y a 6 min', group: 'today',
    cta: 'Relancer KYC', ctaTo: 'kyc',
  },
  {
    id: 'n2', kind: 'visite', priority: 'med', read: false,
    title: 'Marie Bertrand a confirmé la visite à Carouge',
    body: 'Rendez-vous à 14:00 au 12 rue de la Filature',
    time: 'Il y a 18 min', group: 'today',
    cta: 'Voir le calendrier', ctaTo: 'calendar',
  },
  {
    id: 'n3', kind: 'offre', priority: 'high', read: false,
    title: "Antoine Picard a fait une offre de CHF 1'250'000",
    body: 'Sur le bien de Cologny, 7% sous le prix demandé, réponse attendue sous 48 h',
    time: 'Il y a 42 min', group: 'today',
    cta: 'Ouvrir le deal', ctaTo: 'pipeline',
  },
  {
    id: 'n4', kind: 'ai', priority: 'low', read: false,
    title: 'MEGGA AI a trouvé 3 nouveaux leads',
    body: 'Trois recherches sauvegardées correspondent à votre dernier bien à Champel',
    time: 'Il y a 1 h', group: 'today',
    cta: 'Examiner', ctaTo: 'matching',
  },
  {
    id: 'n5', kind: 'mandat', priority: 'med', read: true,
    title: 'Le mandat exclusif des Pâquis a été signé',
    body: 'Le propriétaire a signé électroniquement, le bien peut être publié',
    time: 'Hier · 17:42', group: 'yesterday',
    cta: 'Publier', ctaTo: 'biens',
  },
  {
    id: 'n6', kind: 'doc', priority: 'low', read: true,
    title: 'Le compromis Vionnet est prêt à signer',
    body: 'Le notaire a déposé la version finale, signature électronique disponible',
    time: 'Hier · 14:08', group: 'yesterday',
    cta: 'Ouvrir le document', ctaTo: 'docs',
  },
  {
    id: 'n7', kind: 'team', priority: 'low', read: true,
    title: 'Sophie M. a partagé un dossier avec vous',
    body: 'Vous avez désormais accès au dossier acheteur Loreau',
    time: 'Hier · 10:15', group: 'yesterday',
    cta: 'Voir le dossier', ctaTo: 'contacts',
  },
  {
    id: 'n8', kind: 'system', priority: 'low', read: true,
    title: 'Les photos de Chêne-Bougeries sont validées C2PA',
    body: 'Les 18 photos du bien sont signées et publiables',
    time: 'Lun. · 08:30', group: 'older',
    cta: 'Voir le bien', ctaTo: 'biens',
  },
  {
    id: 'n9', kind: 'system', priority: 'low', read: true,
    title: 'Votre rapport hebdomadaire est prêt',
    body: '12 visites, 4 offres et 2 compromis cette semaine',
    time: 'Dim. · 18:00', group: 'older',
    cta: 'Voir le rapport', ctaTo: 'today',
  },
]
