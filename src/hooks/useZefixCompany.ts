/**
 * Recherche d'une société au registre du commerce suisse, par raison sociale.
 *
 * SOURCE : LINDAS, l'entrepôt de données liées de la Confédération, qui publie le
 * graphe Zefix <https://lindas.admin.ch/foj/zefix> en SPARQL — sans clé ni compte.
 * C'est déjà la source du connecteur KYB côté serveur
 * (supabase/functions/_shared/kyb-sources.ts) ; l'API Zefix elle-même n'a jamais
 * été ouverte, les identifiants demandés à zefix@bj.admin.ch étant restés sans
 * réponse. Appel DIRECT depuis le navigateur : l'endpoint répond avec les en-têtes
 * CORS voulus (vérifié le 03.08.2026), aucune Edge Function n'est nécessaire.
 *
 * ⚠ RECHERCHE EXPLICITE, JAMAIS À LA FRAPPE, et c'est une contrainte mesurée, pas
 * un choix d'ergonomie. Le filtre de préfixe sur la raison sociale n'est indexé
 * par aucun côté du triplestore : LINDAS balaie le graphe à chaque appel.
 *
 *   nom « nestl »   → 1 350 ms
 *   nom « regie »   → 3 302 ms   (identique sans LCASE : ce n'est pas la casse)
 *   nom « regie du »→ 5 243 ms   ⚠ PLUS LONG quand le préfixe est plus précis,
 *                                 car moins de correspondances = plus de graphe
 *                                 parcouru avant d'atteindre LIMIT
 *   UID → nom       →    53 ms   (le seul sens réellement indexé)
 *
 * Un typeahead à 3 s dont le cas COURANT est le plus lent serait une promesse
 * cassée à chaque frappe. D'où `search()`, appelée sur un geste de l'agent.
 * Les index plein-texte usuels ont été essayés et ne sont pas branchés ici
 * (`tag:stardog:api:property:textMatch` et `text:query` de Jena : 200, 0 résultat).
 */
import { useCallback, useRef, useState } from 'react'

export interface ZefixCompany {
  /** Raison sociale telle qu'inscrite au registre. */
  name: string
  /** IDE/UID au format brut du registre (`CHE123456789`). */
  uid: string
  /** IDE mis en forme suisse (`CHE-123.456.789`) — ce qui se lit sur un extrait. */
  uidFormatted: string
  /** Commune du siège, quand le graphe la porte. Distingue deux homonymes. */
  municipality: string
}

const ENDPOINT = 'https://lindas.admin.ch/query'
const GRAPH = 'https://lindas.admin.ch/foj/zefix'
const MAX_RESULTS = 8
/** En dessous, le balayage ramène surtout du bruit et coûte le plus cher. */
export const ZEFIX_MIN_CHARS = 4

/**
 * Échappe une saisie destinée à un littéral SPARQL entre guillemets.
 *
 * ⚠ Non négociable : la raison sociale vient de l'utilisateur et part dans une
 * requête. Sans échappement, un guillemet suffit à sortir du littéral et à
 * réécrire la requête (une injection SPARQL). L'ordre compte — l'antislash
 * D'ABORD, sinon on échapperait les antislashes qu'on vient d'introduire.
 * Les caractères de contrôle sont retirés plutôt qu'échappés : ils n'ont aucun
 * sens dans une raison sociale, et une requête sur plusieurs lignes n'en a pas
 * davantage.
 */
export function escapeSparqlLiteral(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex -- retirer les caractères de contrôle est précisément l'objet de cette ligne.
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

/** `CHE123456789` -> `CHE-123.456.789`, la forme lisible d'un extrait du registre. */
export function formatUid(uid: string): string {
  const m = /^CHE(\d{9})$/.exec(uid)
  if (!m) return uid
  return `CHE-${m[1].slice(0, 3)}.${m[1].slice(3, 6)}.${m[1].slice(6)}`
}

/**
 * `?uid` est filtré sur le préfixe `CHE` : le graphe porte TROIS identifiants par
 * société — l'IDE (`CHE106072501`), l'ancien numéro cantonal (`CH55001333907`) et
 * le numéro Zefix interne (`262490`). Sans ce filtre, chaque société sortirait en
 * trois lignes identiques à l'œil. `DISTINCT` couvre le reste.
 */
function buildQuery(prefix: string): string {
  return `PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?name ?uid ?municipality WHERE {
  GRAPH <${GRAPH}> {
    ?org a schema:Organization ; schema:legalName ?name ; schema:identifier ?i .
    ?i schema:value ?uid .
    FILTER(STRSTARTS(?uid, "CHE"))
    FILTER(STRSTARTS(LCASE(?name), "${escapeSparqlLiteral(prefix.toLowerCase())}"))
    OPTIONAL { ?org schema:address/schema:addressLocality ?municipality }
  }
} LIMIT ${MAX_RESULTS}`
}

/** Réponses gardées pour la session : une même recherche coûte des secondes, la refaire serait gratuit à l'écran mais pas au registre. */
const cache = new Map<string, ZefixCompany[]>()

/**
 * `search()` déclenche la requête ; rien ne part tant qu'elle n'est pas appelée.
 * `reset()` efface les résultats sans toucher au cache.
 */
export function useZefixCompany() {
  const [results, setResults] = useState<ZefixCompany[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback(async (raw: string): Promise<void> => {
    const trimmed = raw.trim()
    if (trimmed.length < ZEFIX_MIN_CHARS) return

    const key = trimmed.toLowerCase()
    setSearched(true)
    setError(null)

    if (cache.has(key)) {
      setResults(cache.get(key)!)
      return
    }

    // Une recherche dure des secondes : sans cette annulation, deux clics
    // rapprochés laisseraient la plus LENTE écraser la plus récente.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSearching(true)

    try {
      const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ query: buildQuery(trimmed) })}`, {
        headers: { Accept: 'application/sparql-results+json' },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`LINDAS ${res.status}`)
      const json = await res.json() as {
        results: { bindings: { name: { value: string }; uid: { value: string }; municipality?: { value: string } }[] }
      }
      const parsed: ZefixCompany[] = json.results.bindings.map((b) => ({
        name: b.name.value,
        uid: b.uid.value,
        uidFormatted: formatUid(b.uid.value),
        municipality: b.municipality?.value ?? '',
      }))
      cache.set(key, parsed)
      setResults(parsed)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setResults([])
    } finally {
      // Pas dans le `catch` : une annulation sort avant, et c'est voulu — la
      // requête qui l'a remplacée tient déjà l'indicateur d'attente.
      if (!controller.signal.aborted) setIsSearching(false)
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setResults([])
    setError(null)
    setSearched(false)
    setIsSearching(false)
  }, [])

  return { results, isSearching, error, searched, search, reset }
}
