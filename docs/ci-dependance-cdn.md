# La CI dépend d'un CDN tiers — état des lieux et paliers

> **Écrit le :** 2-3 août 2026, après l'incident `esm.sh`.
> **Ce qui est fait :** le mode d'échec (§2). **Ce qui ne l'est pas :** la dépendance
> elle-même (§4), qui touche le code des Edge Functions et exige un essai en production.

---

## 1. L'incident

Le 02.08.2026, `esm.sh` a renvoyé des HTTP 522 par intermittence. Trois jobs ont rougi, aucun
à cause du code poussé :

| | Où | Conséquence |
|---|---|---|
| 1 | PR #1098, `unit-tests.yml`, étape `deno check` | **`Run unit tests` sauté** : job rouge, zéro test exécuté |
| 2 | `deploy.yml` sur `main` | étape tuée par son plafond de 20 min, **41 fonctions déployées sur 68** |
| 3 | PR #1103, **un seul fichier `.md`** modifié | même étape, même 522 |

Deux précisions qui comptent, contre le récit initial. L'incident 2 n'a pas « réessayé pendant
vingt minutes » : il a été **tué** par `timeout-minutes: 20` avant d'atteindre sa passe de
rattrapage, après avoir tout de même déployé 41 fonctions — la production est donc restée dans
un état **mixte**. Et l'incident 3 s'est produit dans `unit-tests.yml`, pas dans `deploy.yml` :
l'étape qui déploie les fonctions porte `if: push && ref == main`, elle ne s'exécute **jamais**
sur une PR.

> Corollaire utile : **la seule exposition d'une PR au CDN est `unit-tests.yml`.** Corriger ce
> fichier immunise toutes les PR.

---

## 2. Ce qui est corrigé — le mode d'échec

Le défaut n'était pas propre à `deno check`. Le job enchaînait **quinze étapes séquentielles
sans aucune condition**, `Run unit tests` en dernier. Le saut est le comportement par défaut de
GitHub Actions (`if: success()` implicite) : **n'importe laquelle des douze portes de lint
faisait déjà disparaître les tests** — constaté aussi sur l'étape i18n, indépendamment de tout
CDN.

Chaque porte porte désormais `if: ${{ !cancelled() && steps.deps.outcome == 'success' }}` :

- chaque porte s'exécute **indépendamment** des précédentes ;
- chaque porte reste **bloquante** : son propre échec fait toujours rouge ;
- une porte cassée ne masque plus les autres, et les tests unitaires tournent toujours ;
- si `npm ci` échoue, tout est sauté — une porte sans dépendances ne dit rien d'utile.

**Ce qui a été délibérément écarté :** `continue-on-error: true` sur `deno check`. Ça aurait
réglé le symptôme en rendant le job **vert sur une vraie erreur de type**, c'est-à-dire en
désarmant le seul filet de types du code Deno. Le fichier lui-même dit « BLOQUANT (jamais
`|| true`) » ; on ne troque pas un contrôle contre du confort.

S'y ajoute un cache `DENO_DIR`, avec une nuance : le motif maison (cache des navigateurs
Playwright) n'a **pas** de `restore-keys`. Recopié tel quel, le cache serait froid à presque
chaque exécution, la clé changeant dès qu'un fichier d'edge function bouge. Le repli par
préfixe est ce qui le rend utile.

> ⚠ Un cache **raréfie** la dépendance, il ne la supprime pas. Cache froid — première
> exécution, éviction après 7 jours, dépassement de quota — et l'exposition est entière.
> Il ne protège pas non plus `deploy.yml` : le CLI Supabase ne bundle pas avec le Deno du
> runner, il lance un conteneur avec son propre volume. Le 02.08, ce volume n'a même pas
> reporté le succès d'une fonction sur la suivante : `accept-team-invite` a bundlé, puis
> `admin-agency-lifecycle` est tombée 41 secondes plus tard sur le **même** specifier.

---

## 3. L'inventaire

143 imports par URL dans `supabase/functions/`, mais très concentrés : **six specifiers, deux
hôtes, zéro `jsr:`**.

| Specifier | Occurrences | Fichiers |
|---|---|---|
| `https://deno.land/std@0.177.0/http/server.ts` | 67 | 67 |
| `https://esm.sh/@supabase/supabase-js@2` | 67 | 66 |
| stripe, aws4fetch, pdf-lib, imagescript | 9 | 8 |

