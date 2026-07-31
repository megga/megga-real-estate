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
| **#1046** | **Lot 0 complet + Lot 1 partiel** | **brouillon, CI verte**, 6 migrations en attente |

Les quatre bloquants pré-lancement (dépendance **P6**) sont **fermés et vérifiés en
production** : 0.1 et 0.3 l'étaient déjà, 0.2 et 0.4 par #1044.

## 3. Avancement des étapes

**Lot 0 — complet.** 1 ✅ (mergée) · 2 ✅ `admin_log` · 3 ✅ entrée console + verdict de
session · 4 ✅ focus clavier · plus un **balayage de gardes** couvrant les 32 RPC admin.
Les trois critères de sortie **G0** sont couverts par des tests permanents.

**Lot 1 — 7 étapes sur 11.** 5 ✅ socle §4.2 · 6 ⚠️ partielle · 7 ✅ Stripe · 8 ✅ activation ·
11 ✅ Live · 12 ✅ crons · 13 ✅ tunnel KYC · 14 ✅ Sécurité (migration livrée, **tests non
écrits**). Restent **9** (vues), **10** (`admin_overview`, dépend de 9), **15** (branchement
+ seed).

**Six migrations en attente**, toutes datées `20260731` :
`210000_admin_log` · `220000_admin_console_session` · `230000_admin_console_lot1_socle` ·
`240000_admin_live_and_kyc_funnel` · `250000_activation_and_cron_runs` ·
`260000_admin_security_read`.

**Tests** : 45 specs dédiées à la console, CI complète verte sur `f4cde647`
(130 fichiers, 1 144 tests).

## 4. Décisions PO qui bloquent la suite

| # | Décision | Ce qu'elle bloque | Reco |
|---|---|---|---|
| 1 | **Support de la note d'agence** — `admin_notes` a été supprimée le 28.07, trois jours avant la rédaction de la spec qui l'utilise (§5.3, §4.3) | étape 9 (`v_admin_agency_detail`), donc 10 | colonne `agencies.admin_note`, plus simple qu'une table ressuscitée |
| 2 | **Policy super-admin sur `team_invitations`** — un super-admin a `agency_id` NULL et ne voit AUCUNE invitation | étape 9 (« invité, jamais connecté ») | RPC `SECURITY DEFINER` plutôt qu'une policy, cohérent avec le reste |
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

## 6. Pièges du dépôt, mesurés dans ce chantier

1. **`execSql` tourne en `postgres`.** `set local role` change `current_user`, jamais
   `session_user`. Une RPC gardée ne s'éprouve depuis psql que si sa garde admet `postgres`
   — c'est-à-dire les fonctions de **cron** seulement. Les autres se testent avec un client
   authentifié ou `service_role`.
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

Prochaine action au choix : **tests de l'étape 14** (ne dépendent de rien), ou **étape 9**
une fois les décisions 1 et 2 prises.

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
# Le test d'égalité n'est pas décoratif : lancée le jour même, la boucle produirait un nom
# identique et `git mv` échouerait, ce qui ferait croire à un problème alors qu'il n'y a
# simplement rien à re-dater.
for f in supabase/migrations/20260731{21,22,23,24,25,26}0000_*.sql; do
  [ -e "$f" ] || continue
  dst="supabase/migrations/$(date -u +%Y%m%d)$(basename "$f" | cut -c9-)"
  [ "$f" = "$dst" ] && { echo "déjà à la bonne date : $(basename "$f")"; continue; }
  git mv "$f" "$dst"
done

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
