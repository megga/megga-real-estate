# Face publique sous MEGGA X — point de reprise

> Écrit le 16 août 2026, à la fin du chantier de la langue des e-mails, où le défaut a été
> constaté à l'œil : « elles n'ont pas la DA de MEGGA X » (Julien, en regardant
> `/dev/public`).
>
> **Mis à jour le 16 août 2026 — l'étape 1 est TRANCHÉE ET LIVRÉE** (commit `c0a6e719`,
> branche `claude/face-publique-megga-x-2ba9fa`). Ce qui suit distingue ce qui est fait de
> ce qui reste.
>
> ⚠ **Tous les chiffres portent leur date, et se re-mesurent avant d'être crus.** Les
> commandes qui les produisent sont dans le corps du texte, pour qu'on puisse les rejouer
> plutôt que les recopier.

## ⛔ Où vit ce chantier, et le piège de la branche

| Nom | Ce que c'est |
|---|---|
| `claude/face-publique-megga-x-2ba9fa` | **la branche de ce chantier** — l'étape 1 y est commitée |
| `claude/auto-reminders-i18n-d9f1ea` | la branche de la PR [#1243](https://github.com/megga/megga-real-estate/pull/1243), **encore ouverte** |

⛔ **CE CHANTIER EST EMPILÉ SUR #1243, PAS SUR `main`.** Il en part au commit `612a1b63`,
et `main` n'en est PAS un ancêtre (2 commits d'écart au 16.08). `DesinscriptionPage` et sa
route viennent de #1243 : rebaser sur `main` les ferait disparaître. Fusionner #1243
d'abord, ou garder l'empilement assumé.

⛔ **LE PATRON DE COMPOSITION N'EST PAS COMMITÉ.** Le portage de `DesinscriptionPage` du
16.08 — celui qui sert de modèle à l'étape 2 — vit en **modifications non commitées** dans
le worktree `code-review-lot-3-backend-4465a3`. Il n'est ni sur `main`, ni dans les commits
poussés de #1243. Le lire là-bas AVANT de porter quoi que ce soit :

```bash
cd .claude/worktrees/code-review-lot-3-backend-4465a3 && git diff src/pages/public/DesinscriptionPage.tsx
```

⚠ **Vérifier le `cwd` du serveur de dev avant toute mesure à l'écran.** Plusieurs `vite`
tournent en permanence sur cette machine et occupent 5173+ pour d'AUTRES worktrees.
`preview_start` prend un port libre ; confirmer son `cwd` :

```bash
P=$(lsof -nP -iTCP:<port> -sTCP:LISTEN -t | head -1); lsof -a -p "$P" -d cwd -Fn | grep ^n
```

## Le constat, et pourquoi CLAUDE.md ne le voyait pas

CLAUDE.md affirme : « Quatre surfaces sans compte […] **elles suivent MEGGA X**, avec trois
écarts assumés ». C'est vrai des **jetons** et faux de la **composition**.

⚠ Et il en compte **quatre** quand le banc en monte **sept** — `DesinscriptionPage` s'est
ajoutée sans que la section bouge. La huitième surface cliente routée,
`OnboardingCallManagePage` (`/rendez-vous-accueil/:token`), n'est sur AUCUN des deux
inventaires.

Mesuré le 16.08.2026 sur les 14 fichiers de `src/pages/public/` — **re-mesuré après
l'étape 1, inchangé sauf mention** :

| page | chrome MX | littéraux couleur | route |
|---|---|---|---|
| `KycPublicPage` | direct | 0 | `/kyc/:token` |
| `AppointmentManagePage` | direct | 4 | `/rendez-vous/:token` |
| `DesinscriptionPage` | ⚠ **— sur toute base commitée** | 1 | `/desinscription` |
| `BuyerReceptionPage` | — | **17** | `/reception/:token` |
| `AcceptInvitePage` | — | **8** | `/accept-invite/:token` |
| `VisitManagePage` | — | 2 | `/visit/:id/edit` |
| `VisitFeedbackPage` | — | 1 | `/visit/:id/feedback` |
| `OnboardingCallManagePage` | — | 0 | `/rendez-vous-accueil/:token` |
| `ResetPasswordPage` | — | 0 | `/reset-password` |
| `AuthCallbackPage` | — | 0 | `/auth/callback` |
| `NotFoundPage` | — | 0 | `*` |
| `PrivacyPage` | — | 0 | `/privacy` |
| `KycReportRenderPage` | — | 3 | `/kyc-report/:token` |
| `AuthBentoPage` | — | 0 | **non routée** |

