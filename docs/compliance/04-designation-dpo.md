# Désignation du conseiller à la protection des données (DPO)

**Base légale :**
- Art. 10 nLPD (conseiller à la protection des données)
- Ordonnance sur la protection des données (OPDo), art. 23 à 25

**Responsable du traitement :** `{{RAISON_SOCIALE}}`
**Date de désignation :** `{{DATE}}`
**Version :** 1.0

---

## Rappel — La nLPD et le DPO

**Important :** contrairement au RGPD (art. 37), la nLPD **n'impose pas** obligatoirement la désignation d'un conseiller à la protection des données pour les entreprises privées. Cependant :

1. **La désignation est fortement recommandée** pour les entreprises qui effectuent des traitements à risque élevé (art. 22 nLPD) — ce qui est le cas de MEGGA Real Estate avec le scoring IA et le screening PEP/Sanctions.

2. **La désignation d'un DPO permet à MEGGA de renoncer à la consultation préalable du PFPDT** en cas d'identification d'un risque résiduel élevé dans une DPIA (art. 23 al. 4 nLPD), sous réserve que le DPO :
   - Soit suffisamment qualifié
   - Dispose des ressources nécessaires
   - Puisse exercer sa fonction en toute indépendance

3. **Avantage réputationnel** : vis-à-vis des agences pilotes (USPI, SVIT) et des clients internationaux, la désignation d'un DPO est un signal fort de maturité en matière de protection des données.

---

## 1. Désignation

Par la présente, `{{RAISON_SOCIALE}}`, représentée par `{{NOM_REPRESENTANT_LEGAL}}` en sa qualité de `{{FONCTION}}`, désigne :

**`{{NOM_PRENOM_DPO}}`**

en qualité de **Conseiller à la protection des données** au sens de l'art. 10 nLPD, à compter du **`{{DATE_EFFET}}`**.

### Coordonnées du conseiller à la protection des données

| Champ | Valeur |
|---|---|
| Nom et prénom | `{{NOM_PRENOM}}` |
| Fonction dans l'organisation | `{{FONCTION}}` (ex. "Responsable compliance et protection des données") |
| Email dédié | `privacy@megga.ch` |
| Téléphone | `{{TEL}}` |
| Adresse postale | `{{RAISON_SOCIALE}}, à l'attention du DPO, {{ADRESSE}}` |
| Langue de contact | Français, Allemand, Anglais, Italien |

Ces coordonnées sont **publiées sur le site web public de MEGGA** à la page `/privacy` conformément à l'art. 10 al. 4 nLPD.

---

## 2. Type de désignation

Cocher l'option applicable :

