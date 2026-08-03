-- Bucket `documents` : `image/webp` ajouté à la liste blanche, et la configuration du
-- bucket enfin VERSIONNÉE.
--
-- LE BUG (constaté le 02.08.2026). Le dépôt de pièce d'identité KYB propose et valide
-- `image/webp` côté client — `ACCEPTED_TYPES` (attribut `accept` de l'input,
-- StepPieceIdentite.tsx) et `ALLOWED_IDENTITY_DOCUMENT_TYPES` (useAgencyIdentity.ts,
-- consommé par validateIdentityDocumentFile). Le bucket, lui, le refusait :
-- `allowed_mime_types` valait en production {application/pdf, image/jpeg, image/png,
-- application/msword, …wordprocessingml.document}. Un recto/verso en WebP passait donc
-- la validation client, puis échouait au téléversement — sans qu'aucun des deux côtés
-- ne soit « faux » isolément.
--
-- POURQUOI ÉLARGIR LE BUCKET PLUTÔT QUE RESTREINDRE LE CLIENT. WebP est accepté
-- PARTOUT ailleurs dans le produit : avatars (useAvatar.ts), photos de bien
-- (useProperties.ts, ListingFormPage.tsx), dépôt KYC agent (KycUploadModal.tsx) et
-- public (MlkScreens.tsx, magic-link-upload). C'est ce bucket-ci qui est l'exception,
-- pas le client. Et le geste est purement ADDITIF sur un bucket partagé : élargir une
-- liste blanche ne peut casser aucun écrivain existant.
--
-- ⚠ POURQUOI LA LISTE EST RÉÉCRITE EN ENTIER, ET NON `array_append`. Cette
-- configuration a été posée À LA MAIN dans le dashboard le 19.03.2026, jour de création
-- du bucket. 20260527000000_documents_storage_bucket.sql est un
-- `INSERT … ON CONFLICT (id) DO NOTHING` sur un bucket qui existait déjà : un no-op,
-- qui n'a JAMAIS écrit ni `allowed_mime_types` ni `file_size_limit`. Sur une base
-- fraîche (CI, local) les deux colonnes valent donc NULL — « tout accepté, limite
-- globale » — pendant que la production porte une liste restrictive. Un `array_append`
-- sur NULL rend NULL : il aurait corrigé la production et laissé la dérive intacte.
-- D'où l'écriture de la configuration COMPLÈTE et voulue, identique des deux côtés.
--
-- Ne pas déduire cette configuration du fichier de migration voisin : elle ne s'y lit
-- pas. Les valeurs ci-dessous sont celles relevées dans `storage.buckets` en production
-- le 02.08.2026, `image/webp` en plus.
--
-- 20971520 = 20 Mio. Le client plafonne bien plus bas pour une pièce d'identité
-- (8 Mio, MAX_IDENTITY_DOCUMENT_BYTES) ; la limite du bucket reste la limite du bucket,
-- qui sert aussi le layout plat {agency_id}/{document_id}.pdf (cf. 20260527000000).
--
-- Idempotente : un UPDATE qui pose des valeurs fixes se rejoue sans effet (date-guard
-- de deploy.yml, cf. scripts/check-migration-idempotence.mjs).

update storage.buckets
set
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  file_size_limit = 20971520
where id = 'documents';