Aucun `deno.json`, aucun `import_map.json`, aucune clé `import_map` dans `config.toml` : les
URL sont écrites **en dur** dans chaque fichier. Un `deno.lock` existe à la racine mais il est
gitignoré, et le type-check passe `--no-lock` de toute façon.

> Le brief parlait de « la dépendance `esm.sh` ». `deno.land` pèse **le même poids** et porte
> le même mode de panne. Ne chiffrer que `esm.sh`, c'est sous-estimer le sujet de moitié.

---

## 4. Ce qui n'est pas fait, et dans quel ordre le faire

### Le palier le plus rentable ne demande aucun arbitrage

**67 des 68 imports `deno.land` ne servent qu'à `serve`**, que Deno 2 couvre nativement par
`Deno.serve`. C'est le **seul geste qui SUPPRIME un point de panne** au lieu de le déplacer :
plus d'hôte à joindre, plus rien à télécharger. Il ne dépend d'aucune décision sur `npm:`.

⚠ « Mécanique » ne veut pas dire « sans vérification » : les deux signatures diffèrent
(options de port, valeur de retour, gestion de l'arrêt). 67 fichiers, à faire en un lot dédié.

### La voie `npm:` est RISQUÉE, pas indécidable

La documentation officielle documente `npm:` comme moyen nominal. Mais elle ne donne **ni
version minimale ni garantie régionale**, et le seul document Supabase traitant du runtime
hébergé décrit une préview limitée à `us-east-2`. **Ce projet tourne en `eu-west-1`.**

Le dépôt contient deux `npm:` — ce n'est **pas** un précédent rassurant : ce sont des imports
*dynamiques à spécificateur variable*, écrits précisément pour échapper à `deno check`, jamais
exécutés en production, et surtout de forme **inverse** à celle envisagée. Supabase sérialise
le graphe de modules en eszip au déploiement ; un `await import(variable)` n'y entre pas, un
import statique `npm:` si. Le dépôt exerce le cas non bundlé, pas le cas nominal.

`deno check` résout les cinq paquets en `npm:` et rend `supabase-js` en 2.108.2 — exactement ce
que sert `esm.sh` aujourd'hui. **Cela sécurise la CI, pas la production**, et c'est précisément
le piège à éviter.

> **L'essai qui tranche, à risque nul :** déployer une fonction jetable à un slug inédit
> (`npm-probe`) avec un import **statique** `npm:@supabase/supabase-js@2`, qui renvoie
> `Deno.version.deno` et la preuve que `createClient` s'instancie. Aucun slug existant n'est
> touché. Elle répond d'un coup au support de `npm:`, à celui de `jsr:`, et à la version de
> Deno réellement servie en `eu-west-1`.

> ⚠ Et à savoir avant de s'engager : **`npm:` ne vendorise rien.** Le CLI ira toujours chercher
> les paquets au déploiement pour bâtir l'eszip — `esm.sh` cède la place à `registry.npmjs.org`.
> Plus fiable, sans doute ; mais le mode de panne survit.

### L'ordre, par risque croissant

1. `serve` → `Deno.serve` — 67 fichiers, **supprime** une dépendance ;
2. `supabase-js` → `npm:` — 67 fichiers, version identique, **après l'essai** ci-dessus ;
3. `aws4fetch` + `pdf-lib` — JS pur, faible risque ;
4. **`stripe` en dernier, seul.** `?target=deno` est une transformation propre à `esm.sh` ;
   sous `npm:`, on bascule sur la compat Node — l'artefact exécuté change vraiment, et c'est
   le module qui porte l'encaissement (`constructEventAsync` du webhook) ;
5. `imagescript` seul : l'homonyme npm est un build différent, et `photo-processor` est déjà
   contraint en mémoire. Un changement de build peut déplacer le profil sans erreur de type.

⚠ Le déploiement est fonction par fonction et **tolérant aux échecs partiels** (le step ne
rougit que si *aucune* fonction ne passe). Une bascule déployée pendant que le CDN tousse peut
donc laisser la production **à moitié migrée sans échec de CI**. Ne jamais engager un de ces
paliers un jour d'instabilité.

---

## 5. Un point de gouvernance, hors sujet mais constaté

**La branche `main` n'est pas protégée** : aucune règle, aucun check requis. Rien n'empêche
mécaniquement de fusionner sur du rouge. Tant que c'était le cas, la pratique de relancer un
job rouge « parce que c'est sûrement le CDN » érodait le seul garde-fou réel — le dépôt le dit
lui-même ailleurs : *un garde-fou qui crie sans raison finit ignoré, donc muet le jour où il a
raison.*
