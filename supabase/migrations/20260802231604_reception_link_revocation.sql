-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Retirer un lien de réception acheteur : un statut pour le dire, une garde pour le tenir.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- `buyer_reception_links` (20260707120000) porte un jeton HMAC transmis par WhatsApp, valable
-- jusqu'à 90 jours (buyer-reception-create). Ce jeton ouvre la sélection de biens, le prénom
-- du contact et les coordonnées de l'agent. Jusqu'ici il ne pouvait PAS être retiré, pour
-- trois raisons qui se tenaient l'une l'autre :
--
-- 1. le CHECK de statut n'admettait que pending|viewed|reacted|expired — aucune valeur ne
--    disait « coupé par l'agent » ;
-- 2. la table ne porte qu'une policy, `brl_agent_read` (SELECT) : un agent authentifié ne
--    peut rien écrire dessus, donc aucun geste produit ne pouvait exister sans une RPC ;
-- 3. et surtout `record_buyer_reaction` finissait par `UPDATE buyer_reception_links SET
--    status = 'reacted'` SANS AUCUNE CONDITION. Le seul recours existant — passer le statut
--    à 'expired' à la main en SQL — ne survivait donc pas au premier POST de l'acheteur : sa
--    réaction remettait le lien en 'reacted', et la lecture rouvrait. Le retrait n'était pas
--    seulement absent de l'outil, il était RÉVERSIBLE par le destinataire du lien.
--
-- L'edge `buyer-reception-react` refuse déjà un lien 'expired' avant d'appeler la RPC, mais
-- une garde d'edge ne couvre que le chemin qui la traverse : la fonction reste appelable par
-- tout porteur du service_role. La borne doit vivre en base, dans la fonction elle-même.

-- ── (1) Un statut de retrait, distinct de la péremption ────────────────────────────────
-- 'expired' décrit la fin naturelle d'une durée de vie ; le retrait est un GESTE d'agent,
-- daté et attribuable, généralement posé après une fuite. Les confondre rendrait le registre
-- illisible : en relisant une ligne on ne saurait plus dire si le lien est arrivé à terme ou
-- s'il a été coupé — exactement la distinction dont on a besoin le jour d'un incident.
--
-- Le CHECK se remplace (drop + add) plutôt que de s'ajouter : c'est ce qui rend l'ensemble
-- rejouable le jour même par deploy.yml.
alter table public.buyer_reception_links
  drop constraint if exists buyer_reception_links_status_check;
alter table public.buyer_reception_links
  add constraint buyer_reception_links_status_check
  check (status in ('pending', 'viewed', 'reacted', 'expired', 'revoked'));

-- Horodatage sur la ligne, pas seulement dans le journal : « depuis quand ce lien est-il
-- coupé ? » est une question qu'on pose à la table, dans la même requête que le statut.
alter table public.buyer_reception_links
  add column if not exists revoked_at timestamptz;

comment on column public.buyer_reception_links.revoked_at is
  'Date du retrait par l''agent (revoke_reception_link). Distinct de expires_at, qui borne la durée de vie naturelle du lien.';

-- ── (2) record_buyer_reaction — le retrait ne doit plus être effaçable par l'acheteur ──
-- Corps reproduit à l'identique (casse d'origine comprise) pour que le delta se lise seul :
-- seules deux choses changent, le `status` lu en tête et la clause WHERE de l'UPDATE final.
--
-- (a) Refus des DEUX statuts terminaux, 'revoked' ET 'expired'. Ne refuser que 'revoked'
--     laissait passer un lien coupé par le seul recours antérieur (poser 'expired' à la
--     main alors qu'`expires_at` court encore) : les gardes tombaient, et l'UPDATE sur
--     `matches` s'exécutait — bascule du statut et texte libre du porteur écrits. Seule la
--     ligne du lien était épargnée, c'est-à-dire pas l'écriture que le retrait existe pour
--     empêcher.
--
-- (b) `FOR UPDATE` sur la lecture d'ouverture. Sans verrou, un retrait concurrent était
--     constaté TROP TARD : la réaction lisait 'viewed', le retrait committait, puis la
--     réaction écrivait quand même dans `matches` avant de voir son UPDATE final ne toucher
--     aucune ligne. Le retrait tenait sur le lien, le dommage passait à côté. Le verrou
--     sérialise les deux gestes, quel que soit leur ordre d'arrivée.
--
-- (c) La condition sur l'UPDATE final reste, en dernier rempart : elle garantit qu'aucun
--     chemin ne repose un statut vivant sur un lien terminal.
CREATE OR REPLACE FUNCTION public.record_buyer_reaction(
  p_link_id  uuid,
  p_match_id uuid,
  p_reaction text,
  p_motif    text DEFAULT NULL,
  p_note     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contact uuid;
  v_expires timestamptz;
  v_matches uuid[];
  v_status  text;
BEGIN
  SELECT contact_id, expires_at, match_ids, status
    INTO v_contact, v_expires, v_matches, v_status
  FROM public.buyer_reception_links
  WHERE id = p_link_id
  FOR UPDATE;

  IF v_contact IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_status = 'revoked' THEN RAISE EXCEPTION 'link_revoked'; END IF;
  -- 'expired' lève `link_expired`, comme une échéance dépassée : c'est le même état pour
  -- l'appelant, et le distinguer n'apprendrait rien d'utile à qui porte le jeton.
  IF v_status = 'expired' OR v_expires < now() THEN RAISE EXCEPTION 'link_expired'; END IF;
  IF NOT (p_match_id = ANY (v_matches)) THEN RAISE EXCEPTION 'match_not_in_selection'; END IF;
  IF p_reaction NOT IN ('interested', 'rejected') THEN RAISE EXCEPTION 'bad_reaction'; END IF;

  -- Attribution : réaction de l'acheteur via le portail réception (pas l'agent).
  PERFORM set_config('app.actor_kind', 'system', true);
  PERFORM set_config('app.actor_via', 'reception', true);

  -- L'acheteur ne peut basculer QUE parmi ses états de réception (sent/interested/
  -- rejected). Si l'agent a déjà fait avancer le match (visit_planned…), un lien
  -- encore valide ne doit PAS régresser cet état → la garde de statut l'en empêche.
  UPDATE public.matches
     SET status         = p_reaction,
         reaction_motif = CASE WHEN p_reaction = 'rejected' THEN NULLIF(btrim(p_motif), '') ELSE NULL END,
         reaction_note  = CASE WHEN p_reaction = 'rejected' THEN NULLIF(btrim(p_note), '')  ELSE NULL END
   WHERE id = p_match_id
     AND contact_id = v_contact                          -- garde tenant : le match appartient au contact du lien
     AND status IN ('sent', 'interested', 'rejected');   -- garde anti-régression : préserve un état avancé par l'agent

  UPDATE public.buyer_reception_links
     SET status = 'reacted', reacted_at = now(), updated_at = now()
   WHERE id = p_link_id
     AND status NOT IN ('revoked', 'expired');           -- ne ressuscite jamais un lien coupé (voir (b) ci-dessus)
