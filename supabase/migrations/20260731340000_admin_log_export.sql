-- Étape 22 du plan Console MEGGA — les exports journalisés (§5.4, §5.9).
--
-- ── CE QUI EXISTE, ET N'EST PAS REFAIT ───────────────────────────────────────────────
--   · `admin-dsar-export` (edge) — export DSAR nLPD art. 25 en JSON : profil,
--     consentements, appareils, événements d'auth, activité. Gardée par
--     require-super-admin, et journalisée AVANT de rendre la charge utile.
--   · `audit-pdf-export` (edge) — PDF des `activity_events` avec chaîne de hash SHA-256,
--     branche super-admin comprise.
--
-- Ces deux-là couvrent §5.4 (DSAR) et la piste d'audit MÉTIER. Ce qui manque, c'est
-- l'export du REGISTRE DE LA CONSOLE — `admin_log`, une autre table, celle des gestes de la
-- plateforme sur ses clients. `audit-pdf-export` n'y touche pas et n'a pas à y toucher :
-- `activity_events` raconte ce que font les AGENCES, `admin_log` ce que fait MEGGA.
--
-- ── L'EXPORT SE JOURNALISE LUI-MÊME (§5.9) ───────────────────────────────────────────
-- « `admin_log_export` PDF signé AUTO-JOURNALISÉ ». Un registre dont on peut tirer une
-- copie sans laisser de trace ne prouve plus rien sur qui l'a consulté. La ligne d'export
-- est donc écrite dans le registre lui-même — et APRÈS l'extraction, pour que l'empreinte
-- porte sur ce qui a été remis, pas sur un contenu qui se serait modifié en cours de route.
--
-- ── LA SIGNATURE ─────────────────────────────────────────────────────────────────────
-- Pas de chaîne à recalculer : `admin_log` STOCKE déjà la sienne (prev_hash/hash par
-- ligne). L'export rend donc (a) les lignes, (b) le verdict de `admin_log_verify_chain()`
-- sur la fenêtre exportée, (c) une empreinte de l'extrait. Le rendu PDF appartient à une
-- edge function — le SQL ne fabrique pas de PDF, comme il ne signe pas de HMAC (étape 19).

