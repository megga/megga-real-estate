/**
 * Données de démonstration partagées par les harnais d'aperçu (`/dev/*`).
 *
 * ⛔ Rien ici ne vient de la base et rien ne doit y ressembler à un vrai bien
 * d'agence : ces objets servent à vérifier une composition sans session, pas à
 * simuler un portefeuille.
 *
 * ⚠ Une SEULE fixture partagée. `DEMO_LISTING` vivait dans
 * `MobileShowcasePage.tsx` ; l'aperçu bureau en aurait recopié une variante, et
 * les deux auraient divergé au premier champ ajouté — c'est exactement ce qui
 * est arrivé à la carte des types du wizard (`villa` valait `'villa'` d'un côté
 * et `'house'` de l'autre).
 */
import type { Property } from '@/types/listing'

export const DEMO_LISTING: Property = {
  id: 'p3', agency_id: 'ag', title: 'Villa contemporaine', description: 'Villa lumineuse de 240 m² avec piscine, vue dégagée, finitions haut de gamme. Quartier résidentiel calme à Cologny, proche des écoles internationales.',
  type: 'villa', status: 'active', price: 3850000, currency: 'CHF', rooms: 7, bedrooms: 5, bathrooms: 3, surface_m2: 240,
  year_built: 2019, charges_monthly: 0, mandate_type: 'Exclusif', energy_class: 'A', mandate_commission_pct: 3, mandate_signed_at: '2026-05-02', mandate_expires_at: '2026-11-02',
  transaction_type: 'buy', address: 'Route de la Capite 12', city: 'Cologny', canton: 'GE', postal_code: '1223', lat: 46.22, lng: 6.18,
  photos: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80'],
  c2pa_verified: true, features: ['Piscine', 'Jardin', 'Garage', 'Cave'], created_by: 'u', created_at: '2026-05-02', published_at: '2026-05-04',
}
