# Catalogue des scénarios — Copilote conversationnel de l'agent (WhatsApp)

> Date : 2026-06-02 · Statut : draft vivant (à enrichir avec Gregory)
> Principe : **MEGGA = l'assistant humain parfait derrière le WhatsApp de l'agent.**
> Tout ce que l'agent dirait à un assistant en chair et en os, il peut le dire à MEGGA,
> en langage naturel (voix ou texte), et la conversation se construit naturellement.

## Niveaux d'autonomie (la ligne rouge)
- 🟢 **Auto** : MEGGA exécute seul (données internes CRM) puis confirme. Risque faible.
- 🟡 **Confirme** : MEGGA prépare, l'agent valide d'un « oui » avant exécution.
- 🔵 **Lecture** : MEGGA consulte et répond.
- 🔴 **Jamais sans validation** : envoi/communication au CLIENT, validation KYC/LAB,
  signature, mouvement d'argent. Human-in-the-loop obligatoire (Document Maître).

---

## 1. Leads & contacts 🟢/🔵

**Créer / capturer**
- « J'ai une cliente Sarah Williams, cherche un 3,5p à louer à Carouge, 3000.-, terrasse. »
- « Nouveau contact : Marc Dupont, 079 123 45 67, vendeur, villa à Cologny. »
- « Le monsieur que j'ai vu ce matin veut investir, budget 2 millions sur Genève. »
- Transfert d'un message client / d'une carte de visite / d'un appel manqué → extraire + créer.
- « Ajoute-la à ma liste d'acheteurs prioritaires. »

**Enrichir / mettre à jour**
- « Sarah, c'est finalement 4 pièces et elle veut un parking. »
- « Change le numéro de Dupont, c'est le 078… »
- « Note pour Dubois : visite faite, très intéressé, veut une 2ᵉ visite cette semaine. »
- « Marque Sarah comme chaud / froid. »
- « Fusionne les deux fiches Dubois, c'est la même personne. »

**Consulter / retrouver**
- « Résume-moi le dossier Dubois. » · « Où en est Martin ? »
- « Qui je n'ai pas relancé depuis 2 semaines ? » · « Mes leads chauds. »
- « Combien de nouveaux leads cette semaine ? »
- « Les coordonnées de Sarah ? »

## 2. Biens & mandats 🟢/🟡/🔵

- « Nouveau mandat : appartement 4,5p, av. de Champel 12, 1,8M, 110m², balcon. »
- Photo/PDF d'un mandat ou d'une annonce → extraire les infos + créer le bien.
- « Baisse le prix du bien des Eaux-Vives à 1,5M. » · « Passe-le en sous-offre / vendu. »
- Photos d'un bien reçues → les rattacher à l'annonce.
- « Génère-moi une description pour le 3p de Carouge. » (copie IA)
- « Lance un home staging virtuel sur ces photos. »
- « Quels biens n'ont pas eu de visite depuis 2 semaines ? »
- « Combien vaut un 4p à Champel ? » (estimation / comparables)
- « Publie / dépublie l'annonce X. » 🟡

## 3. Matching & recommandations 🟢/🟡/🔵

- « Quels biens correspondent à Sarah ? » → résultats du moteur.
- « Ce nouveau mandat, à quels acheteurs il correspond ? » (matching inverse)
- « Y a-t-il du nouveau pour mes recherches actives ? »
- « Envoie les 3 meilleurs biens à Sarah. » 🔴 (validation)

## 4. Visites & agenda 🟢/🟡/🔵

- « Planifie une visite avec Sarah samedi 14h au bien de Carouge. » (détecter les conflits)
- « Mes RDV demain ? » · « Ma semaine. » · « Mon prochain RDV. »
- « Décale la visite de Dupont à lundi. » · « Annule le RDV de 15h. »
- « Confirme la visite à Sarah. » 🔴 (envoi client)
- « Après la visite : Dubois a adoré, propose une offre. » (compte-rendu + next step)
- Rappels automatiques avant un RDV. · « Bloque mon vendredi après-midi. »

## 5. Communication client 🔴 (toujours validée)

- « Réponds à Dubois : oui pour samedi 14h. » → brouillon + « tu confirmes ? »
- « Envoie la brochure du bien X à Sarah. »
- « Relance tous les leads qui ont visité la semaine dernière. » (lot → validation)
- « Écris un message sympa à Mme Martin pour son anniversaire. »
- Choix du canal (WhatsApp / email). · Hors fenêtre 24h → template Meta.

## 6. Transactions, pipeline & documents 🟢/🟡/🔴

