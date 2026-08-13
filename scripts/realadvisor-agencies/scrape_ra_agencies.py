#!/usr/bin/env python3
"""Collecte l'annuaire des agences immobilières de RealAdvisor (nom, adresse,
site, note, agents, statistiques de vente, avis) et télécharge les logos.

Pourquoi un navigateur et pas un client HTTP
--------------------------------------------
Les pages HTML de realadvisor.ch sont derrière un challenge Cloudflare
« managed » : curl, un en-tête RSC, un Chrome piloté par Playwright et Camoufox
en mode headless rendent tous 403. Seul Camoufox **headful** franchit le
challenge — d'où `headless=False`, qui n'est pas un confort mais la condition de
fonctionnement. Le challenge n'est payé qu'à la première page : la session garde
son cookie, les suivantes coûtent ~2 s.

Deux surfaces échappent au challenge et sont donc lues en HTTP nu :
`realadvisor.ch/sitemap.xml` (l'index, pas les sous-sitemaps) et
`storage.googleapis.com` (les logos).

Sortie (dans --out, par défaut `out/`)
--------------------------------------
  agencies.jsonl   une fiche complète par ligne — reprise de crawl possible
  agencies.csv     un plat des champs scalaires, pour tableur
  agents.csv       une ligne par agent
  reviews.csv      une ligne par avis
  logos/           les logos, nommés d'après le slug de l'agence

Usage
-----
  python scrape_ra_agencies.py --limit 20        # essai
  python scrape_ra_agencies.py                   # tout (~1240 fiches, ~45 min)
  python scrape_ra_agencies.py --logos-only      # relancer juste les logos
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from scrapling.fetchers import StealthySession

import ra_parse as P

BASE = "https://realadvisor.ch"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Les chunks texte du flux RSC : `50:T4d1,<texte de 0x4d1 octets>`. C'est là que
# Next.js range les longs textes (la présentation « A propos »), référencés
# ailleurs par `$50`.
_TEXT_CHUNK = re.compile(r"(?:^|\n)([0-9a-f]+):T([0-9a-f]+),")

# Le canton n'existe nulle part comme donnée : seul le fil d'Ariane le porte, et
# sous forme de slug français. On le ramène au code officiel, seul format que le
# CRM sait rapprocher de ses propres tables.
CANTON_CODE = {
    "zurich": "ZH", "berne": "BE", "lucerne": "LU", "uri": "UR", "schwyz": "SZ",
    "obwald": "OW", "nidwald": "NW", "glaris": "GL", "zoug": "ZG",
    "fribourg": "FR", "soleure": "SO", "bale-ville": "BS", "bale-campagne": "BL",
    "schaffhouse": "SH", "appenzell-rhodes-exterieures": "AR",
    "appenzell-rhodes-interieures": "AI", "saint-gall": "SG", "grisons": "GR",
    "argovie": "AG", "thurgovie": "TG", "tessin": "TI", "vaud": "VD",
    "valais": "VS", "neuchatel": "NE", "geneve": "GE", "jura": "JU",
}

# « Rue de la Faïencerie 2, 1227 Carouge » — filet quand l'objet « équipe » du
# flux RSC manque (agences non revendiquées) et que seul le JSON-LD répond.
_ADDR = re.compile(r"^(.*?)\s+(\S+),\s*(\d{4})\s+(.+)$")


# ─── Extraction ───────────────────────────────────────────────────

def text_chunks(blob: str) -> dict[str, str]:
    """Indexe les chunks texte du flux RSC par leur identifiant."""
    out = {}
    for m in _TEXT_CHUNK.finditer(blob):
        length = int(m.group(2), 16)
        out[m.group(1)] = blob[m.end() : m.end() + length]
    return out


def pick_team(blob: str, slug: str) -> dict:
    """L'objet « équipe » de CETTE agence, le plus complet des candidats.

    La page cite aussi les agences des transactions voisines ; on filtre donc sur
    le slug, puis on garde l'objet qui porte le plus de clés (celui de l'en-tête
    de fiche est plus riche que ceux cités dans les ventes).
    """
    best = {}
    for obj in P.json_objects_with_key(blob, "agency_slug", limit=60):
        if obj.get("agency_slug") != slug:
            continue
        if len(obj) > len(best):
            best = obj
    return best


def extract(page_html: str, url: str) -> dict:
    slug = url.rstrip("/").rsplit("/", 1)[-1].removeprefix("agence-")
    blob = P.rsc_payload(page_html)
    chunks = text_chunks(blob)
    orgs = P.ld_organizations(page_html)
    org = orgs[0] if orgs else {}
    team = pick_team(blob, slug)

    # « A propos » : la section renvoie à un chunk texte (`"children":"$50"`).
    about = None
    m = re.search(r'"A propos"\}\],\[.{0,200}?"children":"\$([0-9a-f]+)"', blob)
    if m:
        about = chunks.get(m.group(1))

    m = re.search(r'"href":"([^"]+)","rel":"nofollow","eventName":"website_link_clicked"', blob)
    website = m.group(1) if m else None

    # L'uuid d'agence vit normalement sur l'objet « équipe » — mais celui-ci
    # n'existe QUE pour les agences revendiquées (31 % du vivier ne l'ont pas :
    # 0 transaction, pas de fiche d'équipe). Les paramètres d'événement du lien
    # « site web », eux, le portent toujours : c'est notre seconde source.
    agency_id = team.get("id")
    if not agency_id:
        m_id = re.search(r'"agency_id":"([0-9a-f-]{36})"', blob)
        agency_id = m_id.group(1) if m_id else None

    m_y = re.search(r"(\d+)\s*ans? d.expérience", blob)
    m_p = re.search(r'"hasPhone":(true|false)', blob)

    # Un agent est éclaté sur plusieurs objets RSC, chacun partiel : on fusionne
    # par slug en gardant la première valeur non nulle rencontrée.
    by_slug: dict[str, dict] = {}
    for obj in P.enclosing_objects(blob, "agent_slug", levels=3):
        user = obj.get("user") if isinstance(obj.get("user"), dict) else obj
        slug_a = user.get("agent_slug")
        if not slug_a:
            continue
        mv = user.get("mv_agent") or {}
        cur = by_slug.setdefault(slug_a, {"agent_slug": slug_a})
        for key, val in (
            ("full_name", user.get("full_name")),
            ("title", obj.get("title")),
            ("is_broker", user.get("is_broker")),
            ("services", user.get("services")),
            ("reviews_count", mv.get("reviews_count")),
            ("avg_rating", mv.get("avg_rating")),
        ):
            if cur.get(key) in (None, [], "") and val not in (None, [], ""):
                cur[key] = val
    agents = [{**{"full_name": None, "title": None, "is_broker": None,
                  "services": [], "reviews_count": None, "avg_rating": None}, **a}
              for a in by_slug.values()]

    reviews = []
    for r in org.get("review") or []:
        reviews.append({
            "author": (r.get("author") or {}).get("name"),
            "date": r.get("datePublished"),
            "rating": (r.get("reviewRating") or {}).get("ratingValue"),
            "text": (r.get("reviewBody") or "").strip(),
        })

    agg = org.get("aggregateRating") or {}
    m_tx = re.search(r'"totalTransactions":(\d+)', blob)
    m_ls = re.search(r'"totalListings":(\d+)', blob)

    canton_slug = canton = None
    for crumb in P.ld_breadcrumb(page_html):
        m_c = re.search(r"/agences-immobilieres/canton-([\w\-]+)$", crumb.get("@id", ""))
        if m_c:
            canton_slug, canton = m_c.group(1), crumb.get("name")

    route, number = team.get("route"), team.get("street_number")
    postcode, locality = team.get("postcode"), team.get("locality")
    if not postcode and org.get("address"):
        m_a = _ADDR.match(org["address"].strip())
        if m_a:
            route, number, postcode, locality = m_a.groups()

    return {
        "slug": slug,
        "source_url": url,
        "agency_id": agency_id,
        "name": team.get("name") or org.get("name"),
        "logo_url": ((team.get("logo") or {}).get("url")) or org.get("image"),
        "website": website,
        "address_full": org.get("address"),
        "route": route,
        "street_number": number,
        "postcode": postcode,
        "locality": locality,
        "canton": canton,
        "canton_code": CANTON_CODE.get(canton_slug or ""),
        "hide_exact_address": team.get("hide_exact_address"),
        "rating": agg.get("ratingValue"),
        "reviews_count": agg.get("reviewCount"),
        "transactions_total": int(m_tx.group(1)) if m_tx else None,
        "sales_count_24m": (team.get("mv_agency") or {}).get("sales_count"),
        "listings_count": int(m_ls.group(1)) if m_ls else None,
        "years_experience": int(m_y.group(1)) if m_y else None,
        # Le numéro lui-même n'est jamais rendu (masqué derrière un clic) ; on ne
        # garde que le fait qu'il en existe un, ce qui suffit à qualifier un lead.
        "has_phone": (m_p.group(1) == "true") if m_p else None,
        "services": sorted({s for a in agents for s in a["services"]}),
        "about": about,
        "agents": agents,
        "reviews": reviews,
    }


# ─── Énumération ──────────────────────────────────────────────────

def sitemap_urls(session, lang: str) -> list[str]:
    """Les URLs de fiches agence, depuis le sous-sitemap.

    Trois contraintes s'empilent, d'où la gymnastique :
      - `/{lang}/sitemaps/` est challengé (contrairement à `/sitemap.xml`) ;
      - un XHR ne peut pas résoudre le challenge — la page d'épreuve est du HTML
        et doit exécuter son JS, donc il faut une VRAIE navigation ;
      - la navigation doit venir APRÈS une page HTML, qui pose le cookie.
    Le navigateur rend ensuite le XML dans sa visionneuse : on relit les URLs
    dans le DOM plutôt que dans des balises <loc>, qui n'y survivent pas toutes.
    """
    seed = f"{BASE}/{lang}/agences-immobilieres/canton-jura"
    session.fetch(seed)

    grabbed: dict = {}

    def go(pw_page):
        pw_page.goto(f"{BASE}/{lang}/sitemaps/agency.xml", wait_until="load")
        pw_page.wait_for_timeout(6000)
        grabbed["body"] = pw_page.content()
        return pw_page

    session.fetch(seed, page_action=go)
    body = grabbed.get("body", "")
    locs = re.findall(r"<loc>([^<]+)</loc>", body)
    if not locs:
        locs = re.findall(
            rf"{BASE}/{lang}/agences-immobilieres/agence-[\w\-]+", body)
    return sorted(set(locs))


# ─── Logos ────────────────────────────────────────────────────────

def download_logos(records: list[dict], out: Path, delay: float) -> int:
    """Les logos vivent sur storage.googleapis.com, hors challenge : HTTP nu."""
    logos = out / "logos"
    logos.mkdir(parents=True, exist_ok=True)
    done = 0
    for rec in records:
        url = rec.get("logo_url")
        if not url:
            continue
        ext = re.sub(r"[?#].*$", "", url).rsplit(".", 1)[-1].lower()
        if ext not in {"png", "jpg", "jpeg", "webp", "gif", "svg"}:
            ext = "png"
        dest = logos / f"{rec['slug']}.{ext}"
        if dest.exists() and dest.stat().st_size > 0:
            rec["logo_file"] = dest.name
            done += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                dest.write_bytes(resp.read())
            rec["logo_file"] = dest.name
            done += 1
        except Exception as exc:  # noqa: BLE001 — un logo manquant ne casse pas le lot
            print(f"  logo KO {rec['slug']}: {type(exc).__name__}", file=sys.stderr)
        time.sleep(delay)
    return done


# ─── Sorties ──────────────────────────────────────────────────────

# Décision produit (13.08.2026, Julien) : on ne retient que l'IDENTITÉ de
# l'agence et son logo. Les indicateurs de performance — transactions, ventes sur
# 24 mois, notes, avis, équipe — sont volontairement hors livrable.
#
# ⚠ La page les rend de toute façon : les retirer ne fait rien gagner au crawl,
# et `agencies.jsonl` (fichier de reprise, pas livrable) garde la capture brute.
# C'est ce qui permettra d'en rajouter un jour SANS tout recollecter.
SCALARS = ["slug", "agency_id", "name", "website", "has_phone",
           "address_full", "route", "street_number", "postcode", "locality",
           "canton", "canton_code", "hide_exact_address", "years_experience",
           "logo_url", "logo_file", "source_url"]


def write_outputs(records: list[dict], out: Path) -> None:
    with (out / "agencies.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=SCALARS)
        w.writeheader()
        for r in records:
            w.writerow({k: r.get(k) for k in SCALARS})


# ─── Boucle ───────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out", type=Path)
    ap.add_argument("--lang", default="fr")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.0, help="pause entre fiches (s)")
    ap.add_argument("--logos-only", action="store_true")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    jsonl = args.out / "agencies.jsonl"

    if args.logos_only:
        records = [json.loads(l) for l in jsonl.read_text().splitlines() if l.strip()]
        print(f"logos : {download_logos(records, args.out, args.delay/4)}/{len(records)}")
        write_outputs(records, args.out)
        return

    seen = set()
    if jsonl.exists():
        for line in jsonl.read_text().splitlines():
            if line.strip():
                seen.add(json.loads(line)["source_url"])
        print(f"reprise : {len(seen)} fiches déjà collectées", file=sys.stderr)

    with StealthySession(headless=False, solve_cloudflare=True, humanize=True,
                         network_idle=False, wait=600) as sess:
        urls = sitemap_urls(sess, args.lang)
        print(f"sitemap : {len(urls)} agences", file=sys.stderr)
        todo = [u for u in urls if u not in seen]
        if args.limit:
            todo = todo[: args.limit]

        t0, ko = time.time(), 0
        with jsonl.open("a") as sink:
            for i, url in enumerate(todo, 1):
                try:
                    page = sess.fetch(url)
                    if "__next_f" not in page.html_content:
                        raise RuntimeError(f"page non rendue (status {page.status})")
                    rec = extract(page.html_content, url)
                    sink.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    sink.flush()
                except Exception as exc:  # noqa: BLE001 — une fiche perdue ≠ run perdu
                    ko += 1
                    print(f"  KO {url.rsplit('/',1)[-1]}: {type(exc).__name__}: "
                          f"{str(exc)[:120]}", file=sys.stderr)
                if i % 25 == 0 or i == len(todo):
                    rate = (time.time() - t0) / i
                    print(f"  {i}/{len(todo)}  {rate:.1f}s/fiche  "
                          f"reste ~{rate*(len(todo)-i)/60:.0f} min  KO={ko}", file=sys.stderr)
                time.sleep(args.delay)

    records = [json.loads(l) for l in jsonl.read_text().splitlines() if l.strip()]
    print(f"logos : {download_logos(records, args.out, args.delay/4)}/{len(records)}")
    write_outputs(records, args.out)
    print(f"OK — {len(records)} agences dans {args.out}")


if __name__ == "__main__":
    main()
