// Lecture des sources du point du jour — visites, rendez-vous, relances, offres, leads vendeurs, matching —,
// partagée par le push de 07h30 (`whatsapp-morning-brief`) et l'outil `get_daily_brief` du copilote WhatsApp.
//
// POURQUOI UN SEUL LECTEUR. Hors fenêtre 24 h, le push part en template `agent_daily_brief` :
// il annonce « N élément(s) à traiter » et fait répondre « mon point du jour ». L'outil qui
// répond doit retrouver ces N éléments. Tant que chacun avait ses requêtes, l'outil ne lisait
// que les visites de l'agent et les leads à compléter — ni relances, ni offres, ni leads
// vendeurs : le décompte promis le matin ne se retrouvait pas dans le détail livré.
//
// ⛔ Les deux appelants lisent en SERVICE ROLE : la RLS est contournée, et le filtre d'agence
// posé sur CHAQUE requête est la seule garde de tenant (éprouvé par morning-brief-data.test.ts).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  SQL_LIMITS,
  type BriefAgencyData, type BriefVisitRow, type BriefEvent, type BriefReminder, type BriefOffer, type BriefSellerLead,
  type BriefMatching, type BriefMatchingAction,
} from './morning-brief.ts'
import { filtreEvenementsDuJour, occurrencesDuJour } from './calendar-events.ts'

type NameRow = { first_name: string | null; last_name: string | null } | null

function contactName(c: NameRow): string | null {
  return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || null
}

