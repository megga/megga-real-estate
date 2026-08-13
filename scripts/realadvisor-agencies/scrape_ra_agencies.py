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
  agencies.csv     LE LIVRABLE : identité, adresse, canton, site, logo
  logos/           les logos, nommés d'après le slug de l'agence
  agencies.jsonl   capture brute + fichier de reprise ; --purge-raw l'efface

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
import urllib.parse
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

# Filet quand l'objet « équipe » du flux RSC manque (agences non revendiquées)
# et que seul le JSON-LD répond. Deux formes, essayées dans cet ordre :
#   « Rue de la Faïencerie 2, 1227 Carouge »  → rue, n°, NPA, localité
#   « 1815 Montreux » / « Sion, 1950 Sion »   → NPA, localité seuls
# ⚠ Exiger un numéro de rue laissait 13 fiches sans NPA ni localité, et 4 sans
# canton, alors que l'adresse complète était là.
# Variantes d'extension qui désignent le même format : les ramener au nom usuel
# évite un `.jfif` que peu d'outils reconnaissent alors que c'est du JPEG.
ALIAS_EXT = {"jfif": "jpg", "jpe": "jpg", "tif": "tiff", "svgz": "svg"}

_ADDR_RUE = re.compile(r"^(.*?)\s+(\S+),\s*(\d{4})\s+(.+)$")
_ADDR_NPA = re.compile(r"(?:^|,\s*)(\d{4})\s+([^,]+)$")


# ─── Extraction ───────────────────────────────────────────────────

def text_chunks(blob: str) -> dict[str, str]:
    """Indexe les chunks texte du flux RSC par leur identifiant.

    ⛔ La longueur annoncée (`50:T4d1,`) est un nombre d'OCTETS — c'est le
    protocole flight, qui découpe un flux binaire. Trancher la chaîne Python sur
    cette valeur compte des CARACTÈRES : dès qu'un texte porte des accents, il en
    a moins que d'octets, et la tranche déborde sur le chunk suivant. On repasse
    donc par les octets.
    """
    raw = blob.encode("utf-8")
    out = {}
    for m in _TEXT_CHUNK.finditer(blob):
        length = int(m.group(2), 16)
        start = len(blob[: m.end()].encode("utf-8"))
        out[m.group(1)] = raw[start : start + length].decode("utf-8", "ignore")
    return out


def scoped_value(blob: str, pattern: str, slug: str):
    """Lit une valeur du flux RSC en refusant l'ambiguïté.

    ⛔ Un `re.search` nu prend la PREMIÈRE occurrence du flux entier : sur une
    fiche qui rend d'abord un bloc « agences similaires » ou une vente réalisée
    par un tiers, c'est la valeur du VOISIN qui est retenue, sans que rien ne le
    signale. On préfère donc l'occurrence portée par un objet dont l'`agency_slug`
    est celui de la page ; à défaut, on n'accepte la valeur que si le flux n'en
    contient qu'une seule — sinon on rend None plutôt qu'un chiffre plausible et
    faux.
    """
    ancre = re.search(pattern + r'[^{}]{0,400}?"agency_?[sS]lug":"%s"' % re.escape(slug), blob)
    if ancre:
        return ancre.group(1)
    valeurs = {m.group(1) for m in re.finditer(pattern, blob)}
    return valeurs.pop() if len(valeurs) == 1 else None


