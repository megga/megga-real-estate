// MEGGA X — Raison sociale cherchée au registre du commerce suisse.
//
// Branché sur `useZefixCompany` (LINDAS / graphe Zefix, sans clé). Choisir un
// résultat remplit la raison sociale ET le numéro de registre d'un seul geste.
//
// ⚠ RECHERCHE SUR GESTE, PAS À LA FRAPPE — et ce n'est pas le même composant
// qu'un typeahead pour cette raison. Le registre met 1,3 à 5,2 s à répondre à une
// recherche par NOM (mesures en tête de useZefixCompany.ts), et le cas le plus
// COURANT — un nom presque complet — est le plus lent, faute d'index. Une liste
// qui s'ouvrirait 4 s après la frappe serait pire que pas de liste : l'agent
// aurait déjà tapé la suite. Le bouton dit donc ce que l'attente vaut, et
// l'attente est annoncée à l'écran pendant qu'elle dure.
//
// La saisie libre reste première : un agent qui connaît sa raison sociale la tape
// et n'appuie sur rien. La recherche est une aide, jamais un passage obligé — le
// registre ne couvre d'ailleurs pas les entités non inscrites.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useZefixCompany, ZEFIX_MIN_CHARS, type ZefixCompany } from '@/hooks/useZefixCompany'

export interface MxCompanyLabels {
  /** Action qui déclenche l'interrogation du registre. */
  search: string
  /** Affiché pendant l'attente — elle dure des secondes, elle doit se voir. */
  searching: string
  /** Le registre n'a rien pour cette raison sociale. */
  noResults: string
  /** Le registre n'a pas répondu. */
  error: string
  /** Nom accessible de la liste de résultats. */
  listLabel: string
}

interface Props {
  /** Posé sur le champ, relié au <label> de MxField. */
  id?: string
  /** Raison sociale courante. Contrôlée par l'appelant, comme tout ce wizard. */
  value: string
  onChange: (legalName: string) => void
  /** Résultat retenu : porte aussi l'IDE, que l'appelant pose sur son champ registre. */
  onSelect: (company: ZefixCompany) => void
  disabled?: boolean
  labels: MxCompanyLabels
}

export default function MxCompanySearch({
  id, value, onChange, onSelect, disabled, labels,
}: Props) {
  const { results, isSearching, error, searched, search, reset } = useZefixCompany()
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(-1)

  const assezLong = value.trim().length >= ZEFIX_MIN_CHARS

  const lancer = () => {
    if (!assezLong || isSearching || disabled) return
    setOuvert(true)
    setActif(-1)
    void search(value)
  }

  const choisir = (c: ZefixCompany) => {
    setOuvert(false)
    setActif(-1)
    onSelect(c)
  }

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOuvert(false); setActif(-1); return }
    // Entrée déclenche la recherche tant qu'aucune ligne n'est surlignée, et la
    // valide ensuite. `preventDefault` dans les deux cas : sans lui, Entrée
    // soumettrait le formulaire au lieu d'interroger le registre.
    if (e.key === 'Enter') {
      e.preventDefault()
      if (actif >= 0 && actif < results.length) choisir(results[actif])
      else lancer()
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)) }
  }

  // Une liste ne s'affiche qu'après une recherche RÉELLE : avant, il n'y a rien à
  // dire, et un cadre vide se lirait comme un échec.
  const listeVisible = ouvert && !disabled && (isSearching || searched)

  return (
    <div className="mx-suggest">
      {/* La loupe vit DANS la pilule, à droite, comme le glyphe du calendrier :
          une tuile séparée à côté du champ pesait autant que lui pour une action
          secondaire. Le champ réserve la place par un padding droit ; le bouton
          est en absolu, donc il ne pousse rien. */}
      <div className="mx-suggest__row">
        <input
          id={id}
          className="input w-input mx-suggest__input"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            // La saisie périme le résultat précédent : garder une liste qui
            // répond à un autre nom inviterait à choisir la mauvaise société.
            if (searched) { reset(); setOuvert(false) }
          }}
          onKeyDown={auClavier}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="mx-suggest__action"
          onClick={lancer}
          disabled={!assezLong || isSearching || disabled}
          // Le libellé n'est plus écrit : c'est `aria-label` qui porte seul le nom
          // de l'action, et il change pendant l'attente pour que le geste reste
          // annonçable sans regarder. `aria-busy` dit l'état, le titre l'explique
          // au survol — la loupe seule ne dit pas QUEL registre est interrogé.
          aria-label={isSearching ? labels.searching : labels.search}
          title={isSearching ? labels.searching : labels.search}
          aria-busy={isSearching || undefined}
        >
          <LoupeGlyph />
        </button>
      </div>

      {/* L'attente se dit DANS la liste, pas sur la loupe : le bouton n'a plus de
          texte, et une recherche qui dure des secondes ne peut pas n'être qu'un
          bouton grisé. */}
      {listeVisible && (
        <div className="mx-suggest__list card" role="listbox" aria-label={labels.listLabel}>
          {isSearching && (
            // `role="status"` : l'attente se compte en secondes, elle doit
            // s'entendre autant qu'elle se voit.
            <p className="mx-suggest__empty paragraph-small text-color-neutral-600" role="status">
              {labels.searching}
            </p>
          )}

          {!isSearching && results.map((c, i) => (
            <button
              key={c.uid + c.name}
              type="button"
              role="option"
              aria-selected={i === actif}
              className={cn('mx-suggest__option', i === actif && 'mx-suggest__option--active')}
              onMouseDown={(e) => { e.preventDefault(); choisir(c) }}
              onMouseEnter={() => setActif(i)}
            >
              <span className="display-1 medium">{c.name}</span>
              <span className="paragraph-small text-color-neutral-600">
                {c.uidFormatted}{c.municipality ? ` · ${c.municipality}` : ''}
              </span>
            </button>
          ))}

          {!isSearching && results.length === 0 && (
            <p className="mx-suggest__empty paragraph-small text-color-neutral-600" role="status">
              {error != null ? labels.error : labels.noResults}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Loupe dessinée ici : la fonte d'icônes de la vitrine n'a pas de glyphe de recherche attesté. */
function LoupeGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}
