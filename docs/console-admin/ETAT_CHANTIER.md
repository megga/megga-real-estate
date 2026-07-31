# Console MEGGA · backend — état du chantier et reprise

> **31 juillet 2026, 20h45 UTC.** Document de reprise : tout ce qu'il faut pour continuer
> sans relire la conversation. Branche : `claude/console-admin-admin-log`, PR **#1046**
> (brouillon, base `main`). Spec : `docs/handoff/console-admin/` · Inventaire du socle :
> [INVENTAIRE_SOCLE.md](INVENTAIRE_SOCLE.md).

## 1. Comment on travaille (décidé avec le PO)

Thomas et Antoine travaillent en parallèle sur le même dépôt. Méthode retenue :

- **une branche pour le chantier**, PR ouverte **en brouillon** et poussée à chaque étape ;
- la CI tourne sur `pull_request`, donc **chaque push est validé sans rien merger** ;
- **merge aux gates** du plan (G0, G1, G2), pas à chaque étape ;
- **au merge : re-dater toutes les migrations au jour du merge.**

⚠ Deux mécaniques mesurées, à ne pas redécouvrir :
- **une PR empilée ne reçoit AUCUNE CI** — les workflows sont filtrés sur
  `pull_request: branches: [main]` et aucun ne porte de `workflow_dispatch` ;
- **recibler une PR ne relance rien** — GitHub émet une action `edited`, absente du trio par
  défaut `opened`/`synchronize`/`reopened`. Il faut un commit (un rebase suffit).

## 2. Ce qui est mergé, ce qui attend

| PR | Contenu | État |
|---|---|---|
| #1043 | Inventaire du socle (245 ressources mesurées) | **mergée**, déployée |
| #1044 | Bloquants pré-lancement 0.2 et 0.4 | **mergée**, gardes vérifiées en base ET en comportement |
| **#1046** | **Lot 0 complet + Lot 1 partiel** | **brouillon**, 7 migrations en attente |

Les quatre bloquants pré-lancement (dépendance **P6**) sont **fermés et vérifiés en
production** : 0.1 et 0.3 l'étaient déjà, 0.2 et 0.4 par #1044.

## 3. Avancement des étapes

**Lot 0 — complet.** 1 ✅ (mergée) · 2 ✅ `admin_log` · 3 ✅ entrée console + verdict de
session · 4 ✅ focus clavier · plus un **balayage de gardes** couvrant les 32 RPC admin.
Les trois critères de sortie **G0** sont couverts par des tests permanents.

**Lot 1 — 8 étapes sur 11.** 5 ✅ socle §4.2 · 6 ⚠️ partielle · 7 ✅ Stripe · 8 ✅ activation ·
**9 ✅ vues** · 11 ✅ Live · 12 ✅ crons · 13 ✅ tunnel KYC · 14 ✅ Sécurité (migration livrée,
**tests non écrits**). Restent **10** (`admin_overview`, désormais débloquée), **15**
(branchement + seed).

**L'étape 9 a surtout consisté à NE PAS créer.** §4.3 énumère douze vues ; six seulement
manquaient. `v_admin_kpis` n'a pas été créée — `get_admin_dashboard_stats()` rend déjà, en
production, les sept champs d'`ADMIN_KPIS` et rien d'autre, correspondance 1:1 avec la
maquette. `v_monitoring_board` non plus : `get_admin_monitoring_health()` +
`get_admin_ops_health_rpcs()` + `get_admin_cron_runs()` couvrent tout `ADMIN_HEALTH`.
`v_kyc_funnel_30d` et `v_security_journal` étaient déjà posées en fonctions (240000, 260000) ;
`v_diffusion_board`, `v_ai_month` et `v_changelog` appartiennent aux lots 2 et 3.
Livrées : `agency_mrr` (+ sa règle pure `agency_mrr_rule`), `get_admin_agencies`,
`get_admin_agency_detail`, `get_admin_users`, `get_admin_user_activity`,
`get_admin_plans_board`.

**Huit migrations en attente**, toutes datées `20260731` :
`210500_admin_log` (⚠ **210500**, pas 210000 : main portait déjà ce numéro) ·
`220000_admin_console_session` · `230000_admin_console_lot1_socle` ·
`240000_admin_live_and_kyc_funnel` · `250000_activation_and_cron_runs` ·
`260000_admin_security_read` · `270000_admin_agency_note_and_invitations` ·
`280000_admin_console_read_views`.

**Tests** : 46 specs dédiées à la console. CI complète verte sur `4d8fe0ab` — **132 fichiers,
1 172 tests passés, 1 ignoré** (celui-là est hérité : `whatsapp-comprehension-golden`).
`admin-console-read-views.spec.ts` y a bien exécuté ses **19 tests** : c'est le compte qui le
prouve, pas le statut vert.

