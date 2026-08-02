# Runbook incident — console MEGGA

> Étape 31 / gate G4. **Une page, que des gestes qui existent.** Tout ce qui est écrit ici a
> été relevé en base ou au dépôt le 02.08.2026 ; ce qui n'est pas décidé est nommé au §6
> plutôt que deviné. Périmètre : la console super-admin et le socle qui la sert — pas les
> incidents produit côté agent.

## 1. Comment un incident arrive jusqu'à vous

| Canal | Ce qu'il voit | Latence RÉELLE | Survit à une panne Supabase ? |
|---|---|---|---|
| **Alerting interne** — `_shared/admin-alerts.ts`, appelé par `platform-metrics-hourly` (`15 * * * *`) | cron en retard · Flatfox figé · solde DeepSeek · jeton WhatsApp · erreurs edge 24 h · dead-letters WhatsApp · quotas d'agence · calendriers désynchronisés · webhook Stripe · **chaîne du registre** · outbox bloquée · outbox morte | ≤ 1 h, **dédup 24 h par clé** | ❌ **non** — il est déclenché par pg_cron et envoyé par une Edge Function : si Supabase tombe, l'alerte tombe avec |
| **Veilleur hors Supabase** — `.github/workflows/scheduler-heartbeat.yml` | un seul signal : `cron.job_run_details` s'est-il tu plus de 10 min | demandée `*/30`, **mesurée ≈ 2 h 45** | ✅ **oui**, c'est sa raison d'être |
| **Sentry** — filtre `surface:console` | erreurs et transactions de la console seule | temps réel | ✅ oui (tiers) |

**⚠ Deux pièges de lecture.**
- La cadence du veilleur n'est pas celle qui est écrite : GitHub Actions traite `schedule` en
  best-effort et la cadence observée est de **~2 h 45**. La détection d'une panne Supabase se
  compte donc en **heures**, pas en minutes. L'améliorer demande un ordonnanceur externe,
  c'est une décision (§6).
- Le veilleur écrit à **`noreply@megga.ch`**, en dur et **à dessein** : lire
  `super_admin_allowlist()` exigerait la base, c'est-à-dire exactement ce qui peut être
  tombé. Son **second canal est le workflow rouge**, visible sans e-mail — et il reste
  visible si Resend est lui aussi en panne. C'est ce canal-là qu'il faut regarder.
- Sentry **n'est pas rétroactif** : les événements d'avant le déploiement du tag ne portent
  pas `surface`.

## 2. Premiers regards, dans cet ordre

1. `/dashboard/admin/monitoring` — santé DB/stockage/edge, **Santé des crons** (avec l'action
   « Relancer »), Flatfox, intégrations, consommation IA, table des fonctions, journal
   d'erreurs dépliable.
2. `/dashboard/admin/security` — le **registre MEGGA** (`admin_log`) : qui a fait quoi, avec
   les paramètres du geste. C'est le journal qui fait foi, distinct d'`activity_events` qui
   raconte ce que font les **agences**.
3. `/dashboard/admin/live` — le flux temps réel, pour voir si la plateforme respire encore.
4. Sentry, filtré `surface:console`.
5. Le workflow **💓 Battement de l'ordonnanceur** dans l'onglet Actions — vert/rouge, sans
   dépendre du courrier.

## 3. Les cinq pannes déjà vues, et le geste qui va avec

**a. Un cron est en retard ou en échec.** Monitoring → Santé des crons → **Relancer** sur la
ligne. Un cron qui peut écrire à des clients ou à des agents demande une confirmation ; c'est
la base qui la réclame, pas l'écran.
⚠ Le libellé dit « Relance **demandée** », jamais « relancé » : à cette seconde le job n'a
pas tourné. Pour les crons qui délèguent à `net.http_post`, même un statut `succeeded` ne
prouverait que **l'enfilage de la requête** — la preuve d'un vrai passage est l'histogramme
des `updated_at` sur les données touchées.
⚠ Un cron **désactivé** ne se relance pas : le réactiver est un geste distinct, non outillé.

