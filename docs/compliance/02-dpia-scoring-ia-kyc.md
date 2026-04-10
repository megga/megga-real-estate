# Analyse d'impact relative à la protection des données (DPIA/EFD)

## Scoring comportemental IA et Screening PEP/Sanctions — MEGGA Real Estate

**Base légale :** Art. 22 nLPD (évaluation d'impact relative à la protection des données) + Guide du PFPDT sur l'EFD (2023).

**Responsable du traitement :** `{{RAISON_SOCIALE}}`
**Date de l'analyse :** `{{DATE_ANALYSE}}`
**Auteur :** `{{NOM_DPO}}`
**Version :** 1.0
**Statut :** `Brouillon | En revue | Validé`
**Consultation du PFPDT requise :** à évaluer après analyse des risques résiduels (art. 23 nLPD)

---

## Résumé exécutif

Cette analyse d'impact porte sur deux traitements à risque élevé effectués par la plateforme MEGGA Real Estate :

1. **Scoring comportemental IA** (`buyer intelligence` / `seller intelligence`) : génération automatique de scores 0-100 décrivant le sérieux, l'engagement, le timing probable d'un contact immobilier, basés sur l'analyse de son comportement sur la plateforme.

2. **Screening PEP/Sanctions via Dilisense** : vérification automatique de chaque client faisant l'objet d'un dossier KYC contre les listes de Personnes Exposées Politiquement (PEP) et de sanctions internationales, en application de la Loi sur le blanchiment d'argent (LBA).

**Conclusion anticipée :** les deux traitements sont **nécessaires et proportionnés** à leurs finalités respectives (assistance commerciale pour le scoring, obligation légale LBA pour le screening), et les risques résiduels pour les personnes concernées sont **acceptables** sous réserve de la mise en œuvre des mesures techniques et organisationnelles décrites au chapitre 6.

---

## 1. Description du traitement

### 1.1 Scoring comportemental IA

**Finalité.** Fournir aux agents immobiliers un outil d'aide à la décision leur permettant de prioriser leurs actions commerciales (quels clients rappeler, quels biens envoyer, quelle relance programmer) sur la base d'un score agrégé calculé à partir du comportement observable du client sur la plateforme.

**Nature du traitement.** Profilage automatisé au sens de l'art. 5 let. f nLPD, avec production d'une **évaluation de caractéristiques personnelles** (sérieux, probabilité d'achat, niveau d'engagement, timing).

**Portée fonctionnelle.** Deux modules distincts :
- `buyer intelligence` : scores `ai_seriousness_score`, `ai_purchase_probability`, `ai_timing`, `ai_engagement_level`
- `seller intelligence` : scores `ai_tension_level`, `ai_price_reduction_probability`

**Contexte d'utilisation.** Les scores sont affichés dans l'interface agent sous forme de badges et de texte descriptif, systématiquement accompagnés du libellé explicite **"estimation IA"** (icône Sparkles). L'agent décide seul des actions à entreprendre. Aucune décision automatisée produisant un effet juridique à l'égard du client n'est prise sur la base du score.

**Fréquence.** Recalcul en temps réel à chaque interaction pertinente (nouveau message, visite, changement d'étape pipeline, feedback post-visite), via la fonction de calcul déterministe `score-engine` déployée comme Edge Function Supabase.

**Algorithme.** Modèle déterministe pondéré (pas d'apprentissage automatique). 5 facteurs pour le buyer score :
- Réactivité (20%) — temps de réponse moyen
- Engagement (25%) — fréquence et tendance des interactions
- Cohérence budget (20%) — écart budget déclaré vs biens visités
- Qualité des visites (20%) — show-up rate, feedbacks, patterns de rejet
- Conversion (15%) — progression pipeline, offres soumises, timing

### 1.2 Screening PEP/Sanctions via Dilisense

**Finalité.** Satisfaire aux obligations de diligence de la LBA (art. 3 à 6 LBA et ordonnance LBA-FINMA 2015/1) en vérifiant que les parties à une transaction immobilière ne figurent pas sur une liste de sanctions internationales ou ne sont pas des Personnes Exposées Politiquement nécessitant une diligence renforcée.

**Nature du traitement.** Communication de données d'identification (nom, prénom, date de naissance, nationalité) à un sous-traitant spécialisé (Dilisense) qui les compare à plus de 120 listes internationales (OFAC SDN, UE, ONU, SECO, PEP mondiaux, etc.) et retourne un ensemble de `hits` catégorisés.

**Portée.** Déclenchement manuel par l'agent via bouton "Lancer le screening" dans la fiche KYC. Pas d'automatisation silencieuse.

**Données transmises à Dilisense.** Nom, prénom, date de naissance, nationalité. Aucune donnée financière, aucune adresse, aucune photo de document d'identité.

**Données reçues.** Liste de hits PEP (avec fonction politique, pays, source) et hits sanctions (avec source, type de sanction, date). Score de confiance pour chaque hit.

**Décision finale.** Toujours humaine. Le hit est affiché à l'agent qui doit décider s'il s'agit d'un vrai positif ou d'un homonyme, et documenter sa décision dans les notes du dossier KYC. Validation via modal de confirmation explicite.

---

## 2. Nécessité et proportionnalité

### 2.1 Scoring IA

**Alternative moins intrusive envisagée.** Un tri manuel des contacts sans scoring automatique. **Rejetée** car un agent immobilier gère en moyenne 150 à 400 contacts actifs, ce qui rend impossible un suivi manuel granulaire. L'absence de priorisation conduit à une perte d'opportunités commerciales et à des relances mal ciblées (source d'agacement côté client).

**Données minimisées.** Le scoring n'utilise que des données déjà présentes dans le CRM pour d'autres finalités (interactions, visites, pipeline). Aucune collecte supplémentaire.

**Proportionnalité.** Le score est utilisé comme aide à la décision, pas comme décision. Un contact scoré "froid" n'est pas exclu du service, simplement déprioritisé dans les actions proactives de l'agent. La personne concernée continue de recevoir le même niveau de service si elle contacte l'agent.

**Transparence.** Mention "estimation IA" systématique. Politique de confidentialité mentionnant explicitement le scoring. Droit d'opposition via `privacy@megga.ch` (remise à NULL des champs `ai_*` du profil contact).

### 2.2 Screening PEP/Sanctions

**Nécessité légale.** Obligation directe de la LBA. L'absence de screening exposerait MEGGA et ses agences utilisatrices à des sanctions pénales et administratives (LBA art. 37).

**Données minimisées.** Seul le strict nécessaire est transmis à Dilisense : identité minimale, sans document ni donnée financière.

**Proportionnalité.** Le screening est déclenché uniquement pour les dossiers KYC actifs, pas sur tous les contacts CRM. Les résultats sont conservés dans le dossier KYC et soumis à la rétention 10 ans LBA (pas davantage).

**Transparence.** La personne concernée est informée dès l'ouverture du dossier KYC que sa situation fera l'objet d'une vérification contre des listes PEP/Sanctions. Cette information est obligatoire au titre de l'art. 19 nLPD.

---

## 3. Risques pour les personnes concernées

### 3.1 Scoring IA — identification des risques

| Risque | Probabilité | Gravité | Niveau global |
|---|---|---|---|
| **R1.** Discrimination involontaire (un contact mal scoré reçoit moins d'attention commerciale sans raison objective) | Moyenne | Moyenne | **Modéré** |
| **R2.** Biais d'algorithme (un profil client atypique génère un score systématiquement bas) | Faible | Moyenne | **Faible** |
| **R3.** Effet de "self-fulfilling prophecy" (un agent moins attentif à un contact mal scoré génère des données qui renforcent le score bas) | Moyenne | Moyenne | **Modéré** |
| **R4.** Défaut de transparence (la personne ignore qu'elle est scorée et ne peut exercer son droit d'opposition) | Faible | Moyenne | **Faible** |
| **R5.** Divulgation accidentelle du score à la personne concernée (embarras, atteinte à la dignité) | Faible | Élevée | **Modéré** |
| **R6.** Utilisation du score au-delà de sa finalité (par ex. communication à un tiers) | Faible | Élevée | **Modéré** |

### 3.2 Screening PEP/Sanctions — identification des risques

| Risque | Probabilité | Gravité | Niveau global |
|---|---|---|---|
| **S1.** Faux positif (homonyme avec une personne réellement sanctionnée ou PEP) causant un retard ou un refus de transaction | Moyenne | Élevée | **Élevé** |
| **S2.** Divulgation à Dilisense de données personnelles d'une personne qui n'aurait pas dû faire l'objet d'un screening | Faible | Moyenne | **Faible** |
| **S3.** Rétention excessive des résultats au-delà de 10 ans | Très faible | Moyenne | **Très faible** |
| **S4.** Fuite de données depuis le bucket `kyc-documents` vers une autre agence (cross-agency leak) | Faible (policies RLS) | Très élevée | **Modéré** |
| **S5.** Suppression prématurée d'un document KYC avant la fin de la rétention 10 ans | Faible (trigger SQL) | Élevée | **Faible** |
| **S6.** Absence de décision humaine sur un hit (validation automatique) | Très faible (human-in-the-loop imposé) | Très élevée | **Faible** |

---

## 4. Mesures techniques et organisationnelles existantes

### 4.1 Pour le scoring IA

1. **Label "estimation IA"** affiché systématiquement à côté de tout score (R4)
2. **Pas de décision automatisée** produisant un effet juridique (art. 21 nLPD)
3. **Droit d'opposition** documenté dans la politique de confidentialité, exécutable via `privacy@megga.ch` (R4, R6)
4. **Audit trail** de tous les calculs de score via `activity_events` avec `actor_id = 'ai'` (R4, R6)
5. **Algorithme déterministe** (pas de ML black-box) — les facteurs et leurs pondérations sont documentés et auditable (R2)
6. **Accès restreint** aux scores via RLS PostgreSQL — seul l'agent propriétaire et son agence voient les scores de ses contacts (R5, R6)
7. **Réversibilité** — l'agent peut ignorer ou contredire une suggestion IA sans friction (R3)

### 4.2 Pour le screening PEP/Sanctions

1. **Human-in-the-loop obligatoire** — tout hit nécessite une validation humaine via modal de confirmation (S1, S6)
2. **Séparation stricte des résultats PEP et Sanctions** pour permettre une évaluation nuancée (S1)
3. **Audit trail exhaustif** via Edge Function `kyc-screening` qui log chaque screening dans `activity_events` avec provider, counts, timestamp
4. **Storage agency-scoped** via policies RLS `(storage.foldername(name))[1] = get_my_agency_id()::text` sur le bucket `kyc-documents` (S4)
5. **Trigger `trg_enforce_kyc_retention`** bloquant toute suppression anticipée d'un document KYC tant que `retention_until > now()` (S3, S5)
6. **Rôle `super_admin` seul** autorisé à supprimer un document KYC, et uniquement après expiration de la rétention (S3, S5)
7. **Déclenchement manuel** du screening — jamais automatique (S2)
8. **Transmission minimale** à Dilisense (identité seule, pas de documents) (S2)
9. **Sous-traitant dans l'UE** (Dilisense) — pas de transfert hors UE pour cette donnée sensible

---

## 5. Évaluation des risques résiduels

Après application des mesures du chapitre 4, les risques résiduels sont évalués comme suit :

| Risque | Avant mesures | Après mesures |
|---|---|---|
| R1 — Discrimination involontaire | Modéré | **Faible** |
| R2 — Biais algorithme | Faible | **Très faible** |
| R3 — Self-fulfilling prophecy | Modéré | **Faible** |
| R4 — Défaut de transparence | Faible | **Très faible** |
| R5 — Divulgation du score | Modéré | **Faible** |
| R6 — Utilisation hors finalité | Modéré | **Faible** |
| S1 — Faux positif PEP/Sanctions | Élevé | **Modéré** |
| S2 — Transmission excessive à Dilisense | Faible | **Très faible** |
| S3 — Rétention excessive | Très faible | **Nul** |
| S4 — Fuite cross-agency | Modéré | **Très faible** |
| S5 — Suppression prématurée | Faible | **Très faible** |
| S6 — Validation automatique | Faible | **Très faible** |

**Risque résiduel le plus élevé :** S1 (faux positif PEP/Sanctions) — inhérent à la nature probabiliste du matching et ne peut être éliminé entièrement. Ce risque est néanmoins atténué par la validation humaine obligatoire et la séparation des hits par source et niveau de confiance.

---

## 6. Mesures complémentaires recommandées

1. **Formation annuelle des agents** sur l'usage non discriminatoire des scores IA et la gestion des faux positifs PEP/Sanctions (coût estimé : 1 jour par an)
2. **Publication d'une fiche d'information sur le scoring** accessible aux personnes concernées depuis la politique de confidentialité, expliquant le fonctionnement en langage clair
3. **Dashboard de monitoring** interne permettant au DPO de détecter des patterns de scoring anormaux (par ex. concentration de scores bas sur un canton spécifique) — à implémenter Q3
4. **Revue semestrielle des faux positifs PEP/Sanctions** par le DPO, avec ajustement des seuils de confiance si nécessaire
5. **Procédure documentée de gestion d'un faux positif** incluant un droit de recours rapide pour la personne concernée
6. **Test de pénétration annuel** du bucket `kyc-documents` pour valider l'étanchéité des policies RLS
7. **Consultation préalable du PFPDT (art. 23 nLPD)** si des risques résiduels modérés ou élevés persistent après mesures — à évaluer après un an d'exploitation

---

## 7. Consultation des parties prenantes

| Partie prenante | Date de consultation | Retours intégrés |
|---|---|---|
| Direction MEGGA | `{{DATE}}` | `{{NOTES}}` |
| Conseiller juridique externe | `{{DATE}}` | `{{NOTES}}` |
| Représentants des agences pilotes (Gregory Lyonnet, autres) | `{{DATE}}` | `{{NOTES}}` |
| Conseiller à la protection des données (DPO) | `{{DATE}}` | `{{NOTES}}` |

---

## 8. Conclusion et décision

**Les deux traitements sont considérés comme licites, nécessaires et proportionnés.**

Le scoring IA est un outil d'aide à la décision qui ne prive pas les personnes concernées de l'accès au service et qui respecte les exigences des art. 5, 6, 19, 21 et 31 nLPD sous réserve de la mise en œuvre complète des mesures du chapitre 4.

Le screening PEP/Sanctions est imposé par la LBA et ne peut être évité. Les mesures techniques et organisationnelles mises en place (human-in-the-loop, storage RLS, rétention 10 ans, audit trail) sont conformes à l'état de l'art et dépassent les exigences minimales.

**Décision :** Le traitement est **autorisé** sous réserve de :
- Publication du présent DPIA dans le registre compliance interne
- Mise en œuvre complète des mesures recommandées du chapitre 6 dans un délai de 6 mois
- Revue annuelle de la présente analyse
- Consultation du PFPDT si un incident matériel survient ou si un risque résiduel est réévalué à la hausse

**Signatures :**

| Rôle | Nom | Date | Signature |
|---|---|---|---|
| Responsable du traitement | `{{NOM}}` | `{{DATE}}` | |
| Conseiller à la protection des données | `{{NOM}}` | `{{DATE}}` | |
| Conseil juridique externe | `{{NOM}}` | `{{DATE}}` | |

---

## Avertissement

Cette analyse d'impact est un **template** basé sur l'état actuel de l'architecture MEGGA et les exigences de la nLPD. Elle doit être :
- Adaptée à la situation réelle de votre organisation
- Validée par un conseil juridique spécialisé en droit suisse de la protection des données
- Mise à jour annuellement ou à chaque évolution substantielle du traitement

La présente analyse ne constitue pas un avis juridique et ne dispense pas de l'obligation de consulter le PFPDT si les risques résiduels le justifient (art. 23 nLPD).
