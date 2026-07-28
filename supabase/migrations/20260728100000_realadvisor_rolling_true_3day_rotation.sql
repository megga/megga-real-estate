-- realadvisor : rotation du rolling réellement périodique à 3 jours.
--
-- CE QUE ÇA CORRIGE
-- ------------------------------------------------------------------------------
-- La migration 20260726120000 a voulu ramener la rotation de 7 nuits à 3 pour
-- l'aligner sur la latence de retrait (~3 j). Elle n'a changé QUE la map, en
-- répétant 3 buckets sur les 7 slots, parce que le cron indexe par
-- `extract(dow from now())` — un compteur de période 7.
--
-- Une période 3 ne se plie pas dans une période 7 : mesuré le 28/07, la rotation
-- réelle était
--
--   bucket A (TI, VD)  → dow 0, 3, 6 = dim, mer, sam  ⇒ 3 passages/semaine,
--                        dont deux nuits d'AFFILÉE au repli samedi → dimanche
--   bucket B           → dow 1, 4    = lun, jeu       ⇒ écarts de 3 puis 4 jours
--   bucket C           → dow 2, 5    = mar, ven       ⇒ écarts de 3 puis 4 jours
--
-- Donc 24 cantons sur 26 attendaient jusqu'à 4 jours — un de PLUS que la latence
-- de retrait que la refonte visait à rattraper, ce qui laisse en place une part du
-- déficit d'équilibre du vivier qu'elle devait fermer. Et les 15 975 biens de
-- A étaient re-crawlés 3 fois par semaine pour rien : ~40 min de crawl et le
-- verrou singleton tenus sans rien apprendre.
--
-- CORRECTIF : indexer par un compteur de jours ABSOLU modulo 3, et ramener la map
-- à ses 3 buckets réels. Les deux vont ENSEMBLE — c'est leur découplage qui a
-- produit le bug. Appliquer l'un sans l'autre casse le cron :
--   · map à 3 entrées + index dow  ⇒ NULL du mercredi au samedi ;
--   · map à 7 entrées + index mod 3 ⇒ seuls les 3 premiers slots sont atteints
--     (inoffensif ici puisque les slots 0-2 sont les 3 buckets, mais les slots
--     3-6 deviennent du code mort trompeur).
-- Dans les deux cas de panne, `cantons` vide ⇒ la fonction abort sur son garde-fou
-- anti-full-crawl SANS écrire de ligne de run : silence total, aucune trace. D'où
-- la migration unique.
--
-- ORDRE DES BUCKETS — choisi pour que la bascule ne crée aucun trou. Dernier crawl
-- effectif au 28/07 : C le 24/07 (4 j, le plus en retard), A le 26/07, B le 27/07.
-- L'index vaut 1 le 28/07, 2 le 29, 0 le 30 (vérifié en SQL), d'où [B, C, A] :
--   28/07 → idx 1 → C   (rattrape le plus ancien, et c'est déjà ce que la config
--                        actuelle aurait fait ce soir : aucune nuit perdue)
--   29/07 → idx 2 → A
--   30/07 → idx 0 → B
--   31/07 → idx 1 → C   ⇒ régime permanent : 3 jours pile pour les 26 cantons.
--
-- Composition des buckets INCHANGÉE (le sujet est la cadence, pas l'équilibrage).
-- Vivants `buy` au 28/07, total 43 039 :
--   A = TI 9 758 + VD 6 217                                        → 15 975
--   B = VS 6 835 + BE 2 892 + ZH 2 609 + GE 1 779 + AR 249 + BS 181
--       + GL 137 + UR 98 + NW 91 + OW 73 + AI 26                   → 14 970
--   C = AG 1 889 + FR 1 552 + BL 1 550 + SG 1 298 + GR 1 117
--       + JU 1 090 + NE 894 + LU 683 + TG 647 + SO 623 + SH 432
--       + ZG 208 + SZ 111                                          → 12 094
-- (AI/GL/NW/OW/UR ne sont plus à zéro : c'était la table NPA→canton par blocs de
--  100, corrigée par #967, et non les slugs RA que la 20260726120000 soupçonnait.)
--
-- ⚠ L'ancre `2026-01-01` est arbitraire mais doit rester FIXE : la changer décale
--   la phase et peut sauter un bucket une nuit. Le double `mod` garde l'index
--   positif si l'horloge passait avant l'ancre — sans lui, un index négatif rend
--   NULL, donc l'abort silencieux décrit plus haut.

-- 1) Map ramenée à ses 3 buckets réels, dans l'ordre [B, C, A].
insert into app_config (key, value)
values (
  'realadvisor_shard_map',
  jsonb_build_array(
    -- idx 0 — bucket B
    jsonb_build_array('canton-valais', 'canton-berne', 'canton-zurich', 'canton-geneve',
                      'canton-bale-ville', 'canton-appenzell-rhodes-exterieures',
                      'canton-appenzell-rhodes-interieures', 'canton-glaris',
                      'canton-nidwald', 'canton-obwald', 'canton-uri'),
    -- idx 1 — bucket C
    jsonb_build_array('canton-argovie', 'canton-grisons', 'canton-bale-campagne',
                      'canton-fribourg', 'canton-saint-gall', 'canton-jura',
                      'canton-neuchatel', 'canton-lucerne', 'canton-thurgovie',
                      'canton-soleure', 'canton-schaffhouse', 'canton-zoug', 'canton-schwyz'),
    -- idx 2 — bucket A
    jsonb_build_array('canton-tessin', 'canton-vaud')
  )::text
)
on conflict (key) do update set value = excluded.value;

-- 2) Cron re-planifié avec l'index modulo 3. Même horaire, même corps, seul
--    l'index change. Idempotent : le unschedule tolère l'absence du job, et
--    deploy.yml rejoue les migrations du jour.
do $$ begin perform cron.unschedule('realadvisor-rolling-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-rolling-daily', '0 22 * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'chunk', 'offer_type', 'buy', 'trigger_source', 'cron-rolling',
      'cantons', (public.get_app_config('realadvisor_shard_map')::jsonb)
                   -> mod(mod(((now() at time zone 'UTC')::date - date '2026-01-01'), 3) + 3, 3))
  ) $cron$);
  end if;
end $$;
