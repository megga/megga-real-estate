# Refonte visuelle sous MEGGA X — plan de reprise

> Écrit le **17 août 2026** à la demande de Julien : « refaire toutes les parties sur un
> nouveau design avec la direction artistique de MEGGA X ». Plan **autonome**, pour être
> ouvert dans une session neuve : il ne suppose aucune conversation antérieure.
>
> ⚠ **Tous les chiffres portent leur date et se re-mesurent avant d'être crus.** Les
> commandes qui les produisent sont dans le corps du texte. Relevés sur
> `claude/face-publique-megga-x-2ba9fa` (24 commits d'avance sur `main`), HEAD `14aa3586`.
>
> ✅ **RE-MESURÉ INTÉGRALEMENT LE 17 AOÛT** sur `claude/meggax-visual-redesign-d507ff`
> (même commit que la branche ci-dessus), HEAD `5fb69cfb`, 25 d'avance. §2 tient à
> l'unité près (41 zones, 1 797/3 538, 1 060 couleurs / 25 zones, table du top-5
> comprise) ; §5 aussi (`tsc` 0, eslint **140** warnings, vitest **2 646** + 3 skipped,
> deadcode 0) ; §8 aussi ([#1243](https://github.com/megga/megga-real-estate/pull/1243)
> ouverte ET ancêtre de HEAD — rebaser perdrait bien `DesinscriptionPage`). **Trois
> énoncés ne tenaient pas** : ils sont corrigés en place au §1, au §4 et au §5, chacun
> avec sa mesure.

---

## §0 — LA DÉCISION DU §3, RENDUE PAR JULIEN LE 17 AOÛT 2026

Le §3 ci-dessous posait trois questions ; elles sont tranchées. **Ce qui suit n'est plus
une option mais le cadre du programme.**

| Question | Décision |
|---|---|
| §3.1 — nature | **Resserrer ce qui existe, puis redessiner 2-3 familles pilotes.** Densité, rythme vertical, échelle typographique et hiérarchie d'abord, sur les compositions en place ; le redessin ne vaut que pour quelques familles, avec dessin de référence. |
| §3.2 — ordre | **Par audience : public → agent → admin.** Le client voit le résultat le plus tôt, et le pilote est petit. |
| §3.3 — méthode | **Une maquette pour le PILOTE seulement, puis à l'écran.** Un seul dessin de référence fixe la hiérarchie ; les familles suivantes s'y alignent sur les bancs `/dev/*`, sans payer une maquette chacune. |

⛔ **CE QUE CETTE DÉCISION INTERDIT.** Pas de nouvelle échelle, pas de nouveaux barreaux,
pas de nouvelle grammaire : l'option 3 du §3.1 est écartée, donc **les 41 inventaires de
cliquet et les dix chantiers d'août restent debout**. Une refonte qui ferait MONTER un
inventaire de cliquet contredit la décision, elle ne l'applique pas.

⛔ **ET CE QU'ELLE IMPOSE COMME PREMIER GESTE : la maquette du pilote, pas du code.**
L'ordre retenu place la face publique en tête (§4, chantier 1). Tant que son dessin de
référence n'existe pas, porter une deuxième famille est prématuré — c'est exactement le
risque de divergence que le §1 annonce.

✅ **LA MAQUETTE DU PILOTE EXISTE** (17 août) :
[claude.ai/code/artifact/c005b6a8](https://claude.ai/code/artifact/c005b6a8-96be-42ee-88fd-c0fc0b5c9e0f).
Elle porte sur **l'espacement seul** — la couleur et la police de cette face sont réglées
et gardées, donc il n'y a rien à y décider. Ce qu'elle a trouvé, et qui commande le
chantier : `--crm-space-*` a **12 noms pour 6 valeurs** (chaque barreau est nommé deux
fois) et **plafonne à 24 px**. Sur les 8 surfaces clientes, 217 espacements littéraux —
90 sur un barreau, **103 entre deux**, **24 au-dessus du plafond**. Les pics de 10 px
(18 sites) et 18 px (17 sites) n'ont aucun barreau, alors qu'ils servent plus que 20 et 24
réunis. **La cause est structurelle aux deux tiers : l'échelle ne sait pas dire ce que ces
écrans demandent.**

⚠ **UNE MESURE A ÉTÉ FAUSSE UNE FOIS, ET DANS LE SENS QUI MINIMISE.** Le premier relevé ne
lisait que `padding:` et `gap:` — il ratait les **93 marges**, là où vit le grand rythme
vertical, et annonçait 7 dépassements de plafond au lieu de 24. Un comptage d'espacement
qui omet les marges décrit l'intérieur des composants, jamais la composition. Détail et
remède dans le cerveau : `megga/echelle-espacement`.

✅ **ARBITRAGE RENDU PAR JULIEN LE 17 AOÛT : « fais-les tomber ».** 10 et 18 ne deviennent
pas des barreaux ; ils rejoignent leur voisin (10 → 12, 18 → 20). Le lot 1 peut commencer.

⛔ **ET LA MAQUETTE AVAIT UNE ERREUR DE NOMS, TROUVÉE À L'IMPLÉMENTATION.** Elle proposait
`2xl:32` et `3xl:56` — or **ces deux noms EXISTENT DÉJÀ, tous deux à 16 px**. Sa table
supposait le dédoublonnage fait, ce qui n'est pas le cas et ne le sera pas dans ce lot :
le dédoublonnage touche **2 786 emplois** de `--crm-space-*` sur tout le dépôt (1 174 au
minimum à réécrire), donc il est CROSS-CUTTING et relève de sa propre PR — la règle du §4
est « une famille = une PR ».

⛔ **ET LES DEUX BARREAUX HAUTS N'ONT FINALEMENT PAS ÉTÉ AJOUTÉS DU TOUT.** En allant les
poser, j'ai lu le commentaire qui coiffe l'échelle : « au-delà (56, 64…) ce sont des
décalages de mise en page propres à une composition, pas du rythme réutilisable : **ils
restent en littéral** ». C'est une décision écrite, que MEGGA X n'a jamais renversée. Les
24 valeurs au-dessus de 24 px restent donc telles quelles, et **le lot ne touche pas
`globals.css`**.

**La correspondance appliquée**, un seul nom par valeur (le doublon est ignoré, pas
retiré — c'est l'autre PR). D'où la suite en apparence trouée, qui saute `2xs`, `md`,
`xl`, `3xl`, `5xl`, `7xl` :

| valeurs mesurées | barreau | px | sites |
|---|---|---|---|
| 4 · 5 | `--crm-space-xs` | 4 | 13 |
| 6 · 7 · 8 · 9 | `--crm-space-sm` | 8 | 34 |
| 10 · 11 · 12 · 13 | `--crm-space-lg` | 12 | 41 |
| 14 · 15 · 16 | `--crm-space-2xl` | 16 | 37 |
| 18 · 20 | `--crm-space-4xl` | 20 | 24 |
| 22 · 24 | `--crm-space-6xl` | 24 | 17 |

### ✅ Lot 1 livré — `9e83e4b9`

147 déclarations passent du littéral au jeton sur neuf fichiers, soit 166 valeurs.
Inventaires descendus : `kyc-magic-link` **74/99 → 32/36**, `pages/public`
**58/189 → 15/111** — 85 valeurs hors échelle en moins. Portes : `tsc` 0, eslint 140
(inchangé), vitest 2 646, deadcode 0, i18n/prose/parity OK, build `MEGGA_BUILD_TARGET=app`
OK, quatre surfaces relues à l'écran.

⚠ **« RESSERRER » N'A PAS DENSIFIÉ, ET C'EST MESURÉ** : la table de MEGGA X arrondit vers
le **haut**, donc le premier écran du KYC **GRANDIT de 6 px** (921 → 927). Ce que le lot
achète est l'unicité du rythme, pas la densité. Les deux se confondent facilement — si
c'est la densité qui est voulue, elle demande une décision séparée : *abaisser* des
valeurs, pas les aligner.

⛔ **ET LA RELECTURE À L'ÉCRAN A MENTI D'ABORD.** Le volet caché rend `innerWidth: 0`, ce
qui fait matcher la media query `max-width: 560px` de `MlkShell` : je mesurais une fausse
mise en page mobile (carte à 56 px de large, coquille à 28 px au lieu de 56). Une capture
force la peinture et rétablit 1280. **Un `getComputedStyle` sur une valeur dépendant d'une
media query n'est pas fiable tant qu'une capture n'a pas eu lieu.**

Deux surfaces sur huit n'ont rien reçu, correctement : `DesinscriptionPage` était déjà
tokenisée (écrite le 16 août, après la migration), et `OnboardingCallManagePage` suit les
classes Webflow de la vitrine, pas les jetons du CRM.

### ⛔ Le dédoublonnage des douze noms : ÉCARTÉ le 17 août, et ne pas le re-proposer

Le §0 le donnait comme « le gain gratuit » — **c'est faux, et une décision écrite le disait
déjà** dans [megga-x-crm-tokens.spec.ts:155](../../../tests/unit/megga-x-crm-tokens.spec.ts),
avec une garde qui l'applique (`ALIAS_ASSUMES`).

Les paires ne sont pas des doublons de négligence : la bascule MEGGA X a **écrasé deux
valeurs distinctes l'une sur l'autre**. Vérifié sur `3167d8e8` contre `HEAD` :

| | avant la bascule | aujourd'hui |
|---|---|---|
| `lg` / `xl` | **10** / 12 | 12 / 12 |
| `2xl` / `3xl` | **14** / 16 | 16 / 16 |
| `4xl` / `5xl` | **18** / 20 | 20 / 20 |

Et **2 725 des 2 968 emplois (92 %) datent d'avant la bascule** : le nom y reste le seul
enregistrement de ce que l'auteur voulait. `lg` disait 10, `xl` disait 12 — la valeur ne
les distingue plus, le nom si. Fondre les noms brûle cette information **irrécupérablement**.

⛔ **ET C'EST EXACTEMENT L'INFORMATION QUE LA MESURE DU LOT 1 RÉCLAME.** Les deux pics sans
barreau relevés sur la face cliente sont **10 px** (18 sites) et **18 px** (17 sites) : les
valeurs mêmes que la bascule a supprimées. **Le dédoublonnage et le retour à une échelle
plus fine sont mutuellement exclusifs, et le dédoublonnage est celui qu'on ne peut pas
défaire.**

**Décision de Julien, 17 août : ne rien fondre tant que la question de l'échelle n'est pas
tranchée.** Elle est en amont : l'échelle reste-t-elle au pas de 4, ou regagne-t-elle 10 et
18 ? Coût de l'attente : nul — les alias sont déjà écrits et gardés.

**Reste ouvert :** la question de l'échelle ci-dessus, et les barreaux au-dessus de 24 px
(renverser une décision écrite = un arbitrage, pas un nettoyage).

---

## §1 — ⛔ LIRE CECI D'ABORD : LA DEMANDE N'EST PAS CELLE DES DIX CHANTIERS PRÉCÉDENTS

Mesuré le 17 août 2026, et c'est le fait qui commande tout le reste :

```bash
# dérive le périmètre du ROUTAGE et du CLIQUET, jamais d'une impression
python3 - <<'EOF'
import re
g=open('tests/unit/megga-x-grammar.spec.ts',encoding='utf-8').read()
def bloc(n):
    m=re.search(rf'const {n} = (?:new Set\(\[|\[)(.*?)\]\)?',g,re.S)
    return set(re.findall(r"'([^']+\.tsx)'",m.group(1))) if m else set()
app=open('src/App.tsx',encoding='utf-8').read()
r={}
for m in re.finditer(r"lazy\(\(\) => import\('@/pages/(agent|public)/(\w+)'\)\)",app):
    r.setdefault(m.group(1),set()).add(m.group(2)+'.tsx')
for fam,s in (('agent',bloc('PAGES')),('public',bloc('PAGES_PUBLIQUES'))):
    print(fam, len(r[fam]), 'routées ·', len(r[fam]-s), 'hors cliquet')
EOF
```

**Résultat : 26 pages agent, 11 pages publiques, ZÉRO hors cliquet.**

⛔ **LA DESCENTE EST TERMINÉE.** Il n'existe plus une surface qui « ne soit pas en MEGGA X »
au sens des dix chantiers menés du 11 au 17 août (`mes-biens`, `contacts`, `matching`,
`pipeline`, `console-admin`, `crm-agent`, `face-publique`, `couverture-100`, `kyc`,
`analytics`). Tous ont fait la même chose : faire DESCENDRE des jetons, entrer une zone au
cliquet, retirer le noir de Sugar. Vérifiable en une commande :

```bash
# ⛔ NE PAS UTILISER TELLE QUELLE — voir l'encadré juste dessous. Conservée parce que
# c'est la commande qui figurait ici et qu'un lecteur la retrouvera dans l'historique.
grep -rnE "#0[Bb]0[Cc]0[Ee]|rgba?\(\s*11\s*,\s*12\s*,\s*14|rgba?\(\s*15\s*,\s*23\s*,\s*42" src/ | wc -l
```

⛔ **CETTE COMMANDE EST UN ORACLE FAUX, et c'est le premier piège que ce plan tendait.**
Re-mesurée le 17 août : elle rend **68**, pas 0. Décomposé — 32 en COMMENTAIRE (des notes
qui expliquent précisément que la teinte a été retirée), **36 en code vivant, et ZÉRO
`#0B0C0E` vivant**. Les 36 sont tous `rgba(15,23,42,…)`, le gris-bleu slate-900, employé
en **ombre** (23) et en **filet ou aplat discret** (13).

La thèse du §1 tient donc — l'encre de Sugar a bel et bien disparu des surfaces — mais sa
preuve rougit, et de deux façons opposées : un agent en session neuve conclura que la
descente n'est pas finie, ou bien « corrigera » 36 ombres qui relèvent d'une autre
question. **Une garde qui compte ses propres commentaires ne mesure pas ce qu'elle croit.**

```bash
# l'oracle JUSTE : l'encre de Sugar dans du code, commentaires exclus
grep -rnE "#0[Bb]0[Cc]0[Ee]|rgba?\(\s*11\s*,\s*12\s*,\s*14" src/ \
  | grep -vE ':\s*(//|\*|/\*)' | wc -l    # attendu : 0
```

⚠ **La question du slate-900 est RÉELLE, simplement distincte.** L'ombre de la direction
est `MXC_CARD_SHADOW = '0 2px 6px #15086b21'` — une teinte violette. Sur les 734 `boxShadow`
en ligne du dépôt, **9 ombrent encore au slate-900**. C'est un point de resserrage légitime
(§3.1 option 1), pas un reste de Sugar.

⚠ **ET C'EST POURQUOI LA DEMANDE EST D'UNE AUTRE NATURE.** Ce que Julien voit n'est pas du
Sugar résiduel : c'est que les surfaces **ressemblent encore à ce qu'elles étaient**, simplement
repeintes. Une descente change les VALEURS ; elle ne change pas la composition, la hiérarchie,
le rythme, la densité. Les dix plans précédents le disaient tous explicitement — celui de la
face publique écrivait noir sur blanc : « Redessiner ces écrans — rien dans la mesure ne le
réclame ; c'est une décision produit ».

**Cette fois, c'est cette décision-là qui est demandée.**

⛔ **CONSÉQUENCE MÉTHODOLOGIQUE, À NE PAS CONTOURNER : AUCUNE MESURE NE DIRA QUOI DESSINER.**
Les dix chantiers avaient un oracle — le cliquet rougissait, on corrigeait, il verdissait. Une
refonte n'en a pas. Un agent qui ouvre ce plan et se met à « améliorer » sans direction écrite
produira dix surfaces qui divergent, et la seule garde qui pourra encore parler sera celle du
contraste. **Ne pas commencer par du code.**

---

## §2 — L'ÉTAT MESURÉ, ET CE QU'IL DIT DE L'EFFORT

```bash
python3 - <<'EOF'
import re
s=open('tests/unit/megga-x-grammar.spec.ts',encoding='utf-8').read()
z=re.findall(r"\['(src/[^']+)', \{ hors: (\d+), total: (\d+) \}\]",s)
print(len(z),'zones · hors échelle',sum(int(h) for _,h,_ in z),'· total',sum(int(t) for _,_,t in z))
for n,h,t in sorted(z,key=lambda x:-int(x[1]))[:10]: print(f'  {int(h):4d}/{int(t):4d}  {n}')
EOF
grep -c "" tests/unit/couleur-barreaux.spec.ts >/dev/null && python3 -c "
import re;s=open('tests/unit/couleur-barreaux.spec.ts',encoding='utf-8').read()
z=re.findall(r\"\['(src/[^']+)', (\d+)\]\",s);print(len(z),'zones ·',sum(int(n) for _,n in z),'couleurs hors barreaux')"
```

Au 17 août : **41 zones** sous cliquet de grammaire, **1 797** valeurs de géométrie hors
échelle sur **3 538**, et **1 060** littéraux de couleur hors barreaux sur 25 zones.

Les cinq poches les plus lourdes, qui sont aussi les candidates naturelles à une refonte :

| Zone | hors échelle / total | Ce que c'est |
|---|---|---|
| `src/pages/agent` | 331 / 936 | les 26 pages du CRM |
| `src/components/crm-mobile` | 228 / 319 | le CRM mobile |
| `src/pages/admin` | 225 / 464 | la console super-admin |
| `src/components/matching-recherche` | 123 / 185 | l'atelier de recherche |
| `src/components/ai-copilot/panel` | 97 / 121 | le dock MEGGA AI |

⚠ **UN COMPTE ÉLEVÉ NE VEUT PAS DIRE « PAS EN MEGGA X »** — il veut dire « géométrie écrite
en littéraux ». Ces chiffres mesurent la DETTE de tokenisation, pas la qualité du dessin. Ils
servent ici à une seule chose : dire où une refonte coûtera le plus, parce qu'elle devra
retoucher le plus de lignes.

⛔ **« TOUTES LES PARTIES » N'EST PAS UNE SESSION, C'EST UN PROGRAMME.** Les dix chantiers
précédents ont pris une semaine à raison d'un plan et de plusieurs lots CHACUN, sur des
surfaces déjà tokenisées. Vouloir refondre 37 surfaces en une session produirait soit du
travail non vérifié, soit un abandon en cours de route avec la moitié des écrans dans deux
directions différentes — ce qui est pire que de n'avoir rien commencé.

---

## §3 — ÉTAPE 1 : CE QUE SEUL JULIEN PEUT TRANCHER (⚠ AVANT TOUTE LIGNE DE CODE)

### 3.1 Que veut dire « un nouveau design » ?

Trois lectures, et elles ne coûtent pas le même prix :

1. **Resserrer ce qui existe** — même compositions, mais densité, rythme vertical, échelle
   typographique et hiérarchie revus surface par surface. C'est la continuité de ce que cette
   session a fait sur la face publique (allègement des textes, grille au bureau). Mesurable,
   réversible, sans risque produit.
2. **Redessiner les gabarits** — de nouvelles compositions pour les familles d'écrans (liste,
   fiche, tableau de bord, formulaire), puis application. C'est un vrai travail de design, et
   il demande des maquettes AVANT le code.
3. **Changer la direction elle-même** — nouvelle échelle, nouveaux barreaux, nouvelle
   grammaire. ⛔ Ce serait défaire les dix chantiers d'août et les 41 inventaires de cliquet.
   À n'envisager que si la direction MEGGA X est jugée fausse, ce que rien dans cette session
   ne suggère.

**Recommandation : (1), puis (2) sur deux ou trois familles pilotes.** (1) donne un gain
visible sans maquette ; (2) a besoin d'un dessin de référence pour ne pas devenir dix
inventions parallèles.

### 3.2 Dans quel ordre, et pourquoi cet ordre-là ?

⚠ **L'ordre n'est pas cosmétique : il décide de qui voit le résultat.** Trois candidats :

- **Par audience** — d'abord ce que le CLIENT voit (les 11 surfaces publiques, déjà les plus
  avancées), puis l'agent, puis l'admin. Le défaut visible le plus tôt.
