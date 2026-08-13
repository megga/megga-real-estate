# Annuaire des agences RealAdvisor

Collecte les ~1 240 fiches agence de `realadvisor.ch/fr/trouver-une-agence`
(nom, adresse, canton, site, note, avis, agents, statistiques de vente) et
télécharge les logos.

Complète [`realadvisor-sync`](../../supabase/functions/realadvisor-sync), qui
ingère les **annonces** : cette source-ci porte les **agences elles-mêmes**,
y compris celles qui n'ont aucune annonce en ligne.

## ⚠ Runtime Python — exception assumée

`scripts/` est du Node (cf. CLAUDE.md §4). Ce dossier est la seule exception :
franchir le challenge Cloudflare de RealAdvisor demande un navigateur furtif, et
l'outil qui y arrive (Scrapling / Camoufox) est Python. Ne pas le porter en Node
sans avoir vérifié qu'un équivalent passe réellement le challenge — voir plus bas.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python "scrapling[fetchers]"
.venv/bin/scrapling install          # télécharge Camoufox (~150 Mo)
```

## Usage

```bash
.venv/bin/python scrape_ra_agencies.py --limit 20    # essai
```

```bash
.venv/bin/python scrape_ra_agencies.py --out out --delay 1.0
```

Reprise automatique : `agencies.jsonl` est relu au démarrage, les fiches déjà
collectées sont sautées. `--logos-only` rejoue les téléchargements et les CSV
sans recrawler.

## Sorties (`--out`, par défaut `out/`)

| Fichier | Contenu |
|---|---|
| `agencies.jsonl` | une fiche complète par ligne (agents et avis imbriqués) |
| `agencies.csv` | champs scalaires, un plat par agence |
| `agents.csv` | une ligne par agent (titre, note, services) |
| `reviews.csv` | une ligne par avis |
| `logos/` | logos nommés `<slug>.<ext>` |

## Ce que le site impose (et pourquoi le code a cette forme)

1. **Le HTML est derrière un challenge Cloudflare « managed ».** Mesuré le
   13.08.2026 : `curl`, l'en-tête `RSC: 1`, `?_rsc=`, `Accept: application/json`,
   un UA Googlebot, Playwright sur Chrome réel (headless ET headful) et Camoufox
   **headless** rendent tous 403. Seul **Camoufox headful** passe — d'où
   `headless=False`, qui est une condition de fonctionnement, pas un confort.
2. **Le challenge n'est payé qu'une fois.** La session garde son cookie : les
   fiches suivantes coûtent ~4,4 s, sans nouvelle épreuve.
3. **Le sous-sitemap est un cas à part.** `/{lang}/sitemaps/agency.xml` est
   challengé (`/sitemap.xml`, lui, ne l'est pas), et un XHR ne peut pas le
   résoudre : la page d'épreuve est du HTML et doit exécuter son JS. Il faut donc
   une **vraie navigation**, et **après** une page HTML qui a posé le cookie.
   C'est ce que fait `sitemap_urls()` ; l'ordre inverse échoue.
4. **Les logos échappent au challenge** — ils sont sur `storage.googleapis.com`,
   donc téléchargés en HTTP nu, sans navigateur.

## Ce qui n'a pas marché (pour ne pas le refaire)

- **API JSON** : `/api/listings` est ouverte (c'est la source de
  `realadvisor-sync`) mais ne porte que les agences **ayant des annonces**, via
  des champs plats (`agency_name`, `agency_logo_url`…). Aucune route
  `/api/agencies*` n'existe (404).
- **GraphQL** : `/graphql` est ouvert et anonyme, mais l'introspection est
  désactivée et `Query.agencies` n'accepte que `first`/`after` — aucun filtre. Le
  résolveur calcule un `count(*) OVER()` sur `merged_agencies` joint à
  `portal_agencies` et **expire en statement timeout** même avec `first: 1`. Le
  champ est donc inexploitable.

## Limites connues

- **Avis** : `reviews_count` est le total réel, mais `reviews[]` ne contient que
  ceux rendus en page 1 (~5). Le reste demande de paginer la section Avis.
- **Téléphone** : jamais rendu (le site le masque derrière un clic). Les numéros
  RA vivent déjà dans `market_listings.agency_phone` — cf. la fiche cerveau
  `project_zefix_agency_che_enrichment`.
- **Langue** : le crawl est fait en `--lang fr` ; `canton` est donc le libellé
  français. `canton_code` (GE, VD…) est, lui, indépendant de la langue.

## Conformité

`robots.txt` de RealAdvisor porte `Disallow: /` sous `User-agent: *`, et le
challenge Cloudflare est une seconde barrière explicite. Même cadre de décision
que `realadvisor-sync` (go de Gregory, accès assumé) : on reste poli — une seule
session, ~5 s entre fiches, aucun parallélisme — mais c'est une **décision
métier**, pas une autorisation technique. Les avis clients sont des données
personnelles publiées : usage interne, pas de rediffusion.
