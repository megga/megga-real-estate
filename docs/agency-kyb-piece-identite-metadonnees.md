# Pièce d'identité KYB — métadonnées GPS : note de décision

> **Pour qui :** Gregory (PO), pour arbitrage. Julien et qui reprendra le chantier KYB.
> **Écrit le :** 2 août 2026, **mis à jour le même jour** après la mesure EXIF sur les
> fichiers réels (§5) et la levée du blocage de la revue (#1098).
> **État :** en attente d'arbitrage sur Q1 et Q2 (§4). L'accès du relecteur au document,
> lui, est livré et vérifié en production.
>
> **Où ça se rattache :**
> - [agency-kyb-handoff.md](agency-kyb-handoff.md) §« Dettes identifiées en revue finale
>   (étape 2) » — la dette « pièces d'identité jamais purgées » y est écrite depuis le
>   26 juillet, avec son échéance. Cette note montre qu'elle commande l'arbitrage ci-dessous.
> - [agency-kyb-verification.md](agency-kyb-verification.md) — décisions de schéma et de
>   vérification.
> - La décision produit du 02.08.2026 elle-même ne vit nulle part dans `docs/` : seulement
>   dans un commentaire de composant et un message de commit (§2.1).

---

## En une minute

Une photo de cuisine se fait retirer son bloc GPS EXIF avant d'être téléversée
(`stripImageMetadata`, [src/hooks/useProperties.ts:327](../src/hooks/useProperties.ts)),
mais la photo de la carte d'identité d'un dirigeant — souvent prise à son domicile — part
avec le sien
(`uploadIdentityDocument`, [src/hooks/useAgencyIdentity.ts:752](../src/hooks/useAgencyIdentity.ts)).

Après vérification, la question n'est pas celle qu'on croyait.

| | |
|---|---|
| Le fait de départ | **vrai, et mesuré** : les deux fichiers réels portent un bloc GPS (§5) |
| La décision qui semblait fermer le débat | **ne dit pas ça** : elle refuse la **retouche**, pas les octets (§2.1) |
| L'examen humain qu'elle protège | **n'existe pas encore** dans le produit (§2.2) |
| Le vrai défaut | le fichier n'a **aucun cycle de vie** : rien ne l'efface, jamais (§2.3) |
| L'asymétrie invoquée | **joue en sens inverse** : la photo publique est bien plus exposée (§2.4) |
| Recommandation | voie **(b)**, voie **(c)** écartée, et **Q2 avant Q1** (§4) |

---

## 1. Le constat de départ

| | Photo de bien | Pièce d'identité du dirigeant |
|---|---|---|
| Traitement | ré-encodage canvas q0.95, retire EXIF/IPTC/XMP | **aucun** |
| Où | [useProperties.ts:327](../src/hooks/useProperties.ts), appelé lignes 283, 381, 421 | [useAgencyIdentity.ts:752](../src/hooks/useAgencyIdentity.ts) |
| Motif écrit | « nLPD art. 6 » (commentaire ligne 315-318) | — |

La contrainte posée le 02.08.2026 exclut de porter `stripImageMetadata` sur la pièce
d'identité : ce helper est *lossy* et réécrit tous les pixels.

---

## 2. Ce que la vérification a changé

### 2.1 La décision du 02.08 ne parle pas des octets

Son texte, en entier
([StepPieceIdentite.tsx:137-139](../src/components/crm-identity/steps/StepPieceIdentite.tsx)) :

> « Aucune **retouche** n'est proposée, et c'est délibéré : l'original déposé EST la pièce
> examinée par l'équipe conformité (décision produit du 02.08.2026, "l'original doit rester
> intact"). Une photo mal cadrée se reprend, elle ne se **rogne** pas. »

Elle refuse un **outil de recadrage**, pour que le relecteur juge le cadrage, la netteté et
les quatre coins sur ce que l'utilisateur a réellement produit. Elle ne dit rien du
conteneur du fichier.

Un retrait *lossless* de segment EXIF conserve **chaque pixel** et donc chaque propriété que
cette décision protège. La voie (b) n'est pas exclue par la décision telle qu'elle est
écrite. C'est le point à faire confirmer, et c'est la seule vraie question (Q1, §4).

La décision n'a par ailleurs **aucune source juridique** dans le dépôt : elle n'existe que
dans ce commentaire et dans le message du commit `112efcd9`. Les quatre documents de
`docs/compliance/` se déclarent eux-mêmes non relus par un juriste (le registre porte encore
`{{DATE_REVUE_AVOCAT}}`), et ne peuvent donc pas servir d'arbitre.

### 2.2 L'examen humain que la décision protège n'avait pas de chemin dans le produit

> ✅ **Résolu le 02.08.2026 au soir, PR #1098.** Ce qui suit décrit l'état constaté au moment
> de l'arbitrage ; il est conservé parce que c'est lui qui a motivé le correctif. La migration
> `20260802200000` ajoute `or public.is_super_admin()` à la **seule** policy SELECT du
> préfixe, imbriquée sous `bucket_id` et le test de préfixe, et l'écran de revue affiche
> désormais recto et verso. Vérifié en production : 1 policy sur 4 porte la branche, les
> `documents_bucket_*` sont intactes, 1 seule policy Storage modifiée sur 33.
>
> **Ce que cela ne change PAS à l'arbitrage :** voir la pièce ne veut pas dire la maîtriser.
> Le fichier n'a toujours ni propriétaire, ni rétention, ni purge (§2.3), et le viewer ne clôt
> pas le dossier à lui seul — après un verdict `match`, un dossier suisse reste en
> `manual_review`, `registry_lookup` étant plafonné à `partial`.

Vérifié **en production** le 02.08.2026 (`pg_policies` sur `storage.objects`) : les 8 policies
`documents_*` sont vivantes et identiques à la migration
[20260729150900](../supabase/migrations/20260729150900_kyb_identity_documents_storage.sql).
Les 4 policies du préfixe exigent :

```
lower(foldername[2]) = 'kyb-identity'
AND foldername[1] = get_my_agency_id()::text
AND is_agency_admin()
```

**Aucune branche `is_super_admin()`.** Un super-admin a `agency_id` NULL : il ne peut pas
ouvrir le fichier, quel que soit l'écran qu'on lui construirait. Et aucun écran de la console
n'appelle Storage (`rg -l "createSignedUrl|storage\.from" src/pages/admin src/components/admin`
ne renvoie rien ; les trois seuls `createSignedUrl` du front sont le wizard du déposant et
deux écrans KYC contact).

