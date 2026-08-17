---
name: claude-md-freshness
description: Use to re-verify that the measured claims in CLAUDE.md and docs/system-map.md still match the code and the production database — weekly, after merging a design-system, architecture or migration PR, or whenever a documented rule or figure looks suspicious. Runs `npm run lint:claude-md`, then corrects the doc, the ledger, or the code depending on the verdict.
---

# Fraîcheur des documents de référence

## Pourquoi cette boucle existe

Le 16 août 2026, quelqu'un a repris les sept règles visuelles du §3 une par une :
**une seule était encore vraie.** Les six autres décrivaient Sugar Pure, direction
supprimée six jours plus tôt.

⛔ **Une règle fausse dans CLAUDE.md coûte plus cher qu'un bug.** C'est ce qu'un agent
lit AVANT d'écrire : elle ne dort pas dans un fichier, elle se recopie sur chaque
surface neuve. C'est le seul fichier du dépôt dont l'erreur se propage par la main de
ses lecteurs.

Le doc porte déjà ses chiffres et ses dates — il est écrit pour être vérifié
mécaniquement. Cette boucle est le fait de le faire.

## Quand la lancer

- **Après avoir fusionné une PR de direction artistique, de jetons, de police ou d'archi.**
  C'est le déclencheur qui rapporte : ces PR sont exactement celles qui périment le §3.
- **Une fois par semaine**, sinon : `/loop 7d /claude-md-freshness`.
- **Quand une règle du doc sent le passé** — un « JAMAIS » qui contredit ce que tu vois
  dans le code, une affirmation sans date.

## La boucle

### 1. Mesurer

```bash
npm run lint:claude-md
```

Vert (`✓ … aucun écart`) → **la boucle s'arrête ici.** Ne rien « améliorer ».

### 2. Lire le verdict — trois natures, trois gestes opposés

| Verdict | Ce que ça veut dire | Ce qu'on corrige |
|---|---|---|
| `✖ phrase ABSENTE` | Le registre a survécu à la phrase qu'il gardait | Le **registre** : reformuler `phrase`, ou retirer l'entrée si le doc l'a retirée |
| `✖ prétention DURE violée` | Le **code** a régressé | Le **code**. Jamais le chiffre — `--update` refuse d'y toucher |
| `⚠ a DÉRIVÉ` | Le **doc** est périmé | La **prose** du document, puis le registre |
| `✖ grandeur avec DEUX chiffres` | Deux endroits se **contredisent** | **Trancher**, corriger les DEUX, puis le registre |
| `✖ requête en ERREUR` | Ni vérifiée ni démentie : un **trou** | La requête, ou le droit du jeton. Jamais retirer l'entrée pour faire taire l'erreur |

⚠ **Ne jamais traiter une dérive comme une régression, ni l'inverse.** C'est la seule
erreur qui abîme durablement : rafraîchir un chiffre pour faire taire une régression
inscrit le défaut dans la référence.

### 3. Corriger — DANS CET ORDRE

Une dérive se répare en trois gestes, et l'ordre est imposé par l'outil :

1. **CLAUDE.md d'abord.** Corriger le chiffre **et, s'il la renverse, la conclusion
   qu'il portait.** Dater la correction — un chiffre sans date se périme sans prévenir.
2. **Reporter la phrase** dans `scripts/_data/claude-md-claims.json` (`phrase` cite le
   chiffre du doc, donc elle bouge avec lui).
3. **`npm run lint:claude-md:update`** — réaligne les valeurs du registre sur le code.

⛔ **`--update` REFUSE de tourner si la prose n'a pas été corrigée d'abord**, et ce
n'est pas une gêne : sans ce verrou, il serait le geste qui casse la porte. Il rendrait
le registre vert en le calant sur le code pendant que le doc afficherait l'ancien
chiffre — plus rien ne le signalerait jamais. On aurait automatisé la péremption
silencieuse qu'on essaie d'éliminer.

⚠ **L'outil ne réécrit jamais la prose, et ce n'est pas une limite technique.** Un
nombre qui bouge peut renverser la phrase qui le portait : « 740 `boxShadow` contre
6 classes `shadow-*` » soutient « l'ombre vient de la direction ». Le jour où c'est
400 contre 300, rafraîchir les deux chiffres produirait une phrase grammaticalement
correcte et fausse. L'outil tient le registre ; la conclusion reste un geste humain.