def pick_team(blob: str, slug: str) -> dict:
    """L'objet « équipe » de CETTE agence, le plus complet des candidats.

    La page cite aussi les agences des transactions voisines ; on filtre donc sur
    le slug, puis on retient l'objet qui porte le plus de champs d'IDENTITÉ.
    """
    # ⛔ Ne PAS classer sur le nombre de clés : si RealAdvisor enrichit un jour
    # l'objet cité dans le contexte d'une transaction (acheteur, vendeur…), il
    # dépasserait celui de l'en-tête de fiche et deviendrait la source du nom, du
    # logo et de l'adresse. On note donc les clés d'IDENTITÉ, celles qu'on lit.
    IDENTITE = ("name", "logo", "route", "street_number", "postcode", "locality",
                "hide_exact_address", "mv_agency", "id")
    best, best_score = {}, -1
    for obj in P.json_objects_with_key(blob, "agency_slug", limit=60):
        if obj.get("agency_slug") != slug:
            continue
        score = sum(1 for k in IDENTITE if obj.get(k) is not None)
        if score > best_score:
            best, best_score = obj, score
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

    # Le lien « site web » porte href ET params dans le MÊME bloc : on les lit
    # ensemble pour être sûr que l'uuid appartient bien à ce lien-là.
    m = re.search(
        r'"href":"([^"]+)","rel":"nofollow","eventName":"website_link_clicked",'
        r'"params":\{"page_type":"agency-detail","agency_id":"([0-9a-f-]{36})"', blob)
    website = m.group(1) if m else None

    # L'uuid vit normalement sur l'objet « équipe » — mais celui-ci n'existe QUE
    # pour les agences revendiquées (31 % du vivier ne l'ont pas). Le bloc
    # d'événement ci-dessus est la seconde source, et il est ancré sur
    # `page_type: agency-detail`, donc sur l'agence de la PAGE — là où un
    # `re.search` sur `"agency_id"` seul aurait pu happer celui d'un voisin.
    agency_id = team.get("id") or (m.group(2) if m else None)
    if not agency_id:
        agency_id = scoped_value(blob, r'"agency_id":"([0-9a-f-]{36})"', slug)

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
    # Ancrés sur le slug de la page (cf. scoped_value) : ces compteurs sont rendus
    # à côté de ceux d'agences citées, et un premier-match-gagne y attribuait les
    # chiffres du voisin sans que rien ne paraisse anormal.
    tx = scoped_value(blob, r'"totalTransactions":(\d+)', slug)
    ls = scoped_value(blob, r'"totalListings":(\d+)', slug)

    canton_slug = canton = None
    for crumb in P.ld_breadcrumb(page_html):
        m_c = re.search(r"/agences-immobilieres/canton-([\w\-]+)$", crumb.get("@id", ""))
        if m_c:
            canton_slug, canton = m_c.group(1), crumb.get("name")

    route, number = team.get("route"), team.get("street_number")
    postcode, locality = team.get("postcode"), team.get("locality")
    if not postcode and org.get("address"):
        brut = org["address"].strip()
        m_a = _ADDR_RUE.match(brut)
        if m_a:
            route, number, postcode, locality = m_a.groups()
        else:
            # Pas de numéro de rue : on récupère au moins NPA et localité, plutôt
            # que de tout perdre — c'est ce qui laissait des fiches sans canton.
            m_a = _ADDR_NPA.search(brut)
            if m_a:
                postcode, locality = m_a.group(1), m_a.group(2).strip()

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
        "transactions_total": int(tx) if tx else None,
        "sales_count_24m": (team.get("mv_agency") or {}).get("sales_count"),
        "listings_count": int(ls) if ls else None,
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
    # ⛔ Une seule page d'amorce codée en dur rend l'énumération muette si RA la
    # renomme : le cookie n'est pas posé, la navigation retombe sur le challenge,
    # et le script annonce « 0 agences » sans erreur. On essaie donc plusieurs
    # cantons et on échoue BRUYAMMENT si aucun ne répond.
    seed = None
    for canton in ("canton-jura", "canton-geneve", "canton-vaud", "canton-zurich"):
        candidat = f"{BASE}/{lang}/agences-immobilieres/{canton}"
        try:
            page = session.fetch(candidat)
            if "__next_f" in page.html_content:
                seed = candidat
                break
        except Exception as exc:  # noqa: BLE001 — on essaie le canton suivant
            print(f"  amorce {canton} KO ({type(exc).__name__})", file=sys.stderr)
    if seed is None:
        raise RuntimeError(
            "aucune page canton n'a pu servir d'amorce — le cookie Cloudflare ne "
            "peut pas être posé, l'énumération du sitemap échouerait en silence")

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

def encode_url(url: str) -> str:
    """Rend l'URL utilisable par urllib.

    Les logos sont servis sous leur nom d'origine, tel que l'agence l'a téléversé
    — « Logo h2b_2024-02-13.jpg », « logo Jol'Immo avec slogan.jpg ». Ces espaces
    et apostrophes littéraux font échouer urllib en InvalidURL (18 logos perdus
    sur 1236 avant ce correctif). On ré-encode le seul chemin, en laissant
    intactes les séquences déjà encodées.
    """
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(parts._replace(
        path=urllib.parse.quote(parts.path, safe="/%:@&=+$,~")))