**b. Supabase est muet.** Rien à faire depuis la console — elle est en aval. Vérifier le
statut Supabase, puis PITR (§6). Le veilleur est le seul témoin ; s'il est rouge et que
l'alerting interne est silencieux, c'est cohérent, pas contradictoire.

**c. Un déploiement a raté ou s'est fait doubler.** `deploy.yml` accepte un
**`workflow_dispatch` sur `main`** — il existe précisément pour rejouer un déploiement coincé
sans avoir à pousser un commit vide.

**d. Une migration a été sautée.** Le date-guard de `deploy.yml` n'applique que les fichiers
dont l'horodatage est `>= aujourd'hui` **en UTC**, et une migration mergée après sa propre
date n'est **jamais** rattrapée. ⚠ Le vrai danger n'est pas la migration manquante : c'est
que **les Edge Functions se déploient quand même**, d'où une désynchronisation silencieuse
code/schéma. Contrôle : `migration-drift.yml` en `workflow_dispatch` (il ne tourne autrement
que le lundi 07:13 UTC et sur les push `main` touchant `supabase/migrations/**`).

**e. La chaîne du registre est rompue.** `admin-log-chain-verify-hourly` (`40 * * * *`) la
vérifie et l'alerting remonte la clé `admin_log:chain`. Voir §4.

## 4. Vérifier l'intégrité du registre

```sql
select public.admin_log_verify_chain();          -- fenêtre entière
select public.admin_log_verify_chain(1, 500);    -- bornée par `seq`
```

**⚠ Le verdict est dans `status`, PAS dans `ok`.** Cette fonction est l'exception connue à
l'enveloppe §10.1 : elle rend un objet nu. Chercher `->> 'ok'` renvoie `null` et se lit comme
un échec alors que tout va bien.

Ce que les champs disent : `status` (`ok` attendu) · `break_at` (le `seq` de la rupture, `null`
si intacte) · `seq_gaps` (0 attendu) · `anchored` · `rows_checked` / `last_seq` · `head` (le
haché de tête, à recopier dans le rapport d'incident).

## 5. Produire une preuve

```sql
select public.admin_log_export(
  p_from => now() - interval '48 hours',
  p_to   => now(),
  p_family => null,                       -- ou 'ops', 'kyb', 'export'…
  p_idempotency_key => gen_random_uuid()::text);
```

L'extraction est **elle-même journalisée** (famille `export`) et porte une empreinte SHA-256
ainsi que le verdict de chaîne sur la fenêtre. L'extraction précède la journalisation — sinon
l'empreinte ne serait pas reproductible.

⚠ Ces deux appels sont gardés par `is_super_admin() OR is_service_role()`. Une console SQL
ouverte en `postgres` **n'est ni l'un ni l'autre** (mesuré) et se fait refuser par un 42501 :
passer par un compte super-admin, ou par la clé de service.

## 6. Ce que ce runbook ne peut pas décider

Ces points sont ouverts et relèvent du PO ; ils sont listés ici pour qu'aucune astreinte ne
croie les trouver plus bas.

- **Qui est d'astreinte, et sous quel délai.** Aucun tour d'astreinte n'existe.
- **`noreply@megga.ch` est-il relevé par quelqu'un ?** C'est l'adresse du veilleur. Si
  personne ne l'ouvre, le canal qui survit à une panne Supabase se réduit au workflow rouge.
- **L'allowlist nominale de production.** `super_admin_allowlist()` porte **2 comptes**
  aujourd'hui ; la liste visée est une décision, l'appliquer ensuite est une ligne.
- **PITR.** Se vérifie à la main au dashboard Supabase (Database → PITR), ~1 min. Aucune API
  ne l'expose, donc aucun contrôle automatique ne peut l'affirmer.
- **Un ordonnanceur externe** pour ramener la détection sous l'heure (voir §1).

---

*Chiffres du 02.08.2026 : 47 crons actifs · 28 lignes au registre, chaîne `ok`, 0 trou de
séquence · outbox vide. À relire quand l'un d'eux surprend.*
