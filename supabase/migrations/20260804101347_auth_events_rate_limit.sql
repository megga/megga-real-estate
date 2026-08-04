-- Limitation de débit sur auth_events — ferme l'écriture anonyme non bornée.
--
-- CONSTAT (audit signatures webhooks du 03.08.2026, §4.1). `log-auth-event` est
-- publique et ne porte AUCUN contrôle : ni signature, ni jeton, ni clé. N'importe
-- qui insère des lignes arbitraires dans auth_events via service_role, donc
-- au-dessus de la RLS.
--
-- Ironie du dossier : la migration 20260719150000 a révoqué l'INSERT client sur
-- cette même table en décrivant exactement ce vecteur — « rouvrir une écriture
-- anon sur une table d'audit serait un vecteur de spam ». Le raisonnement était
-- juste ; la porte de service est simplement restée ouverte à côté, et elle
-- n'exige même pas la clé anon.
--
-- POURQUOI UNE LIMITE DE DÉBIT ET PAS UN SECRET. L'appelant légitime est le
-- navigateur AVANT authentification (`signin.failure` précède toute session).
-- Un secret expédié au navigateur pour signer cet appel est un secret public :
-- il déplacerait le problème sans le résoudre. La limite de débit est la seule
-- réponse honnête à un point d'entrée qui doit rester anonyme.
--
-- CE QUE ÇA NE FAIT PAS. Un attaquant réparti sur de nombreuses IP passe encore
-- — aucune limite par IP n'y peut quoi que ce soit. L'objectif n'est pas de
-- rendre la pollution impossible, mais BORNÉE et VISIBLE : 600 lignes/heure sous
-- un même ip_hash est un signal qui saute aux yeux dans la table, là où
-- aujourd'hui le volume est libre et indiscernable du trafic normal.

-- ── Index de support ────────────────────────────────────────────────────────
-- Le comptage filtre (ip_hash, created_at). Les trois index existants partent de
-- action / severity / user_id : aucun ne sert cette requête.
create index if not exists idx_auth_events_ip_hash_created_at
  on public.auth_events (ip_hash, created_at desc)
  where ip_hash is not null;

-- ── Compter puis insérer, en un seul aller ──────────────────────────────────
--
-- En une seule fonction plutôt qu'un COUNT suivi d'un INSERT côté edge, pour
-- deux raisons :
--   1. Pas de fenêtre entre la décision et l'écriture.
--   2. Un échec ne peut pas laisser le service « ouvert » : si l'appel casse,
--      l'insertion n'a pas eu lieu non plus. Il n'y a donc pas de choix
--      fail-open / fail-closed à arbitrer — contrairement à extract-lead, où le
--      COUNT est séparé et où l'échec est explicitement toléré.
--
-- SECURITY INVOKER (défaut) — DÉLIBÉRÉ. L'unique appelant est service_role, qui
-- contourne déjà la RLS : un SECURITY DEFINER n'ajouterait aucune capacité et
-- allongerait la liste des DEFINER exécutables recensée par les advisors.
-- `search_path = ''` malgré tout : tout est qualifié en dur.
create or replace function public.log_auth_event_limited(
  p_ip_hash    text,
  p_action     text,
  p_severity   text,
  p_user_id    uuid    default null,
  p_user_agent text    default null,
  p_detail     text    default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Calibrage : une agence entière derrière un même NAT un lundi matin (~30
  -- agents qui se connectent dans la même minute) doit passer sans être vue
  -- comme une attaque. En régime normal un agent produit 2 à 6 événements par
  -- JOUR — la marge est donc de deux ordres de grandeur.
  c_burst_limit     constant integer := 60;   -- par minute
  c_sustained_limit constant integer := 600;  -- par heure
  v_burst     integer;
  v_sustained integer;
begin
  -- Un seul parcours de l'index sert les deux fenêtres.
  select
    count(*) filter (where created_at >= now() - interval '1 minute'),
    count(*)
  into v_burst, v_sustained
  from public.auth_events
  where ip_hash = p_ip_hash
    and created_at >= now() - interval '1 hour';

  -- Pas de verrou : deux requêtes simultanées peuvent toutes deux voir 599 et
  -- écrire. Dépasser de quelques lignes une limite de 600 n'a aucune portée ;
  -- sérialiser les écritures d'audit sur un verrou en aurait une.
  if v_burst >= c_burst_limit or v_sustained >= c_sustained_limit then
    return 'throttled';
  end if;

  insert into public.auth_events (user_id, action, severity, ip_hash, user_agent, detail)
  values (p_user_id, p_action, p_severity, p_ip_hash, p_user_agent, p_detail);

  return 'inserted';
end;
$$;

comment on function public.log_auth_event_limited(text, text, text, uuid, text, text) is
  'Insère un auth_event si l''ip_hash reste sous 60/minute et 600/heure ; rend '
  '''inserted'' ou ''throttled''. Appelée par l''edge function log-auth-event, '
  'qui est publique et non authentifiée (audit du 03.08.2026 §4.1).';

-- ── Grants ──────────────────────────────────────────────────────────────────
-- CREATE FUNCTION accorde EXECUTE à PUBLIC par défaut. Ne pas révoquer ici
-- rendrait la fonction appelable par anon et authenticated — c'est-à-dire
-- rouvrirait, en RPC, l'écriture d'audit que 20260719150000 a fermée en table.
revoke all on function public.log_auth_event_limited(text, text, text, uuid, text, text) from public;
revoke all on function public.log_auth_event_limited(text, text, text, uuid, text, text) from anon;
revoke all on function public.log_auth_event_limited(text, text, text, uuid, text, text) from authenticated;
grant execute on function public.log_auth_event_limited(text, text, text, uuid, text, text) to service_role;
