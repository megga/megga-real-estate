// MEGGA X — Adresse FRANÇAISE avec suggestions.
//
// Pendant exact de MxAddressAutocomplete, sur la Base Adresse Nationale
// (`useFrenchAddress`, ~200 ms, sans clé). Deux composants et non un seul avec un
// drapeau `country` : un hook ne peut pas être appelé conditionnellement, et
// c'est l'appelant — StepAgence — qui monte l'un ou l'autre selon le pays du
// siège.
//
// ⚠ Aucun canton n'est rendu, et ce n'est pas un manque : la France n'en a pas.
// La ligne secondaire montre le département (« 75, Paris… »), qui sert à
// départager deux rues homonymes mais ne remplit aucun champ.

import MxSuggestField, { type MxSuggestLabels } from './MxSuggestField'
import { useFrenchAddress, type FrenchAddressSuggestion } from '@/hooks/useFrenchAddress'

interface Props {
  id?: string
  value: string
  onChange: (address: string) => void
  /** Suggestion retenue : porte aussi code postal et commune. */
  onSelect: (suggestion: FrenchAddressSuggestion) => void
  disabled?: boolean
  labels: MxSuggestLabels
}

/** Seuil du hook (`MIN_CHARS`), repris ici pour que la liste n'ouvre pas avant lui. */
const MIN_CHARS = 3

export default function MxFrenchAddressField({
  id, value, onChange, onSelect, disabled, labels,
}: Props) {
  const { query, setQuery, suggestions, isLoading, error } = useFrenchAddress(value)

  return (
    <MxSuggestField
      id={id}
      value={query}
      onChange={(v) => { setQuery(v); onChange(v) }}
      items={suggestions.map((s) => ({
        key: s.id,
        primary: s.street,
        secondary: `${s.postalCode} ${s.city}`,
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
