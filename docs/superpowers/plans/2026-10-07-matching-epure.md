# Matching · le fil épuré · plan d'exécution

> **Pour un agent :** SOUS-COMPÉTENCE REQUISE — `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Les étapes sont des cases à cocher.

**But :** le Matching du bureau se lit d'un coup d'œil — le panneau d'un match en carte focus, la liste « À proposer » et les panneaux allégés, les touches du clavier dans l'infobulle. Une donnée ou rien (règle n°1) ; du texte retiré, jamais une affordance. Les gestes, le clavier et les lectures ne changent pas ; rien n'est écrit en base ; rien ne part vers l'acheteur.

**Conception :** [2026-10-07-matching-epure-design.md](../specs/2026-10-07-matching-epure-design.md), à la demande de Julien du 06.10.2026 (« beaucoup trop chargé au niveau des textes »), validée sur maquettes le 07.10.2026 : « B, la carte focus », « la liste allégée me va », « les trois panneaux me vont ». Elle entre dans l'étape 5b de la [feuille de route](../feuille-de-route.md) (la cohérence visuelle de la revue UX), dont elle solde « la densité du panneau d'un match ».

**Architecture :** côté écran seulement, dans `src/components/matching-fil/` — ni migration, ni fonction de base ou serveur, ni lecture neuve. Un atome d'abord (`FilBouton` : la touche dans l'infobulle, un bouton réduit à son icône), puis six surfaces l'une après l'autre : `FilPanneau`, `FilListe`, `FilCorrection`, `FilRetours`, `FilSelection`, enfin `FilQuiPourCeBien` et `FilConclure`. Les textes retirés quittent les quatre langues, les nouveaux y entrent. Chaque surface a sa spec de rendu, sur le vrai composant.

**Pile :** React 18 / TypeScript strict, react-i18next (quatre langues), Vitest (unitaire ; rendu en `createRoot` + `act`), Playwright (bancs `/dev/crm`, port 5199).

**Branche :** `megga/fiche-affaire-matching`, partie de `main` (`d4b5e2d9`), dans le worktree `crm-navigation-aesthetics-56086d`. Elle porte, NON commités : l'étape 5b-1, photographiée en cinq arbres (C0 à C4, qui attendent « committe »), et la flèche de baisse du 01.10.2026 (`FilBaisse`), photographiée à l'étape 0 (C5).

**Méthode d'écriture :** chaque tâche a été JOUÉE dans une copie jetable du worktree jusqu'au vert ; ses instructions ont ensuite été tirées mécaniquement de l'état obtenu — un fichier neuf en entier ; un fichier presque entièrement réécrit, en entier, sous l'empreinte de son état de départ ; un fichier modifié en remplacements exacts, chacun UNIQUE dans l'état qui le précède. Les « Attendu » des tâches 1 à 8 ont été MESURÉS sur une copie neuve, la garde seule d'abord, le code ensuite, la batterie à chaque fin de sujet (07.10.2026). Puis le plan entier a été rejoué depuis son TEXTE — ses 123 blocs relus dans le Markdown, pas dans l'outil qui les a écrits — 7 fichiers créés, 2 réécrits en entier, 112 remplacements, et les 2 blocs hors dépôt (le script des photos, la spec des captures) confrontés à leurs sources — sur une copie neuve du worktree (07.10.2026) : aucun en échec, chaque fichier identique à l'octet à l'état joué ; la tâche 9 a été mesurée sur cette copie.

> ⚠ **Les commits attendent le signal de Julien** (« committe ») : ils se jouent tous à la fin (tâche 9), **un commit par SUJET** — sept : la flèche (C5), les touches (C6), la carte focus (C7), la liste (C8), les trois panneaux (C9, tâches 4 à 6), « Qui pour ce bien ? » et « À conclure » (C10), les docs (C11). Pendant l'exécution, on enchaîne sans commiter, et on PHOTOGRAPHIE l'arbre à chaque fin de sujet avec le script de l'étape 0.2 — un index temporaire, ni ref ni commit, l'index réel intact. Si Julien dit « committe » pour l'étape 5b-1 avant la fin, le script crée ses cinq commits et ceux du fil épuré suivent, sur eux. **Jamais de push.**

> ⚠ **Aucune écriture en production** : ni migration appliquée, ni edge déployée, ni SQL d'écriture. Ce lot n'en demande aucune — la fusion ne demandera aucun geste en production.

> ⛔ **Rien ne part vers l'acheteur.** Aucune sortie n'est ajoutée : `tests/unit/matching-sans-sortie.spec.ts` couvre `src/components/matching-fil/` d'office. « Proposé » consigne ce que l'agent a fait lui-même, comme « Je l'ai proposé » avant lui ; « Rien n'est envoyé à {prénom}. » reste sur « À conclure ».

> ⚠ **La suite unitaire se joue SEULE**, jamais en parallèle de `tsc`, d'eslint ou des bancs : les délais de 5 s sautent et les faux rouges s'enchaînent. Une spec qui rougit se rejoue d'abord seule. **Trois fichiers échouent en local et sont hors sujet** : `supabase/functions/_shared/mail/imap.test.ts`, `supabase/functions/_shared/mail/mime-parse.test.ts`, `tests/unit/safe-internal-path.spec.ts`.

> ⚠ **`npx tsc -b --force`, jamais sans `--force`** dans une copie dont le `node_modules` est un lien vers le dossier principal : le `tsbuildinfo` partagé ferait sauter la vérification.

> ⚠ **Les bancs e2e servent `/dev/crm` sur le port 5199** (`playwright.bancs.config.ts`, `strictPort`, sans réemploi d'un serveur) — **jamais 5173**, le serveur de Julien. Si 5199 est pris, s'arrêter et le dire : ne rien tuer.

> ⚠ **Les instructions sont EXACTES.** Chaque « remplacer (exact) » est l'`old_string` d'un Edit, à l'octet ; il apparaît UNE fois dans le fichier au moment de l'appliquer, et les remplacements d'un même fichier s'appliquent dans l'ordre donné. Un bloc qui ne se trouve pas ne s'adapte pas : l'état de départ n'est pas celui du plan — s'arrêter et le dire. Les blocs sont faits de lignes ENTIÈRES, finissent par un saut de ligne et ne commencent ni ne finissent par une ligne vide. Un fichier neuf se crée avec le contenu exact de son bloc (Write) ; un fichier « réécrit en ENTIER » aussi, une fois son empreinte vérifiée.

## Écarts à la conception, décidés à l'écriture du plan

Ils sont écrits ici et non dans la conception, qui entre telle quelle dans le commit des docs.

1. **Un atome d'abord** (tâche 1, son commit à lui) : la touche quitte la face de `FilBouton`, qui sert toutes les surfaces du fil. « En attente » et « À conclure » en héritent sans autre changement ; leurs réponses gardent leurs mots (conception §6).
2. **La pastille « Nouveau » sur la photo** : un bien nouveau sur le marché ou un mandat neuf la porte en haut à gauche de la carte focus. La conception ne disait que la flèche d'une baisse (§3) ; la pastille est celle de la liste (§4), et son libellé (« Nouveau mandat », « Nouveau sur le marché ») vit dans l'infobulle.
3. **« 3 critères sur 4 »**, en toutes lettres (`fil.criteresSur`, au pluriel près). Quand un critère n'est pas évalué sans qu'aucun ne soit en écart, la ligne ne porte pas d'icône : ni la coche (tout n'est pas tenu), ni l'alerte (rien n'est en écart).
4. **« Quartiers », pas « Zones »** (« À ajuster ») : le mot du tableau des critères (`fil.criteres.zone`, « Quartier »).
5. **« Ses biens à proposer seront réévalués… »** (§5) : l'écran ne l'écrit pas — rien à retirer. « Les biens refusés » et « La correction proposée » quittent l'écran mais nomment leur liste et leur groupe pour un lecteur d'écran (`aria-label`) ; la valeur d'aujourd'hui d'un nombre, barrée et `aria-hidden`, reste dite « aujourd'hui : … » à un lecteur d'écran.
6. **Deux phrases de la sélection du marché passent dans l'infobulle**, au lieu de partir : « J'ai proposé 2 biens à … » (le nom entier du geste) et la liste des écarts d'un bien.
7. **Aucune spec existante ne lisait un texte retiré** (recherché dans `tests/unit` et `tests/e2e`) : aucune n'est modifiée (conception §10).
8. **La flèche de baisse est photographiée sans tâche** (étape 0, C5) : elle est déjà dans le worktree, et elle est vérifiée seule avec les autres arbres (tâche 9).
9. **Le script des photos apprend la suite** (étape 0.2) : C5 à C11, l'ordre numérique (en ordre de chaînes, C10 passait avant C2), les docs propres à chaque sujet (la conception et le plan du fil épuré n'entrent qu'en C11), une seule photo nouvelle à la fois, et des commits en deux temps si Julien commite l'étape 5b-1 d'abord.

## Étape 0 : avant de commencer

- [ ] **0.1 — L'état de départ.**

```bash
git rev-parse --abbrev-ref HEAD
```

```bash
git log --format='%h %s' d4b5e2d9..HEAD
```

```bash
git status --porcelain -- docs/superpowers/specs/2026-10-07-matching-epure-design.md docs/superpowers/plans/2026-10-07-matching-epure.md
```

Attendu : `megga/fiche-affaire-matching` ; aucune ligne (rien n'est commité depuis `main`) — ou, si Julien a dit « committe » pour l'étape 5b-1 entre-temps, ses cinq commits et eux seuls, de « refactor(matching): l'état d'un compatible… » à « docs(pipeline): la fiche d'affaire branchée… » ; et `?? docs/superpowers/plans/2026-10-07-matching-epure.md`, `?? docs/superpowers/specs/2026-10-07-matching-epure-design.md`. Tout autre état : s'arrêter.

- [ ] **0.2 — Le script des photos et des commits, généralisé.** `/Users/megga/.cache/megga-5b1/commits_5b1.py` (hors dépôt, rien n'y est commité) est celui du plan 5b-1 :

```bash
shasum -a 256 /Users/megga/.cache/megga-5b1/commits_5b1.py
```

Attendu : `c6fecbc2ae98bd665c4e0ce84f696c5731e1e4d61faadd748458f89ec2bcc1ee`. Toute autre empreinte : s'arrêter. Puis le réécrire en ENTIER (Write) — les photos C0 à C4 (`photos-5b1.json`) restent telles quelles :

````python
"""Branche megga/fiche-affaire-matching : un commit par sujet — photographiés en route, vérifiés seuls, créés au signal
de Julien. C0 à C4 : l'étape 5b-1 (30.09.2026) ; C5 : la flèche de baisse (01.10.2026) ; C6 à C11 : le fil épuré
(07.10.2026).

    python3 commits_5b1.py photo C<n>       → photographie l'arbre du worktree (index temporaire : ni ref, ni commit, index
                                              réel intact), sans les docs qui n'entrent qu'à un commit suivant ; seule la
                                              photo suivante, ou la dernière à nouveau
    python3 commits_5b1.py ecart C<n>       → les fichiers où le worktree s'écarte de la photo C<n>
    python3 commits_5b1.py verifier [C<n>]  → chaque arbre SEUL (à partir de C<n>, sinon tous) dans une copie jetable liée
                                              au node_modules du dossier principal : tsc -b --force, eslint src tests
                                              --quiet, suite unitaire, lint:deadcode, portes i18n et typographie
    python3 commits_5b1.py commiter         → au « committe » de Julien : les photos pas encore commitées, en chaîne par
                                              commit-tree sur HEAD, la branche avancée, reset mixte. Jamais de push.
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
    'C5': 'style(matching): une baisse de prix se lit en flèche sur les lignes du fil',
    'C6': "style(matching): les touches du fil passent dans l'infobulle",
    'C7': "style(matching): le panneau d'un match en carte focus",
    'C8': 'style(matching): la liste « À proposer » allégée',
    'C9': 'style(matching): recherche à ajuster, en attente et sélection du marché allégées',
    'C10': 'style(matching): « Qui pour ce bien ? » et « À conclure » allégés',
    'C11': 'docs(matching): le fil épuré — conception, plan, feuille de route, carte, cerveau',
}
# Une conception et son plan sont dans le worktree dès leur écriture (non suivis) : ils n'entrent qu'au commit des docs de
# leur sujet, et toute photo antérieure les laisse dehors.
DOCS_ENTRANT = {
    4: ['docs/superpowers/specs/2026-09-30-fiche-affaire-matching-design.md',
        'docs/superpowers/plans/2026-09-30-fiche-affaire-matching.md'],
    11: ['docs/superpowers/specs/2026-10-07-matching-epure-design.md',
         'docs/superpowers/plans/2026-10-07-matching-epure.md'],
}


def git(*args, env=None, entree=None):
    r = subprocess.run(['git', '-C', W, *args], capture_output=True, text=True, env=env, input=entree)
    if r.returncode:
        raise SystemExit(f'git {" ".join(args)} : {r.stderr}')
    return r.stdout.strip()


def rang(nom):
    return int(nom[1:])


def photo_du_worktree(nom):
    fd, idx = tempfile.mkstemp()
    os.close(fd)
    os.remove(idx)
    env = dict(os.environ, GIT_INDEX_FILE=idx)
    try:
        git('read-tree', 'HEAD', env=env)
        git('add', '-A', env=env)
        dehors = [d for r, docs in DOCS_ENTRANT.items() if r > rang(nom) for d in docs]
        if dehors:
            git('rm', '--cached', '-q', '--ignore-unmatch', *dehors, env=env)
        return git('write-tree', env=env)
    finally:
        if os.path.exists(idx):
            os.remove(idx)


def photos():
    return json.load(open(PHOTOS)) if os.path.exists(PHOTOS) else {}


def noms_photos(p):
    noms = sorted((k for k in p if k in MESSAGES), key=rang)
    assert noms == [f'C{i}' for i in range(len(noms))], f'photos non contiguës : {noms}'
    return noms


def deja_commis(p):
    """Les photos que HEAD porte déjà, vérifiées arbre par arbre depuis la base des photos."""
    r = subprocess.run(['git', '-C', W, 'merge-base', '--is-ancestor', p['head'], 'HEAD'])
    assert r.returncode == 0, 'HEAD ne descend pas de la base des photos'
    chaine = git('rev-list', '--reverse', '--first-parent', f"{p['head']}..HEAD").split()
    noms = noms_photos(p)
    assert len(chaine) <= len(noms), 'HEAD porte plus de commits que de photos'
    for sha, nom in zip(chaine, noms):
        assert git('rev-parse', f'{sha}^{{tree}}') == p[nom], f'{sha[:8]} ne porte pas la photo {nom}'
    return noms[:len(chaine)]


def photo(nom):
    assert nom in MESSAGES, nom
    assert git('rev-parse', '--abbrev-ref', 'HEAD') == BRANCHE, 'pas sur la bonne branche'
    p = photos()
    p.setdefault('head', git('rev-parse', 'HEAD'))
    noms = noms_photos(p)
    assert nom not in deja_commis(p), f'{nom} est déjà commitée'
    # L'arbre d'un sujet antérieur ne se reprend pas : le worktree porte déjà les sujets suivants.
    dernier = rang(noms[-1]) if noms else -1
    assert rang(nom) in (dernier, dernier + 1), f'la photo suivante est C{dernier + 1}'
    p[nom] = photo_du_worktree(nom)
    json.dump(p, open(PHOTOS, 'w'), indent=1)
    print(nom, p[nom][:8])


def ecart(nom):
    p = photos()
    arbre = photo_du_worktree(f'C{rang(nom) + 1}' if f'C{rang(nom) + 1}' in MESSAGES else nom)
    print(git('diff-tree', '-r', '--name-status', p[nom], arbre) or 'aucun écart')


def verifier(depuis=None):
    p = photos()
    tmp_principal = os.path.join(PRINCIPAL_NM, '.tmp')
    sauvegarde = os.path.join(S, 'nm-tmp-principal')
    if os.path.exists(tmp_principal) and not os.path.exists(sauvegarde):
        shutil.copytree(tmp_principal, sauvegarde)
    for nom in noms_photos(p):
        if depuis and rang(nom) < rang(depuis):
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
    noms = noms_photos(p)
    assert git('rev-parse', '--abbrev-ref', 'HEAD') == BRANCHE, 'pas sur la bonne branche'
    a_faire = noms[len(deja_commis(p)):]
    assert a_faire, 'rien à commiter'
    assert p[noms[-1]] == photo_du_worktree(noms[-1]), 'le worktree a bougé depuis la dernière photo'
    depart = git('rev-parse', 'HEAD')
    parent = depart
    crees = []
    for nom in a_faire:
        sha = git('commit-tree', p[nom], '-p', parent, '-F', '-', entree=f'{MESSAGES[nom]}\n\n{TRAILER}\n')
        crees.append((sha, MESSAGES[nom]))
        parent = sha
    git('update-ref', f'refs/heads/{BRANCHE}', parent, depart)
    git('reset', '--quiet')
    etat = git('status', '--porcelain')
    for sha, message in crees:
        print(sha[:8], message)
    print('status :', 'propre' if not etat else etat)


if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'photo':
        photo(sys.argv[2])
    elif mode == 'ecart':
        ecart(sys.argv[2])
    elif mode == 'verifier':
        verifier(sys.argv[2] if len(sys.argv) > 2 else None)
    elif mode == 'commiter':
        commiter()
    else:
        raise SystemExit('mode inconnu')
````

- [ ] **0.3 — La flèche, seule différence avec C4, puis sa photo.**

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py ecart C4
```

Attendu, exactement :

```
M	src/components/matching-fil/FilListe.tsx
M	src/components/matching-fil/FilListeBoucle.tsx
M	src/components/matching-fil/filAffichage.ts
M	src/components/matching-fil/filAtomes.tsx
A	tests/unit/fil-baisse.spec.tsx
```

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C5
```

Attendu : `C5` suivi des huit premiers caractères de l'arbre (« style(matching): une baisse de prix se lit en flèche sur les lignes du fil »). Puis :

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py ecart C5
```

Attendu : `aucun écart`.

- [ ] **0.4 — Le port des bancs est libre.**

```bash
lsof -nP -iTCP:5199 -sTCP:LISTEN
```

Attendu : aucune sortie.

## Les fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `/Users/megga/.cache/megga-5b1/commits_5b1.py` | Hors dépôt. Les photos et les commits, de C0 à C11. | 0 |
| `src/components/matching-fil/filAtomes.tsx` | `FilBouton` : la touche dans l'infobulle et `aria-keyshortcuts` ; un bouton réduit à son icône. | 1 |
| `src/components/matching-fil/FilPanneau.tsx` | **Réécrit.** La carte focus. | 2 |
| `src/components/matching-fil/FilListe.tsx` | Les sous-titres courts, l'en-tête d'un bien, les compteurs d'une sélection (`Compteur`), les reportés. | 3 |
| `src/components/matching-fil/FilCorrection.tsx` | **Réécrit.** « À ajuster » : la pastille du motif, la correction avant → après. | 4 |
| `src/components/matching-fil/FilRetours.tsx` | « En attente » : la pastille « Relance », les biens au prix et à la date de leur proposition. | 5 |
| `src/components/matching-fil/FilSelection.tsx` | La sélection du marché : la recherche repliée, les lignes au prix, « Proposé · N ». | 6 |
| `src/components/matching-fil/FilQuiPourCeBien.tsx`, `src/components/matching-fil/FilConclure.tsx` | Le titre en lien ; l'annonce d'origine en icône. | 7 |
| `src/i18n/locales/{fr,en,de,it}/matching.json` | Des clés neuves, des valeurs plus courtes, des clés retirées. | 1 à 7 |
| `tests/unit/fil-bouton.spec.tsx`, `fil-panneau.spec.tsx`, `fil-liste.spec.tsx`, `fil-correction.spec.tsx`, `fil-retours.spec.tsx`, `fil-selection.spec.tsx`, `fil-qui-pour-conclure.spec.tsx` | **Créer.** Une spec de rendu par surface, sur le vrai composant. | 1 à 7 |
| `docs/superpowers/feuille-de-route.md`, `docs/CHANGELOG.md`, `docs/system-map.md`, `.claude-flow/knowledge/megga-memory.seed.json` — et la conception, et ce plan | Les docs. | 8 |
| `/Users/megga/.cache/megga-5b1/revue/matching-epure.spec.ts` | Hors dépôt. Les captures de revue. | 9 |



---

## Tâche 1 : Les touches dans l'infobulle — `FilBouton`

Le bouton d'un geste écrit sa touche sur sa face (`<kbd>`) : « Écarter X », « Plus tard P », « Je l'ai proposé à Anastasia E ». Elle passe dans l'infobulle et dans `aria-keyshortcuts` (conception §2) — le clavier du fil ne change pas. Le bouton apprend deux formes : réduit à son icône (`icone`), il devient rond et porte son `libelle` en `aria-label` et dans l'infobulle ; écrit, son `libelle` ne nourrit que l'infobulle (« Je l'ai proposé à Anastasia · E »), et son nom accessible reste le texte du bouton. Sans `libelle`, l'infobulle reste « Raccourci : E ». Une clé neuve, `fil.actions.infobulle`, dans les quatre langues. Toutes les surfaces du fil en héritent : « En attente » et « À conclure » perdent leurs touches écrites sans autre changement.

**Fichiers :**

- Créer : `tests/unit/fil-bouton.spec.tsx`
- Modifier : `src/components/matching-fil/filAtomes.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-bouton.spec.tsx`** :

````tsx
/**
 * Le bouton d'un geste du fil (`FilBouton`, conception du fil épuré §2) : sa touche quitte sa face et vit dans
 * l'infobulle et `aria-keyshortcuts` ; réduit à une icône, il porte son libellé en `aria-label` et dans l'infobulle.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import { FilBouton } from '@/components/matching-fil/filAtomes'
import { crmPalette } from '@/components/crm/tokens'

const sp = crmPalette(false)
let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(bouton: ReactNode): Promise<HTMLButtonElement> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(bouton) })
  return hote.querySelector('button')!
}
afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilBouton', () => {
  it('sa touche ne s’écrit plus sur sa face : elle vit dans l’infobulle et `aria-keyshortcuts`', async () => {
    const b = await rendre(<FilBouton sp={sp} touche="I" onClick={() => {}}>Intéressé</FilBouton>)
    expect(b.textContent).toBe('Intéressé')
    expect(b.querySelector('kbd')).toBeNull()
    expect(b.title).toBe('fil.actions.raccourci {"touche":"I"}')
    expect(b.getAttribute('aria-keyshortcuts')).toBe('I')
    expect(b.getAttribute('aria-label')).toBeNull()
  })

  it('réduit à son icône, il porte son libellé en `aria-label` et dans l’infobulle, avec sa touche', async () => {
    const b = await rendre(<FilBouton sp={sp} icone="close" libelle="Écarter" touche="X" onClick={() => {}} />)
    expect(b.textContent).toBe('')
    expect(b.querySelector('svg')).not.toBeNull()
    expect(b.getAttribute('aria-label')).toBe('Écarter')
    expect(b.title).toBe('fil.actions.infobulle {"libelle":"Écarter","touche":"X"}')
  })

  it('un libellé sur un bouton écrit : l’infobulle le dit, le nom accessible reste le texte du bouton', async () => {
    const b = await rendre(<FilBouton sp={sp} principal libelle="Je l’ai proposé à Anastasia" touche="E" onClick={() => {}}>Proposé</FilBouton>)
    expect(b.textContent).toBe('Proposé')
    expect(b.getAttribute('aria-label')).toBeNull()
    expect(b.title).toBe('fil.actions.infobulle {"libelle":"Je l’ai proposé à Anastasia","touche":"E"}')
  })

  it('un clic appelle le geste', async () => {
    const geste = vi.fn()
    const b = await rendre(<FilBouton sp={sp} icone="clock" libelle="Plus tard" touche="P" onClick={geste} />)
    await act(async () => { b.click() })
    expect(geste).toHaveBeenCalledTimes(1)
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-bouton.spec.tsx
```

Attendu : `fil-bouton.spec.tsx` : 3 échecs sur 4 — « sa touche ne s’écrit plus sur sa face », « réduit à son icône, il porte son libellé en `aria-label` et dans l’infobulle », « un libellé sur un bouton écrit : l’infobulle le dit » ; seul « un clic appelle le geste » passe.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/filAtomes.tsx`**, 1/2 — remplacer (exact) :

````tsx
import MEIcon from '@/components/propertyx/MEIcon'
````

par :

````tsx
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
````

**`src/components/matching-fil/filAtomes.tsx`**, 2/2 — remplacer (exact) :

````tsx
/**
 * Le bouton d'un geste, sa touche ÉCRITE dessus (jamais cachée) : le principal porte l'accent (CLAUDE.md §3),
 * les autres un filet. `bien` pose `data-bien` : le fil y rend le focus après un geste annulé.
 *
 * ⛔ Un double clic trie DEUX lignes : le premier clic fait passer la sélection à la suivante (même bouton,
 * sous le curseur), le second la trie à son tour. D'où la garde du fil (`unSeulClic`).
 */
