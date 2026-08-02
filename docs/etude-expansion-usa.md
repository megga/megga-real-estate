<!-- Étude générée le 2026-06-14 par une analyse multi-agents (15 agents) sur le cerveau MEGGA + recherche web. Document de travail, non engageant. -->

# Étude — Adapter le CRM MEGGA au marché américain

## 1. Synthèse exécutive

**Verdict sur l'ampleur : oui, c'est beaucoup — mais beaucoup moins que ce que les 13 analyses laissent croire, parce qu'elles construisent le mauvais produit.** Sept des treize analyses dimensionnent l'effort comme s'il fallait répliquer aux États-Unis le portail public suisse (sync Flatfox → MLS, carte des prix, marketplace anon). Or ce repo n'est plus une marketplace : depuis le pivot CRM-first de juin 2026, `app.megga.ch` est le **CRM seul**, la marketplace publique est déjà débranchée (`MarketplaceDisabledRedirect`), et la vitrine vit dans un site statique séparé. Un agent américain créera ses biens à la main dans le wizard existant, exactement comme un courtier genevois saisit ses mandats propres. Tout le chantier MLS/RESO/IDX/Zillow-scraping (chiffré XL, 6-12 mois) sort donc du chemin critique d'un lancement et devient une Phase tardive conditionnelle. Cette seule correction de cadrage divise l'effort réel par deux.

**Ce qui reste est néanmoins substantiel, mais concentré.** Le vrai travail n'est pas la compliance exotique : c'est (a) la localisation transverse (USD, états, dates US, anglais, validations, fuseaux horaires), (b) le remplacement fonctionnel du notaire suisse par un **workflow e-signature réel** (listing agreements, buyer-broker agreements, offers — central au CRM US, traité à tort comme un « stub » partout), (c) un **audit Fair Housing du copilote IA et du moteur de scoring** (risque litige réel, pas un disclaimer), et (d) un **routage régional** (`region_context`) qui branche la logique CH vs US sans forker le code. Le socle technique (RLS agency-first, `ai-provider.ts`, i18n, formatters type-defensive) est déjà assez abstrait pour absorber ça par feature flags — **pas de fork, pas de réécriture à 40 %**.

**Décision d'architecture recommandée : monorepo unique, multi-région par flag `region_context`, données maintenues sur Supabase eu-west-1** avec un avis juridique documentant la conformité US. Quitter Supabase pour une région US (option agitée par plusieurs analyses comme « 2-4 semaines AWS RDS ») est massivement sous-estimé : MEGGA n'est pas « du Postgres », c'est 57 edge functions Deno + pg_cron + Realtime + Storage + pgvector + Auth — non portables tels quels. La résidence des données aux US n'est exigée par aucune loi fédérale ; c'est un risque de litige, pas une obligation. On le traite par avis juridique, pas par migration d'infra.

**Délai et effort honnêtes pour un MVP « 1 état pilote » : ~10-12 semaines de code, gated par ~6 semaines de legal/ops en parallèle, soit environ un trimestre calendaire et un budget de l'ordre de 150-250 k USD** (dont 30-60 k de legal/compta US). À comparer aux 5-6 mois et 500 k-1,2 M USD que produisent les analyses quand on suit leur sur-périmètre. La différence vient entièrement de ce qu'on **ne fait pas** : ni MLS, ni SMS/TCPA, ni filing FinCEN automatisé, ni 50 états.

**Recommandation MVP : un seul état pilote, sans hésitation — Texas ou Floride, pas la Californie.** Le coût marginal d'un état est presque tout le coût (chaque état = son régime de licence, ses addenda contractuels, sa loi de closing, sa loi privacy). Faire 1 état coûte 1 unité ; faire 50 coûte 50× sur le legal, pas sur le code. La vraie inconnue n'est pas « peut-on être conforme » (oui, avec du travail) mais « **un agent texan paie-t-il pour un CRM dont l'arme phare — le copilote WhatsApp — ne s'applique pas chez lui ?** ». Un pilote à 3-5 agents répond à ça pour le coût d'un état, avant d'engager le reste.

