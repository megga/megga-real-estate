-- realadvisor : rotation du crawl rolling ramenée de 7 nuits à 3.
--
-- POURQUOI
-- ------------------------------------------------------------------------------
-- Le système a deux cadences, et elles ne sont pas alignées :
--
--   DÉTECTION (retrait)   : sonde `id_in` horaire, couverture NATIONALE, 100 % du
--                           vivier sondé chaque jour. Un bien délisté est confirmé
--                           absent en ~3 jours (3 absences espacées >= 20 h + gate 48 h)
--                           puis retiré par `realadvisor-probe-sweep` (01:30).
--   INGESTION (entrée)    : `cron-fresh` (03:30) est une requête nationale que RA
--                           plafonne à ~720 résultats — 77 créations la nuit du 26/07.
--                           Le vrai vecteur d'entrée est `cron-rolling` (22:00), qui
--                           n'énumère qu'UN bucket de cantons par nuit, soit une
--                           rotation complète en 7 nuits.
--
-- Conséquence : en régime permanent, un bien qui PART sort du vivier en ~3 jours,
-- un bien qui ARRIVE y entre en jusqu'à 7 jours. Le vivier se stabilise donc
-- structurellement ~4 jours d'inflow SOUS le catalogue réel de RA — mesuré le 26/07 :
-- 42 930 chez nous contre ~43 500+ déclarés, avec un inflow de l'ordre de 850-1 200/j.
-- Ce n'est pas une fuite qui diverge (le rolling ressuscité le 25/07 ingère bien :
-- 95 créations sur sa seule fenêtre de 22:00), c'est un déficit d'équilibre.
--
-- Correctif : aligner la période de rotation sur la latence de retrait ⇒ 3 nuits.
-- On NE touche NI au cron, NI à la fonction : seule la shard map change. Le crawl
-- reste scopé, paginé, pacé (PACE_MS=2500) et gardé par `realadvisor_rolling_enabled`.
--
-- COÛT : chaque nuit couvre ~14 300 biens vivants au lieu de ~6 100. L'énumération
-- complète des 26 cantons du 25/07 a pris ~113 min pour ~52 000 biens vus, sans un
-- seul throttle, avec l'UA identifié whitelisté. Un tiers de ce volume ⇒ ~40 min,
-- départ à 22:00 ⇒ terminé vers 22:40. Marge confortable avant `probe-sweep` (01:30)
-- et surtout avant `fresh` (03:30), que le verrou singleton ferait abandonner EN
-- SILENCE si le rolling débordait jusque-là.
--
-- ⚠ L'index de bucket est `extract(dow from now())` (0-6) : la map DOIT garder 7
--   entrées, sinon les nuits 3-6 reçoivent NULL ⇒ `cantons` vide ⇒ la fonction abort
--   sur son garde-fou anti-full-crawl et n'écrit AUCUNE ligne de run (silence total).
--   On répète donc les 3 buckets sur les 7 slots. 7 n'étant pas divisible par 3, le
--   bucket A tombe deux nuits d'affilée une fois par semaine (dow 6 puis dow 0) :
--   c'est un re-crawl redondant, sans effet de bord — `mapHit` ne fait que rafraîchir
--   `last_seen_at`, et un bien re-vu voit ses compteurs d'absence remis à zéro.
--
-- Buckets équilibrés sur le vivant `buy` au 26/07 (total 42 930) :
--   A = TI 8 946 + VD 6 022                                          → 14 968
--   B = VS 6 000 + BE 2 606 + ZH 2 529 + GE 2 330 + BS 134 + AR 108
--       + AI/GL/NW/OW/UR (0 bien vivant, cf. slugs à vérifier)        → 13 707
--   C = AG 1 959 + GR 1 917 + BL 1 875 + FR 1 725 + SG 1 526
--       + JU 1 038 + NE 912 + LU 820 + TG 797 + SO 689 + SH 491
--       + ZG 299 + SZ 207                                            → 14 255
--
-- ⚠ AI, GL, NW, OW et UR sont à ZÉRO bien vivant alors que l'énumération du 25/07 les
--   couvrait. Cinq cantons entiers vides n'est pas crédible : leurs slugs RA sont
--   probablement faux (l. 111-117 de supabase/functions/realadvisor-sync/index.ts).
--   Ils sont laissés dans le bucket B — ils n'y coûtent rien tant qu'ils sont vides,
--   et le jour où le slug est corrigé la rotation les prend sans nouvelle migration.

insert into app_config (key, value)
values (
  'realadvisor_shard_map',
  jsonb_build_array(
    -- dow 0 (dimanche) — bucket A
    jsonb_build_array('canton-tessin', 'canton-vaud'),
    -- dow 1 — bucket B
    jsonb_build_array('canton-valais', 'canton-berne', 'canton-zurich', 'canton-geneve',
                      'canton-bale-ville', 'canton-appenzell-rhodes-exterieures',
                      'canton-appenzell-rhodes-interieures', 'canton-glaris',
                      'canton-nidwald', 'canton-obwald', 'canton-uri'),
    -- dow 2 — bucket C
    jsonb_build_array('canton-argovie', 'canton-grisons', 'canton-bale-campagne',
                      'canton-fribourg', 'canton-saint-gall', 'canton-jura',
                      'canton-neuchatel', 'canton-lucerne', 'canton-thurgovie',
                      'canton-soleure', 'canton-schaffhouse', 'canton-zoug', 'canton-schwyz'),
    -- dow 3 — bucket A
    jsonb_build_array('canton-tessin', 'canton-vaud'),
    -- dow 4 — bucket B
    jsonb_build_array('canton-valais', 'canton-berne', 'canton-zurich', 'canton-geneve',
                      'canton-bale-ville', 'canton-appenzell-rhodes-exterieures',
                      'canton-appenzell-rhodes-interieures', 'canton-glaris',
                      'canton-nidwald', 'canton-obwald', 'canton-uri'),
    -- dow 5 — bucket C
    jsonb_build_array('canton-argovie', 'canton-grisons', 'canton-bale-campagne',
                      'canton-fribourg', 'canton-saint-gall', 'canton-jura',
                      'canton-neuchatel', 'canton-lucerne', 'canton-thurgovie',
                      'canton-soleure', 'canton-schaffhouse', 'canton-zoug', 'canton-schwyz'),
    -- dow 6 (samedi) — bucket A
    jsonb_build_array('canton-tessin', 'canton-vaud')
  )::text
)
on conflict (key) do update set value = excluded.value;
