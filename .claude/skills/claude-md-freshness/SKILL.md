---
name: claude-md-freshness
description: Use to re-verify that CLAUDE.md's measured claims still match the code — weekly, after merging a design-system or architecture PR, or whenever a rule in CLAUDE.md looks suspicious. Runs `npm run lint:claude-md`, then corrects the doc, the ledger, or the code depending on the verdict.
---

# Fraîcheur de CLAUDE.md

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
| `✖ phrase ABSENTE de CLAUDE.md` | Le registre a survécu à la phrase qu'il gardait | Le **registre** : reformuler `phrase`, ou retirer l'entrée si le doc l'a retirée |
| `✖ prétention DURE violée` | Le **code** a régressé | Le **code**. Jamais le chiffre — `--update` refuse d'y toucher |
| `⚠ a DÉRIVÉ` | Le **doc** est périmé | La **prose** de CLAUDE.md, puis le registre |

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
  "section": "§3 — Boutons",
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
    "distinctes": true
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

## Ce que cette boucle ne fait pas

- **Les prétentions de BASE DE DONNÉES** (« 41 jobs pg_cron », « ~173k market_listings »,
  les index du §7) — elles demandent une connexion Supabase. Elles périment aussi, et
  personne ne les vérifie. C'est le prolongement naturel de ce registre, pas encore fait.
- **Les affirmations non chiffrées** (« la séparation vient de la bordure »). Elles ne
  sont pas moins périssables, seulement pas mécanisables.
- **Les autres docs** — `docs/system-map.md` et le seed du cerveau portent les mêmes
  chiffres et dérivent en parallèle.

## Budget

⛔ Un tour de boucle coûte quelques minutes et quelques corrections ciblées. **S'il part
en refonte du §3, c'est qu'on a quitté la boucle** — s'arrêter et remonter à Julien.
Le cadre qui a inspiré cette boucle insiste sur ce point : une boucle sans plafond
consomme jusqu'à ce que quelqu'un la voie.