---

## 2. Décision d'architecture

### Recommandation : monorepo, multi-région par flag, données eu-west-1

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| **A — Fork (2 repos, 2 projets Supabase)** | Isolation totale du risque ; pas de régression CH | Double backlog, double CI/CD, dérive garantie des deux bases de code, double maintenance des 57 edge functions | ❌ Rejeté — coût de maintenance x2 pour un bénéfice illusoire |
| **B — Monorepo, multi-tenant par `region_context`** | DRY, backlog partagé, le code a déjà l'abstraction (`constants.ts`, formatters, i18n, `ai-provider.ts`) ; un flag suffit | Discipline requise sur le branchement conditionnel ; tests par région à doubler | ✅ **Recommandé** |
| **C — Monorepo 2 apps (Vite)** | Séparation front nette | Complexité build sans gain réel ; duplique les hooks/composants | ❌ Inutile vu B |

**Pourquoi B.** Les analyses qui agitent le spectre d'une « explosion de complexité » ou d'un fork ignorent que le code est déjà préparé : `formatCHF` est type-defensive, l'i18n charge les langues à la demande, `ai-provider.ts` abstrait le moteur. Le seul vrai travail est d'ajouter une colonne `region_context` (`'CH' | 'US'`) sur `agencies` / `transactions` / `properties`, puis de brancher dessus la devise, le format de date, le pipeline, le KYC et la compliance. C'est le pivot du multi-tenant, à poser **tôt** car presque tout en dépend.

### La question résidence des données (à trancher au jour 0)

C'est la décision la plus structurante, et celle que les analyses traitent le plus mal.

- **Fait juridique :** aucune loi fédérale US n'impose la résidence des données. Stocker en eu-west-1 est **légal**. Le RGPD/nLPD, lui, impose l'inverse (rester EU). Donc eu-west-1 satisfait l'EU et n'est pas interdit aux US.
- **Le vrai risque** est de litige/perception : lors d'un audit CCPA californien, répondre « les données sont en Europe » peut déclencher une investigation complémentaire. La pratique du secteur penche « data US → stockage US ».
- **Le piège à éviter :** « migrer vers AWS RDS us-east-1 en 2-4 semaines ». **Faux.** Supabase n'offre pas de région US (à la connaissance disponible) et MEGGA dépend de pg_cron, pg_net, Realtime, Storage, pgvector, Auth, et 57 edge functions Deno. Sortir de Supabase = réécrire l'infra entière (XL, plusieurs mois, non chiffré nulle part). C'est un single point of failure architectural.

