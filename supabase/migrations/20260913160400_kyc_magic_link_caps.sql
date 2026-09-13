-- Lien magique KYC : des plafonds par lien tenus en base, et une table de pièces que plus
-- aucun rôle client n'écrit (audit du 13.09.2026, point S10).
--
-- ⛔ CE QUE LA BASE ACCEPTAIT, ÉPROUVÉ EN PRODUCTION (transaction annulée, 13.09.2026).
-- `authenticated` détenait INSERT, UPDATE et DELETE sur `kyc_magic_link_uploads`, et la
-- policy `kyc_magic_link_uploads_update_agency` laissait un agent modifier les lignes de son
-- agence. Un seul UPDATE suffisait donc à RATTACHER une pièce WhatsApp — celle qui porte
-- `ocr_fields` : nom, numéro de pièce, date de naissance — à un lien magique public :
--   update kyc_magic_link_uploads set magic_link_id = <lien vivant> where id = <pièce WA>
-- a rendu une ligne modifiée, et `magic-link-get` a ensuite servi ces champs à quiconque
-- tenait le lien. Le même geste contournait tout plafond posé à l'INSERT (rattacher mille
-- lignes à un lien), réécrivait `size_bytes`, et pointait vers le lien d'une AUTRE agence :
-- le WITH CHECK ne bornait que `agency_id`, jamais l'agence du lien visé.
--
-- LES ÉCRIVAINS RÉELS, relevés avant de révoquer — tous en service_role :
--   · `magic-link-upload`  : INSERT (le dépôt du client) ;
--   · `magic-link-confirm` : UPDATE de `confirmed_by_client` / `confirmed_at` ;
--   · `_shared/whatsapp-actions.ts` (pièce jointe par WhatsApp ou par le copilote web) :
--     INSERT, par le client service-role de `whatsapp-agent` et de `requireAgentAuth`.
-- Aucun fichier de `src/` n'écrit dans cette table, et les quatre fonctions SQL qui la
-- nomment (`kyc_magic_link_summary`, `get_admin_quota_breaches`, `get_admin_agency_usage`,
-- `get_admin_usage_overview`) ne font que la LIRE. Le droit d'écriture des rôles clients
-- ne servait donc qu'à la fuite ci-dessus : il est retiré. La lecture de l'agence reste.
--
-- POURQUOI UN TRIGGER, ET PAS SEULEMENT L'EDGE. `magic-link-upload` compte les pièces du
-- lien avant d'écrire, mais N dépôts parallèles lisent tous le même compte : seul un verrou
-- sur la ligne du LIEN (SELECT … FOR UPDATE) sérialise la 20ᵉ et la 21ᵉ pièce. Le même
-- verrou ferme la course dépôt/soumission : une confirmation qui passe le lien à
-- `submitted` attend la fin du dépôt en cours, et le dépôt suivant voit `submitted`.
--
-- POURQUOI PAR LIEN ET NON PAR IP. Le lien est la ressource rare — c'est un agent qui l'émet
-- —, et un limiteur par IP ne protège pas un lien transféré : une lecture suffit. Même
-- raisonnement que `appointment-book` (bornes par construction plutôt que compteur).
--
-- POURQUOI LES PIÈCES WHATSAPP SONT EXEMPTÉES. `magic_link_id` NULL = pièce jointe par un
-- agent AUTHENTIFIÉ sur son dossier (whatsapp-actions) : aucun lien public n'est en jeu, et
-- le dossier n'a pas de plafond de pièces.
--
-- POURQUOI SECURITY INVOKER. La fonction n'a besoin d'aucun privilège de plus que
-- l'écrivain : le service_role lit le lien et ses pièces. Et si un rôle client retrouvait un
-- jour un droit d'écriture, sa lecture du lien resterait bornée par sa RLS — le lien d'une
-- autre agence y serait « introuvable ».
--
-- Valeurs : miroir de `supabase/functions/_shared/magic-link-limits.ts` et de la page
-- publique, confrontées par `tests/unit/magic-link-upload-caps.spec.ts`.
-- Production le 13.09.2026 : 0 lien, 0 pièce — aucune donnée à migrer.
--
-- Rejouable (deploy.yml rejoue toute migration du jour à chaque push) : CREATE OR REPLACE,
-- DROP … IF EXISTS avant le trigger, REVOKE idempotents, et un bloc de contrôle final qui
-- n'écrit rien de durable.

