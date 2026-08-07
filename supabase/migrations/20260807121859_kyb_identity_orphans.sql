-- RGPD, tâche 4 : ce qui reste de la « réconciliation de l'existant ».
--
-- LA TÂCHE D'ORIGINE EST SANS OBJET, et il faut le dire plutôt que l'inventer. Le plan du
-- 06.08 prévoyait une table-miroir des fichiers, donc un rattrapage pour y insérer les
-- lignes manquantes des pièces déjà déposées. La conception a changé à l'implémentation :
-- `kyb_identity_files()` (20260807101554) DÉRIVE l'inventaire de `storage.objects`, qui
-- porte déjà l'agence et la personne dans le chemin. Un inventaire dérivé n'a rien à
-- rattraper — il voyait les fichiers du 03.08 dès sa première exécution, ce que le relevé
-- de production a confirmé (3 pièces vues).
--
-- CE QUI RESTE, ET QUI EST RÉEL. Un objet dont le chemin ne correspond PAS à la forme
-- attendue est invisible à l'inventaire, donc à la purge : il ne sera jamais ramassé, et
-- rien ne le signalera. C'est exactement la forme du défaut F1 qu'on vient de fermer —
-- une donnée personnelle que personne ne regarde. Relevé en production le 07.08.2026 :
-- 4 objets sous le préfixe, 3 vus, 1 exclu volontairement, **0 orphelin**. Zéro
-- aujourd'hui n'est pas zéro pour toujours : d'où ce compteur, et non un rattrapage.
--
-- CE QU'ELLE NE FAIT PAS : supprimer. Un chemin non conforme peut être une pièce qu'on ne
-- sait pas rattacher, et détruire sur inférence est le seul geste vraiment irréversible du
-- dispositif. Elle SIGNALE ; un humain tranche.
--
-- Les fichiers cachés (`.emptyFolderPlaceholder`, posé par Supabase pour matérialiser un
-- dossier vide) ne sont PAS des orphelins : leur exclusion de l'inventaire est délibérée
-- (voir 20260807101554). Les compter ici ferait sonner une alarme permanente, et une
-- alarme qui sonne toujours finit débranchée.

create or replace function public.kyb_identity_orphans()
returns table (
  storage_path text,
  uploaded_at  timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'documents'
    and o.name like '%/kyb-identity/%'
    -- Invisible à l'inventaire…
    and o.name !~* '^[0-9a-f-]{36}/kyb-identity/[0-9a-f-]{36}/[^/.][^/]*$'
    -- …et pas un fichier caché, dont l'exclusion est voulue.
    and split_part(o.name, '/', 4) not like '.%'
$$;

comment on function public.kyb_identity_orphans() is
  'Objets sous documents/{agence}/kyb-identity/ que kyb_identity_files() ne voit PAS, hors fichiers cachés (exclus à dessein). Un orphelin échappe à la purge : il est SIGNALÉ, jamais supprimé — détruire sur inférence est le seul geste irréversible du dispositif. 0 en production au 07.08.2026.';

revoke all on function public.kyb_identity_orphans() from public, anon, authenticated;
grant execute on function public.kyb_identity_orphans() to service_role;