- **Par fréquence d'usage** — d'abord `Aujourd'hui`, `Pipeline`, `Contacts`, que Gregory
  ouvre chaque jour. Le gain de confort le plus grand.
- **Par dette** — d'abord `pages/agent` et `crm-mobile`, les deux poches les plus lourdes.
  Le nettoyage le plus profond, mais le moins visible à court terme.

### 3.3 Une maquette d'abord, ou directement à l'écran ?

Le dépôt a un précédent pour les deux. `MEGGA X` lui-même est un port 1:1 d'un fichier
Webflow ; les chantiers de descente, eux, se sont faits directement à l'écran sur `/dev/crm`
et `/dev/public`. Pour (2), une maquette évite que chaque famille invente sa hiérarchie.

---

## §4 — LA STRUCTURE PROPOSÉE, SI L'ORDRE DU §3 EST « (1) PUIS (2) »

⚠ **Un chantier = une famille de surfaces = un plan = une PR.** C'est la méthode qui a
fonctionné dix fois ; s'en écarter est le risque principal de ce programme.

| # | Famille | Surfaces | Pourquoi ce rang |
|---|---|---|---|
| 1 | **Face publique** | **8** (⚠ pas 11) | Déjà la plus avancée (cette session), et c'est le CLIENT qui la voit. Sert de PILOTE pour établir la grammaire de refonte. |
| 2 | **Cockpit agent** | `Aujourd'hui`, `Pipeline`, `Contacts` | Ouvertes chaque jour. Le gain se sent immédiatement. |
| 3 | **Fiches et listes** | `Mes biens`, `ContactDetail`, `DealDetail` | Même famille de gabarit — à refondre ensemble ou elles divergent. |
| 4 | **CRM mobile** | `crm-mobile` (228 hors échelle) | La poche la plus lourde. ⚠ Elle a sa propre police (Manrope) et ses propres règles : la traiter comme une variante de bureau serait une erreur. |
| 5 | **Console admin** | `pages/admin` (225) | Audience d'une personne. En dernier, sans regret. |
| 6 | **Dock MEGGA AI** | `ai-copilot/panel` (97) | Transverse : il se superpose à tout le reste, donc il doit venir APRÈS que la grammaire soit fixée. |

