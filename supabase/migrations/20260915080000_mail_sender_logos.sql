-- ============================================================================
-- Messagerie : les logos des expéditeurs (14.09.2026, Julien : « un icône relié aux
-- logos des entreprises, comme Spark »).
--
-- Le logo se résout CHEZ NOUS (edge `mail-logos`, `_shared/mail/logos.ts` : BIMI, puis
-- les icônes du site de l'expéditeur) et se range ici, en base64. Aucun service tiers :
-- les successeurs de Clearbit exigent qu'on charge chaque logo chez eux depuis le
-- navigateur, et verraient passer avec qui chaque agence correspond.
--
-- ⛔ LE CACHE EST PAR BOÎTE, PAS PAR DOMAINE, ET CE N'EST PAS UN OUBLI DE DÉDOUBLONNAGE.
-- Une table globale lisible des agents livrerait la liste des correspondants de toutes
-- les agences ; même rangée par agence, elle révélerait à tout le bureau les domaines
-- d'une boîte PERSONNELLE (`visibility = 'owner'`) — la clinique, l'avocat. La ligne se
-- lit donc sous la règle même des courriers : `mail_account_visible(account_id)`.
-- ⛔ Et l'edge ne recopie JAMAIS un logo d'une boîte à l'autre : une réponse instantanée
-- trahirait, au chronomètre, qu'une autre boîte reçoit du courrier de ce domaine.
--
-- Écritures : service_role SEUL (l'edge). Un agent ne peut ni poser ni effacer un logo.
-- Suppression : en cascade avec la boîte (déconnexion, suppression de compte).
--
-- IDEMPOTENT (la CI rejoue les migrations du jour) : IF NOT EXISTS, et chaque contrainte
-- par la paire `drop … if exists` / `add` — cf. l'en-tête de 20260904074500_mail_module.
-- ⚠ DATÉE DU LENDEMAIN : le date-guard de deploy.yml n'applique que `stamp >= jour du
-- déploiement` (UTC). Mergée après le 15.09.2026, elle doit être RENOMMÉE au jour du merge.
-- ============================================================================

create table if not exists public.mail_sender_logos (
  account_id  uuid not null references public.mail_accounts(id) on delete cascade,
  domain      text not null,
  status      text not null,
  source      text,
  mime        text,
  data        text,
  checked_at  timestamptz not null default now(),
  primary key (account_id, domain)
);

alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_status_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_status_chk
  check (status in ('found', 'none'));

alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_source_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_source_chk
  check (source is null or source in ('bimi', 'apple-touch-icon', 'icon', 'favicon'));

-- Un logo « trouvé » porte ses octets et leur type ; un « rien » n'en porte aucun.
alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_found_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_found_chk
  check ((status = 'found') = (data is not null and mime is not null and source is not null));

-- Le résolveur ne sait lire que des images : le type rangé est l'un de ceux qu'il reconnaît.
alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_mime_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_mime_chk
  check (mime is null or mime in ('image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/svg+xml'));

-- 96 Kio d'octets font 131 072 caractères de base64 : au-delà, ce n'est plus une pastille.
alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_data_size_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_data_size_chk
  check (data is null or length(data) <= 131072);

alter table public.mail_sender_logos drop constraint if exists mail_sender_logos_domain_chk;
alter table public.mail_sender_logos add constraint mail_sender_logos_domain_chk
  check (domain = lower(domain) and domain ~ '^[a-z0-9.-]{4,253}$');

alter table public.mail_sender_logos enable row level security;

-- Même prudence que le socle : les privilèges par défaut du projet accordent trop.
revoke all on public.mail_sender_logos from anon, authenticated;
grant select on public.mail_sender_logos to authenticated;

drop policy if exists mail_sender_logos_select on public.mail_sender_logos;
create policy mail_sender_logos_select on public.mail_sender_logos for select to authenticated
  using (public.mail_account_visible(account_id));

comment on table public.mail_sender_logos is
  'Logos des expéditeurs de la Messagerie, par boîte (visibilité des courriers). Résolus par l''edge mail-logos (BIMI, icônes du site), jamais par un tiers. Écriture service_role seule.';
