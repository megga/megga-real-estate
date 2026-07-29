# Onboarding KYB — étape 4 : les connecteurs disponibles

> **Pour les agents :** SOUS-SKILL REQUIS — utiliser `superpowers:subagent-driven-development`.

**Goal :** produire de vraies lignes de vérification à partir des sources publiques
joignables aujourd'hui, et déclencher le moteur de scoring.

**Architecture :** une Edge Function `agency-verification-run`, appelée après la
soumission d'identité et rejouable. Elle interroge les sources, écrit les checks en
`service_role`, puis appelle `recompute_agency_verification`. Le calcul reste en
Postgres ; l'Edge Function ne sert qu'au réseau, que Postgres ne fait pas.

**Conception de référence :** [agency-kyb-verification.md](../../agency-kyb-verification.md)
§3, inventaire des sources testées en direct par Antoine le 25 juillet 2026.

---

## Global Constraints

- Edge Functions en Deno, dans `supabase/functions/`. Code partagé dans `_shared/`.
- Les tables de checks refusent l'écriture à tout rôle utilisateur : la fonction écrit en
  `service_role`, jamais depuis le navigateur. C'est ce qui empêche un inscrit de
  fabriquer sa propre preuve de vérification.
- Aucune clé d'API n'est requise par les sources de cette étape. **Si une source en
  demandait une, c'est qu'on s'est trompé de source.**
- `activity_events` : `category` doit valoir `'kyc'`, `severity` dans
  `info | warn | critical`, et avec `actor_kind='system'` le champ `actor_id` **doit être
  NULL**.
- TypeScript strict sans `any`. Apostrophes ASCII droites uniquement.
- Commentaires en français disant le **pourquoi**.
- Migration éventuelle idempotente, datée du jour du merge. La séquence du chantier va
  jusqu'à `20260728130000`.

---

## Le principe qui gouverne toute cette étape

**Une source qui ne répond pas produit un check `unavailable`, jamais une absence de
ligne et jamais un échec.**

C'est ce qui fait tenir l'ensemble. Le moteur exclut `unavailable` du numérateur et du
dénominateur : un pays sans source disponible n'est donc pas pénalisé, il est seulement
moins confirmé. Une source qui tombe ne doit ni bloquer la vérification, ni la fausser,
ni disparaître silencieusement du dossier.

Corollaire : **ne jamais inventer un résultat par défaut**. Un `match` posé faute de
réponse serait une preuve fabriquée par le système lui-même.

---

## Les sources, et ce qu'on en attend

Statuts établis en direct par Antoine le 25 juillet 2026. Aucune ne demande de clé.

| Check | Source | Ce qu'on en tire |
|---|---|---|
| `domain_whois` | RDAP `rdap.nic.ch`, `.li`, `.fr` | Âge du domaine et statut. Un domaine créé il y a trois jours en dit long ; un domaine grand public vaut pénalité compensable |
| `vat_lookup` | VIES | Validité du numéro de TVA européen |
| `registry_lookup` (FR) | `recherche-entreprises.api.gouv.fr` | Existence, statut actif, raison sociale. Public, sans clé, 7 requêtes par seconde |
| `address_geocode` | Mapbox | Cohérence entre l'adresse saisie et le pays ou canton déclaré |

**Zefix reste inaccessible** : `401`, identifiants demandés sans réponse. Le registre
suisse produit donc `unavailable`, et comme le véto « existence au registre » ne passe
que sur `match`, **tout dossier suisse part en revue humaine**. Ce n'est pas un défaut à
contourner, c'est le comportement voulu tant que la source ne répond pas.

---

## Task 1 : le socle, et la règle de l'indisponibilité

**Files:**
- Créer : `supabase/functions/_shared/kyb-sources.ts`
- Créer : `supabase/functions/agency-verification-run/index.ts`
- Créer : `tests/backend/agency-verification-run.spec.ts`

Le socle : lecture de l'agence à vérifier, écriture des checks, appel du moteur,
journalisation. Aucun connecteur réel encore, mais la règle d'indisponibilité doit être
en place et testée dès maintenant, avant qu'un connecteur ne vienne la contourner.

**Tests :** une source qui échoue produit `unavailable` ; une source qui expire produit
`unavailable` ; aucune source ne produit jamais l'absence de ligne ; la fonction appelle
bien le moteur après avoir écrit ; elle est rejouable sans empiler de doublons
contradictoires.