drop function if exists public.admin_log_export(timestamptz, timestamptz, text, text);
create or replace function public.admin_log_export(
  p_from            timestamptz,
  p_to              timestamptz,
  p_family          text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lignes    jsonb;
  v_n         integer;
  v_seq_min   bigint;
  v_seq_max   bigint;
  v_empreinte text;
  v_chaine    jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_from is null or p_to is null then
    return public.admin_error('precondition_failed', 'Indiquez la période à extraire.');
  end if;
  if p_from >= p_to then
    return public.admin_error('precondition_failed', 'La période est vide.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;
  if p_family is not null and not exists (
       select 1 from public.admin_log_family f where f.code = p_family) then
    return public.admin_error('precondition_failed', 'Famille inconnue : ' || p_family);
  end if;

  -- ── L'extrait, AVANT toute écriture ────────────────────────────────────────────
  -- L'empreinte doit porter sur ce qui est REMIS. Journaliser d'abord ferait entrer la
  -- ligne d'export dans son propre extrait selon la seconde où il tombe : le même appel
  -- rendrait deux empreintes différentes, et une empreinte non reproductible ne prouve rien.
  --
  -- L'extraction est en LECTURE SEULE : la faire avant de réserver la clé d'idempotence ne
  -- coûte rien et évite qu'un refus métier consomme la clé (voir plus bas).
  select count(*)::integer, min(l.seq), max(l.seq),
         coalesce(jsonb_agg(jsonb_build_object(
           'seq', l.seq, 'ts', l.ts, 'severity', l.severity, 'family', l.family,
           'action', l.action, 'entity_type', l.entity_type, 'entity_label', l.entity_label,
           'actor', l.actor_label, 'prev_hash', l.prev_hash, 'hash', l.hash)
           order by l.seq), '[]'::jsonb)
    into v_n, v_seq_min, v_seq_max, v_lignes
    from public.admin_log l
   where l.ts >= p_from and l.ts < p_to
     and (p_family is null or l.family = p_family);

  -- Borne haute : un extrait sans plafond finit par dépasser le statement timeout, et
  -- l'écran ne saurait pas si l'export a échoué ou si le registre est vide.
  if v_n > 5000 then
    return public.admin_error('too_many',
      'Cette période contient trop d''entrées. Restreignez-la.',
      jsonb_build_object('count', v_n));
  end if;

  -- ── La clé d'idempotence, prise SEULEMENT ICI ──────────────────────────────────
  -- Un extrait est un GESTE : il laisse une trace, donc un double-clic ne doit pas en
  -- laisser deux. Mais la réserver plus haut la faisait consommer par un refus métier
  -- (`too_many`), qui est un `return` : la transaction COMMITTE, le reçu reste, non scellé.
  -- Le réessai avec la même clé — ce à quoi sert une clé d'idempotence — répondait alors
  -- `already_done`, c'est-à-dire une forme de SUCCÈS pour un extrait jamais produit.
  -- Règle : on ne réserve la clé qu'une fois engagé à écrire.
  if not public.admin_receipt_try(p_idempotency_key, 'admin_log_export') then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  -- Empreinte de l'extrait. `sha256` de pg_catalog, jamais `digest()` de pgcrypto :
  -- celle-ci vit dans le schéma `extensions` et lèverait 42883 sous ce search_path.
  v_empreinte := encode(sha256(convert_to(v_lignes::text, 'UTF8')), 'hex');

  -- Verdict de chaîne sur la FENÊTRE exportée, pas sur tout le registre : la preuve doit
  -- porter sur ce qu'on remet, et vérifier dix ans d'historique à chaque extrait coûterait
  -- sans rien prouver de plus sur cette période.
  --
  -- ⚠ Il FAUT les deux bornes. Avec la seule borne basse, la marche courait jusqu'à la tête
  -- du registre : le coût croissait avec l'ÂGE de la fenêtre, et `rows_checked` décrivait
  -- des lignes absentes de l'extrait. Et sur une fenêtre valide mais VIDE, `min(seq)` vaut
  -- NULL — la borne basse disparaissait et l'appel relisait le registre ENTIER, précisément
  -- ce que le plafond de 5000 lignes existe pour éviter. Une fenêtre vide n'a pas de chaîne
  -- à vérifier : on rend le verdict directement.
  if v_n = 0 then
    v_chaine := jsonb_build_object('status', 'no_rows', 'rows_checked', 0, 'bounded', true);
  else
    v_chaine := public.admin_log_verify_chain(v_seq_min, v_seq_max);
  end if;

  -- ── L'auto-journalisation (§5.9) ───────────────────────────────────────────────
  perform public.admin_log_write(
    p_family => 'export', p_action => 'admin_log_export', p_severity => 'warn',
    p_entity_type => 'admin_log', p_entity_label => 'extrait du registre',
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Période', 'v',
        to_char(p_from at time zone 'Europe/Zurich', 'DD.MM.YYYY') || ' → ' ||
        to_char(p_to   at time zone 'Europe/Zurich', 'DD.MM.YYYY')),
      jsonb_build_object('l', 'Famille', 'v', coalesce(p_family, 'toutes')),
      jsonb_build_object('l', 'Entrées', 'v', v_n::text),
      jsonb_build_object('l', 'Empreinte', 'v', left(v_empreinte, 16))));

  perform public.admin_receipt_seal(p_idempotency_key,
    jsonb_build_object('digest', v_empreinte, 'count', v_n));

  return public.admin_ok(jsonb_build_object(
    'count', v_n,
    'from', p_from,
    'to', p_to,
    'family', p_family,
    'digest_sha256', v_empreinte,
    'chain', v_chaine,
    'entries', v_lignes));
end;
$function$;

comment on function public.admin_log_export(timestamptz, timestamptz, text, text) is
  'Extrait signé du registre console (§5.9), AUTO-JOURNALISÉ : un registre dont on tire une '
  'copie sans trace ne prouve plus rien sur qui l''a consulté. L''extraction précède la '
  'journalisation — sinon la ligne d''export entrerait dans son propre extrait selon la '
  'seconde où elle tombe, et la même demande rendrait deux empreintes différentes. La chaîne '
  'n''est pas recalculée : admin_log la STOCKE, on en rend le verdict sur la fenêtre '
  'exportée — BORNÉE aux deux bouts (correctif de revue : la seule borne basse faisait '
  'courir la marche jusqu''à la tête du registre, et une fenêtre vide la faisait repartir '
  'de la genèse). La clé d''idempotence n''est prise qu''une fois l''extrait retenu, pour '
  'qu''un refus `too_many` ne la consomme pas et ne transforme pas le réessai en faux '
  'succès. Le rendu PDF appartient à une edge function — le SQL ne fabrique pas de PDF, '
  'comme il ne signe pas de HMAC (étape 19). Distinct d''audit-pdf-export, qui exporte '
  'activity_events : celle-là raconte ce que font les AGENCES, celle-ci ce que fait MEGGA.';

revoke all on function public.admin_log_export(timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.admin_log_export(timestamptz, timestamptz, text, text) to authenticated, service_role;
