// MEGGA X — Coquille de champ à suggestions, SANS source de données.
//
// Pourquoi elle existe : l'étape agence porte maintenant quatre champs assistés
// (adresse et raison sociale, en Suisse et en France), qui partagent exactement
// la même mécanique — ouvrir, fermer, flèches, Entrée, Échap, clic extérieur,
// choix à la souris — et RIEN d'autre. Chaque source a sa propre latence, son
// propre format et son propre hook ; recopier la mécanique quatre fois, c'était
// quatre endroits où corriger le prochain défaut de clavier.
//
// La coquille ne connaît donc aucune API : elle reçoit des `items` déjà mis en
// forme et rend `onSelect(index)`. C'est l'appelant qui possède le hook — ce qui
// est aussi une contrainte de React, un hook ne pouvant pas être appelé
// conditionnellement selon le pays.
//
// ⚠ Liste en `position: absolute`, jamais `fixed` : la carte porteuse a
// `backdrop-filter`, qui en ferait le bloc conteneur d'un `fixed`, et son
// `overflow: hidden` le rognerait. Voir le point 12 de megga-x-additions.css.

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Une ligne de la liste, déjà mise en forme par l'appelant. */
export interface MxSuggestItem {
  key: string
  /** Ligne principale — ce que l'agent reconnaît. */
  primary: string
  /** Ligne secondaire : ce qui départage deux homonymes (NPA, commune, SIREN…). */
  secondary?: string
  /** Mention discrète en fin de ligne secondaire (ex. « radiée »). */
  tag?: string
}

export interface MxSuggestLabels {
  placeholder?: string
  /** Aucun résultat pour la saisie en cours. */
  noResults: string
  /** La source n'a pas répondu. */
  error: string
  /** Nom accessible de la liste. */
  listLabel: string
}

interface Props {
  id?: string
  /** Texte saisi. Contrôlé par l'appelant, qui le passe aussi à son hook. */
  value: string
  onChange: (value: string) => void
  items: MxSuggestItem[]
  isLoading: boolean
  error: string | null
  onSelect: (index: number) => void
  disabled?: boolean
  /** En dessous, on n'ouvre rien : la source elle-même ne cherche pas encore. */
  minChars: number
  labels: MxSuggestLabels
}

export default function MxSuggestField({
  id, value, onChange, items, isLoading, error, onSelect, disabled, minChars, labels,
}: Props) {
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(-1)
  const conteneurRef = useRef<HTMLDivElement>(null)
  const listeId = useId()

  // `mousedown` et non `click` : la liste doit disparaître AVANT qu'un clic sur ce
  // qu'elle recouvre ne se déclenche.
  useEffect(() => {
    const dehors = (e: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [])

  const choisir = (i: number) => {
    setOuvert(false)
    setActif(-1)
    onSelect(i)
  }

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOuvert(false); setActif(-1); return }
    if (items.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOuvert(true); setActif((i) => Math.min(i + 1, items.length - 1)); return
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); return }
    // Entrée ne valide QUE si une ligne est surlignée : sinon elle doit laisser le
    // formulaire se comporter normalement, pas choisir à la place de l'agent.
    if (e.key === 'Enter' && actif >= 0 && actif < items.length) {
      e.preventDefault(); choisir(actif)
    }
  }

  const assezLong = value.trim().length >= minChars
  // Rien à dire = pas de cadre. Un panneau vide et muet se lirait comme un échec.
  const aQuelqueChoseADire = items.length > 0 || error != null || (!isLoading && assezLong)
  const listeVisible = ouvert && !disabled && aQuelqueChoseADire

  return (
    <div className="mx-suggest" ref={conteneurRef}>
      <input
        id={id}
        // `input w-input` comme la vitrine : `w-input` porte le `width: 100%`
        // (cf. l'en-tête de MxInput.tsx).
        className="input w-input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOuvert(true); setActif(-1) }}
        onFocus={() => { if (items.length > 0) setOuvert(true) }}
        // Sans risque pour le choix à la souris : les options se valident sur
        // `mousedown` avec `preventDefault`, donc avant que le focus ne bouge.
        onBlur={() => setOuvert(false)}
        onKeyDown={auClavier}
        disabled={disabled}
        placeholder={labels.placeholder}
        // Le remplissage du navigateur poserait SA liste par-dessus celle-ci.
        autoComplete="off"
        role="combobox"
        aria-expanded={listeVisible}
        aria-controls={listeId}
        aria-autocomplete="list"
      />

      {listeVisible && (
        <div className="mx-suggest__list card" id={listeId} role="listbox" aria-label={labels.listLabel}>
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role="option"
              aria-selected={i === actif}
              className={cn('mx-suggest__option', i === actif && 'mx-suggest__option--active')}
              onMouseDown={(e) => { e.preventDefault(); choisir(i) }}
              onMouseEnter={() => setActif(i)}
            >
              <span className="display-1 medium">{it.primary}</span>
              {(it.secondary != null || it.tag != null) && (
                <span className="paragraph-small text-color-neutral-600">
                  {it.secondary}
                  {it.tag != null && <span className="mx-suggest__tag">{it.tag}</span>}
                </span>
              )}
            </button>
          ))}

          {items.length === 0 && (
            <p className="mx-suggest__empty paragraph-small text-color-neutral-600" role="status">
              {error != null ? labels.error : labels.noResults}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
