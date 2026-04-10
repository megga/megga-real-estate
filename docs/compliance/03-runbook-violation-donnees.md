# Runbook — Notification d'une violation de la sécurité des données (art. 24 nLPD)

**Objet :** Procédure opérationnelle à suivre en cas de violation de la sécurité des données à caractère personnel, en application de l'art. 24 nLPD (notification au PFPDT dans les meilleurs délais, en principe **72 heures**).

**Responsable du traitement :** `{{RAISON_SOCIALE}}`
**Propriétaire du runbook :** Conseiller à la protection des données (DPO)
**Dernière revue :** `{{DATE}}`
**Version :** 1.0

---

## Rappel légal

**Art. 24 nLPD — Notification des violations de la sécurité des données**

> 1 Le responsable du traitement annonce dans les meilleurs délais au Préposé fédéral à la protection des données et à la transparence (PFPDT) les cas de violation de la sécurité des données qui entraînent vraisemblablement un risque élevé pour la personnalité ou les droits fondamentaux de la personne concernée.
>
> 2 L'annonce mentionne au moins la nature de la violation, ses conséquences et les mesures prises ou envisagées.
>
> 3 Le sous-traitant annonce dans les meilleurs délais au responsable du traitement tout cas de violation de la sécurité des données.
>
> 4 Le responsable du traitement informe la personne concernée lorsque cela est nécessaire à sa protection ou lorsque le PFPDT l'exige.

**Sanction en cas de non-notification :** amende administrative jusqu'à **CHF 250 000** (art. 60 nLPD) pour le responsable du traitement personne physique, et action pénale possible contre la personne responsable.

---

## Définitions

**Violation de la sécurité des données** (art. 5 let. h nLPD) : toute violation de la sécurité entraînant de manière accidentelle ou illicite la perte de données personnelles, leur modification, leur effacement ou leur destruction, leur divulgation ou un accès non autorisés à ces données.

