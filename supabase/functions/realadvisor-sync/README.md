# realadvisor-sync

Ingestion RealAdvisor.ch → `market_listings`, **surface indépendante** (ne touche
ni `flatfox-sync` ni `market-scraper` ; sa propre table `realadvisor_sync_runs`).

## Conformité — à lire avant d'activer un cron

L'endpoint `https://realadvisor.ch/api/listings` est public et anonyme, **mais
le `robots.txt` de RealAdvisor n'autorise pas `/api/`** (deny par défaut, `/api/`
hors allow-list ; `/*?_rsc=` bloqué aussi). Les ToS n'ont pas pu être lus (403).
RealAdvisor est un concurrent.

→ La mise en service repose sur une **décision business explicite de Gregory**
(accès assumé). On reste poli par construction : pacing 1,5 s/page, backoff
exponentiel, **un seul run à la fois** (verrou singleton). **Aucun cron n'est
posé par cette migration** : l'activation récurrente est une décision séparée.

Voie plus propre à terme : demander un accès/flux à RealAdvisor (modèle Flatfox).

## Architecture

Calquée sur `flatfox-sync` : self-invoking chunks, budget de temps (~100 s/
invocation, handoff unique → concurrence 1), verrou singleton, sweep final.
RealAdvisor honore `page` + `sort=created_at_desc`, donc pagination **avant**
(`page=1..N`, 36/page, `total_count` connu dès la page 1).

## Déclenchement

`POST` JSON (service role) :

```jsonc
{ "offer_type": "buy" }                              // catalogue vente complet (~42k)
{ "offer_type": "rent" }                             // catalogue location (~65k)
{ "offer_type": "buy", "place_slugs": ["canton-geneve"] }  // scopé géo (pas de sweep)
{ "offer_type": "buy", "max_pages": 2 }              // run de test borné (pas de sweep)
```

`offer_type` défaut `buy`. Un run **scopé** (`place_slugs`) ou **borné**
(`max_pages`) ne déclenche **pas** le sweep (il n'a pas vu tout le catalogue).

## Totalité de la donnée

Tous les champs utiles sont projetés en colonnes `market_listings`, et le hit
RealAdvisor **brut et complet** est conservé dans `market_listings.source_payload`
(jsonb) — y compris les champs sans colonne typée (sub_locality, agency_rating,
agency_portal_id, clickout_url, blurhash des photos…). Rien n'est perdu.

## Observabilité

Table `realadvisor_sync_runs` (une ligne/run : status, pages, upserted, errors,
removed). Statuts : `running` → `completed` / `safety_skipped` / `failed`.
