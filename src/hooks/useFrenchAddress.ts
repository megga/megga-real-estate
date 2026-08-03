/**
 * Autocomplétion d'adresses françaises via la Base Adresse Nationale.
 *
 * <https://api-adresse.data.gouv.fr> — service public, AUCUNE clé, et taillé pour
 * la saisie assistée (l'endpoint `/search` est celui que l'État documente pour
 * l'autocomplétion). Pendant exact de `useSwissAddress` (geo.admin.ch) : même
 * forme de retour, pour que le champ qui les consomme soit le même des deux côtés
 * de la frontière.
 *
 * Latence mesurée le 03.08.2026 : ~200 ms. Le typeahead est donc viable ici — à
 * la différence du registre du commerce SUISSE, qui met des secondes et impose un
 * geste explicite (cf. useZefixCompany.ts).
 *
 * ⚠ Pas de canton dans le retour, et ce n'est pas un oubli : la France n'en a pas.
 * `context` porte le département (« 75, Paris, Île-de-France »), déjà contenu dans
 * le code postal — c'est pourquoi l'étape agence masque la colonne Canton hors de
 * Suisse plutôt que d'y verser un équivalent approximatif.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export interface FrenchAddressSuggestion {
  id: string
  /** Rue et numéro, prêts pour le champ Adresse. */
  street: string
  /** Code postal (5 chiffres). */
  postalCode: string
  city: string
  /** « 75, Paris, Île-de-France » — affiché pour départager deux rues homonymes. */
  context: string
}

interface BanFeature {
  properties: {
    id: string
    label: string
    name?: string
    housenumber?: string
    street?: string
    postcode?: string
    city?: string
    context?: string
    type?: string
  }
}

const API_URL = 'https://api-adresse.data.gouv.fr/search/'
const DEBOUNCE_MS = 250
const MIN_CHARS = 3
const MAX_RESULTS = 8

/**
 * `name` plutôt que `housenumber + street` recomposés : la BAN le rend déjà
 * assemblé et correctement typographié (« 8 Rue de la Paix »), et le recomposer à
 * la main rate les libellés sans numéro, les bis/ter et les lieux-dits.
 */
function parseFeature(f: BanFeature): FrenchAddressSuggestion {
  const p = f.properties
  return {
    id: p.id,
    street: p.name ?? [p.housenumber, p.street].filter(Boolean).join(' '),
    postalCode: p.postcode ?? '',
    city: p.city ?? '',
    context: p.context ?? '',
  }
}

const cache = new Map<string, FrenchAddressSuggestion[]>()

/** Même signature que `useSwissAddress` : `query`/`setQuery` pilotent, `suggestions` en sort. */
export function useFrenchAddress(initialValue = '') {
  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState<FrenchAddressSuggestion[]>([])
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
      const params = new URLSearchParams({ q: trimmed, limit: String(MAX_RESULTS), autocomplete: '1' })
      const res = await fetch(`${API_URL}?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error(`BAN ${res.status}`)
      const data = await res.json() as { features: BanFeature[] }
      // `type: 'housenumber'` d'abord : une adresse complète vaut mieux qu'une rue
      // seule ou une commune, que la BAN renvoie aussi et qui ne remplissent rien.
      const parsed = data.features
        .filter((f) => f.properties.type !== 'municipality')
        .map(parseFeature)
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
