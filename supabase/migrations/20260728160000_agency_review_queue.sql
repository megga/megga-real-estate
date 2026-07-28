-- Etape 5 du chantier KYB, tache 1 -- la couche de donnees de la file de revue.
--
-- Contexte (docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md, « Pourquoi
-- cette etape est le chemin critique » ; docs/agency-kyb-handoff.md §7bis) : aucune
-- agence, d'aucun pays, ne peut etre auto-validee aujourd'hui -- deux des quatre
-- vetos d'entite n'ont aucun connecteur, et la piece d'identite reste en
-- pending_manual_review de facon permanente tant que rien ne la resout. La revue
-- humaine n'est donc pas une voie de secours pour les cas douteux : c'est l'UNIQUE
-- voie. Tant que cette file n'existe pas, aucun dossier soumis ne peut aboutir.
--
-- Deux fonctions, lecture seule, reservees au super-admin (console admin.megga.ch) :
--   - get_admin_agency_review_queue()            -- la liste des dossiers a trancher.
--   - get_admin_agency_review_detail(p_agency_id) -- le detail d'un dossier, check
--     par check, avec le poids EN VIGUEUR A LA DATE DU CHECK (jointure temporelle).
--
-- Patron P3 (20260726001000/20260726002000, « EXECUTE authenticated, la garde
-- interne filtre ») : GRANT a authenticated -- la console admin appelle depuis un
-- navigateur, sous un jeton authenticated, jamais service_role -- gardee par
-- is_super_admin() A L'INTERIEUR du corps. Un SECURITY DEFINER ne rejoue jamais les
-- policies RLS des tables qu'il touche : la garde doit donc etre explicite, pas
-- deleguee a la RLS de agencies / agency_verification_checks.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, CREATE INDEX IF NOT EXISTS, REVOKE/GRANT
-- rejouables sans effet de bord.