// Les sources du brief, scoppées AGENCE (comme le cockpit Aujourd'hui). En service
// role la RLS est bypassée → le filtre agency_id est OBLIGATOIRE sur chaque requête
// (la fonction de matching le prend en paramètre : la RPC ci-dessous, `p_agency`).
// (Les RPC du Focus type focus_top_matches dérivent l'agence de auth.uid() et
// renvoient 0 ligne en service role — d'où des lectures de table directes.)
// Retourne null si UNE des requêtes échoue : un brief avec une section manquante en
// silence est mensonger (l'agent croirait sa matinée libre) — mieux vaut aucun brief.
export async function loadAgencyData(
  admin: SupabaseClient, agencyId: string, startIso: string, endIso: string, now: Date,
): Promise<BriefAgencyData | null> {
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString()

  const [visitsRes, eventsRes, remindersRes, offersRes, leadsRes, matchingRes, interessesRes] = await Promise.all([
    admin.from('visits')
      .select('scheduled_at, buyer_name, agent_id, contact:contacts(first_name, last_name), property:properties(title, city)')
      .eq('agency_id', agencyId)
      .in('status', ['planned', 'confirmed'])
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .limit(SQL_LIMITS.visits),
    // Les rendez-vous du Calendrier (20260915080300) — ils partaient en relance avant cette
    // table, et le brief les voyait sous « À relancer » ; séries comprises, développées plus bas.
    admin.from('calendar_events')
      .select('type, starts_at, all_day, status, recurrence, contact:contacts(first_name, last_name)')
      .eq('agency_id', agencyId)
      .or(filtreEvenementsDuJour(startIso, endIso))
      .order('starts_at', { ascending: true })
      .limit(SQL_LIMITS.events),
    // Dues = échéance avant la fin de la journée locale, retard inclus. `.or(...)` EXCLUT, avant la limite, une
    // relance qui EST un retour du matching PAR DÉFINITION — celle de la section 1 de la migration
    // (`matching_actions_agence`, CTE `relances_dues`/`retours`) : une `follow_up_sent_property` due, avec un
    // acheteur et au moins un match couvert (`match_ids` ou `match_id`). `fermer_relance_proposition` (migration
    // matching_boucle) clôt la relance dès que plus aucun bien n'attend : une relance encore ouverte qui NOMME un
    // match couvre donc TOUJOURS un match `sent` — sauf le bref délai avant que ce déclencheur ne joue (une relance
    // dite « orpheline » : ouverte, mais dont plus aucun match n'attend). Ce filtre exclut l'orpheline elle aussi,
    // sans la distinguer d'un retour dû — les deux NOMMENT un match, et c'est tout ce qu'il regarde. Mesuré en
    // production le 25.09.2026 (lecture seule) : 1 relance de proposition ouverte, 0 orpheline (aucune sans match
    // qui attend encore) — `reminders.match_ids` lui-même n'existe pas encore en production, il arrive avec la
    // migration du lot B (`…_matching_boucle.sql`), pas encore appliquée : à remesurer une fois la pile posée.
    // `match_ids` est NULLABLE SANS DÉFAUT (migration 20260921140000, commentaire de colonne) : NULL pour une
    // relance d'UN SEUL bien — c'est le cas courant, `match_id` seul la couvre alors. `{}` (vide, un état distinct
    // de NULL) ne couvre rien non plus, comme dans la CTE (`any('{}')` ne joint aucune ligne) — un `.is.null` seul
    // le raterait.
    //
    // Filtrer ICI, avant `.limit`, et jamais après coup sur les lignes lues : deux défauts sinon. FAMINE — si les
    // `SQL_LIMITS.reminders` relances les plus anciennes étaient toutes des retours, la section resterait vide et
    // son plafond se déclarerait atteint, sans qu'aucune vraie relance au-delà de ce rang n'ait jamais été lue.
    // DOUBLE COMPTE — dédupliquer à partir de `matching.actions` (plafonné par SA PROPRE limite) laisserait la
    // relance d'un retour au-delà de son rang dans « À relancer », comptant deux fois le même événement. Ce filtre
    // ne dépend d'aucun des deux : il ne lit que la relance elle-même.
    //
    // ⛔ L'embarquement du contact n'est PAS `!inner`, à la différence de celui des intéressés plus bas.
    // `reminders.contact_id` est NULLABLE — une relance d'agence sans acheteur (« rappeler le notaire ») est
    // légitime et doit rester lue, avec `who: null`. Sous PostgREST, un filtre sur une ressource EMBARQUÉE SANS
    // `!inner` la met à `null` quand elle ne correspond pas (contact absent, ou d'une autre agence), SANS écarter
    // la ligne parente — la relance reste, seul le nom disparaît. `!inner` en ferait une jointure stricte et
    // écarterait aussi les relances sans contact, qui n'ont rien à voir avec la fuite qu'on ferme.
    admin.from('reminders')
      .select('type, trigger_at, contact_id, contact:contacts(first_name, last_name, agency_id)')
      .eq('agency_id', agencyId)
      .eq('contact.agency_id', agencyId)
      .in('status', ['pending', 'triggered', 'snoozed'])
      .not('trigger_at', 'is', null)
      .lt('trigger_at', endIso)
      .or(`type.neq.follow_up_sent_property,trigger_at.gt.${now.toISOString()},contact_id.is.null,and(or(match_ids.is.null,match_ids.eq.{}),match_id.is.null)`)
      .order('trigger_at', { ascending: true })
      .limit(SQL_LIMITS.reminders),
    admin.from('crm_offers')
      .select('amount, by_label, expires_at')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', in48h)
      .order('expires_at', { ascending: true })
      .limit(SQL_LIMITS.offers),
    // Pool partagé (parité RLS front) : leads assignés à l'agence OU non assignés.
    // Fraîcheur 72 h (couvre le week-end pour le lundi matin) : « nouveaux » doit
    // rester vrai — un lead jamais traité ne revient pas tous les matins à vie,
    // le backlog complet vit dans le Focus/CRM.
    admin.from('seller_leads')
      .select('contact_name, property_data, estimation_median')
      .eq('status', 'new')
      .or(`assigned_agency_id.eq.${agencyId},assigned_agency_id.is.null`)
      .gte('created_at', new Date(now.getTime() - 72 * 3600 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(SQL_LIMITS.sellerLeads),
    // Lot D2 : le matching du jour, par la fonction d'« Aujourd'hui » sur l'agence passée — le rôle de service n'a pas
    // d'agence à lui, `matching_actions_du_jour` ne rendrait rien. Actions classées, total exact.
    admin.rpc('matching_actions_agence', { p_agency: agencyId, p_limite: SQL_LIMITS.matching }),
    // Les intéressés qui attendent une visite (« À conclure »), le plus ancien intérêt d'abord ; l'id du match
    // départage : `response_at` peut être égal (ou nul) sur plusieurs lignes, et sans second critère l'ordre près
    // de la limite n'est pas stable d'un appel à l'autre.
    // ⚠ LIMITE CONNUE, laissée telle quelle : un mandat SUPPRIMÉ (`properties.deleted_at`) n'est pas exclu ici.
    // Un embed `properties` FACULTATIF (pas `!inner` : un match sur une annonce du marché a `property_id` nul, et
    // `!inner` écarterait ces lignes-là aussi) filtré sur `deleted_at` ne changerait rien à ce compte — comme pour
    // les relances ci-dessus, un embed SANS `!inner` vide l'embarqué SANS écarter la ligne parente : le match sur
    // un mandat supprimé resterait un intéressé compté, juste privé des colonnes du bien. `!inner`, lui, exclurait
    // aussi les annonces. Ni l'un ni l'autre ne l'écarte proprement.
    // ⚠ Le contact, LUI, reste `!inner` — à la différence de la lecture des relances ci-dessus. `matches.contact_id`
    // n'est JAMAIS nul (un match a toujours un acheteur) : un match dont le contact embarqué n'est pas de cette
    // agence n'est donc pas un cas légitime à garder sans nom, comme une relance sans acheteur — c'est une
    // référence croisée entre agences, une anomalie. L'écarter en entier (ce que fait `!inner`) est le bon choix.
    admin.from('matches')
      .select('id, contact_id, contact:contacts!inner(first_name, last_name, agency_id)')
      .eq('agency_id', agencyId)
      .eq('contact.agency_id', agencyId)
      .eq('status', 'interested')
      .order('response_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(SQL_LIMITS.interesses),
  ])

  for (const res of [visitsRes, eventsRes, remindersRes, offersRes, leadsRes, matchingRes, interessesRes]) {
    if (res.error) {
      console.error('morning-brief agency query error:', res.error.message)
      return null
    }
  }

  // Casts via unknown : sans types générés, supabase-js type les embeds en tableau
  // alors que ces FK many-to-one renvoient un objet à l'exécution.
  const visits: BriefVisitRow[] = ((visitsRes.data ?? []) as unknown as Array<{
    scheduled_at: string; buyer_name: string | null; agent_id: string | null
    contact: NameRow; property: { title: string | null; city: string | null } | null
  }>).map((v) => ({
    scheduledAt: v.scheduled_at,
    who: contactName(v.contact) ?? v.buyer_name,
    propertyTitle: v.property?.title ?? null,
    city: v.property?.city ?? null,
    agentId: v.agent_id,
  }))

  const lignesEvenements = (eventsRes.data ?? []) as unknown as Array<{
    type: string; starts_at: string; all_day: boolean; status: string | null; recurrence: unknown; contact: NameRow
  }>
  const events: BriefEvent[] = occurrencesDuJour(lignesEvenements, startIso, endIso)
    .map((e) => ({ startsAt: e.debut, allDay: e.all_day, type: e.type, who: contactName(e.contact) }))

  const matching = lireMatching(matchingRes.data, interessesRes.data)
  // La déduplication d'une relance de proposition qui EST un retour se fait dans la REQUÊTE ci-dessus (`.or(...)`),
  // pas ici : cette lecture est donc déjà la lecture UTILE, sans filtre supplémentaire à lui appliquer.
  const lignesRelances = (remindersRes.data ?? []) as unknown as Array<{
    type: string; trigger_at: string | null; contact_id: string | null; contact: NameRow
  }>
  const reminders: BriefReminder[] = lignesRelances.map((r) => ({ type: r.type, who: contactName(r.contact) }))

  const offers: BriefOffer[] = ((offersRes.data ?? []) as Array<{
    amount: number; by_label: string; expires_at: string
  }>).map((o) => ({ amount: o.amount, byLabel: o.by_label, expiresAt: o.expires_at }))

  const sellerLeads: BriefSellerLead[] = ((leadsRes.data ?? []) as Array<{
    contact_name: string; property_data: { city?: string } | null; estimation_median: number | null
  }>).map((l) => ({
    contactName: l.contact_name,
    city: l.property_data?.city ?? null,
    estimationMedian: l.estimation_median,
  }))

  return {
    visits, events, eventsAtLimit: lignesEvenements.length >= SQL_LIMITS.events,
    // Comme les autres plafonds de ce module : « N+ » s'affiche aussi quand le compte réel vaut PILE la limite — la
    // lecture ne distingue pas « exactement N » de « plus que N ».
    reminders, remindersAtLimit: lignesRelances.length >= SQL_LIMITS.reminders,
    offers, sellerLeads, matching,
  }
}

/** Une ligne de `matching_actions_agence` (les colonnes du lot D1/D2). */
interface LigneActionMatching {
  genre: string; contact_id: string | null; prenom: string | null; nom: string | null
  match_id: string | null; property_id: string | null; market_listing_id: string | null
  statut: string | null; titre: string | null; ville: string | null
  nombre: number | null; nouveaux: number | null; baisses: number | null
  montant: number | string | null
  /** Comme `LigneAction.location` (matchingDuJour.ts) : une location porte un montant « / mois ». */
  location: boolean | null
  total: number | null
}
const GENRES: ReadonlySet<string> = new Set(['retour', 'prix', 'mandat', 'marche'])

/** Copie à l'identique de `enNombre` (src/components/crm/today/matchingDuJour.ts) : un montant `number | string |
 *  null` rejeté (`null`) s'il est vide ou non fini, pour écarter un montant EXACTEMENT comme `versAction`. */
const enNombre = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Le matching du jour. Une action qui écrirait une phrase fausse ou sans raison est écartée — la règle de `versAction`
 * (src/components/crm/today/matchingDuJour.ts), confrontée à cette copie par tests/unit/whatsapp-matching-fil.spec.ts :
 * un retour SANS ACHETEUR, une baisse SANS ACHETEUR OU SANS MATCH, sans montant positif ou au mauvais statut, un
 * mandat SANS BIEN, un marché SANS ACHETEUR OU SANS NOUVEAUTÉ NI BAISSE.
 */
export function lireMatching(actionsBrutes: unknown, interessesBruts: unknown): BriefMatching {
  const lignes = (actionsBrutes ?? []) as LigneActionMatching[]
  const actions: BriefMatchingAction[] = lignes.flatMap((l) => {
    if (!GENRES.has(l.genre)) return []
    const montant = enNombre(l.montant)
    const nouveaux = l.nouveaux ?? 0
    const baisses = l.baisses ?? 0
    if (l.genre === 'retour' && !l.contact_id) return []
    if (l.genre === 'prix' && (!l.contact_id || !l.match_id || montant == null || montant <= 0
      || (l.statut !== 'sent' && l.statut !== 'suggested'))) return []
    if (l.genre === 'mandat' && !l.property_id) return []
    if (l.genre === 'marche' && (!l.contact_id || nouveaux + baisses === 0)) return []
    // `montant` (calculé plus haut, pour TOUT genre, pas seulement `prix`) est déjà `null` ou fini : `enNombre`
    // le garantit avant même d'atteindre les gardes ci-dessus.
    return [{
      genre: l.genre as BriefMatchingAction['genre'], who: l.prenom?.trim() || l.nom?.trim() || null, contactId: l.contact_id,
      statut: l.statut, titre: l.titre?.trim() || null, ville: l.ville?.trim() || null, nombre: l.nombre ?? 0, nouveaux, baisses,
      montant, location: l.location === true,
    }]
  })
  // Dédoublonnés par CONTACT (`contact_id`), jamais par le nom affiché : deux acheteurs homonymes sont deux
  // intéressés distincts, pas un seul — le nom ne sert qu'à l'affichage une fois le contact retenu.
  const lignesInteresses = (interessesBruts ?? []) as unknown as Array<{ contact_id: string | null; contact: NameRow }>
  const contactsVus = new Set<string>()
  const interesses = lignesInteresses.flatMap((r) => {
    const nom = contactName(r.contact)
    if (nom == null) return []
    const cle = r.contact_id ?? nom
    if (contactsVus.has(cle)) return []
    contactsVus.add(cle)
    return [nom]
  })
  // Même convention que `remindersAtLimit` : « N+ » aussi pour un compte réel de PILE la limite. `total`, lui, vient
  // d'une fenêtre SQL calculée avant la coupe — exact, comme le lit déjà le CRM (`useMatchingDuJour.ts`, `Number(...)`
  // sur la même colonne).
  return {
    actions, total: Number(lignes[0]?.total ?? 0), interesses,
    interessesAtLimit: lignesInteresses.length >= SQL_LIMITS.interesses,
  }
}
