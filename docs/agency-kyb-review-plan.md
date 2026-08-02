# Revue KYB côté MEGGA — plan de ce qui reste à faire

> Établi le 2 août 2026, après la refonte du wizard d'identité (#1069, #1081).
> Tout ce qui suit est **mesuré dans le dépôt**, pas supposé. Chaque affirmation
> porte sa preuve.
>
> ⚠ Un autre chantier construit la console de revue en parallèle. Ce document
> décrit **ce qui manque**, pas comment le construire : il est fait pour être
> confronté à ce chantier, pas pour le remplacer. Les lots sont ordonnés par
> gravité, pas par commodité.

---

## Le constat qui commande tout le reste

**Le relecteur peut déjà rendre un verdict sur une pièce d'identité qu'il n'a
aucun moyen d'ouvrir.**

Ce n'est pas une tournure. Les deux moitiés sont vraies séparément :

- Le verdict existe. `useAdminKybReview.ts:406` expose `resolveIdentityDocument`,
  qui appelle `admin_resolve_agency_id_document(p_agency_id, p_check_id, p_result)`
  avec `p_result` valant `match`, `partial` ou `mismatch`, puis relance la revue.
  La page l'affiche (`AdminKybReviewPage.tsx:404`, motif `id_document_pending`,
  icône `IdCard`).
- La lecture est refusée. La policy de `storage.objects`
  (`20260729150900_kyb_identity_documents_storage.sql`) exige :

  ```sql
  and (storage.foldername(name))[1] = public.get_my_agency_id()::text
  and public.is_agency_admin()
  ```

  Un relecteur MEGGA n'est ni membre de l'agence examinée, ni son administrateur.
  Les deux conditions échouent. Et `grep -rn createSignedUrl src/pages/admin
  src/components/admin` ne renvoie **rien** : aucune tentative de lecture n'existe
  côté console.

Autrement dit, le produit demande aujourd'hui à un humain d'attester une
vérification qu'il ne peut pas effectuer. Pour une pièce LAB, c'est la classe de
défaut la plus coûteuse : la trace d'audit est complète, signée, horodatée, et
elle atteste d'un examen qui n'a pas eu lieu.

Le commentaire de migration `20260731121000:254` écrit « le relecteur a le
document sous les yeux ». C'est une intention, pas une implémentation.

---

## Lot 0 — Ouvrir la lecture au relecteur (bloquant)

Rien d'autre n'a de sens tant que ce lot n'est pas fait. Trois voies possibles,
avec leurs conséquences.

**(a) Élargir la policy `select` à `is_super_admin()`.** Une ligne de migration.
Simple, mais elle donne à tout super-admin un accès direct au bucket, hors de
toute traçabilité : le téléchargement d'une pièce d'identité ne laisserait
aucune trace. À écarter pour une PII de ce niveau.

**(b) Une RPC `SECURITY DEFINER` qui émet une URL signée et journalise.**
`admin_sign_agency_id_document(p_agency_id, p_related_person_id, p_side)` :
garde `is_super_admin()`, écrit un `activity_events` **avant** de rendre l'URL,
et renvoie une URL de courte durée. La lecture devient un geste tracé, comme
l'impersonation l'est déjà (`admin_log_impersonation`, bloquante).
⚠ Une RPC Postgres ne peut pas signer une URL Storage seule : il faut une Edge
Function, ou l'appel `createSignedUrl` fait côté serveur avec la clé de service.

**(c) Une Edge Function dédiée.** Même contrat que (b), mais elle peut signer.
Garde `_shared/require-super-admin.ts` (déjà employée ailleurs), journalisation,
puis `createSignedUrl`. C'est la voie la plus alignée sur ce qui existe.

**Recommandation : (c).** Elle seule satisfait les trois exigences ensemble —
le relecteur voit, l'accès est tracé, et le bucket reste fermé.

**À trancher par le PO** : la lecture d'une pièce d'identité doit-elle être
journalisée nominativement, et cette trace est-elle consultable par l'agence
concernée ? La LPD pousse vers oui ; le produit n'a pas encore de surface pour
l'exposer.

---

## Lot 1 — Le visionneur

Ne rien inventer : `KycDocViewer.tsx` fait déjà exactement ce travail pour le
parcours KYC client, et ses pièges sont documentés sur place.

À reprendre tel quel :
- URL **re-signée à l'ouverture** (120 s), jamais l'URL de la liste. Celle du
  wizard expire en 300 s (`useAgencyIdentity.ts:585`).
- Image : l'URL signée dans un `<img>`, qui n'exécute aucun script.
- PDF : `fetch` puis `Blob` au type **forcé** `application/pdf` en iframe, jamais
  l'URL Storage brute. Et **pas de `sandbox`** — constat empirique consigné :
  l'attribut vide le visionneur Chromium.
