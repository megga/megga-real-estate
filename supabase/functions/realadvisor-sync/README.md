# realadvisor-sync

Ingestion RealAdvisor.ch → `market_listings`, **surface indépendante** (ne touche
ni `flatfox-sync` ni `market-scraper` ; sa propre table `realadvisor_sync_runs`).
Périmètre : **VENTE (`buy`) uniquement** — Flatfox couvre la location, RealAdvisor
est un agrégateur qui la dupliquerait. La vente est un gain propre (zéro dédup).

## Conformité

L'endpoint `https://realadvisor.ch/api/listings` est public et anonyme. Le
`robots.txt` de RealAdvisor n'autorise pas `/api/`. **L'accès est désormais
couvert par un accord obtenu par Gregory** (n'est plus « assumé »). On reste poli
par construction : pacing 2,5 s/page, backoff exponentiel, un seul crawl à la fois
(verrou singleton). `market_listings` sert **exclusivement** au matching CRM interne —
aucune republication publique.

**UA dédié (whitelist RA).** Le User-Agent est configurable sans redeploy via
`app_config.realadvisor_user_agent` (vide ⇒ fallback Chrome qui passe le WAF
aujourd'hui). Un `From:` est envoyé si `realadvisor_contact_email` est renseigné.
Séquence de bascule vers un UA identifiable : (1) RA whitelist la sous-chaîne UA
dans son WAF + waiver robots — **par écrit** ; (2) canari scopé (`canton-uri`) ;
(3) si le canari passe, on laisse l'UA en place. Rollback = 1 `UPDATE` (valeur vide).

## Architecture

Calquée sur `flatfox-sync` : self-invoking chunks, budget ~100 s/invocation,
verrou singleton. **Cap d'API ~750-900/requête** → on partitionne en slices
`canton × bande de prix` (géométriques) ; chaque slice est paginé en entier.

## Cycle quotidien (3 crons)

| Cron | Heure UTC | Mode | Rôle |
|---|---|---|---|
| `realadvisor-fresh-daily` | 03:30 | `fresh` | delta national `created_at_desc`, rattrape les nouvelles annonces (s'arrête sur page connue) |
| `realadvisor-rolling-daily` | 22:00 | `chunk` scopé | re-crawle 1 bucket de cantons/nuit (rotation **3 j** via `realadvisor_shard_map`) → rafraîchit `last_seen` + écrit les **reçus d'énumération** |
| `realadvisor-sweep-enum-daily` | 01:30 | `sweep_enum` | suppression destructive **sûre** (cf ci-dessous) |

`fresh` ne rafraîchit que le haut du catalogue ; le **rolling** est ce qui re-touche
toute la longue traîne, sur une fenêtre glissante de 3 jours alignée sur la latence
de retrait (3 absences espacées >= 20 h + gate 48 h). Sans cet alignement le vivier
se stabilise structurellement sous le catalogue réel : un bien qui part sort en ~3 j,
un bien qui arrive n'entre qu'au prochain passage de son bucket.

Le bucket de la nuit est `shard_map[jours_depuis_2026-01-01 % 3]` — un compteur
ABSOLU, pas `dow`. ⚠ La map et l'index sont couplés : 3 entrées indexées par `dow`
(période 7) renvoient NULL du mercredi au samedi, et `cantons` vide fait abandonner
la fonction sur son garde-fou anti-full-crawl **sans écrire de ligne de run** —
panne totalement silencieuse. Les changer ensemble, dans la même migration.

## Sweep destructif sûr (`sweep_enum`)

Le piège : aucun run quotidien ne re-touche tout le catalogue, donc un sweep « par
ancienneté de `last_seen` » effacerait ~35 k biens vivants (dont les ~1 200 « prix
sur demande » que le crawl ne peut structurellement pas atteindre).

Solution (**reçus d'énumération**, table `realadvisor_slice_coverage`) : on ne
supprime un bien QUE s'il tombe dans un slice `(canton × bande)` **réellement
énuméré en entier** ce cycle (`fully_enumerated` = `total>0 ∧ total≤700 ∧ seen≥total`)
et qu'il n'a **pas été revu** (`last_seen_at < cycle_id` du reçu). Conséquence :

- résidus inatteignables (price=0 hors bandes, bandes plafonnées, cantons throttlés)
  ⇒ jamais `fully_enumerated` ⇒ **jamais supprimés** ;
- cycle absent/incomplet ⇒ pas de reçu récent (fenêtre 8 j) ⇒ **0 candidat** ;
- double plafond : `> 1200` retraits **ou** `> 3 %` du vivant ⇒ `safety_skipped`,
  on ne supprime rien (signal d'anomalie).

Logique atomique dans la RPC `realadvisor_sweep_enum(offer, window_days, cap_abs,
cap_pct, apply)`. Le mode `sweep_enum` ne prend **pas** le verrou singleton (ligne
de run à statut terminal), donc un crawl long ne le bloque pas.

## Kill-switches (`app_config`, 1 `UPDATE`, sans redeploy)

| Clé | Défaut | Effet |
|---|---|---|
| `realadvisor_fresh_enabled` | `true` | coupe le delta quotidien |
| `realadvisor_rolling_enabled` | `true` | coupe le re-crawl rolling |
| `realadvisor_sweep_enabled` | **`false`** | `false` ⇒ sweep en **DRY-RUN** (compte, ne supprime rien). Passer à `true` pour ARMER, après ~2 cycles de calibrage |
| `realadvisor_user_agent` | `''` | UA dédié (vide ⇒ fallback Chrome) |
| `realadvisor_contact_email` | `''` | `From:` envoyé si renseigné |
| `realadvisor_shard_map` | 3 buckets | rotation cantons du rolling (éditable pour rééquilibrer, mais garder **exactement 3** entrées — l'index est `% 3`) |

## Déclenchement manuel

`POST` JSON (service role), ex. via `net.http_post` :

```jsonc
{ "mode": "chunk", "offer_type": "buy", "cantons": ["canton-zoug"], "trigger_source": "verify" } // crawl scopé
{ "mode": "fresh", "offer_type": "buy" }       // delta national
{ "mode": "sweep_enum", "offer_type": "buy" }  // sweep (dry-run tant que sweep_enabled=false)
```

Un run **scopé** (`cantons`) finalise `completed` sans déclencher de sweep legacy.

## Totalité de la donnée

Tous les champs utiles sont projetés en colonnes `market_listings` ; le hit RA
**brut et complet** est conservé dans `market_listings.source_payload` (jsonb).
Photos cap 60.

## Observabilité

Table `realadvisor_sync_runs` (une ligne/run : status, pages, seen, inserted,
updated, removed, errors). Statuts : `running` → `completed` / `safety_skipped` /
`dry_run` / `throttled` / `circuit_open` / `failed`. La RPC sweep renvoie
`{status, candidates, live, removed}` — surveiller `candidates` (churn réel) avant
d'armer, puis `safety_skipped` répété (= rolling en retard / throttle).
