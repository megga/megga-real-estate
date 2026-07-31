# HANDOFF — Diagnostic d'un lien KYC (Console MEGGA)

> Acté le 30 juillet 2026. Remplace la page **Support** (`/support`, supprimée — rail à 13 entrées).
> Audit : `Audit — Support (Console MEGGA).html` (option B) · Concepts : `Console - Diagnostic de lien (concepts).html` (forme C retenue).
> Implémentation front : `admin-kyc-diagnostic.jsx` (`window.AdmKycDiagnostic`), ouverte depuis `admin-overview.jsx` (`AovFoot`, ligne « Liens KYC publics »).

**⚠️ À lire avant d'écrire la moindre ligne de backend sur ce sujet.** Les contraintes ci-dessous ne sont pas des détails d'UI : elles définissent ce que la plateforme a le droit de voir des clients finaux d'une agence.

---

## 1. Le besoin, en une phrase

Une agence signale « ma cliente n'a jamais reçu son lien KYC ». MEGGA est le seul dépositaire de la preuve d'envoi (le lien part en **WhatsApp / SMS — zéro e-mail**). La console doit pouvoir répondre : *où en est ce lien ?* — et rien de plus.

## 2. Ce que ce n'est PAS

- ❌ Pas une page, pas une entrée de rail. C'est un **outil ponctuel** (modale) ouvert depuis le tunnel agrégé.
- ❌ Pas une liste parcourable de clients finaux (c'était « Clients finaux », supprimée).
- ❌ Pas d'accès aux **documents**, aux **pièces d'identité**, au **dossier LBA** — ils appartiennent à l'agence.
- ❌ Pas de renvoi du lien au client **par la plateforme** : le lien régénéré est **remis à l'agence**, qui le transmet.
- ❌ Pas de jeton, pas d'URL signée, pas d'adresse IP dans la réponse.

## 3. Le flux (3 temps, non contournables)

| # | Étape | Contrainte backend |
|---|---|---|
| 1 | **Motif** — agence qui signale + référence du signalement | Champs **obligatoires**. Transmis à chaque appel de recherche ; sans eux le RPC refuse. |
| 2 | **Recherche exacte** — e-mail, téléphone ou nom | **Min. 3 caractères** (normalisés : minuscules, sans accents ni espaces/points/tirets). **Plafond 3 correspondances** : au-delà, le RPC renvoie `too_many` + le compte, **jamais les lignes**. |
| 3 | **Résultat** — étape atteinte + régénération | Une seule action mutante : `regenerate`. |

## 4. Contrat de données

**Recherche** — `admin_kyc_link_lookup(motive_agency_id, motive_ref, query)`

Réponse par correspondance (max 3) :

```
contact      // nom affiché
email
phone
agency       // agence propriétaire du lien
status       // pending | opened | uploading | verifying | submitted | expired
mode         // "Autonome" | "Assisté"
sent_at      // horodatage d'envoi (affiché en relatif)
```

Rien d'autre. Pas de `token`, pas de `link_url`, pas de `documents[]`, pas de `ip`, pas de `user_agent`.

**Étapes affichées** (dérivées de `status`, ordre fixe) : `Envoyé → Ouvert → Documents déposés → Complet`.
Mapping actuel du front : `pending→0 · opened→1 · uploading/verifying→2 · submitted→3 · expired→0 (marqué en rouge)`.

**Régénération** — `admin_kyc_link_regenerate(link_id, motive_agency_id, motive_ref)`
→ invalide l'ancien lien, en émet un nouveau, **le dépose côté agence** (jamais d'envoi sortant depuis la console). Réponse : succès + horodatage, **pas le lien lui-même**.

## 5. Journalisation (non négociable)

Chaque **recherche** et chaque **régénération** écrit dans le journal Sécurité :
`acteur · horodatage · motif (agence + référence) · requête · lien consulté · action`.
Le motif est la raison d'être de l'étape 1 : l'audit doit dire **pourquoi** on a cherché un nom, pas seulement **qui**.

**Rétention** : rien n'est conservé côté console à la fermeture de la modale (pas de cache, pas d'historique de session). Seul le journal Sécurité garde la trace.

## 6. Le vrai correctif, prioritaire (P0 — côté agent)

Le ticket doit disparaître à la source : dans l'**écran KYC du CRM agent**, l'agent voit l'étape atteinte de *ses* liens (date d'envoi, ouvert / non ouvert) et peut **renvoyer par WhatsApp** lui-même. Tant que ce n'est pas fait, la modale console absorbe les signalements ; une fois fait, elle devient l'exception qu'elle doit être.

## 7. À mesurer avant d'industrialiser

1. **Combien de liens signalés par mois ?** Au-delà d'une vingtaine, ce n'est plus du support : c'est un défaut de délivrance WhatsApp à corriger dans l'envoi.
2. **Que voit déjà l'agent** dans son écran KYC ? S'il voit l'étape, la modale est redondante.
3. **Faut-il une allowlist** d'acteurs autorisés à lancer une recherche nominative (au-delà du super-admin) ?

---

*Réf. front : `admin-kyc-diagnostic.jsx` · `admin-overview.jsx` (`AovFoot`, `ADMIN_KYC_FUNNEL`) · données de démo `ADMIN_KYC_LINKS` dans `admin-data.jsx`.*