- Recto **et** verso côte à côte : le relecteur compare, il ne feuillette pas.

À ajouter, propre à la revue :
- l'état « aucune pièce déposée », distinct de « échec de lecture » ;
- le nom de la personne à qui la pièce appartient, affiché avec elle. Une agence
  peut avoir plusieurs signataires actifs (`signature_power = 'joint'`) : montrer
  un document sans dire de qui il est invite à valider le mauvais.

---

## Lot 2 — Le score qui n'existe pas

Indépendant du lot 0, et probablement plus rentable à l'heure de travail.

[Issue #1061](https://github.com/megga/megga-real-estate/issues/1061), **ouverte**
au 2 août 2026 : le secret Supabase `MAPBOX_TOKEN` n'est pas posé. Le connecteur
de géocodage tourne dans une Edge Function, côté serveur — il lui faut le jeton
dans les secrets Supabase, pas dans le build.

Conséquence, telle que CLAUDE.md la décrit : le moteur exclut `unavailable` du
numérateur **et** du dénominateur ; or les trois seuls checks scorables
(`vat_lookup` 3.00, `address_geocode` 1.50, `domain_whois_age` 0.75) sortent tous
`unavailable` aujourd'hui. Donc `verification_score` vaut **NULL pour tout dossier
suisse**, et la file de revue trie sur des NULL.

Le relecteur n'a donc aucun ordre de priorité : il traite les dossiers dans
l'ordre où ils arrivent, sans savoir lequel mérite son attention.

⚠ Vérifier la restriction **URL referrer** du jeton avant de le poser : un jeton
restreint fonctionne dans le navigateur et échoue depuis une Edge Function, qui
appelle sans referrer. Il faudra peut-être deux valeurs distinctes.

**Ce lot ne demande aucun code.** C'est un secret à poser, et il est pris en
compte sans redéploiement.

---

## Lot 3 — Que la trace dise ce qui a été fait

Aujourd'hui, `admin_resolve_agency_id_document` enregistre un verdict. Elle
n'enregistre pas que le relecteur a **ouvert** le document.

Une fois le lot 0 en place, les deux faits deviennent séparables et doivent le
rester : « a consulté la pièce recto de X le J à H » et « a conclu `match` ».
Un audit LAB qui ne peut pas distinguer les deux ne prouve rien.

Piège connu du dépôt, à ne pas rejouer : `activity_events` refuse
`category='compliance'` (le CHECK échoue) — utiliser `category='kyc'`, comme
`submit_agency_identity`.

---

## Lot 4 — Les angles morts déjà connus

Ni bloquants ni urgents, mais à ne pas re-découvrir :

- **Un dossier suisse ne peut pas s'auto-valider.** LINDAS ne publie pas le
  statut actif/radié, ce qui plafonne `registry_lookup` à `partial`. Toute
  agence suisse passera donc par une revue humaine, par construction. Le lot 0
  n'est pas un confort : c'est le chemin normal.
- **Le Liechtenstein n'est servi par rien.** Il est l'un des trois pays
  sélectionnables au wizard, et aucun de ses quatre vétos d'entité ne peut être
  satisfait : `oera.li` n'a pas d'API publique et n'est pas dans LINDAS, qui
  publie le registre suisse. Dette assumée, documentée dans
  `docs/agency-kyb-handoff.md`.
- **Le registre UID** (`UID_REGISTER_API_URL` / `_CREDENTIAL`) n'est pas
  configuré, et le connecteur n'est pas écrit. Poser les secrets seuls ne
  débloque rien — le squelette lève `KybSourceNotWiredError` et le dit.

---

## Ordre proposé

1. **Lot 2** en premier. Aucun code, effet immédiat sur la priorisation, et il
   débloque aussi les cartes du CRM.
2. **Lot 0**, voie (c). C'est le mur.
3. **Lot 1**, en reprenant `KycDocViewer` plutôt qu'en réécrivant.
4. **Lot 3**, dans la même PR que le lot 0 si possible : la journalisation de la
   lecture appartient au geste qui l'autorise.

Le lot 4 ne se planifie pas, il se rappelle.

---

## Ce que ce plan ne dit pas

Il ne dit rien de l'ergonomie de la file de revue, des filtres, ni du volume
attendu — ces questions appartiennent au chantier en cours et se trancheront sur
pièces. Il ne dit rien non plus du sort des pièces d'identité à la clôture d'un
compte : `delete-account` ne balaie que les `storage_path` de la table
`documents`, où ces fichiers n'ont **aucune ligne**. C'est une question de
rétention, distincte de la revue, et elle mérite son propre examen.
