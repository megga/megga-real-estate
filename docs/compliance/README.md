# Documentation compliance — MEGGA Real Estate

Ce dossier contient les **4 documents juridiques obligatoires** (ou fortement recommandés) pour la conformité de MEGGA Real Estate avec :
- la **nLPD** (Loi fédérale sur la protection des données, révisée, en vigueur depuis le 1er septembre 2023)
- la **LBA** (Loi fédérale concernant la lutte contre le blanchiment d'argent, RS 955.0)

## Documents disponibles

| # | Fichier | Base légale | Statut | Urgence |
|---|---|---|---|---|
| 1 | [`01-registre-activites-traitement.md`](./01-registre-activites-traitement.md) | Art. 12 nLPD | Template à compléter | 🔴 Avant lancement pilote |
| 2 | [`02-dpia-scoring-ia-kyc.md`](./02-dpia-scoring-ia-kyc.md) | Art. 22 nLPD | Template à valider | 🔴 Avant lancement pilote |
| 3 | [`03-runbook-violation-donnees.md`](./03-runbook-violation-donnees.md) | Art. 24 nLPD | Template opérationnel | 🟠 Dans le mois du lancement |
| 4 | [`04-designation-dpo.md`](./04-designation-dpo.md) | Art. 10 nLPD | Template à signer | 🟠 Dans le mois du lancement |

## Plan d'action en 5 étapes

### Étape 1 — Lecture et appropriation (1-2 jours)

1. Lis intégralement les 4 templates pour comprendre ce qui est exigé
2. Identifie les placeholders `{{VARIABLE}}` que tu devras remplir
3. Note les questions juridiques que tu veux poser à un avocat

### Étape 2 — Désignation du DPO (semaine 1)

**Pourquoi commencer par là ?** Parce que le DPO est celui qui pilotera les 3 autres documents. Sans DPO désigné, personne n'est légitimement responsable de maintenir le registre à jour ou de notifier le PFPDT en cas d'incident.

**3 options pour toi :**

| Option | Coût estimé | Avantages | Inconvénients |
|---|---|---|---|
| **A. Toi-même (fondateur)** | 0 CHF (temps interne) | Rapide, tu connais le produit | Conflit d'intérêts si tu es aussi CTO/CEO (incompatible selon CLAUDE.md du DPO) |
| **B. Un employé compliance/juridique à temps partiel** | 30-50k CHF/an | Indépendance, connaissance interne | Coût, recrutement long |
| **C. DPO externe mandaté (cabinet spécialisé)** | 8-20k CHF/an | Expertise, indépendance garantie, responsabilité couverte | Moins de connaissance produit au départ |

**Ma recommandation pour la phase pilote (10-20 agences) :** **option C** (DPO externe). Tu paies un cabinet genevois ou vaudois spécialisé en protection des données qui te fournit :
- Un DPO désigné avec CV et qualifications vérifiables
- Une revue de la nLPD pour ton contexte
- Une hotline légale (quelques heures par mois)
- Un rapport trimestriel

**Cabinets suisses spécialisés nLPD** (à contacter pour devis) :
- VISCHER SA (Genève / Zurich)
- Walder Wyss (Genève / Zurich)
- Homburger (Zurich)
- LALIVE (Genève)
- Schellenberg Wittmer (Genève / Zurich)
- Sylex Legal (Lausanne — plus petit, souvent moins cher)
- DPO Suisse (Zurich — cabinet dédié DPO)

**Ce que tu fais concrètement :**
1. Envoie un email à 3 cabinets avec une brève description de MEGGA (CRM immo, KYC, scoring IA, 1-2 agences pilotes au départ)
2. Demande un devis "désignation DPO externe + revue compliance initiale + hotline"
3. Sélectionne, signe le mandat
4. Le cabinet complète le document `04-designation-dpo.md` avec ses coordonnées
5. Tu signes et tu publies les coordonnées sur la page `/privacy` et envoies au PFPDT

### Étape 3 — Registre des activités de traitement (semaine 2-3)

**Qui fait quoi :**
- **Toi** : remplis les placeholders `{{...}}` avec les vraies valeurs (raison sociale, adresse, IDE, nom du représentant légal)
- **Toi** : valide que les 12 activités listées correspondent bien à ce que MEGGA fait réellement (ajoute/retire selon l'état actuel)
- **DPO** : relit et valide chaque fiche d'activité
- **Toi** : signes les DPA (contrats de sous-traitance) avec les 10 sous-traitants listés en Annexe A du registre

**Point critique — les DPA (contrats de sous-traitance).** C'est probablement l'action la plus longue. Pour chaque sous-traitant :

| Sous-traitant | Où trouver le DPA ? | Temps estimé |
|---|---|---|
| Supabase | https://supabase.com/legal/dpa (signature via dashboard) | 15 min |
| Anthropic | https://www.anthropic.com/legal/commercial-terms (DPA dans les Terms) | 10 min |
| Dilisense | Contacter directement `contact@dilisense.com` | 1 semaine |
| Stripe | https://stripe.com/legal/dpa (auto-accepted) | 5 min |
| Resend | https://resend.com/legal/dpa | 10 min |
| Google Cloud | Via Google Cloud Console → Privacy & Security | 20 min |
| Microsoft | Via Microsoft 365 admin center → Compliance | 30 min |
| Mapbox | https://www.mapbox.com/legal/dpa | 10 min |
| PostHog | Via dashboard PostHog → Settings → Legal | 10 min |
| Cloudflare | Via dashboard Cloudflare → Legal | 15 min |

**Garde une copie PDF de chaque DPA** dans un dossier `docs/compliance/dpa/` (à créer, **pas versionné dans Git** — ajoute au `.gitignore`).

### Étape 4 — DPIA (semaine 2-4, en parallèle du registre)

**Qui fait quoi :**
- **DPO** : pilote l'analyse (c'est sa mission principale dès sa désignation)
- **Toi + équipe technique** : fournissez les détails d'architecture, les métriques de risque, la démo des fonctionnalités
- **Conseil juridique** : valide la classification finale des risques
- **Direction** : signe la décision finale

**Durée réaliste :** 2 à 4 semaines de travail intermittent, incluant les échanges avec le DPO et les revues.

**Livrable :** un PDF signé par toi + le DPO + le conseil juridique, archivé dans le dossier compliance interne (pas publié publiquement).

**Trigger de revue :** annuelle, ou à chaque évolution substantielle (nouveau modèle IA, nouveau sous-traitant sensible, nouvelle catégorie de données).

### Étape 5 — Runbook incident (semaine 3-4)

**Qui fait quoi :**
- **DPO** : complète les noms, téléphones, emails de l'équipe de réponse aux incidents
- **Toi** : définis le canal d'alerte interne (email `incident@megga.ch` ou Slack privé)
- **Toi** : teste le runbook une fois via un exercice de simulation (tabletop exercise, 2h avec toute l'équipe)

**Actions immédiates à prendre :**
1. Créer l'email `incident@megga.ch` (alias vers toi + DPO)
2. Imprimer la checklist de l'annexe B et la coller près des postes du DPO et du CTO
3. Planifier un exercice de simulation annuel dans ton agenda

---

## Coûts estimés pour la phase pilote

| Poste | Coût annuel |
|---|---|
| DPO externe (option C) | 8 000 - 20 000 CHF |
| Conseil juridique pour revue initiale des 4 documents | 3 000 - 6 000 CHF (one-shot) |
| Formation annuelle équipe | 1 000 - 2 000 CHF |
| Audit de sécurité annuel (test de pénétration léger) | 5 000 - 10 000 CHF |
| **Total année 1** | **~17 000 - 38 000 CHF** |
| **Total année 2+** | **~14 000 - 32 000 CHF** |

**Ordre de grandeur :** budgette **25 000 CHF / an** pour la compliance la première année. C'est le prix à payer pour pouvoir dire "MEGGA est conforme nLPD et LBA" en face d'un dirigeant USPI ou d'un auditeur FINMA.

---

## Actions interdites tant que ces 4 documents ne sont pas finalisés

Pour éviter tout risque juridique, **ne fais pas** :

1. ❌ Onboarder une agence pilote en production sans DPO désigné
2. ❌ Stocker un vrai document KYC (même de test) sans que le registre soit à jour
3. ❌ Faire une campagne marketing publique sans cookie banner actif (déjà en place ✅)
4. ❌ Exposer publiquement la fonctionnalité de scoring IA sans la DPIA validée
5. ❌ Signer un contrat avec une nouvelle agence sans DPA avec les sous-traitants principaux

---

## Ce qui est déjà en place côté technique (ne nécessite que la documentation)

La plupart des mesures techniques requises par la nLPD sont **déjà implémentées** dans MEGGA — il ne reste qu'à les documenter dans ces 4 fichiers :

- ✅ Storage agency-scoped sur `kyc-documents` (migration 20260411_001)
- ✅ Rétention 10 ans LBA via trigger SQL (migration 20260411_001)
- ✅ Soft-delete utilisateur (Edge Function `delete-account` + migration 20260411_002)
- ✅ Audit trail exhaustif sur KYC (`activity_events`)
- ✅ Audit trail IA (`actor_id='ai'` + log dans Edge Function `ai-copilot`)
- ✅ Cookie banner LPD conforme
- ✅ Page `/privacy` avec transferts US documentés
- ✅ Checkbox consentement sur formulaires publics
- ✅ Mention "estimation IA" sur tous les scores
- ✅ Human-in-the-loop KYC obligatoire
- ✅ Wording i18n compliance-enabling (pas "automatisé")
- ✅ Screening PEP/Sanctions via Dilisense (UE, pas de transfert hors UE)
- ✅ RLS PostgreSQL sur toutes les tables sensibles
- ✅ Droit à l'effacement fonctionnel

**Conclusion :** tu as la partie technique. Il te manque la partie juridique et organisationnelle, qui consiste à :
1. Désigner un DPO
2. Faire signer le registre
3. Faire valider la DPIA
4. Imprimer et tester le runbook

Avec un DPO externe et un conseil juridique, ces 4 livrables peuvent être bouclés en **4 à 6 semaines**.

---

## Contacts utiles

- **PFPDT** (Préposé fédéral à la protection des données et à la transparence) — https://www.edoeb.admin.ch
- **Formulaire de notification de violation de données** — https://databreach.edoeb.admin.ch/report
- **FINMA** (Autorité fédérale de surveillance des marchés financiers, pour LBA) — https://www.finma.ch
- **USPI** (Union Suisse des Professionnels de l'Immobilier) — https://uspi.ch
- **SVIT** (Schweizerischer Verband der Immobilienwirtschaft) — https://svit.ch

---

## Avertissement général

Ces 4 documents sont des **templates juridiques** produits à titre d'assistance documentaire. Ils ne constituent **pas un avis juridique** et ne remplacent pas la consultation d'un conseil spécialisé en droit suisse de la protection des données et en LBA.

**Avant toute utilisation en production :**
- Fais relire les 4 documents par un avocat spécialisé
- Adapte-les à la situation réelle de ton organisation
- Maintiens-les à jour à chaque évolution substantielle

**Date de création des templates :** 11 avril 2026
**Basé sur :** nLPD + OPDo + LBA + guides PFPDT 2023-2024
