-- Suppression PAR NUMÉRO, GLOBALE au WABA. Le WABA est mono-numéro : Meta ne connaît
-- que le numéro, et une plainte fait chuter le quality rating de TOUS les tenants.
-- Un STOP posé chez l'agence A bloque le numéro pour l'agence B — assumé, seule lecture
-- honnête d'un expéditeur partagé.
--
-- Nommée `contact_suppressions` et NON `whatsapp_suppressions` : `send-relance-email`
-- (:67) promet déjà « répondez STOP » depuis noreply@megga.ch, sans reply_to et sans
-- aucune réception d'e-mail dans le dépôt. Le canal e-mail devra rentrer ici. Renommer
-- coûte zéro tant que la table est vide, et une réécriture des 12 appelants après.
--
-- ⚠ AUCUN APPELANT À CE STADE (lot L1). La table et ses RPC sont la PORTE, pas le mur :
-- les 12 sites d'envoi ne consultent encore rien. Le câblage vient en L3/L4.
begin;

create table if not exists public.contact_suppressions (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  channel       text        not null check (channel in ('whatsapp','email','all')),
  wa_phone      text        not null check (wa_phone ~ '^[0-9]{6,15}$'),
  reason        text        not null check (reason in
                  ('stop_keyword','meta_block','agent_manual','bounce_hard')),
  source_ref    text        null,   -- whatsapp_messages.id du STOP
  contact_id    uuid        null,   -- SANS FK, cf. COMMENT
  agency_id     uuid        null,   -- agence CONSTATANTE, jamais un filtre de portée

  -- L'accusé de désinscription porte l'avis LPD (art. 19 nLPD). Il part UNE fois par
  -- suppression — pas « une fois par 24 h » : l'unicité de la ligne active EST le plafond.
  ack_sent_at   timestamptz null,

  -- ⛔ PAS de DELETE pour lever un blocage, et PAS de levée par un opt-in tiers.
  -- La levée par `click_to_wa`/`web_form_doubleoptin` est calculée PAR SUJET dans
  -- whatsapp_send_allowed : un opt-in obtenu par l'agence B ne doit pas effacer le STOP
  -- reçu chez l'agence A. Ici, seule une correction humaine explicite écrit lifted_*.
  lifted_at     timestamptz null,
  lifted_reason text        null check (lifted_reason is null
                  or lifted_reason in ('super_admin','saisie_erronee')),
  lifted_by     uuid        null,

  constraint contact_suppressions_lift_coherence check (
    (lifted_at is null and lifted_reason is null)
    or (lifted_at is not null and lifted_reason is not null))
);

comment on table public.contact_suppressions is
  'Numéros à ne plus contacter, par canal. Le blocage vit sur le NUMÉRO (ce que Meta '
  'connaît), pas sur la fiche (ce que MEGGA croit) : il survit à la suppression du contact '
  'et vaut pour toutes les agences du WABA partagé. La levée est PAR SUJET, calculée dans '
  'whatsapp_send_allowed — jamais un DELETE.';

comment on column public.contact_suppressions.contact_id is
  'uuid NU, sans FK ni cascade — DÉLIBÉRÉ. La policy contacts_delete (baseline:7546) '
  'autorise un agent authenticated à SUPPRIMER DUR un contact (contacts n''a pas de '
  'deleted_at) : une FK CASCADE ferait disparaître le blocage au moment exact où il sert.';

comment on column public.contact_suppressions.agency_id is
  'Agence CONSTATANTE (celle qui a reçu le STOP), jamais un filtre de portée. NULL est '
  'nominal : pickTriageAgency rend null dès qu''il y a ≥2 agences vérifiées. La lecture ne '
  'filtre JAMAIS sur cette colonne — un NULL vaut « toutes agences ».';

-- Unicité sur le numéro ACTIF par canal, via normalize_phone (= 9 derniers chiffres,
-- baseline:2306). POURQUOI pas l'égalité stricte : Meta livre `from` en E.164
-- ('41791112233') mais l'outbound dérive le numéro de contacts.phone, saisi en national
-- ('079 111 22 33') — aucun contrôle E.164 n'existe sur le chemin sortant. Comparer les
-- chaînes brutes laisserait passer 100 % des envois vers un numéro qui a dit STOP.
-- CAVEAT : 9 chiffres peuvent collisionner entre pays. Inerte au pilote CH ; à revoir à
-- l'ouverture FR/US. L'asymétrie tranche : un faux positif = un contact silencieux visible
-- dans le CRM ; un faux négatif = une plainte sur un WABA partagé par tous les tenants.
create unique index if not exists uq_contact_suppressions_active
  on public.contact_suppressions (public.normalize_phone(wa_phone), channel)
  where lifted_at is null;

create index if not exists idx_contact_suppressions_contact
  on public.contact_suppressions (contact_id) where contact_id is not null;

alter table public.contact_suppressions enable row level security;
-- ⚠ La révocation n'est PAS du zèle : les DEFAULT PRIVILEGES de ce projet accordent
-- d'office à `anon` jusqu'au TRUNCATE sur une table fraîchement créée (75 tables mesurées
-- le 03.08.2026). Sans elle, RLS resterait le seul verrou d'un registre de conformité.
revoke all on table public.contact_suppressions from anon, authenticated;
grant select on table public.contact_suppressions to authenticated;

-- L'agence VOIT le blocage de SES contacts — sinon l'UI ne peut pas expliquer pourquoi
-- « Envoyer » est grisé, et l'agent réessaie en boucle. Un numéro bloqué sans contact ni
-- agence reste invisible : ce n'est pas sa donnée.
drop policy if exists cs_select_agency on public.contact_suppressions;
create policy cs_select_agency on public.contact_suppressions
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id())
      or exists (select 1 from public.contacts c
                 where c.id = contact_suppressions.contact_id
                   and c.agency_id = (select public.get_my_agency_id())));

drop policy if exists cs_select_super on public.contact_suppressions;
create policy cs_select_super on public.contact_suppressions
  for select to authenticated using ((select public.is_super_admin()));

commit;
