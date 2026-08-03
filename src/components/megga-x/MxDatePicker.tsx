// MEGGA X — Sélecteur de date : champ + calendrier, à la peau de la vitrine.
//
// POURQUOI IL EXISTE. `<input type="date">` délègue son calendrier au
// NAVIGATEUR : sur Chrome c'est la direction artistique de Google (Roboto,
// bleu Material, coins Material) qui s'ouvre au milieu d'un parcours noir en
// Inter Tight, et rien en CSS ne peut la retoucher — le widget vit dans le
// shadow DOM de l'agent utilisateur. Sur Safari et Firefox, c'est une troisième
// et une quatrième apparence. Ce composant reprend la main dessus.
//
// ⚠ CALENDRIER DÉPLIÉ, JAMAIS FLOTTANT, et ce n'est pas un choix esthétique.
// Mesuré le 3 août 2026 : la carte qui porte les champs (`.card.sign-in-card`)
// a `backdrop-filter: blur(5px)`, ce qui en fait le BLOC CONTENEUR de tout
// descendant `position: fixed` (sonde fixed posée à 0,0 : elle atterrit à
// l'origine de la carte, pas de la fenêtre) — et la même carte porte
// `overflow: hidden`. Un popover y serait donc ancré à la carte ET rogné par
// elle. Le déplier dans le flux évite la question entière : rien à ancrer, rien
// à rogner, et il défile naturellement avec `.mx-scrollarea`. Même famille de
// piège que celui documenté en tête de MxModal.tsx.
//
// COPIE : aucune chaîne en dur ici. Les libellés arrivent par `labels`, comme
// `closeLabel` de MxModal — ce dossier est un catalogue d'atomes, la traduction
// appartient à l'appelant. Seuls les noms de mois et de jours viennent de
// date-fns via `dfLocale()` : ce sont des données de calendrier, pas de la copie
// produit, et les redéclarer dans les 4 fichiers de langue les ferait diverger.

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { cn, dfLocale } from '@/lib/utils'

export interface MxDatePickerLabels {
  /** Nom accessible du bouton qui ouvre le calendrier. */
  open: string
  /** Texte du champ tant qu'aucune date n'est choisie. */
  placeholder: string
  previousMonth: string
  nextMonth: string
  /** Nom accessible du sélecteur de mois. */
  month: string
  /** Nom accessible du sélecteur d'année. */
  year: string
  /** Action qui vide le champ. */
  clear: string
}

interface Props {
  /** Posé sur le contrôle, relié au <label> de MxField. */
  id?: string
  /** Date en ISO `YYYY-MM-DD`, ou null. Même contrat que l'input natif remplacé. */
  value: string | null
  onChange: (iso: string | null) => void
  /** Bornes ISO incluses. `max` sert à interdire une naissance dans le futur. */
  min?: string
  max?: string
  disabled?: boolean
  labels: MxDatePickerLabels
}

/**
 * ISO `YYYY-MM-DD` depuis des composantes LOCALES.
 *
 * ⚠ Jamais `toISOString()` : il convertit en UTC, donc le 15 mai à minuit
 * heure locale ressort « 1980-05-14T22:00Z » et la date perd un jour dès qu'on
 * est à l'est de Greenwich. Une date de naissance n'a pas d'instant — elle ne
 * traverse aucun fuseau. Même raisonnement que `birthDate()` du récapitulatif.
 */
function toIso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** L'inverse, tout aussi local : `new Date('1980-05-15')` parserait en UTC. */
function fromIso(iso: string | null): { y: number; m: number; d: number } | null {
  if (!iso) return null
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!parts) return null
  return { y: Number(parts[1]), m: Number(parts[2]) - 1, d: Number(parts[3]) }
}

/** Jours du mois — `new Date(y, m + 1, 0)` donne le dernier jour du mois `m`. */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate()
}

/**
 * Rang du 1er du mois dans une semaine qui commence LUNDI (0 = lundi).
 * `getDay()` compte à partir de dimanche : le décalage suisse est donc `+6 % 7`.
 */
function leadingBlanks(y: number, m: number): number {
  return (new Date(y, m, 1).getDay() + 6) % 7
}