⚠ **« Trois portent le chrome » était faux sur toute base commitée : il y en a DEUX.** La
troisième est le patron non commité ci-dessus. Ne pas conclure de sa présence à l'écran
qu'elle est dans l'arbre.

⛔ **PRENDRE LES JETONS SANS LA COMPOSITION, C'EST REFAIRE LA DIRECTION DE MÉMOIRE.** C'est
l'erreur commise sur `DesinscriptionPage` et que Julien a vue d'un coup d'œil : la page
avait le dégradé, l'encre et Manrope — donc « les bonnes couleurs » — mais ni la marque, ni
le pied, ni la coquille. À côté de `/kyc/:token`, elle ne ressemblait pas à la même maison.
`MlkBackground` / `MlkShell` / `MlkWordmark` / `MlkFooter` **SONT** la direction ; les
jetons n'en sont que la palette.

## Ce qui n'est pas un problème, et qu'il ne faut pas « corriger »

- **Manrope, pas Inter Tight** — décision Julien, gardée par `polices-domaines.spec.ts`.
- **Mono-thème** : zéro `dark` / `prefers-color-scheme` sur ces fichiers, et deux gardes le
  DISENT. Ne pas y introduire de thème sombre en croyant bien faire.
- **`inkSoft` = `#3A3D44`**, hors échelle par MESURE (n400 est à 1,16:1 de n100 en clair,
  donc un doublon et non un cran).
- **`KycReportRenderPage`** est un papier A4 imprimable, exempté par écrit.
- **`AuthBentoPage`** n'est routée nulle part (coquille morte, cf. `megga/auth-bento-shell-dead`).
  À retirer, pas à repeindre.
- **`MLK` et `MLK_STATUT` restent SÉPARÉES.** `MLK` porte la direction, `MLK_STATUT` ce qui
  ENCODE un état. La direction ne gouverne pas le sens.

---

## ✅ Étape 1 — TRANCHÉE ET LIVRÉE (16.08.2026)

**Décision de Julien : une seule famille publique** (sortie 1 des trois), **dégradé aligné
sur 50 %**.

### Ce que la re-mesure a corrigé dans ce plan

| Ce que le plan disait | Ce que la mesure a rendu |
|---|---|
| « Seuls six clés sur onze coïncident » | un compte de **NOMS**. Par **VALEUR**, **8 des 9** rôles partagés étaient DÉJÀ identiques |
| divergence = « la sous-surface et le filet » | la sous-surface **ne divergeait plus** — `cardSubtle` et `sub` valaient tous deux `n900` depuis le 15.08 |
| (implicite) la fusion nettoiera des clés | **aucune des 34 clés n'était morte** — contre 10/35 au KYC et 13/30 à Analytics |

Toute la divergence réelle tenait donc en **un cran de dégradé** (`#E2E5EB` à 48 % contre
50 %). ⛔ **Comparer les VALEURS, jamais les noms** — et se méfier de l'en-tête d'un fichier
de jetons, qui décrit l'état du jour où il a été écrit.

### Livré

- `RC` fondue dans `MLK` ; `receptionTokens.ts` et le dossier `buyer-reception/` retirés
  (il ne contenait que lui). 80 sites renommés dans `BuyerReceptionPage`.
- `MLK` gagne **`line`** et **`sheetShadow`**. ⛔ Le filet MANQUAIT, et ça coûtait déjà :
  `DesinscriptionPage` traçait un séparateur avec `MLK_STATUT.starOff` — un jeton d'ÉTAT
  employé comme trait de structure, qui marchait par coïncidence de valeur.
- `rc-contraste.spec.ts` **absorbée** par `mlk-contraste.spec.ts` (5 → 6 fichiers).
- **Preuve chiffrée** : le cliquet de couleur perd la racine `buyer-reception` et ses 4
  écarts. Ils ne se sont pas déplacés vers `kyc-magic-link` — ils en étaient les DOUBLONS.