Sur ce dernier point, souviens-toi de ce que la revue de l'étape 3 a établi : deux checks
du même type écrits dans la même transaction sont à égalité de date, et le moteur les
départage sur un critère d'insertion. Ne t'appuie pas sur l'horodatage pour l'ordre.

---

## Task 2 : RDAP, la source qui répond partout

**Files:**
- Modifier : `supabase/functions/_shared/kyb-sources.ts`, `agency-verification-run/index.ts`
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Extraction du domaine depuis le site web déclaré, puis interrogation du serveur RDAP du
suffixe. Trois suffixes couverts : `.ch`, `.li`, `.fr`.

**Ce qu'on évalue :** l'âge du domaine et son statut. Un domaine grand public
(`gmail.com`, `outlook.com` et consorts) n'est pas le domaine d'une agence : il ne vaut
pas `mismatch`, il vaut une pénalité compensable, donc `partial`.

**Ce qu'on n'évalue pas :** la ressemblance entre le nom de domaine et la raison sociale.
C'est un arbitrage tranché du document de conception : un domaine coûte douze francs, et
un fraudeur soigneux fera correspondre son domaine à son faux nom mieux qu'une agence
légitime opérant sous une enseigne distincte. Le rapprochement approximatif, s'il vient
un jour, se fera sur le nom commercial et **jamais** sur la raison sociale.

**Un suffixe non couvert produit `unavailable`**, pas un échec.

---

## Task 3 : VIES, le registre français, et le géocodage

**Files:** les mêmes.

Trois connecteurs, chacun avec ses tests, chacun respectant la règle d'indisponibilité.

**VIES** valide un numéro de TVA européen. La TVA étant facultative à la saisie, son
absence produit `unavailable` et non `mismatch` : une petite entité sous le seuil suisse
d'assujettissement n'en a légitimement aucun.

**Le registre français** ne s'interroge que pour un siège en France. Il donne l'existence,
le statut actif et la raison sociale : c'est donc lui qui alimente les vétos d'entité pour
ce pays, là où la Suisse reste aveugle.

**Le géocodage** vérifie la cohérence entre l'adresse saisie et le pays ou canton
déclaré. Mapbox est déjà dans la pile ; réutilise la configuration existante plutôt que
d'en ajouter une.

---

## Task 4 : le déclenchement

**Files:**
- Modifier : la RPC de soumission ou le hook du wizard, selon ce que l'analyse montre
- Modifier : `tests/backend/agency-verification-run.spec.ts`

Aujourd'hui rien n'appelle la vérification. Elle doit partir après la soumission
d'identité, sans bloquer l'utilisateur : le dossier est soumis, la vérification suit.

**Un point à trancher en lisant le code :** la soumission est une RPC Postgres, et
Postgres n'appelle pas d'Edge Function nativement. Les options sont un appel depuis le
client après la soumission, un `pg_net` si l'extension est disponible, ou un cron qui
ramasse les dossiers soumis non encore vérifiés. Regarde ce que le dépôt fait déjà
ailleurs et aligne-toi, plutôt que d'introduire un troisième motif.

**Le cron**, s'il est retenu, se garde par la présence de `pg_cron` comme les autres jobs
du dépôt.

---

## Task 5 : vérification et documentation

- [ ] Suite backend complète, en lisant le compte de tests.
- [ ] `npm run lint:migrations`, `npm run lint:roster` (le registre des Edge Functions),
      `npm run build`.
- [ ] Handoff : étape 4 à l'état fait, avec ce que chaque source apporte réellement et ce
      que l'absence de Zefix implique.
- [ ] Cerveau système, puis `npm run ruflo:seed` après validation du JSON.

---

## Ce qui n'est pas dans cette étape

**Zefix et le registre UID**, qui attendent des identifiants. C'est l'étape 6, et son
squelette doit être posé de façon qu'il ne reste plus qu'à brancher l'URL,
l'authentification et l'analyse de la réponse.

**GLEIF**, injoignable depuis le bac à sable d'outils d'Antoine, ce qui n'est pas un fait
sur GLEIF. À retester depuis une Edge Function réelle avant d'en conclure quoi que ce
soit.

**La file de revue**, qui est l'étape 5.