/** Comparaison de dates-seules, sans jamais construire d'instant. */
function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export default function MxDatePicker({
  id, value, onChange, min, max, disabled, labels,
}: Props) {
  const locale = dfLocale()
  const selected = fromIso(value)
  const [open, setOpen] = useState(false)
  // Mois affiché. Ouvre sur la date choisie si elle existe, sinon sur la borne
  // haute (pour une naissance : le mois courant), jamais sur un mois arbitraire.
  const fallback = fromIso(max ?? null) ?? (() => {
    const now = new Date()
    return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() }
  })()
  const [view, setView] = useState(() => ({ y: (selected ?? fallback).y, m: (selected ?? fallback).m }))
  const gridRef = useRef<HTMLDivElement>(null)

  /**
   * Jour à focaliser une fois la grille re-rendue (navigation aux flèches).
   *
   * Une ref et un effet, JAMAIS `requestAnimationFrame` : rAF est suspendu tant
   * que le document n'est pas visible (onglet en arrière-plan, fenêtre masquée),
   * si bien que le focus ne se déplaçait tout simplement pas — constaté ici même
   * le 3 août 2026, sur un volet de prévisualisation caché. Un effet, lui, court
   * après CHAQUE commit, visible ou non. Une ref plutôt qu'un état : rien à
   * afficher, et remettre l'état à null depuis le corps d'un effet déclencherait
   * un rendu en cascade (react-hooks/set-state-in-effect).
   */
  const focusVoulu = useRef<string | null>(null)
  useEffect(() => {
    const iso = focusVoulu.current
    if (iso == null) return
    focusVoulu.current = null
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus()
  })

  // Noms de mois et de jours dans la langue courante. Les dates de référence
  // sont arbitraires : seul le rang compte (2021-01-04 est un lundi).
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2021, i, 1), 'LLLL', { locale })),
    [locale],
  )
  const weekdayNames = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(new Date(2021, 0, 4 + i), 'EEEEEE', { locale })),
    [locale],
  )

  // Années proposées, de la plus récente à la plus ancienne : une date de
  // naissance se cherche vers le passé, l'ordre inverse ferait dérouler 120 ans
  // avant d'atteindre un choix plausible.
  const years = useMemo(() => {
    const hi = fromIso(max ?? null)?.y ?? new Date().getFullYear()
    const lo = fromIso(min ?? null)?.y ?? hi - 120
    return Array.from({ length: hi - lo + 1 }, (_, i) => hi - i)
  }, [min, max])

  const isOutOfRange = (iso: string) => (
    (min != null && compareIso(iso, min) < 0) || (max != null && compareIso(iso, max) > 0)
  )

  const shiftMonth = (delta: number) => {
    const next = new Date(view.y, view.m + delta, 1)
    setView({ y: next.getFullYear(), m: next.getMonth() })
  }

  const choose = (day: number) => {
    onChange(toIso(view.y, view.m, day))
    setOpen(false)
  }

  /**
   * Clavier de la grille : flèches d'un jour ou d'une semaine, PageUp/PageDown
   * d'un mois, Échap referme. Sans ça le calendrier serait une régression
   * d'accessibilité face à l'input natif, qui se pilote entièrement au clavier.
   */
  const onGridKeyDown = (e: React.KeyboardEvent, day: number) => {
    const deltas: Record<string, number> = {
      ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
    }
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      shiftMonth(e.key === 'PageUp' ? -1 : 1)
      return
    }
    const delta = deltas[e.key]
    if (delta === undefined) return
    e.preventDefault()
    // `new Date(y, m, day + delta)` reporte tout seul d'un mois à l'autre : le
    // 1er mars moins un jour donne le 28 ou le 29 février selon l'année, sans
    // que ce composant ait à connaître les années bissextiles.
    const target = new Date(view.y, view.m, day + delta)
    setView({ y: target.getFullYear(), m: target.getMonth() })
    // Le focus suit le jour visé, une fois la grille du mois cible rendue.
    focusVoulu.current = toIso(target.getFullYear(), target.getMonth(), target.getDate())
  }

  const blanks = leadingBlanks(view.y, view.m)
  const total = daysInMonth(view.y, view.m)

  return (
    <div className="mx-datepicker">
      <div className="mx-datepicker__row">
        <button
          type="button"
          id={id}
          className="input mx-datefield"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          aria-expanded={open}
          aria-label={labels.open}
        >
          <span className={cn(!value && 'mx-datefield__placeholder')}>
            {/* Format suisse à l'affichage, ISO en valeur — règle §6 du CLAUDE.md.
                Reconstruit à la main plutôt que par formatDate() : cette dernière
                passe par `new Date(iso)`, qui parse en UTC et rend la VEILLE sous
                tout fuseau négatif. */}
            {selected ? `${String(selected.d).padStart(2, '0')}.${String(selected.m + 1).padStart(2, '0')}.${selected.y}` : labels.placeholder}
          </span>
          <CalendarGlyph />
        </button>
        {/* Vider reste possible, comme sur l'input natif : la colonne est
            nullable et une date saisie par erreur doit pouvoir s'annuler. */}
        {value != null && !disabled && (
          <button type="button" className="mx-datefield__clear" onClick={() => onChange(null)} aria-label={labels.clear}>
            <ClearGlyph />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="mx-datepicker__panel card" role="group" aria-label={labels.open}>
          <div className="mx-datepicker__head">
            <button type="button" className="mx-datepicker__nav" onClick={() => shiftMonth(-1)} aria-label={labels.previousMonth}>
              <ChevronGlyph direction="left" />
            </button>
            <div className="mx-datepicker__selects">
              <select
                className="mx-datepicker__select"
                value={view.m}
                onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
                aria-label={labels.month}
              >
                {monthNames.map((name, i) => <option key={name} value={i}>{name}</option>)}
              </select>
              <select
                className="mx-datepicker__select"
                value={view.y}
                onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
                aria-label={labels.year}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button type="button" className="mx-datepicker__nav" onClick={() => shiftMonth(1)} aria-label={labels.nextMonth}>
              <ChevronGlyph direction="right" />
            </button>
          </div>

          <div className="mx-datepicker__weekdays" aria-hidden="true">
            {weekdayNames.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="mx-datepicker__grid" ref={gridRef}>
            {/* Cases vides avant le 1er : `aria-hidden`, elles ne sont pas des jours. */}
            {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
            {Array.from({ length: total }, (_, i) => {
              const day = i + 1
              const iso = toIso(view.y, view.m, day)
              const isSelected = value === iso
              const disabledDay = isOutOfRange(iso)
              return (
                <button
                  key={day}
                  type="button"
                  data-iso={iso}
                  className={cn('mx-datepicker__day', isSelected && 'mx-datepicker__day--selected')}
                  onClick={() => choose(day)}
                  onKeyDown={(e) => onGridKeyDown(e, day)}
                  disabled={disabledDay}
                  aria-pressed={isSelected}
                  // Un seul jour dans l'ordre de tabulation (tabindex roving) :
                  // la grille se parcourt aux flèches, pas en 31 tabulations.
                  tabIndex={isSelected || (!value && day === 1) ? 0 : -1}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** Glyphes dessinés ici : la fonte d'icônes de la vitrine n'a ni calendrier ni chevron attestés. */
function CalendarGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

function ChevronGlyph({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}

function ClearGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}