def download_logos(records: list[dict], out: Path, delay: float) -> int:
    """Les logos vivent sur storage.googleapis.com, hors challenge : HTTP nu."""
    logos = out / "logos"
    logos.mkdir(parents=True, exist_ok=True)
    done = 0
    for rec in records:
        url = rec.get("logo_url")
        if not url:
            continue
        # ⛔ Forcer `.png` sur tout format inconnu produit des fichiers à extension
        # MENSONGÈRE. La liste a d'abord oublié l'AVIF, puis le JFIF (2 logos
        # enregistrés en .png alors qu'ils sont du JPEG). Élargir la liste ne fait
        # que repousser le problème : on garde donc l'extension d'origine dès
        # qu'elle ressemble à une extension, et `.bin` signale l'inconnu au lieu
        # de le déguiser.
        ext = re.sub(r"[?#].*$", "", url).rsplit(".", 1)[-1].lower()
        ext = ALIAS_EXT.get(ext, ext)
        if not re.fullmatch(r"[a-z0-9]{2,5}", ext):
            ext = "bin"
        dest = logos / f"{rec['slug']}.{ext}"
        if dest.exists() and dest.stat().st_size > 0:
            rec["logo_file"] = dest.name
            done += 1
            continue
        try:
            req = urllib.request.Request(encode_url(url), headers={"User-Agent": UA})
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
# ⚠ La page les rend de toute façon : les retirer ne ferait rien gagner au crawl.
# Ils transitent donc par `agencies.jsonl`, que `--purge-raw` efface ensuite (choix
# de Julien) — au prix connu et accepté qu'élargir le livrable demandera alors un
# recrawl complet, la reprise reposant sur ce même fichier.
SCALARS = ["slug", "agency_id", "name", "website", "has_phone",
           "address_full", "route", "street_number", "postcode", "locality",
           "canton", "canton_code", "hide_exact_address", "years_experience",
           "logo_url", "logo_file", "source_url"]


def read_jsonl(path: Path) -> list[dict]:
    """Relit le JSONL en ne coupant QUE sur `\\n`.

    ⛔ Ne jamais utiliser `str.splitlines()` ici : il coupe aussi sur U+2028,
    U+2029, \\x0b, \\x0c et \\x85, que `json.dumps(ensure_ascii=False)` n'échappe
    pas. Mesuré sur ce jeu de données : 16 U+2028 venus des présentations
    d'agences faisaient lire 1236 lignes comme 1250, dont des fragments
    invalides — le crawl entier était collecté mais illisible.
    """
    return [json.loads(l) for l in path.read_text().split("\n") if l.strip()]


def purge_raw(jsonl: Path, enabled: bool) -> None:
    """Efface la capture brute, sur demande explicite.

    Volontairement APRÈS l'écriture du livrable et jamais avant : le CSV et les
    logos se dérivent de ce fichier. Un garde-fou minimal — refuser de purger si
    le livrable n'existe pas — évite de tout perdre sur un run interrompu.
    """
    if not enabled or not jsonl.exists():
        return
    deliverable = jsonl.with_name("agencies.csv")
    if not deliverable.exists() or deliverable.stat().st_size == 0:
        print("  purge ANNULÉE : agencies.csv absent ou vide", file=sys.stderr)
        return
    jsonl.unlink()
    print(f"  capture brute purgée ({jsonl.name}) — la reprise repartira de zéro",
          file=sys.stderr)


def write_outputs(records: list[dict], out: Path) -> None:
    # Les données saisies par les agences traînent des espaces : « Laura Immo »
    # sortait avec un blanc final, et l'adresse « 1920  Martigny » (double
    # espace) donnait un NPA « 1920 » que plus rien ne reconnaît comme NPA.
    # On normalise à l'écriture, pas seulement à l'extraction, pour que les
    # captures déjà faites en profitent sans recrawl.
    def clean(v):
        return re.sub(r"\s+", " ", v).strip() if isinstance(v, str) else v

    with (out / "agencies.csv").open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=SCALARS)
        w.writeheader()
        for r in records:
            w.writerow({k: clean(r.get(k)) for k in SCALARS})


# ─── Boucle ───────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out", type=Path)
    ap.add_argument("--lang", default="fr")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.0, help="pause entre fiches (s)")
    ap.add_argument("--logos-only", action="store_true")
    ap.add_argument("--purge-raw", action="store_true",
                    help="supprime agencies.jsonl une fois le livrable écrit "
                         "(⚠ c'est le fichier de reprise : un run suivant "
                         "repart de zéro, et tout champ non livré est perdu)")
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    jsonl = args.out / "agencies.jsonl"

    if args.logos_only:
        records = read_jsonl(jsonl)
        print(f"logos : {download_logos(records, args.out, args.delay/4)}/{len(records)}")
        write_outputs(records, args.out)
        purge_raw(jsonl, args.purge_raw)
        return

    seen = set()
    if jsonl.exists():
        for rec in read_jsonl(jsonl):
            seen.add(rec["source_url"])
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
    purge_raw(jsonl, args.purge_raw)
    print(f"OK — {len(records)} agences dans {args.out}")


if __name__ == "__main__":
    main()