- [ ] **DPO interne salarié** — le conseiller est un employé de MEGGA, désigné à temps plein ou à temps partiel pour cette fonction
- [ ] **DPO interne à double casquette** — le conseiller cumule cette fonction avec une autre fonction au sein de MEGGA, sous réserve d'absence de conflit d'intérêts (cf. section 5)
- [ ] **DPO externe mandaté** — le conseiller est un prestataire externe (cabinet d'avocats, consultant spécialisé) lié par un contrat de mandat

**Option retenue :** `{{OPTION}}`

**Durée du mandat :** `{{DUREE}}` (recommandation : durée indéterminée avec revue annuelle)

---

## 3. Qualifications du conseiller

Le conseiller à la protection des données dispose des qualifications et connaissances suivantes (art. 23 OPDo) :

### Connaissances requises
- [ ] Connaissance de la nLPD et de l'OPDo
- [ ] Connaissance des principes généraux du RGPD (pour les traitements transfrontaliers)
- [ ] Connaissance de la LBA et des obligations KYC pour les activités immobilières
- [ ] Compréhension technique des architectures SaaS (bases de données, chiffrement, authentification, IA)
- [ ] Capacité à rédiger des analyses d'impact (DPIA)
- [ ] Capacité à mener des audits internes
- [ ] Capacité à dialoguer avec les autorités (PFPDT)
- [ ] Compétences pédagogiques pour former les employés

### Preuves (à annexer)
- Diplôme(s) / certification(s) pertinent(s) : `{{LISTE}}` (ex. CIPP/E, CIPM, formation DPO CERT, master en droit, etc.)
- Expérience professionnelle : `{{NB_ANNEES}}` années dans le domaine
- CV à jour daté du `{{DATE}}`

**IMPORTANT :** le DPO doit suivre une formation continue en protection des données d'au moins **1 jour par an**, à la charge de l'employeur.

---

## 4. Missions et responsabilités

Conformément à l'art. 10 al. 2 et 3 nLPD et à l'art. 25 OPDo, le conseiller à la protection des données exerce les missions suivantes :

### Missions obligatoires

1. **Conseiller** le responsable du traitement et les employés sur toutes les questions relatives à la protection des données
2. **Vérifier** l'application des dispositions de la nLPD et des directives internes
3. **Assister** à l'élaboration et à l'application des règles internes de protection des données
4. **Former** les employés aux obligations en matière de protection des données
5. **Tenir à jour** le registre des activités de traitement (art. 12 nLPD)
6. **Mener ou superviser** les analyses d'impact (DPIA) pour les traitements à risque élevé (art. 22 nLPD)
7. **Traiter** les demandes d'exercice de droits des personnes concernées (accès, rectification, effacement, portabilité, opposition)
8. **Gérer** les incidents de sécurité des données et superviser la notification au PFPDT sous 72h (art. 24 nLPD)
9. **Coopérer** avec le PFPDT lors d'enquêtes ou de demandes d'information
10. **Rapporter** régulièrement à la direction (au minimum une fois par trimestre)

### Missions spécifiques MEGGA

11. **Auditer** semestriellement les accès au bucket `kyc-documents` et vérifier l'étanchéité des policies RLS
12. **Revoir** annuellement la DPIA du scoring IA et du screening PEP/Sanctions
13. **Analyser** les hits PEP/Sanctions faux positifs pour détecter des patterns problématiques
14. **Superviser** le respect de la rétention 10 ans LBA sur les documents KYC
15. **Valider** chaque nouvelle activité de traitement avant sa mise en production (application du scope gate compliance)
16. **Approuver** les contrats de sous-traitance (DPA) avec les nouveaux fournisseurs

### Missions interdites

Le DPO **ne peut pas** :
- Prendre des décisions commerciales à la place de la direction
- Prendre des décisions techniques à la place de l'équipe produit
- Valider un dossier KYC à la place de l'agent (le DPO n'est pas un agent LBA)
- Auto-réviser son propre travail (séparation des pouvoirs)

---

## 5. Indépendance et absence de conflit d'intérêts

Le conseiller à la protection des données exerce sa fonction **en toute indépendance** conformément à l'art. 10 al. 3 nLPD et à l'art. 24 OPDo.

### Garanties accordées par `{{RAISON_SOCIALE}}`

1. **Pas d'instruction sur l'exercice des missions** — le responsable du traitement ne peut donner aucune instruction au DPO sur la manière de traiter une question de protection des données.
2. **Accès direct à la direction** — le DPO peut faire remonter tout problème directement au plus haut niveau hiérarchique sans passer par un supérieur intermédiaire.
3. **Protection contre les sanctions** — le DPO ne peut être sanctionné, licencié ou subir un désavantage professionnel pour avoir exercé ses missions.
4. **Ressources suffisantes** — l'employeur met à disposition :
   - Un budget annuel de formation : `{{MONTANT_CHF}}` CHF
   - Un budget annuel pour outils et audits externes : `{{MONTANT_CHF}}` CHF
   - Un temps de travail dédié : au minimum `{{POURCENTAGE}}` % du temps si DPO à double casquette
5. **Accès à toutes les informations** — le DPO dispose d'un accès en lecture à toutes les données, tables, logs et systèmes nécessaires à l'exercice de ses missions, y compris les activités traitées par la direction.

### Déclaration d'absence de conflit d'intérêts

Le conseiller désigné déclare :

- [ ] Ne pas être en conflit d'intérêts avec les missions de protection des données
- [ ] Ne pas occuper une fonction qui l'amènerait à définir les finalités ou les moyens des traitements qu'il doit ensuite contrôler (incompatibilité classique : CTO, DSI, Directeur Marketing, Responsable Sécurité)
- [ ] S'engager à signaler immédiatement tout conflit d'intérêts potentiel à la direction

**Fonctions compatibles** (exemples, pour un DPO interne à double casquette) : Chief Compliance Officer, Responsable juridique, Responsable risques, Conseiller stratégique.

**Fonctions incompatibles** : CEO, CTO, Directeur Marketing, Directeur Commercial, Responsable Produit, Responsable IT, Responsable Sécurité des Systèmes d'Information.

---

## 6. Moyens alloués

