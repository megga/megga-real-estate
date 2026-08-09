-- Une seule implémentation derrière les deux noms d'agence courante.
--
-- CONSTAT (audit des politiques Storage, 06.08.2026). `get_my_agency_id()` et
-- `get_user_agency_id()` portent des corps BYTE-À-BYTE identiques
-- (`select agency_id from profiles where id = auth.uid()`), même volatilité, même
-- search_path, même propriétaire, mêmes privilèges. Ce ne sont pas deux fonctions :
-- c'est une fonction sous deux noms, recopiée.
--
-- POURQUOI C'EST UN PIÈGE, ET PAS UN DOUBLON COSMÉTIQUE. Les deux sont consommées
-- côte à côte SUR LA MÊME TABLE. Sur `storage.objects`, les quatre politiques
-- `documents_bucket_*` appellent `get_user_agency_id()`, tandis que les quatre
-- politiques `documents_kyb_identity_*` — celles qui gardent les PIÈCES D'IDENTITÉ —
-- appellent `get_my_agency_id()`. Le jour où la notion d'agence courante changera
-- (bascule d'agence, profil désactivé, garde de non-nullité), corriger l'une laissera
-- l'autre sur l'ancienne sémantique, SILENCIEUSEMENT, et la moitié des politiques d'un
-- même bucket divergera. Aucun test ne le verrait : les deux compilent, les deux
-- répondent, elles répondent seulement des choses différentes.
--
-- POURQUOI PAS UNE SUPPRESSION. Les deux noms sont trop installés pour être repointés :
-- mesuré en base le 06.08.2026, `get_my_agency_id` est cité par 58 politiques et 7
-- fonctions, `get_user_agency_id` par 40 politiques et 11 fonctions. Réécrire 98
-- politiques en production — dont celles qui gardent les pièces d'identité — pour un
-- défaut qui ne produit aujourd'hui AUCUN comportement faux serait un risque net, pas
-- une remédiation.
--
-- CE QUE FAIT CETTE MIGRATION. `get_user_agency_id()` cesse de porter une COPIE du corps
-- et DÉLÈGUE. Il reste deux noms, mais une seule implémentation : la divergence devient
-- impossible au lieu d'être seulement détectable.
--
-- MÉTHODE. Le corps canonique est repris de la définition VIVANTE (`pg_get_functiondef`,
-- 06.08.2026), jamais du fichier d'origine — cf. l'en-tête de 20260731190000 : le dépôt
-- porte des cas mesurés de fonction dont le corps en service vient d'une autre migration
-- que celle qu'on croit.
--
-- INVARIANTS PRÉSERVÉS, vérifiés en base AVANT écriture :
--   * signature, type de retour, volatilité (STABLE), SECURITY DEFINER et search_path
--     sont inchangés — donc `CREATE OR REPLACE` suffit (pas de 42P13), et AUCUNE
--     politique n'a besoin d'être touchée ;
--   * privilèges identiques sur les deux fonctions (anon=false, authenticated=true,
--     service_role=true) et même propriétaire (`postgres`). L'appel interne s'exécute
--     sous le DÉFINISSEUR, qui possède les deux : aucun appelant ne gagne ni ne perd
--     un droit, et le comportement pour `anon` (échec fermé, faute d'EXECUTE) ne bouge
--     pas ;
--   * l'appel délégué est SCHÉMA-QUALIFIÉ (`public.get_my_agency_id()`), donc il ne peut
--     pas être détourné par un objet temporaire, quel que soit le search_path.
--
-- HORS PÉRIMÈTRE, volontairement. Le search_path de ces deux fonctions omet `pg_temp`
-- (96 des 228 SECURITY DEFINER du schéma sont dans ce cas). C'est un sujet distinct, avec
-- son propre arbitrage ; le traiter ici mélangerait deux diffs dans une migration qui doit
-- rester relisable d'un coup d'œil.

CREATE OR REPLACE FUNCTION public.get_user_agency_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Délégation DÉLIBÉRÉE : ne pas recopier le corps ici, c'est précisément le défaut
  -- que cette migration ferme. La source unique est public.get_my_agency_id().
  select public.get_my_agency_id()
$function$;
