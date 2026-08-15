# Revue du registre de consentement — 15 défauts à corriger

> **Session FRAÎCHE : ce document est autonome.** Branche `claude/meta-verified-new-wallet-1e0b6e`,
> PR [#1206](https://github.com/megga/megga-real-estate/pull/1206), **non mergée**.
> Le chantier lui-même est décrit aux §7 à §14 de
> [2026-08-14-whatsapp-consent-registry.md](2026-08-14-whatsapp-consent-registry.md).

Revue en recall extra-haut du 15.08.2026, sur `git diff main...HEAD` (75 fichiers). Les
défauts sont classés par gravité. **Les trois premiers sont bloquants** — chacun fait
échouer en silence une garantie que le chantier annonce tenir.

⏰ **Avant tout merge** : les 12 migrations portent `20260815*` et le date-guard de
`deploy.yml` (`TODAY` en **UTC**) ne rejoue que `stamp >= TODAY`. Après le 15.08 UTC, les
re-dater (`git mv`, ordre relatif conservé) sinon **le code part sans le schéma**.

---

## 🔴 1. Le lien de désinscription pointe sur la SPA, pas sur les edge functions

`supabase/functions/_shared/email-guard.ts:78`

```ts
const base = Deno.env.get('MEGGA_APP_URL') || 'https://app.megga.ch'
const url = `${base}/functions/v1/email-unsubscribe?t=…`
```

`app.megga.ch` est du **Cloudflare Pages avec fallback SPA** ; les edge functions vivent sur
`${SUPABASE_URL}/functions/v1`. Gmail envoie son POST one-click, reçoit la coquille de l'app
en **HTTP 200**, affiche « désinscrit » — et **aucune ligne `contact_suppressions` n'est
écrite**. Un mécanisme légalement exigé qui échoue en signalant le succès.

C'est le piège déjà documenté dans le cerveau : un fallback SPA rend 200, il faut vérifier
le `content-type`, jamais le code HTTP.

**Correctif** : `Deno.env.get('SUPABASE_URL')` comme base. ⚠ Ne PAS poser `MEGGA_APP_URL`
(CLAUDE.md exige qu'elle reste absente). **Vérifier ensuite le `content-type` de la réponse**,
pas seulement son code.

## 🔴 2. `email_send_allowed` est un oracle cross-tenant

`supabase/migrations/20260815220000_contact_suppressions_email.sql:108`

Accordée à `authenticated` **sans aucune garde de tenant**, contrairement à son jumeau
`whatsapp_send_allowed` dont l'étape 0 refuse un contact hors agence. Un agent de l'agence B
peut tester n'importe quelle adresse et apprendre si elle s'est désinscrite chez l'agence A —
l'oracle exact que `public_reason` et la policy RLS existent pour fermer. Énumérable.

**Correctif** : soit une garde `auth.uid()` exigeant un `p_contact_id` de son agence (calquée
sur l'étape 0 de `whatsapp_send_allowed`), soit **révoquer à `authenticated`** — aucun
appelant front n'existe aujourd'hui, c'est le plus simple et le plus sûr.

## 🔴 3. Les erreurs PostgREST sont avalées dans la garde

`supabase/functions/_shared/whatsapp-outbound-guard.ts:142` (audit) et `:253` (persistance)

`supabase-js` **retourne** `{ error }`, il ne **jette** pas. Le `try/catch` qui entoure ces
deux écritures ne se déclenche donc jamais, et le `console.error` promis n'est jamais
atteint. Si `activity_events_category_messaging` n'est pas encore appliquée — ou si une autre
contrainte casse — **l'audit des refus est silencieusement inexistant**. C'est précisément le
défaut que le commentaire du bloc dit corriger.

**Correctif** : `const { error } = await …insert(…)` puis journaliser. Idem pour l'upsert du
sortant (`:253`) et le `rpc('mark_suppression_ack_sent')` (`:276`).
⚠ **Le test doit compter des lignes**, pas vérifier que ça ne jette pas.

---

## 🟠 4. Le motif métier du refus n'atteint jamais l'agent

`src/hooks/useContactConsent.ts:188`

`supabase.functions.invoke` met les réponses non-2xx dans `error` (un `FunctionsHttpError` au
message générique) et laisse `data` à `null`. `if (error) throw error` propage donc « Edge
Function returned a non-2xx status code », jamais `phone_suppressed`. La carte cherche
`fiche.consent.inviteError.<ce message>`, ne trouve rien, affiche le générique : **les cinq
motifs traduits sont inatteignables**, ce qui est l'inverse du but de la carte.

**Correctif** : lire le corps via `error.context.json()`, ou faire répondre l'edge en 200
avec `{ ok: false, error }` pour les refus MÉTIER (en gardant les vrais 4xx/5xx pour les
pannes).

## 🟠 5. Deux lectures du hook échouent en silence

`src/hooks/useContactConsent.ts:105`

Seule `sup.error` est propagée ; `log.error` et `inv.error` sont ignorés. Un timeout sur
`whatsapp_optin_invites` rend `pendingInvite: null` → la carte réaffiche le bouton et l'agent
envoie une **seconde invitation** : deux liens vivants pour la même personne, donc un
consentement qu'on ne saura pas attribuer. Un échec sur `whatsapp_consents` rend
`optedIn: false` → on propose d'inviter quelqu'un qui a déjà consenti.

Le hook applique sa propre doctrine (« ne rien affirmer sur une lecture ratée ») à une
requête sur trois.

**Correctif** : propager les trois erreurs.

## 🟠 6. Deux expéditeurs gardés mais sans moyen de se désinscrire

`supabase/functions/send-reminder-email/index.ts:278` et `send-property-email/index.ts:184`

Ils reçoivent la garde mais ni l'en-tête `List-Unsubscribe`, ni le pied de page : seul
`send-relance-email` les porte. Une personne qui reçoit un rappel n'a **aucun** moyen de
sortir depuis ce message, et l'en-tête manquant pèse sur la délivrabilité de tout le domaine.

**Correctif** : `unsubscribeHeaders()` + `unsubscribeFooterHtml()` dans les deux, comme dans
`send-relance-email:135`. (Corriger le §1 d'abord, sinon on propage un lien mort.)

## 🟠 7. Le jeton d'opt-in est conservé dans `whatsapp_messages.raw`

`supabase/functions/whatsapp-webhook/index.ts:330`

La branche `client_optin` remplace `body` par un marqueur, mais `insertInboundOnce` écrit
toujours `raw: msg.raw` — le payload Meta complet, donc le jeton signé en clair, pendant
30 jours. Le commentaire affirme le contraire. L'usage unique et l'égalité d'expéditeur
limitent le dégât, mais la propriété annoncée n'est pas tenue.

**Correctif** : passer `raw: null` dans le `extra` de cette branche.

## 🟠 8. L'accusé STOP a perdu son profil de retry délibéré

`supabase/functions/_shared/whatsapp-stop.ts:120` et `whatsapp-process/index.ts` (avis LPD)

Les deux utilisaient `{ maxAttempts: 2, timeoutMs: 6000, retryNetworkError: false }` — rejouer
les seuls refus de quota, jamais un 5xx ambigu. Via la garde ils obtiennent `maxAttempts: 1`
et le `timeoutMs` par défaut de **8000**. Un throttle 429 sur l'accusé — seul message que
recevra jamais qui écrit « stop » en premier — n'est plus rejoué, et chaque envoi du cron peut
bloquer 8 s au lieu de 6 sur un budget de 90 s.

**Correctif** : exposer `retryProfile` (ou `timeoutMs` + `retryNetworkError`) dans
`SendOutboundArgs` et le passer à `sendWithRetry`.

---

## 🟡 9 à 15 — moindre gravité

| # | Fichier | Défaut |
|---|---|---|
| 9 | `20260815219000_whatsapp_optin_invites.sql:35` | `sent_by` déclarée, **jamais écrite** — colonne morte dans une table de preuve. `create_wa_optin_invite` ne la reçoit pas. |
| 10 | `ContactDetailPager.tsx:715,738` | `toLocaleDateString('fr-CH')` figé, dans une carte traduite en 4 langues. |
| 11 | `whatsapp-outbound-guard.ts:177` | Paramètre `fallbackOffered` de `blocked()` jamais passé — le chemin `window_closed` construit son retour à la main. |
| 12 | `whatsapp-outbound-guard.ts:296` | Le corps journalisé passe de `[template: <clé>]` à `[template:<nom Meta>]` : deux formats dans l'historique, et la clé interne disparaît. |
| 13 | `scripts/check-whatsapp-outbound.mjs:86` | `^(.+?)\?([^?:]+):([^?:]+)$` casse sur `?.` ou un `:` dans la condition → la porte bloque du code correct. |
| 14 | `20260815218000_reconcile_wa_consent_cache.sql:20` | Balayage complet de `contacts` chaque nuit, sans LIMIT ni fenêtre → statement timeout à l'échelle, et la dérive s'installe sans rien signaler. |
| 15 | `whatsapp-optin-send.ts` / `email-guard.ts` | Pas de test de bout en bout : la garde e-mail et l'envoi d'invitation n'ont **aucun** banc (seule la RPC SQL est couverte). |

---

## Ordre suggéré

1. **§1, §2, §3** — indépendants, rapides, chacun ferme un silence.
2. **§6** après §1 (sinon on propage un lien mort).
3. **§4, §5, §7, §8** — le reste des 🟠.
4. Les 🟡 selon le temps.

## Ce qui n'est PAS un défaut, et qu'il ne faut pas « corriger »

- La garde **échoue fermé** sur un verdict indisponible : c'est voulu.
- Un jeton de désinscription **expiré est accepté** : voulu (§14 du plan).
- Le **transactionnel passe outre** une suppression : voulu, c'est une réponse.
- `suppress_contact_email` écrit `channel='email'` et **jamais `'all'`** : voulu.
- Un agent qui clique l'opt-out Meta **ne reçoit aucun accusé** : voulu.

## Rappel des vérifications

```bash
npm run test:unit && npm run lint:migrations && npm run lint:whatsapp-outbound \
  && npm run lint:spec-sql && npm run lint:edge-auth && npm run lint:roster
```

⛔ Pas de Docker sur cette machine : le banc backend (56 tests) ne tourne **qu'en CI**.
Lire le **compte de tests exécutés**, jamais le seul code de sortie — `skipIf` rend vert un
job qui n'a rien fait.
