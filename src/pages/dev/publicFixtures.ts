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

/* ─── `/desinscription` — email-preferences ──────────────────────────────────
 *
 * ⚠ LA LANGUE FAIT PARTIE DE LA FIXTURE, et c'est délibéré : cette page se rend
 * dans la langue du CONTACT (`contacts.language`, portée par la réponse de l'edge),
 * jamais dans celle du navigateur. Un banc qui la montrerait toujours en français
 * cacherait précisément ce qui la distingue. L'état `termine` la rend donc en
 * ALLEMAND, tout coupé — deux choses à regarder d'un coup.
 */

/**
 * Les états qu'on fait jouer aux surfaces.
 *
 * ⛔ `erreur` A ÉTÉ AJOUTÉ LE 17 AOÛT 2026, ET IL COMBLE UN TROU QUI A COÛTÉ TROIS
 * FOIS. Les bannières d'échec de GESTE — report refusé, annulation refusée, dépôt
 * de pièce rejeté — n'étaient atteignables dans AUCUN état : le banc couvrait les
 * chemins heureux (`nominal`) et les états TERMINAUX (`termine`, `expire`), jamais
 * ce qui se passe quand un geste échoue. Trois correctifs de ce chantier ont donc
 * dû être prouvés par sonde au lieu d'une capture.
 *
 * ⚠ IL NE FAIT ÉCHOUER QUE LES ÉCRITURES. Faire échouer la lecture ne montrerait
 * pas une page en erreur mais « lien invalide » — l'absence de page. C'est
 * exactement ce que fait `contrat.etat = 'erreur'` de `bancSupabase`, et c'est
 * pourquoi il ne convenait pas ici.
 */
export type PublicEtat = 'nominal' | 'termine' | 'expire' | 'erreur'

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
    /**
     * ⛔ ELLE VALAIT `[]` DANS LES QUATRE ÉTATS, Y COMPRIS CELUI DONT LE LIBELLÉ
     * PROMET « Pièces déposées ». Conséquence : la pilule « reçu » de chaque
     * fichier — et son point, qui rendait 2,41:1 avant correction — n'était
     * visible dans AUCUN état du banc. Un état qui contredit son propre titre est
     * pire qu'un état manquant : on le regarde en croyant l'avoir vu.
     */
    uploads: etat === 'termine' || etat === 'erreur'
      ? [
          { id: 'demo-1', type: 'identity', filename: 'passeport.pdf', size_bytes: 842_133, uploaded_at: jours(-1), confirmed_by_client: true, ocr_fields: null },
          { id: 'demo-2', type: 'address', filename: 'facture-sig.pdf', size_bytes: 214_880, uploaded_at: jours(-1), confirmed_by_client: true, ocr_fields: null },
        ]
      : [],
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

/* ─── `/visit/:id/edit` et `/visit/:id/feedback` — RPC `get_visit_by_token` ──── */

/**
 * ⛔ CES DEUX-LÀ NE PASSENT PAS PAR UNE EDGE FUNCTION, mais par une RPC — et
 * c'est ce qui les distinguait des trois premières surfaces du banc. La lecture
 * directe de `visits` a été retirée en juillet 2026 (une policy anon
 * `manage_token IS NOT NULL` exposait TOUTES les visites) ; il ne reste que
 * `get_visit_by_token`, SECURITY DEFINER. La fixture se pose donc dans
 * `contrat.rpc`, pas dans `contrat.edges`.
 *
 * ⚠ ET LE JETON EST DANS LA QUERY, PAS DANS LE CHEMIN : ces pages lisent
 * `searchParams.get('token')`. Une route de banc en `visite/:token` les
 * monterait sans jeton — elles rendraient leur écran « lien invalide », et on
 * croirait regarder un défaut de fixture.
 */
export function visiteVue(etat: PublicEtat) {
  return {
    id: 'demo-visit',
    // ⚠ `done` n'est pas un état « terminé » décoratif : c'est le seul statut
    // depuis lequel un avis se dépose, et l'automation ne relance que des `done`.
    scheduled_at: jours(etat === 'termine' ? -2 : 3),
    status: etat === 'termine' ? 'done' : etat === 'expire' ? 'cancelled' : 'scheduled',
    buyer_name: 'Client Démo',
    buyer_email: 'client.demo@example.invalid',
    property: {
      title: 'Bien de démonstration',
      address: 'Rue Démo 1',
      city: 'Genève',
      photos: [],
    },
  }
}

/* ─── `/accept-invite/:token` — accept-team-invite ───────────────────────────── */

/**
 * ⚠ CETTE SURFACE RÉPOND SES ERREURS DANS LE CORPS, pas par un statut HTTP : la
 * page teste `data?.error` et traduit le code. Une fixture qui rendrait une
 * erreur de transport montrerait donc l'écran générique et masquerait les trois
 * écrans que ce banc existe pour regarder.
 */
export function invitationVue(etat: PublicEtat) {
  if (etat === 'termine') return { error: 'invitation_accepted' }
  if (etat === 'expire') return { error: 'invitation_expired' }
  return {
    email: 'invite.demo@example.invalid',
    role: 'agent',
    agencyName: 'Agence Démo',
    inviterName: 'Agent Démo',
    expiresAt: jours(6),
  }
}

/**
 * Préférences d'e-mail. Les trois états du banc s'y lisent naturellement :
 * `nominal` = rien de refusé, `termine` = tout coupé (et en allemand), `expire` =
 * jeton refusé, l'écran d'impasse.
 */
export function desinscriptionVue(etat: PublicEtat) {
  if (etat === 'expire') return { error: 'invalid_token' }
  const tout = etat === 'termine'
  return {
    email: 'demo@exemple.ch',
    locale: tout ? 'de' : 'fr',
    allBlocked: tout,
    blocked: tout ? ['relance', 'bien', 'rappel'] : ['bien'],
    natures: ['relance', 'bien', 'rappel'],
  }
}