### ⚠ Ce que l'étape 1 a laissé ouvert

**Le nom `MLK` et le chemin `kyc-magic-link` survivent à leur motif** : ces jetons servent
sept surfaces, pas un parcours KYC. Renommer ou déplacer reste **un geste lexical à part,
non tranché** — et bon marché : **trois fichiers seulement** importent le module.
`BuyerReceptionPage` importe désormais depuis `kyc-magic-link/`, ce qui est laid et le
restera tant que la question n'est pas posée.

---

## Étape 2 — porter les surfaces, une par une, la plus chargée d'abord

Ordre suggéré par le nombre de littéraux, donc par l'écart réel :

1. `BuyerReceptionPage` (17) — c'est elle qui s'écarte le plus. ⚠ Ses jetons sont déjà
   fusionnés ; il ne lui manque que la COMPOSITION.
2. `AcceptInvitePage` (8).
3. `VisitManagePage` (2) et `VisitFeedbackPage` (1) — proches, à faire ensemble.
4. `AppointmentManagePage` (4) — déjà sur le chrome, il ne reste que ses littéraux.
5. `OnboardingCallManagePage` (0 littéral mais **aucun chrome**) — le cas inverse : rien à
   dépeindre, tout à composer. ⚠ Absente du banc ET des deux inventaires.
6. `ResetPasswordPage`, `NotFoundPage`, `PrivacyPage` — pages sobres, à faire en dernier ou
   à laisser si elles conviennent.

**Le geste, pour chacune** : remplacer le conteneur maison par
`<MlkBackground><MlkShell width={…}><MlkWordmark /> … <MlkFooter /></MlkShell></MlkBackground>`,
puis remplacer les littéraux par des jetons.

## Étape 3 — resserrer les gardes derrière soi

Cinq specs touchent `src/pages/public` depuis l'étape 1 : `couleur-barreaux`,
`megga-x-grammar`, `mlk-contraste`, `polices-domaines`, `desinscription-preferences`
(`rc-contraste` a disparu).

- ⚠ **Le cliquet de couleur de la zone est à 6** (`couleur-barreaux.spec.ts`). Chaque page
  portée doit le faire BAISSER. Le laisser tel quel après un portage, c'est perdre la preuve
  du travail.

## Pièges déjà payés — ne pas les repayer

⛔ **Le cliquet de grammaire refuse une page neuve, et il a raison.** Une page absente de
`PAGES_PUBLIQUES` fait rougir `megga-x-grammar.spec.ts`. Y entrer expose aussitôt trois
autres clauses : **aucune graisse ≥ 700**, **tailles dans l'échelle** (`var(--crm-text-*)`),
**rayons et espacements en jetons**. Écrire `fontSize: 15` ou `margin: '0 0 10px'` est une
régression, pas un détail.

⛔ **Le cliquet de couleur compte, il ne juge pas.** Plafond par zone ; on y descend, on n'y
monte pas. Exempter demande un **motif écrit** dans `SURFACES_EXEMPTEES` — réservé aux bancs
absents du bundle, jamais à une vraie page.

⛔ **UN MOTIF DE COUPLE QUI MATCHE DEUX SITES REND LA CLAUSE À MOITIÉ AVEUGLE** (trouvé le
16.08 par contrôle négatif). Le motif nu du bouton secondaire matchait le bouton **et** la
puce de caractéristique — même couple `cardSubtle × inkSoft`. `exec` ne rend que le premier :
une encre changée sur l'un serait restée masquée par l'autre, clause au vert. **Témoin « le
motif apparaît exactement une fois » AVANT toute mutation** — c'est lui qui l'a vu, et le
contrôle négatif s'est arrêté de lui-même.

⚠ **Deux encres sémantiques étaient sous l'AA** et ont été corrigées : `text-red-500` rendait
3,76:1 et `text-emerald-600` 3,77:1 sur carte blanche. Elles passent par `MLK_STATUT`. Toute
couleur d'état ajoutée doit être mesurée, pas choisie.