La RPC `admin_resolve_agency_id_document` justifie pourtant son contrat par « Le relecteur A
le document sous les yeux »
([20260729151500:581](../supabase/migrations/20260729151500_agency_review_queue.sql)). C'est
faux dans le code livré : le relecteur tranche match/partial/mismatch sur un nom de fichier
et trois boutons.

> La contrainte défend donc un usage **futur**, pas un usage constaté. Cela ne la rend pas
> illégitime — mais l'arbitrage doit le savoir.
>
> ⚠ *Correction du 02.08, après cadrage :* cette section affirmait qu'un viewer « exigera une
> migration RLS ». C'est vrai d'une des deux voies seulement. Une Edge Function gardée par
> `require-super-admin` reçoit déjà un client `service_role` (qui contourne la RLS) et peut
> donc émettre une URL signée sans qu'aucune policy ne bouge. Laisser la phrase d'origine
> écartait cette voie sans arbitrage.
>
> À savoir aussi : le viewer **ne débloque pas le dossier à lui seul**. Après un verdict
> `match`, un dossier suisse reste en `manual_review`, parce que `registry_lookup` est
> plafonné à `partial` faute de statut actif/radié dans LINDAS. Le viewer rend possibles les
> deux gestes suivants, il ne clôt pas le dossier.

### 2.3 Le vrai défaut : ce fichier n'a aucun cycle de vie