### Moyens humains
- Accès au support de l'équipe technique pour les questions d'architecture
- Possibilité de mandater un conseil juridique externe pour les questions complexes
- Possibilité de mandater un auditeur externe pour les tests de pénétration annuels

### Moyens techniques
- Compte super_admin (ou rôle dédié `dpo` à créer) sur la plateforme MEGGA avec lecture seule sur toutes les tables
- Accès aux logs Supabase et Cloudflare
- Accès au dashboard d'administration `{{URL}}`
- Accès à un outil de gestion des demandes d'exercice de droits

### Budget annuel indicatif
- Formation continue : `{{MONTANT}}` CHF
- Outils et logiciels : `{{MONTANT}}` CHF
- Conseil juridique externe : `{{MONTANT}}` CHF
- Audit de sécurité annuel : `{{MONTANT}}` CHF
- **Total : `{{TOTAL}}` CHF / an**

---

## 7. Reporting

Le DPO rend compte de son activité :

- **Trimestriellement** à la direction via un rapport écrit incluant :
  - Nombre de demandes d'exercice de droits traitées
  - Nombre d'incidents de sécurité détectés et leur classification
  - État du registre des traitements
  - État des DPIA
  - Écarts identifiés par rapport à la politique de protection des données
  - Formations dispensées
  - Actions recommandées

- **Annuellement** via un rapport public anonymisé publié sur le site web de MEGGA (engagement transparence vis-à-vis des agences utilisatrices).

- **Immédiatement** en cas d'incident de sécurité des données relevant de l'art. 24 nLPD.

---

## 8. Terme et remplacement

Le mandat de conseiller à la protection des données prend fin :
- Par démission du DPO avec préavis de `{{PREAVIS}}` mois
- Par décision de la direction, à condition qu'un successeur soit désigné **avant** l'effet de la cessation et que la passation de dossiers soit documentée
- Par force majeure (incapacité durable, décès)

En cas de cessation, les coordonnées publiées sur `/privacy` doivent être mises à jour dans les **5 jours ouvrables**.

---

## 9. Publication

Conformément à l'art. 10 al. 4 nLPD, les coordonnées du conseiller à la protection des données sont :

- Publiées sur le site web public à l'adresse : https://megga.ch/privacy
- Communiquées au Préposé fédéral à la protection des données et à la transparence (PFPDT) via `{{EMAIL_PFPDT}}`

---

## 10. Signatures

### Pour le responsable du traitement (`{{RAISON_SOCIALE}}`)

| Rôle | Nom | Date | Signature |
|---|---|---|---|
| `{{FONCTION}}` | `{{NOM}}` | `{{DATE}}` | |

### Pour le conseiller à la protection des données

Je soussigné(e), `{{NOM_PRENOM_DPO}}`, accepte la présente désignation en qualité de Conseiller à la protection des données de `{{RAISON_SOCIALE}}` et m'engage à exercer mes missions conformément à l'art. 10 nLPD, aux règles internes de l'organisation et à déontologie professionnelle.

| Date | Signature |
|---|---|
| `{{DATE}}` | |

---

## Annexe A — Modèle de communication au PFPDT

**Objet :** Désignation d'un conseiller à la protection des données — `{{RAISON_SOCIALE}}`

Madame, Monsieur,

Conformément à l'art. 10 al. 4 nLPD, nous avons l'honneur de vous communiquer les coordonnées du conseiller à la protection des données désigné par notre organisation :

- **Entreprise :** `{{RAISON_SOCIALE}}`
- **Adresse :** `{{ADRESSE}}`
- **Numéro IDE :** `{{IDE}}`
- **Conseiller à la protection des données :** `{{NOM_PRENOM}}`
- **Fonction :** `{{FONCTION}}`
- **Email de contact :** privacy@megga.ch
- **Téléphone :** `{{TEL}}`
- **Date d'entrée en fonction :** `{{DATE}}`

Ces coordonnées sont également publiées sur notre site web à l'adresse https://megga.ch/privacy.

Nous restons à votre disposition pour toute information complémentaire.

Cordialement,

`{{NOM}}`
`{{FONCTION}}`
`{{RAISON_SOCIALE}}`

---

## Avertissement

Ce document est un **template** de désignation. Il doit être :
- Adapté à votre situation réelle
- Signé par un représentant légal habilité
- Validé par un conseil juridique spécialisé
- Conservé dans le dossier RH et dans le dossier compliance
- Mis à jour à chaque changement de DPO
