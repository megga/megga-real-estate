"""Extraction d'une fiche agence RealAdvisor depuis son HTML.

Deux sources dans la même page, complémentaires :
  - le JSON-LD `Organization` : nom, logo, adresse, équipe, avis (stable, normé) ;
  - le payload RSC de Next.js (`self.__next_f.push`) : le modèle de données réel
    (uuid, adresse éclatée, agrégats de transactions), plus riche mais non normé.

On lit les deux et on préfère le RSC quand il répond, le JSON-LD servant de filet.
"""

import html as html_mod
import json
import sys
import re

_NEXT_F = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')
_LD = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', re.S
)


def rsc_payload(page_html: str) -> str:
    """Recolle les fragments du flux RSC en une seule chaîne déséchappée."""
    parts = []
    for m in _NEXT_F.finditer(page_html):
        # Chaque fragment est un littéral JSON string : json.loads le déséchappe
        # correctement (\\", \\n, \\uXXXX) là où un str.replace se tromperait.
        try:
            parts.append(json.loads('"' + m.group(1) + '"'))
        except json.JSONDecodeError:
            continue
    return "".join(parts)


def json_objects_with_key(blob: str, key: str, limit: int = 40):
    """Rend les objets JSON complets du blob qui contiennent `"key":`.

    Le flux RSC n'est pas un document JSON : c'est une soupe de fragments. On
    localise donc la clé, on remonte à l'accolade ouvrante, et on avance en
    comptant les accolades (en ignorant celles dans les chaînes).
    """
    out = []
    for m in re.finditer(r'"%s"\s*:' % re.escape(key), blob):
        start = blob.rfind("{", 0, m.start())
        while start != -1 and len(out) < limit:
            obj = _balanced(blob, start)
            if obj is not None:
                try:
                    out.append(json.loads(obj))
                    break
                except json.JSONDecodeError:
                    pass
            start = blob.rfind("{", 0, start)
        if len(out) >= limit:
            break
    return out


def enclosing_objects(blob: str, key: str, levels: int = 3):
    """Pour chaque occurrence de `key`, rend les objets emboîtés qui l'entourent.

    Le flux RSC éclate une même entité sur plusieurs objets : l'agent porte
    `agent_slug`, mais son `title` est sur l'objet parent (`{title, user:{…}}`).
    Ne lire que l'objet le plus proche perd donc des champs — on remonte.
    """
    for m in re.finditer(r'"%s"\s*:' % re.escape(key), blob):
        found, start = 0, blob.rfind("{", 0, m.start())
        while start != -1 and found < levels:
            obj = _balanced(blob, start)
            if obj is not None and len(obj) < 200_000:
                try:
                    yield json.loads(obj)
                    found += 1
                except json.JSONDecodeError:
                    pass
            start = blob.rfind("{", 0, start)


def _balanced(blob: str, start: int):
    depth, i, in_str, esc = 0, start, False, False
    while i < len(blob):
        c = blob[i]
        if in_str:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return blob[start : i + 1]
        i += 1
        if i - start > 400_000:
            # ⛔ Abandonner en silence fait disparaître un champ sans trace : une
            # fiche dont l'objet « équipe » dépasse le plafond ressort avec le
            # même profil qu'une agence non revendiquée, et rien ne distingue les
            # deux cas. On le signale.
            print(f"[ra_parse] objet > 400k caractères ignoré à l'offset {start} "
                  f"— champ potentiellement perdu", file=sys.stderr)
            return None
    return None


def ld_breadcrumb(page_html: str):
    """Les maillons du fil d'Ariane, dans l'ordre (canton et localité y vivent)."""
    for node in _ld_nodes(page_html):
        if node.get("@type") == "BreadcrumbList":
            return [it.get("item") or {} for it in node.get("itemListElement") or []]
    return []


def _ld_nodes(page_html: str):
    for m in _LD.finditer(page_html):
        try:
            data = json.loads(html_mod.unescape(m.group(1)).strip())
        except json.JSONDecodeError:
            continue
        for node in data if isinstance(data, list) else [data]:
            if isinstance(node, dict):
                yield node


def ld_organizations(page_html: str):
    """Les blocs JSON-LD de type Organization (dédupliqués par nom+url)."""
    seen, out = set(), []
    for m in _LD.finditer(page_html):
        raw = html_mod.unescape(m.group(1)).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        for node in data if isinstance(data, list) else [data]:
            if isinstance(node, dict) and node.get("@type") == "Organization":
                sig = (node.get("name"), node.get("url"))
                if sig not in seen:
                    seen.add(sig)
                    out.append(node)
    return out