export function FilBouton({ sp, touche, onClick, principal = false, compact = false, bien, ouvert, desactive = false, children }: {
  sp: CrmPalette; touche?: string; onClick: () => void; principal?: boolean; compact?: boolean
  bien?: string; ouvert?: boolean; desactive?: boolean; children: ReactNode
}) {
  const { t } = useTranslation('matching')
  return (
    <button type="button" onClick={unSeulClic(onClick)} disabled={desactive} data-bien={bien} aria-expanded={ouvert}
      title={touche ? t('fil.actions.raccourci', { touche }) : undefined} aria-keyshortcuts={touche} style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: compact ? 32 : 40,
        paddingLeft: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        paddingRight: compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)',
        borderRadius: 'var(--crm-radius-pill)', border: principal ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: desactive ? 'not-allowed' : 'pointer', opacity: desactive ? 0.5 : 1, fontFamily: 'inherit',
        background: principal ? sp.accent : 'transparent', color: principal ? sp.accentInk : sp.ink,
        fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
      }}>
      {children}
      {touche && <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: principal ? sp.accentInk : sp.sub }}>{touche}</kbd>}
    </button>
  )
}
````

par :

````tsx
/**
 * Le bouton d'un geste : le principal porte l'accent (CLAUDE.md §3), les autres un filet. Sa touche ne s'écrit plus sur
 * sa face (le fil épuré, 07.10.2026) : elle vit dans l'infobulle et dans `aria-keyshortcuts`. Réduit à son icône
 * (`icone`), il est rond et porte son `libelle` en `aria-label` ; sur un bouton écrit, le `libelle` ne nourrit que
 * l'infobulle (« Je l'ai proposé à Anastasia · E »). `bien` pose `data-bien` : le fil y rend le focus après un geste
 * annulé.
 *
 * ⛔ Un double clic trie DEUX lignes : le premier clic fait passer la sélection à la suivante (même bouton,
 * sous le curseur), le second la trie à son tour. D'où la garde du fil (`unSeulClic`).
 */
export function FilBouton({
  sp, touche, onClick, principal = false, compact = false, bien, ouvert, desactive = false, icone, libelle, children,
}: {
  sp: CrmPalette; touche?: string; onClick: () => void; principal?: boolean; compact?: boolean
  bien?: string; ouvert?: boolean; desactive?: boolean; icone?: MEIconName; libelle?: string; children?: ReactNode
}) {
  const { t } = useTranslation('matching')
  const infobulle = libelle && touche ? t('fil.actions.infobulle', { libelle, touche })
    : libelle ?? (touche ? t('fil.actions.raccourci', { touche }) : undefined)
  const hauteur = compact ? 32 : 40
  const marge = icone ? 0 : compact ? 'var(--crm-space-lg)' : 'var(--crm-space-2xl)'
  const encre = principal ? sp.accentInk : sp.ink
  return (
    <button type="button" onClick={unSeulClic(onClick)} disabled={desactive} data-bien={bien} aria-expanded={ouvert}
      aria-label={icone ? libelle : undefined} title={infobulle} aria-keyshortcuts={touche} style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
        height: hauteur, width: icone ? hauteur : undefined, paddingLeft: marge, paddingRight: marge,
        borderRadius: 'var(--crm-radius-pill)', border: principal ? 0 : `1px solid ${sp.cardBorder}`,
        cursor: desactive ? 'not-allowed' : 'pointer', opacity: desactive ? 0.5 : 1, fontFamily: 'inherit',
        background: principal ? sp.accent : 'transparent', color: encre,
        fontSize: compact ? 'var(--crm-text-sm)' : 'var(--crm-text-md)', fontWeight: 600,
      }}>
      {icone ? <MEIcon name={icone} size={16} color={encre} /> : children}
    </button>
  )
}
````

**`src/i18n/locales/fr/matching.json`** — remplacer (exact) :

````json
      "raccourci": "Raccourci : {{touche}}"
    },
````

par :

````json
      "raccourci": "Raccourci : {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

**`src/i18n/locales/en/matching.json`** — remplacer (exact) :

````json
      "raccourci": "Shortcut: {{touche}}"
    },
````

par :

````json
      "raccourci": "Shortcut: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

**`src/i18n/locales/de/matching.json`** — remplacer (exact) :

````json
      "raccourci": "Tastenkürzel: {{touche}}"
    },
````

par :

````json
      "raccourci": "Tastenkürzel: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

**`src/i18n/locales/it/matching.json`** — remplacer (exact) :

````json
      "raccourci": "Scorciatoia: {{touche}}"
    },
````

par :