⚠ **« 11 » COMPTAIT LES PAGES ROUTÉES, PAS LES SURFACES DESSINÉES** — corrigé le 17 août,
et l'écart change la nature du pilote. Les 11 de `src/pages/public` incluent trois pages
qui n'enseignent rien sur la composition : `NotFoundPage` (un 404), `AuthCallbackPage` (un
écran d'attente), et `KycReportRenderPage` (le papier A4 du rapport, que CLAUDE.md exempte
NOMMÉMENT des règles de direction — c'est là que vivent les 20 `uppercase` tolérés).

Le parcours client dessiné en fait **8** : les sept montées par `/dev/public` — KYC,
rendez-vous, réception acheteur, visite · modifier, visite · avis, invitation équipe,
préférences d'e-mail — plus `OnboardingCallManagePage`, absente du banc (§8.4).

⚠ Et **le « SIX surfaces sans compte » de CLAUDE.md est périmé lui aussi** : il précède
`DesinscriptionPage` (16 août) et ne comptait pas l'appel d'accueil. Huit est le chiffre
au 17 août.

C'est une bonne nouvelle pour un pilote : plus il est petit, plus vite la grammaire se
fixe. Mais **la première surface à porter n'est pas la première de la liste** — la
maquette doit se dessiner sur celle qui porte le plus de composition, pas sur la plus
courte.

