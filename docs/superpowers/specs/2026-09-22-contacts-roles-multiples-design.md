# Les rôles multiples d'un contact (conception)

**Date :** 22.09.2026 · **Statut :** validé par Julien le 22.09.2026 · **Étape 3** de la [feuille de route](../feuille-de-route.md) · **Demande 6** du cahier des charges de Gregory (P0, taille S).

## 1. La décision

> « Un même contact peut être à la fois vendeur et prescripteur, et on liste en un clic tous les private bankers. » (critère d'acceptation du cahier des charges, 21.09.2026)

Un contact porte aujourd'hui **un seul** type. Il en portera **plusieurs**, pris dans un vocabulaire de douze rôles. L'ancien type devient un rôle parmi d'autres, sans perte.

Cinq décisions de Julien, le 22.09.2026 :

1. **Douze rôles** : les dix de Gregory, plus locataire et bailleur, qui existent déjà et pilotent la location. « Prospect » n'est pas un rôle mais un stade : **un contact sans rôle est un lead**.
2. **Deux familles, un seul vocabulaire** : cinq rôles de TRANSACTION commandent les écrans, sept rôles de RÉSEAU décrivent.
3. **Une colonne liste sur `contacts`**, source de vérité, avec un déclencheur qui tient `contacts.type` d'accord **dans les deux sens**.
4. **Sous-nav courte + sélecteur « Rôle »** : la barre garde ses quatre entrées, un sélecteur liste les rôles présents avec leur compte.
5. **Une pastille + « +2 »** sur une ligne de liste ; la fiche montre tout.

## 2. Ce qu'on a mesuré

En production le 22.09.2026 (lecture seule) :

| Mesure | Valeur |
|---|---|
| Contacts | **16** — 8 `buyer`, 7 `lead`, 1 `seller` |
| Contacts portant `investor`, `tenant`, `landlord` ou `both` | **0** |
| `contacts.type` | `text NOT NULL`, **défaut `'lead'`**, `CHECK` sur 7 valeurs, index simple `idx_contacts_type` |
| Recherches actives (`client_searches`) | 4 |

Dans le dépôt, le type est lu ou écrit à **103 endroits** : 17 le filtrent ou le comptent, 28 en tirent un comportement, 24 l'affichent, 18 chemins de code l'écrivent (plus 22 fixtures de banc et ~40 de tests), 16 objets SQL en dépendent. L'i18n en compte **41 clés** sur 9 blocs, dont **10 mortes**.

**Trois constats qui orientent la conception :**

1. **Le type n'est pas le proxy du matching.** Le moteur ne lit jamais `contacts.type` : il lit `client_searches`. Le type décide seulement, en amont, **si on écrit des critères** — et il en décide de **deux façons qui divergent** : à la création, `buyerSide = type ∈ {buyer, tenant}` ([ContactsPage.tsx:82](../../../src/pages/agent/ContactsPage.tsx)) ; sur la fiche, tout ce qui n'est **ni** `seller` **ni** `landlord` ([ContactDetailPage.tsx:212](../../../src/pages/agent/ContactDetailPage.tsx)). Un investisseur créé dans l'écran n'a donc jamais de critères, donc jamais de match — mais il en gagne s'il passe par sa fiche.
2. **Trois des sept valeurs sont inaccessibles.** Aucune surface de création n'écrit `investor`, `both` ni `landlord` côté mobile : la modale propose quatre valeurs, le mobile trois, l'extraction IA trois (`buyer`, `seller`, `tenant`). `both` ne s'obtient que par un import ou un UPDATE non contraint.
3. **Ce qui est aplati l'est de plusieurs façons, sans accord.** `audienceOf` range `investor`, `both` et `lead` dans « Acquéreurs » ; `mapContactType` les aplatit en `buyer`/`mixed` ; `deriveKycType` envoie `seller` et `landlord` côté vendeur, `deriveDealParty` **seulement** `seller`. Le même contact bailleur est vendeur pour le KYC et acheteur pour le pipeline.

## 3. Principes

1. **Rien ne se perd.** Chaque type existant devient un ou deux rôles ; aucun contact ne change de comportement à la migration.
2. **Une seule vérité, deux écritures.** `roles` fait foi ; `type` en dérive et reste écrit, parce que 103 emplacements le lisent — dont trois politiques RLS et quatre fonctions SQL.
3. **Un rôle de transaction dit ce qu'on FAIT avec cette personne.** Un rôle de réseau dit qui elle EST. Les deux se cumulent.
4. **On ne devine pas un rôle.** Ni l'IA ni un déclencheur n'attribue « avocat » ou « family office » : c'est une saisie de l'agent.
5. **Taille S.** Le périmètre s'arrête aux écrans Contacts et à la base. Les relations, les organisations et le score par rôle sont l'étape 6.

## 4. Le vocabulaire

Douze rôles, slugs en anglais comme le reste de la base, libellés en quatre langues.

**L'ordre de ce tableau fait foi** partout où il faut choisir UN rôle : la dérivation de `type` (§5) et la pastille d'une ligne (§7) le suivent, et le suivent pareil.

| Famille | Slug | FR | Commande |
|---|---|---|---|
| Transaction | `buyer` | Acquéreur | demande |
| Transaction | `seller` | Vendeur | offre |
| Transaction | `tenant` | Locataire | demande |
| Transaction | `landlord` | Bailleur | offre |
| Transaction | `investor` | Investisseur | demande |
| Réseau | `family_office` | Family office | — |
| Réseau | `referrer` | Prescripteur | — |
| Réseau | `private_banker` | Private banker | — |
| Réseau | `lawyer` | Avocat | — |
| Réseau | `trustee` | Trustee | — |
| Réseau | `broker` | Courtier | — |
| Réseau | `architect` | Architecte | — |

⚠ **`landlord` se dit « Bailleur »**, partout. Le dépôt le nomme aujourd'hui « Propriétaire » dans deux blocs (`contacts:contactType`, `calendar:role`) et « Bailleur » dans trois autres : deux mots pour la même valeur, sur des écrans voisins. Le nouveau bloc tranche pour « Bailleur », le pendant de « Locataire ».

⚠ **`both` ne survit pas comme rôle** : c'est exactement ce que les rôles multiples remplacent. Il reste une valeur légale de `type` (le déclencheur l'écrit quand un contact est acquéreur **et** vendeur), donc les onze emplacements qui le lisent continuent de fonctionner.