### 4. S'arrêter

Relancer `npm run lint:claude-md`. **Vert = fini.** Deux bornes explicites :

- ⛔ **Ne pas partir en audit.** Si la correction d'une prétention en révèle une autre
  hors registre, l'AJOUTER au registre (§ suivant) et s'arrêter là. Un tour de boucle
  corrige ce que la mesure a montré, pas ce qu'elle suggère.
- ⛔ **Trois tours sans converger = escalader à Julien**, pas un quatrième. Ne pas
  converger signifie qu'une prétention est mal formulée ou que la règle mesure autre
  chose que ce que la phrase affirme — c'est une décision, pas un travail.

## Ajouter une prétention

Toute affirmation CHIFFRÉE du doc peut entrer au registre. Ce qui la rend recevable
n'est pas le chiffre, c'est qu'on puisse écrire sa **règle à graduations**.

```json
{
  "id": "kebab-case",
  "doc": "docs/system-map.md",
  "section": "§3 — Boutons",
  "grandeur": "edge-functions",
  "phrase": "extrait VERBATIM de CLAUDE.md, citant le chiffre",
  "severite": "dur | derive",
  "tolerance": 0.1,
  "mesureLe": "2026-08-17",
  "mesure": {
    "motif": "regex",
    "motifs": ["plusieurs alternatives"],
    "mot": true,
    "portee": ["src"],
    "ext": [".ts", ".tsx"],
    "exclure": ["kyc-report"],
    "fichier": "src/styles/globals.css",
    "contient": "littéral",
    "capture": 1,
    "distinctes": true,
    "compterFichiers": true,
    "sql": "select … -- UNE ligne, UNE colonne"
  },
  "attendu": { "occurrences": 0, "fichiers": 0, "valeursDistinctes": 0, "present": true },
  "note": "le pourquoi, s'il y en a un"
}
```

**`dur` ou `derive` ?** Demander : *un écart d'un cran, est-ce une faute ou de la vie ?*
Une absence (0), une valeur littérale, un nombre de barreaux d'échelle → `dur` : y
toucher est une DÉCISION. Un décompte d'usages qui bouge à chaque commit → `derive`,
avec une tolérance d'autant plus large que la grandeur est petite (à 6, un seul ajout
fait +17 %).

### Les deux pièges qui ont fait rougir la porte à tort

Ils viennent tous deux d'une mesure trop naïve, et tous deux inventaient une régression
qui n'existait pas — le pire défaut possible ici, parce qu'une porte qui crie au loup
finit désactivée.

1. ⛔ **Le motif attrape un identifiant plus long.** `useCrmDa` matche l'intérieur de
   `useCrmDark`, un hook vivant et sans rapport : 44 fausses occurrences. Idem entre
   `bg-accent` et `bg-accent-solid`, qui sont deux jetons distincts depuis le 15 août.
   → **`"mot": true`** borne sur les limites d'identifiant, tirets compris. `\b` ne
   suffit pas : il s'arrête sur le tiret.
2. ⛔ **Le motif attrape la prose qui raconte le retrait.** `crmStep` survit trois fois
   dans des commentaires qui expliquent sa suppression ; `data-crm-da` une fois dans un
   commentaire CSS. → Les commentaires sont blanchis d'office (JS/TS et CSS). Rien à
   déclarer, mais y penser en lisant un compte : une occurrence isolée est presque
   toujours une note, pas un appel.
3. ⛔ **Le motif ancré rend ZÉRO en silence.** `^\s*'[a-z0-9-]+',` comptait 0 entrée du
   roster au lieu de 81 : `^` désignait le début du FICHIER. Les motifs sont désormais
   compilés en `gm`, donc `^` vaut par ligne — mais le piège vaut d'être connu, parce que
   **zéro est une valeur plausible** : l'erreur ne se lit pas comme un bug, elle se lit
   comme une dérive à corriger dans la prose. Un motif défaillant qui accuse le document
   est la pire façon de se tromper ici.

## Les prétentions de BASE DE DONNÉES

Onze entrées portent `mesure.sql` au lieu d'un motif. Elles couvrent le §7 (jobs pg_cron
par nom ET horaire, index de `market_listings`), les volumes des §2 et §8, la règle RLS,
et deux retraits que le doc affirmait sans que rien ne les vérifie.

