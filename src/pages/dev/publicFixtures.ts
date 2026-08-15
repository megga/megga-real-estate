/**
 * Fixtures de la FACE PUBLIQUE — les trois surfaces qu'un client ouvre sans
 * compte : `/kyc/:token`, `/rendez-vous/:token`, `/reception/:token`.
 *
 * ⛔ ELLES SONT DONNÉES À L'INTERCEPTEUR PAR `contrat.edges`, PAS PAR `tables`.
 * Ces écrans ne lisent RIEN de PostgREST : leur contenu entier vient d'une edge
 * function, jeton compris. Le banc répondait `{ok:true, banc:true}` à toute
 * fonction — ce qui ne montre pas un écran vide, mais un écran d'ERREUR.
 *
 * ⚠ DONNÉES DE DÉMONSTRATION, ET ÇA SE VOIT. Ces pages portent en production des
 * dates de rendez-vous, des références de dossier et des prix : une fixture qui
 * « a l'air vraie » se recopie un jour dans une capture, un ticket ou une
 * maquette. Tout est donc nommé « Démo », et les prix sont des nombres ronds
 * manifestement inventés.
 *
 * ⚠ LES DATES SONT RELATIVES À L'OUVERTURE DU BANC, jamais figées : un jeton qui
 * expire « le 21.08.2026 » devient un jeton expiré le lendemain, et l'écran
 * bascule sans que personne ait touché au code.
 */
import type { MagicLinkPublicView } from '@/types/magicLink'
import type { PublicAppointment, SlotsView } from '@/hooks/useAppointmentBooking'
import type { ReceptionBien } from '@/hooks/useBuyerReception'

/** Les états qu'on fait jouer aux trois surfaces. */
export type PublicEtat = 'nominal' | 'termine' | 'expire'

const jours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

/* ─── `/kyc/:token` — magic-link-get ─────────────────────────────────────────── */

export function mlkVue(etat: PublicEtat): MagicLinkPublicView {
  return {
    magic_link_id: 'demo-magic-link',
    // `submitted` amène l'écran de succès puis la prise de rendez-vous ;
    // `expired` amène `MlkExpired`. `opened` est le parcours de dépôt.
    status: etat === 'termine' ? 'submitted' : etat === 'expire' ? 'expired' : 'opened',
    mode: 'libre',
    custom_message: null,
    expires_at: jours(etat === 'expire' ? -1 : 6),
    contact: { first_name: 'Démo', last_name: 'Démo' },
    agency: { name: 'Agence Démo', slug: 'agence-demo' },
    agent: { full_name: 'Agent Démo' },
    uploads: [],
  }
}

/* ─── `/rendez-vous/:token` — appointment-manage et appointment-slots ────────── */

export function apptVue(etat: PublicEtat): { appointment: PublicAppointment } {
  return {
    appointment: {
      id: 'demo-appointment',
      starts_at: jours(3),
      ends_at: jours(3),
      status: etat === 'expire' ? 'cancelled' : 'confirmed',
      mode: 'sur_place',
      location: 'Adresse de démonstration, Genève',
      timezone: 'Europe/Zurich',
      video_link: null,
      reschedule_count: 0,
      // ⚠ `can_change` grise « déplacer / annuler » au lieu de laisser cliquer
      // pour rien : l'état ANNULÉ doit donc le rendre faux, sinon le banc montre
      // une affordance que la production n'offre pas.
      can_change: etat !== 'expire',
    },
  }
}

export function apptCreneaux(): SlotsView {
  const debut = new Date(Date.now() + 2 * 86_400_000)
  debut.setHours(9, 0, 0, 0)
  return {
    booking_open: true,
    timezone: 'Europe/Zurich',
    slot_minutes: 45,
    mode: 'sur_place',
    location: 'Adresse de démonstration, Genève',
    min_notice_hours: 12,
    max_advance_days: 30,
    slots: Array.from({ length: 8 }, (_, i) => {
      const s = new Date(debut.getTime() + i * 3_600_000)
      return { start: s.toISOString(), end: new Date(s.getTime() + 45 * 60_000).toISOString() }
    }),
  }
}

/* ─── `/reception/:token` — buyer-reception-get ──────────────────────────────── */

const bien = (i: number, status: string): ReceptionBien => ({
  match_id: `demo-${i}`,
  status,
  reaction_motif: null,
  title: `Bien de démonstration ${i}`,
  quartier: 'Quartier démo',
  addr: 'Adresse de démonstration',
  transaction: 'vente',
  price: 1_000_000 * i,
  rent: null,
  rooms: 3 + i,
  area: 80 + 20 * i,
  floor: i,
  year: 2000,
  charges: null,
  price_per_m2: null,
  features: ['Caractéristique démo A', 'Caractéristique démo B'],
  desc: 'Description de démonstration.',
  photos: [],
})

export function receptionVue(etat: PublicEtat) {
  if (etat === 'expire') return { ok: false as const, reason: 'expired' as const, contact: { firstName: 'Démo' }, agent: null, items: [] }
  return {
    ok: true as const,
    contact: { firstName: 'Démo' },
    agent: { name: 'Agent Démo', phone: null, avatar: null, agency: 'Agence Démo' },
    // « Terminé » = tout est traité : c'est l'écran de fin, pas une liste vide.
    items: etat === 'termine'
      ? [bien(1, 'interested'), bien(2, 'rejected'), bien(3, 'interested')]
      : [bien(1, 'sent'), bien(2, 'sent'), bien(3, 'sent')],
  }
}
