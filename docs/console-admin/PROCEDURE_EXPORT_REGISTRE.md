# Premier export du registre — marche à suivre

> Étape 31 / critère G4 « premier export du registre produit et vérifié ». Tout ce qui suit a
> été **relevé en base le 02.08.2026** : signature, gardes, GRANT, plafonds, forme de la
> réponse. Voir aussi le [runbook incident](RUNBOOK_INCIDENT.md) §4-5.

## 1. ⚠ « Un clic de super-admin » n'existe pas encore

Le préflight annonçait un clic, pas du code. **Mesuré : `admin_log_export` n'a aucun
consommateur front** — zéro occurrence dans `src/`, exactement comme `admin_cron_run_now`
avant le branchement du bouton « Relancer ». La console n'a pas d'écran d'export, et les cinq
exports CSV qu'elle portait ont été retirés à l'étape 22 (garde-fou `no-csv-export.spec.ts`).

Le premier export se produit donc par un **appel direct à la RPC**. Deux voies, et le choix
n'est pas cosmétique : il décide de **qui signe l'extrait**.

## 2. Choisir la voie — l'attribution est le critère

`admin_log_write` dérive l'acteur d'`auth.uid()`. Sans JWT — clé de service, `postgres`,
pg_cron — `auth.uid()` est `NULL` et la ligne du registre est forcée à **« Système »** (la
fonction *lève* si on tente de lui passer un autre libellé).

| | Voie A — session super-admin | Voie B — clé de service |
|---|---|---|
| GRANT `authenticated` sur `admin_log_export` | ✅ mesuré | — |
| Ligne du registre attribuée à | **la personne** (nom, e-mail, `actor_user_id`) | **« Système »** |
| Mise en œuvre | devtools sur la console, ~2 min | script Node, reproductible |

**Pour le PREMIER export, prendre la voie A.** L'artefact doit démontrer que le registre
attribue un geste à un humain nommé ; un premier extrait signé « Système » démontre l'inverse.
La voie B convient ensuite pour un export récurrent (§9).

## 3. Voie A — pas à pas

1. Se connecter à `app.megga.ch` avec un compte de `super_admin_allowlist()` (**2 comptes**
   aujourd'hui).
2. Ouvrir la console : `/dashboard/admin`. L'entrée est elle-même journalisée
   (`admin_console_entered`) — c'est normal, et ce sera visible dans l'extrait.
3. Ouvrir les devtools **sur cette page**, onglet Console.
4. Récupérer la clé anon depuis `src/lib/supabase.ts` (`DEFAULT_ANON_KEY` — publique par
   design, la sécurité vient de la RLS) ou depuis n'importe quelle requête de l'onglet Réseau.
5. Coller, en ajustant `p_from` / `p_to` :

```js
const REF = 'eayczugyrvmtqnnmvjod'
const ANON = '…'   // clé anon, cf. étape 4

// Le jeton vit sous la clé par défaut de supabase-js, dans localStorage OU sessionStorage
// selon « Se souvenir de moi » (cf. l'adaptateur de stockage de src/lib/supabase.ts).
const K = `sb-${REF}-auth-token`
let brut = localStorage.getItem(K) ?? sessionStorage.getItem(K)
if (brut?.startsWith('base64-')) brut = atob(brut.slice(7))   // forme récente du client
const { access_token } = JSON.parse(brut)

const reponse = await fetch(`https://${REF}.supabase.co/rest/v1/rpc/admin_log_export`, {
  method: 'POST',
  headers: {
    apikey: ANON,
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_from: '2026-08-01T00:00:00Z',      // le registre commence le 01.08 à 08:40 UTC
    p_to: new Date().toISOString(),
    p_family: null,                       // ⚠ SANS filtre — voir §6
    p_idempotency_key: crypto.randomUUID(),
  }),
})
const extrait = await reponse.json()
copy(JSON.stringify(extrait, null, 2))    // ⚠ AVANT toute autre manipulation, voir §5
extrait
```

6. **Coller le presse-papier dans un fichier immédiatement.** Un rejeu avec la même clé ne
   rendra pas l'extrait (§5).

## 4. Voie B — clé de service (export récurrent)

Mêmes paramètres, depuis un script Node, avec `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`
— la convention des scripts du dépôt (`scripts/seed-admin-staging.mjs`). ⚠ La ligne du
registre portera « Système ».

## 5. Les cinq pièges, tous mesurés

1. **`p_idempotency_key` porte un `DEFAULT NULL` mais est OBLIGATOIRE.** L'omettre rend
   `precondition_failed — Clé d'idempotence manquante.` La signature ment, la fonction non.
2. **Un rejeu avec la même clé rend `{ ok: true, data: { already_done: true } }` — SANS
   l'extrait.** Ni `entries`, ni `digest_sha256`. Perdre la réponse oblige à repartir sur une
   clé neuve, ce qui produit une **seconde** ligne au registre.