`uploadIdentityDocument` ne fait que `list` / `remove` / `upload` / `invalidate`. Il **n'écrit
aucune ligne en base** — l'en-tête de section le dit noir sur blanc
([useAgencyIdentity.ts:458](../src/hooks/useAgencyIdentity.ts), « Aucune ligne DB n'est écrite
ici »), et `submit_agency_identity` le confirme (« cette RPC ne touche jamais au fichier
lui-même »).

Conséquences, chacune vérifiée :

| Mécanisme | Pourquoi il ne voit pas ce fichier |
|---|---|
| `delete-account` | ne balaie que les `storage_path` lus dans la table `documents` ([index.ts:239-263](../supabase/functions/delete-account/index.ts)) |
| `set_kyc_document_retention` | ne pose `retention_until` que `IF NEW.kyc_case_id IS NOT NULL` (vérifié en prod) |
| `enforce_kyc_retention` | ne protège que `IF OLD.kyc_case_id IS NOT NULL` (vérifié en prod) |
| crons de purge | le seul cron Storage vise `property-photos/chat-staging` |
| UI | le hook n'expose aucune suppression, l'écran n'a pas de bouton |

**Le fichier n'a ni propriétaire, ni fin de vie, ni lecteur.** Le GPS est un passager : quelle
que soit la voie retenue, il reste indéfiniment, parce que le fichier reste indéfiniment.

La dette est déjà écrite, datée et assortie de son échéance
([agency-kyb-handoff.md](agency-kyb-handoff.md), §« Dettes identifiées en revue finale ») :
« rétention sans propriétaire ni moyen de purge, dans la fonctionnalité même qui porte la
conformité. **À traiter avant qu'une vraie pièce d'identité soit déposée.** »

> ⚠ **Le geste correctif évident est un piège.** Créer une ligne `documents` pour indexer le
> fichier le ferait tomber dans le filtre de `delete-account`
> (`.is('kyc_case_id', null).eq('uploaded_by', userId)`) : le dirigeant effacerait sa propre
> pièce de conformité en supprimant son compte, et sans aucune protection de rétention,
> puisque les deux triggers 10 ans ne s'arment que sur `kyc_case_id NOT NULL`. **Indexer** et
> **protéger** sont deux gestes distincts, à décider ensemble.
>
> Le crochet existe déjà : `agency_person_verification_checks.raw_response`, colonne présente
> et déjà remontée à la console par `get_admin_agency_review_detail`. Et comme
> `identityDocumentFolder()` est déterministe, une purge peut de toute façon lister le
> préfixe sans chemin stocké.

### 2.4 L'asymétrie invoquée joue en sens inverse

| | Photo de bien | Pièce d'identité |
|---|---|---|
| Bucket | `property-photos`, **public** | `documents`, **privé** |
| Lisible par | `anon`, sans authentification | dirigeant de sa propre agence seulement |
| Diffusion | miroir R2 non signé, CSV IDX poussé par FTP chez un portail tiers | URL signée 300 s, **zéro** surface qui la lise |

Deux ordres de grandeur séparent les deux surfaces. Dire « incohérent » les écrase. À
l'inverse, le risque propre à la pièce d'identité n'est pas la **largeur** d'exposition,
c'est la **durée** (§2.3).

Note annexe utile à l'arbitrage : `stripImageMetadata` n'est de toute façon pas la protection
portante des photos de bien. `photo-processor` décode et ré-encode en JPEG côté serveur
([index.ts:146,166](../supabase/functions/photo-processor/index.ts)), et la copie Supabase est
supprimée ensuite. Le strip client protège la copie de **staging** — qui transite
obligatoirement par un bucket public — et le cas de repli, pas l'artefact final.

---

## 3. Les trois voies, avec leur coût réel

### (a) Ne rien faire, documenter le risque accepté

