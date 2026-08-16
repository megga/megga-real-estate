# Langue des e-mails — ce qui reste, et dans quel ordre

> Écrit le 16 août 2026, à la fin du chantier qui a porté dix gabarits aux quatre langues.
> Ce document est un **point de reprise** : il dit ce qui est fait, ce qui reste, et les
> pièges déjà payés. Il se périme le jour où les quatre lots ci-dessous sont clos.

## La règle

**La langue d'interface EST la langue de correspondance.** Si quelqu'un bascule le CRM ou
la vitrine en allemand, ses courriels suivent. Décision de Julien, 16 août 2026.

## Où l'on en est

**Dix gabarits sur quatorze** rendent les quatre langues (fr, de, en, it) :

| gabarit | destinataire | source de langue |
|---|---|---|
| `onboarding-email` (confirmation, rappel J-1, annulation) | agence | `profiles.language` |
| `booking-email` (convocation KYC) | **client de l'agence** | `contacts.language` |
| `device-alert-email` (sécurité) | agent | `profiles.language` |
| `team-invite-email` | invité **sans compte** | langue de qui invite |
| `agency-verification-notice` (décision KYB) | dirigeant | `profiles.language`, **un envoi par langue** |
| `magic-link-email` | client | déjà multilingue avant le chantier |
| `whatsapp-optin-send` | client | déjà multilingue avant le chantier |

**Deux gabarits n'ont pas à être traduits** : `weekly-report-email` et `admin-alert-email`
sont **internes à l'équipe MEGGA**. Les traduire serait du travail sans destinataire.

## Ce qui reste : quatre gabarits, trois natures différentes

### Lot A — les rappels automatiques · effet le plus fort

`_shared/reminder-email.ts` ne porte que la coquille ; **la copie est ailleurs** :
`send-reminder-email/index.ts` déclare **cinq gabarits par défaut** (« Suite à notre
sélection de biens », « Votre avis suite à la visite », « Des nouvelles de votre projet
immobilier », « Document requis pour votre dossier », « Point sur votre projet
immobilier »), avec des variables `{{contact.first_name}}`.

Ils partent **par `automation-engine`, donc par cron** : aucune requête d'où lire une
langue. C'est exactement le cas que `contacts.language` existe pour servir.

⚠ **Le piège** : ces défauts sont surchargeables par des gabarits en base
(`contact_reminder_templates`). Traduire les défauts ne traduit pas les surcharges. Deux
sorties possibles, et c'est une décision : soit la table gagne une colonne de langue, soit
les surcharges restent dans la langue où l'agence les a écrites — ce qui est défendable,
puisque ce sont **ses** mots.

### Lot B — visite et envoi de bien · mécanique

`_shared/visit-email.ts` (~16 chaînes) et `_shared/property-email.ts` (~5 chaînes) portent
de la vraie copie MEGGA autour d'un contenu structuré. Même motif que les dix déjà faits :
une table `Record<AppLocale, …>`, un champ `locale` optionnel, et l'appelant qui lit
`contacts.language`.

⚠ **`visit-email` a déjà coûté un défaut de date** (corrigé le 15.08 : `getHours()` et
`getDate()` rendaient l'heure UTC, pas l'heure suisse). En le portant, vérifier que
`formatVisitDate` / `formatVisitTime` prennent la locale ET gardent `Europe/Zurich`.

### Lot C — la relance · une décision de produit, pas une traduction

`send-relance-email` accepte un **sujet et un corps libres**, écrits par l'agent ou rédigés
par le copilote. Traduire la coquille autour d'un corps français donnerait un message
**bilingue** : chrome en allemand, contenu en français.

Trois sorties, à trancher avant d'écrire une ligne :

1. **Ne traduire que la mention légale et le lien de désinscription.** Défendable : ce sont
   les seules parties que MEGGA écrit, et une mention légale doit être comprise. Le reste
   appartient à l'agence.
2. **Ne rien traduire.** Cohérent, et honnête : c'est un message de l'agence, pas de MEGGA.
3. **Faire rédiger le copilote dans `contacts.language`.** La seule vraie réponse — mais
   elle ne touche pas le gabarit, elle touche l'invite du copilote (`megga/ai-relances`).

### Lot D — la vitrine · le trou connu

Un utilisateur **déjà inscrit** qui bascule la langue sur `megga.ch` ne l'enregistre pas :
`localStorage` est cloisonné par origine et la vitrine n'a pas la session du CRM. En
pratique il rebasculera dans le CRM, où c'est capté. Fermer le trou demande de brancher
`sites/megga-vitrine/js/megga-lang.js` sur son propre client Supabase.

## Ce qu'il faut savoir avant de toucher à un gabarit

- **Deux colonnes, deux populations.** `profiles.language` = utilisateurs MEGGA.
  `contacts.language` = clients d'une agence. Les confondre écrit au client dans la langue
  de son courtier.
- **La requête prime sur la base** (`_shared/recipient-language.ts`) : qui vient de basculer
  attend sa confirmation dans la nouvelle langue, même si la persistance n'a pas atterri.
  `parseLocale` rend `null` et non `'fr'` sur l'inconnu — sinon un corps de requête bruité
  écraserait une préférence réelle.
- **Une table, jamais un ternaire.** `locale === 'en' ? 'en' : 'fr'` avalait `de` et `it` en
  silence. `Record<AppLocale, …>` fait échouer la compilation quand une langue manque.
- **Passer `lang` à `shell()`.** Un e-mail allemand annoncé `lang="fr"` casse la césure, la
  synthèse vocale et WCAG 3.1.1.
- **Aucun accord de genre**, dans aucune langue : le gabarit ne connaît pas le genre du
  destinataire. Formuler sans accord plutôt que d'en choisir un.
- **Aucun tiret cadratin** dans du texte envoyé. `lint:prose` ne couvre que
  `src/i18n/locales/`, elle ne le verra pas ici.
- **Inscrire la spec dans `vitest.config.ts`.** Une spec de `_shared/` absente de
  l'allowlist ne tourne **nulle part**.
- **Relire le rendu** : `npm run email:preview` puis `.email-preview/index.html`.

## Comment traduire

La méthode qui a produit les quatre derniers gabarits : un agent traduit, **un second
relit en cherchant l'invention** — pas le style. Sur 80 chaînes, elle a écarté trois
défauts réels qu'une relecture ordinaire aurait laissés passer : une affirmation absente du
français, un désaccord de genre dans un même message, et un tutoiement repris de
l'interface. Consigne qui fait la différence : « par défaut, réponds *reel=false* ; la
charge de la preuve est sur la trouvaille ».
