/**
 * Recherche d'une société au registre français, par raison sociale.
 *
 * SOURCE : l'API « Recherche d'entreprises » de la DINUM
 * <https://recherche-entreprises.api.gouv.fr> — service public, AUCUNE clé, et
 * conçue pour la recherche interactive. Elle agrège le répertoire Sirene et le
 * RNE. Les deux autres portes françaises ne conviennent pas ici : l'API Sirene de
 * l'INSEE exige un jeton, et « API Entreprise » est réservée aux administrations.
 *
 * ⚠ CONTRAIREMENT AU SUISSE, LE TYPEAHEAD EST VIABLE. Mesures du 03.08.2026 :
 *
 *   « regi »         → 216 ms (477 résultats)
 *   « regie immo »   → 771 ms (15)
 *   « sarl du parc » → 153 ms (5 121)
 *
 * Soit 4 à 20 fois plus rapide que LINDAS côté suisse, et surtout la latence NE
 * SE DÉGRADE PAS quand on précise — l'inverse exact du comportement de LINDAS,
 * qui met 5,2 s sur un préfixe long (cf. l'en-tête de useZefixCompany.ts). C'est
 * cette différence, et elle seule, qui fait que la France cherche à la frappe et
 * la Suisse sur un geste.
 *
 * Elle rend en outre `etat_administratif` — le statut actif/radié, précisément ce
 * qui MANQUE au graphe Zefix de LINDAS.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FrenchCompany {
  /** Raison sociale (dénomination complète, sigle compris quand il existe). */
  name: string
  /** SIREN à 9 chiffres — l'identifiant du registre, pendant de l'IDE suisse. */
  siren: string
  /** SIREN mis en forme (`552 032 708`), comme il se lit sur un extrait Kbis. */
  sirenFormatted: string
  /** Commune du siège, pour départager deux homonymes. */
  city: string
  /** false = radiée. L'API rend 'A' (active) ou 'C' (cessée). */
  active: boolean
}

interface ApiResult {
  siren: string
  nom_complet?: string
  nom_raison_sociale?: string
  etat_administratif?: string
  siege?: { libelle_commune?: string; code_postal?: string }
}

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const DEBOUNCE_MS = 300
const MIN_CHARS = 3
const MAX_RESULTS = 8

/** `552032708` -> `552 032 708`, la forme lisible d'un Kbis. */
export function formatSiren(siren: string): string {
  const m = /^(\d{3})(\d{3})(\d{3})$/.exec(siren)
  if (!m) return siren
  return `${m[1]} ${m[2]} ${m[3]}`
}

function parseResult(r: ApiResult): FrenchCompany {
  return {
    // `nom_complet` porte le sigle entre parenthèses quand il existe, ce qui est
    // ce qu'un dirigeant reconnaît ; `nom_raison_sociale` est le repli strict.
    name: r.nom_complet ?? r.nom_raison_sociale ?? '',
    siren: r.siren,
    sirenFormatted: formatSiren(r.siren),
    city: r.siege?.libelle_commune ?? '',
    // Comparaison EXPLICITE à 'A' plutôt que « différent de C » : un état
    // inattendu doit compter comme non-actif, jamais l'inverse.
    active: r.etat_administratif === 'A',
  }
}

const cache = new Map<string, FrenchCompany[]>()

/** Même signature que les hooks d'adresse : `query`/`setQuery` pilotent, `suggestions` en sort. */
export function useFrenchCompany(initialValue = '') {
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<FrenchCompany[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length < MIN_CHARS) { setSuggestions([]); setIsLoading(false); return }

    const key = trimmed.toLowerCase()
    if (cache.has(key)) { setSuggestions(cache.get(key)!); setIsLoading(false); return }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ q: trimmed, per_page: String(MAX_RESULTS) })
      const res = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`recherche-entreprises ${res.status}`)
      const data = await res.json() as { results: ApiResult[] }
      // Les radiées restent AFFICHÉES, jamais filtrées en silence : une agence peut
      // légitimement chercher une entité cessée, et la masquer laisserait croire
      // qu'elle n'a jamais existé. C'est l'écran qui la marque comme telle.
      const parsed = data.results.map(parseResult).filter((c) => c.name !== '')
      cache.set(key, parsed)
      setSuggestions(parsed)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError((e as Error).message)
      setSuggestions([])
    } finally {
      if (!controller.signal.aborted) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.trim().length < MIN_CHARS) { setSuggestions([]); return }
    setIsLoading(true)
    timerRef.current = setTimeout(() => { void search(query) }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { query, setQuery, suggestions, isLoading, error }
}
