-- RGPD, tâche 1 : la pièce d'identité KYB cesse d'être introuvable.
--
-- LE FAIT. `20260802200000` l'a écrit sans le solder : le fichier déposé sous
-- `documents/{agence}/kyb-identity/` n'a « ni propriétaire, ni rétention, ni chemin de
-- purge — il échappe à `delete-account` comme aux deux triggers de rétention 10 ans ».
-- Mesuré le 06.08.2026, c'est exact et la cause est étroite : `delete-account` (étape 10)
-- sélectionne dans la TABLE `documents` filtrée sur `uploaded_by`, puis retire les chemins
-- obtenus. Le dépôt de la pièce, lui, écrit DIRECTEMENT dans Storage
-- (`useAgencyIdentity.ts:905`, `.storage.from('documents').upload(...)`) sans jamais créer
-- de ligne. Le fichier n'est donc pas oublié d'une liste : il n'est atteignable par AUCUNE
-- requête que le dépôt sait écrire.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS, ET POURQUOI. Elle ne crée PAS une table-miroir des
-- fichiers vivants, et elle ne pose PAS de trigger sur `storage.objects`.
--
--   * Un miroir DÉRIVE. Il faudrait le tenir à jour à l'insertion, au remplacement
--     (useAgencyIdentity retire l'ancien objet quand l'extension change) et à la purge ;
--     la première désynchronisation recréerait exactement le défaut qu'on ferme — un
--     fichier que la base croit absent, ou l'inverse.
--   * `storage.objects` EST déjà le registre. Le chemin porte l'agence et la personne
--     (`{agency}/kyb-identity/{person}/{côté}.{ext}`) : rien ne manquait en base, il
--     manquait quelqu'un pour REGARDER. C'est ce que fait `kyb_identity_files()`.
--   * Un trigger sur `storage.objects` supposerait un privilège qui n'est acquis nulle
--     part ailleurs dans ce dépôt (aucun trigger n'y est posé aujourd'hui) et ferait
--     dépendre la conformité d'une écriture qui peut échouer en silence.
--
-- Ce qui est PERSISTÉ ici, c'est uniquement la trace des purges — le seul fait qu'un
-- inventaire dérivé ne peut pas reconstituer après coup, puisque l'objet a disparu.

-- ── 1. Journal des purges ────────────────────────────────────────────────────
-- Append-only. La ligne SURVIT à l'agence et à la personne (aucune cascade, aucune FK) :
-- une preuve de destruction qui s'efface avec son sujet ne prouve plus rien, et c'est
-- précisément au moment où l'agence est supprimée qu'on doit pouvoir montrer que sa pièce
-- d'identité l'a été aussi. Les identifiants restent en `uuid` nu, sans référence.
create table if not exists public.agency_id_document_purges (
  id                uuid primary key default gen_random_uuid(),
  storage_path      text not null,
  agency_id         uuid,
  related_person_id uuid,
  -- 'verdict'   : un relecteur a tranché, la pièce a fini son office
  -- 'expiry'    : dossier abandonné, échéance de sécurité atteinte
  -- 'account'   : suppression de compte / d'agence
  -- 'backfill'  : réconciliation de l'existant (antérieur à ce dispositif)
  purge_reason      text not null,
  uploaded_at       timestamptz,
  purged_at         timestamptz not null default now(),
  constraint agency_id_document_purges_reason_check
    check (purge_reason = any (array['verdict', 'expiry', 'account', 'backfill']))
);

comment on table public.agency_id_document_purges is
  'Journal append-only des pièces d''identité KYB détruites : chemin, motif, date. Sans FK ni cascade — la preuve doit survivre à la suppression de l''agence, sinon elle disparaît avec ce qu''elle atteste.';

create index if not exists idx_agency_id_document_purges_agency
  on public.agency_id_document_purges (agency_id, purged_at desc);

-- Rappel du footgun maison : Supabase accorde d'office à `anon` et `authenticated` tous
-- les droits sur une table neuve. On révoque d'abord, on ouvre ensuite le strict nécessaire.
alter table public.agency_id_document_purges enable row level security;
revoke all on table public.agency_id_document_purges from anon, authenticated;
grant select on table public.agency_id_document_purges to authenticated;

drop policy if exists agency_id_document_purges_select_super_admin
  on public.agency_id_document_purges;
create policy agency_id_document_purges_select_super_admin
  on public.agency_id_document_purges
  for select to authenticated
  using (public.is_super_admin());

