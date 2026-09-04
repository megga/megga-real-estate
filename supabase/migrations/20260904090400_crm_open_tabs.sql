-- Pile d'onglets ouverts du CRM, PAR PERSONNE.
--
-- Un onglet n'est pas une destination (la barre latérale porte déjà les dix sections) :
-- c'est un CONTEXTE DE TRAVAIL ouvert — une fiche contact, un deal, une annonce — avec la
-- position d'écran qu'on y avait laissée. Deux onglets peuvent donc viser la même section
-- sur deux contacts différents, comme les onglets d'un navigateur.
--
-- ⛔ UNE TABLE DÉDIÉE, ET PAS `profiles.preferences`, POUR UNE RAISON MESURÉE.
-- La colonne `profiles.preferences` existe, est écrivable par son propriétaire, et aurait
-- coûté zéro migration. Mais la LIGNE `profiles` est lisible par tout membre de la même
-- agence (policy `profiles_select_agency`, `using (agency_id = get_my_agency_id())`) et par
-- tout super-admin (`super_admin_read_all_profiles`) — et PostgREST n'a AUCUN filtre de
-- colonne par policy : il est impossible de montrer `full_name` au collègue en lui cachant
-- `preferences`. Or une pile d'onglets dit quels CLIENTS un agent a ouverts, et son
-- libellé porte leur NOM. L'écart est théorique aujourd'hui (toutes les agences sont solo,
-- mesuré le 04.09.2026) et s'ouvre au premier deuxième membre.
--
-- ⛔ ET AUCUNE POLICY SUPER-ADMIN ICI, délibérément. Toutes les autres tables du dépôt en
-- portent une ; celle-ci est la seule donnée strictement personnelle d'un agent — ce qu'il
-- a sous les yeux. Un super-admin qui a besoin d'y accéder passe par `service_role`, ce qui
-- laisse une trace, au lieu d'une lecture silencieuse depuis le client.
--
-- ⚠ PII. `label` porte un nom de personne (nom du contact d'une fiche ouverte). C'est ce
-- qui interdit le miroir `localStorage` — le dépôt a déjà tranché ce cas au même motif
-- (`ImportLeadPage.tsx:53-56` : sessionStorage + TTL « la donnée contient des PII »). Le
-- serveur est la source de vérité ; le client ne miroite qu'en sessionStorage.
begin;

create table if not exists public.crm_open_tabs (
  -- Clé primaire = l'utilisateur : UNE ligne par personne, jamais une ligne par onglet.
  -- Une ligne par onglet coûterait un delete/insert à chaque réordonnancement (un geste
  -- de glisser en produit un par image) pour zéro bénéfice : la pile n'est jamais
  -- requêtée par domaine, seulement lue en entier et écrite en entier.
  user_id       uuid        primary key references auth.users(id) on delete cascade,

  tabs          jsonb       not null default '[]'::jsonb
                            check (jsonb_typeof(tabs) = 'array'),

  -- Index de l'onglet actif. Borné en haut par le client, pas ici : un CHECK croisé
  -- (`active_index < jsonb_array_length(tabs)`) refuserait la pile VIDE du premier boot.
  active_index  integer     not null default 0 check (active_index >= 0),

  -- Concurrence optimiste. Deux fenêtres du CRM ouvertes sur le même compte écrivent la
  -- même ligne ; sans jeton, la dernière écrase l'autre EN SILENCE et l'agent voit ses
  -- onglets disparaître sans rien avoir fermé. `crm_tabs_save` refuse une écriture dont la
  -- révision est périmée et REND l'état courant, que le client adopte.
  revision      bigint      not null default 1,

  updated_at    timestamptz not null default now()
);

comment on table public.crm_open_tabs is
  'Pile d''onglets ouverts du CRM, une ligne par utilisateur. Strictement personnelle : '
  'aucune policy agence, aucune policy super-admin. Contient des PII (le libellé d''un '
  'onglet de fiche est le nom du contact).';

comment on column public.crm_open_tabs.tabs is
  'Tableau d''entrees {id, pinned, path, search, section, label, ui}. `path`+`search` sont '
  'le QUOI (le serveur pourrait les relire) ; `ui` est un sac OPAQUE cote serveur — la '
  'position dans l''ecran (sous-onglet, filtre, recherche, page du pager), jamais '
  'interpretee en SQL. Regle de partage : ce qui decrit une position dans un ecran entre '
  'dans `ui` ; le theme, le role, la langue et l''agence n''y entrent jamais.';

comment on column public.crm_open_tabs.revision is
  'Jeton de concurrence optimiste, incremente a chaque ecriture acceptee. Le client envoie '
  'la revision qu''il a lue ; une revision perimee fait rendre l''etat serveur au lieu de '
  'l''ecraser.';

-- Plafond de pile. Le handoff de design laissait la question ouverte (« Plafond
-- d'onglets : aucun dans la maquette. À trancher »). 24 est un backstop, pas la règle :
-- le client plafonne déjà à 24 et ferme le plus ancien onglet non épinglé au-delà. Le
-- CHECK n'existe que pour qu'un client fautif ne puisse pas faire grossir la ligne sans
-- borne — au-delà, `tabs` deviendrait un document TOAST et la lecture au boot ralentirait
-- l'ouverture du CRM pour tout le monde.
alter table public.crm_open_tabs drop constraint if exists crm_open_tabs_taille;
alter table public.crm_open_tabs add constraint crm_open_tabs_taille
  check (jsonb_array_length(tabs) <= 24);

alter table public.crm_open_tabs enable row level security;

-- ⚠ La révocation n'est PAS du zèle : les DEFAULT PRIVILEGES de ce projet accordent
-- d'office à `anon` jusqu'au TRUNCATE sur toute table fraîchement créée (mesuré le
-- 04.09.2026 : anon=arwdDxtm sur le schéma public). Sans elle, RLS resterait le seul
-- verrou d'une donnée personnelle.
revoke all on table public.crm_open_tabs from anon, authenticated;
grant select, insert, update, delete on table public.crm_open_tabs to authenticated;

-- Les quatre policies disent la MÊME chose : cette ligne est la tienne. Elles sont écrites
-- séparément plutôt qu'en un `for all` — c'est précisément le défaut corrigé le 17.08.2026
-- sur `whatsapp_agent_links`, où un `FOR ALL … USING` laissait n'importe qui s'attribuer la
-- ligne d'un tiers faute de `with check` sur l'INSERT.
drop policy if exists crm_open_tabs_select_own on public.crm_open_tabs;
create policy crm_open_tabs_select_own on public.crm_open_tabs
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists crm_open_tabs_insert_own on public.crm_open_tabs;
create policy crm_open_tabs_insert_own on public.crm_open_tabs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists crm_open_tabs_update_own on public.crm_open_tabs;
create policy crm_open_tabs_update_own on public.crm_open_tabs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists crm_open_tabs_delete_own on public.crm_open_tabs;
create policy crm_open_tabs_delete_own on public.crm_open_tabs
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- Écriture — un seul aller-retour, révision vérifiée.
--
-- `security invoker` : la fonction s'exécute sous la RLS de l'appelant, donc les policies
-- ci-dessus restent le mur. Le `auth.uid()` interne n'est pas une garde de plus, c'est ce
-- qui rend l'appel SANS paramètre d'identité : il n'y a pas de pile d'autrui à viser.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crm_tabs_save(
  p_tabs jsonb,
  p_active integer,
  p_revision bigint default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_cur  public.crm_open_tabs%rowtype;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_tabs is null or jsonb_typeof(p_tabs) <> 'array' then
    raise exception 'crm_tabs_save: p_tabs doit etre un tableau jsonb'
      using errcode = '22023';
  end if;

  select * into v_cur from public.crm_open_tabs where user_id = v_uid;

  -- Première écriture : aucune ligne, aucune révision à confronter.
  if not found then
    insert into public.crm_open_tabs (user_id, tabs, active_index, revision, updated_at)
    values (v_uid, p_tabs, greatest(coalesce(p_active, 0), 0), 1, now())
    returning * into v_cur;
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', false);
  end if;

  -- Révision périmée : on N'ÉCRASE PAS. On rend l'état courant, et c'est au client de
  -- l'adopter. `p_revision is null` vaut « je ne sais pas » et laisse passer — c'est le
  -- cas d'un client qui repart de zéro (première ouverture, cache vidé).
  if p_revision is not null and p_revision <> v_cur.revision then
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', true);
  end if;

  update public.crm_open_tabs
     set tabs = p_tabs,
         active_index = greatest(coalesce(p_active, 0), 0),
         revision = v_cur.revision + 1,
         updated_at = now()
   where user_id = v_uid
  returning * into v_cur;

  return jsonb_build_object(
    'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
    'revision', v_cur.revision, 'stale', false);
end;
$$;

comment on function public.crm_tabs_save(jsonb, integer, bigint) is
  'Ecrit la pile d''onglets de l''appelant. Rend {tabs, active_index, revision, stale}. '
  'stale=true : la revision envoyee etait perimee, RIEN n''a ete ecrit et l''etat rendu est '
  'celui du serveur — le client doit l''adopter.';

revoke all on function public.crm_tabs_save(jsonb, integer, bigint) from public, anon;
grant execute on function public.crm_tabs_save(jsonb, integer, bigint) to authenticated;

commit;
