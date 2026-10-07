# Matching · le fil épuré (conception)

> Julien, 06.10.2026 : « Concernant le design du matching, il faut vraiment que tu fasses ça de manière intuitive. Simple
> d'utilisation. Là, encore, c'est beaucoup trop chargé au niveau des textes. »
>
> Validé sur maquettes le 07.10.2026, avec les données du banc : le panneau d'un match en **carte focus** (direction B,
> contre A « élaguer »), la **liste allégée**, et les **trois panneaux allégés** (recherche à ajuster, en attente, sélection
> du marché). Surface : le Matching du bureau, `src/components/matching-fil/`.

## 1. Les décisions

1. Le panneau d'un match devient une **carte focus** : la photo en grand, le prix et le score posés dessus, le détail des
   critères replié.
2. La liste « À proposer » est **allégée** : des sous-titres courts, des compteurs et des icônes au lieu de phrases.
3. Les panneaux « Recherche à ajuster », « En attente » et « Sélection du marché » suivent la même règle.
4. Déjà fait le 01.10.2026 : sur une ligne, une baisse de prix se lit en flèche (« ↓ CHF 250'000 », `FilBaisse`).

## 2. Principes

- **Une donnée ou rien** (règle n°1). Une date se lit sans verbe quand la ligne dit déjà ce qu'elle date (« 27.09 », pas
  « proposé le 27.09 »).
- **Retirer du texte, jamais une affordance** : un bouton garde sa forme et sa bordure ; un bouton réduit à son icône porte
  son libellé en `aria-label` et en infobulle.
- **Les touches du clavier restent**, mais quittent la face des boutons : elles passent dans l'infobulle
  (« Écarter · X ») et dans `aria-keyshortcuts`. Le clavier du fil ne change pas.
- **Icônes existantes** (`MEIcon`). La sparkle reste réservée à l'IA : le « nouveau » d'une sélection prend l'éclair
  (`bolt`), là où la maquette montrait « ✦ ».
- Ce qui se replie s'ouvre d'un clic, avec `aria-expanded`, et se rouvre replié au match suivant.

## 3. Le panneau d'un match — la carte focus (`FilPanneau`)

| Aujourd'hui | Carte focus |
|---|---|
| Photo de 220 px | Photo de 280 px ; en bas à gauche le prix (et la baisse en flèche), en bas à droite le score, en pastilles |
| Pastille « Votre bien » | Retirée : la liste range déjà « Vos biens » et « Marché » |
| « CHF … · adresse · ville », puis « Voir le bien » | Retirés : le **titre** est le lien vers le bien |
| Signal long (« Refusé par … à … · baissé de … depuis ») | La flèche sur la photo ; la phrase dans le dépli |
| Acheteur : avatar, nom, ligne « KYC non ouvert » | Avatar et nom (lien vers le contact) ; le KYC en **bouclier** (tenu si vérifié, sourdine sinon), son libellé en infobulle |
| « Pourquoi ce match » et son tableau | Une ligne **« 4 critères sur 4 »** (coche verte si tous tenus, alerte ambre et « 3 sur 4 » sinon), qui déplie le tableau actuel |
| « Déjà proposé à Anastasia : aucun bien » | Dans le dépli, sous le tableau |
| « Écarter X », « Plus tard P », « Je l'ai proposé à Anastasia E » | Deux boutons-icônes (`close`, `clock`) et le principal **« Proposé »** ; libellés et touches en infobulle |