-- ── 2. La durée de conservation, en VALEUR et non en constante gravée ────────
-- Arbitrage 3 du plan du 06.08.2026. La suppression est irréversible, et la portée de la
-- LBA sur l'onboarding d'AGENCE (par opposition au KYC des parties à une transaction, seul
-- cas où s'arme le déclencheur dix ans) n'est pas tranchée juridiquement. On construit donc
-- le mécanisme et on paramètre la politique : si le conseil conclut à une obligation de
-- conservation, c'est CETTE fonction qui change, pas le dispositif.
--
-- 90 jours : assez long pour une revue humaine qui traîne, assez court pour qu'un dossier
-- abandonné ne devienne pas un entrepôt. Ne s'applique qu'aux pièces SANS verdict — une
-- pièce tranchée part sans attendre l'échéance.
create or replace function public.kyb_identity_retention_days()
returns integer
language sql
immutable
as $$ select 90 $$;

comment on function public.kyb_identity_retention_days() is
  'Échéance de sécurité (jours) avant purge d''une pièce d''identité KYB SANS verdict. Point de réglage unique de l''arbitrage 3 : à modifier ici si la portée LBA sur l''onboarding d''agence est tranchée en faveur d''une conservation.';

-- ── 3. L'inventaire : regarder là où le fichier a toujours été ───────────────
-- SECURITY DEFINER parce que `storage.objects` est sous RLS et que l'appelant légitime
-- (balayeur de purge, delete-account, export DSAR) doit voir TOUTES les agences.
--
-- Le départage du verdict passe par `_latest_person_verification_check` — le MÊME point de
-- décision que `submit_agency_identity` et `admin_resolve_agency_id_document`. Recopier cet
-- ordre ici ferait diverger « où en est ce check » entre celui qui juge et celui qui purge :
-- une pièce pourrait être détruite alors que la revue la croit encore en attente.
create or replace function public.kyb_identity_files()
returns table (
  storage_path      text,
  agency_id         uuid,
  related_person_id uuid,
  uploaded_at       timestamptz,
  latest_result     text,
  purge_due         boolean,
  purge_reason      text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with objets as (
    select
      o.name                                   as storage_path,
      o.created_at                             as uploaded_at,
      split_part(o.name, '/', 1)::uuid         as agency_id,
      split_part(o.name, '/', 3)::uuid         as related_person_id
    from storage.objects o
    where o.bucket_id = 'documents'
      -- Forme EXACTE exigée avant tout cast : un objet mal formé sous ce préfixe ferait
      -- lever le cast uuid et emporterait l'inventaire entier — donc plus aucune purge.
      --
      -- Insensible à la casse (`~*`) À DESSEIN. Postgres rend ses uuid en minuscules, mais
      -- le chemin est construit côté navigateur : une majuscule y suffirait à exclure le
      -- fichier de l'inventaire, donc de toute purge. Entre les deux façons de se tromper,
      -- on choisit celle qui garde le fichier VISIBLE.
      and o.name ~* '^[0-9a-f-]{36}/kyb-identity/[0-9a-f-]{36}/[^/]+$'
  )
  select
    ob.storage_path,
    ob.agency_id,
    ob.related_person_id,
    ob.uploaded_at,
    lc.check_result,
    -- Terminal = la question est tranchée, la pièce a fini son office.
    -- `partial` et `pending_manual_review` sont EXCLUS à dessein : l'étape 7 rend une pièce
    -- refusée à nouveau remplaçable, et purger sous elle casserait la boucle de remédiation.
    (lc.check_result in ('match', 'mismatch'))
      or (ob.uploaded_at < now() - make_interval(days => public.kyb_identity_retention_days()))
                                             as purge_due,
    case
      when lc.check_result in ('match', 'mismatch') then 'verdict'
      when ob.uploaded_at < now() - make_interval(days => public.kyb_identity_retention_days()) then 'expiry'
      else null
    end                                      as purge_reason
  from objets ob
  left join lateral public._latest_person_verification_check(ob.related_person_id, 'id_document') lc
    on true
$$;

comment on function public.kyb_identity_files() is
  'Inventaire dérivé des pièces d''identité KYB présentes dans Storage, avec agence, personne, verdict courant et exigibilité de purge. Dérivé et non miroir : storage.objects est la source, le chemin porte déjà l''agence et la personne. Interne — réservé au super-admin et au service.';

revoke all on function public.kyb_identity_files() from public, anon, authenticated;
grant execute on function public.kyb_identity_files() to service_role;

revoke all on function public.kyb_identity_retention_days() from public, anon;
grant execute on function public.kyb_identity_retention_days() to authenticated, service_role;
