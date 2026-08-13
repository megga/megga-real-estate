# Annuaire des agences RealAdvisor

Collecte l'**identité** des ~1 240 agences de `realadvisor.ch/fr/trouver-une-agence`
— nom, adresse, canton, site web, ancienneté — et télécharge leurs **logos**.

⚠ **Hors périmètre, par décision produit (13.08.2026, Julien) : les indicateurs
de performance.** Transactions, ventes sur 24 mois, notes, avis et fiches
d'agents ne sont PAS livrés. La page les rend quand même — les écarter ne fait
rien gagner au crawl — et `agencies.jsonl` en garde la capture brute : si le
besoin change, il suffit de rejouer `--logos-only` avec des colonnes en plus,
sans recollecter.

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
collectées sont sautées. `--logos-only` rejoue les téléchargements et le CSV
sans recrawler.

`--purge-raw` efface `agencies.jsonl` une fois le livrable écrit. ⚠ C'est aussi
le fichier de reprise : après purge, un run suivant repart de zéro, et tout champ
absent du CSV demande un recrawl complet (~1 h 20). La purge est refusée si
`agencies.csv` manque ou est vide, pour qu'un run interrompu ne détruise rien.

Contrôle du jeu de données : `python qa_check.py out`. Il cherche ce qui est
FAUX, pas ce qui est présent — NPA glissé d'un champ, code canton hors des 26,
logo qui est en fait une page d'erreur, logos partagés entre agences. Il sait
tourner sur le seul CSV quand la capture brute a été purgée.

## Sorties (`--out`, par défaut `out/`)

| Fichier | Contenu |
|---|---|
| `agencies.csv` | **le livrable** : identité, adresse, canton, site, logo |
| `logos/` | logos nommés `<slug>.<ext>` |
| `agencies.jsonl` | capture brute + fichier de reprise (contient aussi ce qui n'est pas livré) |

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

- **Téléphone** : jamais rendu — le site le masque derrière un clic. On ne livre
  donc que `has_phone` (un numéro existe ou non), ce qui suffit à qualifier un
  lead. Les numéros RA eux-mêmes vivent déjà dans `market_listings.agency_phone`,
  cf. la fiche cerveau `project_zefix_agency_che_enrichment`.
- **`agency_id`** : l'objet « équipe » du flux RSC n'existe que pour les agences
  revendiquées (~69 %). Pour les autres, l'uuid est repêché dans les paramètres
  d'événement du lien « site web ». Sans ce repli, un tiers du vivier — celui des
  agences à démarcher — sortait sans clé de jointure vers `market_listings`.
- **Langue** : le crawl est fait en `--lang fr` ; `canton` est donc le libellé
  français. `canton_code` (GE, VD…) est, lui, indépendant de la langue.

## Conformité

`robots.txt` de RealAdvisor porte `Disallow: /` sous `User-agent: *`, et le
challenge Cloudflare est une seconde barrière explicite. Même cadre de décision
que `realadvisor-sync` (go de Gregory, accès assumé) : on reste poli — une seule
session, ~5 s entre fiches, aucun parallélisme — mais c'est une **décision
métier**, pas une autorisation technique. Les avis clients sont des données
personnelles publiées : usage interne, pas de rediffusion.
