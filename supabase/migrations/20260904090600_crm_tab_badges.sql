-- Compteurs de badge des onglets du CRM, par section.
--
-- ── POURQUOI UN AGRÉGAT, ALORS QU'UNE DÉCISION ÉCRITE LES REFUSE ─────────────
-- `useTodayH.ts` refuse par écrit (3 août 2026) un `today_payload` monolithique :
-- « un agrégat unique dupliquerait les RPC gatées, concentrerait la page sur une
-- requête lourde et ferait tomber tout l'écran si un seul bloc échoue ». Cette
-- fonction-ci va dans l'autre sens, et les trois motifs ne s'appliquent pas :
--
--   1. Elle ne rend que des ENTIERS — pas de lignes, pas de jointure large.
--      Il n'y a rien à « dupliquer » d'une RPC de page.
--   2. Le chrome du CRM se REMONTE À CHAQUE NAVIGATION (la barre est rendue par
--      chacune des vingt surfaces). Composer section par section coûterait
--      quatre allers-retours par écran visité ; ici c'en est un.
--   3. Son échec est BÉNIN : pas de badge. Un `today_payload` en échec vide
--      l'écran ; un badge absent ne se remarque pas. C'est exactement l'inverse
--      du risque que la décision d'août visait.
--
-- ── LE ROUGE EST UN VERDICT SERVEUR, PAS UN SEUIL ────────────────────────────
-- Le handoff de design est explicite : « Le rouge n'est pas un seuil de comptage
-- […] c'est un verdict métier, il doit venir du serveur — jamais d'un `n > 5`
-- écrit côté client. » Les deux verdicts existaient déjà en SQL et sont repris
-- À L'IDENTIQUE plutôt que réécrits :
--   • rappels en retard  — la clause `late` de `today_absence()` :
--     `status in ('pending','triggered') and trigger_at <= now()`, évaluée en SQL
--     à la demande. ⚠ Et NON `status = 'triggered'`, qui est posé par un cron
--     HORAIRE et accuserait donc jusqu'à 60 min de retard.
--   • KYC urgent — la clause `urgent` d'`analytics_cockpit()` :
--     `risk_level = 'high' and expires_at <= now() + interval '7 days'`.
--
-- ── CE QUI N'A PAS DE BADGE, ET POURQUOI C'EST ÉCRIT ─────────────────────────
-- Six des dix sections n'ont AUCUN compteur naturel : contacts, biens, parcours,
-- analytics, réglages, aujourd'hui. Leur en inventer un demanderait de définir un
-- « à traiter » qui n'existe nulle part dans le produit. Elles ne sont donc pas
-- dans le résultat, et la barre n'affiche rien pour elles — un badge à zéro est
-- masqué de toute façon.
begin;

create or replace function public.crm_tab_badges()
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_agency uuid := public.get_user_agency_id();
  v_kyc    int := 0;
  v_kyc_u  int := 0;
  v_rappel int := 0;
  v_late   int := 0;
  v_visite int := 0;
  v_match  int := 0;
  v_deal   int := 0;
begin
  -- ⚠ Un super-admin n'a pas d'agence (`agency_id` NULL) : la lecture rendrait
  -- alors la donnée de TOUTES les agences, ou rien selon la RLS. On sort tôt avec
  -- un objet vide plutôt que d'afficher un compte qui ne veut rien dire.
  if v_agency is null then
    return '{}'::jsonb;
  end if;

  -- KYC : dossiers qui attendent un geste humain.
  -- ⚠ `<> 'verified'` et non une liste de statuts inventée : c'est la définition
  -- que le produit applique déjà (`useKycVigie.ts:143` — tout ce qui n'est pas
  -- vérifié est à traiter, `none` compris). Mesuré le 04.09.2026, la colonne est
  -- du TEXTE et ne porte que 'none', 'pending', 'verified' : une liste en dur
  -- aurait raté 'none', c'est-à-dire les dossiers jamais ouverts.
  select count(*) filter (where dossier_status is distinct from 'verified'),
         count(*) filter (where risk_level = 'high'
                            and expires_at is not null
                            and expires_at <= now() + interval '7 days')
    into v_kyc, v_kyc_u
    from public.kyc_cases
   where agency_id = v_agency;

  -- Calendrier : rappels dus aujourd'hui, et ceux DÉJÀ en retard (le rouge).
  select count(*) filter (where trigger_at::date <= current_date),
         count(*) filter (where trigger_at <= now())
    into v_rappel, v_late
    from public.reminders
   where agency_id = v_agency
     and status in ('pending', 'triggered')
     and trigger_at is not null;

  -- Visites du jour — elles s'ajoutent aux rappels sur la même puce.
  select count(*)
    into v_visite
    from public.visits
   where agency_id = v_agency
     and scheduled_at is not null
     and scheduled_at::date = current_date
     -- Valeurs relevées dans `useCalendarScreen.ts:106-107` : la colonne est du
     -- texte libre, et 'no_show' compte comme terminé au même titre que 'done'.
     and coalesce(status, '') not in ('cancelled', 'done', 'no_show');

  -- Matching : suggestions NON VUES.
  -- ⛔ Pas le compte brut de `status = 'suggested'` : mesuré le 04.09.2026, il
  -- vaut 1 570 pour l'unique agence peuplée. Une puce qui affiche « 99+ » en
  -- permanence n'informe de rien. On compte ce qui est réellement à regarder.
  select count(*)
    into v_match
    from public.matches
   where agency_id = v_agency
     and status = 'suggested'
     and score >= 80;

  -- Pipeline : affaires dont l'action suivante est échue.
  select count(distinct t.id)
    into v_deal
    from public.transactions t
    join public.reminders r on r.transaction_id = t.id
   where t.agency_id = v_agency
     and t.archived_at is null
     and t.status <> 'completed'
     and r.status in ('pending', 'triggered')
     and r.trigger_at is not null
     and r.trigger_at <= now();

  return jsonb_strip_nulls(jsonb_build_object(
    'kyc',      case when v_kyc    > 0 then jsonb_build_object('n', v_kyc,    'urgent', v_kyc_u > 0) end,
    'calendar', case when (v_rappel + v_visite) > 0
                     then jsonb_build_object('n', v_rappel + v_visite, 'urgent', v_late > 0) end,
    'matching', case when v_match  > 0 then jsonb_build_object('n', v_match,  'urgent', false) end,
    'pipeline', case when v_deal   > 0 then jsonb_build_object('n', v_deal,   'urgent', true) end
  ));
end;
$$;

comment on function public.crm_tab_badges() is
  'Compteurs de badge des onglets du CRM, par section (kyc, calendar, matching, '
  'pipeline). Rend {section: {n, urgent}} ; une section absente = pas de badge. '
  'Le drapeau `urgent` est un VERDICT SERVEUR (rappel echu, KYC haut risque '
  'expirant sous 7 jours), jamais un seuil de comptage cote client. Rend {} pour '
  'un utilisateur sans agence (super-admin).';

revoke all on function public.crm_tab_badges() from public, anon;
grant execute on function public.crm_tab_badges() to authenticated;

commit;
