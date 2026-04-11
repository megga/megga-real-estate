# Documentation compliance — MEGGA Real Estate

Ce dossier contient les **4 documents de conformité** nLPD + LBA, sous forme de templates préremplis avec le contexte MEGGA (architecture Supabase, Dilisense, Claude API, rétention LBA 10 ans, scoring IA).

## Documents disponibles

| # | Fichier | Base légale | Obligatoire ? |
|---|---|---|---|
| 1 | [`01-registre-activites-traitement.md`](./01-registre-activites-traitement.md) | Art. 12 nLPD | **Oui** — obligation légale |
| 2 | [`02-dpia-scoring-ia-kyc.md`](./02-dpia-scoring-ia-kyc.md) | Art. 22 nLPD | **Oui** pour traitements à risque élevé |
| 3 | [`03-runbook-violation-donnees.md`](./03-runbook-violation-donnees.md) | Art. 24 nLPD | Fortement recommandé |
| 4 | [`04-designation-dpo.md`](./04-designation-dpo.md) | Art. 10 nLPD | **Non** — facultatif sous nLPD |

**Note importante sur le DPO :** contrairement au RGPD européen (art. 37), la nLPD suisse **n'impose pas** la désignation d'un conseiller à la protection des données pour les entreprises privées. C'est recommandé pour la crédibilité commerciale mais pas une obligation légale.

---

## Stratégie phasée — adaptée à ton stade business

Le setup compliance complet coûte ~25k CHF/an. **Ce n'est pas rationnel en phase pilote** avant d'avoir du chiffre d'affaires. Voici une approche phasée qui respecte la loi tout en préservant le cash.

### 🟢 Phase 0 — Pilote (0 → 5 agences) | ~1 500 à 2 500 CHF one-shot + 1 200 CHF/an

**Ce que tu fais toi-même en 1-2 jours de travail :**

1. **Remplir les templates** — tu es le responsable du traitement et ton propre point de contact
2. **Signer les DPA gratuits** avec les sous-traitants (2h de travail, tout est auto-signature)
3. **Consultation one-shot d'un avocat** pour validation (500-1 000 CHF)
4. **Souscrire une RC Pro cyber** — **seul investissement non négociable** (~1 200 CHF/an)

