-- realadvisor : rééquilibrage des 3 buckets du rolling sur le COÛT DE CRAWL.
--
-- ⚠ LE VOLUME D'ANNONCES N'EST PAS LE COÛT. C'est le piège de cette table, et la
-- raison pour laquelle les buckets « équilibrés par volume » des migrations
-- précédentes étaient en fait déséquilibrés d'un facteur 1,7 en durée.
--
-- MODÈLE, calibré sur les 3 nuits de rolling observées (colonnes `pages_fetched`
-- et `chunks_completed` de realadvisor_sync_runs) :
--
--   nuit     bucket        cantons  slices  pages  vus     durée
--   25/07    ancien b6      4       132     293    7 813   15 min
--   26/07    A (TI, VD)     2        66     455   15 267   22 min
--   27/07    B             11       363     618   16 187   39 min
--
-- On lit deux choses. (1) slices = 33 × cantons, EXACTEMENT (132/4, 66/2, 363/11) :
-- `buildWorklist` émet 1 slice non filtrée + 32 bandes de prix par canton, quelle
-- que soit sa taille. AI coûte donc 33 requêtes pour 26 annonces. (2) la durée suit
-- les PAGES, pas les annonces — le pacing est `if (page > 1) await sleep(PACE_MS)`
-- plus une pause entre slices, soit ~1 sleep par page.
--
--   pages ≈ 33 × n_cantons + k × annonces,  k ≈ 0,020 (mesuré 0,0158 / 0,0255 / 0,0206)
--
-- D'où le paradoxe mesuré : le bucket A voyait PLUS d'annonces que B (15 267 contre
-- 16 187, à 6 % près) en DEUX FOIS moins de temps, parce qu'il ne portait que
-- 2 cantons donc 66 slices au lieu de 363.
--
-- AVANT (coût en pages)          APRÈS
--   idx0  662  (11 cantons)        idx0  573  ( 9 cantons)
--   idx1  671  (13 cantons)        idx1  574  ( 9 cantons)
--   idx2  386  ( 2 cantons)        idx2  572  ( 8 cantons)
--   écart 74 %                     écart 0,2 %
--
-- Le TOTAL est inchangé (1 719 pages) : on ne réduit pas le travail, on l'étale.
-- Gain réel = la nuit la plus longue passe de ~36 à ~31 min, et plus aucune nuit
-- n'est deux fois plus chargée qu'une autre.
--
-- ⛔ NE PAS « rééquilibrer par volume » : c'est infaisable ET nuisible. TI seul pèse
--    9 758 vivants (23 % du catalogue), donc aucune partition ne peut égaliser les
--    volumes sans découper un canton — ce que le slicing par slug ne permet pas. Et
--    viser l'égalité des volumes déplacerait des cantons HORS du bucket le plus
--    rapide, en aggravant l'écart de durée.
--
-- ORDRE DES BUCKETS — choisi pour la continuité de la bascule. Dernier crawl au
-- 28/07 : les 13 cantons de l'ancien bucket C datent du 24/07 (les plus en retard),
-- l'ancien A du 26/07, l'ancien B du 27/07. La nouvelle partition mélange les trois
-- origines, donc chaque groupe contient des cantons en retard. On place en premier
-- celui qui en contient le PLUS :
--   idx1 → 28/07 (ce soir)  : 6 cantons en retard  ← passe en premier
--   idx2 → 29/07            : 4 cantons en retard
--   idx0 → 30/07            : 3 cantons en retard (SG, LU, SO ⇒ 6 j, pire cas)
-- Coût one-shot de la bascule : 3 cantons attendent 6 jours au lieu de 3. Ensuite,
-- régime permanent à 3 jours pour les 26.
--
-- ⚠ La map DOIT garder exactement 3 entrées : l'index est
--   `mod(mod(date_utc - date '2026-01-01', 3) + 3, 3)` (cf. 20260728100000). Une map
--   d'une autre taille rend NULL certaines nuits ⇒ `cantons` vide ⇒ abort silencieux
--   du garde-fou anti-full-crawl, SANS ligne de run.
--
-- Composition (vivants `buy` au 28/07, total 43 039) :
--   idx0 = VD 6 217 + BE 2 892 + GE 1 779 + SG 1 298 + LU 683 + SO 623 + BS 181
--          + UR 98 + AI 26                                    → 13 797 · 9 cantons
--   idx1 = VS 6 835 + ZH 2 609 + FR 1 552 + GR 1 117 + NE 894 + SH 432 + ZG 208
--          + SZ 111 + OW 73                                   → 13 831 · 9 cantons
--   idx2 = TI 9 758 + AG 1 889 + BL 1 550 + JU 1 090 + TG 647 + AR 249 + GL 137
--          + NW 91                                            → 15 411 · 8 cantons
-- Vérifié : 26 cantons, aucun doublon, aucun manquant.

insert into app_config (key, value)
values (
  'realadvisor_shard_map',
  jsonb_build_array(
    -- idx 0 — 573 pages
    jsonb_build_array('canton-vaud', 'canton-berne', 'canton-geneve', 'canton-saint-gall',
                      'canton-lucerne', 'canton-soleure', 'canton-bale-ville',
                      'canton-uri', 'canton-appenzell-rhodes-interieures'),
    -- idx 1 — 574 pages
    jsonb_build_array('canton-valais', 'canton-zurich', 'canton-fribourg', 'canton-grisons',
                      'canton-neuchatel', 'canton-schaffhouse', 'canton-zoug',
                      'canton-schwyz', 'canton-obwald'),
    -- idx 2 — 572 pages
    jsonb_build_array('canton-tessin', 'canton-argovie', 'canton-bale-campagne', 'canton-jura',
                      'canton-thurgovie', 'canton-appenzell-rhodes-exterieures',
                      'canton-glaris', 'canton-nidwald')
  )::text
)
on conflict (key) do update set value = excluded.value;
