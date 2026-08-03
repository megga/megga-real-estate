// MEGGA X — Raison sociale FRANÇAISE, cherchée au registre à la frappe.
//
// Pendant de MxCompanySearch (Suisse) — mais avec une interaction DIFFÉRENTE, et
// c'est mesuré, pas décoré : l'API française répond en 150 à 770 ms sans se
// dégrader quand on précise, là où LINDAS met 1,3 à 5,2 s et empire avec un
// préfixe plus long (chiffres en tête des deux hooks). La France peut donc
// suggérer à la frappe ; la Suisse a besoin d'un geste explicite. Une même
// interaction des deux côtés aurait forcément trahi l'une des deux.
//
// Un résultat retenu remplit la raison sociale ET le SIREN, comme le suisse
// remplit l'IDE.

import MxSuggestField, { type MxSuggestLabels } from './MxSuggestField'
import { useFrenchCompany, type FrenchCompany } from '@/hooks/useFrenchCompany'

export interface MxFrenchCompanyLabels extends MxSuggestLabels {
  /** Mention portée par une société radiée du registre. */
  inactive: string
}

interface Props {
  id?: string
  value: string
  onChange: (legalName: string) => void
  /** Résultat retenu : porte aussi le SIREN, que l'appelant pose sur son champ registre. */
  onSelect: (company: FrenchCompany) => void
  disabled?: boolean
  labels: MxFrenchCompanyLabels
}

/** Seuil du hook (`MIN_CHARS`), repris ici pour que la liste n'ouvre pas avant lui. */
const MIN_CHARS = 3

export default function MxFrenchCompanyField({
  id, value, onChange, onSelect, disabled, labels,
}: Props) {
  const { query, setQuery, suggestions, isLoading, error } = useFrenchCompany(value)

  return (
    <MxSuggestField
      id={id}
      value={query}
      onChange={(v) => { setQuery(v); onChange(v) }}
      items={suggestions.map((c) => ({
        key: c.siren,
        primary: c.name,
        secondary: `${c.sirenFormatted}${c.city ? ` · ${c.city}` : ''}`,
        // Une société radiée reste PROPOSÉE, mais dite comme telle : la masquer
        // laisserait croire qu'elle n'a jamais existé, alors qu'une reprise
        // d'activité ou une vérification peuvent légitimement la viser.
        // C'est ce que le registre suisse ne permet pas de faire — LINDAS ne
        // porte pas le statut actif/radié.
        tag: c.active ? undefined : labels.inactive,
      }))}
      isLoading={isLoading}
      error={error}
      onSelect={(i) => { const c = suggestions[i]; setQuery(c.name); onSelect(c) }}
      disabled={disabled}
      minChars={MIN_CHARS}
      labels={labels}
    />
  )
}
