# Audit RLS — isolation multi-agences (correction, pas présence)

**Date :** 3 août 2026 · **Périmètre :** schéma `public`, projet `eayczugyrvmtqnnmvjod`
**Nature :** rapport seul — aucune migration écrite, aucune donnée modifiée.

---

## 1. Méthode — et pourquoi « lire `pg_policies` » ne suffit pas

L'audit croise **trois couches**, parce qu'une seule d'entre elles ment dans les deux sens :

| Couche | Source | Ce qu'elle rate si on la lit seule |
|---|---|---|
| Policies RLS | `pg_policy` (base vivante, pas les migrations) | Une policy permissive peut être **morte** faute de `GRANT` |
| Grants de table | `information_schema.role_table_grants` | `TRUNCATE` **ignore la RLS** — aucune policy ne le filtre |
| Comportement réel | impersonation `set local role authenticated` + `request.jwt.claims` | La logique d'une expression ne se déduit pas toujours de sa lecture |

La troisième couche a tranché deux verdicts que les deux premières donnaient faux
(cf. §4 `seller_leads`, §6 `agency_profiles`). **Les policies ont été lues dans la base, pas
dans `supabase/migrations/`** : plusieurs policies vivantes proviennent de
`_archived/`, donc les fichiers de migration ne décrivent plus l'état réel.

### Ce qui a été mesuré, et ce qui ne l'a pas été

- **Mesuré en direct** : toutes les lectures, par impersonation d'un compte réel.
- **Déduit du texte de policy** : les écritures. Aucun `INSERT`/`UPDATE`/`DELETE` n'a été
  exécuté sur la production, même en transaction annulée. Chaque constat d'écriture est
  marqué *(déduit)* ci-dessous.

---

## 2. Verdict d'ensemble

**L'isolation multi-agences tient.** Testée en direct depuis un compte admin de l'agence
`MEGGA Agence` (0 contact, 0 dossier KYC), face à l'agence `Rockwell` (5 contacts,
5 dossiers KYC) :

| Table | Lignes vues par un agent qui n'en possède aucune | Verdict |
|---|---|---|
| `contacts` | 0 | ✅ étanche |
| `kyc_cases` | 0 | ✅ étanche |
| `properties` | 0 | ✅ étanche |
| `transactions` | 0 | ✅ étanche |
| `subscriptions` | 0 | ✅ étanche |
| `documents` | 0 *(table vide — non concluant)* | ⚠ voir §5 |
| **`seller_leads`** | **1** | ❌ **fuite confirmée** |

Le socle est sain : les 9 fonctions d'appui (`get_my_agency_id`, `is_super_admin`,
`is_agency_admin`…) sont toutes `SECURITY DEFINER`, `STABLE`, avec `search_path` épinglé.
Aucune n'est une primitive d'escalade.

**Le schéma ne contient aucune policy `RESTRICTIVE`** (201 policies, 201 permissives). Le
scénario « une permissive l'emporte sur une restrictive » n'existe donc pas ici — il est
retiré du périmètre.

---

## 3. Les 15 tables « RLS activée, zéro policy » — verdict : les 15 sont volontaires

Question posée en amont : oubli ou verrouillage délibéré ?

**Verrouillage délibéré, pour les 15.** RLS activée + zéro policy = **refus total** pour tout
rôle ne contournant pas la RLS. Seul `service_role` (qui porte `BYPASSRLS`) y accède, ce qui
est exactement le régime attendu de tables de travail serveur :

`app_config`, `copilot_pending_actions`, `legal_document_versions`, `rpc_receipts`,
`realadvisor_probe_inflight`, `realadvisor_slice_coverage`, `realadvisor_sync_runs`,
`whatsapp_async_jobs`, `whatsapp_confirmation_log`, `whatsapp_cron_locks`,
`whatsapp_daily_briefs`, `whatsapp_notices`, `whatsapp_pending_actions`,
`whatsapp_recent_auto_actions`, `whatsapp_rejected_drafts`.

⚠ Nuance à ne pas perdre : ces tables sont fermées **par absence de policy**. Ajouter une
seule policy permissive à l'une d'elles ouvre la table — il n'y a pas de garde-fou en
dessous. C'est un état sûr mais fragile.

---

## 4. 🔴 Fuite confirmée — `seller_leads`, pot commun cross-agences

**Seule fuite de lecture mesurée de tout l'audit.**

```sql
seller_leads_agents_all  FOR ALL  TO authenticated
  USING      ((assigned_agency_id = get_my_agency_id()) OR (assigned_agency_id IS NULL))
  WITH CHECK ((assigned_agency_id = get_my_agency_id()) OR (assigned_agency_id IS NULL))
```

La branche `IS NULL` est le trou. Et la policy d'insertion anonyme **force** cette valeur :

```sql
seller_leads_anon_insert  FOR INSERT  TO anon
  WITH CHECK ((assigned_agency_id IS NULL) AND (status = 'new') AND …)
```

