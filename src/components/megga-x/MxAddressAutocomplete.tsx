// MEGGA X — Adresse SUISSE avec suggestions.
//
// Branché sur `useSwissAddress` (geo.admin.ch : registre fédéral des adresses,
// service public, AUCUNE clé — ce qui le rend utilisable là où Mapbox ne l'est
// pas, issue #1061). ~300 ms, donc suggestions à la frappe.
//
// La mécanique de combobox vit dans `MxSuggestField` : ce fichier ne fait que
// tenir le hook et traduire ses résultats en lignes. C'est aussi ce que la règle
// des hooks impose — on ne peut pas choisir `useSwissAddress` ou `useFrenchAddress`
// selon le pays à l'intérieur d'un même composant, d'où un composant par source.
//
// Le CRM a déjà un champ équivalent (components/listings/SwissAddressAutocomplete)
// mais écrit avec les jetons Tailwind et `MEIcon`, qui n'existent pas sous
// `.megga-x` : même hook, deux peaux.

import MxSuggestField, { type MxSuggestLabels } from './MxSuggestField'
import { useSwissAddress, type SwissAddressSuggestion } from '@/hooks/useSwissAddress'

export type MxAddressLabels = MxSuggestLabels

interface Props {
  id?: string
  /** Adresse courante (rue + numéro). Contrôlée par l'appelant. */
  value: string
  /** Frappe libre — le registre peut ignorer une adresse trop récente. */
  onChange: (address: string) => void
  /** Suggestion retenue : porte aussi NPA, ville et canton, que l'appelant répartit. */
  onSelect: (suggestion: SwissAddressSuggestion) => void
  disabled?: boolean
  labels: MxAddressLabels
}

/** Seuil du hook (`MIN_CHARS`), repris ici pour que la liste n'ouvre pas avant lui. */
const MIN_CHARS = 3

export default function MxAddressAutocomplete({
  id, value, onChange, onSelect, disabled, labels,
}: Props) {
  const { query, setQuery, suggestions, isLoading, error } = useSwissAddress(value)

  return (
    <MxSuggestField
      id={id}
      value={query}
      onChange={(v) => { setQuery(v); onChange(v) }}
      items={suggestions.map((s) => ({
        key: String(s.id),
        primary: s.street,
        secondary: `${s.postalCode} ${s.city}${s.canton ? ` (${s.canton})` : ''}`,
      }))}
      isLoading={isLoading}
      error={error}
      onSelect={(i) => { const s = suggestions[i]; setQuery(s.street); onSelect(s) }}
      disabled={disabled}
      minChars={MIN_CHARS}
      labels={labels}
    />
  )
}