END;
$function$;

-- Les GRANT de record_buyer_reaction ne sont pas réémis : CREATE OR REPLACE conserve les
-- privilèges de la fonction remplacée, et elle doit rester réservée au service_role (posé en
-- 20260707120000). Ne pas « rattraper » cette absence — elle est voulue.

-- ── (3) revoke_reception_link — le geste de l'agent ────────────────────────────────────
-- L'agent ne peut pas écrire directement sur la table (aucune policy UPDATE, et lui en poser
-- une ouvrirait aussi la réécriture du jeton, du statut ou de la sélection). Une RPC étroite
-- expose donc le seul geste légitime.
--
-- La garde d'appartenance est DANS la fonction, et ce n'est pas décoratif : SECURITY DEFINER
-- s'exécute avec les droits du propriétaire, la RLS de la table ne s'applique donc pas ici.
-- Sans cette comparaison, la fonction serait un contournement pur et simple de
-- `brl_agent_read` — tout compte authentifié couperait le lien d'une autre agence en
-- connaissant seulement son id. Ce dépôt a déjà rencontré ce piège.
--
-- Retour booléen plutôt qu'exception : le geste est idempotent côté appelant (un second clic,
-- un lien déjà retiré, un id inconnu rendent `false` sans rien casser). `false` ne distingue
-- pas « inconnu » de « hors agence » — les séparer n'aiderait que celui qui sonde.
create or replace function public.revoke_reception_link(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_link   public.buyer_reception_links%rowtype;
  v_agency uuid;
  v_label  text;
begin
  if p_link_id is null then return false; end if;

  select agency_id into v_agency from public.profiles where id = auth.uid();
  if v_agency is null then return false; end if;

  -- `for update` : deux clics simultanés ne doivent produire ni deux transitions ni deux
  -- lignes de journal (activity_events est append-only et conservé dix ans).
  select * into v_link from public.buyer_reception_links where id = p_link_id for update;
  if not found then return false; end if;
  if v_link.agency_id <> v_agency then return false; end if;
  -- Les deux statuts terminaux rendent `false`, pas seulement 'revoked' : « retirer » un
  -- lien déjà mort n'écrit rien d'utile, mais inscrirait dans un registre append-only
  -- conservé dix ans une ligne `severity='warn'` laissant croire à une coupure d'accès qui
  -- n'a jamais eu lieu. Un journal de sécurité ne doit pas raconter de gestes vides.
  if v_link.status in ('revoked', 'expired') then return false; end if;

  update public.buyer_reception_links
     set status = 'revoked', revoked_at = now(), updated_at = now()
   where id = v_link.id;

  select btrim(c.first_name || ' ' || c.last_name) into v_label
    from public.contacts c
   where c.id = v_link.contact_id;

  -- severity 'warn' : un retrait est un geste de sécurité, il doit se voir dans le registre
  -- sans être cherché. actor_kind 'user' AVEC actor_id : l'agent est identifié, et
  -- `activity_events_actor_kind_coherence` n'admet un actor_id que dans ce cas.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v_link.agency_id, auth.uid(), 'user', 'reception_link_revoked', 'contact', v_link.contact_id,
    'deal', 'warn', coalesce(nullif(v_label, ''), 'Contact'),
    jsonb_build_object(
      'link_id', v_link.id,
      'previous_status', v_link.status,
      -- Un timestamptz nu dans un jsonb se rend selon le fuseau de la session : deux agents
      -- journaliseraient la même donnée différemment. Normalisé en UTC.
      'expires_at', to_char(v_link.expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'items', coalesce(array_length(v_link.match_ids, 1), 0)));

  return true;
end $function$;

-- `anon` est nommé en plus de PUBLIC : au rejeu, la fonction existe déjà et conserve ses
-- privilèges — un grant posé entre-temps ne serait pas retiré par le seul REVOKE sur PUBLIC.
revoke all on function public.revoke_reception_link(uuid) from public, anon;
grant execute on function public.revoke_reception_link(uuid) to authenticated;

comment on function public.revoke_reception_link(uuid) is
  'Retire un lien de réception acheteur (status=revoked, revoked_at) et journalise le geste (activity_events, action=reception_link_revoked, severity=warn). Vérifie elle-même que l''appelant appartient à l''agence du lien — SECURITY DEFINER, la RLS de buyer_reception_links ne s''applique pas. Rend false sans lever si le lien est introuvable, hors agence, ou déjà retiré.';