Donc **tout lead entrant naît dans le pot commun**, visible par toutes les agences jusqu'à
son attribution. Les colonnes exposées sont nominatives : `contact_name`, `contact_email`,
`contact_phone`, `motivation`, `property_data`.

`FOR ALL` ne s'arrête pas à la lecture *(déduit)* :
- **Vol de lead** — un `UPDATE` posant `assigned_agency_id = <mon agence>` satisfait le
  `USING` (ligne à `NULL`) **et** le `WITH CHECK` (nouvelle valeur = mon agence).
- **Suppression** — `DELETE` sur une ligne à `NULL` passe le `USING`. Aucune trace.

La policy `agents_update_seller_leads` double la première avec un `USING` sans `WITH CHECK`
— en `UPDATE`, PostgreSQL réutilise alors le `USING` comme contrôle de la nouvelle ligne,
ce qui ne referme rien.

**Aujourd'hui :** 1 ligne, non attribuée. **À l'échelle :** chaque agence lit et peut
détourner le flux entrant de toutes les autres.

**Décision à prendre, pas seulement un correctif :** un « pot commun » de leads peut être un
choix produit. Le partage en **lecture** se défend ; le `FOR ALL` qui autorise
`UPDATE`/`DELETE` sur le lead d'autrui, non. Trancher avant d'écrire la migration.

> Déjà relevé en interne : `docs/console-admin/INVENTAIRE_SOCLE.md` §9.2. Cet audit le
> confirme **par la mesure**.

---

## 5. 🟠 `documents` — `EXISTS` non corrélé, lecture totale inter-agences *(latent)*

```sql
"Sellers can read their documents"  FOR SELECT
  USING ((uploaded_by = auth.uid())
         OR (EXISTS (SELECT 1 FROM contacts c
                     WHERE c.user_id = auth.uid() AND c.type = 'seller')))
```

Le `EXISTS` **n'est corrélé à aucune colonne de `documents`**. Il ne demande pas « ce
document appartient-il à ce vendeur ? » mais « cet utilisateur est-il vendeur quelque
part ? ». S'il l'est — dans n'importe quelle agence — l'expression vaut `true` pour
**chaque ligne de la table**, toutes agences confondues. `documents` porte les pièces KYC,
contrats et mandats (`kyc_case_id`, `storage_path`, `sha256_hash`).

Même défaut en écriture *(déduit)* :

```sql
"Sellers can insert documents"  FOR INSERT
  WITH CHECK (uploaded_by = auth.uid())
```

Aucune contrainte sur `agency_id` : tout utilisateur authentifié peut **injecter une ligne
de document dans n'importe quelle agence**, en forgeant `agency_id`. Exploitable aujourd'hui.

**Pourquoi c'est latent en lecture, et pourquoi ça ne rassure qu'à moitié :** la fuite
s'arme dès qu'un `contacts.user_id` est renseigné. Aujourd'hui : **0 contact sur 0** en
possède un, et `documents` est vide. Aucun chemin de code vivant n'écrit `contacts.user_id`.

**Ce sont des vestiges.** Les deux policies viennent de `_archived/005_create_documents.sql`
et survivent par le schéma de base. Le portail vendeur a été **retiré le 26 juillet 2026**
(cf. `CLAUDE.md`) — ces policies auraient dû partir avec lui. Correctif à coût nul :
`DROP POLICY` sur les deux. Aucun code vivant ne s'y appuie.

*Non listé dans `INVENTAIRE_SOCLE.md` §9 — apport propre de cet audit.*

---

## 6. 🟡 `subscriptions` — écriture de sa propre facturation *(latent, déduit)*

```sql
agents_own_agency  FOR ALL  TO public
  USING (agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid()))
  -- pas de WITH CHECK
```

En `FOR ALL` sans `WITH CHECK`, PostgreSQL **réutilise le `USING` comme contrôle
d'insertion et de mise à jour**. Le résultat n'est donc pas « lecture seule » : tout membre
d'une agence peut créer, modifier et supprimer la ligne d'abonnement de son agence —
`plan`, `status`, `mrr_chf`, `stripe_subscription_id`.

Portée : auto-attribution d'un plan supérieur, et pollution de
`compute_platform_mrr_estimate()`, qui alimente le MRR de la console admin.

**Aujourd'hui : 0 ligne.** La table se remplira au premier abonnement Stripe — à corriger
**avant** la mise en service de la facturation, pas après.

> `INVENTAIRE_SOCLE.md` §9.3 le relève également.

---

## 7. 🟡 Grants trop larges — la couche sous la RLS

Constat systémique, invisible pour qui n'audite que les policies : **~70 tables sur 103**
accordent `SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` à **`anon` *et*
`authenticated`**.

`UPDATE` et `DELETE` restent filtrés par la RLS — c'est le régime Supabase normal, et les
policies font leur travail. **`TRUNCATE`, non : il n'est pas une opération ligne-à-ligne et
aucune policy ne s'y applique.** Un rôle qui détient `TRUNCATE` vide la table quelles que
soient les policies, sans déclencher de trigger ligne-à-ligne.