````json
      "raccourci": "Scorciatoia: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-bouton.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  39 passed (39)`.

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

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 366 passed (369)`, `Tests  1 failed | 5491 passed | 3 skipped (5495)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 6** (« style(matching): les touches du fil passent dans l'infobulle ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C6
```

Attendu : `C6` suivi des huit premiers caractères de l'arbre.


---

## Tâche 2 : La carte focus — `FilPanneau`

Le panneau d'un match (conception §3), réécrit en entier. La photo passe de 220 à 280 px ; le prix (et sa baisse en flèche, `FilBaisse`) en bas à gauche, le score en bas à droite, en pastilles au fond de la carte et à l'encre courante dans les deux thèmes ; un bien nouveau sur le marché ou un mandat neuf porte la pastille « Nouveau » en haut à gauche. Partent : la pastille « Votre bien », la ligne « CHF … · adresse · ville », « Voir le bien » — le titre est le lien vers le bien — et le signal long, dont la phrase passe dans le dépli. L'acheteur garde son avatar et son nom (lien vers le contact) ; son KYC devient un bouclier, tenu s'il est vérifié, en sourdine sinon, nommé pour un lecteur d'écran et dans l'infobulle. « Pourquoi ce match » se replie derrière une ligne « 4 critères sur 4 » — une coche verte quand tous tiennent, l'alerte ambre dès un écart —, qui déplie la phrase du signal, le tableau des critères et « Déjà proposé à … » ; `aria-expanded`, et replié au match suivant (le dépli retient le match qu'il a ouvert, sans remonter le panneau). « Écarter » et « Plus tard » deviennent des boutons-icônes (`close`, `clock`) ; le principal dit « Proposé ». Trois clés neuves : `fil.actions.propose`, `fil.criteresSur`, `fil.signal.pastille`.

**Fichiers :**

- Créer : `tests/unit/fil-panneau.spec.tsx`
- Réécrire en entier : `src/components/matching-fil/FilPanneau.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-panneau.spec.tsx`** :

````tsx
/**
 * Le panneau d'un match en CARTE FOCUS (`FilPanneau`, conception du fil épuré §3), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · un texte que la conception retire : « Votre bien », « Voir le bien », l'adresse, le KYC écrit en toutes lettres ;
 *   · la phrase longue d'une baisse hors du dépli, ou une baisse sans sa flèche sur la photo ;
 *   · des critères dépliés d'office, ou un dépli qui survivrait au match suivant ;
 *   · un bouton-icône sans nom, ou le prénom de l'acheteur écrit sur le bouton principal.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'fr' },
  }),
}))

import FilPanneau from '@/components/matching-fil/FilPanneau'
import { lignesCriteres, type FilBien, type FilMatch, type RaisonsMoteur } from '@/components/matching-fil/filModele'
import { crmPalette } from '@/components/crm/tokens'
import type { SearchCriteria } from '@/types/contact'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const CRITERES: SearchCriteria = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Florissant', 'GE'], budget_min: 2_000_000, budget_max: 2_600_000,
  rooms_min: 5, features: ['terrasse', 'vue lac'],
}
const FLORISSANT: FilBien = {
  id: 'p3', titre: 'Attique 5,5 pièces · Florissant', prix: 2_350_000, location: false, type: 'apartment', pieces: 5.5,
  surface: 168, ville: 'Genève', canton: 'GE', adresse: 'Route de Florissant 58', equipements: ['terrasse', 'vue lac'], photo: null,
}
/** Les raisons du moteur pour m22 au banc (`crmFixtures.ts`) : ce sont elles qui donnent un verdict à chaque critère. */
const RAISONS: RaisonsMoteur = {
  budget: { match: true, score: 27, detail: 'Dans le budget' },
  zone: { match: true, score: 20, detail: 'Genève correspond' },
  type: { match: true, score: 10, detail: 'apartment' },
  rooms: { match: true, score: 10, detail: '5,5 pièces' },
  features: { match: true, score: 8, detail: '2/2 critères' },
}
const match = (id: string, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 100, raisons: RAISONS, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: FLORISSANT,
  acheteur: { id: 'c11', prenom: 'Anastasia', nom: 'Volkova', telephone: null, email: null, kyc: 'none' }, ...champs,
})
/** Refusé pour le prix à CHF 2'600'000, revenu à CHF 2'350'000 : une baisse de CHF 250'000 depuis son refus. */
const revenu = match('m30', {
  suivi: { statut: 'suggested', proposeLe: null, reponduLe: '2020-01-10T10:00:00Z', motif: 'prix', note: null, prixPropose: 2_600_000, apprisLe: null },
})

const gestes = () => ({ onProposer: vi.fn(), onPlusTard: vi.fn(), onEcarter: vi.fn(), onVoirBien: vi.fn(), onVoirContact: vi.fn() })
type Gestes = ReturnType<typeof gestes>
let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(m: FilMatch, g: Gestes = gestes()): Promise<Gestes> {
  if (!hote) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => {
    racine!.render(<FilPanneau sp={sp} m={m} historique={{ proposes: 2, interesses: 1 }} maintenant={MAINTENANT} {...g} />)
  })
  return g
}
const texte = (): string => hote!.textContent ?? ''
const depli = (): HTMLButtonElement => hote!.querySelector('button[aria-expanded]') as HTMLButtonElement
const bouton = (nom: string): HTMLButtonElement => [...hote!.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === nom || b.textContent === nom)!

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilPanneau — la carte focus', () => {
  it('le prix et le score sur la photo, le titre en lien vers le bien ; ni « Votre bien », ni « Voir le bien », ni l’adresse', async () => {
    const g = await rendre(match('m22'))
    expect(texte()).toContain("CHF 2'350'000")
    expect(hote!.querySelector('[title^="fil.scoreAria"]')).not.toBeNull()
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    expect(titre.textContent).toBe(FLORISSANT.titre)
    await act(async () => { titre.click() })
    expect(g.onVoirBien).toHaveBeenCalledTimes(1)
    for (const retire of ['fil.votreBien', 'fil.voirBien', 'Route de Florissant 58']) expect(texte()).not.toContain(retire)
  })

  it('le KYC de l’acheteur en bouclier : nommé, pas écrit', async () => {
    await rendre(match('m22'))
    expect(hote!.querySelector('[role="img"][aria-label="fil.kyc.none"]')).not.toBeNull()
    expect(texte()).not.toContain('fil.kyc')
  })

  it('les critères tiennent en une ligne, repliée ; le dépli dit la comparaison et ce qui lui a déjà été proposé', async () => {
    const m = match('m22')
    const lignes = lignesCriteres(m)
    expect(lignes.length).toBeGreaterThan(3)
    expect(lignes.every((l) => l.ok === true)).toBe(true)
    await rendre(m)
    expect(depli().getAttribute('aria-expanded')).toBe('false')
    expect(texte()).toContain(`fil.criteresSur {"count":${lignes.length},"total":${lignes.length}}`)
    expect(hote!.querySelector('table')).toBeNull()
    expect(texte()).not.toContain('fil.historique')
    await act(async () => { depli().click() })
    expect(depli().getAttribute('aria-expanded')).toBe('true')
    expect(hote!.querySelector('table')).not.toBeNull()
    expect(texte()).toContain('fil.historique.proposes {"prenom":"Anastasia","count":2}')
  })

  it('le dépli se referme au match suivant', async () => {
    await rendre(match('m22'))
    await act(async () => { depli().click() })
    expect(hote!.querySelector('table')).not.toBeNull()
    await rendre(match('m23'))
    expect(depli().getAttribute('aria-expanded')).toBe('false')
    expect(hote!.querySelector('table')).toBeNull()
  })

  it('une baisse : la flèche sur la photo, la phrase seulement au dépli', async () => {
    await rendre(revenu)
    expect(hote!.querySelector('[title^="fil.signal.court"]')).not.toBeNull()
    expect(texte()).not.toContain('fil.signal.baisseRefus')
    await act(async () => { depli().click() })
    expect(texte()).toContain('fil.signal.baisseRefus')
  })

  it('trois gestes : Écarter et Plus tard réduits à leur icône et nommés, « Proposé » avec le prénom dans l’infobulle', async () => {
    const g = await rendre(match('m22'))
    const ecarter = bouton('fil.actions.ecarter')
    const plusTard = bouton('fil.actions.plusTard')
    expect(ecarter.textContent).toBe('')
    expect(plusTard.textContent).toBe('')
    expect(ecarter.getAttribute('aria-keyshortcuts')).toBe('X')
    const proposer = bouton('fil.actions.propose')
    expect(proposer.textContent).toBe('fil.actions.propose')
    expect(proposer.title).toContain('fil.actions.proposer')
    expect(proposer.title).toContain('Anastasia')
    await act(async () => { ecarter.click() })
    await act(async () => { proposer.click() })
    expect(g.onEcarter).toHaveBeenCalledTimes(1)
    expect(g.onProposer).toHaveBeenCalledTimes(1)
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-panneau.spec.tsx
```

Attendu : `fil-panneau.spec.tsx` : 6 échecs sur 6 — le prix et le score sur la photo, le KYC en bouclier, les critères repliés, le dépli refermé au match suivant, la baisse en flèche, les trois gestes.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilPanneau.tsx`** — réécrire le fichier ENTIER (Write) : presque chaque ligne change. Son empreinte avant d'écrire : `8ad480700707a844ca564041989c410aea93576391c7ea37a80575fe805e5443` (`shasum -a 256 src/components/matching-fil/FilPanneau.tsx`) ; toute autre empreinte : s'arrêter.

````tsx
/**
 * Le panneau d'un match à proposer (§4), en CARTE FOCUS (le fil épuré, 07.10.2026) : la photo en grand, le prix et le
 * score posés dessus ; le titre du bien et le nom de l'acheteur en liens ; les critères repliés en une ligne
 * (« 4 critères sur 4 »), qui déplie la comparaison « Recherché / Ce bien » et ce qu'on lui a déjà proposé ; trois
 * gestes — Écarter et Plus tard réduits à leur icône, « Proposé » le principal. ⛔ « Proposé » n'envoie rien à
 * l'acheteur (21.09.2026) : il consigne ce que l'agent a fait lui-même.
 *
 * ⚠ Une baisse se lit en flèche sur la photo ; sa phrase (« Refusé par … à CHF … · baissé de CHF … depuis »,
 * `texteSignalMatch`) vit dans le dépli. Un bien nouveau sur le marché ou un mandat neuf porte la pastille « Nouveau ».
 *
 * ⚠ Le dépli retient le match qu'il a ouvert : il se lit replié au match suivant, sans remonter le panneau.
 *
 * ⛔ Jamais de points à l'écran : le moteur reporte le poids d'un axe sans critère sur les autres, donc
 * la somme des points ne retombe pas sur le score, et l'afficher se lirait comme une erreur de calcul.
 */
import { useId, useState, type CSSProperties } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { initiales, lignesCriteres, palierScore, type FilMatch, type Historique, type LigneCritere } from './filModele'
import {
  baisseDuBien, baisseDuMatch, MARGE_POINTS, prixBien, teinteEcart, teinteTenu, texteSignalBien, texteSignalMatch,
} from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBaisse, FilBouton, FilScore } from './filAtomes'
import { valeursCritere } from './filValeurs'

interface Props {
  sp: CrmPalette
  m: FilMatch
  historique: Historique | undefined
  onProposer: () => void
  onPlusTard: () => void
  onEcarter: () => void
  onVoirBien: () => void
  onVoirContact: () => void
  maintenant: number
}

export default function FilPanneau({ sp, m, historique, onProposer, onPlusTard, onEcarter, onVoirBien, onVoirContact, maintenant }: Props) {
  const { t, i18n } = useTranslation('matching')
  const { bien, acheteur } = m
  const lignes = lignesCriteres(m)
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const depliId = useId()
  const [ouvertPour, setOuvertPour] = useState<string | null>(null)
  const ouvert = ouvertPour === m.id
  const signal = signalBien(bien, maintenant)
  // La baisse depuis la proposition à CET acheteur d'abord (lot B), sinon celle de l'annonce (lot C).
  const baisse = baisseDuMatch(m, t) ?? (signal ? baisseDuBien(signal, bien, t) : null)
  const nouveau = !baisse && signal && signal.genre !== 'baisse' ? texteSignalBien(signal, bien, t, true) : null
  const phrase = texteSignalMatch(m, t, maintenant)
  const tenus = lignes.filter((l) => l.ok === true).length
  const ecart = lignes.some((l) => l.ok === false)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontWeight: 600, color: sp.ink,
  }
  const pastille: CSSProperties = {
    position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
    padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.cardBg,
    border: `1px solid ${sp.cardBorder}`, color: sp.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600,
  }
  return (
    <section aria-label={t('fil.panneauAria', { acheteur: `${acheteur.prenom} ${acheteur.nom}`, bien: bien.titre })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)` }}>
        <div style={{ position: 'relative', height: 280, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }}>
          {bien.photo
            ? <img src={bien.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                <MEIcon name="home" size={18} color={sp.sub} />{t('fil.sansPhoto')}
              </span>
            )}
          {nouveau && (
            <span title={nouveau} style={{ ...pastille, top: 'var(--crm-space-md)', left: 'var(--crm-space-md)' }}>{t('fil.signal.pastille')}</span>
          )}
          <span style={{ ...pastille, bottom: 'var(--crm-space-md)', left: 'var(--crm-space-md)' }}>
            {prixBien(bien, t)}
            {baisse && <FilBaisse sp={sp} montant={baisse} />}
          </span>
          <span style={{ ...pastille, bottom: 'var(--crm-space-md)', right: 'var(--crm-space-md)' }}>
            <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
          </span>
        </div>

        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>
          <button type="button" onClick={onVoirBien} style={{ ...lien, fontSize: 'inherit' }}>{bien.titre}</button>
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-lg)' }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <span role="img" aria-label={t(`fil.kyc.${acheteur.kyc}`)} title={t(`fil.kyc.${acheteur.kyc}`)} style={{ display: 'inline-flex' }}>
            <MEIcon name="shield" size={16} color={acheteur.kyc === 'verified' ? teinteTenu(sp) : sp.sub} />
          </span>
        </div>

        <div>
          <button type="button" aria-expanded={ouvert} aria-controls={depliId} onClick={() => setOuvertPour(ouvert ? null : m.id)}
            style={{ ...lien, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 500 }}>
            {lignes.length > 0 && (ecart || tenus === lignes.length) && (
              <span aria-hidden style={{ display: 'inline-flex' }}>
                <MEIcon name={ecart ? 'alert' : 'check'} size={16} color={ecart ? teinteEcart(sp) : teinteTenu(sp)} />
              </span>
            )}
            {lignes.length === 0 ? t('fil.sansCriteres') : t('fil.criteresSur', { count: tenus, total: lignes.length })}
            <span aria-hidden style={{ display: 'inline-flex' }}>
              <MEIcon name={ouvert ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            </span>
          </button>
          {ouvert && (
            <div id={depliId} role="region" aria-label={t('fil.pourquoi')}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-md)' }}>
              {phrase && <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>{phrase}</p>}
              {lignes.length > 0 && <TableCriteres sp={sp} lignes={lignes} t={t} nombre={nombre} />}
              <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                {!historique || historique.proposes === 0
                  ? t('fil.historique.aucun', { prenom: acheteur.prenom })
                  : t('fil.historique.proposes', { prenom: acheteur.prenom, count: historique.proposes })
                    + (historique.interesses > 0 ? t('fil.historique.interesses', { count: historique.interesses }) : '')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`, background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} icone="close" libelle={t('fil.actions.ecarter')} touche="X" onClick={onEcarter} />
        <FilBouton sp={sp} icone="clock" libelle={t('fil.actions.plusTard')} touche="P" onClick={onPlusTard} />
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} touche="E" onClick={onProposer} principal libelle={t('fil.actions.proposer', { prenom: acheteur.prenom })}>
          {t('fil.actions.propose')}
        </FilBouton>
      </div>
    </section>
  )
}

function TableCriteres({ sp, lignes, t, nombre }: { sp: CrmPalette; lignes: LigneCritere[]; t: TFunction; nombre: (n: number) => string }) {
  const cellule: CSSProperties = {
    padding: 'var(--crm-space-sm) var(--crm-space-xs)', borderBottom: `1px solid ${sp.cardBorder}`, textAlign: 'left', verticalAlign: 'top',
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'var(--crm-text-md)', color: sp.ink }}>
      <thead>
        <tr style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          <th scope="col" style={{ ...cellule, width: '24%', fontWeight: 500 }}>{t('fil.colonnes.critere')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.recherche')}</th>
          <th scope="col" style={{ ...cellule, fontWeight: 500 }}>{t('fil.colonnes.bien')}</th>
          <th scope="col" style={{ ...cellule, width: 32 }}><span className="sr-only">{t('fil.colonnes.verdict')}</span></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => {
          const [recherche, propose] = valeursCritere(l, t, nombre)
          return (
            <tr key={l.cle}>
              <th scope="row" style={{ ...cellule, fontWeight: 500, color: sp.sub }}>{t(`fil.criteres.${l.cle}`)}</th>
              <td style={cellule}>{recherche}</td>
              <td style={cellule}>
                {propose}
                {l.ecart && (
                  <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: teinteEcart(sp) }}>{l.ecart}</span>
                )}
              </td>
              <td style={cellule}>
                {l.ok !== null && (
                  <span role="img" aria-label={t(l.ok ? 'fil.correspond' : 'fil.ecart')} style={{ display: 'inline-flex' }}>
                    <MEIcon name={l.ok ? 'check' : 'alert'} size={16} color={l.ok ? teinteTenu(sp) : teinteEcart(sp)} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
````

**`src/i18n/locales/fr/matching.json`**, 1/3 — remplacer (exact) :

````json
    "pourquoi": "Pourquoi ce match",
    "colonnes": {
````

par :

````json
    "pourquoi": "Pourquoi ce match",
    "criteresSur_one": "{{count}} critère sur {{total}}",
    "criteresSur_other": "{{count}} critères sur {{total}}",
    "colonnes": {
````

**`src/i18n/locales/fr/matching.json`**, 2/3 — remplacer (exact) :

````json
      "raccourci": "Raccourci : {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

par :

````json
      "raccourci": "Raccourci : {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}",
      "propose": "Proposé"
    },
````

**`src/i18n/locales/fr/matching.json`**, 3/3 — remplacer (exact) :

````json
      "mandatCourt": "Nouveau mandat",
      "mandat": "Nouveau mandat du {{date}}"
    },
````

par :

````json
      "mandatCourt": "Nouveau mandat",
      "mandat": "Nouveau mandat du {{date}}",
      "pastille": "Nouveau"
    },
````

**`src/i18n/locales/en/matching.json`**, 1/3 — remplacer (exact) :

````json
    "pourquoi": "Why this match",
    "colonnes": {
````

par :

````json
    "pourquoi": "Why this match",
    "criteresSur_one": "{{count}} of {{total}} criteria",
    "criteresSur_other": "{{count}} of {{total}} criteria",
    "colonnes": {
````

**`src/i18n/locales/en/matching.json`**, 2/3 — remplacer (exact) :

````json
      "raccourci": "Shortcut: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

par :

````json
      "raccourci": "Shortcut: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}",
      "propose": "Proposed"
    },
````

**`src/i18n/locales/en/matching.json`**, 3/3 — remplacer (exact) :

````json
      "mandatCourt": "New mandate",
      "mandat": "New mandate from {{date}}"
    },
````

par :

````json
      "mandatCourt": "New mandate",
      "mandat": "New mandate from {{date}}",
      "pastille": "New"
    },
````

**`src/i18n/locales/de/matching.json`**, 1/3 — remplacer (exact) :

````json
    "pourquoi": "Warum dieser Match",
    "colonnes": {
````

par :

````json
    "pourquoi": "Warum dieser Match",
    "criteresSur_one": "{{count}} von {{total}} Kriterien",
    "criteresSur_other": "{{count}} von {{total}} Kriterien",
    "colonnes": {
````

**`src/i18n/locales/de/matching.json`**, 2/3 — remplacer (exact) :

````json
      "raccourci": "Tastenkürzel: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

par :

````json
      "raccourci": "Tastenkürzel: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}",
      "propose": "Vorgeschlagen"
    },
````

**`src/i18n/locales/de/matching.json`**, 3/3 — remplacer (exact) :

````json
      "mandatCourt": "Neues Mandat",
      "mandat": "Neues Mandat vom {{date}}"
    },
````

par :

````json
      "mandatCourt": "Neues Mandat",
      "mandat": "Neues Mandat vom {{date}}",
      "pastille": "Neu"
    },
````

**`src/i18n/locales/it/matching.json`**, 1/3 — remplacer (exact) :

````json
    "pourquoi": "Perché questo match",
    "colonnes": {
````

par :

````json
    "pourquoi": "Perché questo match",
    "criteresSur_one": "{{count}} criterio su {{total}}",
    "criteresSur_other": "{{count}} criteri su {{total}}",
    "colonnes": {
````

**`src/i18n/locales/it/matching.json`**, 2/3 — remplacer (exact) :

````json
      "raccourci": "Scorciatoia: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}"
    },
````

par :

````json
      "raccourci": "Scorciatoia: {{touche}}",
      "infobulle": "{{libelle}} · {{touche}}",
      "propose": "Proposto"
    },
````

**`src/i18n/locales/it/matching.json`**, 3/3 — remplacer (exact) :

````json
      "mandatCourt": "Nuovo mandato",
      "mandat": "Nuovo mandato del {{date}}"
    },
````

par :

````json
      "mandatCourt": "Nuovo mandato",
      "mandat": "Nuovo mandato del {{date}}",
      "pastille": "Nuovo"
    },
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-panneau.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  41 passed (41)`.

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

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 367 passed (370)`, `Tests  1 failed | 5497 passed | 3 skipped (5501)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 7** (« style(matching): le panneau d'un match en carte focus ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C7
```

Attendu : `C7` suivi des huit premiers caractères de l'arbre.


---

## Tâche 3 : La liste « À proposer » allégée — `FilListe`

La liste (conception §4). Deux sous-titres raccourcissent par leurs valeurs — « À ajuster », « Marché » ; « Vos biens » ne change pas. L'en-tête d'un bien ne dit plus que son prix (« N acheteurs » part : ils sont listés dessous) et, pour un mandat neuf ou une annonce nouvelle, la pastille « Nouveau », son libellé long au survol ; une baisse garde sa flèche. La ligne d'une sélection du marché devient « 4 biens · ↓ 1 · ⚡ 1 » : les baisses en flèche, les nouveaux en éclair (`bolt` — la sparkle reste à l'IA), chaque compteur nommé au survol et pour un lecteur d'écran (`Compteur`). Les reportés : une horloge et « 1 reporté » ; la date de retour reste sur chaque ligne dépliée. La ligne d'un acheteur et celle d'une recherche à ajuster ne changent pas. Clés : `fil.selection.biens` entre, `fil.acheteurs` part ; `fil.corrections.section`, `fil.marche` et `fil.reportes` raccourcissent.

**Fichiers :**

- Créer : `tests/unit/fil-liste.spec.tsx`
- Modifier : `src/components/matching-fil/FilListe.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-liste.spec.tsx`** :

````tsx
/**
 * La liste « À proposer » ALLÉGÉE (`FilListe`, conception du fil épuré §4), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · « N acheteurs » sous un bien (ils sont listés dessous), un bien neuf écrit en toutes lettres au lieu de sa
 *     pastille « Nouveau » ;
 *   · une ligne « Marché » écrite en phrase (« 4 biens pas encore proposés · 1 en baisse ») au lieu de son compte et
 *     de ses compteurs — dont le libellé reste au survol et pour un lecteur d'écran ;
 *   · la date de retour sur la ligne des reportés (elle vit dans la liste dépliée) ;
 *   · des sous-titres longs : « À ajuster » et « Marché », lus dans le vrai fichier français.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import FilListe from '@/components/matching-fil/FilListe'
import type { FilBien, FilMatch, FilSelectionResume, FilVue } from '@/components/matching-fil/filModele'
import type { Correction } from '@/components/matching-fil/filApprendre'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const acheteur = (id: string, prenom: string, nom: string): FilMatch['acheteur'] => ({ id, prenom, nom, telephone: null, email: null, kyc: 'none' })
const bien = (id: string, titre: string, prix: number, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces: 5, surface: 150, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo: null, ...champs,
})
const match = (id: string, b: FilBien, a: FilMatch['acheteur'], champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 97, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: b, acheteur: a, ...champs,
})
const JULIE = acheteur('c9', 'Julie', 'Morand')
const ANASTASIA = acheteur('c11', 'Anastasia', 'Volkova')
const EMMA = acheteur('c7', 'Emma', 'Schneider')
const ANTOINE = acheteur('c4', 'Antoine', 'Lefèvre')
/** Un mandat mis en service la veille : le signal « nouveau mandat ». */
const FLORISSANT = bien('p3', 'Attique 5,5 pièces · Florissant', 2_350_000, { mandatLe: '2020-01-14T09:00:00Z' })
const COLOGNY = bien('p6', 'Villa individuelle · Cologny', 3_200_000)
/** Refusé pour le prix à CHF 3'450'000, revenu à CHF 3'200'000. */
const antoine = match('m40', COLOGNY, ANTOINE, {
  suivi: { statut: 'suggested', proposeLe: null, reponduLe: '2020-01-10T10:00:00Z', motif: 'prix', note: null, prixPropose: 3_450_000, apprisLe: null },
})
const VUE: FilVue = {
  groupes: [
    { bien: FLORISSANT, matchs: [match('m22', FLORISSANT, ANASTASIA), match('m23', FLORISSANT, EMMA)] },
    { bien: COLOGNY, matchs: [antoine] },
  ],
  reportes: [match('m50', COLOGNY, JULIE, { reporteJusquau: '2020-01-20T09:00:00Z' })],
  compte: 3,
  ordre: ['bien:p3', 'm22', 'm23', 'bien:p6', 'm40'],
}
const SELECTIONS: FilSelectionResume[] = [
  { acheteur: EMMA, nombre: 4, meilleurScore: 100, vignettes: [], baisses: 1 },
  { acheteur: ANASTASIA, nombre: 2, meilleurScore: 95, vignettes: [], baisses: 1, nouveaux: 1 },
]
const CORRECTION: Correction = {
  cle: 'correction:cs9:prix', rechercheId: 'cs9', acheteur: JULIE, motif: 'prix', refus: [], criteres: {},
  changement: { cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false },
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilListe sp={sp} vue={VUE} selections={SELECTIONS} corrections={[CORRECTION]} courant={null}
      onChoisir={() => {}} onReactiver={() => {}} maintenant={MAINTENANT} />)
  })
}
const texte = (): string => hote!.textContent ?? ''
const ligne = (cle: string): HTMLElement => hote!.querySelector(`[data-match="${cle}"]`) as HTMLElement

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilListe — la liste allégée', () => {
  it('l’en-tête d’un bien : le prix seul, et « Nouveau » en pastille, son libellé au survol', async () => {
    await rendre()
    const entete = ligne('bien:p3')
    expect(entete.textContent).toContain("CHF 2'350'000")
    expect(texte()).not.toContain('fil.acheteurs')
    const pastille = entete.querySelector('[title="fil.signal.mandatCourt"]')
    expect(pastille?.textContent).toBe('fil.signal.pastille')
  })

  it('un bien revenu par une baisse : la flèche, pas la phrase', async () => {
    await rendre()
    expect(ligne('m40').querySelector('[title^="fil.signal.court"]')).not.toBeNull()
    expect(ligne('m40').textContent).not.toContain('fil.ecartSur')
  })

  it('une ligne « Marché » : le nombre de biens, puis ses compteurs — le libellé au survol et pour un lecteur d’écran', async () => {
    await rendre()
    const selection = ligne('marche:c11')
    expect(selection.textContent).toContain('fil.selection.biens {"count":2}')
    expect(selection.textContent).not.toContain('fil.selection.ligne')
    for (const libelle of ['fil.selection.baisses {"count":1}', 'fil.selection.nouveaux {"count":1}']) {
      const compteur = selection.querySelector(`[title='${libelle}']`)
      expect(compteur?.querySelector('.sr-only')?.textContent).toBe(libelle)
    }
  })

  it('les reportés : leur nombre, sans la date de retour, qui vit dans la liste dépliée', async () => {
    await rendre()
    const bouton = [...hote!.querySelectorAll('button[aria-expanded]')].at(-1) as HTMLButtonElement
    expect(bouton.textContent).toBe('fil.reportes {"count":1}')
    expect(texte()).not.toContain('fil.deRetour')
    await act(async () => { bouton.click() })
    expect(texte()).toContain('fil.deRetour {"date":"20.01"}')
  })

  it('les sous-titres en français : « À ajuster », « Marché », et les reportés sans date', () => {
    expect(fr.fil.corrections.section).toBe('À ajuster')
    expect(fr.fil.marche).toBe('Marché')
    expect(fr.fil.reportes_other).toBe('{{count}} reportés')
    expect(fr.fil.selection.biens_other).toBe('{{count}} biens')
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-liste.spec.tsx
```

Attendu : `fil-liste.spec.tsx` : 4 échecs sur 5 — l’en-tête d’un bien, la ligne « Marché » et ses compteurs, les reportés, les sous-titres en français ; seul « un bien revenu par une baisse : la flèche, pas la phrase » passe (la flèche du 01.10.2026).

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilListe.tsx`**, 1/10 — remplacer (exact) :

````tsx
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse porte, à la place de ses écarts, « Prix baissé de
 * … » : c'est ce qui le ramène, donc ce qui le fait proposer (le panneau dit le reste). Le survol des lignes
 * (`.fil-ligne`) est posé par `MatchingFil` (`FilStyleLignes`), commun aux trois onglets.
 */
````

par :

````tsx
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse porte, à la place de ses écarts, la flèche de sa baisse
 * (`FilBaisse`) : c'est ce qui le ramène, donc ce qui le fait proposer (le panneau dit le reste). Le survol des lignes
 * (`.fil-ligne`) est posé par `MatchingFil` (`FilStyleLignes`), commun aux trois onglets.
 *
 * ⚠ Le fil épuré (07.10.2026) : des sous-titres courts (« À ajuster », « Marché »), des compteurs et des icônes au lieu
 * de phrases ; un libellé ôté de l'écran reste au survol et pour un lecteur d'écran.
 */
````

**`src/components/matching-fil/FilListe.tsx`**, 2/10 — remplacer (exact) :

````tsx
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
````

par :

````tsx
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
````

**`src/components/matching-fil/FilListe.tsx`**, 3/10 — remplacer (exact) :

````tsx
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const prochainRetour = vue.reportes[0]?.reporteJusquau ?? null
  const titreSection = { margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
````

par :

````tsx
  const [reportesOuverts, setReportesOuverts] = useState(false)
  const titreSection = { margin: 0, padding: 'var(--crm-space-sm) var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', color: sp.sub }
````

**`src/components/matching-fil/FilListe.tsx`**, 4/10 — remplacer (exact) :

````tsx
      )}
      {vue.reportes.length > 0 && prochainRetour && (
        <div style={{ marginTop: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)', borderTop: `1px solid ${sp.cardBorder}` }}>
````

par :

````tsx
      )}
      {vue.reportes.length > 0 && (
        <div style={{ marginTop: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-md)', borderTop: `1px solid ${sp.cardBorder}` }}>
````

**`src/components/matching-fil/FilListe.tsx`**, 5/10 — remplacer (exact) :

````tsx
          }}>
            <MEIcon name={reportesOuverts ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
            {t('fil.reportes', { count: vue.reportes.length, date: dateCourte(prochainRetour) })}
          </button>
````

par :

````tsx
          }}>
            <MEIcon name="clock" size={14} color={sp.sub} />
            {t('fil.reportes', { count: vue.reportes.length })}
            <MEIcon name={reportesOuverts ? 'chevron-up' : 'chevron-down'} size={14} color={sp.sub} />
          </button>
````

**`src/components/matching-fil/FilListe.tsx`**, 6/10 — remplacer (exact) :

````tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {[
            t('fil.selection.ligne', { count: s.nombre }),
            s.baisses ? t('fil.selection.baisses', { count: s.baisses }) : null,
            s.nouveaux ? t('fil.selection.nouveaux', { count: s.nouveaux }) : null,
          ].filter(Boolean).join(' · ')}
        </span>
````

par :

````tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {t('fil.selection.biens', { count: s.nombre })}
          {s.baisses ? <> · <Compteur sp={sp} icone="arrow-down" nombre={s.baisses} libelle={t('fil.selection.baisses', { count: s.baisses })} /></> : null}
          {s.nouveaux ? <> · <Compteur sp={sp} icone="bolt" nombre={s.nouveaux} libelle={t('fil.selection.nouveaux', { count: s.nouveaux })} /></> : null}
        </span>
````

**`src/components/matching-fil/FilListe.tsx`**, 7/10 — remplacer (exact) :

````tsx
  const baisse = signal ? baisseDuBien(signal, bien, t) : null
  return (
````

par :

````tsx
  const baisse = signal ? baisseDuBien(signal, bien, t) : null
  const nouveau = signal && !baisse ? texteSignalBien(signal, bien, t, true) : null
  return (
````

**`src/components/matching-fil/FilListe.tsx`**, 8/10 — remplacer (exact) :

````tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* La forme COURTE sur la ligne (« Nouveau mandat », une baisse en flèche) ; la date est dans le panneau. */}
          {[prixBien(bien, t), t('fil.acheteurs', { count: nombre }), signal && !baisse ? texteSignalBien(signal, bien, t, true) : null].filter(Boolean).join(' · ')}
          {baisse && <> · <FilBaisse sp={sp} montant={baisse} /></>}
````

par :

````tsx
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* Le prix seul : ses acheteurs sont listés dessous. Une baisse en flèche ; sa date est dans le panneau. */}
          {prixBien(bien, t)}
          {baisse && <> · <FilBaisse sp={sp} montant={baisse} /></>}
````

**`src/components/matching-fil/FilListe.tsx`**, 9/10 — remplacer (exact) :

````tsx
      </span>
      {/* ⚠ L'invite ne s'écrit que sur l'en-tête CHOISI : écrite sur chacun, elle coupait le sous-titre, et avec lui le
````

par :

````tsx
      </span>
      {/* Un bien neuf (un mandat, une annonce) : la pastille « Nouveau », son libellé au survol. */}
      {nouveau && (
        <span title={nouveau} style={{
          flex: 'none', padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
          fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.ink,
        }}>
          {t('fil.signal.pastille')}
        </span>
      )}
      {/* ⚠ L'invite ne s'écrit que sur l'en-tête CHOISI : écrite sur chacun, elle coupait le sous-titre, et avec lui le
````

**`src/components/matching-fil/FilListe.tsx`**, 10/10 — remplacer (exact) :

````tsx
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </button>
  )
}
````

par :

````tsx
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
    </button>
  )
}

/** Un compteur d'une ligne « Marché » : l'icône et le nombre ; son libellé au survol et pour un lecteur d'écran. */
function Compteur({ sp, icone, nombre, libelle }: { sp: CrmPalette; icone: MEIconName; nombre: number; libelle: string }) {
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', verticalAlign: 'middle' }}>
      <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name={icone} size={12} color={sp.sub} /></span>
      <span aria-hidden>{nombre}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}
````

**`src/i18n/locales/fr/matching.json`**, 1/5 — remplacer (exact) :

````json
    "listeAria": "Matchs à proposer",
    "acheteurs_one": "{{count}} acheteur",
    "acheteurs_other": "{{count}} acheteurs",
    "ecartSur": "{{critere}} à vérifier",
````

par :

````json
    "listeAria": "Matchs à proposer",
    "ecartSur": "{{critere}} à vérifier",
````

**`src/i18n/locales/fr/matching.json`**, 2/5 — remplacer (exact) :

````json
    "sansCriteres": "Aucun critère détaillé",
    "reportes_one": "{{count}} reporté · de retour dès le {{date}}",
    "reportes_other": "{{count}} reportés · de retour dès le {{date}}",
    "deRetour": "de retour le {{date}}",
````

par :

````json
    "sansCriteres": "Aucun critère détaillé",
    "reportes_one": "{{count}} reporté",
    "reportes_other": "{{count}} reportés",
    "deRetour": "de retour le {{date}}",
````

**`src/i18n/locales/fr/matching.json`**, 3/5 — remplacer (exact) :

````json
    "reessayer": "Réessayer",
    "marche": "Marché · une sélection par acheteur",
    "marcheAria": "Sélections du marché",
````

par :

````json
    "reessayer": "Réessayer",
    "marche": "Marché",
    "marcheAria": "Sélections du marché",
````

**`src/i18n/locales/fr/matching.json`**, 4/5 — remplacer (exact) :

````json
      "ligne_other": "{{count}} biens pas encore proposés",
      "titreAria": "Sélection du marché pour {{nom}}",
````

par :

````json
      "ligne_other": "{{count}} biens pas encore proposés",
      "biens_one": "{{count}} bien",
      "biens_other": "{{count}} biens",
      "titreAria": "Sélection du marché pour {{nom}}",
````

**`src/i18n/locales/fr/matching.json`**, 5/5 — remplacer (exact) :

````json
    "corrections": {
      "section": "Recherches à ajuster",
      "listeAria": "Corrections de recherche proposées",
````

par :

````json
    "corrections": {
      "section": "À ajuster",
      "listeAria": "Corrections de recherche proposées",
````

**`src/i18n/locales/en/matching.json`**, 1/5 — remplacer (exact) :

````json
    "listeAria": "Matches to propose",
    "acheteurs_one": "{{count}} buyer",
    "acheteurs_other": "{{count}} buyers",
    "ecartSur": "{{critere}} to check",
````

par :

````json
    "listeAria": "Matches to propose",
    "ecartSur": "{{critere}} to check",
````

**`src/i18n/locales/en/matching.json`**, 2/5 — remplacer (exact) :

````json
    "sansCriteres": "No detailed criteria",
    "reportes_one": "{{count}} postponed · back from {{date}}",
    "reportes_other": "{{count}} postponed · back from {{date}}",
    "deRetour": "back on {{date}}",
````

par :

````json
    "sansCriteres": "No detailed criteria",
    "reportes_one": "{{count}} postponed",
    "reportes_other": "{{count}} postponed",
    "deRetour": "back on {{date}}",
````

**`src/i18n/locales/en/matching.json`**, 3/5 — remplacer (exact) :

````json
    "reessayer": "Try again",
    "marche": "Market · one selection per buyer",
    "marcheAria": "Market selections",
````

par :

````json
    "reessayer": "Try again",
    "marche": "Market",
    "marcheAria": "Market selections",
````

**`src/i18n/locales/en/matching.json`**, 4/5 — remplacer (exact) :

````json
      "ligne_other": "{{count}} properties not yet proposed",
      "titreAria": "Market selection for {{nom}}",
````

par :

````json
      "ligne_other": "{{count}} properties not yet proposed",
      "biens_one": "{{count}} property",
      "biens_other": "{{count}} properties",
      "titreAria": "Market selection for {{nom}}",
````

**`src/i18n/locales/en/matching.json`**, 5/5 — remplacer (exact) :

````json
    "corrections": {
      "section": "Searches to adjust",
      "listeAria": "Proposed search corrections",
````

par :

````json
    "corrections": {
      "section": "To adjust",
      "listeAria": "Proposed search corrections",
````

**`src/i18n/locales/de/matching.json`**, 1/5 — remplacer (exact) :

````json
    "listeAria": "Vorzuschlagende Matches",
    "acheteurs_one": "{{count}} Käufer",
    "acheteurs_other": "{{count}} Käufer",
    "ecartSur": "{{critere}} prüfen",
````

par :

````json
    "listeAria": "Vorzuschlagende Matches",
    "ecartSur": "{{critere}} prüfen",
````

**`src/i18n/locales/de/matching.json`**, 2/5 — remplacer (exact) :

````json
    "sansCriteres": "Keine detaillierten Kriterien",
    "reportes_one": "{{count}} zurückgestellt · zurück ab {{date}}",
    "reportes_other": "{{count}} zurückgestellt · zurück ab {{date}}",
    "deRetour": "zurück am {{date}}",
````

par :

````json
    "sansCriteres": "Keine detaillierten Kriterien",
    "reportes_one": "{{count}} zurückgestellt",
    "reportes_other": "{{count}} zurückgestellt",
    "deRetour": "zurück am {{date}}",
````

**`src/i18n/locales/de/matching.json`**, 3/5 — remplacer (exact) :

````json
    "reessayer": "Erneut versuchen",
    "marche": "Markt · eine Auswahl pro Käufer",
    "marcheAria": "Markt-Auswahlen",
````

par :

````json
    "reessayer": "Erneut versuchen",
    "marche": "Markt",
    "marcheAria": "Markt-Auswahlen",
````

**`src/i18n/locales/de/matching.json`**, 4/5 — remplacer (exact) :

````json
      "ligne_other": "{{count}} Objekte noch nicht vorgeschlagen",
      "titreAria": "Markt-Auswahl für {{nom}}",
````

par :

````json
      "ligne_other": "{{count}} Objekte noch nicht vorgeschlagen",
      "biens_one": "{{count}} Objekt",
      "biens_other": "{{count}} Objekte",
      "titreAria": "Markt-Auswahl für {{nom}}",
````

**`src/i18n/locales/de/matching.json`**, 5/5 — remplacer (exact) :

````json
    "corrections": {
      "section": "Anzupassende Suchen",
      "listeAria": "Vorgeschlagene Suchkorrekturen",
````

par :

````json
    "corrections": {
      "section": "Anzupassen",
      "listeAria": "Vorgeschlagene Suchkorrekturen",
````

**`src/i18n/locales/it/matching.json`**, 1/5 — remplacer (exact) :

````json
    "listeAria": "Match da proporre",
    "acheteurs_one": "{{count}} acquirente",
    "acheteurs_other": "{{count}} acquirenti",
    "ecartSur": "{{critere}} da verificare",
````

par :

````json
    "listeAria": "Match da proporre",
    "ecartSur": "{{critere}} da verificare",
````

**`src/i18n/locales/it/matching.json`**, 2/5 — remplacer (exact) :

````json
    "sansCriteres": "Nessun criterio dettagliato",
    "reportes_one": "{{count}} rinviato · di ritorno dal {{date}}",
    "reportes_other": "{{count}} rinviati · di ritorno dal {{date}}",
    "deRetour": "di ritorno il {{date}}",
````

par :

````json
    "sansCriteres": "Nessun criterio dettagliato",
    "reportes_one": "{{count}} rinviato",
    "reportes_other": "{{count}} rinviati",
    "deRetour": "di ritorno il {{date}}",
````

**`src/i18n/locales/it/matching.json`**, 3/5 — remplacer (exact) :

````json
    "reessayer": "Riprova",
    "marche": "Mercato · una selezione per acquirente",
    "marcheAria": "Selezioni del mercato",
````

par :

````json
    "reessayer": "Riprova",
    "marche": "Mercato",
    "marcheAria": "Selezioni del mercato",
````

**`src/i18n/locales/it/matching.json`**, 4/5 — remplacer (exact) :

````json
      "ligne_other": "{{count}} immobili non ancora proposti",
      "titreAria": "Selezione del mercato per {{nom}}",
````

par :

````json
      "ligne_other": "{{count}} immobili non ancora proposti",
      "biens_one": "{{count}} immobile",
      "biens_other": "{{count}} immobili",
      "titreAria": "Selezione del mercato per {{nom}}",
````

**`src/i18n/locales/it/matching.json`**, 5/5 — remplacer (exact) :

````json
    "corrections": {
      "section": "Ricerche da adattare",
      "listeAria": "Correzioni di ricerca proposte",
````

par :

````json
    "corrections": {
      "section": "Da adattare",
      "listeAria": "Correzioni di ricerca proposte",
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-liste.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  40 passed (40)`.

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

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 368 passed (371)`, `Tests  1 failed | 5502 passed | 3 skipped (5506)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 8** (« style(matching): la liste « À proposer » allégée ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C8
```

Attendu : `C8` suivi des huit premiers caractères de l'arbre.


---

## Tâche 4 : « À ajuster » — `FilCorrection`

La recherche à ajuster (conception §5), réécrite en entier. L'en-tête : le nom et la pastille « Prix · 2 refus » (la clé de la ligne de la liste, `fil.corrections.ligne`), au lieu de « Refusé 2 fois pour « Prix » » ; « Recherche : … » part. Les biens refusés : vignette, titre, « CHF … · 30.09 » — le prix proposé, la date du refus — et la note de l'acheteur s'il en a laissé une ; pièces, surface et ville partent, et « Les biens refusés » ne s'écrit plus : il nomme la liste pour un lecteur d'écran. La correction se lit avant → après : un nombre, l'ancienne valeur barrée devant son champ, sous un libellé court (« Budget max », « Surface min », « Pièces min ») — « aujourd'hui : … » reste pour un lecteur d'écran, et le message d'une saisie refusée se voit ; les quartiers et le type, l'ancien barré, une flèche, le nouveau ; les équipements, « + … ». « La correction proposée » nomme le groupe. Le bouton principal dit « Ajuster ». Clés : deux entrent (`sansMaxCourt`, `sansMinCourt`), huit valeurs raccourcissent, quatre clés partent (`sousTitre`, `refuseLe`, `zonesApres`, `typeAvant`).

**Fichiers :**

- Créer : `tests/unit/fil-correction.spec.tsx`
- Réécrire en entier : `src/components/matching-fil/FilCorrection.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-correction.spec.tsx`** :

````tsx
/**
 * La recherche à ajuster ALLÉGÉE (`FilCorrection`, conception du fil épuré §5), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · une phrase que la conception retire : « Refusé 2 fois pour … », « Recherche : … », les titres « Les biens
 *     refusés » et « La correction proposée » (ils restent des noms ACCESSIBLES), « refusé le », pièces, surface et ville
 *     d'un bien refusé ;
 *   · une correction qui ne se lirait pas avant → après : l'ancienne valeur barrée, la nouvelle dans son champ ;
 *   · « aujourd'hui : … » perdu pour un lecteur d'écran, ou écrit à l'écran quand la saisie est valide ;
 *   · une saisie refusée qui ne dirait pas pourquoi.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'fr' },
  }),
}))

import FilCorrection from '@/components/matching-fil/FilCorrection'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import type { Correction } from '@/components/matching-fil/filApprendre'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'

const sp = crmPalette(false)
const JULIE: FilMatch['acheteur'] = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' }
const bien = (id: string, titre: string, prix: number, pieces: number, surface: number): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces, surface, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo: null,
})
const refus = (id: string, b: FilBien, le: string, note: string | null): FilMatch => ({
  id, score: 97, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: b, acheteur: JULIE,
  suivi: { statut: 'rejected', proposeLe: null, reponduLe: le, motif: 'prix', note, prixPropose: b.prix, apprisLe: null },
})
const correction = (changement: Correction['changement']): Correction => ({
  cle: 'correction:cs9:prix', rechercheId: 'cs9', acheteur: JULIE, motif: 'prix',
  refus: [
    refus('m14', bien('ml2', 'Appartement 5 pièces · Servette', 1_560_000, 5, 118), '2020-09-30T10:00:00Z', null),
    refus('m16', bien('ml5', 'Attique 4,5 pièces · Malagnou', 1_580_000, 4.5, 112), '2020-09-23T10:00:00Z', 'Au-dessus de ce que sa banque suit.'),
  ],
  criteres: { transaction_type: 'buy', budget_min: 1_300_000, budget_max: 1_600_000 },
  changement,
})
const BUDGET = correction({ cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false })

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(c: Correction): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilCorrection sp={sp} correction={c} occupe={false} onAjuster={() => {}} onIgnorer={() => {}} onVoirContact={() => {}} />)
  })
}
const texte = (): string => hote!.textContent ?? ''
const visible = (): string => {
  const copie = hote!.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilCorrection — la recherche à ajuster allégée', () => {
  it('le motif en pastille ; ni « Refusé 2 fois pour … », ni « Recherche : … », ni titres', async () => {
    await rendre(BUDGET)
    expect(texte()).toContain('fil.corrections.ligne {"motif":"fil.motifs.prix","count":2}')
    for (const retire of ['fil.corrections.sousTitre', 'fil.selection.recherche']) expect(texte()).not.toContain(retire)
    expect(hote!.querySelector('h3')).toBeNull()
    expect(hote!.querySelector('ul[aria-label="fil.corrections.pourquoi"]')).not.toBeNull()
    expect(hote!.querySelector('[role="group"][aria-label="fil.corrections.proposition"]')).not.toBeNull()
  })

  it('un bien refusé : son prix et sa date, la note de l’acheteur ; ni pièces, ni surface, ni ville, ni « refusé le »', async () => {
    await rendre(BUDGET)
    expect(texte()).toContain("CHF 1'560'000 · 30.09")
    expect(texte()).toContain('Au-dessus de ce que sa banque suit.')
    for (const retire of ['fil.selection.pieces', 'fil.valeurs.m2', 'Genève', 'fil.corrections.refuseLe']) expect(texte()).not.toContain(retire)
  })

  it('le budget se lit avant → après : l’ancien barré, le nouveau dans son champ ; « aujourd’hui » pour un lecteur d’écran', async () => {
    await rendre(BUDGET)
    expect(visible()).toContain("CHF 1'600'000")
    expect((hote!.querySelector('input') as HTMLInputElement).value).toBe("1'550'000")
    const aide = hote!.querySelector('[id]:not(input).sr-only')
    expect(aide?.textContent).toBe('fil.corrections.avant {"valeur":"CHF 1\'600\'000"}')
    expect(visible()).not.toContain('fil.corrections.avant')
  })

  it('une saisie refusée dit pourquoi, à l’écran', async () => {
    await rendre(BUDGET)
    const champ = hote!.querySelector('input') as HTMLInputElement
    const fixer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      fixer.call(champ, 'abc')
      champ.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(visible()).toContain('fil.corrections.valeurInvalide')
  })

  it('des zones retirées : celles qui partent, barrées, puis celles qui restent', async () => {
    await rendre(correction({ cle: 'zones', retirees: ['Champel'], apres: ['Genève', 'GE'] }))
    expect(hote!.querySelector('s')?.textContent).toBe('Champel')
    expect(texte()).toContain('Genève, GE')
  })

  it('en français : des libellés courts, et « Ajuster »', () => {
    expect(fr.fil.corrections.budget).toBe('Budget max')
    expect(fr.fil.corrections.zones).toBe('Quartiers')
    expect(fr.fil.corrections.valider).toBe('Ajuster')
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-correction.spec.tsx
```

Attendu : `fil-correction.spec.tsx` : 5 échecs sur 6 — le motif en pastille, un bien refusé, le budget avant → après, les zones retirées, les libellés en français ; seul « une saisie refusée dit pourquoi, à l’écran » passe.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilCorrection.tsx`** — réécrire le fichier ENTIER (Write) : presque chaque ligne change. Son empreinte avant d'écrire : `d6a747b5082f1e01858f21663fa8ca44b72d17d2da0fca03caa6f53237f705cd` (`shasum -a 256 src/components/matching-fil/FilCorrection.tsx`) ; toute autre empreinte : s'arrêter.

````tsx
/**
 * « Apprendre » (conception de la boucle, §4.6) : au deuxième refus pour un même motif, la correction
 * CHIFFRÉE de la recherche de l'acheteur. L'agent la valide en un geste, la modifie d'abord (budget,
 * surface, pièces : un nombre pré-rempli), ou l'ignore.
 *
 * ⚠ Le fil épuré (07.10.2026) : le motif en pastille, les biens refusés à leur prix et leur date, la correction lue
 * AVANT → APRÈS — l'ancienne valeur barrée, la nouvelle dans son champ. « aujourd'hui : … » reste pour un lecteur
 * d'écran.
 *
 * ⚠ Valider renote les biens à proposer de CETTE recherche par le vrai moteur (`matching-engine`, mode
 * `rescore-search`) : ceux qui passent sous le seuil sortent du fil, écartés « recherche ajustée ». Pas de
 * fenêtre d'annulation — un bouton, jamais une touche. Seule la clé corrigée part (`onAjuster`) : le serveur
 * la fusionne dans les critères d'aujourd'hui, pas dans ceux que cet écran a lus.
 *
 * ⚠ Une saisie qui passerait sa borne (un budget maximum sous le minimum) est refusée, et l'écran dit
 * laquelle (`saisieRefusee`).
 *
 * ⚠ Les biens refusés sont montrés au prix où ils ont été PROPOSÉS : c'est à ce prix que l'acheteur a dit non.
 */
import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import { formatCHF } from '@/lib/utils'
import { cleEquipement, initiales } from './filModele'
import {
  estNumerique, saisieRefusee, type ChangementNumerique, type Correction, type CorrectionChangement, type SaisieRefusee,
} from './filApprendre'
import { dateCourte, MARGE_POINTS, montant, teinteEcart } from './filAffichage'
import { FilAvatar, FilBouton, FilVignette } from './filAtomes'

interface Props {
  sp: CrmPalette
  correction: Correction
  /** La correction part : les deux gestes se grisent. */
  occupe: boolean
  /** La correction validée : sa seule clé, et la valeur saisie. */
  onAjuster: (changement: CorrectionChangement) => void
  onIgnorer: () => void
  onVoirContact: () => void
}

export default function FilCorrection({ sp, correction: c, occupe, onAjuster, onIgnorer, onVoirContact }: Props) {
  const { t, i18n } = useTranslation('matching')
  const nombre = (n: number): string => n.toLocaleString(i18n.language)
  const champId = useId()
  const aideId = useId()
  const ch = c.changement
  // Pré-rempli comme on le lit : « 1'550'000 » (l'apostrophe de `formatCHF`, sans l'unité), « 4.5 ».
  const [saisie, setSaisie] = useState(() => (!estNumerique(ch) ? ''
    : ch.cle === 'rooms_min' ? String(ch.apres) : formatCHF(ch.apres).replace(/^CHF /, '')))
  // « 1'550'000 », « 1 550 000 » ou « 4,5 » se lisent : l'agent tape comme il lit.
  const valeur = Number(saisie.replace(/['’\s]/g, '').replace(',', '.'))
  const erreurSaisie = estNumerique(ch) ? saisieRefusee(c.criteres, ch, valeur) : null
  const valide = erreurSaisie == null
  const changement: CorrectionChangement = estNumerique(ch) && valide ? { ...ch, apres: valeur } : ch
  const { acheteur } = c
  const nomType = (type: string): string => t(`fil.types.${type}`, { defaultValue: type })
  // Même libellé que la grille « Recherché / Ce bien » (`valeursCritere`) : sans le préfixe `custom:`.
  const nomEquipement = (f: string): string =>
    t(`fil.equipementsNoms.${cleEquipement(f)}`, { defaultValue: f.replace(/^custom:/i, '') })
  // La valeur d'aujourd'hui, barrée devant la saisie : un montant, des m², des pièces, ou l'absence de borne.
  const valeurAvant = (n: ChangementNumerique): string => {
    const v = n.avant
    if (v == null) return t(n.cle === 'budget_max' ? 'fil.corrections.sansMaxCourt' : 'fil.corrections.sansMinCourt')
    return n.cle === 'budget_max' ? montant(n.location, v, t)
      : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(v) })
        : nombre(v)
  }
  // La même, dite à un lecteur d'écran : « aujourd'hui : CHF 1'600'000 ».
  const avant = (n: ChangementNumerique): string => (n.avant == null
    ? t(n.cle === 'budget_max' ? 'fil.corrections.sansMax' : 'fil.corrections.sansMin')
    : t('fil.corrections.avant', { valeur: valeurAvant(n) }))
  // La borne dite dans l'unité de la saisie : un montant, des m², des pièces.
  const refusLisible = (n: ChangementNumerique, r: SaisieRefusee): string => {
    if (r.raison === 'nombre') return t('fil.corrections.valeurInvalide')
    const borne = n.cle === 'budget_max' ? montant(n.location, r.borne, t)
      : n.cle === 'surface_min' ? t('fil.valeurs.m2', { valeur: nombre(r.borne) })
        : nombre(r.borne)
    return t(r.raison === 'sousMinimum' ? 'fil.corrections.sousMinimum' : 'fil.corrections.auDelaMaximum', { valeur: borne })
  }
  const lien: CSSProperties = { border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 600 }
  const libelle: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }
  const texte: CSSProperties = { fontSize: 'var(--crm-text-md)', color: sp.ink }
  const barre: CSSProperties = { fontSize: 'var(--crm-text-md)', color: sp.sub, textDecoration: 'line-through' }
  const ligne: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }
  const fleche = <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name="arrow-right" size={14} color={sp.sub} /></span>
  return (
    <section aria-label={t('fil.corrections.titreAria', { nom: `${acheteur.prenom} ${acheteur.nom}` })}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)',
        padding: `var(--crm-space-6xl) ${MARGE_POINTS} var(--crm-space-6xl) var(--crm-space-6xl)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <span style={{
            marginLeft: 'auto', flex: 'none', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-sm)', color: sp.ink,
          }}>
            {t('fil.corrections.ligne', { motif: t(`fil.motifs.${c.motif}`), count: c.refus.length })}
          </span>
        </div>

        <ul aria-label={t('fil.corrections.pourquoi')} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {c.refus.map((m) => {
            const prix = m.suivi?.prixPropose ?? m.bien.prix
            const refuse = m.suivi?.reponduLe
            const details = [prix != null ? montant(m.bien.location, prix, t) : null, refuse ? dateCourte(refuse) : null].filter(Boolean).join(' · ')
            return (
              <li key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-md)',
                borderRadius: 'var(--crm-radius-lg)', background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
              }}>
                <FilVignette sp={sp} photo={m.bien.photo} largeur={56} hauteur={42} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.bien.titre}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
                  {m.suivi?.note && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontStyle: 'italic', color: sp.ink }}>{m.suivi.note}</span>}
                </span>
              </li>
            )
          })}
        </ul>

        <div role="group" aria-label={t('fil.corrections.proposition')} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          {estNumerique(ch) ? (
            <>
              <label htmlFor={champId} style={libelle}>
                {t(ch.cle === 'budget_max' ? 'fil.corrections.budget' : ch.cle === 'surface_min' ? 'fil.corrections.surface' : 'fil.corrections.pieces')}
              </label>
              <div style={ligne}>
                <span aria-hidden style={barre}>{valeurAvant(ch)}</span>
                {fleche}
                <input id={champId} inputMode="decimal" value={saisie} onChange={(e) => setSaisie(e.target.value)}
                  aria-invalid={!valide} aria-describedby={aideId} style={{
                    width: 200, height: 36, border: `1px solid ${valide ? sp.cardBorder : teinteEcart(sp)}`,
                    borderRadius: 'var(--crm-radius-md)', background: sp.cardBg, color: sp.ink, fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-md)', paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
                  }} />
              </div>
              {/* Valide, l'ancienne valeur se lit barrée : la phrase ne reste que pour un lecteur d'écran. */}
              <span id={aideId} className={erreurSaisie ? undefined : 'sr-only'} style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
                {erreurSaisie ? refusLisible(ch, erreurSaisie) : avant(ch)}
              </span>
            </>
          ) : ch.cle === 'zones' ? (
            <>
              <p style={libelle}>{t('fil.corrections.zones')}</p>
              <div style={ligne}><s style={barre}>{ch.retirees.join(', ')}</s>{fleche}<span style={texte}>{ch.apres.join(', ')}</span></div>
            </>
          ) : ch.cle === 'type' ? (
            <>
              <p style={libelle}>{t('fil.corrections.type')}</p>
              <div style={ligne}>
                <s style={barre}>{ch.avant ? nomType(ch.avant) : t('fil.corrections.tousTypes')}</s>{fleche}<span style={texte}>{nomType(ch.apres)}</span>
              </div>
            </>
          ) : (
            <>
              <p style={libelle}>{t('fil.corrections.equipements')}</p>
              <span style={texte}>+ {ch.ajoutes.map(nomEquipement).join(', ')}</span>
            </>
          )}
        </div>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: `var(--crm-space-2xl) ${MARGE_POINTS} var(--crm-space-2xl) var(--crm-space-6xl)`,
        background: sp.frameBg, borderTop: `1px solid ${sp.cardBorder}`,
      }}>
        <FilBouton sp={sp} onClick={onIgnorer} desactive={occupe}>{t('fil.corrections.ignorer')}</FilBouton>
        <span style={{ flex: 1 }} />
        <FilBouton sp={sp} principal onClick={() => onAjuster(changement)} desactive={!valide || occupe}>
          {t('fil.corrections.valider')}
        </FilBouton>
      </div>
    </section>
  )
}
````