## 4. Décisions PO qui bloquent la suite

| # | Décision | Ce qu'elle bloque | Reco |
|---|---|---|---|
| ~~1~~ | ~~Support de la note d'agence~~ — **TRANCHÉE le 31.07** : table `admin_agency_notes` (migration `20260731270000`). ⚠ **Pas** une colonne `agencies.admin_note` comme d'abord recommandé : `agencies_members_select` donne à chaque membre la lecture de toute sa ligne, avec un GRANT de table, et un REVOKE de colonne ne protégerait rien (défaut mesuré sur `verification_*`). La note aurait été lue par l'agence. | ✅ débloquée | — |
| ~~2~~ | ~~Accès du super-admin aux invitations~~ — **TRANCHÉE le 31.07** : RPC `get_admin_agency_invitations(agency_id, limit)`, gardée, qui sert la fiche agence (argument fourni) ET le registre Utilisateurs (argument NULL). Ne rend jamais le `token`. | ✅ débloquée | — |
| 3 | **Enum `agency_plan`** = `starter\|pro\|agency\|enterprise` quand le catalogue dit `entreprise` → **`22P02` en production** sur toute création d'agence Entreprise | Lot 2 (étape 17) | convertir `agencies.plan` en `text` + CHECK, comme `subscriptions.plan` l'est déjà : supprime le 3ᵉ vocabulaire au lieu d'en ajouter un 4ᵉ. Colonne partagée avec le CRM. |
| 4 | **Q5 sièges** — divergence **TRIPLE** : `PLANS.team_members` 1/5/∞ · `PLAN_LIMITS.maxAgents` 1/1/10 · `send-team-invite` en dur 1/3/10/50 (**la seule qui s'applique**) | étape 17 | — |
| 5 | **Périmètre à démonter** — changement de plan et impersonation sont **livrés et branchés** alors que la spec les exclut ; 4 pages (Feature flags, Autonomie, Outils, Styles appris) sont hors carte sans décision écrite | Lot 2 et plan de nettoyage | — |
| 6 | **`category` NULL sur 95 % d'`activity_events`** — non rattrapable, la table refuse l'UPDATE | étape 6, filtres du Live | chip « non catégorisé », ou filtre limité aux événements postérieurs |
| 7 | **Q3 rétention Live 30 j** — un trigger interdit toute suppression < 10 ans (LBA art. 7 al. 3) | — | ce n'est pas un réglage mais un arbitrage de conformité ; le levier réel est la fenêtre d'AFFICHAGE |

## 5. Amendements de spec à porter

- **§10.2 « journal d'abord » → « journal dans la même transaction »**. Le verrou de chaîne
  est tenu jusqu'au COMMIT ; journaliser en premier ne garantit rien de plus et croise
  l'ordre de verrouillage des RPC KYB : interblocage `40P01` au rétro-branchement. Règle
  d'ordre : **verrou d'entité PUIS verrou de chaîne**.
- **`admin_console_entry_audit` n'est pas une table** (6 mentions) — nom de fichier.
- **`agency_activity_summary_rpc`** → la fonction s'appelle `get_agency_activity_summary`.
- **`admin_integrations_health`** est une fonction, pas une table historisée : la bande 24 h
  par service de la maquette Monitoring **n'a aucune source**.
- **`admin_request_agency_correction`** prend un motif obligatoire (2 arguments).
- **La surface de revue KYB existe déjà** — P5/Q9 n'est pas une dépendance bloquante.
- **§4.3 « vues »** : `v_kyc_funnel_30d` et `v_security_journal` sont des FONCTIONS.
  PostgreSQL n'applique pas de RLS aux vues ; `security_invoker` rendrait à chaque agent les
  agrégats de son agence, et sans, tout `authenticated` lirait la plateforme entière.
  **Étendu à toutes les vues de l'étape 9** : le nom `v_*` de la spec désigne un contrat de
  lecture, jamais un `CREATE VIEW`.
- **§4.3 : deux des douze vues n'étaient pas à créer.** `v_admin_kpis` =
  `get_admin_dashboard_stats()`, déjà en production, dont les sept colonnes correspondent
  1:1 aux sept champs d'`ADMIN_KPIS`. `v_monitoring_board` = `get_admin_monitoring_health()`
  + `get_admin_ops_health_rpcs()` + `get_admin_cron_runs()`. Les chercher avant d'écrire a
  retiré deux objets du périmètre.
- **§5.7 : trois chiffres de la maquette n'ont AUCUNE source.** `ADMIN_BILLING.mrrTrend`
  (14 points d'historique), `revenue30d` et `churn` ne sont pas dérivables : le dépôt ne
  garde aucun historique de MRR — `subscriptions` ne conserve que l'état courant, sans
  versions, et aucune table de revenu n'existe. Les fabriquer aurait produit une courbe
  crédible et fausse. `get_admin_plans_board()` les NOMME dans son champ `unavailable`
  plutôt que de les taire (un champ absent se lit « bug », un champ qui se nomme se lit
  « pas encore »). Même geste que la bande 24 h de Monitoring, déjà amendée faute de source.
- **§5.7 : la file « sièges saturés » n'est pas calculée**, et c'est délibéré — elle exige un
  plafond de sièges, objet de la décision PO n° 4 (encore ouverte), et §5.7 dit lui-même
  « plafond de sièges APRÈS arbitrage ». En choisir un aurait tranché en silence une
  question posée au PO. `seats_used` est rendu par agence : le jour de l'arbitrage, la file
  se calcule sans nouvelle mesure.
- **§4.3 « MRR » : deux objets et non un.** `agency_mrr_rule(...)` porte la règle, pure et
  IMMUTABLE ; `agency_mrr(uuid)` est l'entrée nommée par la spec, qui garde puis délègue.
  Motif : la garde appelle `is_super_admin()`, qui joint `profiles` à `auth.users` — une
  jointure d'authentification par agence affichée, pour un verdict déjà rendu à l'entrée de
  la fonction appelante. La règle reste écrite une seule fois, ce qu'exige §4.3.

## 6. Pièges du dépôt, mesurés dans ce chantier

1. **`execSql` tourne en `postgres`.** `set local role` change `current_user`, jamais
   `session_user`. Une RPC gardée ne s'éprouve depuis psql que si sa garde admet `postgres`
   — c'est-à-dire les fonctions de **cron** seulement. Les autres se testent avec un client
   authentifié ou `service_role`.
   **Piège le plus récurrent du chantier : quatre passes de CI perdues dessus**, dont une
   APRÈS l'avoir écrit dans ce document. Réflexe à prendre : avant d'appeler une RPC dans un
   bloc `assertSql`, vérifier que sa garde contient `session_user`. Sinon, `serviceRoleClient()`.
   Contrôle rapide sur un fichier de spec :
   `grep -n "public\.\(get_\|admin_\)" tests/backend/<fichier>.spec.ts` — chaque appel
   dans un gabarit SQL est suspect.
2. **`service_role` n'échappe pas aux GRANT.** `rolbypassrls` ne contourne que la RLS : un
   `revoke` retire réellement le SELECT, et la lecture rend `null` **sans erreur**.
3. **Créer une agence émet un `activity_events`** (`trg_agency_created`), et la table refuse
   l'UPDATE comme le DELETE. Corollaire produit : **aucune agence de moins de 30 jours ne
   peut être `dormant`**.
4. **`deno check` est le seul filet des edge functions** — hors `tsc`, hors vitest.
5. **`pg_trgm` vit dans `extensions`**, invisible sous `search_path = public, pg_temp` :
   `42883` à l'exécution, pas à la création. `unaccent` est dans `public` mais **absente
   d'une base fraîche** → `create extension if not exists`.
6. **`count(*) over ()` est interdit** (`20260729160000`, mesures à l'appui) : il rend
   l'index de tri inutilisable. Sous-requête scalaire.
7. **Un prédicat d'index partiel doit être un LITTÉRAL** — d'où deux fonctions (journal /
   routine) plutôt qu'une paramétrée.
8. **`greatest()` seul est un plancher**, jamais un plafond.
9. **Muter un test de garde avant de le livrer.** Un test de ce chantier était creux : son
   motif matchait dans un **commentaire CSS**. Retirer la vraie protection le laissait vert.

## 7. Reprendre

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/audit-backend-admin-a43be4
git fetch origin && git rebase origin/main   # main a bougé (PR vitrine de Thomas/Antoine)
```

Prochaine action : **étape 10** (`admin_overview()`, un objet un fetch), débloquée par
l'étape 9. Ses sept blocs ont tous leur source, aucune n'est à créer : `kpis` →
`get_admin_dashboard_stats()` · `activation` → `agency_activation` · `kyc_funnel` →
`get_admin_kyc_funnel_30d()` · `revenue` → `get_admin_plans_board()` · `journal` →
`get_admin_live_feed()` (filtré `category <> 'kyc'`, §5.1) · `signals` → dossiers KYB en
revue (`get_admin_agency_review_queue`), impayés (plans board), fonctions en erreur
(`get_admin_ops_health_rpcs`). Puis **15** (branchement + seed).

Les **tests de l'étape 14** (écran Sécurité) restent à écrire et ne dépendent de rien.

⚠ **Neuvième piège, mesuré à l'étape 9** : une RPC dont le nom ne commence ni par `admin_`
ni par `get_admin` sort du balayage de gardes par son seul nom. `agency_mrr` — nommée ainsi
par la spec — a dû être ajoutée à la main au `SCOPE` de
[admin-rpc-guard-sweep.spec.ts](../../tests/backend/admin-rpc-guard-sweep.spec.ts). Toute
future RPC de console au nom non préfixé doit y entrer explicitement, sinon elle est
protégée sans que rien ne le vérifie.

## 8. Re-dater les migrations le jour du merge — procédure

**Pourquoi.** `deploy.yml` (lignes 108-160) n'applique que les migrations dont l'horodatage
est `>= TODAY` en **UTC**, et ne signale un saut que par un `::warning::`, jamais par un
échec. Une migration datée du 31.07 mergée le 01.08 est donc **sautée définitivement** :
aucun déploiement ultérieur ne la rattrape, le dépôt et la CI restent verts, et le schéma
n'existe pas en production. C'est l'invariant 16 du relais KYB, et le dépôt s'est déjà fait
avoir sur 19 migrations en juillet.

Ce n'est **pas une échéance sur le travail** : la CI valide chaque push indépendamment de
la date. C'est une corvée au moment du merge.

**Quand.** Dès que le jour UTC du merge diffère du jour d'écriture. Vérifier :
`date -u +%Y-%m-%d`.

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/audit-backend-admin-a43be4
git fetch origin && git rebase origin/main

# Re-date au jour courant en conservant l'ORDRE relatif (les 6 chiffres d'heure ne bougent pas).
# Liste EXPLICITE, jamais un glob sur la date : d'autres personnes déposent des migrations le
# même jour — main en portait déjà une à 20260731210000, ce qui a forcé le décalage d'admin_log
# à 210500. Un glob emporterait leurs fichiers.
NOTRES="
  20260731210500_admin_log.sql
  20260731220000_admin_console_session.sql
  20260731230000_admin_console_lot1_socle.sql
  20260731240000_admin_live_and_kyc_funnel.sql
  20260731250000_activation_and_cron_runs.sql
  20260731260000_admin_security_read.sql
  20260731270000_admin_agency_note_and_invitations.sql
  20260731280000_admin_console_read_views.sql
"
for n in $NOTRES; do
  f="supabase/migrations/$n"
  [ -e "$f" ] || { echo "absent (déjà re-daté ?) : $n"; continue; }
  dst="supabase/migrations/$(date -u +%Y%m%d)${n:8}"
  [ "$f" = "$dst" ] && { echo "déjà à la bonne date : $n"; continue; }
  # Refuser d'écraser un fichier existant : un stamp peut être pris par quelqu'un d'autre.
  [ -e "$dst" ] && { echo "STAMP DÉJÀ PRIS, décaler d'une minute : $dst"; continue; }
  git mv "$f" "$dst"
done

# Contrôle : aucun stamp en double dans l'index.
git ls-files supabase/migrations | xargs -n1 basename | cut -c1-14 | sort | uniq -d

node scripts/check-migration-idempotence.mjs   # doit rester vert
git commit -m "chore(admin): re-date les migrations du Lot 0/1 au jour du merge"
git push
```

**Trois précautions, par ordre d'importance :**

1. **Jamais de date future.** On date au jour du merge, pas en anticipation : une migration
   datée de demain serait sautée aujourd'hui, et personne ne la rattraperait.
2. **Le renommage n'est permis que parce qu'aucune de ces six migrations n'est mergée.** La
   règle du dépôt interdit la reprise sur place d'une migration **déjà en production** — une
   correction se fait alors par un NOUVEAU fichier.
3. **Laisser la CI rejouer avant de merger.** Elle applique toutes les migrations sur une
   base fraîche à chaque push : c'est elle qui prouve que le rejeu tient contre l'état
   **final** de la journée, y compris si Thomas ou Antoine ont mergé des migrations entre-temps.

**Après le merge**, vérifier les OBJETS en base, pas le statut du workflow — c'est la
discipline du dépôt, et c'est ainsi que #1044 a été confirmée :

```sql
select to_regclass('public.admin_log') is not null                  as admin_log,
       to_regclass('public.agency_activation') is not null          as activation,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('admin_log_write','admin_log_verify_chain',
                             'get_admin_live_feed','get_admin_security_journal',
                             'get_admin_cron_runs','recompute_agency_activation')) as fonctions;
```