**Coût :** nul. **Achète :** la cohérence avec la décision lue au sens strict.
**N'achète pas :** la position GPS du domicile d'un dirigeant reste indéfiniment, sans
finalité déclarée, sur un fichier que rien ne sait effacer. La pièce n'est dans aucune des
12 activités du registre des traitements.

### (b) Retrait lossless du segment EXIF — **recommandée**

Parcourir les marqueurs de tête d'un JPEG, retirer `APP1/Exif`, `APP1/XMP`, `APP13/IPTC` et
`COM`, s'arrêter au **premier `SOS`**, recopier toute la queue octet pour octet.

**Coût :** ~90 à 140 lignes plus les tests, **aucune dépendance nouvelle** (rien dans
`package.json` ne sait le faire, et le seul code de conteneur du dépôt — `findJumbfBox`,
`c2pa-verify` — est un balayage naïf inutilisable comme base).

**Ce qui ne casse pas :** ce chemin ne calcule **aucun** hash
(`rg "digest|hash|crypto" src/hooks/useAgencyIdentity.ts` → 0 ligne), contrairement aux trois
chemins KYC qui, eux, posent un SHA-256 destiné à un auditeur. Réécrire le conteneur ici ne
rompt aucune chaîne de preuve. Skribble ne signe que des lignes de `documents`, où cette
pièce n'apparaît pas.

**Ce que ça ne couvre pas, à dire franchement** (la mesure du §5 en a ajouté un troisième
point, le plus gênant) **:**

- **L'index MPF, qu'un retrait naïf casse en silence.** Les fichiers réels contiennent des
  images imbriquées (MPF) — mesuré : 2 images pour le recto, 3 pour le verso. Bonne
  nouvelle, **aucune ne porte d'EXIF ni de GPS** (§5), donc retirer le `APP1` de tête suffit
  à faire disparaître les coordonnées. Mais les décalages du MPF sont comptés depuis son
  propre en-tête TIFF : retirer un segment en amont les décale tous, et **l'index pointe
  alors à côté**. Le fichier s'ouvre encore (l'image primaire est intacte) mais sa structure
  devient silencieusement incohérente. L'implémentation doit donc soit retirer aussi le
  segment MPF et les images qui le suivent — JPEG propre à une seule image, pixels primaires
  identiques octet pour octet, au prix de la carte de gain HDR —, soit réécrire les
  décalages. La première voie est plus simple et plus honnête.