-- ─── (1) get_admin_agency_review_queue() : la liste ─────────────────────────────────
--
-- Un seul filtre : verification_status = 'manual_review'. Volontairement SANS colonne
-- de priorite derivee (decision de conception d'Antoine, docs/superpowers/specs/
-- 2026-07-26-onboarding-kyb-design.md §10) : le tri sur le score suffit.
--
-- Ce seul filtre fait AUSSI remonter, sans logique dediee, les dossiers que
-- sweep_pending_agency_verifications() (20260728150000) a abandonnes apres avoir
-- epuise ses 5 tentatives : ce filet bascule lui-meme verification_status vers
-- 'manual_review' quand la borne est atteinte (voir son en-tete). Sans cette etape,
-- ces dossiers resteraient invisibles indefiniment -- exactement le trou que ce filet
-- vient de creuser cote moteur et que cette file doit combler.
--
-- ORDER BY verification_score ASC NULLS FIRST : un score NULL (aucun check scorable
-- pour l'instant -- cas nominal d'un dossier jamais traite par le moteur, dont le
-- filet epuise ci-dessus est un exemple precis) est le cas le PLUS opaque, pas le
-- moins urgent -- on n'a meme pas un score bas a se mettre sous la dent. Le classer
-- APRES les scores connus (comportement par defaut de Postgres pour ASC) l'enterrerait
-- en bas de file alors qu'il merite le meme traitement prioritaire qu'un score
-- catastrophique. NULLS FIRST rend ce choix explicite plutot que de dependre d'un
-- comportement par defaut que le lecteur devrait deviner.
create or replace function public.get_admin_agency_review_queue()
returns table (
  agency_id                   uuid,
  agency_name                 text,
  country                     text,
  verification_status         text,
  verification_score          numeric,
  identity_submitted_at       timestamptz,
  verification_sweep_attempts smallint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    coalesce(a.legal_name, a.name),
    a.country,
    a.verification_status,
    a.verification_score,
    a.identity_submitted_at,
    a.verification_sweep_attempts
  from public.agencies a
  where a.verification_status = 'manual_review'
  order by a.verification_score asc nulls first, a.identity_submitted_at asc;
end;
$$;

comment on function public.get_admin_agency_review_queue() is
  'File de revue KYB (etape 5) : dossiers en manual_review, tries par verification_score croissant (NULLS FIRST -- un score jamais calcule est le cas le plus opaque, pas le moins urgent), les plus douteux en tete. Sans colonne de priorite derivee : le tri suffit. Fait remonter, par le seul jeu de ce filtre, les dossiers que sweep_pending_agency_verifications() a bascules en manual_review apres avoir epuise ses tentatives (20260728150000). super_admin uniquement (patron P3 : EXECUTE authenticated, garde interne is_super_admin()). Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

-- Partial index couvrant EXACTEMENT le WHERE + ORDER BY ci-dessus (regle perf
-- CLAUDE.md §7). Distinct de idx_agencies_verification_review (20260728101000, sur
-- verified_at -- un filtre different pour un autre usage) : verified_at ne sert a
-- rien ici, il vaut TOUJOURS NULL pour un dossier manual_review (pose uniquement sur
-- une conclusion positive du moteur -- recompute_agency_verification, 20260728130000,
-- etape 4). NULLS FIRST pose explicitement dans l'index pour correspondre AU TRI
-- DEMANDE et rester utilisable sans tri supplementaire en memoire.
create index if not exists idx_agencies_review_queue_score
  on public.agencies (verification_score asc nulls first)
  where verification_status = 'manual_review';

-- ─── (2) get_admin_agency_review_detail(agency_id) : le detail ──────────────────────
--
-- Chaque check, ENTITE et PERSONNE confondus, avec le poids et le statut de veto EN
-- VIGUEUR A LA DATE DU CHECK -- jointure temporelle reprise TERME A TERME de
-- recompute_agency_verification (20260728130000, CTE `scored`) : meme predicat
-- (valid_from <= checked_at and (valid_to is null or valid_to > checked_at)), meme
-- departage (valid_from desc, id desc -- la ligne de config la plus recemment ouverte
-- l'emporte si, par correction de donnees, deux fenetres fermees se chevauchent). Un
-- dossier douteux d'hier doit rester justifiable avec le bareme d'hier, jamais
-- reinterprete avec le bareme d'aujourd'hui -- voir l'en-tete de 20260728130000 pour
-- le raisonnement complet et les deux regressions qu'il documente.
--
-- DEUX differences DELIBEREES avec la jointure du moteur, jamais une approximation :
--   1. LEFT JOIN LATERAL, jamais un JOIN (INNER) : le moteur peut legitimement
--      IGNORER un check qui ne rejoint aucune config. Un detail d'AUDIT ne le peut
--      pas -- un check sans ligne de config retrouvee doit rester visible (poids
--      NULL, explicite), jamais disparaitre silencieusement du dossier.
--   2. AUCUN filtre `and not c.is_veto` dans la sous-requete laterale : le moteur
--      l'ajoute pour EXCLURE les vetos du calcul de score. Ce detail affiche au
--      contraire TOUS les checks, vetos compris -- un veto echoue est tres
--      probablement LA RAISON pour laquelle le dossier est en revue ; le cacher
--      viderait l'ecran de sa reponse la plus importante. `is_veto` (lu sur la meme
--      ligne de config, sans cout supplementaire) accompagne toujours le poids : un
--      poids a 0.00 sans cet indicateur se lirait a tort comme « un signal qui n'a
--      pese pour rien », alors qu'un veto est hors score par construction.
--
-- AUCUNE restriction aux signataires actifs cote personne (contrairement au moteur,
-- qui ne score que les signataires actifs -- 20260728130000, CTE `active_signatories`) :
-- ce detail retourne les checks de TOUTE personne liee a l'agence (UBO compris,
-- signataire radie compris). Un dossier peut etre en revue precisement PARCE QU'aucun
-- signataire actif n'est identifie (recompute_agency_verification, v_has_active_signatory)
-- -- restreindre le detail au perimetre du moteur cacherait alors la seule piste
-- utile : « voici les personnes declarees, et voici pourquoi aucune ne compte comme
-- signataire actif ».
--
-- UNION ALL plutot que deux appels separes cote client : un seul aller-retour, un seul
-- tri chronologique unifie (checked_at desc) -- l'historique COMPLET, pas seulement le
-- dernier check par type (contrairement au moteur, qui deduplique via distinct on pour
-- le SCORE ; un AUDIT veut voir qu'un registry_lookup a d'abord echoue avant de
-- reussir, pas seulement son dernier etat).
create or replace function public.get_admin_agency_review_detail(p_agency_id uuid)
returns table (
  check_id          uuid,
  related_person_id uuid,
  check_type        text,
  source            text,
  result            text,
  raw_response      jsonb,
  checked_at        timestamptz,
  applicable_weight numeric,
  is_veto           boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    avc.id as check_id,
    null::uuid as related_person_id,
    avc.check_type,
    avc.source,
    avc.result,
    avc.raw_response,
    avc.checked_at,
    cfg.weight as applicable_weight,
    cfg.is_veto
  from public.agency_verification_checks avc
  left join lateral (
    select c.weight, c.is_veto
    from public.verification_check_config c
    where c.check_type = avc.check_type
      and c.valid_from <= avc.checked_at
      and (c.valid_to is null or c.valid_to > avc.checked_at)
    order by c.valid_from desc, c.id desc
    limit 1
  ) cfg on true
  where avc.agency_id = p_agency_id

  union all

  select
    apvc.id,
    apvc.related_person_id,
    apvc.check_type,
    apvc.source,
    apvc.result,
    apvc.raw_response,
    apvc.checked_at,
    cfg.weight,
    cfg.is_veto
  from public.agency_person_verification_checks apvc
  join public.agency_related_persons arp on arp.id = apvc.related_person_id
  left join lateral (
    select c.weight, c.is_veto
    from public.verification_check_config c
    where c.check_type = apvc.check_type
      and c.valid_from <= apvc.checked_at
      and (c.valid_to is null or c.valid_to > apvc.checked_at)
    order by c.valid_from desc, c.id desc
    limit 1
  ) cfg on true
  where arp.agency_id = p_agency_id

  order by checked_at desc, check_id desc;
end;
$$;

comment on function public.get_admin_agency_review_detail(uuid) is
  'Detail d''un dossier KYB (etape 5) : chaque check, ENTITE et PERSONNE confondus (toute personne liee, pas seulement les signataires actifs), avec type, source, resultat, reponse brute et applicable_weight -- le poids EN VIGUEUR A LA DATE DU CHECK (jointure temporelle reprise de recompute_agency_verification, 20260728130000), jamais le poids courant. LEFT JOIN (jamais INNER) et sans filtre is_veto dans la sous-requete : contrairement au moteur de score, ce detail n''omet et n''exclut aucun check, vetos compris -- is_veto accompagne toujours applicable_weight pour une lecture correcte. Historique complet (pas de deduplication au dernier check par type), trie checked_at desc. super_admin uniquement (patron P3). Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

-- ── Grants (patron P3 : EXECUTE authenticated, la garde interne filtre) ──────────────
revoke all on function public.get_admin_agency_review_queue() from public, anon;
revoke all on function public.get_admin_agency_review_detail(uuid) from public, anon;
grant execute on function public.get_admin_agency_review_queue() to authenticated, service_role;
grant execute on function public.get_admin_agency_review_detail(uuid) to authenticated, service_role;
