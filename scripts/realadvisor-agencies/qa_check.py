"""Contrôle du jeu de données collecté — on cherche ce qui est FAUX, pas ce qui
est présent. Un scrape qui rend 1236 lignes bien remplies peut être bien rempli
de travers : logo d'une autre entité, NPA parti dans le mauvais champ, agent
compté trois fois. Chaque test ci-dessous vise un de ces silences.

Usage : python qa_check.py [out_dir]
"""

from __future__ import annotations

import collections
import json
import re
import sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "out")

CANTONS = {"ZH", "BE", "LU", "UR", "SZ", "OW", "NW", "GL", "ZG", "FR", "SO",
           "BS", "BL", "SH", "AR", "AI", "SG", "GR", "AG", "TG", "TI", "VD",
           "VS", "NE", "GE", "JU"}

# En-têtes de fichiers image : un logo « téléchargé » qui est en fait une page
# d'erreur HTML passerait tous les contrôles de taille.
MAGIC = {b"\x89PNG": "png", b"\xff\xd8\xff": "jpeg", b"GIF8": "gif",
         b"RIFF": "webp", b"<svg": "svg", b"<?xm": "svg"}

rows = [json.loads(l) for l in (OUT / "agencies.jsonl").read_text().splitlines() if l.strip()]
n = len(rows)
problems: list[str] = []


def flag(cond: bool, msg: str) -> None:
    print(("  ⛔ " if cond else "  ✓  ") + msg)
    if cond:
        problems.append(msg)


print(f"\n═══ {n} fiches\n")

print("Unicité et complétude")
slugs = [r["slug"] for r in rows]
dupes = [s for s, c in collections.Counter(slugs).items() if c > 1]
flag(bool(dupes), f"slugs dupliqués : {dupes[:5] or 'aucun'}")
flag(n != 1236, f"effectif attendu 1236, obtenu {n}")
flag(any(not r.get("name") for r in rows),
     f"fiches sans nom : {sum(1 for r in rows if not r.get('name'))}")

print("\nCohérence des champs")
bad_npa = [r["slug"] for r in rows if r.get("postcode") and
           not re.fullmatch(r"\d{4}", str(r["postcode"]))]
flag(bool(bad_npa), f"NPA non conformes (4 chiffres) : {bad_npa[:5] or 'aucun'}")

bad_ct = [r["slug"] for r in rows if r.get("canton_code") and r["canton_code"] not in CANTONS]
flag(bool(bad_ct), f"codes canton hors des 26 : {bad_ct[:5] or 'aucun'}")

bad_rating = [r["slug"] for r in rows if r.get("rating") is not None
              and not (1 <= float(r["rating"]) <= 5)]
flag(bool(bad_rating), f"notes hors [1,5] : {bad_rating[:5] or 'aucun'}")

bad_site = [r["slug"] for r in rows if r.get("website")
            and not str(r["website"]).startswith(("http://", "https://"))]
flag(bool(bad_site), f"sites non-URL : {bad_site[:5] or 'aucun'}")

# Le NPA glissé dans `locality` est le symptôme d'un repli d'adresse mal calé.
slipped = [r["slug"] for r in rows if r.get("locality")
           and re.fullmatch(r"\d{4}", str(r["locality"]))]
flag(bool(slipped), f"NPA glissé dans locality : {slipped[:5] or 'aucun'}")

print("\nAgents (le flux RSC éclate une entité en objets partiels)")
dup_agents = [r["slug"] for r in rows
              if len({a["agent_slug"] for a in r.get("agents") or []})
              != len(r.get("agents") or [])]
flag(bool(dup_agents), f"agents dupliqués dans une fiche : {dup_agents[:5] or 'aucun'}")

print("\nLogos")
logos = OUT / "logos"
files = {p.stem: p for p in logos.glob("*")} if logos.exists() else {}
want = [r for r in rows if r.get("logo_url")]
missing = [r["slug"] for r in want if r["slug"] not in files]
flag(bool(missing), f"logos annoncés mais absents : {len(missing)} {missing[:4]}")

empty, notimg = [], []
for slug, path in files.items():
    head = path.read_bytes()[:4]
    if path.stat().st_size == 0:
        empty.append(slug)
    elif not any(head.startswith(m) for m in MAGIC):
        notimg.append(slug)
flag(bool(empty), f"logos vides : {empty[:5] or 'aucun'}")
flag(bool(notimg), f"logos qui ne sont pas des images : {notimg[:5] or 'aucun'}")

# Piège connu du projet (cf. project_agency_logo_audit) : un même logo servi à
# plusieurs agences est LÉGITIME pour une franchise, suspect sinon.
shared = collections.defaultdict(list)
for r in want:
    shared[r["logo_url"]].append(r["name"] or r["slug"])
multi = {u: names for u, names in shared.items() if len(names) > 1}
print(f"  ·   logos partagés : {len(multi)} URL pour {sum(len(v) for v in multi.values())} agences")
for url, names in list(multi.items())[:5]:
    print(f"        {url.rsplit('/', 1)[-1][:52]} → {', '.join(names[:4])}")

print("\nRemplissage (champs retenus au livrable)")
for key in ("agency_id", "name", "logo_url", "website", "has_phone", "postcode",
            "locality", "canton_code", "years_experience"):
    c = sum(1 for r in rows if r.get(key) not in (None, "", []))
    print(f"  {key:20s} {c:5d}/{n}  {100*c//n:3d}%")

print(f"\nCouverture cantonale ({len({r.get('canton_code') for r in rows} - {None})}/26)")
per = collections.Counter(r.get("canton_code") for r in rows)
print("  " + "  ".join(f"{k}:{v}" for k, v in sorted(per.items(), key=lambda x: -x[1])))

print(f"\n{'⛔ ' + str(len(problems)) + ' problème(s)' if problems else '✓ aucun problème détecté'}")
