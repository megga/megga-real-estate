-- =====================================================================
-- WhatsApp — combien de messages part chaque mois, et ce que Meta en facture
--
-- ⛔ POURQUOI MAINTENANT. Meta facture les réponses de service à partir du
-- 01.10.2026 (« Effective October 1, 2026, Meta will charge on a per-message basis
-- for service messages », page officielle « Pricing for non-template messages »).
-- Or c'est presque tout le trafic MEGGA : l'agent écrit, le copilote répond, et
-- cette réponse était gratuite. Rien ne comptait ces messages par agence et par mois :
-- `whatsapp_messages` gardait le statut de livraison, pas ce qu'il coûte.
--
-- Deux faits par sortant, écrits par ceux qui les CONNAISSENT :
--   · `audience` — à qui il part (l'agent, donc MEGGA AI ; ou un client). Écrite par
--     la garde d'envoi (`sendOutboundGuarded`), SEUL chemin sortant du dépôt (porte CI
--     `lint:whatsapp-outbound`), depuis le sujet que le registre a DÉRIVÉ — jamais
--     depuis ce que l'appelant a déclaré.
--   · `meta_billable` / `meta_category` / `meta_pricing_type` — ce que Meta FACTURE,
--     lu dans l'objet `pricing` de ses statuts (`whatsapp-webhook`). C'est SON
--     classement qui fait foi : il facture le point du jour en marketing.
--
-- Un message est FACTURÉ s'il est `meta_billable` ET livré (`delivered` ou `read`) :
-- Meta ne facture qu'à la livraison, et un `sent` peut encore échouer.
--
-- ⚠ Mois UTC, comme la dotation des crédits (`credits_wallet_ensure`) : le quota qui
-- s'appuiera un jour sur ce compteur basculera au même instant qu'elle.
-- =====================================================================

-- ── 1. Les colonnes ──────────────────────────────────────────────────────────
alter table public.whatsapp_messages
  add column if not exists audience          text,
  add column if not exists meta_billable     boolean,
  add column if not exists meta_category     text,
  add column if not exists meta_pricing_type text;

-- `audience` est NOTRE vocabulaire, donc fermé. Les colonnes Meta ne le sont PAS : Meta
-- ne publie pas la liste close de ses catégories, et un CHECK ferait échouer l'écriture
-- du statut le jour où il en ajoute une.
do $$
begin
  alter table public.whatsapp_messages
    add constraint whatsapp_messages_audience_check check (audience in ('agent', 'client'));
exception when duplicate_object then null;
end $$;

comment on column public.whatsapp_messages.audience is
  'Sortant seulement : agent (échange avec MEGGA AI) ou client. Dérivé par whatsapp_send_allowed au moment de l''envoi.';
comment on column public.whatsapp_messages.meta_billable is
  'Objet pricing des statuts Meta. Facturé = meta_billable ET status livré (delivered/read).';
comment on column public.whatsapp_messages.meta_category is
  'Catégorie FACTURÉE par Meta (marketing, utility, authentication, service…). Texte libre : liste non fermée.';
comment on column public.whatsapp_messages.meta_pricing_type is
  'regular (facturé), free_customer_service, free_entry_point… Texte libre.';

-- ── 2. L'historique ──────────────────────────────────────────────────────────
-- Les sortants antérieurs n'ont pas d'audience. On la reconstitue par le NUMÉRO, agent
-- d'abord — la RPC ferait l'inverse sans profil déclaré, et classerait `contact` un agent
-- qui a aussi une fiche (le seul agent vérifié était dans ce cas, 10.09.2026).
-- ⚠ Le lien lu est celui d'AUJOURD'HUI, pas celui du jour de l'envoi : un numéro délié
-- depuis serait compté client. Ce n'est pas théorique — le lien de l'unique agent a été
-- vidé le 17.08.2026 puis rétabli (cerveau `megga/whatsapp-agent-link-audit`) —, mais
-- c'est sans effet ici : mesuré le 21.09.2026, les 138 sortants de toute l'histoire (du
-- 02.06 au 21.09) sont partis vers ce même numéro, et AUCUN vers un client.
-- Idempotent : `audience is null` ne matche plus rien au second passage.
update public.whatsapp_messages m
   set audience = case
         when exists (select 1 from public.whatsapp_agent_links l
                       where l.verified
                         and public.normalize_phone(l.wa_number) = public.normalize_phone(m.wa_to))
         then 'agent' else 'client' end
 where m.direction = 'outbound' and m.audience is null;