**`src/i18n/locales/fr/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titreAria": "Recherche à ajuster pour {{nom}}",
      "sousTitre_one": "Refusé {{count}} fois pour « {{motif}} »",
      "sousTitre_other": "Refusé {{count}} fois pour « {{motif}} »",
      "pourquoi": "Les biens refusés",
      "refuseLe": "refusé le {{date}}",
      "proposition": "La correction proposée",
      "budget": "Abaisser son budget maximum à (CHF)",
      "surface": "Relever sa surface minimum à (m²)",
      "pieces": "Relever son minimum de pièces à",
      "avant": "aujourd'hui : {{valeur}}",
````

par :

````json
      "titreAria": "Recherche à ajuster pour {{nom}}",
      "pourquoi": "Les biens refusés",
      "proposition": "La correction proposée",
      "budget": "Budget max",
      "surface": "Surface min",
      "pieces": "Pièces min",
      "avant": "aujourd'hui : {{valeur}}",
````

**`src/i18n/locales/fr/matching.json`**, 2/2 — remplacer (exact) :

````json
      "sansMin": "aujourd'hui : sans minimum",
      "zones": "Retirer de ses zones : {{liste}}",
      "zonesApres": "Ses zones deviennent : {{liste}}",
      "type": "Ne lui proposer que : {{type}}",
      "typeAvant": "aujourd'hui : {{type}}",
      "tousTypes": "aujourd'hui : tous les types",
      "equipements": "Ajouter à ses équipements voulus : {{liste}}",
      "valider": "Ajuster la recherche",
      "ignorer": "Ignorer",
````

par :

````json
      "sansMin": "aujourd'hui : sans minimum",
      "sansMaxCourt": "Sans maximum",
      "sansMinCourt": "Sans minimum",
      "zones": "Quartiers",
      "type": "Type",
      "tousTypes": "Tous les types",
      "equipements": "Équipements",
      "valider": "Ajuster",
      "ignorer": "Ignorer",
````

**`src/i18n/locales/en/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titreAria": "Search to adjust for {{nom}}",
      "sousTitre_one": "Declined {{count}} time for “{{motif}}”",
      "sousTitre_other": "Declined {{count}} times for “{{motif}}”",
      "pourquoi": "Declined properties",
      "refuseLe": "declined on {{date}}",
      "proposition": "Proposed correction",
      "budget": "Lower the maximum budget to (CHF)",
      "surface": "Raise the minimum floor area to (m²)",
      "pieces": "Raise the minimum number of rooms to",
      "avant": "currently: {{valeur}}",
````

par :

````json
      "titreAria": "Search to adjust for {{nom}}",
      "pourquoi": "Declined properties",
      "proposition": "Proposed correction",
      "budget": "Max budget",
      "surface": "Min surface",
      "pieces": "Min rooms",
      "avant": "currently: {{valeur}}",
````

**`src/i18n/locales/en/matching.json`**, 2/2 — remplacer (exact) :

````json
      "sansMin": "currently: no minimum",
      "zones": "Remove from the areas: {{liste}}",
      "zonesApres": "New areas: {{liste}}",
      "type": "Only propose: {{type}}",
      "typeAvant": "currently: {{type}}",
      "tousTypes": "currently: all types",
      "equipements": "Add to the wanted features: {{liste}}",
      "valider": "Adjust the search",
      "ignorer": "Ignore",
````

par :

````json
      "sansMin": "currently: no minimum",
      "sansMaxCourt": "No maximum",
      "sansMinCourt": "No minimum",
      "zones": "Areas",
      "type": "Type",
      "tousTypes": "All types",
      "equipements": "Features",
      "valider": "Adjust",
      "ignorer": "Ignore",
````

**`src/i18n/locales/de/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titreAria": "Anzupassende Suche von {{nom}}",
      "sousTitre_one": "{{count}}-mal abgelehnt wegen „{{motif}}“",
      "sousTitre_other": "{{count}}-mal abgelehnt wegen „{{motif}}“",
      "pourquoi": "Abgelehnte Objekte",
      "refuseLe": "abgelehnt am {{date}}",
      "proposition": "Vorgeschlagene Korrektur",
      "budget": "Maximalbudget senken auf (CHF)",
      "surface": "Mindestfläche erhöhen auf (m²)",
      "pieces": "Mindestzimmerzahl erhöhen auf",
      "avant": "heute: {{valeur}}",
````

par :

````json
      "titreAria": "Anzupassende Suche von {{nom}}",
      "pourquoi": "Abgelehnte Objekte",
      "proposition": "Vorgeschlagene Korrektur",
      "budget": "Max. Budget",
      "surface": "Min. Fläche",
      "pieces": "Min. Zimmer",
      "avant": "heute: {{valeur}}",
````

**`src/i18n/locales/de/matching.json`**, 2/2 — remplacer (exact) :

````json
      "sansMin": "heute: ohne Minimum",
      "zones": "Aus den Gebieten entfernen: {{liste}}",
      "zonesApres": "Neue Gebiete: {{liste}}",
      "type": "Nur noch vorschlagen: {{type}}",
      "typeAvant": "heute: {{type}}",
      "tousTypes": "heute: alle Objektarten",
      "equipements": "Zur gewünschten Ausstattung hinzufügen: {{liste}}",
      "valider": "Suche anpassen",
      "ignorer": "Ignorieren",
````

par :

````json
      "sansMin": "heute: ohne Minimum",
      "sansMaxCourt": "Ohne Maximum",
      "sansMinCourt": "Ohne Minimum",
      "zones": "Gegenden",
      "type": "Typ",
      "tousTypes": "Alle Objektarten",
      "equipements": "Ausstattung",
      "valider": "Anpassen",
      "ignorer": "Ignorieren",
````

**`src/i18n/locales/it/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titreAria": "Ricerca da adattare per {{nom}}",
      "sousTitre_one": "Rifiutato {{count}} volta per «{{motif}}»",
      "sousTitre_other": "Rifiutato {{count}} volte per «{{motif}}»",
      "pourquoi": "Immobili rifiutati",
      "refuseLe": "rifiutato il {{date}}",
      "proposition": "Correzione proposta",
      "budget": "Ridurre il budget massimo a (CHF)",
      "surface": "Aumentare la superficie minima a (m²)",
      "pieces": "Aumentare il numero minimo di locali a",
      "avant": "oggi: {{valeur}}",
