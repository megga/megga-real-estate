-- Re-datation des deux migrations d'agence du 06.08, jamais appliquées.
--
-- CONSTAT. `20260806164512_dedupe_agency_id_helpers.sql` (#1178) et
-- `20260806171204_search_path_pg_temp_storage_trio.sql` (#1179) ont été mergées dans main
-- le 06.08.2026, mais **aucun déploiement ne les a jamais appliquées**. Vérifié dans
-- l'historique des runs de `deploy.yml` :
--
--   * le run `push` sur `dc0b4d42` (18:16) — annulé ;
--   * le run `push` sur `857b753e` (18:18, HEAD de main, porteur des deux fichiers) — annulé ;
--   * le seul run survivant (18:25) portait sur `2d6047bd`, commit ANTÉRIEUR qui ne contient
--     ni l'un ni l'autre — et il a échoué de toute façon ;
--   * un `workflow_dispatch` lancé à 18:15 a rendu « success » sans rien faire : toutes les
--     étapes utiles de `deploy.yml` sont gardées par `if: github.event_name == 'push'`.
--
-- GitHub traversait une pénurie de runners ce soir-là, et a créé les runs DANS LE DÉSORDRE :
-- celui du commit le plus ancien est arrivé en dernier, et le groupe de concurrence a annulé
-- les deux runs portant justement sur les commits utiles.
--
-- POURQUOI UN NOUVEAU FICHIER PLUTÔT QU'UNE RE-DATATION SUR PLACE. `deploy.yml` n'applique
-- que les migrations horodatées du JOUR (UTC). Au 07.08, les deux fichiers du 06.08 ne seront
-- plus jamais appliqués, quoi qu'il arrive. Et la règle du dépôt (invariant n°16 du handoff
-- KYB) est explicite : corriger une migration DÉJÀ MERGÉE exige un nouveau fichier, jamais
-- une reprise sur place — la version d'origine est déjà enregistrée côté dépôt. Les deux
-- fichiers du 06.08 restent donc en place, inertes, et ce fichier-ci porte l'effet.
--
-- POURQUOI UN SEUL FICHIER POUR DEUX MIGRATIONS. Les originaux portaient une DÉPENDANCE
-- D'ORDRE, documentée dans l'en-tête de 171204 : le `CREATE OR REPLACE` de 164512 réécrit la
-- liste ENTIÈRE des `SET`, donc il devait impérativement passer AVANT l'`ALTER` de 171204,
-- sans quoi il effaçait le `pg_temp` fraîchement posé. En fusionnant, le `CREATE OR REPLACE`
-- porte directement `'public', 'pg_temp'` et la dépendance disparaît — il n'y a plus d'ordre
-- à respecter, donc plus d'ordre à casser.
--
-- ÉTAT FINAL VISÉ, identique à #1178 + #1179 :
--   * `get_user_agency_id()` DÉLÈGUE à `get_my_agency_id()` au lieu d'en recopier le corps
--     (une seule implémentation derrière deux noms — la divergence devient impossible) ;
--   * les trois fonctions dont dépendent les huit politiques Storage du préfixe
--     `kyb-identity` portent `pg_temp` explicitement en DERNIER, pour qu'un objet temporaire
--     ne puisse plus masquer `public.profiles`.
--
-- ⚠ CE QUI N'A PAS PU ÊTRE REVÉRIFIÉ, et c'est une différence réelle avec les originaux.
-- #1178 et #1179 avaient chacun été éprouvés contre la PRODUCTION en transaction annulée
-- (démonstration avant/après du masquage par table temporaire, relecture du corps après
-- rollback). Le connecteur Supabase n'est plus disponible dans la session qui écrit ce
-- fichier : le SQL ci-dessous est repris VERBATIM des deux fichiers mergés, à UNE différence
-- près — le `search_path` du `CREATE OR REPLACE` passe de `'public'` à `'public', 'pg_temp'`,
-- ce qui est exactement ce que l'`ALTER` de 171204 faisait juste après. Aucune autre
-- modification. La vérification tient donc à la lecture, pas à la mesure.
--
-- IDEMPOTENCE : `CREATE OR REPLACE` et `ALTER … SET` écrivent une valeur absolue. Le
-- date-guard rejoue les fichiers du jour à chaque push de la journée ; les rejouer est sans
-- effet de bord.

-- ── 1. Une seule implémentation derrière les deux noms (ex-20260806164512) ──
--
-- Le `search_path` porte `pg_temp` DÈS ICI, contrairement à l'original : c'est la fusion des
-- deux migrations, et ça supprime la dépendance d'ordre décrite en en-tête.
CREATE OR REPLACE FUNCTION public.get_user_agency_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Délégation DÉLIBÉRÉE : ne pas recopier le corps ici, c'est précisément le défaut
  -- que cette migration ferme. La source unique est public.get_my_agency_id().
  select public.get_my_agency_id()
$function$;

-- ── 2. `pg_temp` sur les deux autres fonctions des politiques Storage (ex-20260806171204) ──
--
-- `get_user_agency_id` n'y figure pas : le `CREATE OR REPLACE` ci-dessus lui a déjà posé le
-- bon `search_path`. L'ajouter serait redondant, pas plus sûr.
--
-- `ALTER` et non `CREATE OR REPLACE` : ce dernier remplace la liste ENTIÈRE des `SET`, et
-- douze des fonctions SECURITY DEFINER du schéma portent un `statement_timeout` délibéré
-- qu'un `CREATE OR REPLACE` partiel supprimerait en silence. Ces deux-ci sont en
-- `search_path=public` nu, donc le piège ne les concerne pas — mais l'idiome reste le bon.
ALTER FUNCTION public.is_agency_admin()  SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.get_my_agency_id() SET search_path TO 'public', 'pg_temp';