**Recommandation :** rester eu-west-1, obtenir un **avis juridique US** ($20-50k, partagé avec l'audit AML) qui documente la conformité CCPA d'un hébergement EU + le conflit CCPA-deletion vs rétention KYC. Si plus tard un broker majeur exige le stockage US, envisager une **read-replica us-east** (~$250/mois, latence + image de présence US) avant toute migration. Trancher cela au jour 0 conditionne CI/CD, secrets et calendrier.

---

## 3. Ampleur chiffrée — ce qui change

| # | Domaine | Type de chantier | Effort | En une ligne |
|---|---|---|---|---|
| 1 | **Localisation & formats** | Refonte mécanique | **L** | USD, STATES[50+DC], dates MM/DD/YYYY, EN défaut, +ES optionnel, Zod US, téléphone +1, sq ft — non bloqué, à faire en premier |
| 2 | **Routage régional** (`region_context`) | Nouveau | **S-M** | Colonne + flags qui branchent devise/KYC/compliance ; pivot du multi-tenant |
| 3 | **Géographie & data model** | Refonte | **M** | Cantons→états + comtés/FIPS + ZIP ; mandats `simple/exclusive`→`exclusive_right_to_sell` etc. ; types de biens US (condo/townhouse/multi-family) |
| 4 | **KYC / AML** | Allègement + nouveau module | **S** (allègement) / **M** (FinCEN detection) | Baisser la couverture (déjà non-bloquant), rétention 10→5 ans, OFAC SDN, FinCEN **détection seule** (pas de filing) |
| 5 | **Transaction & closing** | Refonte | **L** | Pipeline 14→8-10 stages US, earnest money, contingencies, closing title-company vs attorney, retrait du marqueur `notary` |
| 6 | **E-signature (ESIGN/UETA)** | Nouveau (sous-estimé partout) | **L** | Remplaçant fonctionnel du notaire : listing/buyer-broker agreements, offers, addenda, statut + relances — pas un « stub » |
| 7 | **Copilote IA & matching** | Refonte du prompt + garde-fous | **M** | Réécrire `MEGGA_SYSTEM` (droit US/état, disclaimers), désactiver l'estimation faute de comparables, garder DeepSeek |
| 8 | **Fair Housing dans l'IA** | Nouveau (audit risque) | **M** | Audit du score engine + copilote contre steering/protected classes — **doit précéder tout déploiement** |
| 9 | **Cross-agency (2 agents/deal)** | Refonte modèle + RLS | **M-L** | Buyer's agent + listing agent = 2 agences sur une transaction ; le schema actuel (`assigned_to` singulier) ne le modélise pas |
| 10 | **Paiements & taxes** | Paramétrage + module | **M** | Stripe Tax (sales tax par état, nexus $100k), pricing USD, multi-devise DB ; earnest money = escrow réglementé, **pas** Stripe |
| 11 | **Data privacy multi-état** | Nouveau | **M** | CCPA/CPRA/VCDPA/TDPSA : DSAR 45j, right-to-delete vs KYC, Do-Not-Sell, opt-out décisions auto, notices par juridiction |
| 12 | **Canaux (SMS/TCPA)** | Nouveau — hors MVP | **XL** (si fait) | TCPA/A2P 10DLC, consentement écrit 1-to-1, TCR/Twilio ; **faux blocker** : on lance sans SMS (WhatsApp+email suffisent) |
| 13 | **Données annonces / MLS** | Blocage externe — Phase 3 | **XL** (si fait) | 580+ MLS, RESO, adhésion broker ; **hors scope MVP** car marketplace déjà OFF |
| + | **Transverses oubliés** | Nouveau | **M** | Fuseaux horaires par utilisateur (`reminders`, `pg_cron`, calendrier), vérification licence agent à l'onboarding, CAN-SPAM email, FIRPTA/1031/property-tax proration (traçage minimal) |
| + | **Vitrine & GTM** | Refonte contenu | **M** | Repositionnement « compliance-first »→« clarity-first », testimoniales US, copy EN, domaine .com |

**Décompte global des chantiers :** S/S-M : 3 — M : 9 — L : 4 — XL : 2 (tous deux hors MVP).

**Estimation temps/équipe honnête :**

- **MVP 1 état (sans MLS, sans SMS) :** ~10-12 semaines de dev (2 ingénieurs : 1 backend/edge functions, 1 frontend), gated par ~6 semaines de legal/ops parallèles. Soit **~1 trimestre calendaire**.
- **Coût :** 150-250 k USD (dev + 30-60 k legal/compta US + entité/Stripe US).
- **Full « proper US SaaS » (MLS + SMS + multi-états) :** 8-12 mois, 500 k-1,2 M USD — **à ne pas viser avant traction prouvée**.

---

## 4. Les blocages externes & le chemin critique

Ce qui ne dépend pas du code et dicte le calendrier réel, **ordonné par criticité pour un lancement commercial** :

1. **Entité légale US + EIN + compte bancaire + Stripe US** *(~4-8 sem)* — **vrai chemin critique**, pas le MLS. Sans facturation USD on n'acquiert aucun client payant. Curieusement sous-traité dans les analyses. À démarrer J0.
2. **Avis juridique US (immobilier + AML)** *(~4-6 sem, $20-50k)* — débloque trois verrous : (a) le positionnement « SaaS-tool, pas broker » par état, (b) le conflit **CCPA right-to-delete vs rétention KYC/BSA**, (c) qui porte le SAR/FinCEN. Toute la compliance attend cet avis ; coder le module FinCEN avant = refonte garantie.
3. **Décision data residency** *(sem 1)* — bloque CI/CD, secrets, archi. Recommandation : eu-west-1 + avis juridique (voir §2).
4. **Licences d'agent par état** *(côté client, 3-6 mois)* — ce sont **les agents** qui doivent être licenciés, pas MEGGA. Impact produit : capter `license_number`/`license_state` à l'onboarding. Non bloquant pour le code, bloquant pour la GTM.
5. **A2P 10DLC / TCR + Twilio** *(1-2 sem)* — **uniquement si SMS**. Hors MVP. À reporter.
6. **Adhésion MLS + RESO + sponsor broker** *(6-12 mois, $5-15k/an/MLS)* — **Phase 3 conditionnelle**. Pas un blocker de lancement puisque le CRM crée les biens à la main.
7. **NAR settlement (litige en cours)** — risque de mouvement des règles de commission. Mitigation : ne jamais coder de commission « fixe », versionner les règles, framer « calculer + divulguer ».
8. **SOC 2 Type II** *(6-12 mois, $40-80k)* — attendu par les brokers, pas bloquant au lancement. Démarrer l'audit tôt pour une cert 2027.

**Chemin critique réaliste (MVP) :** Entité US + avis juridique (parallèle, ~6 sem) ⟂ décision data residency (sem 1) → **localisation + region routing** (sem 1-5, non bloqué) → KYC light + FinCEN detection-only + **audit FHA du copilote/score** (sem 5-9) → **e-sign workflow + closing stages US** (sem 7-11). Le code est gated par le legal/ops, pas par le MLS.

---

## 5. Roadmap par phases

### Phase 0 — Décisions & fondations *(sem 0, parallèle continu)*
- **Objectif :** lever les verrous non-techniques avant d'écrire du code structurant.
- **Chantiers :** décision data residency (eu-west-1) ; lancement entité US + EIN + Stripe US ; engagement du conseil juridique US (immobilier + AML) ; choix de l'état pilote (reco : Texas ou Floride).
- **Livrables :** note d'archi data residency signée ; LOI cabinet juridique ; entité en cours d'immatriculation.
- **Critères de sortie :** état pilote choisi ; conseil engagé ; décision Supabase confirmée.
- **Dépendances :** aucune (point de départ).

### Phase 1 — Socle technique US *(sem 1-5)*
- **Objectif :** rendre le CRM « parlant US » sans logique métier encore branchée.
- **Chantiers :** `region_context` sur `agencies`/`transactions`/`properties` (#2) ; localisation complète — `formatUSD`, `STATES`, dates MM/DD/YYYY, téléphone +1, sq ft, i18n EN défaut, Zod US, autocomplete adresse US (#1) ; géo data model — états + comtés/FIPS + ZIP, types de biens US, listing agreement types (#3) ; **fuseaux horaires par utilisateur** sur `reminders`/calendrier/pg_cron (transverse) ; capture licence agent à l'onboarding (transverse).
- **Livrables :** staging US navigable, devise/dates/langue correctes, données régionalisées.
- **Critères de sortie :** un agent test crée un contact + un bien + une transaction en USD/EN, tout s'affiche au format US ; tests formatters + validations verts.
- **Dépendances :** Phase 0 (décision data residency).

### Phase 2 — MVP 1 état pilote *(sem 5-12)*
- **Objectif :** un CRM transactionnel complet, conforme, déployable auprès de 3-5 agents beta.
- **Chantiers :** pipeline US 8-10 stages + earnest money + contingencies + closing title-company, retrait `notary` (#5) ; **workflow e-signature réel** — listing/buyer-broker agreements, offers, statut + relances (#6) ; **cross-agency** modèle + RLS (#9) ; KYC allégé + OFAC SDN + FinCEN **détection seule** (#4) ; **audit FHA** du copilote + score engine + réécriture `MEGGA_SYSTEM` US + désactivation estimation (#7, #8) ; Stripe Tax + pricing USD + multi-devise (#10) ; privacy MVP — DSAR, Do-Not-Sell, notices par état, CAN-SPAM email (#11) ; vitrine/copy US repositionnée (clarity-first).
- **Livrables :** MVP en production sur 1 état, conforme privacy + FHA, facturable en USD.
- **Critères de sortie :** 3 agents pilotes onboardés ; un deal complet du lead au closing avec e-sign ; avis juridique CCPA/KYC reçu et appliqué.
- **Dépendances :** avis juridique (FinCEN, KYC/CCPA, unlicensed-practice), entité US/Stripe, Phase 1.

### Phase 3 — Conformité approfondie & données marché *(conditionnel, post-traction)*
- **Objectif :** combler ce qui est nécessaire au scale, pas au pilote.
- **Chantiers :** module FinCEN filing complet (si l'avis désigne MEGGA comme reporting person) ; intégration MLS/RESO pour 1-2 boards + adhésion broker (#13) ; estimation US réelle (comparables) ; SOC 2 Type II.
- **Critères de sortie :** au moins un MLS synchronisé en lecture ; export FinCEN opérationnel ; cert SOC 2 engagée.
- **Dépendances :** traction validée au checkpoint go/no-go ; partenariat broker MLS signé.

### Phase 4 — IA & canaux *(conditionnel)*
- **Objectif :** étendre les canaux et l'IA une fois le produit validé.
- **Chantiers :** SMS via Twilio + conformité TCPA/A2P 10DLC + consentement 1-to-1 (#12) ; repositionnement WhatsApp comme outil interne d'équipe ; copilote multi-canal (formats SMS/email/WhatsApp).
- **Critères de sortie :** TCR enregistré, premier SMS conforme envoyé, audit trail consentement opérationnel.
- **Dépendances :** avis TCPA, traction.

### Phase 5 — Scale multi-états / GA *(conditionnel)*
- **Objectif :** répliquer sur les états qui marchent.
- **Chantiers :** addenda + closing + privacy par état (réplication legal, pas code) ; commission tracking versionné (post-NAR) ; matching multi-région ; entité/insurance E&O par état.
- **Critères de sortie :** 2-3 états en production, NRR ≥ 50 % de la baseline CH.
- **Dépendances :** checkpoint vert sur l'état pilote.

---

## 6. Ce qui se réutilise vs se refait

| Composant | Statut | Note |
|---|---|---|
| RLS agency-first | 🔧 à adapter | Solide, mais doit gérer le **cross-agency** (2 agents/deal) et le scoping par état |
| `ai-provider.ts` (DeepSeek) | ✅ réutilisable | Garder DeepSeek (coût) ; ne pas basculer sur Claude sans approbation |
| `MEGGA_SYSTEM` prompt | 🔥 à refaire | Ancré droit suisse/LBA ; réécriture US/état + disclaimers + garde-fous FHA |
| Score engine (`ai_seriousness_score`…) | 🔧 à auditer | Audit FHA obligatoire (steering/protected classes) avant déploiement |
| `formatCHF` / formatters | 🔧 à adapter | Type-defensive : `formatCurrency(amount, region)` ; base saine |
| i18n (react-i18next) | 🔧 à adapter | Infra OK ; EN défaut, ES optionnel ; jargon realtor US |
| Wizard création bien | ✅ réutilisable | Sert au CRM US tel quel (saisie manuelle, pas de MLS) |
| Pipeline transactions | 🔥 à refaire | 14 stages CH → 8-10 stages US, retrait `notary`, earnest money, contingencies |
| KYC pipeline (Dilisense, magic links, MLRO) | 🔧 à alléger | Déjà non-bloquant ; baisser couverture, +OFAC, rétention 5 ans |
| `delete-account` (nLPD) | 🔧 à adapter | Réutilisable pour CCPA ; gérer conflit deletion vs rétention KYC |
| `activity_events` (audit immutable) | ✅ réutilisable | +colonne `regulation_jurisdiction`, rétention différentielle |
| Google/Outlook Calendar OAuth | ✅ réutilisable | Marche tel quel aux US ; ajouter timezone-awareness |
| Email (Resend) | 🔧 à adapter | Domaine .com, DKIM/SPF US, footer CAN-SPAM obligatoire |
| WhatsApp (30+ outils, copilote) | 🔧 à repositionner | Marginal côté agents US ; outil interne d'équipe, pas canal client phare |
| Stripe (checkout, webhooks, billing) | 🔧 à adapter | +Stripe Tax, USD, multi-devise |
| Flatfox sync / `market_listings` (CH) | ✅ réutilisable (CH) | Inchangé pour la Suisse ; **pas** de pendant US au MVP |
| Marketplace publique / `/buy /rent` | ✅ déjà OFF | Reste désactivée ; ne pas reconstruire |
| Seller portal (token stateless) | 🔧 à adapter | Étendre aux contingencies + signatures ; buyer portal nouveau |
| `region_context` routing | ➕ nouveau | Pivot multi-tenant |
| Workflow e-signature | ➕ nouveau | Remplaçant du notaire ; central |
| FinCEN detection / OFAC | ➕ nouveau | Détection au MVP, filing en Phase 3 |
| Earnest money / escrow | ➕ nouveau | Flux réglementé (trust account), **pas** Stripe |
| Commission tracking & splits | ➕ nouveau | Module post-NAR (calcul, versioning, closing) |
| DSAR / Do-Not-Sell / consent multi-état | ➕ nouveau | Privacy US |
| SMS / TCPA | ➕ nouveau (hors MVP) | Phase 4 |
| MLS / RESO | ➕ nouveau (hors MVP) | Phase 3 |

---

## 7. Risques majeurs & angles morts

1. **Risque d'identité produit (le plus grave, go/no-go).** En Suisse, MEGGA est quasi-monopole, la compliance est un différenciateur, le copilote WhatsApp est l'arme phare. Aux US : marché saturé (Follow Up Boss, Lofty, BoldTrail/BoomTown consolidés par Inside Real Estate), compliance = hygiène de base non différenciante, et WhatsApp est **marginal côté agents** (SMS/email dominent). On arrive désarmé sur un marché encombré. **Mitigation :** le pilote 1 état sert précisément à tester la willingness-to-pay avant d'investir ; trouver un angle (clarity post-NAR ? transparence transaction ?) ou ne pas y aller.

2. **« Unlicensed practice » réglementaire.** Afficher « compliance/KYC » aux agents peut faire considérer le SaaS comme activité réglementée dans certains états (CA, NY, TX). **Mitigation :** validation par état du positionnement « outil, pas broker » dans l'avis juridique, **avant** acquisition.

3. **Conflit CCPA right-to-delete vs rétention KYC/BSA.** Obligations contradictoires sans guidance officielle, aggravé par l'hébergement eu-west-1 (drapeau dans un audit californien) et l'absence d'historique de bonne foi face à une FTC agressive. **Mitigation :** avis juridique documenté (« legal hold KYC = exception légitime ») avant le premier signup ; commencer par un état moins agressif que la Californie.

4. **Sur-construction / dilution (risque d'exécution n°1).** Suivre les analyses (MLS + filing FinCEN + 50 états + SMS + marketplace rebuild) = 12-24 mois, $1M+, et on ne valide jamais la demande. **Mitigation :** discipline de scope MVP — couper MLS, SMS, multi-états, filing automatisé ; checkpoint go/no-go à 60 jours.

5. **Supabase / data residency (single point of failure).** Pari sur « eu-west-1 légal aux US » ; si un broker majeur exige le stockage US, sortir de Supabase = réécriture infra non chiffrée qui peut tuer le calendrier. **Mitigation :** avis juridique solide + option read-replica us-east avant toute migration ; ne pas promettre de résidence US dans les contrats early.

6. **E-signature et Fair Housing sous-estimés (angles morts techniques).** Les analyses traitent l'e-sign en « stub » et le FHA en « disclaimer ». Ce sont respectivement le cœur du workflow transactionnel et un risque litige sur deux systèmes IA en production. **Mitigation :** les chiffrer correctement (L et M), faire l'audit FHA **avant** tout déploiement du copilote.

7. **Cross-agency non modélisé (dette de schema latente).** Deux agences sur une transaction casse le modèle `assigned_to` singulier + RLS `agency_id`. **Mitigation :** traiter en Phase 2 comme M-L, pas comme un détail ; clarifier avec Gregory les deals cross-agency réels avant de coder.

*Incertitudes assumées (droit US) :* le statut FinCEN RRE était en flux judiciaire (vacatur Texas mars 2026, appel en cours) — d'où la posture « détection seule, filing en flag dormant ». Qui porte le SAR/FinCEN reste à trancher par avocat. Le positionnement « non-broker » par état est à confirmer juridiquement. Ces points sont des décisions legal, pas des certitudes techniques.

---

## 8. Recommandation finale & prochaines étapes immédiates

**Le bon cadrage n'est pas « adapter MEGGA aux US » (refonte 40-50 %) mais « lancer le CRM transactionnel MEGGA dans un état, sans le portail, et mesurer ».** Tout le reste est conditionnel à la traction. C'est un pari de ~1 trimestre et ~150-250 k USD, pas un programme de 2 ans à $1M+.

**Les 5 premières actions, dès la semaine prochaine :**

1. **Décision du fondateur — état pilote.** Reco : **Texas** (title-state, closing sans attorney obligatoire, TDPSA moins agressif que CCPA en enforcement, marché énorme, dual agency légal avec disclosure) ou **Floride** (FAR/BAR standardisé, forte clientèle internationale cohérente avec FIRPTA). **Pas la Californie en pilote.**

2. **Décision du fondateur — data residency.** Acter eu-west-1 + avis juridique (vs. ne pas s'engager dans une migration AWS). C'est le socle archi ; tout en dépend.

3. **Engager le conseil juridique US** (immobilier + AML) sur trois questions précises : (a) positionnement « SaaS-tool, pas broker » dans l'état pilote, (b) conflit CCPA-deletion vs rétention KYC, (c) qui porte le SAR/FinCEN. ~4-6 sem, $20-50k. **Rien de structurant côté compliance ne se code avant cet avis.**

4. **Lancer l'entité US + EIN + Stripe US** en parallèle (~4-8 sem). C'est le vrai chemin critique commercial ; sans facturation USD, pas de client payant.

5. **Démarrer le code non bloqué :** `region_context` + localisation (USD, états, dates, EN, Zod US, fuseaux horaires). C'est le seul gros chunk indépendant de tout external blocker, il débloque le reste, et il est testable sur staging immédiatement.

**Checkpoint go/no-go avant tout scale :** 3-5 agents pilotes actifs sur 60 jours, rétention + willingness-to-pay mesurées. Vert → réplication legal sur états 2-3. Rouge → on a perdu un trimestre, pas deux ans. La question à laquelle ce pilote doit répondre n'est pas technique — c'est « un agent US paie-t-il pour ce produit ? ».