## 5. Le modèle

```sql
alter table contacts
  add column roles text[] not null default '{}',
  add constraint contacts_roles_valides check (
    roles <@ array['buyer','seller','tenant','landlord','investor',
                   'family_office','referrer','private_banker','lawyer','trustee','broker','architect']::text[]
  );
create index idx_contacts_roles on contacts using gin (roles);
```

**Le déclencheur `contacts_roles_sync` (BEFORE INSERT OR UPDATE)** tient les deux colonnes d'accord :

- **`roles` écrit** ⇒ `type` recalculé : `both` si `buyer` et (`seller` ou `landlord`) ; sinon le premier rôle de transaction dans l'ordre du tableau du §4 ; sinon **`lead`**.
- **`type` écrit seul** (l'IA d'extraction, la RPC `create_lead_with_optional_deal`, un import) ⇒ le rôle correspondant est **ajouté** à `roles`, sans effacer les autres ; `both` ajoute `buyer` et `seller` ; `lead` n'ajoute rien.
- **Les deux dans la même écriture** ⇒ `roles` gagne.
- ⛔ Le déclencheur ne retire **jamais** un rôle de réseau : `type` n'en parle pas, il ne peut donc pas en décider.

**La migration** dérive les rôles du type de chaque contact, puis laisse le déclencheur faire foi :

| `type` | `roles` |
|---|---|
| `buyer` | `{buyer}` |
| `seller` | `{seller}` |
| `tenant` | `{tenant}` |
| `landlord` | `{landlord}` |
| `investor` | `{investor}` |
| `both` | `{buyer,seller}` |
| `lead` | `{}` |

Sur les 16 contacts de production : 8 en `{buyer}`, 1 en `{seller}`, 7 sans rôle — sept leads, ce qu'ils sont.

⚠ **L'index existant `idx_contacts_type` reste** : trois politiques RLS et quatre fonctions SQL lisent encore `type`.

## 6. Ce qu'un rôle commande

**Une seule règle remplace les deux qui divergent :**

> Les critères de recherche s'écrivent, et le bloc s'affiche, dès que le contact porte un rôle de **demande** — `buyer`, `tenant` ou `investor` — **ou** qu'il a déjà des critères. Un contact qui ne porte que des rôles d'**offre** (`seller`, `landlord`) range ce qu'il propose dans `form_data.offer`, sans matching, comme aujourd'hui.

Trois conséquences voulues :

