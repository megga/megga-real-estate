-- Audit DB du 18.07.2026 — P2 purge des tables mortes (vestiges marketplace,
-- prototypes abandonnés, features remplacées).
-- Preuves relevées à l'audit : 0 référence code (src + edge, hors types
-- générés), 0 fonction SQL avec DML dessus (pg_proc, motifs from/join/update/
-- into strictes), 0 FK entrante externe au lot, 0-1 ligne de données chacune.
-- Zombies inclus après retrait du code ce jour : listings (insert de
-- ListingFormPage retiré — il était de toute façon bloqué par le RLS deny-all
-- de la table), saved_searches (chaîne cron → run_search_alerts → edge
-- search-alert coupée ci-dessous, edge fn retirée du repo), messages/
-- message_threads (feature Messages retirée du CRM agent), offers (remplacée
-- par crm_offers), favorites (pointait sur listings).

-- Chaîne search-alerts (alertes marketplace) : cron + fonction SQL.
-- Guard pg_cron : planifié en prod, absent en local/CI.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from cron.job where jobname = 'search-alerts-30min') then
    perform cron.unschedule('search-alerts-30min');
  end if;
end $$;
drop function if exists public.run_search_alerts();

-- Un seul DROP sans CASCADE, volontairement : échoue si une dépendance
-- externe imprévue existait encore. Les FK internes au lot (favorites →
-- listings, messages → message_threads, chat_messages → chat_conversations)
-- sont résolues par le drop groupé.
drop table if exists
  public.agent_reviews,
  public.chat_messages,
  public.chat_conversations,
  public.coming_soon_subscribers,
  public.daily_actions,
  public.email_messages_cache,
  public.external_listings,
  public.favorites,
  public.gmail_tokens,
  public.listing_reports,
  public.market_changes,
  public.market_favorites,
  public.market_hidden,
  public.marketplace_inquiries,
  public.newsletter_subscribers,
  public.outlook_mail_tokens,
  public.ticket_canned_responses,
  public.ticket_events,
  public.ticket_messages,
  public.user_profile_meta,
  public.vendor_dossiers,
  public.offers,
  public.listings,
  public.messages,
  public.message_threads,
  public.saved_searches;

-- Trigger function du couple messages/message_threads — après le drop des
-- tables (le trigger qui en dépendait est tombé avec elles).
drop function if exists public.update_thread_on_new_message();

-- Enums rendus orphelins par la chute de listing_reports.
drop type if exists public.listing_report_reason;
drop type if exists public.listing_report_status;
