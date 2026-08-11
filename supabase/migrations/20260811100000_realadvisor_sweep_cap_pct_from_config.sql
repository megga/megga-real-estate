-- RealAdvisor — le plafond relatif du sweep devient RÉGLABLE sans migration, et il est
-- relevé à 5 % le temps de résorber un excédent de vivier mesuré.
--
-- Constat du 11/08/2026, gate empirique `id_in` passé sur la TOTALITÉ des 1 377
-- candidats restants (39 lots, ambiguous=0, lot de contrôle 35/36 présents ⇒ oracle non
-- throttlé) : **4 encore en ligne, soit 0,3 % de faux absents**, sans concentration par
-- classe d'id (1/271 sur les `500*`, 3/1 106 sur les ids courts). L'hypothèse « la sonde
-- se trompe » derrière les 3 nuits `capped` (09, 10, 11/08) est donc réfutée.
--
-- Le discriminant décisif n'était pas dans notre base mais chez RealAdvisor : son
-- `total_count` déclaré vaut 41 665 quand notre live en portait 43 223 — nous gardions
-- ~1 558 biens que RA ne sert plus. Le sweep ne sur-retire pas, il SOUS-retire : le
-- plafond de 3 % (~1 300) se calcule sur un vivier lui-même gonflé, face à un inflow de
-- candidats confirmés monté à ~1 500-1 960/nuit (reconstruit sur la série
-- candidats/retirés des 09→11/08). D'où un backlog qui diverge (1 772 → 1 957 → 2 585).
--
-- Deux changements, aucun sur le corps de realadvisor_probe_sweep — la fonction qui
-- retire des lignes n'est PAS touchée, seule la PROVENANCE de son paramètre change :
--
-- 1) Le cron lit `app_config.realadvisor_sweep_cap_pct` (défaut 3 % si la clé est
--    absente ou vide). Revenir à 3 % après drainage est alors un simple UPDATE, sans
--    migration ni redéploiement — c'est le point : le relèvement est temporaire, et son
--    retour ne doit pas dépendre d'un second aller-retour de PR.
-- 2) La valeur lue est BORNÉE à [0.005, 0.10] dans l'expression du cron. Un « 5 » saisi
--    pour « 0.05 » donnerait un plafond de 500 % du live, c'est-à-dire aucun plafond :
--    la borne rend la clé inoffensive en cas de faute de frappe. Elle vit dans le cron
--    plutôt que dans la fonction pour qu'un appel manuel d'urgence garde la main.
--
-- Ordre de grandeur visé : 5 % ≈ 2 160 retraits/nuit à live 43 200, contre ~1 700
-- nouveaux candidats/nuit ⇒ ~450 de drainage net par nuit, l'excédent de ~1 558 se
-- résorbant en 3-4 nuits. Le sweep ne peut de toute façon retirer que des absents
-- confirmés (3 sondes espacées ≥20h, ≥48h d'ancienneté, garde `last_seen_at`) : un
-- plafond plus haut ne peut pas descendre le vivier sous la réalité.
--
-- ⚠ À REMETTRE À 0.03 une fois le live aligné sur le `total_count` de RA :
--   update app_config set value = '0.03' where key = 'realadvisor_sweep_cap_pct';

-- 1) La clé. `do nothing` volontaire : si elle existe déjà (retour à 3 % après drainage),
--    un rejeu de cette migration ne doit PAS re-relever le plafond dans le dos.
insert into public.app_config (key, value)
values ('realadvisor_sweep_cap_pct', '0.05')
on conflict (key) do nothing;

-- 2) Re-pose du cron. Le plafond était passé EN DUR en positionnel (0.03) : changer le
--    défaut de la fonction ne suffirait pas, il faut réécrire la commande. Même montage
--    que 20260802120000 (unschedule avalé + schedule gardé par l'existence du schéma
--    cron, pour une base CI fraîche sans pg_cron).
do $$ begin perform cron.unschedule('realadvisor-probe-sweep'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-probe-sweep', '30 1 * * *', $cron$
  insert into realadvisor_sync_runs(offer_type, trigger_source, status, ended_at, total_removed, total_seen, error_message)
  select 'buy', 'cron-probe-sweep', coalesce(r->>'status','?'), now(),
         coalesce((r->>'removed')::int,0), coalesce((r->>'live')::int,0),
         'probe_sweep candidates='||coalesce(r->>'candidates','?')||' removed='||coalesce(r->>'removed','?')||' status='||coalesce(r->>'status','?')
  from (select public.realadvisor_probe_sweep('buy',3,48,null,
          least(greatest(coalesce(nullif(public.get_app_config('realadvisor_sweep_cap_pct'), '')::numeric, 0.03), 0.005), 0.10),
          public.get_app_config('realadvisor_probe_apply') = 'true') as r) x;
$cron$);
  end if;
end $$;