⛔ **Elles périment dans un régime pire que les autres** : elles ne se lisent dans AUCUN
fichier — « 41 jobs pg_cron » n'est vrai que d'un serveur. Aucun diff ne les dément, donc
même une relecture attentive du dépôt les laisse passer. Mesuré à leur inscription le
17.08.2026 : **+9 jobs cron** depuis le 29 juillet, et le §8 annonçait 90k annonces
Flatfox pour **117k** réelles — le « 90k » désignant en fait RealAdvisor.

**Où elles tournent** — pas là où tu crois :

| Contexte | Commande | Portée |
|---|---|---|
| Chaque PR (`unit-tests.yml`) | `npm run lint:claude-md` | Les 24 statiques. Les 17 autres sont **ignorées, et le dire fait partie de la sortie** |
| Hebdo + après chaque migration (`migration-drift.yml`) | `… --prod` | Les 41 |
| En local | `SUPABASE_ACCESS_TOKEN=… npm run lint:claude-md` | Les 41 |

`unit-tests.yml` est **statique et sans secret par conception** ; la production ne
s'interroge que depuis `migration-drift.yml`. Ne pas déplacer ces étapes.

⛔ **`--prod` fait ÉCHOUER un jeton absent**, au lieu de le signaler. Convention reprise
de `check-types-freshness.mjs`, qui la porte pour avoir payé le défaut : sans le drapeau,
le script passe au vert *en ayant sauté toutes ses mesures*. Un avertissement dans une
sortie verte se lit comme un succès dès que personne ne lit.

**Écrire la requête.** Elle doit rendre **une ligne et une colonne** — le runner refuse
toute autre forme plutôt que de deviner. Deux réflexes :

- **Parler l'unité du doc.** Le §2 dit « ~208k » : la requête rend donc des milliers
  (`round(count(*)/1000.0)::int`), pas 207 599. Un compte exact rendrait la prétention
  instable par construction et imposerait un chiffre illisible dans une phrase qui dit « ~ ».
- **Nommer ce qu'on compte dans la requête.** « ~90k Flatfox » était numériquement proche
  de la vérité et désignait la mauvaise source. Une prétention peut être fausse sans que
  son chiffre le paraisse.

## Deux documents, une grandeur partagée

`doc` désigne le fichier gardé (défaut `CLAUDE.md` ; `docs/system-map.md` pour le reste).
`grandeur` regroupe les entrées qui parlent de **la même chose**, où qu'elles soient
écrites — et deux entrées d'une même grandeur doivent porter le même chiffre.

⛔ **Ce contrôle attrape ce que ni la mesure ni la tolérance ne voient.** Relevé le
17.08.2026 : `docs/system-map.md` annonçait **67** edge functions ligne 91 et **71** au
titre de son §5 — deux chiffres, un objet, un seul document. Prise isolément, chaque
affirmation est juste « fausse » ; c'est leur **confrontation** qui dit qu'un lecteur ne
peut pas savoir laquelle croire, et qu'il choisira au hasard.

⚠ **Ce n'est pas le prestige du document qui tranche, c'est la mesure.** Sur les pages de
la console admin, c'est `CLAUDE.md` qui avait tort (17) et le system-map raison (19) — le
document que j'allais traiter comme « le périmé » était le bon. Mesurer d'abord, décider
ensuite.

C'est un contrôle **documentaire** : il compare les entrées entre elles, jamais au réel.
Il tourne donc sans jeton, y compris sur les prétentions de base de données non mesurées.

## Ce que cette boucle ne fait pas

- **Les affirmations non chiffrées** (« la séparation vient de la bordure »). Elles ne
  sont pas moins périssables, seulement pas mécanisables.
- **Le seed du cerveau** (`.claude-flow/knowledge/megga-memory.seed.json`) porte les mêmes
  chiffres et dérive en parallèle. Une seule entrée le garde — le NOMBRE de ses entrées —
  ce qui ne protège pas son contenu. Troisième chantier, pas encore fait.

## Budget

⛔ Un tour de boucle coûte quelques minutes et quelques corrections ciblées. **S'il part
en refonte du §3, c'est qu'on a quitté la boucle** — s'arrêter et remonter à Julien.
Le cadre qui a inspiré cette boucle insiste sur ce point : une boucle sans plafond
consomme jusqu'à ce que quelqu'un la voie.
