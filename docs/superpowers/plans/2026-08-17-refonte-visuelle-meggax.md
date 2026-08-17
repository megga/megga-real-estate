# Refonte visuelle sous MEGGA X — plan de reprise

> Écrit le **17 août 2026** à la demande de Julien : « refaire toutes les parties sur un
> nouveau design avec la direction artistique de MEGGA X ». Plan **autonome**, pour être
> ouvert dans une session neuve : il ne suppose aucune conversation antérieure.
>
> ⚠ **Tous les chiffres portent leur date et se re-mesurent avant d'être crus.** Les
> commandes qui les produisent sont dans le corps du texte. Relevés sur
> `claude/face-publique-megga-x-2ba9fa` (24 commits d'avance sur `main`), HEAD `14aa3586`.

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
# les deux marqueurs de la direction RETIRÉE, dans les DEUX notations
grep -rnE "#0[Bb]0[Cc]0[Ee]|rgba?\(\s*11\s*,\s*12\s*,\s*14|rgba?\(\s*15\s*,\s*23\s*,\s*42" src/ | wc -l
```

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
| 1 | **Face publique** | 11 | Déjà la plus avancée (cette session), et c'est le CLIENT qui la voit. Sert de PILOTE pour établir la grammaire de refonte. |
| 2 | **Cockpit agent** | `Aujourd'hui`, `Pipeline`, `Contacts` | Ouvertes chaque jour. Le gain se sent immédiatement. |
| 3 | **Fiches et listes** | `Mes biens`, `ContactDetail`, `DealDetail` | Même famille de gabarit — à refondre ensemble ou elles divergent. |
| 4 | **CRM mobile** | `crm-mobile` (228 hors échelle) | La poche la plus lourde. ⚠ Elle a sa propre police (Manrope) et ses propres règles : la traiter comme une variante de bureau serait une erreur. |
| 5 | **Console admin** | `pages/admin` (225) | Audience d'une personne. En dernier, sans regret. |
| 6 | **Dock MEGGA AI** | `ai-copilot/panel` (97) | Transverse : il se superpose à tout le reste, donc il doit venir APRÈS que la grammaire soit fixée. |

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