````

par :

````json
      "titreAria": "Ricerca da adattare per {{nom}}",
      "pourquoi": "Immobili rifiutati",
      "proposition": "Correzione proposta",
      "budget": "Budget max",
      "surface": "Superficie min",
      "pieces": "Locali min",
      "avant": "oggi: {{valeur}}",
````

**`src/i18n/locales/it/matching.json`**, 2/2 — remplacer (exact) :

````json
      "sansMin": "oggi: senza minimo",
      "zones": "Togliere dalle zone: {{liste}}",
      "zonesApres": "Nuove zone: {{liste}}",
      "type": "Proporre solo: {{type}}",
      "typeAvant": "oggi: {{type}}",
      "tousTypes": "oggi: tutti i tipi",
      "equipements": "Aggiungere alle dotazioni desiderate: {{liste}}",
      "valider": "Adatta la ricerca",
      "ignorer": "Ignora",
````

par :

````json
      "sansMin": "oggi: senza minimo",
      "sansMaxCourt": "Senza massimo",
      "sansMinCourt": "Senza minimo",
      "zones": "Zone",
      "type": "Tipo",
      "tousTypes": "Tutti i tipi",
      "equipements": "Dotazioni",
      "valider": "Adatta",
      "ignorer": "Ignora",
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-correction.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  41 passed (41)`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/components/matching-fil/FilCorrection.tsx tests/unit/fil-correction.spec.tsx --quiet
```

Attendu : sortie 0, aucun message.


---

## Tâche 5 : « En attente » — `FilRetours`

Les retours d'un acheteur (conception §6). L'en-tête : le nom, et la pastille « Relance » — l'alerte ambre, la date due au survol — quand la relance est due ; la phrase « 2 biens proposés attendent sa réponse · relance due depuis le 30.09 » part, la ligne de la liste portant déjà le nombre et la date. Chaque bien : vignette, titre, son état s'il n'est plus en vente, « CHF … · 27.09 » — le prix proposé, la date de la proposition —, la flèche d'une baisse depuis, le score ; la ville et « proposé le » partent. Les trois réponses gardent leurs mots ; leurs touches sont déjà passées dans l'infobulle (tâche 1). Clés : `fil.retours.relance` entre, `fil.retours.sousTitre` et `fil.retours.proposeLe` partent.

**Fichiers :**

- Créer : `tests/unit/fil-retours.spec.tsx`
- Modifier : `src/components/matching-fil/FilRetours.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-retours.spec.tsx`** :