create or replace function public.enforce_kyc_magic_link_upload_caps()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Miroir de _shared/magic-link-limits.ts (MAX_FILES_PER_LINK, MAX_BYTES_PER_LINK).
  c_max_files constant integer := 20;
  c_max_bytes constant bigint := 104857600;
  v_status  text;
  v_agency  uuid;
  v_expires timestamptz;
  v_files   integer;
  v_bytes   bigint;
begin
  -- Pièce WhatsApp : un agent authentifié dépose sur SON dossier, aucun lien public en jeu.
  if new.magic_link_id is null then
    return new;
  end if;

  -- UPDATE qui ne change rien de ce que les plafonds gouvernent (le SET ne fait que
  -- répéter les valeurs) : rien à revérifier, et pas de verrou à prendre.
  if tg_op = 'UPDATE' then
    if new.magic_link_id is not distinct from old.magic_link_id
       and new.size_bytes is not distinct from old.size_bytes
       and new.agency_id is not distinct from old.agency_id then
      return new;
    end if;
  end if;

  -- Verrou de la ligne du lien, tenu jusqu'à la fin de la transaction du dépôt : deux dépôts
  -- parallèles ne peuvent pas voir tous deux 19 pièces, et une soumission concurrente
  -- attend au lieu de croiser le dépôt.
  select l.status::text, l.agency_id, l.expires_at
    into v_status, v_agency, v_expires
    from public.kyc_magic_links l
   where l.id = new.magic_link_id
   for update;

  if not found then
    raise exception 'magic_link_not_found';
  end if;
  -- L'agence de la pièce est celle du lien : aucun rattachement ne franchit l'agence.
  if new.agency_id is distinct from v_agency then
    raise exception 'magic_link_agency_mismatch';
  end if;
  -- Un lien soumis ou expiré — par son statut ou par sa date — ne reçoit plus rien.
  if v_status in ('submitted', 'expired') or v_expires <= now() then
    raise exception 'magic_link_not_uploadable';
  end if;

  -- Les pièces DÉJÀ portées par le lien, hors la ligne en cours (cas de l'UPDATE).
  -- Servi par idx_kyc_magic_link_uploads_link ; au plus 20 lignes par construction.
  select count(*), coalesce(sum(u.size_bytes), 0)
    into v_files, v_bytes
    from public.kyc_magic_link_uploads u
   where u.magic_link_id = new.magic_link_id
     and u.id <> new.id;

  if v_files >= c_max_files or v_bytes + new.size_bytes > c_max_bytes then
    raise exception 'magic_link_upload_limit';
  end if;

  return new;
end;
$$;

comment on function public.enforce_kyc_magic_link_upload_caps() is
  'BEFORE INSERT OR UPDATE sur kyc_magic_link_uploads : un lien magique public porte au plus '
  '20 pièces / 100 Mo, ne reçoit plus rien une fois soumis ou expiré, et une pièce n''est '
  'jamais rattachée au lien d''une autre agence. Pièces WhatsApp (magic_link_id NULL) '
  'exemptées. Audit du 13.09.2026, point S10 (20260913160400).';

revoke all on function public.enforce_kyc_magic_link_upload_caps() from public, anon, authenticated;

drop trigger if exists trg_enforce_kyc_magic_link_upload_caps on public.kyc_magic_link_uploads;
create trigger trg_enforce_kyc_magic_link_upload_caps
  before insert or update of magic_link_id, size_bytes, agency_id
  on public.kyc_magic_link_uploads
  for each row execute function public.enforce_kyc_magic_link_upload_caps();

-- Écriture réservée au service. `anon` n'a plus aucun droit sur cette table depuis
-- 20260802223756 ; le rappel ici est idempotent et garde la règle lisible au même endroit.
revoke insert, update, delete on table public.kyc_magic_link_uploads from authenticated;
revoke insert, update, delete on table public.kyc_magic_link_uploads from anon;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL — la migration échoue plutôt que de laisser l'invariant faux.
-- Chaque négatif a son témoin : un catalogue mal lu, ou un trigger qui refuserait TOUT,
-- ne passerait pas les contrôles positifs.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_msg   text;
  v_state text;
begin
  -- 1. Plus aucun rôle client n'écrit dans la table…
  if has_table_privilege('authenticated', 'public.kyc_magic_link_uploads', 'INSERT')
     or has_table_privilege('authenticated', 'public.kyc_magic_link_uploads', 'UPDATE')
     or has_table_privilege('authenticated', 'public.kyc_magic_link_uploads', 'DELETE')
     or has_table_privilege('anon', 'public.kyc_magic_link_uploads', 'INSERT')
     or has_table_privilege('anon', 'public.kyc_magic_link_uploads', 'UPDATE')
     or has_table_privilege('anon', 'public.kyc_magic_link_uploads', 'DELETE') then
    raise exception 'S10 : un rôle client peut encore écrire dans kyc_magic_link_uploads';
  end if;
  -- … TÉMOINS : l'agence lit toujours ses pièces, le service les écrit toujours.
  if not has_table_privilege('authenticated', 'public.kyc_magic_link_uploads', 'SELECT') then
    raise exception 'S10 : authenticated a perdu la LECTURE de kyc_magic_link_uploads';
  end if;
  if not has_table_privilege('service_role', 'public.kyc_magic_link_uploads', 'INSERT') then
    raise exception 'S10 : service_role a perdu l''écriture de kyc_magic_link_uploads';
  end if;

  -- 2. Le trigger est posé, actif, BEFORE, sur INSERT ET sur UPDATE.
  if not exists (
    select 1
      from pg_trigger t
     where t.tgrelid = 'public.kyc_magic_link_uploads'::regclass
       and t.tgname = 'trg_enforce_kyc_magic_link_upload_caps'
       and t.tgenabled <> 'D'
       and (t.tgtype & 2) <> 0   -- BEFORE
       and (t.tgtype & 4) <> 0   -- INSERT
       and (t.tgtype & 16) <> 0  -- UPDATE
  ) then
    raise exception 'S10 : trigger de plafonds absent, désactivé ou mal typé';
  end if;

  -- 3. Épreuve de comportement, en sous-transaction TOUJOURS annulée (le bloc EXCEPTION
  --    rembobine tout ce qu'elle a écrit, même si l'insertion passait). Un lien inexistant
  --    doit être refusé PAR LE TRIGGER — sans lui, c'est la clé étrangère qui répondrait.
  begin
    insert into public.kyc_magic_link_uploads (magic_link_id, agency_id, filename, size_bytes, storage_path)
    values (gen_random_uuid(), gen_random_uuid(), 'sonde-s10', 1, 'sonde-s10');
    raise exception 'sonde_inseree';
  exception when others then
    get stacked diagnostics v_msg = message_text;
  end;
  if v_msg is distinct from 'magic_link_not_found' then
    raise exception 'S10 : un lien inexistant n''est pas refusé par le trigger (reçu : %)', v_msg;
  end if;

  --    TÉMOIN : une pièce WhatsApp (sans lien) TRAVERSE le trigger et n'échoue que plus
  --    loin, sur la clé étrangère (23503) — un trigger qui refuserait tout rougirait ici.
  begin
    insert into public.kyc_magic_link_uploads (kyc_case_id, agency_id, source, filename, size_bytes, storage_path)
    values (gen_random_uuid(), gen_random_uuid(), 'whatsapp', 'sonde-s10', 1, 'sonde-s10');
    raise exception 'sonde_inseree';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
  end;
  if v_state is distinct from '23503' then
    raise exception 'S10 : une pièce WhatsApp n''atteint plus la clé étrangère (sqlstate %)', v_state;
  end if;
end $$;