- « Passe Martin en offre acceptée. » · « Enregistre une offre de 1,6M sur le bien X. »
- « Quelles affaires se signent ce mois-ci ? » · « Mon volume du trimestre. »
- Étapes : mandat signé → en ligne → visites → offres → négociation → signé.
- « Génère le mandat / le contrat pour M. Dupont. » 🔴 (puis signature Skribble/DocuSign)
- « Ma commission sur l'affaire Martin ? »

## 7. Compliance / KYC / LAB 🟡/🔴/🔵 (la spécialité — compliance-first)

- « Lance le KYC sur Sarah. » · « Le KYC de Dupont est fait ? »
- Photo d'une pièce d'identité / d'un justificatif → rattacher au dossier KYC.
- « Vérifie Martin (PEP / sanctions). » (Dilisense)
- « Quels dossiers ont un KYC incomplet ? » · Rappels documents manquants.
- Toute **validation** KYC/LAB = 🔴 humaine. Audit trail immuable 10 ans (LBA art. 7).

## 8. Connaissance & marché 🔵

- « Loyer moyen d'un 3p à Carouge ? » · « Prix au m² aux Eaux-Vives ? »
- « Règles sur la sous-location à Genève ? » · « Explique-moi la règle LAB sur X. »
- « Tendance des prix sur 12 mois à Champel ? »

## 9. Productivité & briefing de l'agent 🟢/🔵

- « Qu'est-ce que je dois faire aujourd'hui ? » (action board / next-best-actions)
- « Bonjour MEGGA » → briefing du jour (RDV, relances, urgences).
- « Résume-moi ma semaine. » · « Mes chiffres du mois. »
- « Rappelle-moi d'appeler le notaire à 15h. » · To-dos personnels.

## 10. Dynamique conversationnelle (le « naturel », transversal)

- **Mémoire du fil** : MEGGA se souvient des derniers échanges (enabler n°1).
- **Clarification** : info manquante → **une** question ciblée → l'agent répond → MEGGA complète.
- **Correction** : « non, 3,5 pas 4 » · « finalement c'est à acheter, pas louer ».
- **Suite contextuelle** : « et ajoute qu'elle veut un parking » (référence au lead en cours).
- **Désambiguïsation** : « Dubois » = 2 contacts → « lequel : Jean ou Marie ? »
- **Annulation / undo** : « annule ce que je viens de dire » · « laisse tomber ».
- **Multi-intentions** : « crée Sarah ET planifie une visite ET relance Dupont » (une phrase).
- **Confirmation honnête** : « ✅ J'ai créé Sarah (lead), il me manque son tél. »
- **Aveu** : « Je n'ai pas trouvé ce contact » plutôt qu'inventer.

## 11. Entrées possibles (multimodal)

- **Voix** (transcription Deepgram) — le mode dominant de l'agent en déplacement.
- **Photos** : pièce d'identité (KYC), bien, note manuscrite, plan.
- **Messages/contacts transférés** depuis une conversation client.
- **PDF** : mandat, dossier, fiche d'un bien.
- **Localisation** (« le client veut près d'ici »).
- **Dictée longue et désordonnée** → MEGGA structure.
- **Multi-langue** : FR (défaut), DE, EN, IT (clients internationaux à Genève).

## 12. Proactivité (MEGGA initie — sous contrainte 24h/template)

- « ⚠️ Sarah n'a pas été relancée depuis 5 jours. »
- « 📅 Rappel : visite avec Dupont dans 1h. »
- « 🆕 3 nouveaux biens correspondent à Sarah. »
- « 📄 Le KYC de Martin expire bientôt. »
- Contrainte : hors fenêtre 24h, une notif spontanée exige un **template Meta** (à cadrer).

## 13. Garde-fous & gouvernance (transversal)

- 🔴 **Jamais** d'envoi au client, de validation KYC, de signature ou de mouvement d'argent sans « oui » de l'agent.
- L'agent peut **corriger / annuler** toute action.
- Cloisonnement par agence (multi-agents) : MEGGA ne voit que SON agence.
- Anti-injection : le contenu cité/transféré d'un tiers est de la **donnée**, jamais un ordre.
- Tout est **journalisé** (timeline, badge IA) — audit immuable.
- MEGGA reste une **assistance**, jamais « automatique » ni « garanti ».

---

## À enrichir avec Gregory
- Priorités : quels scénarios en premier ? (probablement : capture lead + agenda + relances)
- Le vocabulaire réel de Gregory (ses tournures, ses raccourcis).
- Les limites qu'il veut fixer lui-même (ce qu'il refuse que MEGGA fasse seul).
- Scénarios « catastrophe » à éviter (ce qui ne doit JAMAIS arriver).