- **`application/pdf`**, pourtant format accepté
  ([useAgencyIdentity.ts:523](../src/hooks/useAgencyIdentity.ts), et proposé à l'input) : un
  scan de passeport fait au téléphone porte ses octets JPEG en flux `DCTDecode`, hors de
  portée d'un retrait de segment. Le nettoyer exigerait un parseur PDF.
- PNG et WebP : bénéfice marginal (chunk `eXIf` rare en pratique).

**Deux points d'implémentation à ne pas rater :**

1. Les JPEG de ce dépôt sont **progressifs** (SOF2, 4 marqueurs `SOS`, 62 octets bourrés
   `0xFF00` après le premier scan, mesuré). La règle « s'arrêter au premier `SOS` et recopier
   la queue verbatim » n'est pas une simplification, c'est la **seule** implémentation
   correcte.
2. **Au dépôt, jamais rétroactivement.** `agency_person_verification_checks` porte un verdict
   humain *append-only* et daté ; un strip appliqué après revue laisserait ce verdict désigner
   un fichier qui a changé, sans que rien en base permette de le constater.

Comme `stripImageMetadata`, ce serait un contrôle **client**, donc contournable par un appel
direct à l'API Storage par un dirigeant de l'agence. À ne pas vendre comme une garantie.

### (c) Conserver deux fichiers — **écartée**

**Forme obligatoire si elle était retenue :** les originaux dans un **sous-dossier**
`{agency}/kyb-identity/{person}/original/`, jamais un suffixe plat. La variante spontanée
`recto.original.jpg` est piégée deux fois : elle est captée par
`files.find(f => f.name.startsWith('recto.'))`
([useAgencyIdentity.ts:518](../src/hooks/useAgencyIdentity.ts)) **et elle gagne le `.find`**
selon les extensions (`recto.original.jpg` précède `recto.png` en tri ascendant, tri par
défaut de `list()`) — l'écran afficherait alors le fichier **non** scrubé. Un sous-dossier
revient comme une entrée `{ name: 'original', id: null }` qui ne matche aucun côté, et
`foldername[2]` reste `'kyb-identity'` : les 8 policies suivent sans modification.

**Pourquoi elle est écartée quand même :** elle double une PII sensible **dont on ne sait pas
effacer la première copie** (§2.3), et la copie scrubée qu'elle protège n'a aujourd'hui aucun
tiers à protéger — personne d'autre que le déposant ne peut lire ce fichier (§2.2). Elle
n'achète rien et aggrave la dette. **Strictement dominée par (a).**

*(Elle laisse par ailleurs s'accumuler des originaux périmés introuvables : le nettoyage au
changement d'extension ne regarde que la racine, [lignes 742-750](../src/hooks/useAgencyIdentity.ts).)*

---

## 4. Les deux questions à trancher

### Q2 — à traiter **en premier**, indépendante du choix de voie

> **La pièce d'identité n'a aucun chemin de suppression. On la rend purgeable maintenant, ou
> on assume explicitement ?**

> ➡ **Trois mécanismes concrets sont désormais posés pour y répondre :**
> [agency-kyb-purge-piece-identite.md](agency-kyb-purge-piece-identite.md). Ils ne diffèrent
> que sur l'événement qui démarre le délai, et la note y ajoute deux décisions transverses —
> dont celle-ci, qui n'avait pas été vue : le dirigeant peut **déjà** effacer sa propre pièce,
> sans qu'aucune trace n'en subsiste.

C'est la dette déjà écrite, avec son échéance déjà passée (« avant qu'une vraie pièce
d'identité soit déposée »). Un scrub posé sur un fichier éternel corrige le passager et laisse
le véhicule. Voir l'avertissement du §2.3 : **indexer** et **protéger** doivent être décidés
ensemble.

### Q1 — celle qui décide entre (a) et (b)

> **« L'original doit rester intact » vise-t-il ce que le relecteur VOIT (cadrage, netteté,
> les quatre coins), ou les OCTETS du fichier ?**

- Si c'est ce qu'il **voit** — ce que dit le texte de la décision (§2.1) — alors **(b)** est
  compatible : pixels identiques, conteneur allégé.
- Si c'est les **octets**, alors **(a)**, et on documente le risque accepté.

Dans les deux cas, **(c)** est écartée.

---

## 5. Ce qui a été mesuré, et ce qui reste à mesurer

### ✅ Mesuré le 02.08.2026 sur les deux fichiers réels — **le GPS est là**

Contrôle de présence sur les 128 premiers Ko de chaque objet (les métadonnées vivent en tête
de fichier), sans jamais lire ni imprimer une seule valeur :

| | recto.jpg | verso.jpg |
|---|---|---|
| EXIF | oui | oui |
| **bloc GPS** | **oui** | **oui** |
| XMP | oui | non |
| marque/modèle d'appareil | oui | oui |
| segments | `APP0, APP1/Exif, APP1/XMP, APP2, APP2, APP10` | `APP0, APP1/Exif, APP2, APP2, APP2, APP10` |

Trois conséquences.

1. **Le sujet n'est pas théorique.** La position d'enregistrement de la photo est dans les
   fichiers, et elle y restera aussi longtemps qu'eux, c'est-à-dire indéfiniment (§2.3).
2. **Ce sont des originaux d'appareil.** La présence de la marque et du modèle prouve qu'iOS
   n'a rien ré-encodé à la sélection. L'hypothèse « le téléphone nettoie tout seul » est
   morte, et la question HEIC du prérequis n°1 se referme en partie : quel que soit le chemin
   d'arrivée, le fichier conserve ses métadonnées d'appareil.
3. **Le XMP compte.** Présent sur le recto, il peut porter de la géolocalisation lui aussi :
   un retrait lossless doit viser `APP1/Exif` **et** `APP1/XMP`.

### ✅ Le MPF, mesuré le 02.08.2026 — le piège redouté ne mord pas, un autre apparaît

Les deux à trois segments `APP2` sont la signature d'un iPhone : `APP2` y porte le profil ICC
**et le MPF** (Multi-Picture Format, CIPA DC-007), qui peut embarquer des images
supplémentaires. La crainte était qu'une image imbriquée porte son propre `APP1/Exif` : le
GPS survivrait au retrait du `APP1` de tête, et le correctif passerait pour fait sans l'être.

| | images déclarées | imbriquées | EXIF | GPS |
|---|---|---|---|---|
| recto.jpg | 2 | 1 (411 Ko) | non | **non** |
| verso.jpg | 3 | 2 (225 et 91 Ko) | non | **non** |

**Aucune image imbriquée ne porte de métadonnées.** Retirer `APP1/Exif` (et `APP1/XMP` sur le
recto) suffit donc à faire disparaître les coordonnées de ces fichiers.

> ⚠ **Mais la mesure révèle un autre problème, plus concret.** Les décalages du MPF sont
> comptés depuis le début de son propre en-tête TIFF. Retirer un segment `APP1` en amont
> décale tout ce qui suit : **l'index MPF pointe alors à côté**. Le fichier continue de
> s'ouvrir — l'image primaire est intacte — mais sa structure devient silencieusement
> incohérente. Un retrait « lossless » naïf produit donc un fichier subtilement malformé.
> Deux issues, à décider en implémentant : retirer aussi le segment MPF **et** les images qui
> le suivent (JPEG propre à une seule image, pixels primaires identiques octet pour octet, au
> prix de la carte de gain HDR), ou réécrire les décalages. La première est plus simple.
>
> ⚠ **Portée de ce constat : deux fichiers, un seul appareil.** La spécification MPF AUTORISE
> une image imbriquée porteuse d'EXIF, et un autre modèle — ou un mode Portrait, Live Photo,
> HDR — pourrait en produire une. Ce résultat ne vaut pas garantie pour les dépôts futurs :
> une implémentation prudente vérifie aussi les images imbriquées, ou les supprime, ce qui
> règle la question définitivement.

Le segment `urn:iso:std:` relevé sur le verso est une carte de gain HDR ISO, pas un porteur
de géolocalisation.

### Ce qui reste ouvert

1. **Le taux de PDF réels.** Si les dépôts sont majoritairement des scans PDF, (b) ne couvre
   presque rien et (a) devient le choix honnête. Le seul dossier existant est en JPEG.
2. **HEIC, ce qu'il en reste.** `image/heic` est refusé côté client
   ([useAgencyIdentity.ts:537](../src/hooks/useAgencyIdentity.ts)), avec un message qui ne le
   nomme jamais. La mesure ci-dessus montre que le fichier finalement déposé est un JPEG
   d'appareil complet, mais elle ne dit pas ce que voit un utilisateur dont le téléphone
   produit du HEIC : il se heurte peut-être à un refus qu'il ne comprend pas. Reste à
   éprouver sur un vrai iPhone.

---

## 6. Hors périmètre, mais relevé au passage

### Un bug vivant : le WebP est accepté côté client et refusé côté serveur

Vérifié en production : le bucket `documents` porte
`allowed_mime_types = {application/pdf, image/jpeg, image/png, application/msword, docx}` et
`file_size_limit = 20 Mio`. **`image/webp` n'y est pas.** Or il est proposé par
`ACCEPTED_TYPES`
([StepPieceIdentite.tsx:59](../src/components/crm-identity/steps/StepPieceIdentite.tsx))
et accepté par `ALLOWED_IDENTITY_DOCUMENT_TYPES`
([useAgencyIdentity.ts:523](../src/hooks/useAgencyIdentity.ts)). **Un recto en WebP passe la
validation client et échoue au téléversement.**

Cette configuration de bucket a été posée hors dépôt (le bucket date du 19.03.2026 ; la
migration [20260527000000](../supabase/migrations/20260527000000_documents_storage_bucket.sql)
est un `ON CONFLICT DO NOTHING`, donc un no-op) : elle est **invisible en lecture de code** et
non reproductible sur une base fraîche.

### Le périmètre est plus large que deux points

Quatre chemins déposent une pièce d'identité ou un justificatif de personne physique sans
aucun traitement :

| Chemin | Bucket | Remarque |
|---|---|---|
| [useKyc.ts:149](../src/hooks/useKyc.ts) | `kyc-documents` | **aucune** validation MIME ni taille côté applicatif, et le bucket est lui aussi `NULL/NULL` |
| [magic-link-upload/index.ts:179](../supabase/functions/magic-link-upload/index.ts) | `kyc-magic-link` | **accepte `image/heic` de bout en bout** |
| [whatsapp-actions.ts:1374](../supabase/functions/_shared/whatsapp-actions.ts) | `kyc-magic-link` | pièce reçue par WhatsApp |
| [useAgencyIdentity.ts:752](../src/hooks/useAgencyIdentity.ts) | `documents` | celui de cette note |

> Le flux **client** accepte donc brut le format le plus chargé en GPS, tandis que le flux
> dirigeant le refuse. **Corriger le KYB seul durcirait la branche la moins exposée.**

À noter aussi : [whatsapp-actions.ts:3172](../supabase/functions/_shared/whatsapp-actions.ts)
dépose les photos de bien reçues par WhatsApp dans le bucket **public** `property-photos` sans
passer par `stripImageMetadata` — l'objet est supprimé après ré-encodage, mais tout orphelin
laissé par ce `remove` best-effort reste lisible publiquement, le cron de purge ne filtrant que
le préfixe `/chat-staging/`.

---

## 7. Comment ces constats ont été établis

Lecture du dépôt à la date du 02.08.2026, plus des requêtes sur la base de **production**
`eayczugyrvmtqnnmvjod` : `pg_policies` sur `storage.objects`, `storage.buckets`,
`pg_get_functiondef` sur les deux triggers de rétention et sur `is_super_admin()` /
`super_admin_allowlist_match()`. Les constats issus des seuls fichiers de migration sont
signalés comme tels ; ceux vérifiés en base portent la mention « vérifié en production ».

**La mesure du §5** a été faite sur les deux objets réels via des URL signées de courte durée,
en ne téléchargeant que les 128 premiers Ko de chaque fichier (l'EXIF vit en tête, juste après
le SOI). Aucune image n'a été décodée, aucun fichier écrit sur disque, et **aucune valeur de
métadonnée n'a été lue ni rapportée** : uniquement des présences. Le parseur avait été éprouvé
au préalable sur deux JPEG témoins fabriqués pour ça, l'un avec un pointeur d'IFD GPS et
l'autre nu, afin que l'instrument soit vérifié avant d'être pointé sur une pièce d'identité.

**La seconde mesure du §5**, sur le MPF, a suivi la même discipline : lecture de l'index
`APP2/MPF` dans les 128 premiers Ko, puis une tranche de 64 Ko à la position déclarée de
chaque image imbriquée — jamais le fichier entier, jamais un décodage, jamais une valeur.
Elle a levé une hypothèse (le piège redouté ne se matérialise pas) et en a produit un
constat neuf (les décalages MPF qu'un retrait casse).

Restent des **hypothèses**, étiquetées comme telles : la généralisation du résultat MPF au-delà
de ces deux fichiers et de cet appareil — la spécification autorise le cas contraire —, ce que
Safari iOS livre à un utilisateur dont le téléphone produit du HEIC, et la présence effective
de GPS dans les médias entrants WhatsApp, qui dépend du ré-encodage côté Meta et n'est pas
prouvable depuis ce dépôt.
