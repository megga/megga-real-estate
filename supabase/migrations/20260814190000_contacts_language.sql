-- Langue de correspondance du contact.
--
-- CE N'EST PAS UN AJOUT, C'EST UNE RÉPARATION. `magic-link-send-email` (index.ts:352)
-- sélectionne déjà `contacts.language` en production alors que la colonne n'existe
-- pas : PostgREST rend 42703, `contactRes.data` vaut null, et la fonction sort en
-- « contact has no email » — un motif faux, en HTTP 200, avalé en fire-and-forget
-- par `magic-link-create` (:198). Résultat : AUCUN e-mail de lien magique KYC ne
-- peut partir, avec un moteur 4 langues (`normalizeLocale`, `STRINGS`) écrit
-- derrière et jamais atteint. Le défaut est resté invisible parce que
-- `kyc_magic_links` compte 0 ligne — l'absence était prise pour un manque d'usage.
--
-- Elle sert aussi, ensuite, à choisir la langue des templates WhatsApp hors
-- fenêtre 24h (`WaTemplateContext.lang`) : sans elle, les 20 traductions déposées
-- chez Meta partiraient toutes en français.
--
-- CHOIX, et pourquoi :
--   · `language` et non `lang` — en base, `lang` qualifie la langue d'un CONTENU
--     (contact_messages, translation_cache) et `language` celle d'une PERSONNE
--     (whatsapp_conversation_insights). Surtout : 4 appelants lisent déjà
--     `contacts.language`, dont une edge function déployée. Ce nom répare sans
--     éditer du code en production.
--   · text + CHECK et non enum — convention du schéma (les 4 colonnes énumérées
--     de `contacts` sont toutes text+CHECK). Un enum ne se rétrécit pas.
--   · valeurs identiques à `contact_messages_lang_check` (20260528140000) : même
--     canon produit fr/de/en/it, aucune convention nouvelle.
--   · NULLABLE, sans DEFAULT 'fr' — `contacts` réserve NOT NULL DEFAULT à l'état
--     de workflow et laisse NULLABLE l'identité déclarée (nationality,
--     residence_country, birth_date). Un défaut à 'fr' ferait AFFIRMER le français
--     pour 15 contacts dont personne n'a déclaré la langue, et épinglerait un
--     germanophone sur les templates FR. Le repli vit à la LECTURE, où il reste
--     révisable ; écrit en base, il devient indiscernable d'une déclaration.
--   · pas d'index — 15 lignes (règle §7 de CLAUDE.md : > 5K).
--
-- RLS : rien à écrire. `contacts` porte déjà 4 policies {authenticated} et RLS est
-- par LIGNE : une colonne nouvelle est couverte d'office. Les GRANT sont
-- table-level, donc hérités — ⛔ ne PAS ajouter de GRANT colonne, cela
-- convertirait le grant de table en grants de colonnes et figerait la table pour
-- les ajouts suivants.

--   · IF NOT EXISTS — `deploy.yml` rejoue TOUTE migration datée du jour à CHAQUE push,
--     et sans lui le second push lève 42701 « column already exists », coupe l'étape
--     (`set -e`) et emporte les migrations suivantes AVEC les Edge Functions. Mesuré sur
--     ce fichier même : Backend Integration Tests #31831596395. ⚠ Le contrôle statique
--     `lint:migrations` ne l'attrape pas — il lit les CREATE, pas les ALTER. Quand la
--     colonne existe déjà, tout l'ADD COLUMN est sauté, CHECK compris : la contrainte
--     posée au premier passage survit, aucun doublon n'est créé.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS language text NULL
    CHECK (language IN ('fr', 'de', 'en', 'it'));

COMMENT ON COLUMN public.contacts.language IS
  'Langue de correspondance du contact (ISO 639-1, canon produit fr/de/en/it). '
  'NULL = non renseignée, ce qui est distinct de « francophone » : les appelants '
  'replient sur ''fr'' à la lecture (normalizeLocale, buildTemplateMessage).';