Les pastilles posées sur la photo prennent le fond de la carte et l'encre courante, en clair comme en sombre. Sans photo :
la maison en sourdine (comme aujourd'hui), les pastilles du prix et du score posées dessus.

## 4. La liste « À proposer » (`FilListe`)

- « Recherches à ajuster » devient **« À ajuster »** ; « Vos biens » ne change pas ; « Marché · une sélection par acheteur »
  devient **« Marché »**.
- En-tête d'un bien : le **prix seul** (« N acheteurs » retiré : ils sont listés dessous) ; « Nouveau mandat » et « Nouveau
  sur le marché » deviennent une **pastille « Nouveau »** ; une baisse, la flèche (fait).
- Ligne d'un acheteur : inchangée.
- Ligne d'une sélection du marché : **« 4 biens · ↓ 1 · ⚡ 1 »** — les baisses en flèche, les nouveaux en éclair, chaque
  compteur avec son libellé en infobulle (« 1 en baisse », « 1 nouveau »).
- Les reportés : **une horloge et « 1 reporté »** ; la date de retour vit dans la liste dépliée, sur chaque ligne.
- La ligne d'une recherche à ajuster (« Prix · 2 refus ») ne change pas.

## 5. Recherche à ajuster (`FilCorrection`)

- En-tête : le nom et une **pastille « Prix · 2 refus »** (au lieu de « Refusé 2 fois pour « Prix » »).
- « Recherche : … » retiré.
- « Les biens refusés » (le titre) retiré ; chaque carte : vignette, titre, **« CHF … · 30.09 »** (pièces, surface et ville
  retirées) ; la note de l'acheteur reste.
- « La correction proposée » retiré ; chaque correction se lit **avant → après** : l'ancienne valeur barrée, la nouvelle
  dans son champ (« Budget max », « Zones », « Type », « Équipements »).
- La phrase « Ses biens à proposer seront réévalués… » retirée.
- Boutons : « Ignorer » et **« Ajuster »**.

## 6. En attente (`FilRetours`)

- En-tête : le nom ; une **pastille « Relance »** (ambre, alerte) quand la relance est due. La phrase « 2 biens proposés
  attendent sa réponse · relance due depuis le 30.09 » est retirée (la ligne de la liste porte déjà le nombre et la date).
- Cartes : vignette, titre, **« CHF … · 27.09 »**, la flèche d'une baisse, le score.
- Boutons : « Intéressé », « Pas intéressé », « Pas encore » — les mots restent, les touches I, N, P passent en infobulle.

## 7. Sélection du marché (`FilSelection`)

- En-tête : le nom ; « Recherche : … » se **replie** derrière un chevron.
- Lignes : case, vignette, titre, **prix** (et flèche), score ; pièces, surface et ville retirées ; un écart à vérifier se
  dit par l'icône d'alerte, la liste en infobulle.
- Bouton : **« Proposé · 2 »** (au lieu de « J'ai proposé 2 biens à Anastasia ») ; « Voir 20 de plus » reste.

## 8. Même règle, sans maquette (à relire ici)

- **Qui pour ce bien ?** (`FilQuiPourCeBien`) : la pastille « Qui pour ce bien ? » retirée, le titre devient le lien
  (« Voir le bien » retiré), le prix seul, le signal en pastille « Nouveau » ou en flèche. La liste des acquéreurs
  (`QuiPourCeBien`) ne change pas : elle sert aussi les fiches d'un mandat et d'une annonce.
- **À conclure** (`FilConclure`) : « Voir l'annonce d'origine » devient une icône de lien externe à côté du titre. Restent :
  « Intéressé·e le … » (une donnée), les libellés du formulaire, et « Rien n'est envoyé à {prénom}. » — la promesse du
  matching sans sortie.

## 9. Ce qui ne change pas

Les gestes et ce qu'ils écrivent, le clavier, les lectures, les messages de confirmation (déjà courts), les états de
chargement, d'erreur et de vide ; le Matching du téléphone (étape 5c) ; le bloc « Matching » de la fiche d'affaire
(étape 5b-1). Rien ne part vers l'acheteur (`matching-sans-sortie.spec.ts`).

## 10. Garde-fous

- Les textes retirés partent des quatre langues (FR, DE, EN, IT) ; les nouveaux y entrent (« À ajuster », « Marché »,
  « Proposé », « Proposé · {n} », « {n} critères sur {m} », « Budget max »…). Portes `lint:i18n-keys`, parité et
  couverture.
- Une spec de rendu par surface, sur le vrai composant : la carte focus (dépli replié par défaut et refermé au match
  suivant, `aria-expanded`, boutons-icônes nommés, touche en infobulle), l'en-tête d'un bien (prix seul, pastille), la ligne
  d'une sélection (compteurs et infobulles), les trois panneaux (textes retirés, avant → après).
- Les specs existantes qui lisent un texte retiré suivent le nouveau texte, sans perdre ce qu'elles gardent.
- Captures du banc, en clair et en sombre, montrées à Julien ; bancs e2e.

## 11. La livraison

Sur `megga/fiche-affaire-matching`, après les cinq commits de l'étape 5b-1 et celui de la flèche, un commit par surface
(la carte focus, la liste, les trois panneaux, puis « Qui pour ce bien ? » et « À conclure »), chacun vérifié seul ; au
signal « committe » de Julien, jamais de push. Dans la feuille de route, « la densité du panneau d'un match » quitte
l'« En attente » de la revue UX : elle est faite, à la demande de Julien du 06.10.2026.

## 12. En attente (hors périmètre — rien n'est fait sans accord de Julien)

- La liste partagée `QuiPourCeBien`, sur les fiches d'un mandat et d'une annonce.
- Le Matching du téléphone (étape 5c, lot E2).
- Les autres points de la revue UX : le fil qui s'ouvre sur « À ajuster » avant les biens, la sélection du marché cochée
  en entier par défaut.
