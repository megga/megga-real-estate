// Lecture des quatre sources du point du jour — partagée par le push de 07h30
// (`whatsapp-morning-brief`) et l'outil `get_daily_brief` du copilote WhatsApp.
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
  type BriefAgencyData, type BriefVisitRow, type BriefReminder, type BriefOffer, type BriefSellerLead,
} from './morning-brief.ts'

type NameRow = { first_name: string | null; last_name: string | null } | null

function contactName(c: NameRow): string | null {
  return [c?.first_name, c?.last_name].filter(Boolean).join(' ') || null
}

// Les 4 sources du brief, scoppées AGENCE (comme le cockpit Aujourd'hui). En service
// role la RLS est bypassée → le filtre agency_id est OBLIGATOIRE sur chaque requête.
// (Les RPC du Focus type focus_top_matches dérivent l'agence de auth.uid() et
// renvoient 0 ligne en service role — d'où des lectures de table directes.)
// Retourne null si UNE des requêtes échoue : un brief avec une section manquante en
// silence est mensonger (l'agent croirait sa matinée libre) — mieux vaut aucun brief.
export async function loadAgencyData(
  admin: SupabaseClient, agencyId: string, startIso: string, endIso: string, now: Date,
): Promise<BriefAgencyData | null> {
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000).toISOString()

  const [visitsRes, remindersRes, offersRes, leadsRes] = await Promise.all([
    admin.from('visits')
      .select('scheduled_at, buyer_name, agent_id, contact:contacts(first_name, last_name), property:properties(title, city)')
      .eq('agency_id', agencyId)
      .in('status', ['planned', 'confirmed'])
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .limit(SQL_LIMITS.visits),
    // Dues = échéance avant la fin de la journée locale, retard inclus.
    admin.from('reminders')
      .select('type, trigger_at, contact:contacts(first_name, last_name)')
      .eq('agency_id', agencyId)
      .in('status', ['pending', 'triggered', 'snoozed'])
      .not('trigger_at', 'is', null)
      .lt('trigger_at', endIso)
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
  ])

  for (const res of [visitsRes, remindersRes, offersRes, leadsRes]) {
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

  const reminders: BriefReminder[] = ((remindersRes.data ?? []) as unknown as Array<{
    type: string; contact: NameRow
  }>).map((r) => ({ type: r.type, who: contactName(r.contact) }))

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

  return { visits, reminders, offers, sellerLeads }
}
