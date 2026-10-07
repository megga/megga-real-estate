# Pipeline · la fiche d'affaire branchée sur le matching (étape 5b-1) · plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** la fiche d'une affaire dit où en est chaque bien de l'acheteur dans le matching — à proposer, proposé, intéressé, visite planifiée —, écrit son score comme le fil et mène chaque bien à sa place dans le fil ; son historique dit les étapes du matching et d'où vient l'affaire. Rien n'est écrit en base ; rien ne part vers l'acheteur.

**Conception :** [2026-09-30-fiche-affaire-matching-design.md](../specs/2026-09-30-fiche-affaire-matching-design.md), validée par Julien le 30.09.2026 section par section (questions 1 à 3 : réponse A ; approche 1). **Étape 5b-1** de la [feuille de route](../feuille-de-route.md) ; l'étape 5b-2, le KYC, attend le KYC refait sur `main`.

**Architecture :** côté écran seulement — ni migration, ni fonction de base, ni fonction serveur. Un modèle pur (`src/components/matching-fil/filAffaire.ts`) compose des règles qui existent déjà : « Sa boucle » (`construireSaBoucle`) pour les biens, `etatCompatible` pour l'état, `lienPlace` pour la place dans le fil, la règle « en vente » du fil. Une lecture (`useMatchingAffaire`) compose trois requêtes sous la clé du fil (`CLE_FIL`), que ses gestes invalident déjà. Un bloc présentationnel (`BlocMatchingAffaire`). La fiche (`DealDetailPage`) le monte en Prospects, Recherche et Visites, et fusionne le journal du matching dans son historique.

**Pile :** React 18 / TypeScript strict / React Query, react-i18next (quatre langues), Vitest (unitaire ; rendu en `createRoot` + `act`), Playwright (bancs `/dev/crm`, port 5199).

**Branche :** `megga/fiche-affaire-matching`, partie de `main` (`d4b5e2d9`), dans le worktree `crm-navigation-aesthetics-56086d`.

**Méthode d'écriture :** chaque tâche a été JOUÉE dans une copie jetable du dépôt jusqu'au vert, captures du banc comprises ; ses instructions ont ensuite été tirées mécaniquement de l'état obtenu — un fichier neuf en entier, un fichier modifié en remplacements exacts, chacun UNIQUE dans l'état qui le précède. Le plan entier a été rejoué d'un bloc depuis ses seules instructions, sur une copie neuve de `d4b5e2d9` (30.09.2026) : 84 instructions, aucune en échec, chaque fichier identique à l'octet à l'état joué ; aux quatre fins de sujet de commit (tâches 1, 5, 6, 7), `tsc -b --force`, eslint, `lint:deadcode` et les portes i18n à 0, la suite unitaire sans autre échec que les trois connus. Puis une dernière fois depuis le TEXTE de ce document — ses 84 blocs relus dans le Markdown, pas dans l'outil qui les a écrits : les huit tâches identiques à l'octet. Les « Attendu » des étapes ont été MESURÉS sur une troisième copie neuve, la garde seule d'abord, le code ensuite (30.09.2026) ; ceux de la tâche 9 sur la copie rejouée.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : ils se jouent tous à la fin (tâche 9), **un commit par SUJET** — cinq, pas huit : `lint:deadcode` ne lit que `src`, et un modèle ou une lecture sans lecteur y paraîtrait mort. Pendant l'exécution, on enchaîne sans commiter, et on PHOTOGRAPHIE l'arbre à chaque fin de sujet (tâches 1, 5, 6, 7 et 8) avec le script posé à l'étape 0.3 — un index temporaire, ni ref ni commit, l'index réel intact. **Jamais de push.**

> ⚠ **Aucune écriture en production** : ni migration appliquée, ni edge déployée, ni SQL d'écriture. Ce lot n'en demande aucune — la fusion ne demandera aucun geste en production.

> ⛔ **Rien ne part vers l'acheteur.** Le bloc n'ajoute aucune sortie. Son modèle et lui vivent dans `src/components/matching-fil/`, que `tests/unit/matching-sans-sortie.spec.ts` couvre d'office ; la lecture `useMatchingAffaire` y entre à la tâche 3. La fiche d'affaire, page hôte, reste hors du périmètre : elle porte ses liens WhatsApp et e-mail vers le client, hors du matching.

> ⚠ **La suite unitaire se joue SEULE**, jamais en parallèle de `tsc`, d'eslint ou des bancs : les délais de 5 s sautent et les faux rouges s'enchaînent. Une spec qui rougit se rejoue d'abord seule. **Trois fichiers échouent en local et sont hors sujet** : `supabase/functions/_shared/mail/imap.test.ts`, `supabase/functions/_shared/mail/mime-parse.test.ts`, `tests/unit/safe-internal-path.spec.ts`.

> ⚠ **`npx tsc -b --force`, jamais sans `--force`** dans une copie dont le `node_modules` est un lien vers le dossier principal : le `tsbuildinfo` partagé ferait sauter la vérification.