**Pour chaque chantier, le même squelette** — c'est ce qui a rendu les dix précédents
vérifiables :

0. mesurer l'état de la famille (cliquets, captures avant) ;
1. écrire ce qui change et POURQUOI, avant de toucher au code ;
2. porter, une surface à la fois, en vérifiant à l'écran chacune ;
3. faire BAISSER les inventaires de cliquet et inscrire le gain ;
4. mettre le cerveau à jour (`.claude-flow/knowledge/megga-memory.seed.json`, puis
   `npm run ruflo:seed`, puis vérifier par l'oracle SQL).

---

## §5 — LES PORTES, ET LA SEULE QUI PARLE ENCORE PENDANT UNE REFONTE

```bash
npx tsc -b                            # 0 erreur — PAS `tsc -p`, qui ne vérifie rien
npx eslint src tests --ext .ts,.tsx   # 0 erreur (⚠ 140 warnings au 17.08, PAS 136)
npx vitest run                        # 2 646 au 17.08
npm run lint:deadcode                 # 0
npm run lint:i18n && npm run lint:prose && npm run i18n:parity
npm run i18n:coverage:ci              # cliquet : ne peut que descendre
MEGGA_BUILD_TARGET=app npm run build   # ⚠ SANS le flag, `dist/` devient la VITRINE
```

⛔ **PENDANT UNE REFONTE, LES CLIQUETS NE PROTÈGENT PLUS GRAND-CHOSE.** Ils mesurent la
conformité aux jetons — ils diront « tu as bien employé `var(--crm-space-4xl)` », jamais « cet
écran est illisible ». Les DEUX gardes qui parlent encore :

1. **Les dix specs de contraste** — elles mesurent des seuils AA sur des couples réels. Cette
   session leur doit trois défauts trouvés : une pastille d'avatar à 3,68:1 sur le premier
   écran du parcours KYC, un point de pilule à 2,41:1, deux encres sémantiques sous le seuil.
2. **La régression visuelle** — ⚠ elle est à MOITIÉ FAITE. Le plan du 15 août laisse un
   travail d'une demi-journée : confirmer le plancher de bruit sur Linux, puis abaisser le
   seuil par pixel. Mesuré sur macOS le plancher est nul et un redesign complet vaut 11,55 % ;
   la même chose vaut 1,09 % en CI. **Une refonte sans ce réglage avance à l'aveugle sur ce
   qui change à l'image** — c'est le premier travail à faire si l'ordre du §3 est (2).

   ⛔ **CE POINT DÉCRIVAIT LE PLUS PETIT DES DEUX TROUS.** Re-mesuré le 17 août : la garde
   ne photographie **qu'UNE page** — `PAGES_TO_SNAPSHOT` ne contient que
   `/dashboard/pipeline`, visitée SANS session, donc dans son état erreur + vide (quatre
   colonnes de teinte plate, aucune carte). **Une référence PNG pour tout le dépôt.**

   La conséquence commande le programme : refondre les surfaces les laisserait non
   photographiées **à 36 sur 37**, quel que soit le seuil par pixel. Régler le seuil sur un
   pipeline vide n'achète presque rien ici. ⚠ Le préalable d'un redessin est donc la
   **COUVERTURE** — quelles surfaces entrent sous capture, et dans quel état — et le
   réglage de seuil vient après, sur un jeu qui vaut la peine d'être gardé.

   ⚠ Et le seuil actuel documente déjà son propre aveuglement : le passage du kanban en
   feuille continue, un redessin complet de la page, a mesuré **1,09 % contre une barre à
   1 %**. Passé d'un cheveu, et le commit suivant est repassé au vert contre une référence
   périmée. Une garde qui ne tranche un redessin qu'à 9 centièmes près ne tranche rien.

---

## §6 — PIÈGES PAYÉS LE 17 AOÛT, QUI COÛTENT CHACUN UNE DEMI-HEURE

Ceux-ci sont neufs, vécus dans la session qui écrit ce plan. Les autres sont dans
`megga/gardes-vacuites`.

⛔ **UNE REGEX GOURMANDE A EMPORTÉ 6 445 CARACTÈRES AU LIEU DE 900**, et `MlkLanding` rendait
le titre de l'écran de dépôt. Mes assertions vérifiaient que le motif était TROUVÉ, jamais que
le volume retiré était plausible. **Remède : un témoin de VOLUME** (`assert 700 < retiré <
1200`), pas seulement un témoin de présence. Il aurait arrêté la première version.

⛔ **UN DRAPEAU « PREMIER RENDU » NE SURVIT PAS À STRICTMODE.** L'effet est invoqué DEUX fois
au montage : le premier passage consomme le drapeau, le second agit quand même. La panne était
identique, avec l'illusion d'avoir été traitée. **Comparer l'état PRÉCÉDENT, jamais un rang de
rendu.**

⛔ **LE CLIQUET DE GRAMMAIRE COMPTE AUSSI LE CSS D'UN LITTÉRAL DE GABARIT.** Une feuille de
style écrite dans un `` `…` `` n'échappe pas à la grammaire : y recopier des pixels a fait
MONTER le compte. Passer par `var(--crm-*)` là où un barreau existe.

⛔ **DES BACKTICKS DANS UN COMMENTAIRE CSS À L'INTÉRIEUR D'UN GABARIT** cassent le fichier de
façon illisible — `tsc` rouge sur des lignes qui semblent du texte. **Troisième fois** que ce
piège est payé dans ce dépôt.

⛔ **LE CLIQUET DE COULEUR NE LIT QUE L'HEXADÉCIMAL.** Deux aplats écrits
`rgba(239,68,68,.10)` lui étaient invisibles : six retraits pour une baisse de quatre. Savoir
ce que la garde mesure VRAIMENT fait partie de la garde.

⛔ **LE BANC SERVAIT LA DONNÉE DE L'ÉTAT PRÉCÉDENT.** La `key={etat}` remonte l'arbre, mais le
`QueryClient` vit au-dessus et la clé ne dépend que du jeton. Corrigé, mais la leçon vaut pour
tout banc : **un banc qui répond avec la mauvaise donnée est pire qu'un banc muet.**

⛔ **UNE GARDE QUI FIGE SON PÉRIMÈTRE RÉTRÉCIT EN SILENCE.** `mlk-contraste` annonçait « les
SIX fichiers qui lisent MLK » ; ils étaient DIX, et quatre pages peignaient hors de son champ.
Même forme que la fuite `data-theme` : mesurer la RÈGLE, pas un périmètre choisi. **Pour une
refonte, toute liste de surfaces écrite à la main est une bombe à retardement.**

⚠ **`getComputedStyle` MENT À MOITIÉ QUAND LE VOLET EST CACHÉ** — les éléments SANS transition
CSS répondent juste, ceux qui en ont une rendent leur valeur de DÉPART. Un résultat
uniformément faux se repère ; celui-là est crédible. Le remède est la CAPTURE, qui force une
peinture. ⚠ Rouvrir un onglet ne suffit pas.

⚠ **LE BANC NE MONTRE NI LES ÉTATS D'ERREUR NI L'APRÈS-GESTE** — corrigé le 17 août par l'état
« Geste refusé » et des pièces déposées dans la fixture, mais trois correctifs avaient dû être
prouvés par sonde avant. **Avant de promettre une vérification à l'image, vérifier que l'état
est ATTEIGNABLE.**

---

## §7 — CE QUE CE PLAN NE FAIT PAS

- **Il ne choisit pas la direction.** Le §3 est une décision produit, pas une dérivation.
- **Il ne touche à aucun backend.**
- **Il ne renomme rien.** `MlkBlackPill` et `blackBtn` peignent l'accent depuis le 15 août et
  portent encore le mot « black » ; c'est un geste lexical à part, non tranché.
- **Il ne rouvre pas l'arbitrage actif/donnée** : les familles qui ENCODENT restent hors
  direction, décision rendue quatre fois.
- **Il ne promet pas une session.** Voir §2 : c'est un programme de plusieurs chantiers, et
  vouloir l'abréger est le seul risque qui puisse le faire échouer entièrement.

---

## §8 — L'ÉTAT À REPRENDRE

**Branche** `claude/face-publique-megga-x-2ba9fa`, 24 commits d'avance sur `main`, HEAD
`14aa3586`. ⚠ Elle est empilée sur la PR [#1243](https://github.com/megga/megga-real-estate/pull/1243)
(encore ouverte) : `DesinscriptionPage` et sa route en viennent, donc rebaser sur `main` les
ferait disparaître.

**Ce que cette session a livré** — la face publique, de bout en bout : fusion des deux familles
de jetons (`RC` dans `MLK`), quatre surfaces portées à la composition canonique, deux doublons
redirigés au bord, six défauts de contraste ou de fuite corrigés, un état de banc « Geste
refusé », et deux passes d'allègement de copie sur la réception et le KYC.

**Ce qui reste ouvert, et qui n'attend qu'un mot :**

1. La **régression visuelle** à moitié réglée (§5) — préalable si l'on va vers un vrai redessin.
2. La **rangée de réassurance** du KYC (4 icônes) : réassurance, pas instruction. Peut tomber.
3. Le **renommage** `MlkBlackPill` / `blackBtn`, et le déplacement de `mlkTokens` hors de
   `kyc-magic-link/` — ces jetons servent sept surfaces, le dossier est un accident d'histoire.
   Bon marché : trois fichiers importent le module.
4. `OnboardingCallManagePage` — ni sur le banc `/dev/public`, ni dans les inventaires.
5. La phrase de droits nLPD subsiste dans `whatsapp-optin-copy.ts`, volontairement : c'est une
   des cinq informations d'une sollicitation de CONSENTEMENT, autre régime que la page de
   désinscription où elle a été retirée.