````tsx
/**
 * « En attente » ALLÉGÉ (`FilRetours`, conception du fil épuré §6), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · la phrase « 2 biens proposés attendent sa réponse · relance … » sous le nom ;
 *   · une relance due qui ne se dirait pas (sa pastille), ou une relance à venir dite deux fois (la liste la date) ;
 *   · la ville d'un bien proposé, « proposé le », la phrase longue d'une baisse au lieu de sa flèche ;
 *   · une touche écrite sur un geste (elle vit dans l'infobulle).
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import FilRetours from '@/components/matching-fil/FilRetours'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import type { FilAttente } from '@/components/matching-fil/filBoucle'
import { crmPalette } from '@/components/crm/tokens'

const sp = crmPalette(false)
const EMMA: FilMatch['acheteur'] = { id: 'c7', prenom: 'Emma', nom: 'Schneider', telephone: null, email: null, kyc: 'none' }
const OERLIKON: FilBien = {
  id: 'ml-o', titre: 'Attique 4,5 pièces · Oerlikon', prix: 2_650_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 140, ville: 'Zürich', canton: 'ZH', adresse: null, equipements: [], photo: null,
}
/** Proposé le 27.09 à CHF 2'700'000 : le prix a baissé de CHF 50'000 depuis. */
const PROPOSE: FilMatch = {
  id: 'm60', score: 100, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: OERLIKON, acheteur: EMMA,
  suivi: { statut: 'sent', proposeLe: '2020-09-27T10:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: 2_700_000, apprisLe: null },
}
const attente = (champs: Partial<FilAttente>): FilAttente => ({ acheteur: EMMA, matchs: [PROPOSE], echeance: '2020-09-30T09:00:00Z', due: true, ...champs })

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(a: FilAttente): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilRetours sp={sp} attente={a} motifsPour={null} onInteresse={() => {}} onPasInteresse={() => {}}
      onMotif={() => {}} onFermerMotifs={() => {}} onPasEncore={() => {}} onVoirContact={() => {}} />)
  })
}
const texte = (): string => hote!.textContent ?? ''

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilRetours — « En attente » allégé', () => {
  it('le nom seul ; une relance due en pastille, sa date au survol', async () => {
    await rendre(attente({}))
    expect(texte()).not.toContain('fil.retours.sousTitre')
    const pastille = hote!.querySelector('[title^="fil.attente.relanceDue"]')
    expect(pastille?.textContent).toBe('fil.retours.relance')
    expect(pastille?.getAttribute('title')).toBe('fil.attente.relanceDue {"date":"30.09"}')
  })

  it('une relance à venir ne se dit pas ici : la ligne de la liste la date déjà', async () => {
    await rendre(attente({ due: false }))
    expect(texte()).not.toContain('fil.retours.relance')
    expect(texte()).not.toContain('fil.attente.relance')
  })

  it('un bien proposé : son prix et la date de la proposition, sa baisse en flèche ; ni la ville, ni « proposé le »', async () => {
    await rendre(attente({}))
    expect(texte()).toContain("CHF 2'650'000 · 27.09")
    expect(hote!.querySelector('[title^="fil.signal.court"]')?.getAttribute('title')).toBe('fil.signal.court {"montant":"CHF 50\'000"}')
    for (const retire of ['Zürich', 'fil.retours.proposeLe', 'fil.signal.baissePropose']) expect(texte()).not.toContain(retire)
  })

  it('trois réponses, sans touche écrite : elle vit dans l’infobulle', async () => {
    await rendre(attente({}))
    const interesse = [...hote!.querySelectorAll('button')].find((b) => b.textContent === 'fil.retours.interesse')!
    expect(interesse.getAttribute('aria-keyshortcuts')).toBe('I')
    expect(hote!.querySelector('kbd')).toBeNull()
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-retours.spec.tsx
```

Attendu : `fil-retours.spec.tsx` : 3 échecs sur 4 — le nom seul et la pastille « Relance », une relance à venir qui ne se dit pas, un bien proposé à son prix et sa date ; seul « trois réponses, sans touche écrite » passe (la tâche 1 l’a fait).

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilRetours.tsx`**, 1/7 — remplacer (exact) :

````tsx
 * ⚠ Un mandat qui n'est plus en vente garde sa place (lot E1) : son état s'écrit en tête du bien (« Vendu · CHF … »).
 */
````

par :

````tsx
 * ⚠ Un mandat qui n'est plus en vente garde sa place (lot E1) : son état s'écrit en tête du bien (« Vendu · CHF … »).
 *
 * ⚠ Le fil épuré (07.10.2026) : le nom seul, et la pastille « Relance » quand elle est due (sa date au survol) ; un
 * bien proposé à son prix et à la date de sa proposition, sa baisse en flèche.
 */
````

**`src/components/matching-fil/FilRetours.tsx`**, 2/7 — remplacer (exact) :

````tsx
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
````

par :

````tsx
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
````

**`src/components/matching-fil/FilRetours.tsx`**, 3/7 — remplacer (exact) :

````tsx
import { cleEtatMandat, type FilAttente, type MotifRefus } from './filBoucle'
import { dateCourte, encreAccent, MARGE_POINTS, prixBien, texteSignal } from './filAffichage'
import { FilAvatar, FilBouton, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'
````

par :

````tsx
import { cleEtatMandat, type FilAttente, type MotifRefus } from './filBoucle'
import { baisseDuMatch, dateCourte, encreAccent, MARGE_POINTS, prixBien, teinteEcart } from './filAffichage'
import { FilAvatar, FilBaisse, FilBouton, FilScore, FilVignette } from './filAtomes'
import FilMotifs from './FilMotifs'
````

**`src/components/matching-fil/FilRetours.tsx`**, 4/7 — remplacer (exact) :

````tsx
  }
  const sousTitre = [
    t('fil.retours.sousTitre', { count: matchs.length }),
    echeance ? t(due ? 'fil.attente.relanceDue' : 'fil.attente.relance', { date: dateCourte(echeance) }) : null,
  ].filter(Boolean).join(' · ')
  return (
````

par :

````tsx
  }
  return (
````

**`src/components/matching-fil/FilRetours.tsx`**, 5/7 — remplacer (exact) :

````tsx
        <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
        <div style={{ minWidth: 0 }}>
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{sousTitre}</div>
        </div>
      </div>
````

par :

````tsx
        <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
        <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
          {acheteur.prenom} {acheteur.nom}
        </button>
        {/* Une relance due se dit en pastille, sa date au survol ; à venir, la ligne de la liste la date déjà. */}
        {due && echeance && (
          <span title={t('fil.attente.relanceDue', { date: dateCourte(echeance) })} style={{
            marginLeft: 'auto', flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)',
            padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-sm)', color: sp.ink,
          }}>
            <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name="alert" size={14} color={teinteEcart(sp)} /></span>
            {t('fil.retours.relance')}
          </span>
        )}
      </div>
````

**`src/components/matching-fil/FilRetours.tsx`**, 6/7 — remplacer (exact) :

````tsx
  const { t } = useTranslation('matching')
  const signal = texteSignal(m, t)
  const propose = m.suivi?.proposeLe
  const etat = cleEtatMandat(m.bien)
  const details = [
    etat ? t(etat) : null, prixBien(m.bien, t), m.bien.ville, propose ? t('fil.retours.proposeLe', { date: dateCourte(propose) }) : null,
  ].filter(Boolean).join(' · ')
  return (
````

par :

````tsx
  const { t } = useTranslation('matching')
  const baisse = baisseDuMatch(m, t)
  const propose = m.suivi?.proposeLe
  const etat = cleEtatMandat(m.bien)
  // Le prix et la date de la proposition, sans « proposé le » : l'onglet dit déjà ce qu'on attend.
  const details = [etat ? t(etat) : null, prixBien(m.bien, t), propose ? dateCourte(propose) : null].filter(Boolean).join(' · ')
  return (
````

**`src/components/matching-fil/FilRetours.tsx`**, 7/7 — remplacer (exact) :

````tsx
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
        {signal && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink }}>{signal}</span>}
      </span>
````

par :

````tsx
        </span>
        <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
          {details}
          {baisse && <> · <FilBaisse sp={sp} montant={baisse} /></>}
        </span>
      </span>
````

**`src/i18n/locales/fr/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titre": "Retours à consigner pour {{nom}}",
      "sousTitre_one": "{{count}} bien proposé attend sa réponse",
      "sousTitre_other": "{{count}} biens proposés attendent sa réponse",
      "proposeLe": "proposé le {{date}}",
      "interesse": "Intéressé",
````

par :

````json
      "titre": "Retours à consigner pour {{nom}}",
      "interesse": "Intéressé",
````

**`src/i18n/locales/fr/matching.json`**, 2/2 — remplacer (exact) :

````json
      "pasEncore": "Pas encore",
      "listeAria": "Biens proposés à {{prenom}}"
````

par :

````json
      "pasEncore": "Pas encore",
      "relance": "Relance",
      "listeAria": "Biens proposés à {{prenom}}"
````

**`src/i18n/locales/en/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titre": "Feedback to record for {{nom}}",
      "sousTitre_one": "{{count}} proposed property awaits a reply",
      "sousTitre_other": "{{count}} proposed properties await a reply",
      "proposeLe": "proposed on {{date}}",
      "interesse": "Interested",
````

par :

````json
      "titre": "Feedback to record for {{nom}}",
      "interesse": "Interested",
````

**`src/i18n/locales/en/matching.json`**, 2/2 — remplacer (exact) :

````json
      "pasEncore": "Not yet",
      "listeAria": "Properties proposed to {{prenom}}"
````

par :

````json
      "pasEncore": "Not yet",
      "relance": "Follow-up",
      "listeAria": "Properties proposed to {{prenom}}"
````

**`src/i18n/locales/de/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titre": "Rückmeldungen von {{nom}} erfassen",
      "sousTitre_one": "{{count}} vorgeschlagenes Objekt wartet auf eine Antwort",
      "sousTitre_other": "{{count}} vorgeschlagene Objekte warten auf eine Antwort",
      "proposeLe": "vorgeschlagen am {{date}}",
      "interesse": "Interessiert",
````

par :

````json
      "titre": "Rückmeldungen von {{nom}} erfassen",
      "interesse": "Interessiert",
````

**`src/i18n/locales/de/matching.json`**, 2/2 — remplacer (exact) :

````json
      "pasEncore": "Noch nicht",
      "listeAria": "{{prenom}} vorgeschlagene Objekte"
````

par :

````json
      "pasEncore": "Noch nicht",
      "relance": "Nachfassen",
      "listeAria": "{{prenom}} vorgeschlagene Objekte"
````

**`src/i18n/locales/it/matching.json`**, 1/2 — remplacer (exact) :

````json
      "titre": "Riscontri da registrare per {{nom}}",
      "sousTitre_one": "{{count}} immobile proposto attende una risposta",
      "sousTitre_other": "{{count}} immobili proposti attendono una risposta",
      "proposeLe": "proposto il {{date}}",
      "interesse": "Interessato",
````

par :

````json
      "titre": "Riscontri da registrare per {{nom}}",
      "interesse": "Interessato",
````

**`src/i18n/locales/it/matching.json`**, 2/2 — remplacer (exact) :

````json
      "pasEncore": "Non ancora",
      "listeAria": "Immobili proposti a {{prenom}}"
````

par :

````json
      "pasEncore": "Non ancora",
      "relance": "Sollecito",
      "listeAria": "Immobili proposti a {{prenom}}"
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-retours.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  39 passed (39)`.

- [ ] **Étape 5 — les contrôles.**

```bash
npx eslint src/components/matching-fil/FilRetours.tsx tests/unit/fil-retours.spec.tsx --quiet
```

Attendu : sortie 0, aucun message.


---

## Tâche 6 : La sélection du marché — `FilSelection`

La sélection d'un acheteur (conception §7). L'en-tête : le nom seul — la pastille « Marché · 4 biens » part, la ligne de la liste le dit déjà — et « Recherche : … » se replie derrière un chevron (`aria-expanded`, replié pour l'acheteur suivant). Chaque bien : case, vignette, titre, puis le prix seul — sa baisse en flèche, ou la pastille « Nouveau » —, le score et la croix d'« Écarter », nommée ; pièces, surface et ville partent. Un écart à vérifier se dit par l'icône d'alerte, sa liste au survol et pour un lecteur d'écran. Le bouton dit « Proposé · 2 » (« Proposé » sans case cochée) ; la phrase « J'ai proposé 2 biens à … » passe dans l'infobulle, avec la touche. « Voir 20 de plus » reste. Clés : `fil.selection.propose` et `fil.selection.rechercheAria` entrent, `fil.selection.ligne` part ; `fil.selection.pieces` et `fil.selection.marche` restent, lues ailleurs (`filValeurs.ts`, `FilConclure`).

**Fichiers :**

- Créer : `tests/unit/fil-selection.spec.tsx`
- Modifier : `src/components/matching-fil/FilSelection.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-selection.spec.tsx`** :

````tsx
/**
 * La sélection du marché ALLÉGÉE (`FilSelection`, conception du fil épuré §7), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · « Marché · 2 biens pas encore proposés » sous le nom ; la recherche écrite d'office (elle se déplie d'un clic, et
 *     se replie d'un acheteur à l'autre) ;
 *   · pièces et surface sur la ligne d'un bien ; une baisse écrite en phrase au lieu de sa flèche ;
 *   · « À vérifier : … » écrit à l'écran (l'icône le dit, la liste au survol et pour un lecteur d'écran) ;
 *   · « Écarter » écrit sur chaque ligne (une icône nommée) ; « J'ai proposé 2 biens à Anastasia » sur le bouton
 *     principal (« Proposé · 2 », la phrase au survol).
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'fr' },
  }),
}))

import FilSelection from '@/components/matching-fil/FilSelection'
import type { FilBien, FilMatch, FilSelectionResume } from '@/components/matching-fil/filModele'
import { crmPalette } from '@/components/crm/tokens'
import type { SearchCriteria } from '@/types/contact'
import fr from '@/i18n/locales/fr/matching.json'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const ANASTASIA: FilMatch['acheteur'] = { id: 'c11', prenom: 'Anastasia', nom: 'Volkova', telephone: null, email: null, kyc: 'none' }
const CRITERES: SearchCriteria = { transaction_type: 'buy', type: 'apartment', zones: ['Genève'], budget_min: 2_000_000, budget_max: 2_400_000 }
const annonce = (id: string, titre: string, prix: number, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces: 5, surface: 150, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo: null, marche: { ref: `MG-MK-${id}`, sourceUrl: null }, ...champs,
})
const match = (id: string, b: FilBien, budgetTenu: boolean): FilMatch => ({
  id, score: 95, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: b, acheteur: ANASTASIA,
  raisons: {
    budget: { match: budgetTenu, score: budgetTenu ? 30 : 0, detail: budgetTenu ? 'Dans le budget' : 'Hors budget' },
    zone: { match: true, score: 20, detail: 'Genève correspond' },
  },
})
/** En baisse sur le marché depuis la veille : CHF 2'500'000 → CHF 2'450'000. */
const EAUX_VIVES = annonce('ml-s2', 'Attique 5 pièces · Eaux-Vives', 2_450_000, { prixInitial: 2_500_000, baisseLe: '2020-01-14T09:00:00Z' })
const MALAGNOU = annonce('ml-s1', 'Appartement 6 pièces · Malagnou', 2_480_000)
const MATCHS = [match('m25', EAUX_VIVES, true), match('m24', MALAGNOU, false)]
const RESUME: FilSelectionResume = { acheteur: ANASTASIA, nombre: 2, meilleurScore: 95, vignettes: [], baisses: 1 }

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(resume: FilSelectionResume = RESUME, coches: string[] = ['m25', 'm24']): Promise<void> {
  if (!hote) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => {
    racine!.render(<FilSelection sp={sp} resume={resume} matchs={MATCHS} coches={coches} aPlus={false} isLoading={false}
      isError={false} aDesDonnees isFetching={false} onCocher={() => {}} onEcarter={() => {}} onVoirPlus={() => {}}
      onReessayer={() => {}} onProposer={() => {}} onVoirContact={() => {}} maintenant={MAINTENANT} />)
  })
}
const texte = (): string => hote!.textContent ?? ''
const visible = (): string => {
  const copie = hote!.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
const replier = (): HTMLButtonElement => hote!.querySelector('button[aria-label="fil.selection.rechercheAria"]') as HTMLButtonElement

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilSelection — la sélection du marché allégée', () => {
  it('le nom seul ; sa recherche se déplie d’un clic', async () => {
    await rendre()
    for (const retire of ['fil.selection.marche', 'fil.selection.ligne', 'fil.selection.recherche']) expect(texte()).not.toContain(retire)
    expect(replier().getAttribute('aria-expanded')).toBe('false')
    await act(async () => { replier().click() })
    expect(replier().getAttribute('aria-expanded')).toBe('true')
    expect(texte()).toContain('fil.selection.recherche')
  })

  it('la recherche se replie d’un acheteur à l’autre', async () => {
    await rendre()
    await act(async () => { replier().click() })
    await rendre({ ...RESUME, acheteur: { ...ANASTASIA, id: 'c99' } })
    expect(replier().getAttribute('aria-expanded')).toBe('false')
    expect(texte()).not.toContain('fil.selection.recherche')
  })

  it('un bien : son prix, et sa baisse en flèche ; ni pièces ni surface', async () => {
    await rendre()
    expect(texte()).toContain("CHF 2'450'000")
    expect(hote!.querySelector('[title^="fil.signal.court"]')?.getAttribute('title')).toBe('fil.signal.court {"montant":"CHF 50\'000"}')
    for (const retire of ['fil.selection.pieces', 'fil.valeurs.m2', 'fil.signal.baisseMarche']) expect(texte()).not.toContain(retire)
  })

  it('un écart se dit par l’icône : sa liste au survol et pour un lecteur d’écran, pas à l’écran', async () => {
    await rendre()
    const ecart = hote!.querySelector('[title^="fil.selection.ecarts"]')
    expect(ecart?.querySelector('.sr-only')?.textContent).toBe(ecart?.getAttribute('title'))
    expect(visible()).not.toContain('fil.selection.ecarts')
  })

  it('« Écarter » en icône nommée ; « Proposé · 2 », la phrase entière au survol', async () => {
    await rendre()
    const ecarter = hote!.querySelector('button[aria-label^="fil.selection.ecarterAria"]') as HTMLButtonElement
    expect(ecarter.textContent).toBe('')
    const proposer = [...hote!.querySelectorAll('button')].find((b) => b.getAttribute('aria-keyshortcuts') === 'E')!
    expect(proposer.textContent).toBe('fil.selection.propose {"count":2}')
    expect(proposer.title).toContain('fil.selection.proposer')
    expect(proposer.title).toContain('"touche":"E"')
  })

  it('en français : « Proposé · 2 »', () => {
    expect(fr.fil.selection.propose_other).toBe('Proposé · {{count}}')
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-selection.spec.tsx
```

Attendu : `fil-selection.spec.tsx` : 6 échecs sur 6 — le nom seul et la recherche dépliée d’un clic, repliée d’un acheteur à l’autre, un bien à son prix, un écart en icône, « Écarter » en icône et « Proposé · 2 », le français.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilSelection.tsx`**, 1/12 — remplacer (exact) :

````tsx
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B) le dit sous ses détails (`texteSignal`). Un
 * bien nouveau sur le marché ou en baisse le dit aussi, daté (lot C), et passe devant à score égal.
 *
````

par :

````tsx
 *
 * ⚠ Un bien refusé pour le PRIX et revenu par une baisse (lot B), ou en baisse sur le marché (lot C), porte la flèche
 * de sa baisse ; un bien nouveau, la pastille « Nouveau » (son libellé au survol). Il passe devant à score égal.
 *
 * ⚠ Le fil épuré (07.10.2026) : le nom seul, la recherche repliée derrière un chevron ; un bien à son prix, ses écarts
 * en icône (leur liste au survol) ; « Proposé · 2 », la phrase entière au survol.
 *
````

**`src/components/matching-fil/FilSelection.tsx`**, 2/12 — remplacer (exact) :

````tsx
 */
import { useId, useLayoutEffect, useRef, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
````

par :

````tsx
 */
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
````

**`src/components/matching-fil/FilSelection.tsx`**, 3/12 — remplacer (exact) :

````tsx
import { criteresNonTenus, initiales, lignesCriteres, palierScore, type FilMatch, type FilSelectionResume } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, secondClic, teinteEcart, texteSignalMatch, unSeulClic } from './filAffichage'
import { FilAvatar, FilScore, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'
````

par :

````tsx
import { criteresNonTenus, initiales, lignesCriteres, palierScore, type FilMatch, type FilSelectionResume } from './filModele'
import {
  baisseDuBien, baisseDuMatch, encreAccent, MARGE_POINTS, prixBien, secondClic, teinteEcart, texteSignalBien, unSeulClic,
} from './filAffichage'
import { signalBien } from './filSignaux'
import { FilAvatar, FilBaisse, FilScore, FilVignette } from './filAtomes'
import { resumeRecherche } from './filValeurs'
````

**`src/components/matching-fil/FilSelection.tsx`**, 4/12 — remplacer (exact) :

````tsx
  const reference = matchs[0]
  const echecSeul = isError && !aDesDonnees
````

par :

````tsx
  const reference = matchs[0]
  const aRecherche = reference != null && lignesCriteres(reference).length > 0
  // Sa recherche se lit d'un clic, et se replie d'un acheteur à l'autre : l'état retient l'acheteur ouvert.
  const rechercheId = useId()
  const [rechercheOuverte, setRechercheOuverte] = useState<string | null>(null)
  const ouverte = rechercheOuverte === acheteur.id
  const echecSeul = isError && !aDesDonnees
````

**`src/components/matching-fil/FilSelection.tsx`**, 5/12 — remplacer (exact) :

````tsx
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <div style={{ minWidth: 0 }}>
            <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
              {acheteur.prenom} {acheteur.nom}
            </button>
            <div style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
              {t('fil.selection.marche')} · {t('fil.selection.ligne', { count: resume.nombre })}
            </div>
          </div>
        </div>

        {reference && lignesCriteres(reference).length > 0 && (
          <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}
````

par :

````tsx
          <FilAvatar sp={sp} texte={initiales(acheteur.prenom, acheteur.nom)} taille={36} />
          <button type="button" onClick={onVoirContact} style={{ ...lien, fontSize: 'var(--crm-text-3xl)', color: sp.ink }}>
            {acheteur.prenom} {acheteur.nom}
          </button>
          {aRecherche && (
            <button type="button" aria-expanded={ouverte} aria-controls={rechercheId} aria-label={t('fil.selection.rechercheAria')}
              title={t('fil.selection.rechercheAria')} onClick={() => setRechercheOuverte(ouverte ? null : acheteur.id)}
              style={{ ...lien, display: 'inline-flex', padding: 'var(--crm-space-xs)' }}>
              <MEIcon name={ouverte ? 'chevron-up' : 'chevron-down'} size={16} color={sp.sub} />
            </button>
          )}
        </div>

        {aRecherche && ouverte && (
          <p id={rechercheId} style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub }}>
            {t('fil.selection.recherche', { resume: resumeRecherche(reference, t, nombre) })}
````

**`src/components/matching-fil/FilSelection.tsx`**, 6/12 — remplacer (exact) :

````tsx
            {matchs.map((m) => (
              <Bien key={m.id} sp={sp} m={m} coche={coches.includes(m.id)} nombre={nombre} maintenant={maintenant} onCocher={onCocher} onEcarter={onEcarter} />
            ))}
````

par :

````tsx
            {matchs.map((m) => (
              <Bien key={m.id} sp={sp} m={m} coche={coches.includes(m.id)} maintenant={maintenant} onCocher={onCocher} onEcarter={onEcarter} />
            ))}
````

**`src/components/matching-fil/FilSelection.tsx`**, 7/12 — remplacer (exact) :

````tsx
        <button type="button" onClick={unSeulClic(onProposer)} disabled={bloque}
          aria-describedby={raison ? raisonId : undefined} aria-keyshortcuts="E" title={t('fil.actions.raccourci', { touche: 'E' })}
          style={{
````

par :

````tsx
        <button type="button" onClick={unSeulClic(onProposer)} disabled={bloque}
          aria-describedby={raison ? raisonId : undefined} aria-keyshortcuts="E" title={t('fil.actions.infobulle', {
            libelle: coches.length === 0 ? t('fil.selection.proposerAucun', { prenom: acheteur.prenom })
              : t('fil.selection.proposer', { count: coches.length, prenom: acheteur.prenom }),
            touche: 'E',
          })}
          style={{
````

**`src/components/matching-fil/FilSelection.tsx`**, 8/12 — remplacer (exact) :

````tsx
          }}>
          {/* « J'ai proposé 0 bien à Julie » se lit mal : à zéro, le bouton (désactivé, sa raison à côté) ne compte pas. */}
          {coches.length === 0 ? t('fil.selection.proposerAucun', { prenom: acheteur.prenom })
            : t('fil.selection.proposer', { count: coches.length, prenom: acheteur.prenom })}
        </button>
````

par :

````tsx
          }}>
          {/* « Proposé · 2 » ; la phrase entière (« J'ai proposé 2 biens à Julie ») au survol. À zéro, le bouton (désactivé, sa
              raison à côté) ne compte pas. */}
          {coches.length === 0 ? t('fil.actions.propose') : t('fil.selection.propose', { count: coches.length })}
        </button>
````

**`src/components/matching-fil/FilSelection.tsx`**, 9/12 — remplacer (exact) :

````tsx
}

function Bien({ sp, m, coche, nombre, maintenant, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; nombre: (n: number) => string; maintenant: number
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
````

par :

````tsx
}

function Bien({ sp, m, coche, maintenant, onCocher, onEcarter }: {
  sp: CrmPalette; m: FilMatch; coche: boolean; maintenant: number
  onCocher: (id: string, coche: boolean) => void; onEcarter: (m: FilMatch) => void
}) {
````

**`src/components/matching-fil/FilSelection.tsx`**, 10/12 — remplacer (exact) :

````tsx
  const aVerifier = criteresNonTenus(lignes)
  // Le signal du match (lot B : revenu par une baisse depuis la proposition), sinon celui du bien (lot C :
  // nouveau sur le marché, prix baissé), daté.
  const signal = texteSignalMatch(m, t, maintenant)
  // Aucun verdict du tout : le dire tel quel plutôt que lister chaque critère « à vérifier ».
  const nonEvalues = lignes.length > 0 && lignes.every((l) => l.ok === null)
  const details = [
    prixBien(m.bien, t),
    m.bien.pieces != null ? t('fil.selection.pieces', { count: m.bien.pieces, valeur: nombre(m.bien.pieces) }) : null,
    m.bien.surface != null ? t('fil.valeurs.m2', { valeur: nombre(m.bien.surface) }) : null,
  ].filter(Boolean).join(' · ')
  // Sans écart, rien : l'alerte ne se lit que là où il y en a une.
````

par :

````tsx
  const aVerifier = criteresNonTenus(lignes)
  const signal = signalBien(m.bien, maintenant)
  // La baisse depuis la proposition à CET acheteur (lot B), sinon celle de l'annonce (lot C) ; un bien neuf, sa pastille.
  const baisse = baisseDuMatch(m, t) ?? (signal ? baisseDuBien(signal, m.bien, t) : null)
  const nouveau = !baisse && signal && signal.genre !== 'baisse' ? texteSignalBien(signal, m.bien, t, true) : null
  // Aucun verdict du tout : le dire tel quel plutôt que lister chaque critère « à vérifier ».
  const nonEvalues = lignes.length > 0 && lignes.every((l) => l.ok === null)
  // Sans écart, rien : l'alerte ne se lit que là où il y en a une.
````

**`src/components/matching-fil/FilSelection.tsx`**, 11/12 — remplacer (exact) :

````tsx
          </span>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{details}</span>
          {signal && <span style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink }}>{signal}</span>}
          {resume && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
              {alerte && (
                <span aria-hidden style={{ display: 'inline-flex', flex: 'none' }}>
                  <MEIcon name="alert" size={12} color={teinteEcart(sp)} />
                </span>
              )}
              {resume}
            </span>
          )}
        </span>
````

par :

````tsx
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
            {prixBien(m.bien, t)}
            {baisse && <FilBaisse sp={sp} montant={baisse} />}
            {nouveau && (
              <span title={nouveau} style={{
                padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
                fontWeight: 500, color: sp.ink,
              }}>
                {t('fil.signal.pastille')}
              </span>
            )}
            {/* Un écart se dit par l'icône ; sa liste au survol et pour un lecteur d'écran. */}
            {resume && (
              <span title={resume} style={{ display: 'inline-flex', flex: 'none' }}>
                <span aria-hidden style={{ display: 'inline-flex' }}><MEIcon name="alert" size={12} color={alerte ? teinteEcart(sp) : sp.sub} /></span>
                <span className="sr-only">{resume}</span>
              </span>
            )}
          </span>
        </span>
````

**`src/components/matching-fil/FilSelection.tsx`**, 12/12 — remplacer (exact) :

````tsx
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
      <button type="button" onClick={unSeulClic(() => onEcarter(m))} aria-label={t('fil.selection.ecarterAria', { titre: m.bien.titre })} style={{
        border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
        fontWeight: 600, color: sp.sub, padding: 'var(--crm-space-xs) var(--crm-space-sm)',
      }}>
        {t('fil.actions.ecarter')}
      </button>
````

par :

````tsx
      <FilScore sp={sp} score={m.score} palier={palierScore(m.score)} />
      <button type="button" onClick={unSeulClic(() => onEcarter(m))} aria-label={t('fil.selection.ecarterAria', { titre: m.bien.titre })}
        title={t('fil.actions.ecarter')} style={{ display: 'inline-flex', border: 0, background: 'transparent', cursor: 'pointer', padding: 'var(--crm-space-xs)' }}>
        <MEIcon name="close" size={14} color={sp.sub} />
      </button>
````

**`src/i18n/locales/fr/matching.json`**, 1/3 — remplacer (exact) :

````json
    "selection": {
      "ligne_one": "{{count}} bien pas encore proposé",
      "ligne_other": "{{count}} biens pas encore proposés",
      "biens_one": "{{count}} bien",
````

par :

````json
    "selection": {
      "biens_one": "{{count}} bien",
````

**`src/i18n/locales/fr/matching.json`**, 2/3 — remplacer (exact) :

````json
      "recherche": "Recherche : {{resume}}",
      "inclure": "Inclure « {{titre}} »",
````

par :

````json
      "recherche": "Recherche : {{resume}}",
      "rechercheAria": "Sa recherche",
      "inclure": "Inclure « {{titre}} »",
````

**`src/i18n/locales/fr/matching.json`**, 3/3 — remplacer (exact) :

````json
      "proposerAucun": "Je les ai proposés à {{prenom}}",
      "chambresAuMoins_one": "{{valeur}} chambre et plus",
````

par :

````json
      "proposerAucun": "Je les ai proposés à {{prenom}}",
      "propose_one": "Proposé · {{count}}",
      "propose_other": "Proposé · {{count}}",
      "chambresAuMoins_one": "{{valeur}} chambre et plus",
````

**`src/i18n/locales/en/matching.json`**, 1/3 — remplacer (exact) :

````json
    "selection": {
      "ligne_one": "{{count}} property not yet proposed",
      "ligne_other": "{{count}} properties not yet proposed",
      "biens_one": "{{count}} property",
````

par :

````json
    "selection": {
      "biens_one": "{{count}} property",
````

**`src/i18n/locales/en/matching.json`**, 2/3 — remplacer (exact) :

````json
      "recherche": "Search: {{resume}}",
      "inclure": "Include “{{titre}}”",
````

par :

````json
      "recherche": "Search: {{resume}}",
      "rechercheAria": "Their search",
      "inclure": "Include “{{titre}}”",
````

**`src/i18n/locales/en/matching.json`**, 3/3 — remplacer (exact) :

````json
      "proposerAucun": "I proposed them to {{prenom}}",
      "chambresAuMoins_one": "{{valeur}} bedroom or more",
````

par :

````json
      "proposerAucun": "I proposed them to {{prenom}}",
      "propose_one": "Proposed · {{count}}",
      "propose_other": "Proposed · {{count}}",
      "chambresAuMoins_one": "{{valeur}} bedroom or more",
````

**`src/i18n/locales/de/matching.json`**, 1/3 — remplacer (exact) :

````json
    "selection": {
      "ligne_one": "{{count}} Objekt noch nicht vorgeschlagen",
      "ligne_other": "{{count}} Objekte noch nicht vorgeschlagen",
      "biens_one": "{{count}} Objekt",
````

par :

````json
    "selection": {
      "biens_one": "{{count}} Objekt",
````

**`src/i18n/locales/de/matching.json`**, 2/3 — remplacer (exact) :

````json
      "recherche": "Suche: {{resume}}",
      "inclure": "„{{titre}}“ einbeziehen",
````

par :

````json
      "recherche": "Suche: {{resume}}",
      "rechercheAria": "Ihre Suche",
      "inclure": "„{{titre}}“ einbeziehen",
````

**`src/i18n/locales/de/matching.json`**, 3/3 — remplacer (exact) :

````json
      "proposerAucun": "Ich habe sie {{prenom}} vorgeschlagen",
      "chambresAuMoins_one": "{{valeur}} Schlafzimmer oder mehr",
````

par :

````json
      "proposerAucun": "Ich habe sie {{prenom}} vorgeschlagen",
      "propose_one": "Vorgeschlagen · {{count}}",
      "propose_other": "Vorgeschlagen · {{count}}",
      "chambresAuMoins_one": "{{valeur}} Schlafzimmer oder mehr",
````

**`src/i18n/locales/it/matching.json`**, 1/3 — remplacer (exact) :

````json
    "selection": {
      "ligne_one": "{{count}} immobile non ancora proposto",
      "ligne_other": "{{count}} immobili non ancora proposti",
      "biens_one": "{{count}} immobile",
````

par :

````json
    "selection": {
      "biens_one": "{{count}} immobile",
````

**`src/i18n/locales/it/matching.json`**, 2/3 — remplacer (exact) :

````json
      "recherche": "Ricerca: {{resume}}",
      "inclure": "Includi «{{titre}}»",
````

par :

````json
      "recherche": "Ricerca: {{resume}}",
      "rechercheAria": "La sua ricerca",
      "inclure": "Includi «{{titre}}»",
````

**`src/i18n/locales/it/matching.json`**, 3/3 — remplacer (exact) :

````json
      "proposerAucun": "Li ho proposti a {{prenom}}",
      "chambresAuMoins_one": "{{valeur}} camera o più",
````

par :

````json
      "proposerAucun": "Li ho proposti a {{prenom}}",
      "propose_one": "Proposto · {{count}}",
      "propose_other": "Proposto · {{count}}",
      "chambresAuMoins_one": "{{valeur}} camera o più",
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-selection.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  41 passed (41)`.

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

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 371 passed (374)`, `Tests  1 failed | 5518 passed | 3 skipped (5522)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 9** (« style(matching): recherche à ajuster, en attente et sélection du marché allégées ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C9
```

Attendu : `C9` suivi des huit premiers caractères de l'arbre.


---

## Tâche 7 : « Qui pour ce bien ? » et « À conclure »

Même règle, sans maquette (conception §8). « Qui pour ce bien ? » (`FilQuiPourCeBien`) : la pastille « Qui pour ce bien ? » part, le titre devient le lien vers le bien (« Voir le bien » part), l'en-tête ne dit plus que le prix — l'adresse et la ville partent — et, pour un mandat neuf, la pastille « Nouveau ». La liste des acquéreurs (`QuiPourCeBien`) ne change pas : elle sert aussi les fiches d'un mandat et d'une annonce. « À conclure » (`FilConclure`) : « Voir l'annonce d'origine » devient une icône nommée à côté du titre, et le titre d'un mandat devient le lien vers sa fiche ; restent « Intéressé·e le … », les libellés du formulaire et « Rien n'est envoyé à {prénom}. » — la promesse du matching sans sortie. `fil.voirBien` quitte les quatre langues.

**Fichiers :**

- Créer : `tests/unit/fil-qui-pour-conclure.spec.tsx`
- Modifier : `src/components/matching-fil/FilQuiPourCeBien.tsx`
- Modifier : `src/components/matching-fil/FilConclure.tsx`
- Modifier : `src/i18n/locales/fr/matching.json`
- Modifier : `src/i18n/locales/en/matching.json`
- Modifier : `src/i18n/locales/de/matching.json`
- Modifier : `src/i18n/locales/it/matching.json`

- [ ] **Étape 1 — la garde d'abord.**

Créer **`tests/unit/fil-qui-pour-conclure.spec.tsx`** :

````tsx
/**
 * « Qui pour ce bien ? » et « À conclure » ALLÉGÉS (`FilQuiPourCeBien`, `FilConclure` ; conception du fil épuré §8),
 * montés pour de vrai — la liste partagée des acquéreurs (`QuiPourCeBien`) est remplacée : elle ne change pas, et lit
 * ses anciens prospects par une requête.
 *
 * Ce que cette spec refuse :
 *   · la pastille « Qui pour ce bien ? », « Voir le bien » écrit (le titre est le lien), l'adresse dans l'en-tête du bien ;
 *   · un bien neuf écrit en toutes lettres au lieu de sa pastille « Nouveau » ;
 *   · « Voir l'annonce d'origine » écrit (une icône nommée, à côté du titre) ;
 *   · la promesse « Rien n'est envoyé à … » perdue.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))
vi.mock('@/components/matching-fil/QuiPourCeBien', () => ({ default: () => null }))

import FilQuiPourCeBien from '@/components/matching-fil/FilQuiPourCeBien'
import FilConclure from '@/components/matching-fil/FilConclure'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import { crmPalette } from '@/components/crm/tokens'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const EMMA: FilMatch['acheteur'] = { id: 'c7', prenom: 'Emma', nom: 'Schneider', telephone: null, email: null, kyc: 'none' }
const bien = (champs: Partial<FilBien> = {}): FilBien => ({
  id: 'p3', titre: 'Attique 5,5 pièces · Florissant', prix: 2_350_000, location: false, type: 'apartment', pieces: 5.5,
  surface: 168, ville: 'Genève', canton: 'GE', adresse: 'Route de Florissant 58', equipements: [], photo: null, ...champs,
})
const interesse = (b: FilBien): FilMatch => ({
  id: 'm70', score: 100, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: b, acheteur: EMMA,
  suivi: { statut: 'interested', proposeLe: '2020-01-05T10:00:00Z', reponduLe: '2020-01-10T10:00:00Z', motif: null, note: null, prixPropose: null, apprisLe: null },
})

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(element: ReactNode): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(element) })
}
const texte = (): string => hote!.textContent ?? ''

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilQuiPourCeBien — l’en-tête du bien allégé', () => {
  const monter = (b: FilBien, onVoirBien = vi.fn()) => rendre(
    <FilQuiPourCeBien sp={sp} bien={b} compatibles={[]} maintenant={MAINTENANT} peutOuvrir={() => false} onChoisir={() => {}}
      onVoirBien={onVoirBien} onVoirContact={() => {}} />,
  )

  it('le titre est le lien vers le bien ; ni pastille « Qui pour ce bien ? », ni « Voir le bien », ni l’adresse', async () => {
    const voir = vi.fn()
    await monter(bien(), voir)
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    expect(titre.textContent).toBe('Attique 5,5 pièces · Florissant')
    await act(async () => { titre.click() })
    expect(voir).toHaveBeenCalledTimes(1)
    expect(texte()).toContain("CHF 2'350'000")
    for (const retire of ['fil.quiPour.titre', 'fil.voirBien', 'Route de Florissant 58']) expect(texte()).not.toContain(retire)
  })

  it('un mandat neuf : la pastille « Nouveau », son libellé au survol', async () => {
    await monter(bien({ mandatLe: '2020-01-14T09:00:00Z' }))
    expect(hote!.querySelector('[title="fil.signal.mandatCourt"]')?.textContent).toBe('fil.signal.pastille')
    expect(texte()).not.toContain('fil.signal.mandat ')
  })
})

describe('FilConclure — l’annonce d’origine en icône', () => {
  const monter = (m: FilMatch, onVoirBien = vi.fn()) => rendre(
    <FilConclure sp={sp} m={m} motifsOuverts={false} occupe={false} focusDate={false} onPlanifier={() => {}}
      onPasInteresse={() => {}} onMotif={() => {}} onFermerMotifs={() => {}} onVoirBien={onVoirBien} onVoirContact={() => {}} />,
  )

  it('une annonce du marché : son lien d’origine en icône nommée, à côté du titre', async () => {
    await monter(interesse(bien({ marche: { ref: 'MG-MK-1', sourceUrl: 'https://flatfox.ch/fr/annonce/1/' } })))
    const lien = hote!.querySelector('h2 a') as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe('https://flatfox.ch/fr/annonce/1/')
    expect(lien.getAttribute('aria-label')).toBe('fil.conclure.voirAnnonce')
    expect(lien.textContent).toBe('')
    expect(texte()).not.toContain('fil.conclure.voirAnnonce')
  })

  it('un mandat : le titre est le lien vers le bien, « Voir le bien » n’est plus écrit', async () => {
    const voir = vi.fn()
    await monter(interesse(bien()), voir)
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    await act(async () => { titre.click() })
    expect(voir).toHaveBeenCalledTimes(1)
    expect(texte()).not.toContain('fil.voirBien')
  })

  it('reste la promesse : rien n’est envoyé à l’acheteur', async () => {
    await monter(interesse(bien()))
    expect(texte()).toContain('fil.conclure.aucuneInvitation {"prenom":"Emma"}')
  })
})
````

- [ ] **Étape 2 — elle doit échouer.**

```bash
npx vitest run tests/unit/fil-qui-pour-conclure.spec.tsx
```

Attendu : `fil-qui-pour-conclure.spec.tsx` : 4 échecs sur 5 — le titre en lien de « Qui pour ce bien ? », sa pastille « Nouveau », l’annonce d’origine en icône, le titre d’un mandat en lien ; seul « reste la promesse : rien n’est envoyé à l’acheteur » passe.

- [ ] **Étape 3 — le code.** Dans l'ordre :

**`src/components/matching-fil/FilQuiPourCeBien.tsx`**, 1/4 — remplacer (exact) :

````tsx
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat, dans le
 * fil : l'en-tête du bien (vignette, prix, signal, « Voir le bien »), puis les deux listes partagées avec les fiches
 * (`QuiPourCeBien`, lot D1) — les acquéreurs compatibles, qu'on ouvre en un clic s'ils sont une ligne du fil, et les
````

par :

````tsx
 * « Qui pour ce bien ? » (lot C, conception de la boucle §4.2) — le panneau de l'en-tête d'un bien en mandat, dans le
 * fil : l'en-tête du bien (vignette, titre en lien, prix, la pastille « Nouveau » d'un mandat neuf — le fil épuré,
 * 07.10.2026), puis les deux listes partagées avec les fiches
 * (`QuiPourCeBien`, lot D1) — les acquéreurs compatibles, qu'on ouvre en un clic s'ils sont une ligne du fil, et les
````

**`src/components/matching-fil/FilQuiPourCeBien.tsx`**, 2/4 — remplacer (exact) :

````tsx
import type { FilBien, FilMatch } from './filModele'
import { encreAccent, MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
````

par :

````tsx
import type { FilBien, FilMatch } from './filModele'
import { MARGE_POINTS, prixBien, texteSignalBien } from './filAffichage'
import { signalBien } from './filSignaux'
````

**`src/components/matching-fil/FilQuiPourCeBien.tsx`**, 3/4 — remplacer (exact) :

````tsx
  const signal = signalBien(bien, maintenant)
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
  }
````

par :

````tsx
  const signal = signalBien(bien, maintenant)
  // Un mandat neuf : la pastille « Nouveau », son libellé au survol (le panneau ne s'ouvre que sur un mandat).
  const nouveau = signal ? texteSignalBien(signal, bien, t, true) : null
  const lien: CSSProperties = {
    border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
    fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit',
  }
````

**`src/components/matching-fil/FilQuiPourCeBien.tsx`**, 4/4 — remplacer (exact) :

````tsx
        <div style={{ minWidth: 0 }}>
          <span style={{
            display: 'inline-block', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${sp.cardBorder}`, fontSize: 'var(--crm-text-xs)', color: sp.sub,
          }}>
            {t('fil.quiPour.titre')}
          </span>
          <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {[prixBien(bien, t), bien.adresse, bien.ville].filter(Boolean).join(' · ')}
          </p>
          {signal && (
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
              {texteSignalBien(signal, bien, t)}
            </p>
          )}
          <button type="button" onClick={onVoirBien} style={lien}>{t('fil.voirBien')}</button>
        </div>
````

par :

````tsx
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>
            <button type="button" onClick={onVoirBien} style={lien}>{bien.titre}</button>
          </h2>
          <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {prixBien(bien, t)}
            {nouveau && (
              <span title={nouveau} style={{
                padding: '0 var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${sp.cardBorder}`,
                fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.ink,
              }}>
                {t('fil.signal.pastille')}
              </span>
            )}
          </p>
        </div>
````

**`src/components/matching-fil/FilConclure.tsx`**, 1/4 — remplacer (exact) :

````tsx
 * ⚠ L'annonce d'origine s'ouvre par un LIEN (`<a>`), jamais par `window.open` : son adresse vient du
 * portail, et seul un `http(s)` est rendu cliquable.
 *
````

par :

````tsx
 * ⚠ L'annonce d'origine s'ouvre par un LIEN (`<a>`), jamais par `window.open` : son adresse vient du
 * portail, et seul un `http(s)` est rendu cliquable. Le fil épuré (07.10.2026) : une icône nommée à côté du titre ; le
 * titre d'un mandat est le lien vers sa fiche.
 *
````

**`src/components/matching-fil/FilConclure.tsx`**, 2/4 — remplacer (exact) :

````tsx
import { addDays, format } from 'date-fns'
import type { CrmPalette } from '@/components/crm/tokens'
````

par :

````tsx
import { addDays, format } from 'date-fns'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
````

**`src/components/matching-fil/FilConclure.tsx`**, 3/4 — remplacer (exact) :

````tsx
            </span>
            <h2 style={{ margin: 0, marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink }}>{bien.titre}</h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
````

par :

````tsx
            </span>
            <h2 style={{
              margin: 0, marginTop: 'var(--crm-space-sm)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
              fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: sp.ink,
            }}>
              {bien.marche ? bien.titre : (
                <button type="button" onClick={onVoirBien} style={{ ...lien, fontSize: 'inherit', color: 'inherit' }}>{bien.titre}</button>
              )}
              {bien.marche && lienAnnonce && (
                <a href={lienAnnonce} target="_blank" rel="noopener noreferrer" aria-label={t('fil.conclure.voirAnnonce')}
                  title={t('fil.conclure.voirAnnonce')} style={{ display: 'inline-flex' }}>
                  <MEIcon name="external" size={16} color={encreAccent(sp)} />
                </a>
              )}
            </h2>
            <p style={{ margin: 0, marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub }}>
````

**`src/components/matching-fil/FilConclure.tsx`**, 4/4 — remplacer (exact) :

````tsx
            </p>
            {bien.marche
              ? lienAnnonce && (
                <a href={lienAnnonce} target="_blank" rel="noopener noreferrer" style={{ ...lien, display: 'inline-block', marginTop: 'var(--crm-space-sm)' }}>
                  {t('fil.conclure.voirAnnonce')}
                </a>
              )
              : <button type="button" onClick={onVoirBien} style={{ ...lien, marginTop: 'var(--crm-space-sm)' }}>{t('fil.voirBien')}</button>}
          </div>
````

par :

````tsx
            </p>
          </div>
````

**`src/i18n/locales/fr/matching.json`** — remplacer (exact) :

````json
    "votreBien": "Votre bien",
    "voirBien": "Voir le bien",
    "sansPhoto": "Pas de photo",
````

par :

````json
    "votreBien": "Votre bien",
    "sansPhoto": "Pas de photo",
````

**`src/i18n/locales/en/matching.json`** — remplacer (exact) :

````json
    "votreBien": "Your property",
    "voirBien": "View property",
    "sansPhoto": "No photo",
````

par :

````json
    "votreBien": "Your property",
    "sansPhoto": "No photo",
````

**`src/i18n/locales/de/matching.json`** — remplacer (exact) :

````json
    "votreBien": "Ihr Objekt",
    "voirBien": "Objekt ansehen",
    "sansPhoto": "Kein Foto",
````

par :

````json
    "votreBien": "Ihr Objekt",
    "sansPhoto": "Kein Foto",
````

**`src/i18n/locales/it/matching.json`** — remplacer (exact) :

````json
    "votreBien": "Il Suo immobile",
    "voirBien": "Vedi l'immobile",
    "sansPhoto": "Nessuna foto",
````

par :

````json
    "votreBien": "Il Suo immobile",
    "sansPhoto": "Nessuna foto",
````

- [ ] **Étape 4 — elle passe**, avec les specs de rendu voisines du fil.

```bash
npx vitest run tests/unit/fil-qui-pour-conclure.spec.tsx tests/unit/fil-baisse.spec.tsx tests/unit/matching-fil-etats.spec.tsx tests/unit/matching-fil-focus.spec.tsx tests/unit/matching-fil-recherches.spec.tsx
```

Attendu : `Test Files  5 passed (5)`, `Tests  40 passed (40)`.

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

Attendu : `tsc`, eslint, `lint:deadcode`, `lint:i18n-keys`, `i18n:parity:ci`, `i18n:coverage:ci`, `lint:i18n` et `lint:prose` à 0 ; la suite : `Test Files  3 failed | 372 passed (375)`, `Tests  1 failed | 5523 passed | 3 skipped (5527)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 6 — photographier l'arbre du commit 10** (« style(matching): « Qui pour ce bien ? » et « À conclure » allégés ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C10
```

Attendu : `C10` suivi des huit premiers caractères de l'arbre.


---

## Tâche 8 : Les docs

La feuille de route (le fil épuré dans l'étape 5b ; « la densité du panneau d'un match » quitte l'« En attente » de la revue UX, et « Recherches à ajuster » y prend son nom neuf ; un « En attente » de la conception), le CHANGELOG, la carte système (la route `matching`), le cerveau — une entrée à part, `megga/matching-fil-epure`, sous les 512 jetons que lit le modèle de sa recherche (all-MiniLM-L6-v2). La conception et ce plan entrent dans le même commit.

**Fichiers :**

- Modifier : `docs/superpowers/feuille-de-route.md`
- Modifier : `docs/CHANGELOG.md`
- Modifier : `docs/system-map.md`
- Modifier : `.claude-flow/knowledge/megga-memory.seed.json`

- [ ] **Étape 1 — le code.** Dans l'ordre :

**`docs/superpowers/feuille-de-route.md`**, 1/2 — remplacer (exact) :

````md
| 5b | **Pipeline et KYC branchés sur le matching** | Juste après la fusion (Julien, 29.09.2026). La fiche d'une affaire dit l'état de chaque bien (à proposer, proposé, intéressé), écarte un mandat qui n'est plus en vente et écrit le score comme le fil ; son historique dit d'où vient l'affaire (proposé, intéressé, visite planifiée depuis le matching — le journal porte déjà l'affaire). Le KYC refait, commité dans sa session, lit les rôles du contact et met en tête l'acheteur qui a une visite planifiée ou une offre en cours (il ne lit aujourd'hui que le nom). La cohérence visuelle relevée par la revue UX (paragraphe « Juste après la fusion », sous ce tableau). En petites mises à jour, relues une par une. | **en cours** : la cohérence visuelle commitée le 30.09.2026 (paragraphe « Juste après la fusion ») ; **5b-1, la fiche d'affaire branchée sur le matching**, sur `megga/fiche-affaire-matching`, sans migration : [conception](specs/2026-09-30-fiche-affaire-matching-design.md) validée section par section et [plan](plans/2026-09-30-fiche-affaire-matching.md) écrit le 30.09.2026 (joué dans une copie témoin, puis rejoué d'un bloc sur une copie neuve de `main`) ; tâches 1 à 8 exécutées le même jour, chacune relue deux fois, en conformité puis en qualité (écarts à la fin du plan) ; commits au signal de Julien ; reste **5b-2, le KYC**, une fois le KYC refait commité dans sa session et ramené sur `main` (54 commits de retard, ~35 points de conflit mesurés le 30.09.2026 ; §10 de la conception) |
````

par :

````md
| 5b | **Pipeline et KYC branchés sur le matching** | Juste après la fusion (Julien, 29.09.2026). La fiche d'une affaire dit l'état de chaque bien (à proposer, proposé, intéressé), écarte un mandat qui n'est plus en vente et écrit le score comme le fil ; son historique dit d'où vient l'affaire (proposé, intéressé, visite planifiée depuis le matching — le journal porte déjà l'affaire). Le KYC refait, commité dans sa session, lit les rôles du contact et met en tête l'acheteur qui a une visite planifiée ou une offre en cours (il ne lit aujourd'hui que le nom). La cohérence visuelle relevée par la revue UX (paragraphe « Juste après la fusion », sous ce tableau). En petites mises à jour, relues une par une. | **en cours** : la cohérence visuelle commitée le 30.09.2026 (paragraphe « Juste après la fusion ») ; **5b-1, la fiche d'affaire branchée sur le matching**, sur `megga/fiche-affaire-matching`, sans migration : [conception](specs/2026-09-30-fiche-affaire-matching-design.md) validée section par section et [plan](plans/2026-09-30-fiche-affaire-matching.md) écrit le 30.09.2026 (joué dans une copie témoin, puis rejoué d'un bloc sur une copie neuve de `main`) ; tâches 1 à 8 exécutées le même jour, chacune relue deux fois, en conformité puis en qualité (écarts à la fin du plan) ; commits au signal de Julien ; **le fil du Matching épuré**, demandé par Julien le 06.10.2026 (« beaucoup trop chargé au niveau des textes ») — la carte focus, la liste et les panneaux allégés, les touches dans l'infobulle : [conception](specs/2026-10-07-matching-epure-design.md) validée sur maquettes et [plan](plans/2026-10-07-matching-epure.md) écrit le 07.10.2026 (chaque tâche jouée dans une copie jetable, le plan rejoué d'un bloc depuis son texte), exécuté sur la même branche, sans migration, commits au même signal ; reste **5b-2, le KYC**, une fois le KYC refait commité dans sa session et ramené sur `main` (54 commits de retard, ~35 points de conflit mesurés le 30.09.2026 ; §10 de la conception) |
````

**`docs/superpowers/feuille-de-route.md`**, 2/2 — remplacer (exact) :

````md
- **Relevé par la revue UX de la version fusionnée (29.09.2026), à reprendre avec les retours de Gregory** : le fil qui s'ouvre sur « Recherches à ajuster » avant les biens ; la sélection du marché cochée en entier par défaut ; la densité du panneau d'un match (photo en grand, « Pourquoi ce match » sous le pli) ; l'adoption du Kanban et de la Timeline (en production : 4 deals, tous « Nouveau lead »).
````

par :

````md
- **Relevé par la conception du fil épuré (07.10.2026)** : la liste des acquéreurs de « Qui pour ce bien ? » (`QuiPourCeBien`), partagée avec les fiches d'un mandat et d'une annonce, garde ses textes — à alléger avec ces fiches ; l'écran Matching du téléphone n'est pas épuré (étape 5c).
- **Relevé par la revue UX de la version fusionnée (29.09.2026), à reprendre avec les retours de Gregory** : le fil qui s'ouvre sur « À ajuster » (les recherches à ajuster) avant les biens ; la sélection du marché cochée en entier par défaut ; l'adoption du Kanban et de la Timeline (en production : 4 deals, tous « Nouveau lead »).
````

**`docs/CHANGELOG.md`** — remplacer (exact) :

````md
---

### ✅ Fonctionnalités LIVE

#### Pipeline · la fiche d'affaire branchée sur le matching (30 septembre 2026 — étape 5b-1, sur la branche `megga/fiche-affaire-matching`, PAS en production)
> Sert les objectifs 1 (temps administratif) et 3 (closing). Aucune migration, rien n'est écrit en base, rien ne part vers l'acheteur. [Conception](superpowers/specs/2026-09-30-fiche-affaire-matching-design.md), [plan](superpowers/plans/2026-09-30-fiche-affaire-matching.md).
````

par :

````md
---

### ✅ Fonctionnalités LIVE

#### Matching · le fil épuré (7 octobre 2026 — sur la branche `megga/fiche-affaire-matching`, PAS en production)
> Demandé par Julien le 06.10.2026 : « beaucoup trop chargé au niveau des textes ». Sert l'objectif 1 (temps administratif). Côté écran seulement : aucune migration ; les gestes, le clavier et les lectures ne changent pas ; rien ne part vers l'acheteur. [Conception](superpowers/specs/2026-10-07-matching-epure-design.md), [plan](superpowers/plans/2026-10-07-matching-epure.md).

- **Le panneau d'un match en carte focus** (`FilPanneau`) : la photo en grand (280 px), le prix — et sa baisse en flèche — et le score posés dessus ; le titre mène au bien, le nom au contact, le KYC en bouclier ; « 4 critères sur 4 » déplie le tableau des critères, la phrase du signal et ce qui a déjà été proposé, replié à chaque match ; « Écarter » et « Plus tard » en boutons-icônes nommés, « Proposé » en principal.
- **Les touches passent dans l'infobulle** (`FilBouton`) : « Je l'ai proposé à Anastasia · E » au survol, et `aria-keyshortcuts` ; aucune touche n'est plus écrite sur un bouton.
- **La liste « À proposer » allégée** (`FilListe`) : « À ajuster », « Vos biens », « Marché » ; l'en-tête d'un bien, son prix (et sa baisse en flèche) ou une pastille « Nouveau » ; une sélection du marché, « 4 biens · ↓ 1 · ⚡ 1 », chaque compteur nommé au survol ; les reportés, une horloge et « 1 reporté ».
- **Les trois panneaux allégés** : « À ajuster » (`FilCorrection`) — la pastille « Prix · 2 refus », les biens refusés en « CHF … · 30.09 », chaque correction en avant → après, « Ajuster » ; « En attente » (`FilRetours`) — une pastille « Relance » quand elle est due, les biens en « CHF … · 27.09 » ; la sélection du marché (`FilSelection`) — sa recherche repliée derrière un chevron, chaque ligne réduite au titre et au prix (sa baisse en flèche, ou la pastille « Nouveau »), une alerte pour un écart à vérifier, « Proposé · 2 ».
- **« Qui pour ce bien ? » et « À conclure »** : le titre mène au bien (« Voir le bien » quitte les quatre langues), le prix seul et la pastille « Nouveau » ; l'annonce d'origine en icône à côté du titre ; « Rien n'est envoyé à … » reste.
- **Gardes** : `fil-bouton`, `fil-panneau`, `fil-liste`, `fil-correction`, `fil-retours`, `fil-selection`, `fil-qui-pour-conclure`, sur les vrais composants ; et `fil-baisse`, la flèche de baisse du 01.10.2026 (`FilBaisse`). Détail : cerveau `megga/matching-fil-epure`.

#### Pipeline · la fiche d'affaire branchée sur le matching (30 septembre 2026 — étape 5b-1, sur la branche `megga/fiche-affaire-matching`, PAS en production)
> Sert les objectifs 1 (temps administratif) et 3 (closing). Aucune migration, rien n'est écrit en base, rien ne part vers l'acheteur. [Conception](superpowers/specs/2026-09-30-fiche-affaire-matching-design.md), [plan](superpowers/plans/2026-09-30-fiche-affaire-matching.md).
````

**`docs/system-map.md`** — remplacer (exact) :

````md
`matching` (**refonte pager juil. 2026, PR #813** : conteneur `MatchingPage` — page 0 = **le fil de matchs** depuis le lot E1 (29.09.2026, sur branche, fusion à la fin), sur lequel « Matching » s'ouvre ; c'était l'atelier triptyque embarqué, retiré par ce lot avec sa page, sa feuille `atelier.css` et son banc `/dev/matching-atelier` ; page 1 = recherche hybride marché. Le pager entier s'éprouve désormais sur `/dev/crm` (surface « Matching · fil », `matchingFilBanc.tsx`) : mécanique de production, le vrai fil sur les fixtures du banc, la Recherche en démo dans l'état choisi au menu. **Porté en MEGGA X le 13 août 2026** — `atelier.css` était un second système de jetons resté sur Sugar Pure, qu'aucune garde n'ouvrait ; carte `MrhMapView` **gelée** par décision, exemption écrite dans le cliquet. Cf. `megga/matching-meggax`, `megga/matching-bascule-bureau`) · `journey` · `calendar` (Google/Outlook ; **libellés de l'agence** depuis le 13.09.2026 — même modèle que la Messagerie, un par événement, la couleur du libellé prend le bloc, clic droit sur un bloc pour poser, clic droit dans le rail pour renommer/recolorer/supprimer ; lecture et écriture par deux RPC hors de la requête des événements. Cf. `megga/calendrier-libelles` ; **glisser-déposer d'un jour à l'autre** depuis le 14.09.2026 — Semaine et Mois, visites ET tâches enregistrées (une tâche déplacée ne l'était jamais), RDV KYC verrouillés parce que le client doit être prévenu. Cf. `megga/calendrier-glisse-jours` ; **des ÉVÉNEMENTS gardés tels qu'on les saisit** depuis le 15.09.2026 — table `calendar_events` (20260915080300) : tout ce qui n'est ni une visite, ni une tâche, ni un RDV KYC y garde titre, type, fin, journée entière, récurrence ; il partait en `reminders` et revenait « Tâche ». La tâche reste une relance, mais son titre est RELU (« [Titre] notes »). « Planifier » depuis un e-mail ouvre le Calendrier dans un onglet neuf sur la création pré-remplie (brouillon EN MÉMOIRE, jamais dans l'URL — `crm_open_tabs` la range côté serveur), et la bulle de l'événement rouvre l'e-mail d'origine (`?fil=`). Cf. `megga/calendrier-evenements`) ·
````

par :

````md
`matching` (**refonte pager juil. 2026, PR #813** : conteneur `MatchingPage` — page 0 = **le fil de matchs** depuis le lot E1 (29.09.2026, sur branche, fusion à la fin), sur lequel « Matching » s'ouvre ; **épuré le 07.10.2026** (sur la branche `megga/fiche-affaire-matching`) : le panneau d'un match en carte focus, des sous-titres courts, les touches dans l'infobulle — cerveau `megga/matching-fil-epure` ; c'était l'atelier triptyque embarqué, retiré par ce lot avec sa page, sa feuille `atelier.css` et son banc `/dev/matching-atelier` ; page 1 = recherche hybride marché. Le pager entier s'éprouve désormais sur `/dev/crm` (surface « Matching · fil », `matchingFilBanc.tsx`) : mécanique de production, le vrai fil sur les fixtures du banc, la Recherche en démo dans l'état choisi au menu. **Porté en MEGGA X le 13 août 2026** — `atelier.css` était un second système de jetons resté sur Sugar Pure, qu'aucune garde n'ouvrait ; carte `MrhMapView` **gelée** par décision, exemption écrite dans le cliquet. Cf. `megga/matching-meggax`, `megga/matching-bascule-bureau`) · `journey` · `calendar` (Google/Outlook ; **libellés de l'agence** depuis le 13.09.2026 — même modèle que la Messagerie, un par événement, la couleur du libellé prend le bloc, clic droit sur un bloc pour poser, clic droit dans le rail pour renommer/recolorer/supprimer ; lecture et écriture par deux RPC hors de la requête des événements. Cf. `megga/calendrier-libelles` ; **glisser-déposer d'un jour à l'autre** depuis le 14.09.2026 — Semaine et Mois, visites ET tâches enregistrées (une tâche déplacée ne l'était jamais), RDV KYC verrouillés parce que le client doit être prévenu. Cf. `megga/calendrier-glisse-jours` ; **des ÉVÉNEMENTS gardés tels qu'on les saisit** depuis le 15.09.2026 — table `calendar_events` (20260915080300) : tout ce qui n'est ni une visite, ni une tâche, ni un RDV KYC y garde titre, type, fin, journée entière, récurrence ; il partait en `reminders` et revenait « Tâche ». La tâche reste une relance, mais son titre est RELU (« [Titre] notes »). « Planifier » depuis un e-mail ouvre le Calendrier dans un onglet neuf sur la création pré-remplie (brouillon EN MÉMOIRE, jamais dans l'URL — `crm_open_tabs` la range côté serveur), et la bulle de l'événement rouvre l'e-mail d'origine (`?fil=`). Cf. `megga/calendrier-evenements`) ·
````

**`.claude-flow/knowledge/megga-memory.seed.json`** — remplacer (exact) :

````json
    {
      "key": "megga/matching-sans-sortie",
````

par :

````json
    {
      "key": "megga/matching-fil-epure",
      "namespace": "megga",
      "value": "MATCHING · LE FIL ÉPURÉ (07.10.2026, branche megga/fiche-affaire-matching ; Julien : « beaucoup trop chargé au niveau des textes »). Une donnée ou rien ; retirer du texte, jamais une affordance ; gestes, clavier et lectures inchangés. CARTE FOCUS (FilPanneau) : photo de 280 px, prix (sa baisse en flèche, FilBaisse) et score posés dessus ; le titre mène au bien, le nom au contact, le KYC en bouclier ; « 4 critères sur 4 » déplie le tableau, le signal et « Déjà proposé », replié à chaque match ; Écarter et Plus tard en icônes, le principal dit « Proposé ». TOUCHES (FilBouton) : plus de kbd sur la face ; infobulle « Je l'ai proposé à Anastasia · E » et aria-keyshortcuts. LISTE (FilListe) : « À ajuster » (ex-« Recherches à ajuster »), « Marché » ; l'en-tête d'un bien, son prix ou la pastille « Nouveau » ; une sélection, « 4 biens · ↓ 1 · ⚡ 1 » (bolt : la sparkle reste à l'IA). PANNEAUX : FilCorrection (« Prix · 2 refus », avant → après, « Ajuster »), FilRetours (pastille « Relance »), FilSelection (recherche repliée, « Proposé · 2 »), FilQuiPourCeBien et FilConclure (le titre est le lien, fil.voirBien retirée). megga/matching-boucle et megga/matching-fil gardent les anciens libellés. Conception docs/superpowers/specs/2026-10-07-matching-epure-design.md, plan docs/superpowers/plans/2026-10-07-matching-epure.md.",
      "tags": "matching,fil,epure,carte-focus,infobulle,raccourcis,regle-1,frontend,2026-10-07"
    },
    {
      "key": "megga/matching-sans-sortie",
````

- [ ] **Étape 2 — les contrôles.**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-flow/knowledge/megga-memory.seed.json','utf8'))" && npm run -s lint:claude-md
```

Attendu : `✓ Fraîcheur : 24 prétention(s) chiffrée(s) vérifiées sur 2 document(s) (CLAUDE.md, docs/system-map.md), aucun écart.`, puis l’avertissement des 17 prétentions de base non mesurées sans `SUPABASE_ACCESS_TOKEN` — attendu, ne pas le compter comme vert.

- [ ] **Étape 3 — le cerveau rechargé** (local : `.swarm/`, ignoré par git).

```bash
npm run ruflo:seed
```

Attendu : `[ruflo-seed] comptage OK : 321/321 entrées importées.` puis `[ruflo-seed] recall OK (3 domaines).`

- [ ] **Étape 4 — photographier l'arbre du commit 11** (« docs(matching): le fil épuré — conception, plan, feuille de route, carte, cerveau ») : ni ref, ni commit.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py photo C11
```

Attendu : `C11` suivi des huit premiers caractères de l'arbre.


---

## Tâche 9 : vérification, captures, commits

- [ ] **Étape 1 — les portes.**

```bash
npx tsc -b --force && npx eslint src tests --quiet
```

```bash
bash -c 'for g in lint:prose lint:i18n lint:i18n-keys lint:deadcode lint:deps lint:types-freshness lint:roster lint:edge-auth lint:email-shell lint:migrations lint:whatsapp-outbound lint:spec-sql i18n:parity:ci i18n:coverage:ci check:privileges; do printf "%-28s" "$g"; npm run --silent $g >/dev/null 2>&1 && echo "✓" || echo "✗"; done'
```

Attendu : `tsc` et eslint à 0 ; « ✓ » pour les quatorze premières portes. `check:privileges` rend « ✗ » sans `SUPABASE_ACCESS_TOKEN` (« SUPABASE_ACCESS_TOKEN manquant — ce contrôle interroge la base de production. », mesuré au rejeu) : ne pas la compter verte pour autant.

- [ ] **Étape 2 — la suite unitaire, SEULE.**

```bash
npx vitest run
```

Attendu : `Test Files  3 failed | 372 passed (375)`, `Tests  1 failed | 5523 passed | 3 skipped (5527)` — les trois fichiers connus, rien d'autre.

- [ ] **Étape 3 — le build.**

```bash
npm run build && rm -rf dist
```

Attendu : sortie 0 ; `MatchingPage-*.js` pèse 183,70 kB et `MatchingPage-*.css` 2,95 kB (mesurés au rejeu). Le build n'écrit rien hors de `dist/`.

- [ ] **Étape 4 — les bancs e2e** (port 5199 libre, étape 0.4) :

```bash
npx playwright test --config=playwright.bancs.config.ts
```

Attendu : `85 passed`.

- [ ] **Étape 5 — les captures du banc, en clair et en sombre**, HORS du dépôt, avec la configuration de revue de l'étape 5b-1 (`/Users/megga/.cache/megga-5b1/revue/playwright.config.ts` : le banc du worktree servi sur 5199, jamais 5173). Créer **`/Users/megga/.cache/megga-5b1/revue/matching-epure.spec.ts`** :

````ts
/**
 * Le fil épuré, sur le Matching du banc, en clair et en sombre : la carte focus (Anastasia Volkova, l'attique de
 * Florissant), « À ajuster » (Julie Morand, deux refus pour le prix), sa sélection du marché, « Qui pour ce bien ? »
 * (l'attique), « En attente » (Emma Schneider, sa relance due), « À conclure » (Emma, une annonce du marché à
 * Enge) ; puis la carte, critères dépliés.
 */
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const CAPTURES = join(__dirname, '..', 'captures', 'epure')
const SURFACES = [
  ['carte', 'ligne=m22'],
  ['ajuster', 'ligne=correction:cs9:prix'],
  ['marche', 'ligne=marche:c9'],
  ['qui-pour', 'ligne=bien:p3'],
  ['attente', 'attente=c7'],
  ['conclure', 'onglet=aConclure&ligne=m17'],
] as const

async function ouvrir(page: Page, requete: string, theme: 'clair' | 'sombre'): Promise<void> {
  await page.addInitScript((d) => { window.localStorage.setItem('megga.crm.dark', d) }, theme === 'sombre' ? '1' : '0')
  await page.goto(`/dev/crm?entree=${encodeURIComponent(`/dashboard/matching?${requete}`)}`)
  await page.locator('.banc-pastille').waitFor({ state: 'visible', timeout: 60_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1800)
}

for (const theme of ['clair', 'sombre'] as const) {
  for (const [nom, requete] of SURFACES) {
    test(`${nom} ${theme}`, async ({ page }) => {
      await ouvrir(page, requete, theme)
      await page.mouse.move(1435, 5)
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(CAPTURES, `${nom}-${theme}.png`) })
    })
  }
}

test('la carte focus, ses critères dépliés', async ({ page }) => {
  await ouvrir(page, 'ligne=m22', 'clair')
  const critères = page.getByRole('button', { name: /critères sur/ })
  await expect(critères).toHaveAttribute('aria-expanded', 'false')
  await critères.click()
  await expect(critères).toHaveAttribute('aria-expanded', 'true')
  await page.mouse.move(1435, 5)
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(CAPTURES, 'carte-deplie-clair.png') })
})
````

```bash
cd /Users/megga/.cache/megga-5b1 && npx playwright test --config=revue/playwright.config.ts matching-epure
```

Attendu : `13 passed`, et treize images dans `/Users/megga/.cache/megga-5b1/captures/epure/`. Les dates du banc sont relatives au jour de la capture. Les regarder toutes :

- `carte-clair.png`, `carte-sombre.png` — Anastasia Volkova et l'attique de Florissant : la photo en grand, « Nouveau » en haut à gauche, « CHF 2'350'000 » en bas à gauche, « ● 100 » en bas à droite, en pastilles au fond de la carte ; le titre, l'acheteur et son bouclier ; « 8 critères sur 8 », replié ; deux boutons ronds (croix, horloge) et « Proposé ». Dans la liste : « À ajuster », « Vos biens », « Marché » ; l'en-tête de l'attique, son prix et « Nouveau » ; la sélection d'Emma Schneider, « 4 biens · ↓ 1 » ; Antoine Lefèvre, « ↓ CHF 250'000 ».
- `carte-deplie-clair.png` — la même, dépliée : « Nouveau mandat du … », puis le tableau Critère · Recherché · Ce bien.
- `ajuster-clair.png`, `ajuster-sombre.png` — Julie Morand : « Prix · 2 refus » en pastille ; deux biens refusés en « CHF … · date », la note de l'acheteur sous le second ; « Budget max » : « CHF 1'600'000 » barré, une flèche, « 1'550'000 » dans le champ ; « Ignorer », « Ajuster ».
- `marche-clair.png`, `marche-sombre.png` — la sélection de Julie Morand : son nom et un chevron ; quatre biens au prix seul, une alerte sur ceux qui ont un écart, le score, la croix ; « Proposé · 1 ».
- `qui-pour-clair.png`, `qui-pour-sombre.png` — l'attique de Florissant : le titre en grand, « CHF 2'350'000 » et « Nouveau » ; ni la pastille « Qui pour ce bien ? », ni l'adresse, ni « Voir le bien » ; puis la liste des acquéreurs, inchangée.
- `attente-clair.png`, `attente-sombre.png` — Emma Schneider : son nom et la pastille « Relance » ; deux biens proposés en « CHF … · date » ; « Intéressé », « Pas intéressé », « Pas encore », sans touche écrite.
- `conclure-clair.png`, `conclure-sombre.png` — Emma Schneider et l'appartement d'Enge, une annonce du marché : le titre et l'icône de l'annonce d'origine à côté ; « Intéressé·e le … », le formulaire de visite, « Rien n'est envoyé à Emma. »

Les montrer à Julien.

- [ ] **Étape 6 — les sept photos du fil épuré, vérifiées SEULES** (chacune dans une copie jetable liée au `node_modules` du dossier principal ; la suite unitaire y tourne seule) :

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py verifier C5
```

Attendu, pour chacune des sept photos, de C5 à C11 : `tsc=0`, `eslint=0`, `deadcode=0`, `i18n-keys=0`, `parity=0`, `coverage=0`, `i18n=0`, `prose=0`, et `vitest=1` avec pour seuls échecs les trois fichiers connus. Les suites mesurées au rejeu : C5 `5487 passed` (l'état de départ) ; C6 `5491` ; C7 `5497` ; C8 `5502` ; C9 `5518` ; C10 et C11 `5523`.

- [ ] **Étape 7 — les commits, AU SIGNAL de Julien (« committe »).** Pas avant.

```bash
python3 /Users/megga/.cache/megga-5b1/commits_5b1.py commiter
```

Attendu : une ligne « huit caractères du commit, puis son message » par commit créé, dans l'ordre — douze de C0 à C11, ou sept de C5 à C11 si l'étape 5b-1 a été commitée d'abord —, puis `status : propre`. Les messages du fil épuré, et ce que chacun porte :

| Commit | Message | Tâches |
|---|---|---|
| 5 | `style(matching): une baisse de prix se lit en flèche sur les lignes du fil` | la flèche du 01.10.2026, étape 0 |
| 6 | `style(matching): les touches du fil passent dans l'infobulle` | 1 |
| 7 | `style(matching): le panneau d'un match en carte focus` | 2 |
| 8 | `style(matching): la liste « À proposer » allégée` | 3 |
| 9 | `style(matching): recherche à ajuster, en attente et sélection du marché allégées` | 4 à 6 |
| 10 | `style(matching): « Qui pour ce bien ? » et « À conclure » allégés` | 7 |
| 11 | `docs(matching): le fil épuré — conception, plan, feuille de route, carte, cerveau` | 8, avec la conception et ce plan |

⛔ **Jamais de push** sans la demande de Julien. Le script refuse de commiter si la branche a changé, si `HEAD` ne porte pas les photos déjà commitées, ou si l'arbre a bougé depuis la dernière photo.

---

## Décisions prises (rappel)

Toutes de Julien.

1. **Le panneau d'un match en carte focus** (direction B, 07.10.2026), plutôt qu'élaguer le panneau actuel (A).
2. **La liste allégée** et **les trois panneaux allégés** (07.10.2026), sur maquettes, avec les données du banc.
3. **La baisse en flèche** (01.10.2026 : « une flèche qui descend vers le bas … plutôt que du texte ») — déjà dans le worktree, commit C5.
4. **Le fil épuré entre dans l'étape 5b** (la cohérence visuelle de la revue UX), à sa demande du 06.10.2026 ; il ne touche ni le téléphone (5c) ni la liste partagée « Qui pour ce bien ? ».

## En attente (hors périmètre — rien n'est fait sans accord de Julien)

- **De la conception (§12)** : la liste partagée `QuiPourCeBien`, sur les fiches d'un mandat et d'une annonce ; le Matching du téléphone (étape 5c, lot E2) ; les autres points de la revue UX — le fil qui s'ouvre sur « À ajuster » avant les biens, la sélection du marché cochée en entier par défaut.
- **Relevé à l'écriture du plan (07.10.2026)** :
  - Une infobulle native (`title`) ne paraît ni au clavier ni au toucher : les libellés des boutons-icônes (« Écarter », « Plus tard ») et les touches s'y lisent à la souris ; `aria-label` et `aria-keyshortcuts` portent le reste pour un lecteur d'écran. Une infobulle montrée au focus irait plus loin — à trancher pour tout le CRM, pas pour le seul fil.
  - Les entrées `megga/matching-boucle` et `megga/matching-fil` du cerveau écrivent encore les anciens libellés (« Recherches à ajuster », « J'ai proposé N biens à … ») ; l'entrée `megga/matching-fil-epure` donne les nouveaux. Les reprendre, c'est réécrire deux entrées de 8 052 et 5 645 caractères.
- **Relevé à l'exécution (07.10.2026)** :
  - À montrer à Julien, décidé à l'exécution sans lui : le bouclier NU d'un KYC non vérifié — `shield-plain`, glyphe neuf de MEIcon (`shield` porte une coche : « à compléter » s'affichait coché, en gris) ; sur l'en-tête CHOISI d'un bien neuf, la pastille « Nouveau » qui cède sa place à l'invite « Qui pour ce bien ? » (les deux ne laissaient au titre et au prix que 23 px d'une colonne de 300). À regarder sur les captures de la tâche 9.
  - Deux boutons du fil écrivent encore leur touche sur leur face, hors de `FilBouton` : les motifs de refus (`FilMotifs`, 1 à n, dans « En attente » et « À conclure ») et le second geste de la barre d'annulation (`FilAnnulation`). Le §2 de la conception (« les touches quittent la face des boutons ») les couvre-t-il ?
  - L'éclair `bolt` de MEIcon est un glyphe PLEIN (PxIconFont `lightning`), à côté d'une flèche au trait sur la ligne d'une sélection. Le redessiner au trait dans MEIcon change aussi Labs, « à suivre » de Mes biens, Aujourd'hui, la console et trois écrans mobiles. Correctif prêt, hors dépôt : `/Users/megga/.cache/megga-5b1/epure/t3-eclair-trait.patch` (le tracé de l'éclair de la fiche bien).
  - Un nom très long pousse la pastille d'un en-tête de panneau (« À ajuster », « En attente ») hors de sa rangée sous ~300 px — la sélection n'en porte plus depuis la tâche 6 (son nom, puis un chevron) ; `minWidth: 0` seul fait pire (le nom recouvre la pastille). Correctif prêt, avec `overflowWrap: 'anywhere'` (coupe disgracieuse d'un nom composé) : `/Users/megga/.cache/megga-5b1/epure/qualite-T5-nom-long.patch` — ou la pastille sous le nom : un choix de mise en page.
  - Les titres-liens du fil (carte focus, « Qui pour ce bien ? », « À conclure ») sont des boutons à l'encre, sans soulignement au survol : seul le curseur les signale, là où « Voir le bien », en accent, était une affordance visible. Ni clic-milieu, ni adresse au survol : un `<a href>` + `navigate` se déciderait pour tous à la fois.
  - Le matching du téléphone (`MmKyc.tsx`) dessine encore un KYC « à compléter » avec le bouclier COCHÉ : à reprendre avec l'étape 5c (le glyphe `shield-plain` existe désormais).
  - ⛔ Aucune porte ne vérifie le TYPE d'une spec : aucun tsconfig n'inclut `tests/`, eslint n'est pas typé, vitest transpile sans vérifier, la CI ne lance que `tsc -b`. Mesuré sur `tests/unit` (tsconfig d'essai) : 64 erreurs, dont 29 de vraie dérive dans 13 specs — `matching-fil-gestes.spec.ts` passe un `email` qu'`AcheteurGeste` n'a plus : le scénario que la fixture installe n'atteint plus le code. Un tsconfig des specs et une porte, après ces 29.
  - Gardés par aucune spec, antérieurs au fil épuré : la garde du double clic de `FilBouton` (`unSeulClic` — le seul double clic éprouvé est celui de la croix de la sélection, dans `fil-selection`) ; la touche E d'une sélection du marché (le clavier du fil n'a pour garde que `matching-fil-focus`). Le `data-bien` et l'`aria-expanded` de `FilBouton` le sont désormais par `fil-retours`, son `disabled` par `fil-correction`.
  - Une case de la sélection ne dit à un lecteur d'écran que « Inclure « … » » : son prix et son écart n'y entrent pas.
  - Une annonce d'« À conclure » a sa fiche dans le CRM (`/dashboard/market/:externalId`), mais le fil n'y mène pas.
  - « 1 of 1 criteria » / « 1 von 1 Kriterien » au cas d'un seul critère (l'anglais et l'allemand accordent sur le total) ; le dépôt tolère déjà ce cas ailleurs.

## Écarts à l'exécution (07.10.2026) — le code du dépôt fait foi

Les tâches 1 à 8 ont été exécutées le 07.10.2026, chacune par un sous-agent : appliquée à la lettre — chaque bloc s'est trouvé, chaque « Attendu » a été tenu —, puis relue deux fois, en conformité (mutants joués hors du dépôt, pour les tâches 1 à 7), puis en qualité, et reprise jusqu'à ce que les deux passent. La 9, ensuite : portes, suite unitaire, build, bancs, captures, arbres vérifiés seuls, puis commits au signal de Julien.

⛔ **Les blocs de code des tâches ci-dessus décrivent l'état AVANT les relectures, et ne sont pas réécrits : les commits font foi.** Rejoué aujourd'hui, le plan réintroduirait des gardes trop lâches et les défauts que les relectures ont corrigés — un KYC « à compléter » dessiné coché, un lecteur d'écran qui n'entend ni le signal d'un en-tête de bien, ni l'ancien d'une correction de quartiers ou de type, une information perdue dans la sélection du marché, entre autres. Les tâches en aval ont été lancées sur des consignes corrigées de ces changements (les comptes de la suite, surtout), que les blocs ci-dessus ne reprennent pas.

⛔ **Le même défaut, sept fois : la garde écrite avec le plan.** Le plan avait été rejoué à l'octet depuis son texte ; ses gardes, elles, n'avaient jamais été éprouvées par des mutants. Chaque relecture de conformité en a trouvé une trop lâche — mutants survivants sur mutants joués : tâche 1, 7 sur 24 ; tâche 2, 34 sur 55 ; tâche 3, 29 sur 48 ; tâche 4, 42 sur 65 ; tâche 5, 28 sur 47 ; tâche 6, 70 sur 93 ; tâche 7, 37 sur 62. Les codes, eux, étaient conformes. Leçon pour le prochain plan : jouer les mutants AVANT d'écrire la garde dans le plan, pas à la relecture.

⚠ **Les « Attendu » chiffrés ne tombent plus juste**, et c'est attendu : les gardes renforcées comptent 5 584 tests réussis à la fin de la tâche 7, contre 5 523 au rejeu du plan. `tsc`, eslint et les portes restent à 0 ; la suite n'échoue que sur les trois fichiers connus.

- **Étape 0** — Comme écrite : le script généralisé, la flèche photographiée en C5 (`f8149cf7`), aucun écart avec C4 hors ses cinq fichiers.
- **Tâche 1** — Spec renforcée (la touche en `aria-keyshortcuts` sur un bouton-icône et sur le principal, l'icône comparée au tracé de MEIcon, le rond — hauteur, largeur, marges nulles, rayon de pilule — et la bordure, un bouton-icône sans touche) : 24 mutants tués. Qualité : le type de `FilBouton` est FERMÉ (`FormeFilBouton`, une union sur l'idiome de `MxLink`) — un bouton-icône exige son `libelle`, sans quoi il n'a pas de nom accessible ; l'infobulle branche sur la touche d'abord (un `libelle` vide ne fait plus disparaître le raccourci) ; `flex: none` sur un bouton-icône ; le commentaire de `FilAnnulation.tsx`, que la tâche rendait faux (fichier hors de la liste).
- **Tâche 2** — Spec renforcée : 13 tests, 55 mutants tués (rien de « sur la photo » n'était vérifié). Qualité : ⛔ le bouclier KYC portait une COCHE dans les quatre états (`shield` est un bouclier coché) — un glyphe neuf, `shield-plain`, dans `MEIcon.tsx` (hors de la liste), pour un KYC non vérifié ; l'atome `FilNouveau` (le mot visible, son libellé au survol ET en `sr-only`), que les tâches 3, 6 et 7 ont repris au lieu de leur pastille en ligne ; `referrerPolicy="no-referrer"` sur la photo (Flatfox la refuse sinon) ; `aria-controls` seulement quand le dépli est rendu ; une icône de verdict partagée par la ligne et le tableau ; l'écart dit à un lecteur d'écran ; des commentaires de `filAtomes.tsx` et `filAffichage.ts` que la tâche rendait faux.
- **Tâche 3** — La pastille par `FilNouveau` (contrôleur). Spec renforcée : 12 tests, 48 mutants tués ; elle fige les valeurs des quatre langues et le RETRAIT de `fil.acheteurs` (laissée dans les quatre langues, elle passait toutes les portes). Qualité : ⛔ un lecteur d'écran n'entendait jamais le signal d'un en-tête de bien — l'`aria-label` de l'option couvre son contenu : le signal entre dans ce nom ; `Compteur` doublait `FilBaisse` et en avait déjà divergé — un atome `FilCompteur`, sur lequel `FilBaisse` est bâtie (et une flèche écrite après un texte ne monte plus de 2 px) ; le commentaire de `filApprendre.ts` (« Recherches à ajuster »), hors de la liste. Au contrôle, sur mesure : sur l'en-tête CHOISI d'un mandat neuf, la pastille et l'invite ne laissaient au titre et au prix que 23 px d'une colonne de 300 — la pastille cède sa place à l'invite sur l'en-tête choisi.
- **Tâche 4** — Spec renforcée : 18 tests, 65 mutants tués — AUCUN geste n'était cliqué. Qualité : ⛔ pour les quartiers et le type, l'ancien n'était dit que par `<s>`, que tous les lecteurs d'écran n'annoncent pas — muet, il est dit « aujourd'hui : … », comme un nombre (pour les quartiers, la liste entière d'aujourd'hui) ; des pièces pré-remplies « 4,5 » comme la valeur barrée (et plus « 4.5 ») ; un loyer gardé (« / mois ») ; une cascade d'unités regroupée (`enUnite`). Tranché : sans borne, l'unité n'est pas rendue (le champ ne l'a jamais portée, et elle n'est jamais ambiguë).
- **Tâche 5** — Spec renforcée : 7 tests, 47 mutants tués, plus la garde des clés retirées dans les quatre langues. ⚠ La carte montre le prix d'AUJOURD'HUI, que suit la flèche, et non « le prix proposé » que dit la prose de la tâche : sa spec le figeait déjà, et partout dans le fil « prix + flèche » se lit ainsi (« À ajuster », lui, montre le prix proposé). Qualité : un atome `FilPastille` pour l'état d'un acheteur dans l'en-tête de son panneau (le motif d'« À ajuster », la « Relance »), deux copies qui avaient déjà divergé ; la date de la relance dite aussi à un lecteur d'écran ; le prix d'aujourd'hui écrit comme un choix.
- **Tâche 6** — La pastille par `FilNouveau` (contrôleur). Spec renforcée : 18 tests, 93 mutants tués — deux assertions passaient même quand l'élément visé avait disparu. Qualité : ⛔ une INFORMATION perdue — un bien du marché refusé pour le prix puis revenu ne disait plus nulle part qu'il avait été refusé, ni à quel prix — ni, d'une baisse du marché, sa date : la flèche garde son dessin, son infobulle et son `sr-only` portent la phrase du dépli (`texteSignalMatch`) ; l'écart n° 6 s'élargit donc à TROIS phrases passées dans l'infobulle. Aussi : la croix d'« Écarter » portée à 24 × 24 (WCAG 2.5.8) ; `aria-controls` comme la carte focus ; un « ? » en sourdine, et non l'alerte grise, pour un bien sans verdict ou sans critère (en clair, l'ambre et la sourdine ont presque la même luminance) ; ⛔ un contresens allemand, « Ihre Suche » (« votre recherche ») → « Suchkriterien » — le bloc du plan dit encore l'ancien ; un commentaire de `useSelectionMarche.ts` remis juste, hors de la liste.
- **Tâche 7** — La pastille par `FilNouveau` (contrôleur). Spec renforcée : 16 tests, 59 mutants sur 62 tués ; des trois survivants, deux étaient neutres (la pastille et l'adresse d'« À conclure », épinglées ensuite par la qualité), le troisième l'état d'un mandat hors vente (lot E1), gardé par rien : le contrôle lui a donné son test (17), la qualité un autre — une baisse jamais « Nouveau » (18). Qualité, approuvée : « À conclure » GARDE sa pastille « Votre bien » / « Marché » et l'adresse — où la visite s'écrira, et le lieu qu'elle écrira, relu avant de confirmer —, écrit dans le code et épinglé par la spec ; « Qui pour ce bien ? » écarte une baisse de sa pastille ; un style mort retiré.
- **Tâche 8** — Les blocs appliqués à l'octet, puis les textes ajustés au code relu : le CHANGELOG (les atomes, le bouclier nu, le prix d'aujourd'hui, ce qu'« À conclure » garde, les gardes renforcées), la feuille de route (l'exécution ; ce qu'elle et l'écriture du plan ont relevé, dans « En attente » ; « la densité du panneau d'un match » gardée dans la puce de la revue UX et marquée « repris par le fil épuré », comme les points repris par le lot E1, au lieu d'en être retirée), le cerveau (`megga/matching-fil-epure`, 468 jetons sur 512), la carte système (l'incise posée après la phrase de l'atelier retiré, et non avant comme dans le bloc) ; ce plan reçoit ses « En attente » et ces écarts.
- **Tâche 9** — Jouée le 07.10.2026 : `tsc` et eslint à 0 ; les quatorze portes vertes, `check:privileges` rouge sans `SUPABASE_ACCESS_TOKEN`, comme au rejeu ; la suite, 5 583 réussis — hors les trois fichiers connus, `admin-refus-tiroir.spec.tsx` a dépassé son délai de 5 s sous la charge de la suite (la spec de l'erreur jsdom relevée au plan 5b-1, sous une autre forme), verte seule et dans chacun des sept arbres, sans lien avec le fil ; le build à 0, `MatchingPage-*.js` à 182,54 kB (183,70 au rejeu) et `MatchingPage-*.css` à 2,95 kB ; les bancs, 85 réussis ; les treize captures conformes à l'étape 5, en clair et en sombre, montrées à Julien. Les sept arbres, vérifiés seuls ensuite : `tsc`, eslint et les portes à 0 partout, la suite rouge sur les seuls trois fichiers connus — C5 5 487 réussis, C6 5 493, C7 5 506, C8 5 518, C9 5 566, C10 et C11 5 584 (5 491, 5 497, 5 502, 5 518 et 5 523 au rejeu : les gardes renforcées). Cette ligne écrite, la photo C11 est reprise : elle ne diffère de l'arbre vérifié que par ce plan et la feuille de route, qu'aucune porte ni spec ne lit.