3. **Deux plafonds à 5 000, et le second surprend.** Le premier porte sur les lignes remises ;
   le second sur l'étendue **contiguë** de `seq` que la vérification de chaîne devra relire.
   Une famille creuse sur une fenêtre large passe le premier et échoue au second, avec
   `chain_span` dans les détails. Une chaîne ne se vérifie que sur un intervalle contigu :
   c'est structurel, pas un réglage.
4. **Un refus ne consomme PAS la clé.** Tous les contrôles précèdent la réservation du reçu —
   correctif du Lot 1, où un refus métier brûlait la clé et faisait répondre « déjà fait » à
   un geste jamais produit. Rejouer la même clé après un `too_many` est donc correct.
5. **`rows_checked` ≠ `count` dès qu'on filtre.** Le premier compte l'intervalle contigu
   relu par la chaîne, le second les lignes réellement remises. Le verdict porte
   `extract_rows` précisément pour lever l'ambiguïté — deux nombres voisins qui ne décrivent
   pas la même population sont une classe de défaut qui a déjà coûté deux fois ici.

## 6. Lire la réponse

```
data.count            lignes remises
data.from / to        la fenêtre, telle qu'interprétée par le serveur
data.digest_sha256    empreinte de l'extrait
data.chain.status     « ok » attendu ; « no_rows » sur fenêtre vide
data.chain.break_at   seq de la rupture, null si intacte
data.chain.seq_gaps   0 attendu
data.chain.anchored   la tête de chaîne correspond bien au registre
data.chain.extract_rows  lignes de l'extrait (≠ rows_checked, cf. §5.5)
data.entries[]        seq, ts (UTC, microsecondes), severity, family, action,
                      entity_type, entity_label, actor, prev_hash, hash
```

## 7. Ce que l'artefact prouve — et ce qu'il ne prouve pas

**Il prouve :**
- le **verdict de chaîne sur la fenêtre**, calculé côté serveur au moment de l'extraction ;
- une empreinte **reproductible en rejouant la même extraction** : même fenêtre, même
  famille, mêmes `entries`, même empreinte. Le registre est *append-only* — trois triggers
  refusent `UPDATE`, `DELETE` et `TRUNCATE` — donc une fenêtre passée ne bouge plus ;
- hors ligne, avec le seul extrait : le **chaînage** entre lignes consécutives, soit
  `entries[i].prev_hash === entries[i-1].hash`. ⚠ **Valable uniquement sans filtre de
  famille** : sinon les `seq` sautent et le maillon manque. C'est la raison du
  `p_family: null` au §3.

**⛔ Il ne prouve PAS que chaque ligne est authentique, prise isolément.** Le destinataire ne
peut pas recalculer le hash d'une ligne à partir du seul extrait : la charge hachée
(`admin_log_payload_v1`) compte **19 champs**, l'extrait en porte **10**. Manquent `v`, `id`,
`action_params`, `routine`, `actor_user_id`, `entity_id`, `agency_id`, `ip`, `user_agent`,
`session_id`, `metadata`.

Et c'est une **bonne** raison : cinq de ces champs sont des données personnelles (IP,
user-agent, identifiant de session, identifiant de compte, identifiant d'agence). L'extrait
est volontairement minimisé.

⚠ **Le commentaire de `admin_log_export` en base affirme le contraire** — « le destinataire
peut désormais recalculer le hash de chaque ligne à partir du seul extrait, sans accès à la
base ». C'est **excessif** : ce qui a été aligné au caractère près, c'est le **format de
l'horodatage**, pas le jeu de champs. Corriger un commentaire dans une fonction de production
exige de recréer la fonction par une migration : à faire à la prochaine reprise de
`admin_log_export`, pas pour un commentaire seul.

⚠ L'empreinte elle-même n'est pas recalculable hors PostgreSQL sans effort : elle porte sur
le rendu **texte** du jsonb (ordre canonique des clés, séparateurs). Un autre sérialiseur
JSON donne une autre empreinte. C'est une preuve de **reproductibilité**, pas un condensat
portable.

## 8. Après l'export

- Ranger le JSON hors du projet Supabase (§10.9 demande un export hebdomadaire **chiffré**
  hors projet — non outillé à ce jour).
- Consigner dans le dossier de gate : la fenêtre, `count`, `digest_sha256`,
  `chain.status`, et le compte qui a signé.
- Vérifier que la ligne d'auto-journalisation est bien apparue : `/dashboard/admin/security`,
  famille `export`, action `admin_log_export` — avec période, famille, nombre d'entrées et
  les **16 premiers caractères** de l'empreinte.

## 9. Le geste durable, non décidé

Brancher un bouton d'export sur `/dashboard/admin/security` — même patron que « Relancer »
(#1073), le GRANT `authenticated` est déjà là. Cela remplacerait la voie A par un vrai clic
et l'attribution resterait nominale. C'est une décision d'ordre, pas de faisabilité.
