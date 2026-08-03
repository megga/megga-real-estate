-- Le relecteur cesse d'avoir a penser a regarder.
--
-- POURQUOI. Audit d'onboarding du 01.08.2026 : aucun dossier, d'aucun pays, ne peut
-- s'auto-valider (le veto `id_document` n'accepte que 'match' et aucun connecteur ne le
-- produit). Le passage humain est le chemin UNIQUE, et rien n'allait chercher l'humain :
-- la file ne se decouvrait qu'en ouvrant sa page.
--
-- CE QUE CE N'EST PAS. Pas une alerte par dossier -- elle se ferait filtrer. Un point par
-- jour, qui ne part QUE s'il y a quelque chose a dire (l'edge function s'arrete d'elle-meme
-- sur une file vide).
--
-- POURQUOI UNE RPC DE CHARGE UTILE plutot que des lectures directes depuis l'edge function :
-- la liste des destinataires vit deja en base (super_admin_allowlist()), la file aussi. Une
-- seule RPC les rend ensemble, sous une seule garde, et le jour ou l'allowlist change, le
-- digest suit sans redeploiement.
--
-- Idempotente : create or replace, cron.unschedule garde par un bloc exception.

begin;

create or replace function public.kyb_review_digest_payload()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_dossiers jsonb;
  v_total    int;
begin
  -- service_role SEUL : un cron appelle ceci, jamais un navigateur. Pas de branche
  -- is_super_admin() -- la console a deja get_admin_agency_review_queue pour le meme besoin,
  -- et deux portes sur la meme donnee sont deux portes a garder d'accord.
  if not public.is_service_role() then
    raise exception 'forbidden: service_role only' using errcode = '42501';
  end if;

  -- Total AVANT plafonnement (correctif de revue) : sans lui, une file tronquee est
  -- indiscernable d'une file terminee -- meme raison que total_count sur
  -- get_admin_agency_review_queue (20260729160000). Predicat DUPLIQUE volontairement
  -- de celui de la sous-requete ci-dessous : les deux doivent bouger ENSEMBLE.
  select count(*) into v_total
    from public.agencies a
   where a.verification_status = 'manual_review'
     and a.identity_submitted_at is not null;

  -- PLAFOND a 50 (correctif de revue), les plus anciens d'abord -- meme ordre qu'avant
  -- ce correctif, et meme motif que le plafond de get_admin_agency_review_queue : vers
  -- 250 dossiers le HTML rendu depasse le seuil de rognage de Gmail (102 Ko), et comme
  -- le CTA est desormais rendu AVANT le tableau (buildReviewDigest), c'est la ligne
  -- « et N autres » sous le tableau qui disparaitrait la premiere -- jamais le bouton
  -- d'action. order by DANS la sous-requete (pas seulement dans jsonb_agg) : LIMIT doit
  -- s'appliquer aux 50 dossiers les plus anciens, pas a 50 lignes prises au hasard puis
  -- triees.
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'agency_id',    d.id,
               'agency_name',  d.agency_name,
               'country',      d.country,
               'score',        d.score,
               'submitted_at', d.submitted_at,
               'age_days',     d.age_days
             )
             order by d.submitted_at
           ),
           '[]'::jsonb)
    into v_dossiers
    from (
      select
        a.id,
        coalesce(nullif(btrim(a.legal_name), ''), a.name) as agency_name,
        a.country,
        a.verification_score as score,
        a.identity_submitted_at as submitted_at,
        -- Jours PLEINS ecoules. floor et non round : un dossier de 30 heures se dit
        -- « depuis 1 jour », jamais « depuis 2 ».
        floor(extract(epoch from (now() - a.identity_submitted_at)) / 86400)::int as age_days
      from public.agencies a
      where a.verification_status = 'manual_review'
        and a.identity_submitted_at is not null
      order by a.identity_submitted_at
      limit 50
    ) d;

  return jsonb_build_object(
    'recipients', to_jsonb(public.super_admin_allowlist()),
    'dossiers',   v_dossiers,
    'total',      v_total
  );
end;
$$;

comment on function public.kyb_review_digest_payload() is
  'Charge utile du digest quotidien de revue KYB (01.08.2026) : les agences en verification_status=''manual_review'' avec leur ancienneté en jours pleins, et les destinataires lus dans super_admin_allowlist() -- une seule liste, jamais une seconde à tenir à jour. PLAFONNEE a 50 dossiers (correctif de revue, meme motif que get_admin_agency_review_queue) -- les plus anciens d''abord -- avec un champ total = le compte REEL avant plafonnement, pour qu''une file tronquee reste distinguable d''une file terminee. Rend toujours un tableau (vide si rien n''attend) : c''est l''edge function qui décide de ne pas envoyer. service_role uniquement.';

revoke all on function public.kyb_review_digest_payload() from public, anon, authenticated;
grant execute on function public.kyb_review_digest_payload() to service_role;

-- ─── Le dispatch, meme patron que sweep_pending_agency_verifications ────────────────
create or replace function public.dispatch_kyb_review_digest()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base_url text := public.get_app_config('supabase_url');
  v_svc_key  text := public.get_app_config('service_role_key');
begin
  -- Environnement non configure (local/CI sans app_config seede) -> no-op silencieux plutot
  -- qu'une violation NOT NULL sur http_request_queue.url. Meme garde que le filet horaire.
  if v_base_url is null or v_base_url = '' or v_svc_key is null or v_svc_key = '' then
    return;
  end if;

  -- Aucun filtre sur la file ICI : l'edge function lit la charge utile et s'arrete si elle
  -- est vide. Un second endroit qui deciderait « y a-t-il quelque chose a dire » serait un
  -- second endroit a tenir d'accord avec le premier.
  begin
    perform net.http_post(
      url := v_base_url || '/functions/v1/kyb-review-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_svc_key
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  exception when others then
    raise warning 'dispatch_kyb_review_digest: dispatch echoue: %', sqlerrm;
  end;
end;
$$;

comment on function public.dispatch_kyb_review_digest() is
  'Déclenche l''edge function kyb-review-digest via net.http_post (best-effort, jamais bloquant). Planifiée une fois par jour à 08:00 UTC via cron.schedule si pg_cron est présent (absent en local/CI). service_role uniquement.';

revoke all on function public.dispatch_kyb_review_digest() from public, anon, authenticated;
grant execute on function public.dispatch_kyb_review_digest() to service_role;

commit;

-- ─── Planification (hors transaction, meme idiome que le filet horaire) ─────────────
do $$ begin perform cron.unschedule('kyb-review-digest-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- 08:00 UTC : le matin en Suisse (09h ou 10h selon la saison), avant la journee de
    -- travail plutot qu'au milieu.
    perform cron.schedule('kyb-review-digest-daily', '0 8 * * *',
      $cron$ select public.dispatch_kyb_review_digest(); $cron$);
  end if;
end $$;