> ⚠ **Les bancs e2e servent `/dev/crm` sur le port 5199** (`playwright.bancs.config.ts`, `strictPort`, sans réemploi d'un serveur) — **jamais 5173**, le serveur de Julien. Si 5199 est pris, s'arrêter et le dire : ne rien tuer.

> ⚠ **Les instructions sont EXACTES.** Chaque « remplacer (exact) » est l'`old_string` d'un Edit, à l'octet ; il apparaît UNE fois dans le fichier au moment de l'appliquer, et les remplacements d'un même fichier s'appliquent dans l'ordre donné. Un bloc qui ne se trouve pas ne s'adapte pas : l'état de départ n'est pas celui du plan — s'arrêter et le dire. Les blocs sont faits de lignes ENTIÈRES, finissent par un saut de ligne et ne commencent ni ne finissent par une ligne vide. « supprimer (exact) » : l'Edit prend une chaîne vide en remplacement. Un fichier neuf se crée avec le contenu exact de son bloc (Write).

## Écarts à la conception, décidés à l'écriture du plan

Tous notés en place dans la conception (⚠), qui entre dans le même commit que ce plan.

1. **Le dossier.** Le modèle et le bloc vivent dans `src/components/matching-fil/`, pas dans `crm/pipeline/` : l'empreinte de la capture de référence du Pipeline (`scripts/_shared/visual-baseline-empreinte.mjs`) couvre ce dossier entier, et un fichier neuf y rendrait la capture périmée alors que le tableau ne change pas.
2. **L'écriture de l'état, partagée** (tâche 1) : elle sort de `QuiPourCeBien.tsx` vers `filAffichage.ts` (`ecrireEtat`) — ni recopiée, ni exportée d'un fichier de composants (react-refresh le refuse).
3. **Les textes du bloc** vivent sous `matching:fil.affaire.*`, calqués sur ceux de « Qui pour ce bien ? » ; « Réessayer » reprend `matching:fil.reessayer`. La fiche garde `pipeline:fiche.matching.*` (le titre, le nombre) et `pipeline:fiche.hist.*`.
4. **Le dédoublonnage** des biens à proposer se fait sur ce que « Sa boucle » PORTE, pas sur ce que ses lectures rendent.
5. **Une ligne** porte `cleEtatMandat` (la clé `listings:status.*` d'un mandat qui n'est plus en vente, `null` sinon), que l'écran traduit.
6. **Le banc** : un fait d'étape d'Anastasia (`fd8`) cinq secondes après sa visite montre le doublon écarté ; la visite de Champel est posée à 20 jours ; la pagination du journal d'audit se décale, `tests/e2e/journal-audit.spec.ts` suit (963 / 964).
7. **Cinq commits par sujet**, pas six livraisons.

## Étape 0 : avant de commencer

- [ ] **0.1 — L'état de départ.**

```bash
git rev-parse --abbrev-ref HEAD
```

```bash
git rev-parse HEAD
```

```bash
git status --porcelain
```

Attendu : `megga/fiche-affaire-matching` ; `d4b5e2d9ad8992c0c32dce15cc5b15e6100d66e6` ; deux fichiers non suivis et rien d'autre — `?? docs/superpowers/plans/2026-09-30-fiche-affaire-matching.md` et `?? docs/superpowers/specs/2026-09-30-fiche-affaire-matching-design.md`. Tout autre état : s'arrêter.

- [ ] **0.2 — Le dossier hors dépôt** (le script des photos, les captures de revue ; rien n'y est commité) :

```bash
mkdir -p /Users/megga/.cache/megga-5b1/revue /Users/megga/.cache/megga-5b1/captures
```

```bash
ln -sfn /Users/megga/Desktop/megga-real-estate/node_modules /Users/megga/.cache/megga-5b1/node_modules
```

- [ ] **0.3 — Le script des photos et des commits.** Créer **`/Users/megga/.cache/megga-5b1/commits_5b1.py`** :

````python
"""Étape 5b-1 : cinq commits, un par sujet — photographiés en route, vérifiés seuls, créés au signal de Julien.

    python3 commits_5b1.py photo C<n>  → photographie l'arbre du worktree (index temporaire : ni ref, ni commit, index
                                          réel intact) ; C0 après la tâche 1, C1 après la 5, C2 après la 6, C3 après la 7,
                                          C4 après la 8
    python3 commits_5b1.py verifier    → chaque arbre SEUL dans une copie jetable liée au node_modules du dossier
                                          principal : tsc -b --force, eslint src tests --quiet, suite unitaire,
                                          lint:deadcode, portes i18n et typographie
    python3 commits_5b1.py commiter    → au « committe » de Julien : la chaîne par commit-tree sur HEAD, la branche
                                          avancée, reset mixte. Jamais de push.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

S = os.path.dirname(os.path.abspath(__file__))
W = '/Users/megga/Desktop/megga-real-estate/.claude/worktrees/crm-navigation-aesthetics-56086d'
PRINCIPAL_NM = '/Users/megga/Desktop/megga-real-estate/node_modules'
BRANCHE = 'megga/fiche-affaire-matching'
PHOTOS = os.path.join(S, 'photos-5b1.json')
TRAILER = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'
MESSAGES = {
    'C0': "refactor(matching): l'état d'un compatible s'écrit à un seul endroit",
    'C1': "feat(pipeline): la fiche d'affaire montre les biens de l'acheteur dans le matching",
    'C2': "feat(pipeline): l'historique de l'affaire dit ses étapes du matching",
    'C3': 'chore(banc): le journal du matching de deux affaires, et la visite de Champel',
    'C4': "docs(pipeline): la fiche d'affaire branchée sur le matching — conception, plan, carte, cerveau",
}


def git(*args, env=None, entree=None):
    r = subprocess.run(['git', '-C', W, *args], capture_output=True, text=True, env=env, input=entree)
    if r.returncode:
        raise SystemExit(f'git {" ".join(args)} : {r.stderr}')
    return r.stdout.strip()


# La conception et le plan sont dans le worktree dès le départ (non suivis) : ils n'entrent qu'au commit des docs.
DOCS_DU_DERNIER = [
    'docs/superpowers/specs/2026-09-30-fiche-affaire-matching-design.md',
    'docs/superpowers/plans/2026-09-30-fiche-affaire-matching.md',
]


def photo_du_worktree(avec_docs=True):
    fd, idx = tempfile.mkstemp()
    os.close(fd)
    os.remove(idx)
    env = dict(os.environ, GIT_INDEX_FILE=idx)
    try:
        git('read-tree', 'HEAD', env=env)
        git('add', '-A', env=env)
        if not avec_docs:
            git('rm', '--cached', '-q', '--ignore-unmatch', *DOCS_DU_DERNIER, env=env)
        return git('write-tree', env=env)
    finally:
        if os.path.exists(idx):
            os.remove(idx)


def photos():
    return json.load(open(PHOTOS)) if os.path.exists(PHOTOS) else {}


def photo(nom):
    assert nom in MESSAGES, nom
    assert git('rev-parse', '--abbrev-ref', 'HEAD') == BRANCHE, 'pas sur la bonne branche'
    p = photos()
    p.setdefault('head', git('rev-parse', 'HEAD'))
    assert p['head'] == git('rev-parse', 'HEAD'), 'HEAD a bougé depuis la première photo'
    p[nom] = photo_du_worktree(avec_docs=nom == 'C4')
    json.dump(p, open(PHOTOS, 'w'), indent=1)
    print(nom, p[nom][:8])


def verifier():
    p = photos()
    tmp_principal = os.path.join(PRINCIPAL_NM, '.tmp')
    sauvegarde = os.path.join(S, 'nm-tmp-principal')
    if os.path.exists(tmp_principal) and not os.path.exists(sauvegarde):
        shutil.copytree(tmp_principal, sauvegarde)
    for nom in sorted(MESSAGES):
        if nom not in p:
            print(nom, 'absente')
            continue
        copie = os.path.join(S, 'commit-copie')
        if os.path.exists(copie):
            shutil.rmtree(copie)
        os.makedirs(copie)
        archive = subprocess.run(['git', '-C', W, 'archive', '--format=tar', p[nom]], capture_output=True, check=True)
        subprocess.run(['tar', '-x', '-C', copie], input=archive.stdout, check=True)
        os.symlink(PRINCIPAL_NM, os.path.join(copie, 'node_modules'))
        print(f'== {nom} {p[nom][:8]} {MESSAGES[nom]}', flush=True)
        for etiquette, commande in [
            ('tsc', ['npx', 'tsc', '-b', '--force']),
            ('eslint', ['npx', 'eslint', 'src', 'tests', '--quiet']),
            ('vitest', ['npx', 'vitest', 'run']),
            ('deadcode', ['npm', 'run', '-s', 'lint:deadcode']),
            ('i18n-keys', ['npm', 'run', '-s', 'lint:i18n-keys']),
            ('parity', ['npm', 'run', '-s', 'i18n:parity:ci']),
            ('coverage', ['npm', 'run', '-s', 'i18n:coverage:ci']),
            ('i18n', ['npm', 'run', '-s', 'lint:i18n']),
            ('prose', ['npm', 'run', '-s', 'lint:prose']),
        ]:
            r = subprocess.run(commande, cwd=copie, capture_output=True, text=True)
            sortie = (r.stdout + r.stderr).strip().splitlines()
            if etiquette == 'vitest':
                resume = ' | '.join(l.strip() for l in sortie if 'Test Files' in l or 'Tests ' in l)
                echecs = sorted({l.split(' > ')[0].replace('FAIL', '').strip() for l in sortie if l.strip().startswith('FAIL')})
                print(f'   vitest={r.returncode} {resume} · échecs : {", ".join(echecs) or "aucun"}', flush=True)
            else:
                derniere = [l for l in sortie if l.strip()]
                print(f'   {etiquette}={r.returncode} ' + (derniere[-1][:140] if derniere else ''), flush=True)
        if os.path.exists(sauvegarde):
            if os.path.exists(tmp_principal):
                shutil.rmtree(tmp_principal)
            shutil.copytree(sauvegarde, tmp_principal)
        shutil.rmtree(copie)


def commiter():
    p = photos()
    assert all(n in p for n in MESSAGES), 'une photo manque'
    assert git('rev-parse', '--abbrev-ref', 'HEAD') == BRANCHE, 'pas sur la bonne branche'
    assert git('rev-parse', 'HEAD') == p['head'], 'HEAD a bougé'
    assert p['C4'] == photo_du_worktree(), 'le worktree a bougé depuis la dernière photo'
    parent = p['head']
    crees = []
    for nom in sorted(MESSAGES):
        sha = git('commit-tree', p[nom], '-p', parent, '-F', '-', entree=f'{MESSAGES[nom]}\n\n{TRAILER}\n')
        crees.append((sha, MESSAGES[nom]))
        parent = sha
    git('update-ref', f'refs/heads/{BRANCHE}', parent, p['head'])
    git('reset', '--quiet')
    etat = git('status', '--porcelain')
    for sha, message in crees:
        print(sha[:8], message)
    print('status :', 'propre' if not etat else etat)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'photo':
        photo(sys.argv[2])
    elif mode == 'verifier':
        verifier()
    elif mode == 'commiter':
        commiter()
    else:
        raise SystemExit('mode inconnu')
````

- [ ] **0.4 — Le port des bancs est libre.**

```bash
lsof -nP -iTCP:5199 -sTCP:LISTEN
```

Attendu : aucune sortie.

## Les fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `src/components/matching-fil/filQuiPour.ts` | Exporte le type `EtatCompatible`. | 1 |
| `src/components/matching-fil/filAffichage.ts` | `ecrireEtat` : l'état d'un bien, écrit une seule fois pour « Qui pour ce bien ? » et le bloc. | 1 |
| `src/components/matching-fil/QuiPourCeBien.tsx` | Lit `ecrireEtat` ; sa copie locale part. | 1 |
| `src/components/matching-fil/filAffaire.ts` | **Créer.** Le modèle pur : les biens de l'acheteur (`biensDeLAffaire`) ; puis le journal (`journalMatchingDeLAffaire`, `titresDesMatchs`), l'origine (`neeDuMatching`) et le doublon (`doublonDeVisite`). | 2, 6 |
| `src/hooks/useContactSentMatches.ts` | Exporte ses colonnes (`COLONNES_BOUCLE`) au lieu de les laisser recopier. | 3 |
| `src/hooks/useMatchingAffaire.ts` | **Créer.** Les lectures, sous `CLE_FIL` : « Sa boucle » et les biens à proposer ; puis le journal du contact. | 3, 6 |
| `src/components/matching-fil/BlocMatchingAffaire.tsx` | **Créer.** Le bloc : lignes, lien vers la place du bien, trois états. | 4 |
| `src/i18n/locales/{fr,en,de,it}/matching.json` | `fil.affaire.*` : lecture, échec, vide. | 4 |
| `src/i18n/locales/{fr,en,de,it}/pipeline.json` | `fiche.matching.*` (tâche 5), `fiche.hist.*` (tâche 6) ; `deal.matches_title`, `deal.matches_count_one`, `deal.matches_count_other`, `deal.no_matches` retirées (tâche 5). | 5, 6 |
| `src/hooks/useFicheAffaire.ts` | Perd sa lecture `matchs`, qui n'a plus de lecteur. | 5 |
| `src/pages/agent/DealDetailPage.tsx` | Monte le bloc (tâche 5) ; fusionne le journal dans l'historique, 12 lignes (tâche 6). | 5, 6 |
| `src/pages/dev/crmFixtures.ts` | Le banc : le journal du matching de d5 et d6, `fd8`, la visite de Champel. | 7 |
| `tests/unit/fil-affaire.spec.ts` | **Créer.** Le modèle pur. | 2, 6 |
| `tests/unit/matching-affaire-lecture.spec.tsx` | **Créer.** Les lectures. | 3, 6 |
| `tests/unit/bloc-matching-affaire.spec.tsx` | **Créer.** Le rendu du bloc. | 4 |
| `tests/unit/fiche-qui-pour.spec.ts`, `matching-sans-sortie.spec.ts`, `jeton-arrivee.spec.tsx`, `score-une-ecriture.spec.ts` | Gardes étendues. | 1, 3, 4, 5 |
| `tests/e2e/journal-audit.spec.ts` | La pagination du journal suit le banc. | 7 |
| `docs/superpowers/feuille-de-route.md`, `docs/system-map.md`, `.claude-flow/knowledge/megga-memory.seed.json`, `docs/CHANGELOG.md` — et la conception, et ce plan | Les docs. | 8 |


---

## Tâche 1 : L'écriture de l'état d'un bien, partagée

Le bloc écrit l'état d'un bien comme « Qui pour ce bien ? » écrit celui d'un acquéreur. La fonction vit aujourd'hui, locale, dans `QuiPourCeBien.tsx` : elle sort dans `filAffichage.ts` (les aides d'écriture du fil) sous le nom `ecrireEtat`, et le type `EtatCompatible` s'exporte. Ni recopie, ni export depuis un fichier de composants — react-refresh le refuse (`react-refresh/only-export-components`). Déplacement sans changement de texte : chaque état garde sa clé et ses valeurs.

**Fichiers :**

- Modifier : `tests/unit/fiche-qui-pour.spec.ts`
- Modifier : `src/components/matching-fil/filQuiPour.ts`
- Modifier : `src/components/matching-fil/filAffichage.ts`
- Modifier : `src/components/matching-fil/QuiPourCeBien.tsx`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

**`tests/unit/fiche-qui-pour.spec.ts`**, 1/2 — remplacer (exact) :

````ts
import { DELAI_RECHERCHE_MS, etatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'

const T = Date.parse('2026-09-23T10:00:00Z')
````

par :

````ts
import { DELAI_RECHERCHE_MS, etatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'
import { ecrireEtat } from '@/components/matching-fil/filAffichage'

const T = Date.parse('2026-09-23T10:00:00Z')
````

**`tests/unit/fiche-qui-pour.spec.ts`**, 2/2 — remplacer (exact) :

````ts
    expect(etatAcquereurs(0, false, true)).toEqual({ genre: 'erreur' })
  })
})
````

par :

````ts
    expect(etatAcquereurs(0, false, true)).toEqual({ genre: 'erreur' })
  })
})

describe('ecrireEtat — un état s’écrit partout de la même façon (« Qui pour ce bien ? », fiche d’affaire)', () => {
  // La clé est le libellé, ses valeurs s'y accolent en JSON : ce qui compte est la clé choisie et ce qu'elle reçoit.
  const t = ((cle: string, o?: Record<string, unknown>) => (o ? `${cle} ${JSON.stringify(o)}` : cle)) as unknown as Parameters<typeof ecrireEtat>[2]

  it('chaque état a sa clé, et ses valeurs écrites — une date courte, un montant, un motif traduit', () => {
    expect(ecrireEtat({ cle: 'reporte', date: '2026-10-03T08:00:00Z' }, false, t)).toBe('fil.quiPour.etat.reporte {"date":"03.10"}')
    expect(ecrireEtat({ cle: 'revenu', prix: 1_560_000 }, false, t)).toBe(`fil.quiPour.etat.revenu {"prix":"CHF 1'560'000"}`)
    expect(ecrireEtat({ cle: 'propose', date: '2026-09-24T08:00:00Z' }, false, t)).toBe('fil.quiPour.etat.propose {"date":"24.09"}')
    expect(ecrireEtat({ cle: 'refuse', motif: 'fil.motifs.prix' }, false, t)).toBe('fil.quiPour.etat.refuse {"motif":"fil.motifs.prix"}')
    for (const cle of ['aProposer', 'proposeSansDate', 'interesse', 'visite', 'refuseSansMotif'] as const) {
      expect(ecrireEtat({ cle }, false, t)).toBe(`fil.quiPour.etat.${cle}`)
    }
  })

  it('le prix d’un revenu en location se dit par mois', () => {
    expect(ecrireEtat({ cle: 'revenu', prix: 2_950 }, true, t))
      .toBe(`fil.quiPour.etat.revenu ${JSON.stringify({ prix: `fil.valeurs.parMois ${JSON.stringify({ valeur: "CHF 2'950" })}` })}`)
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : `fiche-qui-pour.spec.ts` : 2 échecs sur 24 — les deux tests neufs d'`ecrireEtat`, sur `TypeError: ecrireEtat is not a function`.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/filQuiPour.ts`** — remplacer (exact) :

````ts
type EtatCompatible =
````

par :

````ts
export type EtatCompatible =
````

**`src/components/matching-fil/filAffichage.ts`**, 1/2 — remplacer (exact) :

````ts
import { signalPrix } from './filBoucle'
import { signalBien, type SignalBien } from './filSignaux'
````

par :

````ts
import { signalPrix } from './filBoucle'
import type { EtatCompatible } from './filQuiPour'
import { signalBien, type SignalBien } from './filSignaux'
````

**`src/components/matching-fil/filAffichage.ts`**, 2/2 — remplacer (exact) :

````ts
export const dateLongue = (iso: string): string => format(new Date(iso), 'dd.MM.yyyy')

/**
````

par :

````ts
export const dateLongue = (iso: string): string => format(new Date(iso), 'dd.MM.yyyy')

/**
 * L'état d'un acquéreur compatible, ou d'un bien de l'acheteur, écrit (`fil.quiPour.etat.*`) : « Proposé le 24.09 »,
 * « Revenu · refusé à CHF … ». Partagé par « Qui pour ce bien ? » et le bloc « Matching » de la fiche d'affaire : un
 * état se dit partout de la même façon.
 */
export function ecrireEtat(e: EtatCompatible, location: boolean, t: TFunction): string {
  switch (e.cle) {
    case 'reporte': return t('fil.quiPour.etat.reporte', { date: dateCourte(e.date) })
    case 'aProposer': return t('fil.quiPour.etat.aProposer')
    case 'revenu': return t('fil.quiPour.etat.revenu', { prix: montant(location, e.prix, t) })
    case 'propose': return t('fil.quiPour.etat.propose', { date: dateCourte(e.date) })
    case 'proposeSansDate': return t('fil.quiPour.etat.proposeSansDate')
    case 'interesse': return t('fil.quiPour.etat.interesse')
    case 'visite': return t('fil.quiPour.etat.visite')
    case 'refuse': return t('fil.quiPour.etat.refuse', { motif: t(e.motif) })
    case 'refuseSansMotif': return t('fil.quiPour.etat.refuseSansMotif')
    default: {
      // Un état ajouté à `etatCompatible` sans son texte ne compile plus. Une clé bâtie sur `e.cle` l'aurait affiché
      // sans ses valeurs (une date, un prix restés `{{…}}`), et rien ne l'aurait signalé.
      const inconnu: never = e
      return inconnu
    }
  }
}

/**
````

**`src/components/matching-fil/QuiPourCeBien.tsx`**, 1/3 — remplacer (exact) :

````tsx
import { dateCourte, dateLongue, montant } from './filAffichage'
````

par :

````tsx
import { dateLongue, ecrireEtat } from './filAffichage'
````

**`src/components/matching-fil/QuiPourCeBien.tsx`**, 2/3 — remplacer (exact) :

````tsx
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{texteEtat(m, maintenant, bien.location, t)}</span>
````

par :

````tsx
                    <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{ecrireEtat(etatCompatible(m, maintenant), bien.location, t)}</span>
````

**`src/components/matching-fil/QuiPourCeBien.tsx`**, 3/3 — remplacer (exact) :

````tsx
/** L'état d'un compatible, écrit. */
function texteEtat(m: Compatible, maintenant: number, location: boolean, t: TFunction): string {
  const e = etatCompatible(m, maintenant)
  switch (e.cle) {
    case 'reporte': return t('fil.quiPour.etat.reporte', { date: dateCourte(e.date) })
    case 'aProposer': return t('fil.quiPour.etat.aProposer')
    case 'revenu': return t('fil.quiPour.etat.revenu', { prix: montant(location, e.prix, t) })
    case 'propose': return t('fil.quiPour.etat.propose', { date: dateCourte(e.date) })
    case 'proposeSansDate': return t('fil.quiPour.etat.proposeSansDate')
    case 'interesse': return t('fil.quiPour.etat.interesse')
    case 'visite': return t('fil.quiPour.etat.visite')
    case 'refuse': return t('fil.quiPour.etat.refuse', { motif: t(e.motif) })
    case 'refuseSansMotif': return t('fil.quiPour.etat.refuseSansMotif')
    default: {
      // Un état ajouté à `etatCompatible` sans son texte ne compile plus. Une clé bâtie sur `e.cle` l'aurait affiché
      // sans ses valeurs (une date, un prix restés `{{…}}`), et rien ne l'aurait signalé.
      const inconnu: never = e
      return inconnu
    }
  }
}

/** Ce qui fait un ancien prospect, daté avec l'année : un deal perdu remonte jusqu'à 24 mois. */
````

par :

````tsx
/** Ce qui fait un ancien prospect, daté avec l'année : un deal perdu remonte jusqu'à 24 mois. */
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/fiche-qui-pour.spec.ts
```

Attendu : `Tests  24 passed (24)`.

- [ ] **Étape 5 — la batterie du commit**, une commande après l'autre, la suite unitaire SEULE.

```bash
npx tsc -b --force
npx eslint src tests --quiet
npx vitest run
npm run -s lint:deadcode
npm run -s lint:i18n-keys
npm run -s i18n:parity:ci
npm run -s i18n:coverage:ci
npm run -s lint:i18n
npm run -s lint:prose
```

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 361 passed (364)`, `Tests  1 failed | 5425 passed | 3 skipped (5429)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 0** (« refactor(matching): l'état d'un compatible s'écrit à un seul endroit ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C0
```

Attendu : `C0` suivi des huit premiers caractères de l'arbre.


---

## Tâche 2 : Le modèle pur du bloc — `filAffaire.ts`

Les biens de l'acheteur, rangés par état, avec les règles qui existent déjà : « Sa boucle » (`construireSaBoucle`) pour les biens qu'elle porte, `etatCompatible` pour l'état, `lienPlace` pour la place dans le fil, et, pour les biens à proposer, la règle « en vente » du fil. Conception §4.3, §4.4, §6.1. ⚠ Les biens à proposer se dédoublonnent sur ce que « Sa boucle » PORTE, pas sur ce que ses lectures rendent : le banc compare `gt` en chaînes, et sa lecture des revenus ramène des « à proposer » jamais proposés — un test le tient.

**Fichiers :**

- Créer : `tests/unit/fil-affaire.spec.ts`
- Créer : `src/components/matching-fil/filAffaire.ts`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

Créer **`tests/unit/fil-affaire.spec.ts`** :

````ts
/**
 * La fiche d'AFFAIRE branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) :
 * le modèle pur `filAffaire.ts` — les biens de l'acheteur rangés par état.
 *
 * Ce que cette spec refuse :
 *   · un refus, un mandat supprimé, un bien à proposer qui n'est plus une occasion, un bien reporté parmi les biens ;
 *   · un autre ordre que : intéressés et visites, proposés, biens à proposer — le score décroissant, l'id départage ;
 *   · plus de trois biens à proposer lus hors de « Sa boucle », plus de huit lignes, un total qui ne compte pas tout ;
 *   · un lien vers une autre place que celle du bien dans le fil ; un proposé reporté écrit « reporté ».
 */
import { describe, expect, it } from 'vitest'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { biensDeLAffaire } from '@/components/matching-fil/filAffaire'
import type { SearchCriteria } from '@/types/contact'

const ACHETEUR = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const JOUR = 86_400_000
/** L'heure de lecture de la fiche, FIXE : la base des dates des lignes (`il`), et le `maintenant` des reports. */
const MAINTENANT = Date.parse('2026-09-30T10:00:00Z')
const il = (j: number) => new Date(MAINTENANT - j * JOUR).toISOString()
const SANS = new Map<string, SearchCriteria | null>()

/** Une annonce du marché, active. */
const annonce = (titre: string, prix = 1_500_000, statut = 'active') => ({
  title: titre, city: 'Genève', price: prix, current_price: prix, transaction_type: 'buy', features: [], status: statut,
})
/** Un mandat, en vente par défaut. */
const mandat = (titre: string, prix = 1_450_000, statut = 'active', supprimeLe: string | null = null) => ({
  title: titre, city: 'Genève', price: prix, transaction_type: 'buy', features: [], status: statut, deleted_at: supprimeLe,
})
const ligne = (id: string, status: string, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact => ({
  id, status, score: 90, sent_at: il(5), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: null, apprentissage_at: null, client_search_id: 'cs9', snoozed_until: null,
  property_id: null, market_listing_id: `ml-${id}`, market_listing: annonce(`Annonce ${id}`),
  ...champs,
})
/** Un match à proposer, jamais proposé : ni date de proposition, ni prix proposé, ni motif. */
const aProposer = (id: string, score: number, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact =>
  ligne(id, 'suggested', { score, sent_at: null, ...champs })
const biens = (boucle: LigneBoucleContact[], neufs: LigneBoucleContact[] = []) =>
  biensDeLAffaire({ lignes: boucle, criteres: SANS }, neufs, ACHETEUR, MAINTENANT)

describe('biensDeLAffaire — quels biens', () => {
  it('les refus n’y entrent pas : ils vivent dans « Sa boucle »', () => {
    const r = biens([ligne('m1', 'sent'), ligne('m2', 'rejected', { reaction_motif: 'prix' })])
    expect(r.lignes.map((b) => b.id)).toEqual(['m1'])
  })

  it('un mandat supprimé n’a pas de ligne, qu’il soit proposé ou à proposer', () => {
    const r = biens(
      [ligne('m1', 'sent', { property_id: 'p1', market_listing_id: null, market_listing: null, property: null }),
        ligne('m2', 'interested', { property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Villa', 3_000_000, 'active', il(2)) })],
      [aProposer('m3', 99, { property_id: 'p3', market_listing_id: null, market_listing: null, property: mandat('Loft', 900_000, 'active', il(1)) })],
    )
    expect(r.lignes).toEqual([])
    expect(r.total).toBe(0)
  })

  it('un bien à proposer qui n’est plus une occasion n’entre pas — un proposé ou un intéressé garde sa ligne, avec l’état de son mandat', () => {
    const r = biens(
      [ligne('m1', 'sent', { property_id: 'p1', market_listing_id: null, market_listing: null, property: mandat('Petit-Saconnex', 1_540_000, 'sold') }),
        // Un revenu sur un mandat vendu, et sur une annonce retirée : ni l'un ni l'autre ne se propose plus.
        ligne('m2', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Carouge', 1_500_000, 'sold') }),
        ligne('m3', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', market_listing: annonce('Servette', 1_500_000, 'removed') })],
      [aProposer('m4', 99, { property_id: 'p4', market_listing_id: null, market_listing: null, property: mandat('Champel', 1_450_000, 'reserved') }),
        aProposer('m5', 98, { market_listing: annonce('Onex', 1_200_000, 'removed') }),
        aProposer('m6', 70, { market_listing: annonce('Plainpalais', 1_180_000, 'price_reduced') })],
    )
    expect(r.lignes.map((b) => [b.id, b.cleEtatMandat])).toEqual([['m1', 'listings:status.sold'], ['m6', null]])
  })

  it('un bien à proposer REPORTÉ attend son retour : il n’est pas parmi les meilleurs à proposer', () => {
    const r = biens([], [aProposer('m1', 99, { snoozed_until: il(-3) }), aProposer('m2', 80)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m2'])
  })

  it('un revenu reporté reste, écrit « reporté » et sans lien — la règle de « Sa boucle »', () => {
    const r = biens([ligne('m1', 'suggested', { prix_propose: 1_600_000, reaction_motif: 'prix', snoozed_until: il(-2) })])
    expect(r.lignes[0]).toMatchObject({ id: 'm1', rang: 2, lien: null })
    expect(r.lignes[0]!.etat).toEqual({ cle: 'reporte', date: il(-2) })
  })

  it('un match jamais proposé que la lecture de « Sa boucle » ramène sans le porter reste à proposer', () => {
    // Le banc compare `gt` en chaînes : sa lecture des revenus ramène aussi les `suggested` jamais proposés.
    const neuf = aProposer('m1', 95)
    expect(biens([neuf], [neuf]).lignes.map((b) => [b.id, b.etat.cle])).toEqual([['m1', 'aProposer']])
  })

  it('les trois meilleurs biens à proposer lus hors de « Sa boucle » — ceux qu’elle porte déjà n’y sont pas deux fois', () => {
    const revenu = ligne('m1', 'suggested', { score: 60, prix_propose: 1_600_000, reaction_motif: 'prix' })
    const r = biens([revenu], [revenu, aProposer('m2', 95), aProposer('m3', 97), aProposer('m4', 91), aProposer('m5', 99)])
    expect(r.lignes.map((b) => b.id)).toEqual(['m5', 'm3', 'm2', 'm1'])
    expect(r.total).toBe(4)
  })
})

describe('biensDeLAffaire — l’ordre, le plafond', () => {
  it('intéressés et visites planifiées, puis proposés, puis biens à proposer ; le score décroissant, l’id départage', () => {
    const r = biens(
      [ligne('m1', 'sent', { score: 99 }), ligne('m2', 'interested', { score: 70 }), ligne('m3', 'visit_planned', { score: 80 }),
        ligne('m4', 'sent', { score: 99 }), ligne('m5', 'suggested', { score: 98, prix_propose: 1_600_000, reaction_motif: 'prix' })],
      [aProposer('m6', 100)],
    )
    expect(r.lignes.map((b) => [b.id, b.rang])).toEqual([['m3', 0], ['m2', 0], ['m1', 1], ['m4', 1], ['m6', 2], ['m5', 2]])
  })

  it('huit lignes au plus ; le total compte tout', () => {
    const r = biens(Array.from({ length: 10 }, (_, i) => ligne(`m${i}`, 'sent', { score: 90 - i })), [aProposer('n1', 99)])
    expect(r.lignes).toHaveLength(8)
    expect(r.total).toBe(11)
    expect(r.lignes.at(-1)!.id).toBe('m7')
  })
})

describe('biensDeLAffaire — l’état, le lien', () => {
  it('chaque bien mène à SA place dans le fil ; une visite planifiée nulle part', () => {
    const r = biens(
      [ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned')],
      [aProposer('m4', 99, { property_id: 'p4', market_listing_id: null, market_listing: null, property: mandat('Champel') }),
        aProposer('m5', 98)],
    )
    const lien = Object.fromEntries(r.lignes.map((b) => [b.id, b.lien]))
    expect(lien).toEqual({
      m1: 'attente=c9',
      m2: 'onglet=aConclure&ligne=m2&contact=c9',
      m3: null,
      m4: 'ligne=m4&contact=c9',
      // Une annonce du marché : la ligne « Marché » de l'acheteur (`cleSelection`), où le fil la range.
      m5: 'ligne=marche%3Ac9&contact=c9',
    })
  })

  it('un proposé REPORTÉ reste « proposé » : le report ne vaut que pour un bien à proposer', () => {
    const r = biens([ligne('m1', 'sent', { sent_at: il(6), snoozed_until: il(-4) })])
    expect(r.lignes[0]!.etat).toEqual({ cle: 'propose', date: il(6) })
  })

  it('le titre, le prix, la location — le prix courant d’une annonce du marché', () => {
    const r = biens([], [aProposer('m1', 99, { market_listing: { ...annonce('Loft · Eaux-Vives', 1_500_000), current_price: 1_390_000, transaction_type: 'rent' } })])
    expect(r.lignes[0]).toMatchObject({ titre: 'Loft · Eaux-Vives', prix: 1_390_000, location: true, etat: { cle: 'aProposer' } })
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-affaire.spec.ts
```

Attendu : le fichier échoue au chargement, `Tests  no tests` : `Failed to resolve import "@/components/matching-fil/filAffaire" from "tests/unit/fil-affaire.spec.ts"`.

- [ ] **Étape 3 — le code.** Dans l'ordre :

Créer **`src/components/matching-fil/filAffaire.ts`** :

````ts
/**
 * La fiche d'AFFAIRE branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) —
 * modèle PUR : les biens de l'acheteur, rangés par état. Ni React, ni Supabase, ni traduction.
 *
 * ⚠ UNE RÈGLE, UNE SOURCE : les biens viennent de « Sa boucle » (`construireSaBoucle`), leur état de « Qui pour ce
 * bien ? » (`etatCompatible`), leur place dans le fil de `lienPlace`. Aucune de ces règles n'est recopiée ici.
 * ⚠ Les refus n'y entrent pas : ils vivent dans « Sa boucle ». Un bien à proposer qui n'est plus une OCCASION non plus —
 * un mandat qui n'est plus en vente (`active` et non supprimé, la règle du fil), une annonce du marché retirée. Un
 * proposé ou un intéressé garde sa ligne, et l'état de son mandat s'y ajoute (« Vendu »), comme dans « En attente ».
 */
import type { SearchCriteria } from '@/types/contact'
import { construireSaBoucle, type EtatBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { lienPlace } from './filLiens'
import { etatCompatible, type Compatible, type EtatCompatible } from './filQuiPour'
import { nombreOuNull, type FilMatch } from './filModele'

/** Un bien de l'acheteur, prêt à écrire. */
export interface BienAffaire {
  id: string
  /** 0 : intéressé ou visite planifiée · 1 : proposé · 2 : à proposer (un bien revenu, ou jamais proposé). */
  rang: 0 | 1 | 2
  score: number
  titre: string
  prix: number | null
  location: boolean
  /** L'état du bien, clé et valeurs brutes (dates, prix) : l'écran l'écrit (`ecrireEtat`). */
  etat: EtatCompatible
  /** La clé de l'état d'un mandat qui n'est plus en vente (`listings:status.*`, comme `cleEtatMandat`) ; `null` sinon. */
  cleEtatMandat: string | null
  /** La requête du fil qui ouvre ce bien à sa place ; `null` : il n'en a pas. */
  lien: string | null
}

/** Les lignes du bloc, et combien de biens l'acheteur a en tout : l'en-tête les compte tous. */
export interface BiensAffaire {
  lignes: BienAffaire[]
  total: number
}

/** Huit lignes au plus : au-delà, le fil. */
const PLAFOND_BIENS = 8
/** Les meilleurs biens à proposer lus hors de « Sa boucle » : trois, comme le bloc d'avant. */
const PLAFOND_A_PROPOSER = 3

const RANGS: Record<Exclude<EtatBoucle, 'refuse'>, BienAffaire['rang']> = { interesse: 0, visite: 0, propose: 1, revenu: 2 }

const premiere = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)

/** Le statut du mandat d'un match, lu sur sa jointure ; `null` pour une annonce du marché. */
const statutMandat = (l: LigneBoucleContact): string | null => (l.property_id ? premiere(l.property)?.status ?? null : null)

/**
 * Un bien encore OCCASION — le mot du copilote WhatsApp : un mandat en vente (`active`) et non supprimé, une annonce
 * du marché non retirée. Sans jointure, rien ne le dit : la RLS masque un mandat supprimé.
 */
function occasion(l: LigneBoucleContact): boolean {
  if (l.property_id) {
    const p = premiere(l.property)
    return p != null && p.status === 'active' && p.deleted_at == null
  }
  const a = premiere(l.market_listing)
  return a != null && a.status !== 'removed'
}

/**
 * Un match, comme « Qui pour ce bien ? » le lit : le report ne vaut que pour un match À PROPOSER (`versCompatible`) —
 * un bien proposé puis reporté s'écrirait sinon « Reporté jusqu'au … », là où « Sa boucle » dit « Proposé ».
 */
const compatibleDe = (m: FilMatch): Compatible => ({
  id: m.id, score: m.score, suivi: m.suivi,
  reporteJusquau: (m.suivi?.statut ?? 'suggested') === 'suggested' ? m.reporteJusquau : null,
  acheteur: { id: m.acheteur.id, prenom: m.acheteur.prenom, nom: m.acheteur.nom },
})

/** Un bien à proposer lu hors de « Sa boucle » ; `null` s'il n'est plus une occasion ou s'il est reporté. */
function bienAProposer(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], maintenant: number): BienAffaire | null {
  if (l.status !== 'suggested' || !occasion(l)) return null
  const marche = l.property_id == null
  const b = marche ? premiere(l.market_listing) : premiere(l.property)
  const prixPropose = nombreOuNull(l.prix_propose)
  // Le suivi d'un match à proposer n'existe que s'il a déjà été proposé — la règle de `suiviAProposer` dans le fil.
  const jamaisPropose = prixPropose == null && l.reaction_motif == null
  const c: Compatible = {
    id: l.id, score: nombreOuNull(l.score) ?? 0, reporteJusquau: l.snoozed_until,
    suivi: jamaisPropose ? undefined : {
      statut: 'suggested', proposeLe: l.sent_at, reponduLe: l.response_at, motif: l.reaction_motif,
      note: l.reaction_note, prixPropose, apprisLe: l.apprentissage_at,
    },
    acheteur: { id: acheteur.id, prenom: acheteur.prenom, nom: acheteur.nom },
  }
  const etat = etatCompatible(c, maintenant)
  if (etat.cle === 'reporte') return null
  return {
    id: l.id, rang: 2, score: c.score,
    titre: b?.title?.trim() || b?.address?.trim() || '',
    prix: marche ? nombreOuNull(b?.current_price ?? null) ?? nombreOuNull(b?.price ?? null) : nombreOuNull(b?.price ?? null),
    location: b?.transaction_type === 'rent',
    etat, cleEtatMandat: null,
    lien: lienPlace({ id: l.id, statut: 'suggested', contactId: acheteur.id, marche, reporte: false }),
  }
}

const parRang = (a: BienAffaire, b: BienAffaire): number => a.rang - b.rang || b.score - a.score || a.id.localeCompare(b.id)

/**
 * Les biens de l'acheteur, par état : intéressés et visites planifiées, puis proposés, puis biens à proposer — les
 * revenus de « Sa boucle » et les trois meilleurs lus hors d'elle (`aProposer`, les `suggested` de l'acheteur par score).
 * `maintenant` est l'heure de la lecture : c'est contre elle que se juge un report.
 */
export function biensDeLAffaire(
  boucle: { lignes: readonly LigneBoucleContact[]; criteres: ReadonlyMap<string, SearchCriteria | null> },
  aProposer: readonly LigneBoucleContact[],
  acheteur: FilMatch['acheteur'],
  maintenant: number,
): BiensAffaire {
  const parId = new Map(boucle.lignes.map((l) => [l.id, l]))
  const saBoucle = construireSaBoucle(boucle.lignes, boucle.criteres, acheteur, maintenant)
  const tous: BienAffaire[] = []
  for (const b of saBoucle.biens) {
    const l = parId.get(b.m.id)
    if (b.etat === 'refuse' || !l) continue
    // Un revenu est un bien À PROPOSER : il sort, comme de « À proposer » dans le fil, s'il n'est plus une occasion.
    if (b.etat === 'revenu' && !occasion(l)) continue
    const statut = statutMandat(l)
    tous.push({
      id: b.m.id, rang: RANGS[b.etat], score: b.m.score, titre: b.m.bien.titre, prix: b.m.bien.prix, location: b.m.bien.location,
      etat: etatCompatible(compatibleDe(b.m), maintenant),
      cleEtatMandat: statut && statut !== 'active' ? `listings:status.${statut}` : null,
      lien: b.lien,
    })
  }
  // Ce que « Sa boucle » PORTE — ses biens, refus compris —, pas tout ce que ses lectures ont rendu : un match jamais
  // proposé qu'elle écarte (le banc compare `gt` en chaînes, et sa lecture des revenus le ramène) reste à proposer.
  const vus = new Set(saBoucle.biens.map((b) => b.m.id))
  const neufs: BienAffaire[] = []
  for (const l of aProposer) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const b = bienAProposer(l, acheteur, maintenant)
    if (b) neufs.push(b)
  }
  tous.push(...neufs.sort(parRang).slice(0, PLAFOND_A_PROPOSER))
  tous.sort(parRang)
  return { lignes: tous.slice(0, PLAFOND_BIENS), total: tous.length }
}
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/fil-affaire.spec.ts
```

Attendu : `Tests  12 passed (12)`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/components/matching-fil/filAffaire.ts tests/unit/fil-affaire.spec.ts --quiet
```

Attendu : sortie 0, aucun message.


---

## Tâche 3 : La lecture — `useMatchingAffaire`

Deux lectures sous la clé du fil (`CLE_FIL`), que ses gestes invalident déjà : « Sa boucle », telle quelle, et les 20 meilleurs biens à proposer de l'acheteur (par score, puis par id). Les colonnes de « Sa boucle » s'exportent (`COLONNES_BOUCLE`) au lieu d'être recopiées. La lecture entre dans le périmètre de `matching-sans-sortie`. Conception §6.2.

**Fichiers :**

- Créer : `tests/unit/matching-affaire-lecture.spec.tsx`
- Modifier : `tests/unit/matching-sans-sortie.spec.ts`
- Modifier : `src/hooks/useContactSentMatches.ts`
- Créer : `src/hooks/useMatchingAffaire.ts`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

Créer **`tests/unit/matching-affaire-lecture.spec.tsx`** :

````tsx
/**
 * La lecture du matching de la fiche d'affaire (`useMatchingAffaire`, étape 5b-1, conception
 * `2026-09-30-fiche-affaire-matching-design.md` §6.2) : les biens de l'acheteur, par état.
 *
 * Ce que cette spec refuse :
 *   · des biens à proposer lus autrement que ceux de L'ACHETEUR, en `suggested`, par score puis id, vingt au plus ;
 *   · une lecture hors de la clé du fil (`CLE_FIL`) : un geste consigné dans le fil ne la relirait pas ;
 *   · un bien compté deux fois quand « Sa boucle » le porte déjà ;
 *   · une lecture sans acheteur ;
 *   · un échec tu, ou un « Réessayer » qui ne relirait pas tout.
 *
 * Le crochet est monté pour de vrai — `createRoot` + `act` — sur un vrai `QueryClient` ; Supabase est simulé : chaque
 * lecture est notée avec ses filtres, et sa réponse dépend d'eux.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Lecture {
  table: string
  eq: [string, unknown][]
  in: [string, unknown][]
  gt: [string, unknown][]
  order: [string, unknown][]
  limit: number | null
}
type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  lectures: [] as Lecture[],
  repondre: (_l: Lecture): Promise<Reponse> => Promise.resolve({ data: [], error: null }),
}))

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal }
  return {
    supabase: {
      channel: () => canal,
      removeChannel: () => undefined,
      from: (table: string) => {
        const l: Lecture = { table, eq: [], in: [], gt: [], order: [], limit: null }
        const chaine = {
          select: () => chaine,
          eq: (c: string, v: unknown) => { l.eq.push([c, v]); return chaine },
          in: (c: string, v: unknown) => { l.in.push([c, v]); return chaine },
          gt: (c: string, v: unknown) => { l.gt.push([c, v]); return chaine },
          order: (c: string, o?: unknown) => { l.order.push([c, o ?? null]); return chaine },
          limit: (n: number) => { l.limit = n; return chaine },
          abortSignal: () => chaine,
          then: (ok: (r: Reponse) => unknown, ko: (e: unknown) => unknown) => {
            h.lectures.push(l)
            return h.repondre(l).then(ok, ko)
          },
        }
        return chaine
      },
    },
  }
})

import { CLE_FIL } from '@/components/matching-fil/filModele'
import { useMatchingAffaire, type MatchingAffaire } from '@/hooks/useMatchingAffaire'

const annonce = (titre: string) => ({ title: titre, city: 'Genève', price: 1_500_000, current_price: 1_500_000, transaction_type: 'buy', status: 'active' })
const match = (id: string, status: string, score: number, sentAt: string | null = null) => ({
  id, status, score, sent_at: sentAt, response_at: null, reaction_motif: null, reaction_note: null, prix_propose: null,
  apprentissage_at: null, client_search_id: null, snoozed_until: null, property_id: null, market_listing_id: `ml-${id}`,
  market_listing: annonce(`Annonce ${id}`),
})

/** Les réponses par défaut : « Sa boucle » porte m1 (proposé) ; les biens à proposer lus ramènent m1 aussi, m2 et m3. */
function repondreParDefaut(l: Lecture): Promise<Reponse> {
  const statut = l.eq.find(([c]) => c === 'status')?.[1]
  if (l.table === 'matches' && l.in.length) return Promise.resolve({ data: [match('m1', 'sent', 90, '2026-09-28T08:00:00Z')], error: null })
  if (l.table === 'matches' && statut === 'suggested' && l.gt.length) return Promise.resolve({ data: [], error: null })
  if (l.table === 'matches' && statut === 'suggested') {
    return Promise.resolve({ data: [match('m2', 'suggested', 99), match('m3', 'suggested', 97), match('m1', 'suggested', 90)], error: null })
  }
  return Promise.resolve({ data: [], error: null })
}

const vues: MatchingAffaire[] = []
function Lecteur({ contactId }: { contactId: string | undefined }) {
  const v = useMatchingAffaire(contactId)
  useEffect(() => { vues.push(v) })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
let client: QueryClient

async function monter(contactId: string | undefined): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<QueryClientProvider client={client}><Lecteur contactId={contactId} /></QueryClientProvider>)
  })
  // Les lectures résolues, puis leur rendu.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const derniere = (): MatchingAffaire => vues.at(-1)!
/** Les lectures des biens à proposer : `suggested`, sans le filtre des revenus de « Sa boucle ». */
const lecturesAProposer = () => h.lectures.filter((l) => l.table === 'matches' && !l.in.length && !l.gt.length)

beforeEach(() => {
  h.lectures = []
  h.repondre = repondreParDefaut
  vues.length = 0
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  client.clear()
})

describe('useMatchingAffaire', () => {
  it('les biens à proposer de L’ACHETEUR : `suggested`, par score puis id, vingt au plus', async () => {
    await monter('c9')
    const [l] = lecturesAProposer()
    expect(l).toMatchObject({
      eq: [['contact_id', 'c9'], ['status', 'suggested']],
      order: [['score', { ascending: false }], ['id', null]],
      limit: 20,
    })
  })

  it('un bien que « Sa boucle » porte déjà n’est pas compté deux fois ; il y garde son état', async () => {
    await monter('c9')
    expect(derniere().lignes.map((b) => [b.id, b.etat.cle])).toEqual([['m1', 'propose'], ['m2', 'aProposer'], ['m3', 'aProposer']])
    expect(derniere().total).toBe(3)
  })

  it('sous la clé du fil : un geste consigné dans le fil (`CLE_FIL` invalidée) relit les biens à proposer', async () => {
    await monter('c9')
    expect(lecturesAProposer()).toHaveLength(1)
    await act(async () => { await client.invalidateQueries({ queryKey: [CLE_FIL] }) })
    expect(lecturesAProposer()).toHaveLength(2)
  })

  it('sans acheteur, aucune lecture', async () => {
    await monter(undefined)
    expect(h.lectures).toEqual([])
    expect(derniere()).toMatchObject({ lignes: [], total: 0, isLoading: false, isError: false })
  })

  it('un échec se dit ; « Réessayer » relit tout', async () => {
    h.repondre = (l) => (l.table === 'matches' && !l.in.length && !l.gt.length
      ? Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
      : repondreParDefaut(l))
    await monter('c9')
    expect(derniere().isError).toBe(true)
    h.repondre = repondreParDefaut
    const avant = h.lectures.length
    await act(async () => { await derniere().refetch() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere().isError).toBe(false)
    // « Sa boucle » (ses deux lectures de matchs) et les biens à proposer.
    expect(h.lectures.length - avant).toBe(3)
  })
})
````

**`tests/unit/matching-sans-sortie.spec.ts`** — remplacer (exact) :

````ts
  'src/hooks/useContactSentMatches.ts',
  // Lot D1 (23.09.2026) : les surfaces qui montrent la boucle hors du fil. `src/components/matching-fil` couvre déjà
````

par :

````ts
  'src/hooks/useContactSentMatches.ts',
  // Étape 5b-1 : la lecture du matching de la fiche d'affaire. Son bloc et son modèle vivent dans `matching-fil` ; la
  // fiche d'affaire, page hôte, reste hors du périmètre : elle porte ses liens WhatsApp et e-mail vers le client.
  'src/hooks/useMatchingAffaire.ts',
  // Lot D1 (23.09.2026) : les surfaces qui montrent la boucle hors du fil. `src/components/matching-fil` couvre déjà
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/matching-affaire-lecture.spec.tsx tests/unit/matching-sans-sortie.spec.ts
```

Attendu : `matching-affaire-lecture.spec.tsx` échoue au chargement (`Failed to resolve import "@/hooks/useMatchingAffaire"`) ; `matching-sans-sortie.spec.ts` : 1 échec sur 18 — « le périmètre est lu », `src/hooks/useMatchingAffaire.ts introuvable`.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/hooks/useContactSentMatches.ts`**, 1/2 — remplacer (exact) :

````ts
 * seul un super-administrateur lit encore (`saBoucle`). Les deux lectures partagent ces colonnes.
 */
const COLONNES = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
````

par :

````ts
 * seul un super-administrateur lit encore (`saBoucle`). Les deux lectures partagent ces colonnes — et la fiche d'affaire,
 * pour les biens à proposer de son acheteur (`useMatchingAffaire`) : `saBoucle` et `filAffaire` lisent les mêmes lignes.
 */
export const COLONNES_BOUCLE = 'id, status, score, sent_at, response_at, reaction_motif, reaction_note, prix_propose, apprentissage_at,'
````

**`src/hooks/useContactSentMatches.ts`**, 2/2 — remplacer (exact) :

````ts
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES)
          .eq('contact_id', contactId).in('status', STATUTS_BOUCLE)
          .order('sent_at', { ascending: false, nullsFirst: false }).order('id').abortSignal(signal)),
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES)
````

par :

````ts
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES_BOUCLE)
          .eq('contact_id', contactId).in('status', STATUTS_BOUCLE)
          .order('sent_at', { ascending: false, nullsFirst: false }).order('id').abortSignal(signal)),
        lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES_BOUCLE)
````

Créer **`src/hooks/useMatchingAffaire.ts`** :

````ts
/**
 * La fiche d'affaire branchée sur le matching (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md`) —
 * ce que la fiche lit du matching de son acheteur : ses biens, par état (`biensDeLAffaire`).
 *
 * Deux lectures, sous la clé du fil (`CLE_FIL`) : un geste consigné dans le fil les invalide.
 *   · « Sa boucle » (`useContactSentMatches`), telle quelle — son abonnement realtime fait paraître la réponse qu'un
 *     collègue consigne ;
 *   · les meilleurs biens à proposer de l'acheteur, 20 au plus par score : `biensDeLAffaire` n'en garde que trois, une
 *     fois écartés ceux qui ne sont plus une occasion et les reportés.
 * ⛔ Rien ne part vers l'acheteur : la fiche MONTRE et ORIENTE, le fil agit.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { COLONNES_BOUCLE, useContactSentMatches } from '@/hooks/useContactSentMatches'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { biensDeLAffaire, type BiensAffaire } from '@/components/matching-fil/filAffaire'
import { CLE_FIL, lire, type FilMatch } from '@/components/matching-fil/filModele'

/** Les biens à proposer lus : de quoi en garder trois, une fois écartés les reportés et les biens qui ne se proposent plus. */
const A_PROPOSER_LUS = 20

/** Ce que la fiche lit du matching de l'acheteur. */
export interface MatchingAffaire extends BiensAffaire {
  isLoading: boolean
  isError: boolean
  /** Relit tout — le « Réessayer » du bloc. */
  refetch: () => Promise<unknown>
}

/** Les biens de l'acheteur d'une affaire, par état ; rien sans acheteur. */
export function useMatchingAffaire(contactId: string | undefined): MatchingAffaire {
  const boucle = useContactSentMatches(contactId)
  const aProposer = useQuery({
    queryKey: [CLE_FIL, 'affaire-a-proposer', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    // Un ORDRE TOTAL : sans l'id, la troncature garderait n'importe quels biens à score égal (la règle de « Sa boucle »).
    queryFn: ({ signal }) => lire<LigneBoucleContact>(supabase.from('matches').select(COLONNES_BOUCLE)
      .eq('contact_id', contactId!).eq('status', 'suggested')
      .order('score', { ascending: false }).order('id').limit(A_PROPOSER_LUS).abortSignal(signal)),
  })
  // L'heure de la lecture : un report se juge contre elle, comme dans « Sa boucle » (`chargeLe`).
  const maintenant = Math.max(boucle.chargeLe, aProposer.dataUpdatedAt)
  const biens = useMemo((): BiensAffaire => {
    if (!contactId) return { lignes: [], total: 0 }
    // L'acheteur ne sert qu'à la place de ses biens dans le fil (`lienPlace`) : son id suffit.
    const acheteur: FilMatch['acheteur'] = { id: contactId, prenom: '', nom: '', telephone: null, email: null, kyc: 'none' }
    return biensDeLAffaire({ lignes: boucle.lignes, criteres: boucle.criteres }, aProposer.data ?? [], acheteur, maintenant)
  }, [contactId, boucle.lignes, boucle.criteres, aProposer.data, maintenant])
  const relireBoucle = boucle.refetch
  const relireAProposer = aProposer.refetch
  return {
    ...biens,
    isLoading: boucle.isLoading || aProposer.isLoading,
    isError: boucle.isError || aProposer.isError,
    refetch: () => Promise.all([relireBoucle(), relireAProposer()]),
  }
}
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/matching-affaire-lecture.spec.tsx tests/unit/matching-sans-sortie.spec.ts tests/unit/sa-boucle.spec.ts
```

Attendu : `Test Files  3 passed (3)`, `Tests  49 passed (49)`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/hooks/useMatchingAffaire.ts src/hooks/useContactSentMatches.ts tests/unit/matching-affaire-lecture.spec.tsx tests/unit/matching-sans-sortie.spec.ts --quiet
```

Attendu : sortie 0, aucun message.


---

## Tâche 4 : Le bloc — `BlocMatchingAffaire.tsx`

Présentationnel : une ligne par bien — titre, état en petit, prix, `FilScore` —, un clic vers la place du bien dans le fil avec un jeton d'arrivée, une ligne sans place qui n'est pas un bouton, et trois états : lecture, échec (« Réessayer » relit), vide. Ses textes sous `matching:fil.affaire.*`, « Réessayer » repris de `matching:fil.reessayer`. Son lien s'inscrit dans `jeton-arrivee`. Aucun littéral de grammaire : `matching-fil` n'en tolère aucun. Conception §4.2, §4.5, §6.3.

**Fichiers :**

- Créer : `tests/unit/bloc-matching-affaire.spec.tsx`
- Modifier : `tests/unit/jeton-arrivee.spec.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`
- Créer : `src/components/matching-fil/BlocMatchingAffaire.tsx`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

Créer **`tests/unit/bloc-matching-affaire.spec.tsx`** :

````tsx
/**
 * Le bloc « Matching » de la fiche d'affaire (`BlocMatchingAffaire`, étape 5b-1, conception
 * `2026-09-30-fiche-affaire-matching-design.md` §4), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · un état écrit autrement que dans « Qui pour ce bien ? » ; un mandat hors vente qui tairait son état ;
 *   · un score écrit autrement qu'en `FilScore` (« 92 % » était l'écriture du bloc d'avant) ;
 *   · une ligne qui mènerait ailleurs qu'à la place du bien dans le fil, ou sans jeton d'arrivée ;
 *   · une ligne sans place (une visite planifiée) qui se donnerait pour un bouton ;
 *   · une lecture en cours ou en échec lue comme une liste vide ; un « Réessayer » qui ne relirait rien.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import BlocMatchingAffaire from '@/components/matching-fil/BlocMatchingAffaire'
import type { BienAffaire } from '@/components/matching-fil/filAffaire'
import type { MatchingAffaire } from '@/hooks/useMatchingAffaire'
import { crmPalette } from '@/components/crm/tokens'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

const sp = crmPalette(false)
const bien = (id: string, champs: Partial<BienAffaire>): BienAffaire => ({
  id, rang: 1, score: 97, titre: `Bien ${id}`, prix: 1_450_000, location: false, etat: { cle: 'aProposer' },
  cleEtatMandat: null, lien: null, ...champs,
})
const lecture = (champs: Partial<MatchingAffaire>): MatchingAffaire => ({
  lignes: [], total: 0, isLoading: false, isError: false, refetch: () => Promise.resolve(), ...champs,
})

/** Où la navigation a mené : l'adresse et l'état du routeur. */
const vu: { arrivee: { search: string; state: unknown } | null } = { arrivee: null }
function Fil() {
  const l = useLocation()
  useEffect(() => { vu.arrivee = { search: l.search, state: l.state } })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(l: MatchingAffaire): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(
      <MemoryRouter initialEntries={['/fiche']} future={ROUTER_FUTURE}>
        <Routes>
          <Route path="/fiche" element={<BlocMatchingAffaire sp={sp} lecture={l} />} />
          <Route path="/dashboard/matching" element={<Fil />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}
const texte = (): string => hote!.textContent ?? ''

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  vu.arrivee = null
})

describe('BlocMatchingAffaire', () => {
  it('une ligne : le titre, l’état écrit comme dans « Qui pour ce bien ? », le prix, le score en `FilScore`', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'propose', date: '2026-09-24T08:00:00Z' } })], total: 1 }))
    expect(texte()).toContain('Bien m1')
    expect(texte()).toContain('fil.quiPour.etat.propose {"date":"24.09"}')
    expect(texte()).toContain("CHF 1'450'000")
    expect(hote!.querySelector('[title^="fil.scoreAria"]')?.getAttribute('title')).toBe('fil.scoreAria {"score":97,"palier":"fil.palier.fort"}')
    expect(texte()).not.toContain('%')
  })

  it('un mandat qui n’est plus en vente ajoute son état : « Proposé le 24.09 · Vendu »', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'propose', date: '2026-09-24T08:00:00Z' }, cleEtatMandat: 'listings:status.sold' })], total: 1 }))
    expect(texte()).toContain('fil.quiPour.etat.propose {"date":"24.09"} · listings:status.sold')
  })

  it('une ligne mène au bien, à SA place dans le fil, avec un jeton d’arrivée neuf', async () => {
    await rendre(lecture({ lignes: [bien('m1', { lien: 'attente=c9' })], total: 1 }))
    await act(async () => { hote!.querySelector('button')!.click() })
    expect(vu.arrivee?.search).toBe('?attente=c9')
    expect((vu.arrivee?.state as { arrivee?: unknown } | null)?.arrivee).toEqual(expect.any(String))
  })

  it('une ligne sans place — une visite planifiée — n’est pas un bouton', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'visite' }, lien: null })], total: 1 }))
    expect(hote!.querySelector('button')).toBeNull()
    expect(texte()).toContain('fil.quiPour.etat.visite')
  })

  it('en lecture, en échec, vide : trois états distincts ; « Réessayer » relit', async () => {
    await rendre(lecture({ isLoading: true }))
    expect(hote!.querySelector('[role="status"]')?.textContent).toBe('fil.affaire.chargement')
    act(() => racine!.unmount())
    hote!.remove()

    const refetch = vi.fn(() => Promise.resolve())
    await rendre(lecture({ isError: true, refetch }))
    expect(texte()).toContain('fil.affaire.erreur')
    expect(texte()).not.toContain('fil.affaire.aucun')
    await act(async () => { hote!.querySelector('button')!.click() })
    expect(refetch).toHaveBeenCalledTimes(1)
    act(() => racine!.unmount())
    hote!.remove()

    await rendre(lecture({}))
    expect(texte()).toBe('fil.affaire.aucun')
  })
})
````

**`tests/unit/jeton-arrivee.spec.tsx`** — remplacer (exact) :

````tsx
  const SITES: Record<string, number> = {
    // « Ajouter un acheteur », la couverture de premier lancement du fil.
````

par :

````tsx
  const SITES: Record<string, number> = {
    // Étape 5b-1 : chaque bien du bloc « Matching » de la fiche d'affaire, à sa place dans le fil.
    'src/components/matching-fil/BlocMatchingAffaire.tsx': 1,
    // « Ajouter un acheteur », la couverture de premier lancement du fil.
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/bloc-matching-affaire.spec.tsx tests/unit/jeton-arrivee.spec.tsx
```

Attendu : `bloc-matching-affaire.spec.tsx` échoue au chargement (`Failed to resolve import "@/components/matching-fil/BlocMatchingAffaire"`) ; `jeton-arrivee.spec.tsx` : 1 échec sur 26 — « chaque lien d'arrivée porte un jeton neuf », onze sites attendus, dix trouvés.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/i18n/locales/fr/matching.json`** — remplacer (exact) :

````json
  "fil": {
    "titre": "Matching",
````

par :

````json
  "fil": {
    "affaire": {
      "chargement": "Lecture des biens de l'acheteur…",
      "erreur": "Les biens de l'acheteur n'ont pas pu être lus.",
      "aucun": "Aucun bien pour l'instant."
    },
    "titre": "Matching",
````

**`src/i18n/locales/en/matching.json`** — remplacer (exact) :

````json
  "fil": {
    "titre": "Matching",
````

par :

````json
  "fil": {
    "affaire": {
      "chargement": "Reading the buyer's properties…",
      "erreur": "The buyer's properties could not be read.",
      "aucun": "No property yet."
    },
    "titre": "Matching",
````

**`src/i18n/locales/de/matching.json`** — remplacer (exact) :

````json
  "fil": {
    "titre": "Matching",
````

par :

````json
  "fil": {
    "affaire": {
      "chargement": "Objekte des Käufers werden gelesen…",
      "erreur": "Die Objekte des Käufers konnten nicht gelesen werden.",
      "aucun": "Noch kein Objekt."
    },
    "titre": "Matching",
````

**`src/i18n/locales/it/matching.json`** — remplacer (exact) :

````json
  "fil": {
    "titre": "Matching",
````

par :

````json
  "fil": {
    "affaire": {
      "chargement": "Lettura degli immobili dell'acquirente…",
      "erreur": "Non è stato possibile leggere gli immobili dell'acquirente.",
      "aucun": "Ancora nessun immobile."
    },
    "titre": "Matching",
````

Créer **`src/components/matching-fil/BlocMatchingAffaire.tsx`** :

````tsx
/**
 * Le bloc « Matching » de la fiche d'affaire (étape 5b-1, conception `2026-09-30-fiche-affaire-matching-design.md` §4) :
 * les biens de l'acheteur, un par ligne — le titre, son état en petit, le prix, le score. Une ligne mène au bien, à sa
 * place dans le fil ; une ligne sans place (une visite planifiée, un revenu reporté) ne mène nulle part.
 * Présentationnel : la fiche lit (`useMatchingAffaire`) et porte la section, son titre et « Ouvrir le matching ».
 *
 * ⚠ L'état s'écrit comme dans « Qui pour ce bien ? » (`ecrireEtat`) : une ligne de texte, pas une pastille.
 * ⚠ Aucun littéral de rayon, d'espacement ni de taille de texte : le cliquet de `megga-x-grammar.spec.ts` n'en tolère
 * aucun dans `matching-fil`.
 * ⛔ Rien ne part vers l'acheteur : une ligne ouvre le fil, où l'agent agit.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import type { MatchingAffaire } from '@/hooks/useMatchingAffaire'
import { avecArrivee } from '@/lib/jetonArrivee'
import type { BienAffaire } from './filAffaire'
import { ecrireEtat, encreAccent, montant } from './filAffichage'
import { FilScore } from './filAtomes'
import { palierScore } from './filModele'

export default function BlocMatchingAffaire({ sp, lecture }: { sp: CrmPalette; lecture: MatchingAffaire }) {
  const { t } = useTranslation('matching')
  const navigate = useNavigate()
  const note: CSSProperties = { fontSize: 'var(--crm-text-md)', color: sp.sub }

  // En lecture ou en échec, la liste est INCONNUE, pas vide : ni « Aucun bien », ni une ligne qui ressemble à un résultat.
  if (lecture.isLoading) return <span role="status" style={note}>{t('fil.affaire.chargement')}</span>
  if (lecture.isError) {
    return (
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', ...note }}>
        {t('fil.affaire.erreur')}
        <button type="button" onClick={() => { void lecture.refetch() }} style={{
          border: 0, background: 'transparent', padding: 0, fontFamily: 'inherit', cursor: 'pointer',
          fontSize: 'var(--crm-text-md)', fontWeight: 600, color: encreAccent(sp),
        }}>{t('fil.reessayer')}</button>
      </span>
    )
  }
  if (lecture.lignes.length === 0) return <span style={note}>{t('fil.affaire.aucun')}</span>

  const contenu = (b: BienAffaire): ReactNode => (
    <>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{b.titre}</span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {ecrireEtat(b.etat, b.location, t)}{b.cleEtatMandat ? ` · ${t(b.cleEtatMandat)}` : ''}
        </span>
      </span>
      {b.prix != null && (
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {montant(b.location, b.prix, t)}
        </span>
      )}
      <FilScore sp={sp} score={b.score} palier={palierScore(b.score)} />
    </>
  )
  const ligne = (premiere: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-sm) 0', width: '100%',
    textAlign: 'left', border: 0, background: 'transparent', fontFamily: 'inherit', color: 'inherit',
    borderTop: premiere ? 'none' : `1px solid ${sp.cardBorder}`,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {lecture.lignes.map((b, i) => (b.lien ? (
        <button key={b.id} type="button" style={{ ...ligne(i === 0), cursor: 'pointer' }}
          onClick={() => navigate(`/dashboard/matching?${b.lien}`, avecArrivee())}>
          {contenu(b)}
        </button>
      ) : (
        <div key={b.id} style={ligne(i === 0)}>{contenu(b)}</div>
      )))}
    </div>
  )
}
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/bloc-matching-affaire.spec.tsx tests/unit/jeton-arrivee.spec.tsx tests/unit/megga-x-grammar.spec.ts tests/unit/matching-cles-mortes.spec.ts
```

Attendu : `Test Files  4 passed (4)`, `Tests  81 passed (81)`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/components/matching-fil/BlocMatchingAffaire.tsx tests/unit/bloc-matching-affaire.spec.tsx tests/unit/jeton-arrivee.spec.tsx --quiet && npm run -s i18n:parity:ci && npm run -s lint:prose
```

Attendu : sortie 0 ; `FR↔en/de/it : 0 manquante(s), 0 orpheline(s)` ; `✓ Typographie MEGGA OK — 56 fichiers i18n, 0 tell.`


---

## Tâche 5 : La fiche monte le bloc ; l'ancien part

`DealDetailPage` rend la section « Matching » en Prospects, Recherche et Visites — sans acheteur, rien —, sous le contenu de phase ; « Ouvrir le matching » passe par `lienFil({ contact })`. L'ancien bloc « Biens à proposer », sa lecture (`useFicheAffaire` → `matchs`) et ses quatre clés partent. `score-une-ecriture` s'étend à la fiche. Conception §4.1, §6.4, §6.5. Fin du commit 1 : la batterie complète, puis la photo.

**Fichiers :**

- Modifier : `tests/unit/score-une-ecriture.spec.ts`
- Modifier : `src/i18n/locales/fr/pipeline.json`
- Modifier : `src/i18n/locales/en/pipeline.json`
- Modifier : `src/i18n/locales/de/pipeline.json`
- Modifier : `src/i18n/locales/it/pipeline.json`
- Modifier : `src/hooks/useFicheAffaire.ts`
- Modifier : `src/pages/agent/DealDetailPage.tsx`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

**`tests/unit/score-une-ecriture.spec.ts`**, 1/2 — remplacer (exact) :

````ts
 *   · un score d'acquéreur écrit à la main dans « Planifier une visite », ou sa clé `fiche.visite.qui.score` revenue.
````

par :

````ts
 *   · un score d'acquéreur écrit à la main dans « Planifier une visite », ou sa clé `fiche.visite.qui.score` revenue ;
 *   · un score de bien écrit « 92 % » sur la fiche d'affaire (étape 5b-1) : son bloc « Matching » passe par `FilScore`.
````

**`tests/unit/score-une-ecriture.spec.ts`**, 2/2 — remplacer (exact) :

````ts
  })

  it('l’estimation reste dite, dans l’infobulle et le libellé d’accessibilité de `FilScore`', () => {
````

par :

````ts
  })

  it('la fiche d’affaire écrit le score de chaque bien comme le fil : `FilScore`, jamais « {score} % »', () => {
    expect(source('src/components/matching-fil/BlocMatchingAffaire.tsx')).toContain('<FilScore ')
    const page = source('src/pages/agent/DealDetailPage.tsx')
    expect(page).toContain('<BlocMatchingAffaire ')
    expect(page).not.toMatch(/\.score\}\s*%/)
  })

  it('l’estimation reste dite, dans l’infobulle et le libellé d’accessibilité de `FilScore`', () => {
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/score-une-ecriture.spec.ts
```

Attendu : `score-une-ecriture.spec.ts` : 1 échec sur 4 — la page ne contient pas encore `<BlocMatchingAffaire `.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/i18n/locales/fr/pipeline.json`**, 1/2 — supprimer (exact ; l'Edit prend une chaîne vide) :

````json
    "matches_title": "Biens à proposer",
    "matches_count_one": "{{count}} match",
    "matches_count_other": "{{count}} matchs",
    "no_matches": "Aucun bien du portefeuille ne correspond encore.",
````

**`src/i18n/locales/fr/pipeline.json`**, 2/2 — remplacer (exact) :

````json
    "ouvrirMatching": "Ouvrir le matching",
    "visites": "Visites",
````

par :

````json
    "ouvrirMatching": "Ouvrir le matching",
    "matching": {
      "titre": "Matching",
      "nombre_one": "{{count}} bien",
      "nombre_other": "{{count}} biens"
    },
    "visites": "Visites",
````

**`src/i18n/locales/en/pipeline.json`**, 1/2 — supprimer (exact ; l'Edit prend une chaîne vide) :

````json
    "matches_title": "Properties to propose",
    "matches_count_one": "{{count}} match",
    "matches_count_other": "{{count}} matches",
    "no_matches": "No portfolio property matches yet.",
````

**`src/i18n/locales/en/pipeline.json`**, 2/2 — remplacer (exact) :

````json
    "ouvrirMatching": "Open matching",
    "visites": "Viewings",
````

par :

````json
    "ouvrirMatching": "Open matching",
    "matching": {
      "titre": "Matching",
      "nombre_one": "{{count}} property",
      "nombre_other": "{{count}} properties"
    },
    "visites": "Viewings",
````

**`src/i18n/locales/de/pipeline.json`**, 1/2 — supprimer (exact ; l'Edit prend une chaîne vide) :

````json
    "matches_title": "Objekte zum Vorschlagen",
    "matches_count_one": "{{count}} Match",
    "matches_count_other": "{{count}} Matches",
    "no_matches": "Noch kein Objekt des Portfolios passt.",
````

**`src/i18n/locales/de/pipeline.json`**, 2/2 — remplacer (exact) :

````json
    "ouvrirMatching": "Matching öffnen",
    "visites": "Besichtigungen",
````

par :

````json
    "ouvrirMatching": "Matching öffnen",
    "matching": {
      "titre": "Matching",
      "nombre_one": "{{count}} Objekt",
      "nombre_other": "{{count}} Objekte"
    },
    "visites": "Besichtigungen",
````

**`src/i18n/locales/it/pipeline.json`**, 1/2 — supprimer (exact ; l'Edit prend une chaîne vide) :

````json
    "matches_title": "Immobili da proporre",
    "matches_count_one": "{{count}} match",
    "matches_count_other": "{{count}} match",
    "no_matches": "Nessun immobile del portafoglio corrisponde ancora.",
````

**`src/i18n/locales/it/pipeline.json`**, 2/2 — remplacer (exact) :

````json
    "ouvrirMatching": "Apri il matching",
    "visites": "Visite",
````

par :

````json
    "ouvrirMatching": "Apri il matching",
    "matching": {
      "titre": "Matching",
      "nombre_one": "{{count}} immobile",
      "nombre_other": "{{count}} immobili"
    },
    "visites": "Visite",
````

**`src/hooks/useFicheAffaire.ts`**, 1/6 — remplacer (exact) :

````ts
 * les faits de l'affaire (historique), les biens que le moteur propose à son client, ses visites.
 *
 * ⛔ LES BIENS À PROPOSER VIENNENT DU MOTEUR (`matches`), plus d'un calcul local. La fiche d'avant
 * recalculait un « score de proximité » dans le navigateur : il ne filtrait ni les pièces ni la
 * surface, et proposait à une acheteuse de quatre pièces deux studios notés 89 % (mesuré sur le
 * banc). Le moteur, lui, est celui du fil de matchs — une seule vérité pour les deux écrans.
````

par :

````ts
 * les faits de l'affaire (historique) et ses visites.
 *
 * ⚠ Les biens de l'acheteur ne sont plus lus ici depuis l'étape 5b-1 : le bloc « Matching » les lit
 * par état, sous la clé du fil (`useMatchingAffaire`) — la lecture d'ici, trois matchs par score sans
 * leur état, ne se rafraîchissait pas après un geste du fil et rendait un mandat supprimé sans titre.
````

**`src/hooks/useFicheAffaire.ts`**, 2/6 — remplacer (exact) :

````ts
export interface MatchAffaire {
  id: string
  score: number
  status: string
  bien: { id: string | null; titre: string; prix: number | null; interne: boolean }
}

export interface VisiteAffaire {
````

par :

````ts
export interface VisiteAffaire {
````

**`src/hooks/useFicheAffaire.ts`**, 3/6 — supprimer (exact ; l'Edit prend une chaîne vide) :

````ts
}

interface LigneMatch {
  id: string
  score: number
  status: string
  property_id: string | null
  property: { title?: string | null; price?: number | null } | null
  market_listing: { title?: string | null; price?: number | null } | null
````

**`src/hooks/useFicheAffaire.ts`**, 4/6 — remplacer (exact) :

````ts
/** Les faits, les biens proposés et les visites d'une affaire — chaque lecture reste bornée. */
````

par :

````ts
/** Les faits et les visites d'une affaire — chaque lecture reste bornée. */
````

**`src/hooks/useFicheAffaire.ts`**, 5/6 — supprimer (exact ; l'Edit prend une chaîne vide) :

````ts
    },
  })

  const matchs = useQuery({
    queryKey: ['fiche-affaire', 'matchs', contactId],
    enabled: !!contactId,
    queryFn: async (): Promise<MatchAffaire[]> => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, score, status, property_id, property:properties(title, price), market_listing:market_listings(title, price)')
        .eq('contact_id', contactId!)
        .in('status', ['suggested', 'sent', 'interested'])
        .order('score', { ascending: false })
        .limit(3)
      if (error) throw error
      return ((data ?? []) as unknown as LigneMatch[]).map((m) => ({
        id: m.id,
        score: m.score,
        status: m.status,
        bien: {
          id: m.property_id,
          titre: m.property?.title ?? m.market_listing?.title ?? '',
          prix: m.property?.price ?? m.market_listing?.price ?? null,
          interne: !!m.property_id,
        },
      }))
````

**`src/hooks/useFicheAffaire.ts`**, 6/6 — supprimer (exact ; l'Edit prend une chaîne vide) :

````ts
    matchs: matchs.data ?? [],
````

**`src/pages/agent/DealDetailPage.tsx`**, 1/8 — remplacer (exact) :

````tsx
 *    pièces) : ici, le moteur de matching (`useFicheAffaire`) ;
````

par :

````tsx
 *    pièces) : ici, le matching de l'acheteur, bien par bien et par état — le bloc « Matching »
 *    (`useMatchingAffaire`, étape 5b-1), en Prospects, Recherche et Visites ;
````

**`src/pages/agent/DealDetailPage.tsx`**, 2/8 — remplacer (exact) :

````tsx
import { useFicheAffaire } from '@/hooks/useFicheAffaire'
import { ACTION_CLOTURE, useClotureAffaire, usePlanifierApresVente } from '@/hooks/useClotureAffaire'
````

par :

````tsx
import { useFicheAffaire } from '@/hooks/useFicheAffaire'
import { useMatchingAffaire } from '@/hooks/useMatchingAffaire'
import { ACTION_CLOTURE, useClotureAffaire, usePlanifierApresVente } from '@/hooks/useClotureAffaire'
````

**`src/pages/agent/DealDetailPage.tsx`**, 3/8 — remplacer (exact) :

````tsx
import { crmFmtCHF, crmMix, crmPalette, crmVoileEncre, type CrmPalette } from '@/components/crm/tokens'
````

par :

````tsx
import { crmFmtCHF, crmMix, crmPalette, type CrmPalette } from '@/components/crm/tokens'
````

**`src/pages/agent/DealDetailPage.tsx`**, 4/8 — remplacer (exact) :

````tsx
import { ton } from '@/components/crm/pipeline/tons'

/** Une section de la feuille : un filet en haut, jamais une carte. */
````

par :

````tsx
import { ton } from '@/components/crm/pipeline/tons'
import BlocMatchingAffaire from '@/components/matching-fil/BlocMatchingAffaire'
import { lienFil } from '@/components/matching-fil/filLiens'

/** Une section de la feuille : un filet en haut, jamais une carte. */
````

**`src/pages/agent/DealDetailPage.tsx`**, 5/8 — remplacer (exact) :

````tsx
  const { faits, matchs, visites } = useFicheAffaire(deal?.id, contactId)
````

par :

````tsx
  const { faits, visites } = useFicheAffaire(deal?.id, contactId)
  // Le matching de l'ACHETEUR : une affaire côté vendeur seul n'en a pas (le bloc ne s'y rend pas).
  const matching = useMatchingAffaire(deal?.contact_buyer_id ?? undefined)
````

**`src/pages/agent/DealDetailPage.tsx`**, 6/8 — remplacer (exact) :

````tsx
  const vendeurSeul = !deal.contact_buyer_id && !!deal.contact_seller_id

  const rafraichir = () => { void queryClient.invalidateQueries({ queryKey: ['fiche-affaire'] }) }
````

par :

````tsx
  const vendeurSeul = !deal.contact_buyer_id && !!deal.contact_seller_id
  // Le bloc « Matching » (étape 5b-1) : tant que l'affaire cherche son bien. À partir de l'Offre, la fiche se concentre
  // sur le bien négocié ; une affaire revenue en Recherche le retrouve.
  const montrerMatching = !!deal.contact_buyer_id && !conclue && !perdue
    && (idPhase === 'prospects' || idPhase === 'recherche' || idPhase === 'visites')

  const rafraichir = () => { void queryClient.invalidateQueries({ queryKey: ['fiche-affaire'] }) }
````

**`src/pages/agent/DealDetailPage.tsx`**, 7/8 — remplacer (exact) :

````tsx
    return (
      <Section sp={sp} premiere titre={t('deal.matches_title')}
        droite={<span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('deal.matches_count', { count: matchs.length })}</span>}>
        {matchs.length === 0
          ? <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('deal.no_matches')}</span>
          : matchs.map((m, i) => (
            <button key={m.id} type="button"
              onClick={() => { if (m.bien.interne && m.bien.id) navigate(`/dashboard/listings/${m.bien.id}`) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md) 0', textAlign: 'left',
                border: 0, background: 'transparent', fontFamily: 'inherit', cursor: m.bien.interne ? 'pointer' : 'default',
                borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
              }}>
              <span style={{
                minWidth: 40, textAlign: 'center', padding: 'var(--crm-space-2xs) var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)',
                background: i === 0 ? ton('aujourdhui', sp).fond : crmVoileEncre(dark, dark ? 0.06 : 0.05),
                color: i === 0 ? ton('aujourdhui', sp).encre : sp.ink, fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              }}>{m.score} %</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.bien.titre}</span>
              {m.bien.prix ? <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>{crmFmtCHF(m.bien.prix)}</span> : null}
            </button>
          ))}
        <Lien sp={sp} onClick={() => navigate(`/dashboard/matching${contactId ? `?contact=${contactId}` : ''}`, contactId ? avecArrivee() : undefined)}>{t('fiche.ouvrirMatching')}</Lien>
      </Section>
    )
````

par :

````tsx
    return null
````

**`src/pages/agent/DealDetailPage.tsx`**, 8/8 — remplacer (exact) :

````tsx
          {phaseContenu}
          <Section sp={sp} titre={t('fiche.historique')} etire>
````

par :

````tsx
          {phaseContenu}
          {montrerMatching && (
            <Section sp={sp} premiere={phaseContenu == null} titre={t('fiche.matching.titre')}
              droite={matching.total > 0
                ? <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('fiche.matching.nombre', { count: matching.total })}</span>
                : undefined}>
              <BlocMatchingAffaire sp={sp} lecture={matching} />
              <Lien sp={sp} onClick={() => navigate(`/dashboard/matching?${lienFil({ contact: deal.contact_buyer_id! })}`, avecArrivee())}>{t('fiche.ouvrirMatching')}</Lien>
            </Section>
          )}
          <Section sp={sp} titre={t('fiche.historique')} etire>
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/score-une-ecriture.spec.ts tests/unit/pipeline-contraste.spec.ts tests/unit/apres-vente.spec.ts tests/unit/pipeline-phases.spec.ts
```

Attendu : `Test Files  4 passed (4)`, `Tests  24 passed (24)`.

- [ ] **Étape 5 — la batterie du commit**, une commande après l'autre, la suite unitaire SEULE.

```bash
npx tsc -b --force
npx eslint src tests --quiet
npx vitest run
npm run -s lint:deadcode
npm run -s lint:i18n-keys
npm run -s i18n:parity:ci
npm run -s i18n:coverage:ci
npm run -s lint:i18n
npm run -s lint:prose
```

Attendu : tout à 0 sauf la suite : `Test Files  3 failed | 364 passed (367)`, `Tests  1 failed | 5448 passed | 3 skipped (5452)` — les trois fichiers connus. `lint:i18n-keys` : 4547 clés littérales dans 296 fichiers ; il ne vérifie pas la fiche d'affaire, qui lit trois namespaces (tâche 9, étape 2).

- [ ] **Étape 6 — photographier l'arbre du commit 1** (« feat(pipeline): la fiche d'affaire montre les biens de l'acheteur dans le matching ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C1
```

Attendu : `C1` suivi des huit premiers caractères de l'arbre.


---

## Tâche 6 : L'historique dit les étapes du matching

Le modèle gagne le journal (`journalMatchingDeLAffaire`, `titresDesMatchs`, `neeDuMatching`, `doublonDeVisite`) ; la lecture, une troisième requête — le journal du CONTACT, trois actions, 100 lignes au plus — et l'identifiant de l'affaire ; la fiche fusionne les lignes, écrit « Deal créé depuis le matching », écarte le changement d'étape qu'une visite double, et passe à 12 lignes. Conception §5.

**Fichiers :**

- Modifier : `tests/unit/fil-affaire.spec.ts`
- Modifier : `tests/unit/matching-affaire-lecture.spec.tsx`
- Modifier : `src/components/matching-fil/filAffaire.ts`
- Modifier : `src/hooks/useMatchingAffaire.ts`
- Modifier : `src/i18n/locales/fr/pipeline.json`
- Modifier : `src/i18n/locales/en/pipeline.json`
- Modifier : `src/i18n/locales/de/pipeline.json`
- Modifier : `src/i18n/locales/it/pipeline.json`
- Modifier : `src/pages/agent/DealDetailPage.tsx`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

**`tests/unit/fil-affaire.spec.ts`**, 1/3 — remplacer (exact) :

````ts
 * le modèle pur `filAffaire.ts` — les biens de l'acheteur rangés par état.
````

par :

````ts
 * le modèle pur `filAffaire.ts` — les biens de l'acheteur rangés par état, et les lignes que le matching ajoute à
 * l'historique de l'affaire.
````

**`tests/unit/fil-affaire.spec.ts`**, 2/3 — remplacer (exact) :

````ts
 *   · un lien vers une autre place que celle du bien dans le fil ; un proposé reporté écrit « reporté ».
 */
import { describe, expect, it } from 'vitest'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { biensDeLAffaire } from '@/components/matching-fil/filAffaire'
````

par :

````ts
 *   · un lien vers une autre place que celle du bien dans le fil ; un proposé reporté écrit « reporté » ;
 *   · une ligne du journal d'une AUTRE affaire, un intérêt pour un bien qui n'y a pas été proposé, un refus au journal ;
 *   · une origine « depuis le matching » au-delà d'une minute, un doublon de visite au-delà de dix secondes.
 */
import { describe, expect, it } from 'vitest'
import type { LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import {
  biensDeLAffaire, doublonDeVisite, journalMatchingDeLAffaire, neeDuMatching, titresDesMatchs,
  type EvenementMatching,
} from '@/components/matching-fil/filAffaire'
````

**`tests/unit/fil-affaire.spec.ts`**, 3/3 — remplacer (exact) :

````ts
    expect(r.lignes[0]).toMatchObject({ titre: 'Loft · Eaux-Vives', prix: 1_390_000, location: true, etat: { cle: 'aProposer' } })
  })
})
````

par :

````ts
    expect(r.lignes[0]).toMatchObject({ titre: 'Loft · Eaux-Vives', prix: 1_390_000, location: true, etat: { cle: 'aProposer' } })
  })
})

/** Un événement du journal d'un contact. */
const evt = (action: string, heures: number, metadata: Record<string, unknown>): EvenementMatching => ({
  action, created_at: new Date(MAINTENANT - heures * 3_600_000).toISOString(), metadata,
})
const TITRES = new Map([['m1', 'Attique · Florissant'], ['m2', 'Appartement · Champel']])

describe('journalMatchingDeLAffaire — les lignes de l’historique', () => {
  it('une proposition de CETTE affaire, nommée ; celle d’une autre affaire n’y entre pas', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
      evt('match_propose', 4, { deal_id: 'd9', match_ids: ['m2'], nombre: 1 }),
    ], 'd5', TITRES)
    expect(j).toEqual([{ quand: evt('x', 5, {}).created_at, genre: 'propose', bien: 'Attique · Florissant', nombre: 1 }])
  })

  it('une sélection se compte ; elle ne nomme pas un bien', () => {
    const [l] = journalMatchingDeLAffaire([evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1', 'm2', 'm3'], nombre: 3 })], 'd5', TITRES)
    expect(l).toMatchObject({ genre: 'propose', bien: null, nombre: 3 })
  })

  it('un intérêt se relie à l’affaire par les biens qui y ont été proposés — un refus, ou un autre bien, n’y entre pas', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_reaction', 1, { match_id: 'm1', new_status: 'interested' }),
      evt('match_reaction', 2, { match_id: 'm2', new_status: 'interested' }),
      evt('match_reaction', 3, { match_id: 'm1', new_status: 'rejected' }),
      evt('match_propose', 5, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
    ], 'd5', TITRES)
    expect(j.map((l) => [l.genre, l.bien])).toEqual([['interesse', 'Attique · Florissant'], ['propose', 'Attique · Florissant']])
  })

  it('une visite planifiée de cette affaire ; un bien introuvable s’écrit « un bien » (`null`)', () => {
    const j = journalMatchingDeLAffaire([
      evt('visit_scheduled', 1, { deal_id: 'd5', match_id: 'm2', visit_id: 'v1' }),
      evt('visit_scheduled', 2, { deal_id: 'd5', match_id: 'm-supprime', visit_id: 'v2' }),
      evt('visit_scheduled', 3, { deal_id: 'd9', match_id: 'm1', visit_id: 'v3' }),
    ], 'd5', TITRES)
    expect(j.map((l) => [l.genre, l.bien])).toEqual([['visite', 'Appartement · Champel'], ['visite', null]])
  })

  it('du plus récent au plus ancien', () => {
    const j = journalMatchingDeLAffaire([
      evt('match_propose', 9, { deal_id: 'd5', match_ids: ['m1'], nombre: 1 }),
      evt('visit_scheduled', 2, { deal_id: 'd5', match_id: 'm1' }),
      evt('match_reaction', 4, { match_id: 'm1', new_status: 'interested' }),
    ], 'd5', TITRES)
    expect(j.map((l) => l.genre)).toEqual(['visite', 'interesse', 'propose'])
  })
})

describe('neeDuMatching, doublonDeVisite', () => {
  const cree = new Date(MAINTENANT - 10 * 3_600_000).toISOString()
  const decale = (ms: number) => new Date(Date.parse(cree) + ms).toISOString()

  it('« Deal créé depuis le matching » : une proposition ou une visite de l’affaire à moins d’une minute de sa création', () => {
    expect(neeDuMatching(cree, [{ quand: decale(800), genre: 'propose', bien: null, nombre: 1 }])).toBe(true)
    expect(neeDuMatching(cree, [{ quand: decale(0), genre: 'visite', bien: null, nombre: 1 }])).toBe(true)
    expect(neeDuMatching(cree, [{ quand: decale(120_000), genre: 'propose', bien: null, nombre: 1 }])).toBe(false)
    // Un intérêt ne crée pas d'affaire.
    expect(neeDuMatching(cree, [{ quand: decale(500), genre: 'interesse', bien: null, nombre: 1 }])).toBe(false)
  })

  it('un changement d’étape à moins de dix secondes d’une visite planifiée est son doublon', () => {
    const lignes = [{ quand: decale(0), genre: 'visite' as const, bien: 'Champel', nombre: 1 }]
    expect(doublonDeVisite(decale(3_000), lignes)).toBe(true)
    expect(doublonDeVisite(decale(30_000), lignes)).toBe(false)
    expect(doublonDeVisite(decale(1_000), [{ ...lignes[0]!, genre: 'propose' }])).toBe(false)
  })
})

describe('titresDesMatchs', () => {
  it('le titre de chaque bien lu, par match — l’adresse à défaut de titre', () => {
    const t = titresDesMatchs(
      [ligne('m1', 'sent', { market_listing: { ...annonce(''), address: 'Rue du Rhône 1' } })],
      [aProposer('m2', 90, { property_id: 'p2', market_listing_id: null, market_listing: null, property: mandat('Villa · Cologny') })],
    )
    expect(Object.fromEntries(t)).toEqual({ m1: 'Rue du Rhône 1', m2: 'Villa · Cologny' })
  })
})
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 1/6 — remplacer (exact) :

````tsx
 * `2026-09-30-fiche-affaire-matching-design.md` §6.2) : les biens de l'acheteur, par état.
 *
 * Ce que cette spec refuse :
 *   · des biens à proposer lus autrement que ceux de L'ACHETEUR, en `suggested`, par score puis id, vingt au plus ;
````

par :

````tsx
 * `2026-09-30-fiche-affaire-matching-design.md` §6.2) : les biens de l'acheteur, par état, et les lignes que le
 * matching ajoute à l'historique de l'affaire.
 *
 * Ce que cette spec refuse :
 *   · des biens à proposer lus autrement que ceux de L'ACHETEUR, en `suggested`, par score puis id, vingt au plus ;
 *   · un journal lu ailleurs que sur le CONTACT, ou sans les trois actions du matching, ou qui garderait les lignes
 *     d'une autre affaire ;
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 2/6 — remplacer (exact) :

````tsx
function repondreParDefaut(l: Lecture): Promise<Reponse> {
````

par :

````tsx
/** Le journal du contact : une proposition de CETTE affaire (m2), une d'une autre (m3). */
const JOURNAL = [
  { action: 'match_propose', created_at: '2026-09-29T08:00:00Z', metadata: { deal_id: 'd5', match_ids: ['m2'], nombre: 1 } },
  { action: 'match_propose', created_at: '2026-09-28T08:00:00Z', metadata: { deal_id: 'd9', match_ids: ['m3'], nombre: 1 } },
]

function repondreParDefaut(l: Lecture): Promise<Reponse> {
  if (l.table === 'activity_events') return Promise.resolve({ data: JOURNAL, error: null })
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 3/6 — remplacer (exact) :

````tsx
  const v = useMatchingAffaire(contactId)
````

par :

````tsx
  const v = useMatchingAffaire(contactId, 'd5')
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 4/6 — remplacer (exact) :

````tsx
  })

  it('un bien que « Sa boucle » porte déjà n’est pas compté deux fois ; il y garde son état', async () => {
````

par :

````tsx
  })

  it('le journal du CONTACT : les trois actions du matching, du plus récent au plus ancien, cent au plus', async () => {
    await monter('c9')
    const [l] = h.lectures.filter((x) => x.table === 'activity_events')
    expect(l).toMatchObject({
      eq: [['entity_type', 'contact'], ['entity_id', 'c9']],
      in: [['action', ['match_propose', 'visit_scheduled', 'match_reaction']]],
      order: [['created_at', { ascending: false }]],
      limit: 100,
    })
  })

  it('le journal ne garde que les lignes de CETTE affaire, nommées par les biens lus', async () => {
    await monter('c9')
    expect(derniere().journal).toEqual([{ quand: '2026-09-29T08:00:00Z', genre: 'propose', bien: 'Annonce m2', nombre: 1 }])
  })

  it('un bien que « Sa boucle » porte déjà n’est pas compté deux fois ; il y garde son état', async () => {
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 5/6 — remplacer (exact) :

````tsx
    expect(derniere()).toMatchObject({ lignes: [], total: 0, isLoading: false, isError: false })
````

par :

````tsx
    expect(derniere()).toMatchObject({ lignes: [], total: 0, journal: [], isLoading: false, isError: false })
````

**`tests/unit/matching-affaire-lecture.spec.tsx`**, 6/6 — remplacer (exact) :

````tsx
    // « Sa boucle » (ses deux lectures de matchs) et les biens à proposer.
    expect(h.lectures.length - avant).toBe(3)
````

par :

````tsx
    // « Sa boucle » (ses deux lectures de matchs), les biens à proposer et le journal.
    expect(h.lectures.length - avant).toBe(4)
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-affaire.spec.ts tests/unit/matching-affaire-lecture.spec.tsx
```

Attendu : `fil-affaire.spec.ts` : 8 échecs sur 20 (`journalMatchingDeLAffaire is not a function`, de même `neeDuMatching`, `doublonDeVisite`, `titresDesMatchs`) ; `matching-affaire-lecture.spec.tsx` : 4 échecs sur 7 — la troisième lecture, le journal, n'existe pas encore.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/filAffaire.ts`**, 1/4 — remplacer (exact) :

````ts
 * modèle PUR : les biens de l'acheteur, rangés par état. Ni React, ni Supabase, ni traduction.
````

par :

````ts
 * modèle PUR : les biens de l'acheteur, rangés par état, et les lignes que le matching ajoute à l'historique de
 * l'affaire. Ni React, ni Supabase, ni traduction.
````

**`src/components/matching-fil/filAffaire.ts`**, 2/4 — remplacer (exact) :

````ts
 * proposé ou un intéressé garde sa ligne, et l'état de son mandat s'y ajoute (« Vendu »), comme dans « En attente ».
 */
````

par :

````ts
 * proposé ou un intéressé garde sa ligne, et l'état de son mandat s'y ajoute (« Vendu »), comme dans « En attente ».
 * ⚠ Le journal d'un geste du matching est écrit sur le CONTACT, pas sur l'affaire. Une proposition et une visite
 * portent `metadata.deal_id` ; un intérêt (`match_reaction`) ne porte que son match : il se relie à l'affaire par les
 * biens qui y ont été proposés.
 */
````

**`src/components/matching-fil/filAffaire.ts`**, 3/4 — remplacer (exact) :

````ts
import { nombreOuNull, type FilMatch } from './filModele'
````

par :

````ts
import { nombreOuNull, temps, type FilMatch } from './filModele'
````

**`src/components/matching-fil/filAffaire.ts`**, 4/4 — remplacer (exact) :

````ts
  return { lignes: tous.slice(0, PLAFOND_BIENS), total: tous.length }
}
````

par :

````ts
  return { lignes: tous.slice(0, PLAFOND_BIENS), total: tous.length }
}

/** Le titre de chaque bien que la fiche a lu, par match — l'adresse à défaut : de quoi nommer une ligne du journal. */
export function titresDesMatchs(...lectures: readonly (readonly LigneBoucleContact[])[]): Map<string, string> {
  const titres = new Map<string, string>()
  for (const l of lectures.flat()) {
    const b = l.property_id ? premiere(l.property) : premiere(l.market_listing)
    const titre = b?.title?.trim() || b?.address?.trim()
    if (titre && !titres.has(l.id)) titres.set(l.id, titre)
  }
  return titres
}

/** Les actions du journal d'un contact que l'historique de l'affaire lit. */
export const ACTIONS_JOURNAL_MATCHING = ['match_propose', 'visit_scheduled', 'match_reaction'] as const

/** Un événement du journal du contact (`activity_events`). */
export interface EvenementMatching {
  action: string
  created_at: string
  metadata: Record<string, unknown> | null
}

/** Une ligne que le matching ajoute à l'historique de l'affaire. */
export interface LigneJournalMatching {
  quand: string
  genre: 'propose' | 'interesse' | 'visite'
  /** Le titre du bien ; `null` : introuvable, ou une sélection — l'écran écrit « un bien », ou le nombre. */
  bien: string | null
  /** Le nombre de biens d'une proposition ; 1 pour un intérêt ou une visite. */
  nombre: number
}

const texte = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const idsDe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [])

/**
 * Les lignes du matching de l'affaire `dealId`, du plus récent au plus ancien : ses propositions et ses visites (elles
 * portent l'affaire), et les intérêts pour un bien qui y a été proposé. Un refus n'y entre pas.
 */
export function journalMatchingDeLAffaire(
  evenements: readonly EvenementMatching[], dealId: string, titres: ReadonlyMap<string, string>,
): LigneJournalMatching[] {
  const lignes: LigneJournalMatching[] = []
  // Les propositions d'abord, quel que soit l'ordre de lecture : un intérêt se relie à l'affaire par elles.
  const proposes = new Set<string>()
  for (const e of evenements) {
    if (e.action !== 'match_propose' || texte(e.metadata?.deal_id) !== dealId) continue
    const ids = idsDe(e.metadata?.match_ids)
    ids.forEach((id) => proposes.add(id))
    const nombre = ids.length || (typeof e.metadata?.nombre === 'number' ? e.metadata.nombre : 1)
    lignes.push({ quand: e.created_at, genre: 'propose', bien: nombre === 1 && ids[0] ? titres.get(ids[0]) ?? null : null, nombre })
  }
  for (const e of evenements) {
    const matchId = texte(e.metadata?.match_id)
    if (e.action === 'visit_scheduled' && texte(e.metadata?.deal_id) === dealId) {
      lignes.push({ quand: e.created_at, genre: 'visite', bien: matchId ? titres.get(matchId) ?? null : null, nombre: 1 })
    } else if (e.action === 'match_reaction' && e.metadata?.new_status === 'interested' && matchId && proposes.has(matchId)) {
      lignes.push({ quand: e.created_at, genre: 'interesse', bien: titres.get(matchId) ?? null, nombre: 1 })
    }
  }
  return lignes.sort((a, b) => temps(b.quand) - temps(a.quand))
}

/** Une minute : `rattacherDeal` crée l'affaire, puis journalise le geste ; le copilote, dans la même transaction. */
const DELAI_ORIGINE_MS = 60_000
/** Dix secondes : la règle qui écarte déjà le doublon « Étape changée » de l'écran (`doublonDeLaBase`). */
const DELAI_DOUBLON_MS = 10_000

/** L'affaire est née du matching : une proposition ou une visite liée à elle suit sa création de moins d'une minute. */
export const neeDuMatching = (creeLe: string, lignes: readonly LigneJournalMatching[]): boolean =>
  lignes.some((l) => l.genre !== 'interesse' && Math.abs(temps(l.quand) - temps(creeLe)) < DELAI_ORIGINE_MS)

/**
 * Un changement d'étape vers « Visite planifiée » à moins de dix secondes d'une visite du matching est le même geste :
 * la ligne du matching nomme le bien, elle seule reste.
 */
export const doublonDeVisite = (quand: string, lignes: readonly LigneJournalMatching[]): boolean =>
  lignes.some((l) => l.genre === 'visite' && Math.abs(temps(l.quand) - temps(quand)) < DELAI_DOUBLON_MS)
````

**`src/hooks/useMatchingAffaire.ts`**, 1/5 — remplacer (exact) :

````ts
 * ce que la fiche lit du matching de son acheteur : ses biens, par état (`biensDeLAffaire`).
 *
 * Deux lectures, sous la clé du fil (`CLE_FIL`) : un geste consigné dans le fil les invalide.
 *   · « Sa boucle » (`useContactSentMatches`), telle quelle — son abonnement realtime fait paraître la réponse qu'un
 *     collègue consigne ;
 *   · les meilleurs biens à proposer de l'acheteur, 20 au plus par score : `biensDeLAffaire` n'en garde que trois, une
 *     fois écartés ceux qui ne sont plus une occasion et les reportés.
````

par :

````ts
 * ce que la fiche lit du matching de son acheteur : ses biens, par état (`biensDeLAffaire`), et les lignes que le
 * matching ajoute à l'historique de l'affaire (`journalMatchingDeLAffaire`).
 *
 * Trois lectures, sous la clé du fil (`CLE_FIL`) : un geste consigné dans le fil les invalide.
 *   · « Sa boucle » (`useContactSentMatches`), telle quelle — son abonnement realtime fait paraître la réponse qu'un
 *     collègue consigne ;
 *   · les meilleurs biens à proposer de l'acheteur, 20 au plus par score : `biensDeLAffaire` n'en garde que trois, une
 *     fois écartés ceux qui ne sont plus une occasion et les reportés ;
 *   · le journal du CONTACT, où les gestes du matching s'écrivent (proposé, intéressé, visite planifiée), 100 au plus.
````

**`src/hooks/useMatchingAffaire.ts`**, 2/5 — remplacer (exact) :

````ts
import { biensDeLAffaire, type BiensAffaire } from '@/components/matching-fil/filAffaire'
import { CLE_FIL, lire, type FilMatch } from '@/components/matching-fil/filModele'

/** Les biens à proposer lus : de quoi en garder trois, une fois écartés les reportés et les biens qui ne se proposent plus. */
const A_PROPOSER_LUS = 20

/** Ce que la fiche lit du matching de l'acheteur. */
export interface MatchingAffaire extends BiensAffaire {
````

par :

````ts
import {
  ACTIONS_JOURNAL_MATCHING, biensDeLAffaire, journalMatchingDeLAffaire, titresDesMatchs,
  type BiensAffaire, type EvenementMatching, type LigneJournalMatching,
} from '@/components/matching-fil/filAffaire'
import { CLE_FIL, lire, type FilMatch } from '@/components/matching-fil/filModele'

/** Les biens à proposer lus : de quoi en garder trois, une fois écartés les reportés et les biens qui ne se proposent plus. */
const A_PROPOSER_LUS = 20
/** Les événements du journal lus : un intérêt se relie à l'affaire par une proposition lue dans la même fenêtre. */
const JOURNAL_LU = 100

/** Ce que la fiche lit du matching de l'acheteur. */
export interface MatchingAffaire extends BiensAffaire {
  /** Les lignes que le matching ajoute à l'historique de l'affaire, du plus récent au plus ancien. */
  journal: LigneJournalMatching[]
````

**`src/hooks/useMatchingAffaire.ts`**, 3/5 — remplacer (exact) :

````ts
/** Les biens de l'acheteur d'une affaire, par état ; rien sans acheteur. */
export function useMatchingAffaire(contactId: string | undefined): MatchingAffaire {
````

par :

````ts
/** Le matching de l'acheteur d'une affaire : ses biens par état, et les lignes de l'historique ; rien sans acheteur. */
export function useMatchingAffaire(contactId: string | undefined, dealId: string | undefined): MatchingAffaire {
````

**`src/hooks/useMatchingAffaire.ts`**, 4/5 — remplacer (exact) :

````ts
  })
  // L'heure de la lecture : un report se juge contre elle, comme dans « Sa boucle » (`chargeLe`).
````

par :

````ts
  })
  const journal = useQuery({
    queryKey: [CLE_FIL, 'affaire-journal', contactId],
    enabled: !!contactId,
    staleTime: 15_000,
    // L'index `idx_activity_events_entity_created` couvre la lecture : un contact, du plus récent au plus ancien.
    queryFn: ({ signal }) => lire<EvenementMatching>(supabase.from('activity_events').select('action, created_at, metadata')
      .eq('entity_type', 'contact').eq('entity_id', contactId!).in('action', [...ACTIONS_JOURNAL_MATCHING])
      .order('created_at', { ascending: false }).limit(JOURNAL_LU).abortSignal(signal)),
  })
  // L'heure de la lecture : un report se juge contre elle, comme dans « Sa boucle » (`chargeLe`).
````

**`src/hooks/useMatchingAffaire.ts`**, 5/5 — remplacer (exact) :

````ts
  const relireBoucle = boucle.refetch
  const relireAProposer = aProposer.refetch
  return {
    ...biens,
    isLoading: boucle.isLoading || aProposer.isLoading,
    isError: boucle.isError || aProposer.isError,
    refetch: () => Promise.all([relireBoucle(), relireAProposer()]),
````

par :

````ts
  const lignesJournal = useMemo(() => (dealId
    ? journalMatchingDeLAffaire(journal.data ?? [], dealId, titresDesMatchs(boucle.lignes, aProposer.data ?? []))
    : []), [dealId, journal.data, boucle.lignes, aProposer.data])
  const relireBoucle = boucle.refetch
  const relireAProposer = aProposer.refetch
  const relireJournal = journal.refetch
  return {
    ...biens,
    journal: lignesJournal,
    isLoading: boucle.isLoading || aProposer.isLoading || journal.isLoading,
    isError: boucle.isError || aProposer.isError || journal.isError,
    refetch: () => Promise.all([relireBoucle(), relireAProposer(), relireJournal()]),
````

**`src/i18n/locales/fr/pipeline.json`** — remplacer (exact) :

````json
    "hist": {
      "etape": "Étape : {{de}} → {{a}}",
````

par :

````json
    "hist": {
      "propose": "Proposé : {{bien}}",
      "proposeSelection_one": "Proposé : {{count}} bien",
      "proposeSelection_other": "Proposé : {{count}} biens",
      "interesse": "Intéressé·e : {{bien}}",
      "visite": "Visite planifiée : {{bien}}",
      "unBien": "un bien",
      "creeDepuisMatching": "Deal créé depuis le matching",
      "etape": "Étape : {{de}} → {{a}}",
````

**`src/i18n/locales/en/pipeline.json`** — remplacer (exact) :

````json
    "hist": {
      "etape": "Stage: {{de}} → {{a}}",
````

par :

````json
    "hist": {
      "propose": "Proposed: {{bien}}",
      "proposeSelection_one": "Proposed: {{count}} property",
      "proposeSelection_other": "Proposed: {{count}} properties",
      "interesse": "Interested: {{bien}}",
      "visite": "Viewing planned: {{bien}}",
      "unBien": "a property",
      "creeDepuisMatching": "Deal created from matching",
      "etape": "Stage: {{de}} → {{a}}",
````

**`src/i18n/locales/de/pipeline.json`** — remplacer (exact) :

````json
    "hist": {
      "etape": "Etappe: {{de}} → {{a}}",
````

par :

````json
    "hist": {
      "propose": "Vorgeschlagen: {{bien}}",
      "proposeSelection_one": "Vorgeschlagen: {{count}} Objekt",
      "proposeSelection_other": "Vorgeschlagen: {{count}} Objekte",
      "interesse": "Interessiert: {{bien}}",
      "visite": "Besichtigung geplant: {{bien}}",
      "unBien": "ein Objekt",
      "creeDepuisMatching": "Deal aus dem Matching erstellt",
      "etape": "Etappe: {{de}} → {{a}}",
````

**`src/i18n/locales/it/pipeline.json`** — remplacer (exact) :

````json
    "hist": {
      "etape": "Fase: {{de}} → {{a}}",
````

par :

````json
    "hist": {
      "propose": "Proposto: {{bien}}",
      "proposeSelection_one": "Proposto: {{count}} immobile",
      "proposeSelection_other": "Proposti: {{count}} immobili",
      "interesse": "Interessato: {{bien}}",
      "visite": "Visita pianificata: {{bien}}",
      "unBien": "un immobile",
      "creeDepuisMatching": "Deal creato dal matching",
      "etape": "Fase: {{de}} → {{a}}",
````

**`src/pages/agent/DealDetailPage.tsx`**, 1/5 — remplacer (exact) :

````tsx
 *  - aucun historique : ici, les faits de l'affaire et ses offres, datés.
````

par :

````tsx
 *  - aucun historique : ici, les faits de l'affaire et ses offres, datés — et, depuis l'étape 5b-1, ses
 *    étapes du matching (proposé, intéressé, visite planifiée), lues dans le journal du contact.
````

**`src/pages/agent/DealDetailPage.tsx`**, 2/5 — remplacer (exact) :

````tsx
import BlocMatchingAffaire from '@/components/matching-fil/BlocMatchingAffaire'
import { lienFil } from '@/components/matching-fil/filLiens'
````

par :

````tsx
import BlocMatchingAffaire from '@/components/matching-fil/BlocMatchingAffaire'
import { doublonDeVisite, neeDuMatching, type LigneJournalMatching } from '@/components/matching-fil/filAffaire'
import { lienFil } from '@/components/matching-fil/filLiens'
````

**`src/pages/agent/DealDetailPage.tsx`**, 3/5 — remplacer (exact) :

````tsx
  const matching = useMatchingAffaire(deal?.contact_buyer_id ?? undefined)
````

par :

````tsx
  const matching = useMatchingAffaire(deal?.contact_buyer_id ?? undefined, deal?.id)
````

**`src/pages/agent/DealDetailPage.tsx`**, 4/5 — remplacer (exact) :

````tsx
  type Entree = { quand: string; icone: MEIconName; texte: string }
  const historique: Entree[] = [
    { quand: deal.created_at, icone: 'plus', texte: t('deal.timeline_created') } as Entree,
    ...faits.flatMap((f): Entree[] => {
      const m = f.metadata ?? {}
      if (f.action === 'stage_change' || (f.action === 'Étape changée' && !doublonDeLaBase(f.created_at))) {
````

par :

````tsx
  // Le matching de l'affaire (étape 5b-1) : ses propositions, les intérêts pour ses biens, ses visites — lus dans le
  // journal du CONTACT (`useMatchingAffaire`), où les gestes du fil et du copilote WhatsApp s'écrivent.
  const ICONES_MATCHING: Record<LigneJournalMatching['genre'], MEIconName> = { propose: 'send', interesse: 'heart', visite: 'home' }
  const texteMatching = (l: LigneJournalMatching): string => {
    const bienNomme = l.bien ?? t('fiche.hist.unBien')
    if (l.genre === 'propose') {
      return l.nombre > 1 ? t('fiche.hist.proposeSelection', { count: l.nombre }) : t('fiche.hist.propose', { bien: bienNomme })
    }
    return l.genre === 'interesse' ? t('fiche.hist.interesse', { bien: bienNomme }) : t('fiche.hist.visite', { bien: bienNomme })
  }
  type Entree = { quand: string; icone: MEIconName; texte: string }
  const historique: Entree[] = [
    {
      quand: deal.created_at, icone: 'plus',
      texte: neeDuMatching(deal.created_at, matching.journal) ? t('fiche.hist.creeDepuisMatching') : t('deal.timeline_created'),
    } as Entree,
    ...faits.flatMap((f): Entree[] => {
      const m = f.metadata ?? {}
      if (f.action === 'stage_change' || (f.action === 'Étape changée' && !doublonDeLaBase(f.created_at))) {
        // Planifier une visite depuis le matching fait aussi avancer l'affaire : la ligne du matching, qui nomme le bien,
        // tient lieu de ce changement d'étape.
        if (m.new_stage === 'visit_planned' && doublonDeVisite(f.created_at, matching.journal)) return []
````

**`src/pages/agent/DealDetailPage.tsx`**, 5/5 — remplacer (exact) :

````tsx
    ...chaine.map((o): Entree => ({
      quand: o.created_at, icone: 'banknote',
      texte: `${o.kind === 'counter' ? t('deal.offer_row.counter') : t('deal.offer_row.offer')} · ${crmFmtCHF(o.amount)}`,
    })),
  ].sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 8)
````

par :

````tsx
    ...matching.journal.map((l): Entree => ({ quand: l.quand, icone: ICONES_MATCHING[l.genre], texte: texteMatching(l) })),
    ...chaine.map((o): Entree => ({
      quand: o.created_at, icone: 'banknote',
      texte: `${o.kind === 'counter' ? t('deal.offer_row.counter') : t('deal.offer_row.offer')} · ${crmFmtCHF(o.amount)}`,
    })),
  ].sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 12)
````

- [ ] **Étape 4 — elle passe.**

```bash
npx vitest run tests/unit/fil-affaire.spec.ts tests/unit/matching-affaire-lecture.spec.tsx
```

Attendu : `Test Files  2 passed (2)`, `Tests  27 passed (27)`.

- [ ] **Étape 5 — la batterie du commit**, une commande après l'autre, la suite unitaire SEULE.

```bash
npx tsc -b --force
npx eslint src tests --quiet
npx vitest run
npm run -s lint:deadcode
npm run -s lint:i18n-keys
npm run -s i18n:parity:ci
npm run -s i18n:coverage:ci
npm run -s lint:i18n
npm run -s lint:prose
```

Attendu : tout à 0 sauf la suite : `Test Files  3 failed | 364 passed (367)`, `Tests  1 failed | 5458 passed | 3 skipped (5462)` — les trois fichiers connus.

- [ ] **Étape 6 — photographier l'arbre du commit 2** (« feat(pipeline): l'historique de l'affaire dit ses étapes du matching ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C2
```

Attendu : `C2` suivi des huit premiers caractères de l'arbre.


---

## Tâche 7 : Le banc

Le journal du matching des affaires de Julie Morand (d5) et d'Anastasia Volkova (d6), un fait d'étape d'Anastasia cinq secondes après sa visite (le doublon écarté), et la visite de Champel posée à 20 jours (hors de la semaine que le glissé du Calendrier éprouve). Six événements plus récents que la traîne du journal : la pagination du journal d'audit se décale, sa spec e2e suit. Conception §8.

**Fichiers :**

- Modifier : `tests/e2e/journal-audit.spec.ts`
- Modifier : `src/pages/dev/crmFixtures.ts`

- [ ] **Étape 1 — la garde d'abord.** Dans l'ordre :

**`tests/e2e/journal-audit.spec.ts`**, 1/3 — remplacer (exact) :

````ts
 * pour que la pagination s'y éprouve : 1 131 évènements en tout, dont les 7 faits d'étape du
 * Pipeline (`FAITS_DEALS`, 27.09.2026) — tous plus récents que la traîne, qui commence donc sa
 * page 2 au n° 970.
````

par :

````ts
 * pour que la pagination s'y éprouve : 1 137 évènements en tout, dont les 8 faits d'étape du
 * Pipeline (`FAITS_DEALS`, 27.09.2026) et les 5 gestes du matching de deux affaires
 * (`FAITS_MATCHING`, étape 5b-1, 30.09.2026) — tous plus récents que la traîne, qui commence donc
 * sa page 2 au n° 964.
````

**`tests/e2e/journal-audit.spec.ts`**, 2/3 — remplacer (exact) :

````ts
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 969' })).toHaveCount(1)
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 970' }), 'la 1001ᵉ ligne est sur la page 2').toHaveCount(0)
````

par :

````ts
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 963' })).toHaveCount(1)
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 964' }), 'la 1001ᵉ ligne est sur la page 2').toHaveCount(0)
````

**`tests/e2e/journal-audit.spec.ts`**, 3/3 — remplacer (exact) :

````ts
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 970' })).toHaveCount(1)
````

par :

````ts
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 964' })).toHaveCount(1)
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx playwright test --config=playwright.bancs.config.ts tests/e2e/journal-audit.spec.ts
```

Attendu : `1 failed`, `6 passed` — « "Tout" se lit par pages : 1000 d'abord, puis les plus anciens à la demande » : `la 1001ᵉ ligne est sur la page 2`, `Expected: 0`, `Received: 1`.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/pages/dev/crmFixtures.ts`**, 1/3 — remplacer (exact) :

````ts
  {
    ...faitDeal('fd7', 'd14', 'signed', 'signed', 24 * 90),
    action: 'status_change', object_label: 'active → completed', metadata: { old_status: 'active', new_status: 'completed' },
  },
````

par :

````ts
  // d6 : l'étape que la visite planifiée depuis le matching fait avancer, cinq secondes après son geste
  // (`FAITS_MATCHING`) — la fiche n'en garde que la ligne du matching, qui nomme le bien.
  faitDeal('fd8', 'd6', 'active_search', 'visit_planned', 20 - 5 / 3600),
  {
    ...faitDeal('fd7', 'd14', 'signed', 'signed', 24 * 90),
    action: 'status_change', object_label: 'active → completed', metadata: { old_status: 'active', new_status: 'completed' },
  },
]

/**
 * Le journal du MATCHING de deux affaires (étape 5b-1) : les gestes du fil s'écrivent sur le CONTACT
 * (`entity_type = 'contact'`) ; une proposition et une visite portent l'affaire (`metadata.deal_id`), un intérêt
 * son seul match. L'historique de la fiche d'affaire les lit (`useMatchingAffaire`) : le banc n'a ni trigger ni
 * écrivain. Des gestes d'AGENT (`actor_kind = 'user'`) : la cloche ne les montre pas.
 */
const faitMatching = (id: string, contact: string, action: string, heures: number, metadata: Record<string, unknown>) => ({
  id, agency_id: AGENCE_BANC.id, actor_id: AGENT_BANC.id, actor_kind: 'user', action, category: 'contact',
  severity: 'info', entity_type: 'contact', entity_id: contact, object_label: null, metadata, created_at: ilYA(heures),
  actor: { full_name: AGENT_BANC.full_name },
})
const FAITS_MATCHING = [
  // Julie Morand (d5, Recherche) : un mandat proposé, puis une sélection du marché de deux biens.
  faitMatching('fm1', 'c9', 'match_propose', 24 * 6, { deal_id: 'd5', match_ids: ['m26'], nombre: 1 }),
  faitMatching('fm2', 'c9', 'match_propose', 48, { deal_id: 'd5', match_ids: ['m14', 'm15'], nombre: 2 }),
  // Anastasia Volkova (d6, Visites) : l'affaire naît de la proposition de Champel, une seconde après sa création —
  // `rattacherDeal` crée l'affaire, puis le geste s'écrit (« Deal créé depuis le matching ») ; puis l'intérêt, la visite.
  faitMatching('fm3', 'c11', 'match_propose', 24 * 2 - 1 / 3600, { deal_id: 'd6', match_ids: ['m28'], nombre: 1 }),
  faitMatching('fm4', 'c11', 'match_reaction', 30, { match_id: 'm28', old_status: 'sent', new_status: 'interested', contact_id: 'c11' }),
  faitMatching('fm5', 'c11', 'visit_scheduled', 20, { deal_id: 'd6', match_id: 'm28', visit_id: 'v2' }),
````

**`src/pages/dev/crmFixtures.ts`**, 2/3 — remplacer (exact) :

````ts
  activity_events: [...EVENEMENTS, ...FAITS_DEALS, ...TRAINE_JOURNAL],
````

par :

````ts
  activity_events: [...EVENEMENTS, ...FAITS_DEALS, ...FAITS_MATCHING, ...TRAINE_JOURNAL],
````

**`src/pages/dev/crmFixtures.ts`**, 3/3 — remplacer (exact) :

````ts
      contact: { id: 'c1', first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      agent: { id: AGENT_BANC.id, full_name: AGENT_BANC.full_name, avatar_url: null },
````

par :

````ts
      contact: { id: 'c1', first_name: 'Camille', last_name: 'Rochat', email: 'camille.rochat@example.ch', phone: '+41 79 412 88 03' },
      agent: { id: AGENT_BANC.id, full_name: AGENT_BANC.full_name, avatar_url: null },
    },
    // La visite de Champel d'Anastasia, planifiée depuis son matching (`FAITS_MATCHING`, fm5) et rattachée à son
    // affaire (d6). ⚠ Dans vingt jours : hors de la semaine que le Calendrier du banc éprouve au glissé.
    {
      id: 'v2', agency_id: AGENCE_BANC.id, contact_id: 'c11', property_id: 'p1', agent_id: AGENT_BANC.id, transaction_id: 'd6',
      scheduled_at: ilYA(-24 * 20), duration_minutes: 45, status: 'planned', calendar_label_id: null, created_at: ilYA(20),
      property: { id: 'p1', ...CHAMPEL_EMBARQUE },
      contact: { id: 'c11', ...ANASTASIA_EMBARQUEE },
      agent: { id: AGENT_BANC.id, full_name: AGENT_BANC.full_name, avatar_url: null },
````

- [ ] **Étape 4 — elle passe.**

```bash
npx playwright test --config=playwright.bancs.config.ts
```

Attendu : `85 passed`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/pages/dev/crmFixtures.ts tests/e2e/journal-audit.spec.ts --quiet
```

Attendu : sortie 0, aucun message.

- [ ] **Étape 6 — la batterie du commit**, une commande après l'autre, la suite unitaire SEULE.

```bash
npx tsc -b --force
npx eslint src tests --quiet
npx vitest run
npm run -s lint:deadcode
npm run -s lint:i18n-keys
npm run -s i18n:parity:ci
npm run -s i18n:coverage:ci
npm run -s lint:i18n
npm run -s lint:prose
```

Attendu : tout à 0 sauf la suite : `Tests  1 failed | 5458 passed | 3 skipped (5462)` — les trois fichiers connus.

- [ ] **Étape 7 — photographier l'arbre du commit 3** (« chore(banc): le journal du matching de deux affaires, et la visite de Champel ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C3
```

Attendu : `C3` suivi des huit premiers caractères de l'arbre.


---

## Tâche 8 : Les docs

La feuille de route (5b-1 exécutée ; 5b-2 en attente, avec sa condition ; l'« En attente » de la conception), la carte système, le cerveau (`megga/deal-detail`), le CHANGELOG. La conception et ce plan entrent dans le même commit.

**Fichiers :**

- Modifier : `docs/superpowers/feuille-de-route.md`
- Modifier : `docs/system-map.md`
- Modifier : `.claude-flow/knowledge/megga-memory.seed.json`
- Modifier : `docs/CHANGELOG.md`

- [ ] **Étape 1 — le code.** Dans l'ordre :

**`docs/superpowers/feuille-de-route.md`**, 1/2 — remplacer (exact) :

````md
| 5b | **Pipeline et KYC branchés sur le matching** | Juste après la fusion (Julien, 29.09.2026). La fiche d'une affaire dit l'état de chaque bien (à proposer, proposé, intéressé), écarte un mandat qui n'est plus en vente et écrit le score comme le fil ; son historique dit d'où vient l'affaire (proposé, intéressé, visite planifiée depuis le matching — le journal porte déjà l'affaire). Le KYC refait, commité dans sa session, lit les rôles du contact et met en tête l'acheteur qui a une visite planifiée ou une offre en cours (il ne lit aujourd'hui que le nom). La cohérence visuelle relevée par la revue UX (paragraphe « Juste après la fusion », sous ce tableau). En petites mises à jour, relues une par une. | **en cours** : la cohérence visuelle commitée le 30.09.2026 (paragraphe « Juste après la fusion ») ; restent la fiche d'affaire et le KYC branchés |
````

par :

````md
| 5b | **Pipeline et KYC branchés sur le matching** | Juste après la fusion (Julien, 29.09.2026). La fiche d'une affaire dit l'état de chaque bien (à proposer, proposé, intéressé), écarte un mandat qui n'est plus en vente et écrit le score comme le fil ; son historique dit d'où vient l'affaire (proposé, intéressé, visite planifiée depuis le matching — le journal porte déjà l'affaire). Le KYC refait, commité dans sa session, lit les rôles du contact et met en tête l'acheteur qui a une visite planifiée ou une offre en cours (il ne lit aujourd'hui que le nom). La cohérence visuelle relevée par la revue UX (paragraphe « Juste après la fusion », sous ce tableau). En petites mises à jour, relues une par une. | **en cours** : la cohérence visuelle commitée le 30.09.2026 (paragraphe « Juste après la fusion ») ; **5b-1, la fiche d'affaire branchée sur le matching** : [conception](specs/2026-09-30-fiche-affaire-matching-design.md) validée section par section et [plan](plans/2026-09-30-fiche-affaire-matching.md) écrit le 30.09.2026 — joué dans une copie témoin, puis rejoué d'un bloc sur une copie neuve de `main` —, exécuté sur `megga/fiche-affaire-matching`, sans migration ; reste **5b-2, le KYC**, une fois le KYC refait commité dans sa session et ramené sur `main` (54 commits de retard, ~35 points de conflit mesurés le 30.09.2026 ; §10 de la conception) |
````

**`docs/superpowers/feuille-de-route.md`**, 2/2 — remplacer (exact) :

````md
## En attente (hors feuille de route — rien n'est fait sans accord)

- **Relevé par la revue UX de la version fusionnée (29.09.2026), à reprendre avec les retours de Gregory** : le fil qui s'ouvre sur « Recherches à ajuster » avant les biens ; la sélection du marché cochée en entier par défaut ; la densité du panneau d'un match (photo en grand, « Pourquoi ce match » sous le pli) ; l'adoption du Kanban et de la Timeline (en production : 4 deals, tous « Nouveau lead »).
````

par :

````md
## En attente (hors feuille de route — rien n'est fait sans accord)

- **Relevé par la conception de l'étape 5b-1 (30.09.2026)** : une affaire côté vendeur (« Qui pour ce bien ? » de son mandat) ; une visite d'annonce du marché planifiée depuis le fil, sans affaire ni match au journal ; la prochaine action d'une fiche qui peut être une relance de proposition du matching ; un intérêt dont la proposition sort des 100 derniers événements du contact ; le bien d'une affaire qui peut paraître « À proposer » dans son propre bloc ; la fiche d'affaire mobile, muette sur le matching (étape 5c). Détail : §10 de la [conception](specs/2026-09-30-fiche-affaire-matching-design.md).
- **Relevé par la revue UX de la version fusionnée (29.09.2026), à reprendre avec les retours de Gregory** : le fil qui s'ouvre sur « Recherches à ajuster » avant les biens ; la sélection du marché cochée en entier par défaut ; la densité du panneau d'un match (photo en grand, « Pourquoi ce match » sous le pli) ; l'adoption du Kanban et de la Timeline (en production : 4 deals, tous « Nouveau lead »).
````

**`docs/system-map.md`** — remplacer (exact) :

````md
`dashboard` (**cockpit « Aujourd'hui »** refonte juin 2026 — voir l'encadré ci-dessous) · `pipeline` (deals par PHASE — cinq depuis le 27.09.2026, Kanban + Timeline ; fiche d'affaire sur `transactions/:id`, clôture et après-vente — cerveau `megga/pipeline-kanban`, `megga/deal-detail`) · `contacts` (+ `/:id` détail) ·
````

par :

````md
`dashboard` (**cockpit « Aujourd'hui »** refonte juin 2026 — voir l'encadré ci-dessous) · `pipeline` (deals par PHASE — cinq depuis le 27.09.2026, Kanban + Timeline ; fiche d'affaire sur `transactions/:id`, clôture et après-vente ; depuis l'étape 5b-1, son bloc « Matching » — les biens de l'acheteur par état, chacun à sa place dans le fil — et les étapes du matching dans son historique — cerveau `megga/pipeline-kanban`, `megga/deal-detail`) · `contacts` (+ `/:id` détail) ·
````

**`.claude-flow/knowledge/megga-memory.seed.json`** — remplacer (exact) :

````json
      "value": "DealDetailPage (/dashboard/transactions/:id, bureau) = la FICHE D'AFFAIRE de la refonte du 27.09.2026 (le téléphone garde MobileDealDetailPage, barre de 8 segments). Une feuille continue à filets (Julien : « pas d'espace vide entre les bentos »), qui remplace la fiche V4 « Atelier scindé ». Stepper des 5 phases (segments de 4 px à la TEINTE de la phase — écart assumé avec « l'actif porte l'accent », la couleur encode la phase) et stade exact, réglables ; prochaine action datée (Fait / Replanifier / Planifier) ; négociation (useOfferChain, OfferModal ; accepter une offre SIGNE l'affaire par le trigger trg_crm_offer_sign_deal, contrat inchangé) avec l'écart de chaque tour au prix demandé ; biens du vrai moteur `matches` (useFicheAffaire) ; historique daté. KYC NON bloquant (lien vers le dossier, « recommandé avant la signature », masqué une fois conclue). CLÔTURE (useClotureAffaire / useCloturerAffaire, panneau ClotureAffaire, aussi ouvert depuis le board sur « Conclu ») : ⛔ « Conclu » ne faisait que poser le statut — aucun déclencheur ne suit transactions.status='completed'. Le panneau propose, case par case (validation humaine) : bien `sold` (location : `archived`, il n'y a pas de « loué »), recherches de l'acheteur en pause (is_active=false — sinon il recevait des biens le lendemain de son achat), rappel « prévenir » les autres acheteurs qui suivaient le bien (matches sent/visit_planned/interested), relances soldées PAR IDENTIFIANT (une annulation en bloc emportait l'après-vente), après-vente. « Féliciter » retirée le 28.09.2026 (une attention ne se coche pas dans une liste d'hygiène) ; le panneau est CENTRÉ et ne s'affiche qu'une fois sa lecture faite (sinon il sautait), piège du focus armé à ce moment-là. Journal : action « Clôture enregistrée », metadata.suites. APRÈS-VENTE (apresVente.ts) : 3 rappels-tâches à 7 j (nouvelles), 30 j (recommandation), 365 j (un an dans son bien), marqués SANS migration par type='custom' + trigger_rule='days_after_event' (le moteur d'automatisation écrit ce trigger_rule avec SES types, le Pipeline écrit 'manual') — garde apres-vente.spec.ts. Fiche conclue : récapitulatif (prix final, écart, cycle, commission estimée au taux du mandat, 3 % à défaut), bandeau « Clôture à terminer » ≤ 30 jours, section Après-vente. Rien ne part vers le client (megga/matching-sans-sortie).",
````

par :

````json
      "value": "DealDetailPage (/dashboard/transactions/:id, bureau) = la FICHE D'AFFAIRE de la refonte du 27.09.2026 (le téléphone garde MobileDealDetailPage, barre de 8 segments). Une feuille continue à filets (Julien : « pas d'espace vide entre les bentos »), qui remplace la fiche V4 « Atelier scindé ». Stepper des 5 phases (segments de 4 px à la TEINTE de la phase — écart assumé avec « l'actif porte l'accent », la couleur encode la phase) et stade exact, réglables ; prochaine action datée (Fait / Replanifier / Planifier) ; négociation (useOfferChain, OfferModal ; accepter une offre SIGNE l'affaire par le trigger trg_crm_offer_sign_deal, contrat inchangé) avec l'écart de chaque tour au prix demandé ; le bloc « Matching » (étape 5b-1, 30.09.2026 ; conception docs/superpowers/specs/2026-09-30-fiche-affaire-matching-design.md) : en Prospects, Recherche et Visites, les biens de l'acheteur par état — intéressés et visites planifiées, proposés, puis les biens à proposer (revenus, et les trois meilleurs en vente et non reportés) —, huit lignes au plus, l'état écrit comme « Qui pour ce bien ? » (ecrireEtat, « Proposé le 24.09 · Vendu »), le score en FilScore, chaque bien à sa place dans le fil (lienPlace + jeton d'arrivée) ; lecture useMatchingAffaire (« Sa boucle » + les 20 meilleurs suggested + le journal du contact, sous CLE_FIL), modèle matching-fil/filAffaire.ts, bloc matching-fil/BlocMatchingAffaire.tsx — pas dans crm/pipeline, dont l'empreinte de capture couvre le dossier entier ; ⚠ dédoublonner sur ce que « Sa boucle » PORTE, pas sur ce qu'elle lit (le banc compare gt en chaînes). Historique daté, avec les étapes du matching : « Proposé : … » / « Proposé : N biens », « Intéressé·e : … », « Visite planifiée : … » (journal du CONTACT : match_propose et visit_scheduled portent metadata.deal_id, un intérêt se relie par les biens proposés), « Deal créé depuis le matching » (geste à moins d'une minute de la création), le changement d'étape d'une visite planifiée écarté à dix secondes ; 12 lignes. KYC NON bloquant (lien vers le dossier, « recommandé avant la signature », masqué une fois conclue). CLÔTURE (useClotureAffaire / useCloturerAffaire, panneau ClotureAffaire, aussi ouvert depuis le board sur « Conclu ») : ⛔ « Conclu » ne faisait que poser le statut — aucun déclencheur ne suit transactions.status='completed'. Le panneau propose, case par case (validation humaine) : bien `sold` (location : `archived`, il n'y a pas de « loué »), recherches de l'acheteur en pause (is_active=false — sinon il recevait des biens le lendemain de son achat), rappel « prévenir » les autres acheteurs qui suivaient le bien (matches sent/visit_planned/interested), relances soldées PAR IDENTIFIANT (une annulation en bloc emportait l'après-vente), après-vente. « Féliciter » retirée le 28.09.2026 (une attention ne se coche pas dans une liste d'hygiène) ; le panneau est CENTRÉ et ne s'affiche qu'une fois sa lecture faite (sinon il sautait), piège du focus armé à ce moment-là. Journal : action « Clôture enregistrée », metadata.suites. APRÈS-VENTE (apresVente.ts) : 3 rappels-tâches à 7 j (nouvelles), 30 j (recommandation), 365 j (un an dans son bien), marqués SANS migration par type='custom' + trigger_rule='days_after_event' (le moteur d'automatisation écrit ce trigger_rule avec SES types, le Pipeline écrit 'manual') — garde apres-vente.spec.ts. Fiche conclue : récapitulatif (prix final, écart, cycle, commission estimée au taux du mandat, 3 % à défaut), bandeau « Clôture à terminer » ≤ 30 jours, section Après-vente. Rien ne part vers le client (megga/matching-sans-sortie).",
````

**`docs/CHANGELOG.md`** — remplacer (exact) :

````md
### ✅ Fonctionnalités LIVE

#### Matching · lot E1, la bascule au bureau (29 septembre 2026 — sur la branche `megga/matching-lot-e`, PAS en production)
````

par :

````md
### ✅ Fonctionnalités LIVE

#### Pipeline · la fiche d'affaire branchée sur le matching (30 septembre 2026 — étape 5b-1, sur la branche `megga/fiche-affaire-matching`)
> Sert les objectifs 3 (closing) et 4 (transparence). Aucune migration, rien n'est écrit en base, rien ne part vers l'acheteur. [Conception](superpowers/specs/2026-09-30-fiche-affaire-matching-design.md), [plan](superpowers/plans/2026-09-30-fiche-affaire-matching.md).

- **Le bloc « Matching » de la fiche d'affaire** (`DealDetailPage`) : en Prospects, Recherche et Visites, les biens de l'acheteur par état — intéressés et visites planifiées, proposés, puis les biens à proposer (les revenus et les trois meilleurs, en vente et non reportés) —, huit lignes au plus ; l'état écrit comme dans « Qui pour ce bien ? » (« Proposé le 24.09 · Vendu »), le score en `FilScore`, chaque bien à sa place dans le fil. Il remplace « Biens à proposer » : trois matchs sans état, en « 92 % », un mandat supprimé sans titre, jamais rafraîchi après un geste du fil.
- **L'historique dit les étapes du matching** : « Proposé : … » (ou « Proposé : 3 biens »), « Intéressé·e : … », « Visite planifiée : … », lus dans le journal du contact ; « Deal créé depuis le matching » ; le changement d'étape d'une visite planifiée n'y est plus doublé ; 12 lignes au lieu de 8.
- **Partagés, pas recopiés** : l'écriture de l'état (`ecrireEtat`, `filAffichage.ts`) et les colonnes de « Sa boucle » (`COLONNES_BOUCLE`). Nouveaux : `matching-fil/filAffaire.ts`, `matching-fil/BlocMatchingAffaire.tsx`, `hooks/useMatchingAffaire.ts` ; `useFicheAffaire` perd sa lecture des matchs.
- **Gardes** : `fil-affaire.spec.ts`, `matching-affaire-lecture.spec.tsx`, `bloc-matching-affaire.spec.tsx` ; `score-une-ecriture`, `jeton-arrivee`, `matching-sans-sortie` et `fiche-qui-pour` étendues. Banc : le journal du matching de Julie Morand et d'Anastasia Volkova, et la visite de Champel d'Anastasia.

#### Matching · lot E1, la bascule au bureau (29 septembre 2026 — sur la branche `megga/matching-lot-e`, PAS en production)
````

- [ ] **Étape 2 — les contrôles.**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-flow/knowledge/megga-memory.seed.json','utf8'))" && npm run -s lint:claude-md
```

Attendu : `✓ Fraîcheur : 24 prétention(s) chiffrée(s) vérifiées sur 2 document(s) (CLAUDE.md, docs/system-map.md), aucun écart.`, puis l'avertissement des 17 prétentions de base non mesurées sans `SUPABASE_ACCESS_TOKEN` — attendu, ne pas le compter comme vert.

- [ ] **Étape 3 — le cerveau rechargé** (local : `.swarm/`, ignoré par git).

```bash
npm run ruflo:seed
```

Attendu : `[ruflo-seed] comptage OK : 319/319 entrées importées.` puis `[ruflo-seed] recall OK (3 domaines).`

- [ ] **Étape 4 — photographier l'arbre du commit 4** (« docs(pipeline): la fiche d'affaire branchée sur le matching — conception, plan, carte, cerveau ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C4
```

Attendu : `C4` suivi des huit premiers caractères de l'arbre.


---

## Tâche 9 : vérification, captures, commits

- [ ] **Étape 1 — les portes.**

```bash
npx tsc -b --force && npx eslint src tests --quiet
```

```bash
bash -c 'for g in lint:prose lint:i18n lint:i18n-keys lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
```

Attendu : `tsc` et eslint à 0 ; « ✓ » pour les quatorze premières portes. `check:privileges` rend « ✗ » sans `SUPABASE_ACCESS_TOKEN` (mesuré au rejeu, comme au lot E1) : ne pas la compter verte pour autant.

- [ ] **Étape 2 — les clés de la fiche d'affaire.** `lint:i18n-keys` ne vérifie pas une page qui lit trois namespaces (`pipeline`, `contacts`, `common`) : « 28 fichiers à namespace ambigu, où seuls les appels à `{ ns }` littéral sont vérifiés ». Créer **`/Users/megga/.cache/megga-5b1/cles_page.py`** :

````python
"""Les clés littérales de la fiche d'affaire, résolues dans les quatre langues — ce que `lint:i18n-keys` ne vérifie pas
pour une page à trois namespaces (`pipeline`, `contacts`, `common`)."""
import json
import os
import re

R = '/Users/megga/Desktop/megga-real-estate/.claude/worktrees/crm-navigation-aesthetics-56086d'
src = open(os.path.join(R, 'src/pages/agent/DealDetailPage.tsx'), encoding='utf8').read()
NS = ('pipeline', 'contacts', 'common', 'matching', 'listings')
langs = {l: {n: json.load(open(os.path.join(R, f'src/i18n/locales/{l}/{n}.json'), encoding='utf8')) for n in NS}
         for l in ('fr', 'en', 'de', 'it')}


def a(d, cle):
    cur = d
    for p in cle.split('.'):
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    return True


def existe(d, cle):
    return a(d, cle) or a(d, cle + '_one') or a(d, cle + '_other') or cle in d


cles = sorted(set(re.findall(r"\bt\(\s*'([^'$`]+)'", src)))
manquantes = []
for c in cles:
    if ':' in c:
        n, k = c.split(':', 1)
        ok = all(existe(langs[l][n], k) for l in langs)
    else:
        ok = all(any(existe(langs[l][n], c) for n in ('pipeline', 'contacts', 'common')) for l in langs)
    if not ok:
        manquantes.append(c)
print(len(cles), 'clés lues ; manquantes :', manquantes or 'aucune')
````

```bash
python3 /Users/megga/.cache/megga-5b1/cles_page.py
```

Attendu : `112 clés lues ; manquantes : aucune`.

- [ ] **Étape 3 — la suite unitaire, SEULE.**

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 364 passed (367)`, `Tests  1 failed | 5458 passed | 3 skipped (5462)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 4 — le build.**

```bash
npm run build && rm -rf dist
```

Attendu : sortie 0 ; `DealDetailPage-*.js` pèse 38,18 kB (mesuré au rejeu). Le build n'écrit rien hors de `dist/`.

- [ ] **Étape 5 — les bancs e2e** (port 5199 libre, étape 0.4) :

```bash
npx playwright test --config=playwright.bancs.config.ts
```

Attendu : `85 passed`.

- [ ] **Étape 6 — les captures du banc, en clair et en sombre**, HORS du dépôt. Créer **`/Users/megga/.cache/megga-5b1/revue/playwright.config.ts`** :

````ts
/**
 * Captures de revue de l'étape 5b-1 — HORS du dépôt : rien de ce dossier n'est commité. Le banc `/dev/crm` du
 * worktree, servi sur 5199 (jamais 5173, le serveur de Julien) ; `DEPOT_5B1` pointe ailleurs pour une copie.
 */
import { defineConfig, devices } from '@playwright/test'

const DEPOT = process.env.DEPOT_5B1 ?? '/Users/megga/Desktop/megga-real-estate/.claude/worktrees/crm-navigation-aesthetics-56086d'

export default defineConfig({
  testDir: '.',
  outputDir: '../resultats',
  timeout: 180_000,
  workers: 1,
  reporter: 'line',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5199', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    cwd: DEPOT,
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_PASSWORD_GATE_BYPASS: 'true' },
  },
})
````

Puis **`/Users/megga/.cache/megga-5b1/revue/fiche-affaire-5b.spec.ts`** :

````ts
/**
 * Les fiches d'affaire du banc, en clair et en sombre : Julie Morand (d5, Recherche), Anastasia Volkova (d6,
 * Visites), une affaire en Négociation (d10, sans bloc) ; puis un clic sur un bien proposé de Julie.
 */
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const CAPTURES = join(__dirname, '..', 'captures')

async function ouvrir(page: Page, chemin: string, theme: 'clair' | 'sombre'): Promise<void> {
  await page.addInitScript((d) => { window.localStorage.setItem('megga.crm.dark', d) }, theme === 'sombre' ? '1' : '0')
  await page.goto(`/dev/crm?entree=${encodeURIComponent(chemin)}`)
  await page.locator('.banc-pastille').waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1800)
}

for (const theme of ['clair', 'sombre'] as const) {
  for (const id of ['d5', 'd6', 'd10']) {
    test(`fiche ${id} ${theme}`, async ({ page }) => {
      await ouvrir(page, `/dashboard/transactions/${id}`, theme)
      await page.mouse.move(1435, 5)
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(CAPTURES, `${id}-${theme}.png`) })
    })
  }
}

test('un clic sur un bien proposé mène à « Retours de … »', async ({ page }) => {
  await ouvrir(page, '/dashboard/transactions/d5', 'clair')
  await page.getByRole('button', { name: /Appartement 4 pièces · Champel/ }).click()
  await page.waitForTimeout(1500)
  await page.mouse.move(1435, 5)
  await page.screenshot({ path: join(CAPTURES, 'd5-clic-propose.png') })
  expect(page.url()).toContain('/dev/crm')
  console.log(`[5b] url ${page.url()}`)
})
````

```bash
cd /Users/megga/.cache/megga-5b1 && npx playwright test --config=revue/playwright.config.ts
```

Attendu : `7 passed`, et sept images dans `/Users/megga/.cache/megga-5b1/captures/`. Les regarder toutes :

- `d5-clair.png`, `d5-sombre.png` — Julie Morand, en Recherche : « Matching » en tête de la colonne de gauche, « 5 biens » ; « Appartement 4 pièces · Champel » (« Proposé le … »), « Appartement 4,5 pièces · Petit-Saconnex » (« Proposé le … · Vendu »), puis trois « À proposer » ; prix et score en pastille à droite ; l'historique dit « Proposé : 2 biens », « Proposé : Appartement 4,5 pièces · Petit-Saconnex », « Deal créé ». Les dates du banc sont relatives au jour de la capture.
- `d6-clair.png`, `d6-sombre.png` — Anastasia Volkova, en Visites : « Visites », puis « Matching » (« 4 biens », « Appartement 4,5 pièces · Champel » en « Visite planifiée », trois « À proposer ») ; l'historique dit « Visite planifiée : … », « Intéressé·e : … », « Proposé : … », « Deal créé depuis le matching » — et aucune ligne « Étape changée » à côté de la visite.
- `d10-clair.png`, `d10-sombre.png` — une affaire en Négociation : aucun bloc « Matching ».
- `d5-clic-propose.png` — le Matching, onglet « En attente », filtré sur Julie Morand.

Les montrer à Julien.

- [ ] **Étape 7 — les cinq photos, vérifiées SEULES** (chacune dans une copie jetable liée au `node_modules` du dossier principal ; la suite unitaire y tourne seule) :

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py verifier
```

Attendu, pour chacune des cinq photos : `tsc=0`, `eslint=0`, `deadcode=0`, `i18n-keys=0`, `parity=0`, `coverage=0`, `i18n=0`, `prose=0`, et `vitest=1` avec pour seuls échecs les trois fichiers connus. Les suites mesurées au rejeu : C0 `5425 passed` ; C1 `5448 passed` ; C2, C3 et C4 `5458 passed`.

- [ ] **Étape 8 — les commits, AU SIGNAL de Julien (« committe »).** Pas avant.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py commiter
```

Attendu : cinq lignes « huit caractères du commit, puis son message », dans cet ordre, puis `status : propre`. Les messages, et ce que chacun porte :

| Commit | Message | Tâches |
|---|---|---|
| 0 | `refactor(matching): l'état d'un compatible s'écrit à un seul endroit` | 1 |
| 1 | `feat(pipeline): la fiche d'affaire montre les biens de l'acheteur dans le matching` | 2 à 5 |
| 2 | `feat(pipeline): l'historique de l'affaire dit ses étapes du matching` | 6 |
| 3 | `chore(banc): le journal du matching de deux affaires, et la visite de Champel` | 7 |
| 4 | `docs(pipeline): la fiche d'affaire branchée sur le matching — conception, plan, carte, cerveau` | 8, avec la conception et ce plan |

⛔ **Jamais de push** sans la demande de Julien. Le script refuse de commiter si la branche, `HEAD` ou l'arbre ont bougé depuis la dernière photo.

---

## Décisions prises (rappel)

Toutes de Julien, le 30.09.2026.

1. **L'étape 5b est coupée en deux** : 5b-1, la fiche d'affaire, maintenant ; 5b-2, le KYC, une fois le KYC refait commité dans sa session et ramené sur `main`.
2. **Quels biens (question 1, A)** : tous les biens de l'acheteur dans le matching, rangés par état, comme « Sa boucle ».
3. **Quand (question 2, A)** : en Prospects, en Recherche et en Visites ; en Visites, sous la section « Visites » ; plus rien à partir de l'Offre. Une affaire revenue en Recherche le retrouve.
4. **L'historique (question 3, A)** : chaque étape du matching liée à l'affaire y devient une ligne ; il passe de 8 à 12 lignes.
5. **L'approche 1** : côté écran, avec les règles du fil ; ni migration, ni fonction de base, ni fonction serveur.
6. Tranché en route : **une affaire sans acheteur n'a pas de bloc.**

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- **De la conception (§10)** : l'étape 5b-2, le KYC (condition : le KYC refait, commité et ramené sur `main`) ; une affaire côté vendeur (« Qui pour ce bien ? » de son mandat sur sa fiche) ; la décision 15 (« Intéressé·e ») ; une visite d'annonce du marché planifiée depuis le fil, qui n'écrit que `calendar_event_created` et n'entre pas dans l'historique ; une relance de proposition du matching montrée comme toute relance dans la prochaine action ; un intérêt dont la proposition est plus ancienne que les 100 derniers événements du contact, non relié à l'affaire ; le bien de l'affaire « À proposer » dans son propre bloc si son match n'a jamais été proposé ; la fiche d'affaire mobile, qui ne dit rien du matching (étape 5c, lot E2).
- **Relevé à l'écriture du plan (30.09.2026)** :
  - Le banc compare `gt` en chaînes (`bancSupabase`) : sa lecture des biens revenus de « Sa boucle » ramène des matchs jamais proposés. Le modèle s'en garde (tâche 2) ; toute autre lecture en `gt` sur une date reste fausse au banc.
  - `lint:i18n-keys` ne vérifie que les appels à `{ ns }` littéral dans les 28 fichiers qui lisent plusieurs namespaces — dont la fiche d'affaire (vérifiée à la main, tâche 9).
- **Relevé à l'exécution (30.09.2026)** :
  - « Réessayer » d'un échec de première lecture relance une lecture sans données : TanStack v5 repasse la requête en `pending`, l'état « lecture » remplace le bouton et le focus tombe sur `<body>` — dans le bloc « Matching » de la fiche d'affaire comme dans « Qui pour ce bien ? » (`QuiPourFiche`). `FilSelection` le gère ; les deux sœurs à reprendre ensemble.
  - `lint:i18n-keys` ne lit pas un module pur (`filAffichage.ts`) : les clés `fil.signal.*` et `fil.valeurs.*` n'y ont jamais été vérifiées. Une porte qui les lirait tiendrait mieux qu'une spec par module (relevé à la relecture de la tâche 1).
  - Un prédicat « en vente » unique : `occasion` (`filAffaire.ts`) en est une copie de plus, `versMatch` ne posant ni `enVente` ni `statut` (déjà « En attente » depuis le lot E1).
  - `saBoucle.ts` est devenu un modèle de matching partagé (lu par `filAffaire.ts`) : sa place serait `matching-fil/`, par un `git mv` à part (neuf importeurs, dont trois specs ; `matching-sans-sortie.spec.ts` nomme aussi son chemin).
  - Une erreur jsdom ponctuelle (`ReferenceError: window is not defined`, un minuteur de `notifyManager` de TanStack après démontage), attribuée à `tests/unit/admin-refus-tiroir.spec.tsx`, vue une fois sur trois passages de la suite complète à la tâche 5, puis à la vérification des arbres (C4, cinq tests rouges), jamais seule (trois passages verts), hors sujet : une course au démontage à surveiller en CI.
  - L'assemblage de l'historique de la fiche d'affaire (`DealDetailPage`) n'est lu par aucune spec : les douze lignes, les icônes, le texte d'origine, l'écart du changement d'étape doublé par une visite, l'ordre à instant égal (la création sous le geste qui l'a fait naître). Les règles vivent dans le modèle et y sont gardées ; leur assemblage, lui, tient au code de la page — un module pur `historiqueDeLAffaire` le rendrait éprouvable.
  - `neeDuMatching` : le libellé retombe sur « Deal créé » quand plus de cent gestes du matching plus récents ont poussé la proposition d'origine hors de la fenêtre lue ; et une affaire créée à la main puis proposée dans la minute est dite « depuis le matching ».
  - L'état de la lecture du journal commande aussi le bloc « Matching » : un journal en échec à sa première lecture y écrit « Les biens de l'acheteur n'ont pas pu être lus » et masque des biens lus. C'est conforme au §4.5 (« l'une de ses trois lectures ») ; un état propre au journal (`journalLu`) découplerait le bloc de l'historique.
  - L'anglais dit la visite de quatre façons : « Viewing planned » dans `matching.json` (`fil.quiPour.etat.visite`, que le bloc « Matching » affiche sur la même fiche que l'historique « Viewing scheduled: … ») et dans `contacts.json` (`loop.etat.visite`) ; « Viewing scheduled » dans `pipeline`, `listings` et `calendar` ; « Visit planned » et « Visit scheduled » dans `admin`, `common`, `contacts`, `dashboard` et le matching mobile — à aligner ensemble.
  - Au banc, des écarts avec ce qu'écriraient les écrivains, sans effet à l'écran : `d5` reste sans bien alors que la proposition de `m26`, un mandat, le lui aurait posé (`rattacherDeal`) — le lui donner changerait sa carte du Pipeline ; `faitDeal` n'écrit pas `metadata.contact_id` (antérieur) ; le journal ne porte pas toutes les réponses que les statuts supposent (le refus de `m14`, le passage de `m28` en visite). Et aucune affaire du banc ne naît du matching : il faudrait en ouvrir une sur le bien proposé.
  - Rien ne relie les gestes du banc à leurs écrivains : un écrivain qui changerait de forme laisserait le banc vert (c'est déjà le cas de `faitDeal`, `cloche` et `EVENEMENTS`). Une garde rejouerait `execProposer`, `execProposerSelection` et `execPlanifierVisite` sur les données du banc, au travers de son interception, et confronterait les lignes à `FAITS_MATCHING` — prototype de la relecture : ~50 lignes, ~170 ms, `fetch` bloqué avant tout import (le client vise la production) ; elle ne couvre pas les lignes écrites par des déclencheurs SQL (fm4, fd8).
  - `docs/system-map.md` décrit encore la fiche d'affaire par « stepper 8 étapes + bannière KYC + offres », périmé depuis la refonte du Pipeline (27.09.2026 : cinq phases, KYC non bloquant) ; son « `/new` wizard » ne vaut plus qu'au téléphone (`MobileWizardPage`) : le bureau a « Nouveau bien », en quatre étapes, depuis le retrait de l'ancien wizard (16.09.2026).
  - L'index local du cerveau accumule ses vecteurs : chaque `memory import` de ruflo remplace la ligne de `memory.db` mais ajoute un vecteur neuf à l'index HNSW (`.swarm/hnsw.*`) sans retirer l'ancien, et le hook de démarrage relance le seed à chaque session — mesuré le 30.09.2026 : 7 884 vecteurs pour 320 clés, dont 312 en 25 copies ; un rang de `memory search` n'y est plus fiable. Remède : supprimer `.swarm/hnsw.index` et `.swarm/hnsw.metadata.json` avant l'import, dans `scripts/ruflo-seed-memory.mjs` (la recherche suivante reconstruit l'index depuis `memory.db`).
  - `tests/unit/ajouter-selection.spec.tsx` a rougi une fois sous la charge de la suite complète (« Cannot read properties of null (reading 'mutateAsync') » : le crochet lu avant son rendu), vert seul : une attente à resserrer, comme celles de `matching-affaire-lecture` à la tâche 3.

## Écarts à l'exécution (30.09.2026) — le code du dépôt fait foi

Les tâches 1 à 8 ont été exécutées le 30.09.2026, chacune par un sous-agent : appliquée à la lettre, puis relue deux fois — conformité (pour le code, mutants joués hors du dépôt), puis qualité — et reprise jusqu'à ce que les deux passent. La 9, ensuite : portes, suite unitaire, build, bancs, captures, arbres vérifiés seuls, puis commits au signal de Julien.

⛔ **Les blocs de code des tâches ci-dessus décrivent l'état AVANT les relectures, et ne sont pas réécrits : les commits font foi.** Rejoué aujourd'hui, le plan réintroduirait les défauts que les relectures ont corrigés — un rafraîchissement en échec qui effaçait des biens déjà lus, un nombre écrit pendant la lecture, un intérêt relié à l'affaire d'une ancienne proposition, un mandat supprimé nommé dans l'historique, des specs qui restaient vertes sur un code faux, entre autres. Les tâches en aval ont été lancées sur des consignes adaptées à ces relectures, que les blocs ci-dessus ne reprennent pas ; ces lignes disent où le dépôt s'écarte du plan, et pourquoi.

⚠ **Les « Attendu » chiffrés ne tombent plus juste**, et c'est attendu : les relectures ont ajouté des tests à presque chaque tâche (5 486 réussis après la tâche 6, contre 5 458 au rejeu du plan). `tsc`, eslint et les portes restent à 0 ; la suite n'échoue que sur les trois fichiers connus.

- **Tâche 1** — ⛔ **Deux défauts du plan dans sa garde**, trouvés par la relecture de conformité et joués en mutants : le faux `t` rendait la clé nue, si bien que `t(e.motif)` et `e.motif` donnaient la même chaîne (un motif laissé en clé restait vert) ; et les neuf clés `fil.quiPour.etat.*` sortaient de la porte `lint:i18n-keys`, qui ne collecte que les fichiers qui appellent `useTranslation`, `i18nKey=` ou `i18n.t(` — un module pur lui échappe (4 552 clés vérifiées sur `main`, 4 543 après la tâche). La spec gagne un test à vrai i18next, une instance par langue, `fallbackLng: false` : ni clé nue, ni `{{ }}`, des lettres, la valeur écrite des états datés ou chiffrés, les huit motifs de refus — 128 cas. Relecture de qualité : `ecrireEtat` devient **`texteEtatCompatible`** (il se heurtait au `texteEtat` de `filValeurs.ts`, l'état PHYSIQUE d'un bien, et à la convention `texte*` du module) — répercuté dans les consignes des tâches 2, 4 et 8 avant leur lancement (leurs blocs, ci-dessus, disent encore `ecrireEtat`) ; le faux `t` marque ce qu'il traduit (`‹clé›`) ; en-têtes allégés, sans nommer de consommateur.
- **Tâche 2** — ⛔ **Le modèle redisait deux règles qu'il devait appeler** (relecture de conformité) : la lecture d'un match par « Qui pour ce bien ? » (le report ne vaut que pour un match à proposer, un match jamais proposé n'a pas de suivi) était recopiée dans `compatibleDe` et dans un `Compatible` bâti à la main, et le titre, le prix courant d'une annonce et la location étaient recopiés de `versMatch`. Le modèle appelle désormais `versCompatible` (les deux sources) et `versMatch`, que `saBoucle.ts` exporte. ⚠ **La conception se contredisait** : le §4.3 excluait un bien à proposer hors vente, le §4.4 donnait une ligne sans lien à un revenu hors vente ; tranché pour l'exclusion — décision 12a du lot E1, la règle d'« Aujourd'hui » — et le §4.4 amendé. La spec gagne ce qu'elle laissait passer (22 mutants joués, 8 restaient verts) : le dédoublonnage éprouvé par un revenu au MEILLEUR score, les trois meilleurs choisis après le filtre, un match écarté, le lien d'un revenu en vente, et une heure de lecture loin de l'horloge (`2020-01-15`) — un `Date.now()` caché serait resté vert jusqu'au 02.10.2026.

  Re-relecture de conformité : l'état se lisant désormais sur la ligne brute, `parId` garde la PREMIÈRE ligne d'un id, comme `construireSaBoucle` ; garder la dernière écrivait « Revenu · refusé à … » parmi les proposés, avec le lien de « Retours de … », sur la course que `useContactSentMatches` documente (un bien reproposé entre ses deux lectures parallèles) ; le plafond de trois est éprouvé (un quatrième candidat) ; le statut réel d'un match écarté est `'ignored'` ; l'état d'une annonce du marché n'est jamais écrit comme celui d'un mandat. Le bloc de la tâche 6 s'ancrait sur l'ancien import de `filModele` et réintroduisait `nombreOuNull` : sa consigne n'y ajoute plus que `temps`.

  Relecture de qualité : la spec ne tenait pas « seul `active` est en vente » (trois mutants verts : « Actif » écrit sur un mandat en vente, « Réservé »/« Archivé »/« Brouillon » tus, un brouillon proposé) — un test parcourt désormais `property_status` entier, l'idiome de `sa-boucle.spec.ts` ; `etatDe` ne rend plus `null` (deux gardes mortes parties), une ligne se bâtit à un seul endroit (`ligneDe`), `RANG_A_PROPOSER` nomme le rang 2, trois commentaires inexacts corrigés (dont `total`, qui ne compte pas « tous les biens de l'acheteur » mais les lignes avant le plafond de huit). Laissés, à dessein : la signature (`criteres` et le nom de l'acheteur ne servent qu'à « Sa boucle », dit en docstring — la changer aurait débordé sur la tâche 3), les fabriques de la spec (la tâche 6 s'y appuie), et un prédicat « en vente » unique, déjà « En attente » depuis le lot E1.
- **Tâche 3** — Le code du plan était conforme (filtre, index `idx_matches_agency_focus` par le prédicat de la RLS, clés, realtime, états) ; ⛔ **sa spec laissait passer quatre régressions** (24 mutants joués) : un échec de « Sa boucle » (le bloc aurait écrit un bien proposé « À proposer »), le `contactId` de la clé (deux fiches auraient partagé leurs biens), les colonnes (le faux `select` ignorait son argument : un `select('*')` aurait vidé les biens à proposer sans erreur), et la clé de « Sa boucle » sous `CLE_FIL`, gardée nulle part. Elle les tient désormais, avec « en lecture » tant que l'une des lectures l'est et un seul abonnement realtime. Le hook gagne sa garde : `refetch` passe outre `enabled`, et « Réessayer » sans acheteur aurait lu `contact_id=eq.undefined`.

  Re-relecture de conformité : « en lecture » éprouvé des DEUX côtés (au montage, « Sa boucle » rend d'ordinaire après les biens à proposer — elle relit ses recherches) ; la garde « sans acheteur » éprouvée par un `refetch`. ⛔ Les tests qui relâchent une lecture étaient INSTABLES (3 rouges sur 30 sans mutation) : TanStack prévient ses observateurs par un `setTimeout(0)`, et l'attente posée dans le même `act` que la libération partait avant ; relâcher et attendre dans deux `act` séparés — 0 rouge sur 60.

  Relecture de qualité : ⛔ **un rafraîchissement en échec aurait remplacé une liste valide par l'erreur** (au retour sur l'onglet, après un geste du fil, après un rafraîchissement realtime de « Sa boucle ») — la lecture expose `aDesDonnees`, comme `useMatchingFil` et `QuiPourFiche`, et le bloc (tâche 4, adaptée) n'affiche l'erreur que sur un échec de PREMIÈRE lecture ; `refetch` a une identité stable (`useCallback`) ; un report se juge à l'heure de la lecture (test) ; le test des clés lit TOUT le cache, pas un préfixe ; deux titres de test disaient autre chose que ce qu'ils vérifient.
- **Tâche 4** — Adaptée avant son lancement à `aDesDonnees` (l'erreur ne se dit que sur un échec de première lecture ; un test de plus). Le code du plan était conforme ; ⛔ **sa spec laissait passer** une lecture en cours qui montrerait des lignes déjà lues, une ligne sans place qui se donnerait pour un bouton autrement que par la balise (un `role`, un `tabindex`, le curseur d'un lien), une location sans « / mois », un palier détaché du score. Elle les tient. L'échec porte `role="alert"`, comme « Qui pour ce bien ? » : remplacer la région `role="status"` par l'erreur ne prévenait aucun lecteur d'écran.

  Relecture de qualité, bloc réécrit d'un tenant : ⛔ **aucun survol** — une ligne qui mène au fil et une ligne sans place se ressemblaient, seul le curseur changeait (« Sa boucle », le fil et le Pipeline survolent sur `focusSurface`) ; ⛔ **pas de repère de position** — les textes `sr-only` de `FilScore` se rangeaient contre le pager de la fiche et en allongeaient le défilement (925 px pour 500 visibles, mesuré sous Chromium). Aussi : un sous-composant par ligne (`LigneBien`, l'idiome du dossier), les quatre bordures une à une (la leçon de « Sa boucle »), `unSeulClic` sur la navigation, « Réessayer » en `FilBouton compact` comme « Qui pour ce bien ? », `role="alert"` sur le seul message, une prop réduite à ce que le bloc lit (le journal de la tâche 6 n'y entre pas), trois états en trois tests, et l'anglais de l'état vide, « No properties yet. ».
- **Tâche 5** — ⛔ **Défaut du plan** : l'en-tête écrivait « N biens » dès `total > 0`, donc pendant la lecture (le nombre de ce qui était déjà arrivé, qui sautait ensuite — « Sa boucle » rend d'ordinaire après les biens à proposer) et à côté du message d'échec ; il ne se dit plus qu'avec les lignes. Le bloc suit `dealOuvert` (lot E1) : une affaire annulée ou archivée n'en a plus, comme elle ne reçoit plus de geste du fil. Précisé dans la conception (§4.1) : le bloc vient sous le contenu de phase, donc sous « Négociation » quand une chaîne d'offres existe.

  Relecture de qualité : ⛔ **filet doublé** — sur une affaire en Prospects ou en Recherche sans bloc (archivée, annulée, sans acheteur), l'historique, premier de sa colonne sans `premiere`, empilait son filet sur celui de la grille (2 px à gauche, 1 px à droite) ; il prend désormais le filet de tête quand il est seul. Aussi : un `acheteurId` au lieu d'un `contact_buyer_id!` (le seul `!` de la page) ; `montrerNombre = aDesDonnees && total > 0`, le même prédicat en plus simple ; la garde « score en % » de `score-une-ecriture` lit le bloc ET la page et voit `{score} %` ou `{Math.round(m.score)} %` ; les lignes du bloc s'alignent sur la liste « Visites » voisine (le survol déborde de 2xs sous une marge négative) ; deux commentaires justes.
- **Tâche 6** — Adaptée avant son lancement à ce que les relectures des tâches 3 et 5 avaient changé : le retour du hook (le journal entre dans `aDesDonnees` et dans un `refetch` stable), la lecture du journal gardée sans acheteur (sans quoi « Réessayer » aurait lu `entity_id=eq.undefined`) et départagée par l'id (deux gestes d'une même transaction partagent leur `created_at`, et la lecture est tronquée à cent), l'appel de la page par `acheteurId`, et son coût écrit en commentaire : la lecture tourne dans toutes les phases, puisque l'historique en lit le journal jusqu'à la clôture.

  Relecture de conformité (métadonnées confrontées aux écrivains : les gestes du fil, `wa_matching_consigner`, `wa_matching_visite`, le déclencheur `log_match_reaction`) : ⚠ la fenêtre d'origine était SYMÉTRIQUE (`Math.abs`) sous une docstring qui dit « suit sa création » — un geste plus ancien que l'affaire l'aurait fait « naître du matching » ; elle ne regarde plus qu'après. ⛔ **La garde laissait passer 9 mutants sur 23** : le nom d'un bien du journal, éprouvé sur la seule lecture des biens à proposer, qui ne porte aucun proposé (seule « Sa boucle » les lit) ; le journal absent des états `isLoading`/`isError`/`aDesDonnees` ; un intérêt relié à la proposition d'une AUTRE affaire ; des seuils non fixés (59/61 s, ±9/11 s). À instant égal (le copilote crée l'affaire et consigne son geste dans la même transaction), « Deal créé depuis le matching » s'affichait AU-DESSUS du geste : la création passe en dernier avant le tri, qui est stable.

  Relecture de qualité : ⛔ **la règle du titre existait en deux endroits, et divergeait déjà** — `titresDesMatchs` nommait un mandat supprimé lu par un super-administrateur, là où `versMatch` n'en fait pas une ligne et où la conception veut « un bien » ; `saBoucle.ts` exporte désormais `jointureDuMatch` et `titreDuBien`, lus par les deux. ⚠ **Un intérêt se reliait à toute affaire qui avait un jour proposé son bien** : un bien reproposé avec une autre affaire aurait écrit « Intéressé·e » dans l'historique de la première (perdue entre-temps) ; il se relie désormais à la DERNIÈRE proposition qui le précède (conception §5.1 précisée). L'historique se trie sur des instants (`temps`), plus sur des chaînes ; ses icônes et son plafond de douze sont des constantes de module ; « Viewing scheduled », le terme de l'étape ; des commentaires justes (qui journalise, le rafraîchissement du journal, le coût de la lecture). Laissés, notés « En attente » : l'état du journal qui commande aussi le bloc (conforme au §4.5), l'assemblage de l'historique sans spec.

  Re-relecture de qualité : le docblock d'`affaireProposante` dit que l'égalité compte (une même transaction) ; une liste de propositions s'allonge en place (`push`), sans se recopier à chaque proposition.
- **Tâche 7** — Le diff était celui des blocs, et les fiches montrent ce que la conception veut (calculé sur les vraies fixtures, puis rendu au navigateur). ⚠ **Les gestes du banc n'avaient pas la forme de leurs écrivains** (relecture de conformité) : famille `contact` et aucun sujet, là où le fil (`logEvent`) écrit une proposition dans la famille `deal` avec « Prénom Nom · bien » et le déclencheur `log_match_reaction` une réponse avec « sent → interested » — le journal d'audit fusionnait deux propositions de deux acheteurs en « Bien proposé par l'agent ×2 », sans sujet, une ligne que la production ne peut pas écrire. Ils portent désormais famille, sujet et métadonnées (`bien_refs`, `score`, `scheduled_at`). ⛔ **L'origine d'Anastasia n'était productible par aucun écrivain** : « Deal créé depuis le matching » veut une affaire que le geste a fait naître, donc ouverte SUR le bien proposé (`rattacherDeal`), or `d6` porte Florissant, son mandat off-market ; la proposition de Champel vient une heure après l'ouverture, et la fiche dit « Deal créé ». La règle « depuis le matching » reste gardée par la spec du modèle ; le banc ne la montre plus.

  Relecture de qualité : ⚠ le docblock disait que le banc n'a « ni trigger ni écrivain » — faux pour l'écrivain, le banc applique l'écriture d'un geste (`CrmShowcasePage`, `bancSupabase`) ; il dit désormais pourquoi ces lignes existent (sans elles, les deux historiques s'ouvriraient vides). `m28` est daté comme son journal (proposé il y a 47 h, répondu il y a 30 h, `prix_propose`), la visite de Champel a une seule date (`DATE_VISITE_CHAMPEL`, comme `execPlanifierVisite` écrit `visite.debut` aux deux endroits), la tête de `journal-audit.spec.ts` écrit le calcul de sa borne (24 + 8 + 5 événements récents, 1000 − 37 + 1), `fd8` suit `fd7` et nomme sa borne (`doublonDeVisite`). Les références des biens restent écrites en dur : importer `refBienInterne` ferait des fixtures les premières à tirer le client Supabase (16 avertissements « Multiple GoTrueClient instances » mesurés dans les specs du banc).
- **Tâche 8** — Adaptée avant son lancement : ses textes (feuille de route, cerveau, CHANGELOG) décrivaient les règles du plan ; ils disent celles du code — l'affaire ouverte (`dealOuvert`), l'exclusion d'un revenu hors vente, les règles du fil APPELÉES et non recopiées (le titre compris ; restent redites l'« occasion » et la clé d'état d'un mandat), l'intérêt relié par la dernière proposition de son bien, l'origine qui SUIT la création, le tri sur des instants, le rafraîchissement en échec qui garde ses biens. La feuille de route inscrit « En attente » ce que l'exécution a relevé ; le plan reçoit ses « En attente » et ces écarts.

  Relecture de conformité, qui a fait corriger ou ajouter : un revenu reporté, qui reste dans le bloc (le CHANGELOG le disait exclu) ; « PAS en production » au titre du CHANGELOG ; les deux règles que le modèle redit, nommées dans le cerveau ; une visite planifiée ou un revenu reporté, qui n'ont pas de place dans le fil ; les objectifs que sert le CHANGELOG, 1 et 3, rien ne partant vers le client ; le statut de branche et `useMatchingAffaire` dans la carte ; la décision 15 dans la feuille de route ; les quatre façons dont l'anglais dit la visite ; les neuf importeurs de `saBoucle.ts` ; `aDesDonnees` au §4.5 de la conception.

  Relecture de qualité : ⚠ l'entrée `megga/deal-detail` du cerveau passait les 512 jetons que lit le modèle de sa recherche (all-MiniLM-L6-v2) : à 1 455 jetons, l'historique de 5b-1 et la clôture tombaient hors de la fenêtre lue, et la recherche la classait 13ᵉ pour « Deal créé depuis le matching », 11ᵉ pour la clôture, hors des dix résultats rendus par défaut. Le matching de la fiche a désormais son entrée, `megga/deal-detail-matching`, comme chaque lot ; remesurée en cosinus exact sur les 320 entrées, elle sort en tête pour le bloc, l'historique et « Deal créé depuis le matching », et `megga/deal-detail` revient 7ᵉ pour la clôture. Aussi : la fin de ce plan disait ses blocs « adaptés » (ce sont les consignes qui l'ont été) ; « rafraîchissement », et non « relecture », pour une lecture de données ; des phrases de la feuille de route, de la carte, du CHANGELOG et de la conception reprises.
- **Tâche 9** — Jouée le 30.09.2026 : `tsc` et eslint à 0 ; les quatorze portes vertes, `check:privileges` rouge sans `SUPABASE_ACCESS_TOKEN`, comme au rejeu ; les 112 clés de la fiche résolues dans les quatre langues ; la suite, 5 485 réussis — hors les trois fichiers connus, `ajouter-selection.spec.tsx` a rougi une fois sous la charge de la suite (un crochet lu avant son rendu), vert seul et sans lien avec l'étape ; le build à 0, `DealDetailPage-*.js` à 38,26 kB (38,18 au rejeu) ; les bancs, 85 réussis ; les sept captures conformes, en clair et en sombre — la fiche d'Anastasia dit « Deal créé » (tâche 7). Les cinq arbres, vérifiés seuls ensuite : `tsc`, eslint et les portes à 0 partout, la suite rouge sur les seuls trois fichiers connus (C0 5 426 réussis, C1 5 469, C2 et C3 5 486), sauf une fois `admin-refus-tiroir.spec.tsx` dans C4 — l'erreur jsdom déjà « En attente » ; C4 rejoué, 5 486 réussis.