Tu es le "point de contact protection des données", pas officiellement "DPO" (pour ne pas t'engager à tenir des obligations DPO formelles). L'email `privacy@megga.ch` pointe vers toi.

**Ce que tu NE fais PAS en phase 0 :**
- ❌ DPO externe à 8-20k CHF/an
- ❌ Audit de pénétration annuel à 5-10k CHF
- ❌ Hotline juridique à 500 CHF/mois
- ❌ Formation équipe à 1-2k CHF (tu es seul ou quasi)

### 🟡 Phase 1 — Traction (5 → 20 agences) | ~6 000 à 8 000 CHF/an

Déclencheurs pour passer à cette phase :
- Tu as du MRR récurrent (~5-10k CHF/mois)
- Des agences plus structurées commencent à poser des questions compliance pendant la vente
- Tu as de vraies données clients en production

**Ce que tu ajoutes :**
- **DPO externe "light"** (forfait mensuel 400-600 CHF) — cherche "DPO as a service Suisse"
- **Formation 1 jour nLPD** pour toi (~500 CHF)
- **Validation officielle de la DPIA** par un avocat (2-3k CHF one-shot)

### 🔴 Phase 2 — Scale (20+ agences ou 1 "grosse prise" type Naef/Barnes/Bory) | ~20 000 à 30 000 CHF/an

Déclencheurs pour passer à cette phase :
- Les grosses agences exigent un DPO nommé avec CV
- Un incident à ce stade peut vraiment coûter cher
- Les revenus justifient l'investissement

**Setup complet :**
- DPO externe officiel avec contrat annuel
- Audit de pénétration annuel
- Formation équipe annuelle
- Consultation juridique régulière
- Certifications éventuelles (ISO 27001, SOC 2)

---

## Plan d'action détaillé Phase 0 (à faire maintenant)

### Étape 1 — Remplir les 4 templates (1 après-midi)

Ouvre les 4 fichiers, remplace les `{{placeholders}}` par les vraies valeurs :
- Raison sociale exacte (ex. MEGGA Sàrl, MEGGA SA)
- Adresse complète du siège
- Numéro IDE (format CHE-XXX.XXX.XXX)
- Nom du représentant légal
- Email DPO : `privacy@megga.ch`
- Coordonnées téléphoniques

**Pour le document 04 (DPO)** : tu te désignes toi-même comme "point de contact protection des données" (pas "DPO" officiel). Utilise l'option "DPO interne à double casquette" dans le template et note que c'est une désignation pro tempore jusqu'à la Phase 2.

### Étape 2 — Signer les DPA sous-traitants (2h)

| Sous-traitant | Où ? | Durée | Coût |
|---|---|---|---|
| Supabase | Dashboard → Organization → Legal Documents → DPA | 15 min | Gratuit |
| Anthropic | Auto-accepté dans les [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) | 5 min | Gratuit |
| Stripe | Auto-accepté dans les [Terms](https://stripe.com/legal/dpa) | 5 min | Gratuit |
| Resend | [resend.com/legal/dpa](https://resend.com/legal/dpa) | 10 min | Gratuit |
| Google Cloud | Console → IAM & Admin → Privacy & Security | 20 min | Gratuit |
| Microsoft | Admin center → Compliance → Data Protection | 30 min | Gratuit |
| Mapbox | [mapbox.com/legal/dpa](https://www.mapbox.com/legal/dpa) | 10 min | Gratuit |
| PostHog | Dashboard → Settings → Legal | 10 min | Gratuit |
| Cloudflare | Dashboard → Manage Account → Configurations | 15 min | Gratuit |
| **Dilisense** | Email à `contact@dilisense.com` — demander le DPA signé | 1 semaine | Gratuit |

**Crée `docs/compliance/dpa/` localement** (ajoute au `.gitignore`) et garde un PDF de chaque DPA signé.

### Étape 3 — Consultation juridique one-shot (500-1 000 CHF)

**Cabinet recommandé pour petits budgets :**
- **Sylex Legal** (Lausanne) — le plus accessible, forfait 500 CHF/h
- **Id Est Avocats** (Lausanne) — spécialisé tech et nLPD

**Cabinets haut de gamme** (à réserver Phase 1-2) :
- VISCHER, Walder Wyss, LALIVE, Homburger, Schellenberg Wittmer

**Brief à envoyer :**

> Bonjour,
>
> Je suis le fondateur de MEGGA, une plateforme SaaS immobilière pour agents suisses (CRM + KYC + scoring IA). Je suis en phase pilote (1-5 agences) et je cherche une consultation one-shot (2h) pour :
>
> 1. Revue de mes 4 documents compliance nLPD (registre des traitements, DPIA pour scoring IA + screening PEP/Sanctions, runbook 72h, désignation point de contact)
> 2. Revue de ma politique de confidentialité publique
> 3. Avis sur le minimum viable compliance en phase pilote
>
> Mon architecture technique est déjà conforme (RLS Supabase, rétention 10 ans LBA par trigger SQL, audit trail, human-in-the-loop KYC, droit à l'effacement fonctionnel). Il me manque la validation juridique.
>
> Pouvez-vous me faire un devis ?

### Étape 4 — RC Pro Cyber (1 200 CHF/an) — NON NÉGOCIABLE

C'est le seul investissement que tu ne dois **vraiment pas** zapper. Raison : un incident de sécurité en SaaS coûte en moyenne **10-50k CHF de frais légaux + techniques**, et une amende nLPD peut atteindre **250k CHF**. Une assurance à 1 200 CHF/an couvre :
- Les frais d'avocat en cas d'incident
- Les frais d'expertise technique (forensic)
- Les frais de notification aux personnes concernées
- Tout ou partie des amendes administratives selon contrat
- La responsabilité civile envers les clients lésés

**Assureurs suisses à contacter :**

| Assureur | Spécialité | Devis |
|---|---|---|
| **Hiscox Suisse** | Spécialiste cyber + SaaS (recommandé) | Formulaire en ligne |
| AXA Suisse | RC Pro généraliste avec option cyber | Demande via courtier |
| Baloise | RC Pro PME + cyber | Formulaire en ligne |
| Mobilière | RC Pro PME | Agent local |
| Zurich | Cyber Risk Insurance | Demande commerciale |

**Brief pour un devis :**

> Société : SaaS immobilier, 1 fondateur, 0-500k CHF de CA prévu année 1, hébergement Supabase EU, 0-20 clients en phase pilote.
>
> Couverture souhaitée :
> - RC Professionnelle générale
> - Cyber : violation de données, ransomware, frais forensic, notification clients
> - Frais de défense juridique
> - Couverture amendes LPD si légalement assurable

---

## Check-list minimale à cocher avant ton premier client payant

- [ ] Raison sociale enregistrée au registre du commerce suisse
- [ ] Numéro IDE obtenu
- [ ] Compte bancaire professionnel ouvert
- [ ] Les 4 templates `docs/compliance/*.md` remplis avec tes vraies valeurs
- [ ] DPA signés avec les 10 sous-traitants (PDF archivés dans `docs/compliance/dpa/`)
- [ ] Consultation juridique one-shot effectuée + email de validation écrite conservé
- [ ] RC Pro cyber souscrite et première prime payée
- [ ] Email `privacy@megga.ch` opérationnel et monitoré quotidiennement
- [ ] Checklist 72h (Annexe B du runbook) imprimée et accessible

---

## Ce que tu peux dire à tes premiers clients (Gregory, agences pilotes)

Tu ne mens pas, tu ne caches rien :

> « MEGGA est construite compliance-first. Nous avons implémenté toutes les mesures techniques requises par la nLPD (registre des traitements, DPIA pour les traitements à risque élevé, audit trail complet, rétention 10 ans LBA, droit à l'effacement fonctionnel, screening PEP/Sanctions via dilisense). Notre politique de confidentialité est publique et conforme. En phase pilote, je suis le point de contact direct pour toute question de protection des données, avec un avocat spécialisé en support. Dès que nous atteignons 20 agences utilisatrices, nous désignerons un DPO externe officiel. »

Aucun dirigeant d'agence ne te claquera la porte au nez pour ça. C'est le setup standard d'un SaaS B2B suisse en phase d'amorçage.

---

## Ce qui est déjà en place côté technique

Toute la **partie technique** est déjà implémentée. Tu n'as besoin que de la partie documentation :

- ✅ Storage `kyc-documents` agency-scoped (policy RLS sur `get_my_agency_id()`)
- ✅ Rétention 10 ans LBA via trigger SQL `trg_enforce_kyc_retention`
- ✅ Edge Function `delete-account` (droit à l'effacement)
- ✅ Audit trail KYC exhaustif dans `useKyc.ts` + `activity_events`
- ✅ Audit trail IA dans Edge Function `ai-copilot` avec `actor_id='ai'`
- ✅ Cookie banner LPD avec opt-in PostHog
- ✅ Page `/privacy` avec transferts US documentés (SCCs/DPF)
- ✅ Checkbox consentement sur formulaires publics (`VendrePage`, `HelpContactPage`)
- ✅ Mention "estimation IA" sur tous les scores (BuyerIntelligence, SellerIntelligence, KycDetailPage)
- ✅ Human-in-the-loop KYC obligatoire (modal de confirmation)
- ✅ Wording i18n compliance-enabling (pas "automatisé") dans 4 langues
- ✅ Screening PEP/Sanctions via Dilisense (UE, pas de transfert hors UE)
- ✅ RLS PostgreSQL sur toutes les tables sensibles (audit 10 avril)
- ✅ Migrations SQL `20260411_001` et `20260411_002` appliquées en prod
- ✅ Edge Functions `delete-account` et `ai-copilot` déployées

Tu es techniquement à jour. La phase 0 consiste à **documenter ce qui existe déjà** et à **t'assurer financièrement**.

---

## Le vrai risque en phase pilote — et comment tu le couvres

| Risque | Probabilité | Gravité | Couverture Phase 0 |
|---|---|---|---|
| **Incident de sécurité (breach)** | Faible | Élevée | RC Pro cyber + runbook imprimé + audit trail technique |
| **Demande d'accès/rectification d'un client** | Moyenne | Faible | Email `privacy@megga.ch` monitoré + delete-account fonctionnel |
| **Audit FINMA chez une agence cliente** | Faible | Moyenne | Registre rempli + DPA signés + export KYC possible |
| **Contrôle spontané du PFPDT** | Très faible (rare pour petites boîtes) | Moyenne | Registre + DPIA préremplis = preuve de bonne foi |
| **Plainte d'un particulier au PFPDT** | Faible | Faible (avertissement avant sanction) | Politique de confidentialité conforme + DPO de contact |

**Traduction :** avec 1 500-2 500 CHF one-shot + 1 200 CHF/an d'assurance, tu couvres les 5 risques listés à un niveau acceptable pour une phase pilote. Le gap restant (pas de DPO officiel, pas d'audit externe) se referme en Phase 1 quand tu as du cash pour le financer.

---

## Contacts utiles

- **PFPDT** (Préposé fédéral à la protection des données et à la transparence) — https://www.edoeb.admin.ch
- **Formulaire officiel de notification de violation de données** — https://databreach.edoeb.admin.ch/report
- **FINMA** (pour questions LBA) — https://www.finma.ch
- **USPI** (Union Suisse des Professionnels de l'Immobilier) — https://uspi.ch
- **SVIT** (Schweizerischer Verband der Immobilienwirtschaft) — https://svit.ch

---

## Avertissement

Ces 4 documents sont des **templates** produits à titre d'assistance documentaire. Ils ne constituent **pas un avis juridique** et ne remplacent pas la consultation d'un conseil spécialisé en droit suisse de la protection des données et en LBA.

**Avant toute utilisation en production :**
- Fais relire les 4 documents par un avocat spécialisé (consultation one-shot suffit en Phase 0)
- Adapte-les à la situation réelle de ton organisation
- Maintiens-les à jour à chaque évolution substantielle

**Date de création des templates :** 11 avril 2026
**Basé sur :** nLPD + OPDo + LBA + guides PFPDT 2023-2024

---

## Changelog

- **v1.1** (11 avril 2026) : Refonte en stratégie phasée (Phase 0 pilote → Phase 2 scale) pour optimiser le ratio conformité/cash en phase d'amorçage
- **v1.0** (11 avril 2026) : Création initiale des 4 templates + plan d'action tout-en-une-fois
