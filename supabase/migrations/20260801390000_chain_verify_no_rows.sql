-- Le contrôle horaire de la chaîne du registre criait « rupture » sur un registre VIDE.
--
-- MESURÉ EN PRODUCTION, pas déduit. `admin_log` porte 7 lignes de contrôle, dont exactement
-- une en `crit` : la PREMIÈRE, à 08:40, quand le registre était encore vide —
-- `{Statut: no_rows, Lignes relues: 0, Rupture: aucune}`. Les six suivantes sont `ok`.
-- La chaîne n'a jamais été rompue ; c'est le job qui a mal traduit.
--
-- LA CAUSE, en une ligne :
--     p_severity => case when v_result ->> 'status' = 'ok' then 'info' else 'crit' end
-- Tout ce qui n'est pas `ok` devient critique. Or `admin_log_verify_chain` rend TROIS
-- statuts, et le troisième est délibéré : « Une marche sur zéro ligne ne rencontre aucune
-- rupture : ne JAMAIS rendre 'ok' ». Cette prudence est juste côté vérificateur — elle
-- refuse d'affirmer ce qu'elle n'a pas vérifié. Le job, lui, l'a lue comme un aveu.
--
-- « Rien à vérifier » et « quelqu'un a touché au registre » ne sont pas le même événement.
-- Les confondre, c'est la mécanique d'une alerte qui part pour rien — et une alerte qui part
-- pour rien finit par n'être plus lue, ce qui coûte plus cher que de n'en avoir aucune.
--
-- CE QUI PERMET DE TRANCHER, et qui existait déjà : `admin_log_chain_head` est un singleton
-- qui retient `rows_count`, et `admin_log_verify_chain` le rend dans `head_row`. Donc :
--   · zéro ligne relue ET zéro ligne attendue  → registre NEUF, bénin ;
--   · zéro ligne relue mais des lignes ATTENDUES → le registre a été VIDÉ, et c'est
--     exactement le genre d'événement que ce contrôle existe pour attraper.
-- Le cas vide cesse d'être un faux positif sans cesser d'être une alarme quand il compte.
--
-- ⚠ Ce correctif est un PRÉALABLE au branchement d'une alerte (tâche 9) : sans lui, la
-- première chose que la notification aurait faite est de réveiller quelqu'un pour un
-- registre neuf.

create or replace function public.admin_log_chain_verify_job()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result  jsonb;
  v_statut  text;
  v_attendu bigint;
  v_alarme  boolean;
begin
  v_result  := public.admin_log_verify_chain();
  v_statut  := v_result ->> 'status';
  -- `head_row` vient du singleton `admin_log_chain_head`, tenu à jour par le trigger
  -- d'écriture. `coalesce` à 0 : un head absent se lit comme un registre neuf, pas comme
  -- une alarme — on ne fabrique pas un incident à partir d'une donnée manquante.
  v_attendu := coalesce((v_result -> 'head_row' ->> 'rows_count')::bigint, 0);

  v_alarme := case
    when v_statut = 'ok'      then false
    -- Le seul cas ambigu, et le seul qui demandait une mesure : rien relu. Bénin si rien
    -- n'était attendu, gravissime si le registre en attendait — ce serait un effacement.
    when v_statut = 'no_rows' then v_attendu > 0
    else true
  end;

  perform public.admin_log_write(
    p_family   => 'ops',
    p_action   => 'admin_log_chain_verified',
    p_severity => case when v_alarme then 'crit' else 'info' end,
    -- `routine` est l'inverse de l'alarme : get_admin_security_journal filtre `not routine`,
    -- donc un contrôle sans histoire reste hors de l'écran, et une alarme s'y montre.
    p_routine  => not v_alarme,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Statut',           'v', v_statut),
      jsonb_build_object('l', 'Lignes relues',    'v', coalesce(v_result ->> 'rows_checked', '0')),
      -- Rendu en TEXTE, comme tout le reste : `admin_log_write` refuse un flottant dans la
      -- metadata (le hash porte sur le TEXTE du jsonb, et un nombre re-sérialisé
      -- différemment romprait la chaîne sans qu'aucune donnée n'ait bougé).
      jsonb_build_object('l', 'Lignes attendues', 'v', v_attendu::text),
      jsonb_build_object('l', 'Tête',             'v', left(coalesce(v_result ->> 'head', ''), 12)),
      jsonb_build_object('l', 'Rupture',          'v', coalesce(v_result ->> 'break_at', 'aucune'))
    )
  );

  -- ── Le verdict est PUBLIÉ, pour que l'alerte n'ait pas à le recalculer ─────────
  -- Sans ça, la règle d'alerte devrait rappeler admin_log_verify_chain() elle-même : un
  -- SHA-256 par ligne sur TOUT le registre, une seconde fois par heure. On doublerait le
  -- coût de l'opération périodique la plus chère du système, et ce coût croît avec la
  -- rétention — dix ans au titre de la LBA.
  --
  -- `app_config` plutôt qu'une table dédiée : c'est le patron déjà en place (la règle 4 des
  -- alertes lit `whatsapp_token_health` exactement comme ça), et `service_role` peut le lire
  -- alors qu'il n'a délibérément PAS de SELECT sur `admin_log`. RLS active et AUCUNE policy
  -- sur cette table = deny-all : `anon` et `authenticated` ont les GRANT mais ne lisent rien.
  --
  -- La péremption de ce bilan n'a pas besoin d'être gérée ici : si le cron cesse de tourner,
  -- la règle 1 des alertes le signale déjà, générique sur tout job pg_cron en retard.
  insert into public.app_config (key, value)
  values ('admin_log_chain_health', jsonb_build_object(
    'status',       v_statut,
    'alarme',       v_alarme,
    'attendu',      v_attendu,
    'rows_checked', coalesce((v_result ->> 'rows_checked')::bigint, 0),
    'break_at',     v_result -> 'break_at',
    'checked_at',   to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )::text)
  on conflict (key) do update set value = excluded.value;
end;
$function$;