1. **Un vendeur qui achète existe enfin.** `{seller, buyer}` voit ses critères — la colonne bascule
   côté demande. ⚠ **Elle n'affiche qu'UN bloc**, pas les deux : le bien qu'il confie reste en base
   (`form_data.offer`) sans être relu sur la fiche. Deux blocs simultanés demandent une conception
   de cette colonne que personne n'a faite ; le mandat d'un vendeur vit de toute façon dans Mes
   biens, pas dans ce bloc (relevé à l'exécution, 22.09.2026).
2. **Un investisseur matche.** Il ne matchait jamais, faute de critères écrits.
3. **Un contact qui ne porte que des rôles de réseau** (un avocat, un private banker) n'a ni
   critères ni bien, et le sélecteur de rôle le trouve. ⚠ **La fiche lui montre encore le bloc
   « ce qu'il propose », vide** : un troisième état de cette colonne — n'afficher aucun des deux —
   reste à dessiner, rien ne dit aujourd'hui ce qu'il contiendrait (relevé à l'exécution, 22.09.2026).

**Ce qui continue de lire `type`, inchangé et tenu par le déclencheur** : le KYC (`deriveKycType`), la partie d'un deal (`deriveDealParty`), les relances du moteur d'automatisations, les trois politiques RLS du portail vendeur, les quatre fonctions SQL, le mobile, le tri du propriétaire d'un mandat, la liste des visiteurs possibles.

⚠ **Une exception dans le périmètre.** La règle R3 du moteur d'automatisations relance les leads dormants à 30 jours sur `type ∈ {buyer, lead, investor, both}`. Un contact qui ne porte que des rôles de réseau prend `type = 'lead'` : sans garde, l'avocat de l'étude devient un « lead dormant » à relancer. R3 exclura donc les contacts dont **tous** les rôles sont de réseau. C'est une ligne, et elle évite une relance absurde dès le premier contact de réseau saisi.

## 7. Les écrans

**La liste.** La sous-nav garde ses quatre entrées — Tous, Acquéreurs, Vendeurs, Locataires — mais l'appartenance devient **« porte ce rôle »** au lieu du rangement exclusif d'aujourd'hui : `audienceOf` disparaît. Un contact à deux rôles apparaît sous les deux ; un contact sans rôle n'apparaît que sous « Tous ». À côté, un sélecteur **« Rôle »** qui ne liste que les rôles **présents** dans le portefeuille, chacun avec son compte, calculé sur les contacts chargés comme les segments actuels. Le filtre est une position d'écran (`useTabScopedState`), au même titre que le filtre d'audience : le modèle `Filter` gagne `{ type: 'role', value: <rôle> }`.

**La ligne.** Une pastille colorée — le premier rôle de transaction, dans l'ordre du §4 — puis un « +2 » sourd quand il y en a d'autres, les noms au survol. Un contact sans rôle de transaction montre son premier rôle de réseau, dans la teinte sourde. ⛔ **Aucune teinte nouvelle** : les trois teintes existantes (`CTP_FN`) servent les rôles de transaction, les rôles de réseau prennent l'encre sourde. Inventer sept couleurs ferait sept décisions de direction que personne n'a prises.

**La fiche.** Les rôles s'éditent dans le bloc identité, en pastilles à cocher, deux groupes (transaction, réseau), sans rôle obligatoire. La pastille de type de l'en-tête devient la liste des rôles.

**La création** (modale et fiche express). Le choix de type devient un choix de rôles, `buyer` pré-coché comme aujourd'hui, plusieurs possibles, zéro permis — et c'est alors un lead. Le bloc « ce qu'il cherche » s'affiche selon la règle du §6, et non plus selon `isBuyer`. ⚠ L'extraction IA « coller un message » **écrase** aujourd'hui le type choisi par l'agent ; elle **ajoutera** désormais le rôle déduit (`buyer`, `seller` ou `tenant`) au lieu de remplacer la saisie.

**La recherche.** Gregory demande « filtres **et** recherche par rôle » ; Julien l'a inscrite au
périmètre le 22.09.2026. Un rôle se cherche comme un nom, sur les deux surfaces : la recherche
LOCALE de la liste, et ⌘K, qui interroge le serveur. La frappe est traduite en rôles côté écran —
c'est là que vivent les libellés, et la recherche doit suivre la langue de l'agent —, puis passée
au serveur dans le même `or` que le texte. ⚠ C'est un OU : « avocat » rend les avocats **et** un
contact qui porterait ce nom. Deux lettres au minimum, sinon « e » désignerait la moitié du
vocabulaire et toute recherche de nom se mettrait à filtrer par rôle.

**La page Santé.** Les segments de rôle rejoignent les segments existants, cliquables comme eux. ⚠ **Les comptes se chevauchent** : un vendeur-prescripteur compte dans les deux, donc la somme des segments dépasse le total. C'est la conséquence directe des rôles multiples ; la page l'écrit (« un contact peut porter plusieurs rôles ») plutôt que de laisser croire à une erreur. « Tous » reste le total unique.

**Le mobile** ne bouge pas : ses deux segments lisent `type`, que le déclencheur tient.

## 8. Ce qui ne bouge pas

- **Le moteur de matching** : il lit `client_searches`, pas le contact. Aucune ligne ne change.
- **Le KYC, le pipeline, les relances, les visites, le mandat** : ils lisent `type`, tenu en synchro.
- **Les trois politiques RLS** du portail vendeur (`c.type = 'seller'`) : elles restent vraies.
- **`contacts.tags`** : les étiquettes libres existent et restent libres. Un rôle n'est pas une étiquette — il est contraint, traduit et filtrable.
- **Les relations, les organisations, le score relationnel, un seuil de refroidissement par rôle** : étape 6.

## 9. Garde-fous

| Spec | Ce qu'elle refuse |
|---|---|
| `contacts-roles.spec.ts` (unitaire) | L'aller-retour `type → roles → type` sur les sept anciennes valeurs ; l'ordre de dérivation ; un contact sans rôle rend `lead` ; `rolesDepuisTexte` (accents pliés, deux lettres au minimum, un nom propre ne filtre pas). |
| `contacts-roles-vocabulaire.spec.ts` (unitaire) | Un rôle déclaré d'un seul côté : la contrainte SQL, le type TypeScript et les quatre langues doivent porter les mêmes douze valeurs. |
| `tests/backend/contacts-roles.spec.ts` | Le déclencheur contre la vraie base : écrire `roles` seul, `type` seul, les deux ; un rôle de réseau qui survit à une écriture de `type` ; le refus d'un rôle hors vocabulaire. |
| `banc-contacts-roles.spec.ts` | Le banc `/dev/crm` monte un contact à trois rôles (vendeur + prescripteur + trustee), un contact sans rôle, un acquéreur-vendeur ; le filtre par rôle et les comptes qui se chevauchent. |

## 10. Ce que ça corrige au passage

- Un **investisseur** créé dans l'écran n'avait jamais de critères, donc jamais de match.
- Un **acquéreur-vendeur** (`both`) était inécrivable par l'interface, et sans branche de critères à la création.
- **Deux règles divergentes** décidaient d'écrire des critères ; il n'en reste qu'une.
- **`landlord`** s'appelait « Propriétaire » ici et « Bailleur » là.
- **Dix clés i18n mortes** (`contacts:type.*`, `contacts:detail.type.*`) partent avec le nouveau bloc : les laisser, c'est inviter à recopier la mauvaise.

## 11. En attente (hors périmètre, rien n'est fait sans accord)

- `deriveKycType` et `deriveDealParty` ne s'accordent pas sur `landlord` (vendeur pour l'un, acheteur pour l'autre) — à trancher quand les rôles auront un usage serveur.
- Le scoring de contact (`contact_scoring_v1`) ne note que `buyer` et `lead` : un investisseur ou un acquéreur-vendeur n'a jamais de score.
- La règle R5 du moteur d'automatisations ne relance que `seller` : un bailleur négligé ne l'est jamais.
- La whitelist de la règle R6 (`contact_nba_v1`) est tautologique — les sept valeurs du CHECK —, donc sans effet.
- Le mobile compare `c.type !== seg` : son segment « Vendeurs » rate les bailleurs.
- `calendar:role.landlord` dit encore « Propriétaire ».
- Le modèle UI parallèle (`mockData.ts`, cinq valeurs dont `mixed`) et `mapContactType` aplatissent encore sept valeurs en cinq.
- L'index `idx_contacts_type` n'est pas composite avec `agency_id`, alors que toute requête filtre d'abord par agence.
- **Relevé à l'exécution (22.09.2026)** : la colonne des critères de la fiche n'affiche qu'UN bloc —
  un acquéreur-vendeur ne relit pas le bien qu'il confie, et un contact de réseau pur tombe sur le
  bloc « ce qu'il propose », vide. Les deux demandent une conception de cette colonne.
- **Relevé à l'exécution** : le CTA de la fiche est unique. Un acquéreur-vendeur obtient
  « Transmettre » (son côté demande) et perd la route vers son mandat.