-- ── 3. L'index ───────────────────────────────────────────────────────────────
-- La vue d'une agence passe par `idx_whatsapp_messages_agency_created`, qui existe déjà.
-- Celle de la console balaie TOUTES les agences sur une plage de mois.
create index if not exists idx_wa_messages_outbound_created
  on public.whatsapp_messages (created_at desc)
  where direction = 'outbound';

-- ── 4. Le compteur d'une agence ──────────────────────────────────────────────
-- Des COMPTES, jamais un contenu : l'échange d'un agent avec son copilote est à lui, son
-- volume regarde l'agence. `p_month` = 'YYYY-MM' (UTC) ; toute autre forme vaut le mois
-- courant plutôt qu'une erreur.
-- ⛔ AUCUNE colonne `meta_*` ici. Ce que Meta facture, et dans quelle catégorie, c'est la
-- structure de coût de MEGGA : l'agence ne paie pas Meta, elle paie MEGGA. Même règle que
-- les crédits (`credits-confidentialite.spec.ts`) — le fournisseur reste côté console, et
-- `whatsapp-usage.spec.ts` le vérifie sur le corps de cette fonction.
create or replace function public.whatsapp_usage_month(p_month text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_agency uuid := public.get_my_agency_id();
  v_mois   text := case when p_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then p_month
                        else to_char(now() at time zone 'utc', 'YYYY-MM') end;
  v_debut  timestamptz := ((v_mois || '-01')::date)::timestamp at time zone 'utc';
  v_fin    timestamptz := (((v_mois || '-01')::date + interval '1 month'))::timestamp at time zone 'utc';
  v_out    jsonb;
begin
  if v_agency is null then
    return jsonb_build_object('month', v_mois, 'agent', 0, 'client', 0, 'unclassified', 0);
  end if;

  select jsonb_build_object(
           'month',        v_mois,
           'agent',        count(*) filter (where m.audience = 'agent'),
           'client',       count(*) filter (where m.audience = 'client'),
           'unclassified', count(*) filter (where m.audience is null))
    into v_out
    from public.whatsapp_messages m
   where m.agency_id = v_agency and m.direction = 'outbound'
     and m.created_at >= v_debut and m.created_at < v_fin;

  return v_out;
end $$;

revoke all on function public.whatsapp_usage_month(text) from public, anon;
grant execute on function public.whatsapp_usage_month(text) to authenticated;

-- ── 5. La console : toutes les agences, mois par mois ────────────────────────
-- Même garde que les RPC de santé de la console (`get_admin_ai_costs`) : super-admin, ou
-- service_role pour l'alerting. `agency_id` NULL = envoi sans agence (accusé STOP d'un
-- numéro inconnu…) ; le libellé se pose à l'écran, traduit.
create or replace function public.get_admin_whatsapp_usage(p_months integer default 3)
returns table (
  month           text,
  agency_id       uuid,
  agency_name     text,
  agent_messages  bigint,
  client_messages bigint,
  delivered       bigint,
  billable        bigint,
  by_category     jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_depuis timestamptz := (date_trunc('month', now() at time zone 'utc') at time zone 'utc')
                          - make_interval(months => greatest(0, least(coalesce(p_months, 3), 12) - 1));
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  with base as (
    select to_char(m.created_at at time zone 'utc', 'YYYY-MM') as mois,
           m.agency_id as agence, m.audience, m.status, m.meta_billable, m.meta_category
      from public.whatsapp_messages m
     where m.direction = 'outbound' and m.created_at >= v_depuis
  ), cats as (
    select k.mois, k.agence, jsonb_object_agg(k.meta_category, k.n) as par_cat
      from (select b.mois, b.agence, b.meta_category, count(*) as n
              from base b
             where b.meta_category is not null and b.status in ('delivered', 'read')
             group by 1, 2, 3) k
     group by 1, 2
  )
  select b.mois, b.agence, a.name,
         count(*) filter (where b.audience = 'agent'),
         count(*) filter (where b.audience = 'client'),
         count(*) filter (where b.status in ('delivered', 'read')),
         count(*) filter (where b.meta_billable and b.status in ('delivered', 'read')),
         coalesce(c.par_cat, '{}'::jsonb)
    from base b
    left join public.agencies a on a.id = b.agence
    left join cats c on c.mois = b.mois and c.agence is not distinct from b.agence
   group by b.mois, b.agence, a.name, c.par_cat
   order by b.mois desc, count(*) desc;
end $$;

revoke all on function public.get_admin_whatsapp_usage(integer) from public, anon;
grant execute on function public.get_admin_whatsapp_usage(integer) to authenticated, service_role;
