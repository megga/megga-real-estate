-- Cache de LISTE sur contacts. Il sert la sélection en masse et l'affichage ; la décision
-- d'envoi lit le REGISTRE. Le chantier d'origine faisait l'inverse, de sorte qu'un import
-- direct ou une RPC contournée faisait envoyer sur une donnée fausse.
--
-- Deux colonnes du brief sont ABSENTES, à dessein : `do_not_contact` (elle doublonnait
-- contact_suppressions — deux états pour un fait ⇒ deux vérités) et `consent_source` avec
-- son second CHECK (deux CHECK sur le même domaine, dont l'un échoue DANS la RPC et tombe
-- dans un catch : la violation devient invisible).
begin;
alter table public.contacts add column if not exists wa_opt_in      boolean not null default false;
alter table public.contacts add column if not exists wa_consent_at  timestamptz null;
alter table public.contacts add column if not exists wa_opt_out_at  timestamptz null;
-- Permet à l'UI d'expliquer le grisage SANS appel réseau. Sans lui, l'agent voit
-- « contactable », sélectionne en masse, et n'obtient qu'un refus opaque.
alter table public.contacts add column if not exists wa_suppressed  boolean not null default false;

create index if not exists idx_contacts_wa_contactable
  on public.contacts (agency_id)
  where wa_opt_in = true and wa_opt_out_at is null and wa_suppressed = false;

comment on column public.contacts.wa_opt_in is
  'CACHE DE LISTE — jamais source de vérité, JAMAIS lu par la garde d''envoi. Écrit '
  'uniquement par record_whatsapp_consent. Sert la sélection en masse et l''affichage ; '
  'la décision d''envoi lit le REGISTRE (whatsapp_send_allowed).';
comment on column public.contacts.wa_opt_out_at is
  'Horodatage du DERNIER opt-out. Il se DATE, il ne s''efface pas : le remettre à NULL sur '
  'un opt-in ultérieur ferait réapparaître dans idx_contacts_wa_contactable un contact qui '
  'a dit STOP.';
comment on column public.contacts.wa_suppressed is
  'Vrai si une ligne contact_suppressions active (channel whatsapp|all) porte ce contact. '
  'Recalculé par record_whatsapp_consent, réconcilié la nuit (L6).';
commit;