**Exemples concrets pour MEGGA :**
- Accès non autorisé à la DB Supabase (compromission d'une clé service_role, faille RLS, injection SQL)
- Fuite d'un bucket Storage (mauvaise policy, URL signée valide trop longtemps)
- Vol d'un ordinateur portable d'un employé contenant des exports clients
- Phishing ayant permis à un tiers d'accéder à un compte admin
- Ransomware chiffrant la DB ou les backups
- Envoi d'un email contenant des données KYC à un mauvais destinataire
- Perte accidentelle d'une clé d'API permettant l'accès à Dilisense ou Stripe
- Divulgation involontaire d'un document KYC à un agent d'une autre agence (cross-agency leak)
- Défaillance d'un sous-traitant (par ex. Supabase signale une brèche)

---

## Équipe de réponse aux incidents (IRT)

| Rôle | Nom | Contact | Joignabilité |
|---|---|---|---|
| **Coordinateur incident** (DPO ou CTO) | `{{NOM}}` | `{{EMAIL}}` / `{{TEL}}` | 24/7 |
| **Responsable technique** | `{{NOM}}` | `{{EMAIL}}` / `{{TEL}}` | Heures ouvrables |
| **Responsable juridique** (interne ou externe) | `{{NOM_CABINET}}` | `{{EMAIL}}` / `{{TEL}}` | Heures ouvrables |
| **Responsable communication** | `{{NOM}}` | `{{EMAIL}}` / `{{TEL}}` | Heures ouvrables |
| **Direction (sponsor exécutif)** | `{{NOM}}` | `{{EMAIL}}` / `{{TEL}}` | Escalade critique |

**IMPORTANT :** maintenir cette liste à jour. Toute modification doit être communiquée à l'ensemble de l'équipe dans les 24 heures.

---

## Procédure pas à pas

### Phase 0 — Détection (T0)

**Sources de détection possibles :**
- Alertes Sentry / monitoring Supabase
- Signalement par un employé, un client, un partenaire
- Signalement par un sous-traitant (Supabase, Stripe, Dilisense, etc.)
- Veille externe (forum, Twitter, presse)
- Audit interne

**Action immédiate :** quiconque détecte ou suspecte une violation doit **immédiatement** en informer le Coordinateur incident par email ET téléphone. **Ne pas attendre d'avoir des certitudes.**

**Canal d'alerte :** `{{EMAIL_INCIDENT}}` (ex. `incident@megga.ch`) + téléphone du DPO.

### Phase 1 — Containment (T0 + 0h à T0 + 1h)

**Objectif :** stopper la fuite sans détruire les preuves.

**Checklist :**

- [ ] Ouvrir un **ticket d'incident** dans l'outil de gestion (`{{OUTIL}}`) avec horodatage précis
- [ ] Identifier le **vecteur** présumé (compte compromis, vulnérabilité, erreur humaine, défaillance sous-traitant)
- [ ] **Isoler** le vecteur :
  - Révoquer les clés API compromises (Anthropic, Dilisense, Stripe, Resend, Google, Microsoft, Mapbox)
  - Suspendre les comptes utilisateurs compromis via Supabase Auth
  - Déployer un hotfix si la cause est une vulnérabilité code
  - Retirer temporairement un document fuité du bucket
- [ ] **Préserver les preuves** : exporter les logs Supabase, les logs Cloudflare, les logs d'application des dernières 48h minimum
- [ ] **Ne pas communiquer publiquement** à ce stade
- [ ] Informer la direction et le conseil juridique

**À ne PAS faire :**
- ❌ Supprimer les logs ou les données suspectes
- ❌ Désinstaller les outils compromis sans capture
- ❌ Contacter la personne concernée avant évaluation juridique
- ❌ Parler à la presse

### Phase 2 — Évaluation de l'impact (T0 + 1h à T0 + 24h)

**Objectif :** déterminer si la violation déclenche l'obligation de notifier le PFPDT.

**Grille d'évaluation :**

| Critère | Question | Réponse |
|---|---|---|
| **Type de données** | Des données personnelles sont-elles concernées ? | Oui / Non |
| **Catégories** | Des données sensibles sont-elles concernées ? (KYC, PEP, documents d'identité, données financières) | Oui / Non |
| **Volume** | Combien de personnes sont affectées ? | `{{NB}}` |
| **Confidentialité** | Y a-t-il eu divulgation à un tiers non autorisé ? | Oui / Non |
| **Intégrité** | Les données ont-elles été modifiées ou altérées ? | Oui / Non |
| **Disponibilité** | Les données sont-elles inaccessibles (chiffrement ransomware, suppression) ? | Oui / Non |
| **Conséquences potentielles** | Usurpation d'identité, fraude financière, atteinte à la réputation, discrimination, perte de contrôle ? | `{{LIST}}` |
| **Atténuation préalable** | Les données étaient-elles chiffrées ou anonymisées ? | Oui / Non |

**Classification du risque :**

- 🟢 **Risque négligeable** : données anonymisées, données publiques, incident contenu sans impact sur les personnes concernées → **pas de notification PFPDT** mais documenter l'incident en interne.
- 🟡 **Risque faible à modéré** : données non sensibles, petit volume, mesures d'atténuation en place → notification PFPDT **optionnelle** mais recommandée par prudence.
- 🔴 **Risque élevé** : données sensibles (KYC, PEP, documents d'identité), volume significatif (>100 personnes), ou potentiel d'usurpation d'identité / fraude → **notification PFPDT OBLIGATOIRE** dans les 72h.

**Cas spécifiques MEGGA avec présomption de risque élevé :**
- Fuite d'un ou plusieurs documents du bucket `kyc-documents`
- Exfiltration de la table `contacts` ou `kyc_cases`
- Accès non autorisé à un dossier KYC (cross-agency leak)
- Compromission d'une clé service_role Supabase
- Divulgation de hits PEP/Sanctions à un tiers

### Phase 3 — Notification au PFPDT (T0 + 24h à T0 + 72h)

**⏰ Délai légal : dans les meilleurs délais, en principe 72 heures** à compter de la connaissance de la violation (art. 24 al. 1 nLPD).

**Si l'évaluation en Phase 2 conclut à un risque élevé :**

1. **Formulaire de notification du PFPDT** disponible à :
   👉 https://databreach.edoeb.admin.ch/report
   (formulaire en ligne officiel, disponible en FR/DE/IT/EN)

2. **Informations à fournir** (art. 24 al. 2 nLPD + bonnes pratiques) :
   - Identité du responsable du traitement
   - Date, heure et circonstances de la violation
   - Date et heure de la découverte
   - Nature de la violation (confidentialité / intégrité / disponibilité)
   - Catégories et volume approximatif de personnes concernées
   - Catégories et volume approximatif de données concernées
   - Conséquences probables de la violation
   - Mesures prises ou envisagées pour remédier à la violation
   - Mesures pour atténuer les conséquences négatives
   - Coordonnées du DPO ou du point de contact
   - Si toutes les informations ne sont pas disponibles sous 72h, notifier par étapes (notification initiale puis compléments)

3. **Copie à conserver** dans le dossier d'incident interne.

4. Le PFPDT peut ensuite :
   - Demander des informations complémentaires
   - Mener une enquête (art. 49 nLPD)
   - Ordonner des mesures (art. 51 nLPD)
   - Proposer des mesures correctrices

### Phase 4 — Notification aux personnes concernées (art. 24 al. 4 nLPD)

**Condition de notification :** uniquement si cela est **nécessaire à la protection** de la personne concernée ou si le **PFPDT l'exige**.

**Exemples où la notification directe est nécessaire :**
- La personne doit changer son mot de passe ou révoquer un accès
- La personne doit surveiller son compte bancaire pour détecter une fraude
- La personne doit contacter les autorités pour une usurpation d'identité
- Un document d'identité a été fuité et peut être utilisé frauduleusement

**Contenu de la notification à la personne concernée :**
- Langage clair et simple (pas de jargon juridique)
- Nature de la violation
- Catégories de données concernées
- Conséquences probables
- Mesures prises par MEGGA
- Mesures que la personne peut prendre elle-même
- Coordonnées du DPO pour toute question

**Canal recommandé :** email personnalisé, éventuellement accompagné d'un courrier postal pour les cas graves.

**Template disponible en Annexe A.**

### Phase 5 — Post-mortem et amélioration (T0 + 1 semaine à T0 + 1 mois)

**Objectif :** comprendre la cause racine et prévenir la récurrence.

**Checklist :**

- [ ] Rédiger un **rapport d'incident** interne (blameless post-mortem)
- [ ] Identifier la **cause racine** (technique, humaine, organisationnelle)
- [ ] Lister les **mesures correctives** et leur propriétaire
- [ ] Mettre à jour le **registre des traitements** si nécessaire
- [ ] Mettre à jour la **DPIA** des traitements concernés si nécessaire
- [ ] Mettre à jour ce **runbook** avec les leçons apprises
- [ ] Communiquer les enseignements à l'équipe lors d'une revue sécurité
- [ ] Archiver l'intégralité du dossier d'incident pendant 5 ans minimum
- [ ] Si nécessaire, planifier un **test de pénétration** ou un audit externe

---

## Annexe A — Template d'email à une personne concernée

```
Objet : Important — Incident de sécurité affectant vos données personnelles

Madame, Monsieur,

Nous vous écrivons pour vous informer qu'un incident de sécurité est survenu le
[DATE] concernant certaines de vos données personnelles que nous traitons dans
le cadre de nos services.

NATURE DE L'INCIDENT
[Description factuelle en 3-4 phrases, sans euphémisme mais sans alarmisme]

DONNÉES CONCERNÉES
Les catégories de données suivantes sont concernées :
- [Liste précise]

CONSÉQUENCES POSSIBLES POUR VOUS
[Description honnête des risques]

MESURES QUE NOUS AVONS PRISES
- [Liste des mesures : containment, notification PFPDT, etc.]

MESURES QUE NOUS VOUS RECOMMANDONS DE PRENDRE
- [Changer votre mot de passe / surveiller vos comptes / contacter votre banque / etc.]

VOS DROITS
Vous disposez d'un droit d'accès, de rectification et d'effacement de vos
données. Pour toute question ou pour exercer vos droits, vous pouvez contacter
notre conseiller à la protection des données :

[NOM DPO]
Email : privacy@megga.ch
Téléphone : [NUMÉRO]

Vous avez également la possibilité de déposer une plainte auprès du Préposé
fédéral à la protection des données et à la transparence (PFPDT) :
https://www.edoeb.admin.ch

Nous sommes sincèrement désolés pour cet incident et restons à votre
disposition pour toute information complémentaire.

Cordialement,
[NOM]
[FONCTION]
MEGGA Real Estate
```

---

## Annexe B — Checklist rapide (version imprimable pour astreinte)

```
┌──────────────────────────────────────────────────────────────┐
│  INCIDENT DE SÉCURITÉ DÉTECTÉ — CHECKLIST 72h                │
│                                                              │
│  T0 = .............. (date et heure de découverte)          │
│                                                              │
│  [ ] Alerter le coordinateur incident (tel + email)         │
│  [ ] Ouvrir ticket d'incident                               │
│  [ ] Isoler le vecteur (révoquer, désactiver, contenir)     │
│  [ ] Préserver les logs et preuves                          │
│  [ ] Informer direction + conseil juridique                 │
│                                                              │
│  T0 + 24h                                                    │
│  [ ] Évaluer l'impact (grille Phase 2)                      │
│  [ ] Décider : risque élevé oui/non ?                       │
│  [ ] Si oui → préparer notification PFPDT                   │
│                                                              │
│  T0 + 72h (MAX)                                              │
│  [ ] Notifier le PFPDT via databreach.edoeb.admin.ch        │
│  [ ] Notifier les personnes concernées si nécessaire        │
│                                                              │
│  T0 + 1 semaine                                              │
│  [ ] Post-mortem                                            │
│  [ ] Mesures correctives                                    │
│  [ ] Mise à jour du registre et du runbook                  │
│                                                              │
│  Coordinateur incident : ..................................│
│  Tél : .................................................... │
│  Email : .................................................. │
└──────────────────────────────────────────────────────────────┘
```

**Coller cette checklist près du poste du DPO et du CTO. Revue annuelle obligatoire.**

---

## Avertissement

Ce runbook est un **template opérationnel**. Il doit être :
- Adapté à l'organisation réelle de l'équipe MEGGA (noms, téléphones, outils)
- Testé au moins une fois par an via un exercice de simulation (tabletop exercise)
- Validé par le conseil juridique
- Mis à jour à chaque évolution significative de l'architecture ou de l'équipe