**Portée réelle, sans dramatisation :** PostgREST n'expose pas `TRUNCATE`. Le risque n'est
donc pas directement joignable depuis l'API publique aujourd'hui ; il le devient au premier
RPC `SECURITY INVOKER` faisant du SQL dynamique. C'est une **défaillance de défense en
profondeur**, pas une brèche ouverte.

Une conséquence est en revanche immédiate : l'**immuabilité revendiquée d'`activity_events`
est fausse**. La piste d'audit LAB/KYC est déclarée inaltérable, alors que `anon` et
`authenticated` y détiennent `UPDATE`, `DELETE` et `TRUNCATE`. C'est un écart de conformité
autant que de sécurité.

> `INVENTAIRE_SOCLE.md` §9.1 le signalait **pour `activity_events` seule**. La mesure montre
> que le patron couvre presque tout le schéma.

---

## 8. 🟢 Correction d'un constat interne périmé — `agency_profiles`

`INVENTAIRE_SOCLE.md` §9.4 affirme que `read_agency_profiles` (`SELECT … USING(true)`)
expose 5 992 `claim_token` à tout compte authentifié, et qu'`authenticated` « n'a jamais
été coupé ».

**Ce n'est plus vrai.** Mesuré ce jour :

```
authenticated → DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE   (pas de SELECT)
```

Le `SELECT` a été révoqué au niveau **grant**. Une lecture réelle renvoie
`42501: permission denied for table agency_profiles`. La policy `USING(true)` est **inerte**
— elle survit, trompeuse, au-dessus d'un grant fermé.

Les écritures restent formellement accordées mais échouent en RLS : les 5 992 lignes portent
`agency_id IS NULL`, et `NULL IN (…)` vaut `NULL`, donc faux. Aucune policy `DELETE`
n'existe. **Fermé des deux côtés.**

À faire malgré tout : **supprimer la policy morte**, qui fait croire à une exposition, et
mettre §9.4 à jour. Deux audits successifs perdront le même temps à re-mesurer.

---

## 9. Écarts mineurs

| # | Objet | Constat |
|---|---|---|
| 9.1 | `admin_nps_responses` | `WITH CHECK` ne valide que `user_id` ; `agency_id` est forgeable, et `user_id IS NULL` est accepté. Impact faible (0 ligne). |
| 9.2 | `admin_feature_flags` | `SELECT USING (auth.uid() IS NOT NULL)` — lecture par tout compte, sans portée d'agence. Vraisemblablement voulu (drapeaux globaux, 8 lignes, lus par `useFeatureFlags.ts`) : **à confirmer**, pas à corriger d'office. |
| 9.3 | `agency_profiles` (écriture) | `owner_update_agency_profiles` n'exige pas `is_agency_admin()` — tout agent, pas seulement un admin. |
| 9.4 | Policies `TO public` | ~30 policies ciblent `public` au lieu d'`authenticated`, donc `anon` aussi. Toutes ferment de fait (`auth.uid()` nul ⇒ `get_my_agency_id()` nul ⇒ faux). Sûr **par accident**, pas par intention. |
| 9.5 | `get_my_agency_id` / `get_user_agency_id` | Deux fonctions au corps **identique**. Sans danger, mais deux définitions à maintenir : un correctif appliqué à l'une seule créerait une asymétrie silencieuse. |
| 9.6 | `spatial_ref_sys` | RLS désactivée, table système PostGIS. Non appropriable — à ignorer définitivement. |

---

## 10. Suite recommandée — un correctif, une PR

Ordre d'exécution : effet décroissant, risque croissant.

1. **`documents`** — `DROP POLICY` sur les deux policies vendeur. Code mort, aucun appelant,
   supprime une lecture totale inter-agences. *Risque nul.*
2. **`subscriptions`** — ajouter `WITH CHECK`, ou scinder en `SELECT` agence + écriture
   `service_role`. **Avant** la mise en service de la facturation.
3. **`seller_leads`** — trancher le produit d'abord (§4), puis restreindre le pot commun à
   la lecture.
4. **Grants** — `REVOKE TRUNCATE` (au minimum) sur les tables du schéma ; commencer par
   `activity_events`, dont l'immuabilité est un engagement de conformité.
5. **`agency_profiles`** — supprimer la policy inerte et corriger `INVENTAIRE_SOCLE.md` §9.4.

**Garde-fou à ajouter (le vrai livrable durable) :** un test qui échoue si une nouvelle
policy accorde un accès cross-agence, sur le modèle de `tests/unit/redirects-guard.spec.ts`.
L'impersonation utilisée ici (`set local role authenticated` + `request.jwt.claims`)
s'automatise directement : monter deux agences de test, affirmer que chacune voit 0 ligne de
l'autre sur les tables porteuses d'`agency_id`. C'est ce qui empêche cet audit de se périmer.
