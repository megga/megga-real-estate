-- Le trigger d'inscription entre au contrôle de version.
--
-- public.handle_new_user() existe depuis la baseline et a été modifiée deux fois
-- (20260627120000 lockdown du rôle, 20260718130000 provisioning d'agence), mais le
-- TRIGGER qui l'appelle n'a jamais figuré dans aucune migration. Conséquences : en
-- local l'inscription ne crée ni profil ni agence (les tests backend contournaient en
-- posant le profil à la main), et en production le comportement de chaque signup
-- dépend d'un objet que personne ne peut relire ni restaurer.
--
-- ⚠ AVANT MERGE : confirmer le nom du trigger en production. S'il porte un autre nom,
-- celui-ci s'ajouterait au lieu de le remplacer et chaque inscription insérerait deux
-- fois. Le DROP ci-dessous ne couvre que le nom canonique.
--
-- Idempotente : DROP IF EXISTS puis CREATE.

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT sur auth.users (on_auth_user_created, versionné par 20260726140000) : crée le profil et provisionne l''agence des rôles agence. Best-effort sur l''agence, un échec ne bloque jamais l''inscription.';
