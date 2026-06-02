-- create_contact (copilote WhatsApp) crée un contact avec juste un nom : il ne fournit ni
-- email ni type. Or contacts.email ET contacts.type étaient NOT NULL sans défaut → la création
-- échouait (logs prod : « null value in column "email" / "type" ... violates not-null »).
--
-- On retire ces deux garde-fous au niveau du modèle de données :
--  - email FACULTATIF : un lead/contact peut n'avoir qu'un téléphone, voire rien au départ
--    (cas KYC : on screene une personne dont on n'a pas encore les coordonnées).
--  - type DEFAULT 'lead' : valeur valide du CHECK ; un contact créé à la volée est un lead que
--    l'agent qualifiera ensuite (cohérent avec les contacts whatsapp_ai existants, type='lead').
-- Idempotent (DROP NOT NULL / SET DEFAULT sont des no-op si déjà appliqués).

begin;

alter table public.contacts alter column email drop not null;
alter table public.contacts alter column type set default 'lead';

commit;