⚠ **Les étoiles de notation restent hors seuil, par écrit** : aucune teinte dorée n'atteint
3:1 sur blanc sans virer au brun, et c'est la POSITION de la coupure dans une rangée de cinq
qui porte l'information.

## Comment regarder ce qu'on fait

🧪 **`/dev/public` monte les sept surfaces**, trois états chacune.

- ⚠ **Les deux visites et la désinscription prennent leur jeton dans la QUERY**, pas dans le
  chemin. Une route de banc à segment les monterait sans jeton : elles rendraient « lien
  invalide », et l'on corrigerait la fixture au lieu de la route.
- ⚠ **Le banc APPLIQUE les prédicats PostgREST.** Une fixture à qui il manque une colonne
  filtrée est silencieusement exclue.
- ⛔ **LE DOM MENT À MOITIÉ QUAND LE VOLET EST CACHÉ, et c'est pire qu'un DOM qui ment tout
  à fait.** Mesuré le 16.08 : dans une SEULE requête `getComputedStyle`, le bouton principal
  (sans transition CSS) sortait juste — `rgb(66,75,251)`, l'accent — pendant que la pastille
  sélectionnée (avec `transition: background .15s`) sortait FAUSSE, à sa valeur de départ,
  alors que son `aria-pressed` valait `true`. Un résultat uniformément faux se repère ;
  celui-là est crédible et envoie déboguer un composant sain. Le symptôme qui signe
  l'environnement : un `requestAnimationFrame` part en **timeout à 30 s** (« The Browser pane
  is currently hidden »). ⚠ **Rouvrir un onglet neuf ne suffit PAS** — le remède est la
  **CAPTURE**, qui force une peinture.

## Rejouer les mesures

```bash
# quelles pages portent le chrome, et combien de littéraux couleur chacune
python3 - <<'EOF'
import os, re
COUL = re.compile(r"#[0-9a-fA-F]{3,8}\b|rgba?\(")
for f in sorted(x for x in os.listdir('src/pages/public') if x.endswith('.tsx')):
    s = open(f'src/pages/public/{f}', encoding='utf-8').read()
    chrome = 'direct' if re.search(r'\bMlk(Background|Shell)\b', s) else '—'
    print(f"{f:34s} {chrome:8s} {len(COUL.findall(s))}")
EOF

# le plafond du cliquet de couleur pour la zone
grep -n "'src/pages/public'" tests/unit/couleur-barreaux.spec.ts

# les gardes qui touchent la zone
grep -ln "pages/public" tests/unit/*.spec.ts

# comparer deux familles de jetons par la VALEUR, jamais par le nom
grep -c "" src/components/kyc-magic-link/mlkTokens.ts
```

## Portes

```bash
npx tsc -b                            # 0 erreur — PAS `tsc -p`, qui ne vérifie rien
npx eslint src tests --ext .ts,.tsx   # 0 erreur (⚠ 140 warnings au 16.08, pas 136)
npx vitest run                        # 2 643 au 16.08, après la fusion
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
npm run build
```

⚠ **Mesurer la référence eslint avant de l'invoquer.** Ce plan annonçait 136 warnings ;
il y en a 140, et l'écart précède ce chantier — vérifié en comparant `git stash` / `stash pop`.

⛔ **Une CAPTURE, pas seulement une lecture DOM.** Le défaut le plus coûteux du chantier KYC
— un badge blanc sur blanc — a été vu à l'image, pas par une sonde, et il avait survécu à un
lot entier avec la CI verte.

⚠ **Un contrôle négatif par clause**, avec un témoin AVANT, et restauration par **COPIE**
(`cp .bak`) — jamais `git checkout --`, qui emporterait le lot en cours.

## Ce que ce plan ne fait PAS

- Il ne touche à aucun backend.
- Il ne change pas un chiffre ni un libellé. Ces pages portent des dates de rendez-vous et
  des références de dossier : une valeur déplacée est une erreur de contenu.
- Il ne rouvre pas l'arbitrage actif/donnée : les familles qui ENCODENT restent hors
  direction, décision rendue quatre fois.
- Il ne touche pas au CRM agent ni au mobile — les deux sont finis.
