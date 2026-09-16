/**
 * Champs d'identité partagés par la fiche express (`NewContactModal`) et la fenêtre
 * d'identité de la fiche contact (`CdIdentityModal`) : la date de naissance avec son
 * calendrier, l'adresse avec les suggestions du registre fédéral.
 *
 * Sortis de `NewContactModal` le 16.09.2026, quand la fiche contact les a demandés à son
 * tour (« le calendrier, et l'adresse automatique quand on tape ») : deux copies auraient
 * divergé à la première retouche. Chaque écran garde SA peau — il passe sa palette
 * (`PaletteChamps`) et le style de sa case (`styleChamp`).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { format } from 'date-fns'
import { NcvIcon } from '@/components/crm/contacts-pager/ncvIcon'
import { formatSwissDate, parseSwissDate } from '@/lib/contactIdentity'
import { dfLocale } from '@/lib/utils'
import { compareIso, daysInMonth, fromIso, leadingBlanks, toIso } from '@/lib/calendrierMois'
import { useSwissAddress, type SwissAddressSuggestion } from '@/hooks/useSwissAddress'

/** Les couleurs dont les deux champs ont besoin, tirées de la palette de l'écran hôte. */
export interface PaletteChamps {
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  accent: string
  onAccent: string
  /** Fond des listes déroulantes du calendrier et de la suggestion survolée. */
  surfaceDouce: string
  popoverBg: string
  popoverBorder: string
  popoverShadow: string
}

/** Libellés du calendrier (clés `onboarding:wizard.date.*` chez les deux appelants). */
export interface DateLabels { open: string; previousMonth: string; nextMonth: string; month: string; year: string }

/**
 * Date de naissance : la case se TAPE (JJ.MM.AAAA), et un calendrier s'ouvre au
 * besoin depuis le bouton de droite (16.09.2026, « l'option avec le calendrier,
 * comme dans l'onboarding »).
 *
 * ⚠ LA SAISIE CLAVIER RESTE LA VOIE RAPIDE, d'où un champ et non le bouton seul de
 * `MxDatePicker` : un agent qui a la pièce d'identité sous les yeux tape huit
 * chiffres plus vite qu'il ne déroule des années. Le calendrier sert quand on ne
 * sait plus dans quel ordre écrire, ou pour vérifier le jour de la semaine.
 *
 * ⚠ FLOTTANT ICI, DÉPLIÉ DANS L'ONBOARDING. `MxDatePicker` se déplie dans le flux
 * parce que sa carte (`backdrop-filter` + `overflow: hidden`) rognerait un popover.
 * Le panneau de la fiche express n'a ni l'un ni l'autre, et un calendrier déplié
 * pousserait tout le compartiment vers le bas. Il se referme au choix d'un jour,
 * au clic dehors et sur Échap. Le calcul de grille est PARTAGÉ (`calendrierMois`).
 */
export function ChampDateNaissance({ pal, styleChamp, classeChamp, classeBouton, ancrage = 'droite', value, onChange, invalid, placeholder, labels, champ }: {
  pal: PaletteChamps
  /** Bord de la case auquel le calendrier s'accroche : `gauche` quand la case est en première colonne. */
  ancrage?: 'gauche' | 'droite'
  /** Style de la case selon qu'elle a le focus. L'anneau d'erreur est à la charge de l'appelant (`invalid`). */
  styleChamp: (focus: boolean) => CSSProperties
  /** Classes posées par l'écran hôte (anneau de focus en CSS, par exemple). */
  classeChamp?: string
  classeBouton?: string
  /** Saisie JJ.MM.AAAA, telle que l'agent la tape. */
  value: string
  onChange: (v: string) => void
  invalid: boolean
  placeholder: string
  labels: DateLabels
  /** Posé en `data-champ` sur la case, pour qu'on puisse y ramener le focus. */
  champ?: string
}) {
  const locale = dfLocale()
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const boiteRef = useRef<HTMLDivElement>(null)
  const champRef = useRef<HTMLInputElement>(null)
  const grilleRef = useRef<HTMLDivElement>(null)
  const maintenant = new Date()
  // Borne haute : aujourd'hui. Une naissance future n'existe pas, et `parseSwissDate` la refuse.
  const max = toIso(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  const choisie = parseSwissDate(value)
  const [vue, setVue] = useState({ y: maintenant.getFullYear(), m: maintenant.getMonth() })

  // Même mécanique que `MxDatePicker` : une ref et un effet, jamais rAF (suspendu
  // dans un onglet caché), pour poser le focus sur le jour visé aux flèches.
  const focusVoulu = useRef<string | null>(null)
  useEffect(() => {
    const iso = focusVoulu.current
    if (iso == null) return
    focusVoulu.current = null
    grilleRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus()
  })

  useEffect(() => {
    if (!open) return
    const dehors = (e: MouseEvent) => { if (!boiteRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [open])

  const nomsMois = useMemo(
    () => Array.from({ length: 12 }, (_, i) => format(new Date(2021, i, 1), 'LLLL', { locale })),
    [locale],
  )
  const nomsJours = useMemo(
    () => Array.from({ length: 7 }, (_, i) => format(new Date(2021, 0, 4 + i), 'EEEEEE', { locale })),
    [locale],
  )
  // De la plus récente à la plus ancienne : une naissance se cherche vers le passé.
  const annees = useMemo(() => {
    const haut = new Date().getFullYear()
    return Array.from({ length: 121 }, (_, i) => haut - i)
  }, [])

  const ouvrir = () => {
    // Le calendrier montre la date TAPÉE quand elle est valide ; sinon le mois courant.
    const base = fromIso(choisie)
    if (base) setVue({ y: base.y, m: base.m })
    setOpen(true)
  }
  const fermer = () => { setOpen(false); champRef.current?.focus() }
  const decaler = (delta: number) => {
    const d = new Date(vue.y, vue.m + delta, 1)
    setVue({ y: d.getFullYear(), m: d.getMonth() })
  }
  const choisir = (jour: number) => {
    onChange(formatSwissDate(toIso(vue.y, vue.m, jour)))
    fermer()
  }
  const onClavierJour = (e: React.KeyboardEvent, jour: number) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); decaler(e.key === 'PageUp' ? -1 : 1); return }
    const delta = deltas[e.key]
    if (delta === undefined) return
    e.preventDefault()
    const cible = new Date(vue.y, vue.m, jour + delta)
    setVue({ y: cible.getFullYear(), m: cible.getMonth() })
    focusVoulu.current = toIso(cible.getFullYear(), cible.getMonth(), cible.getDate())
  }

  const vides = leadingBlanks(vue.y, vue.m)
  const total = daysInMonth(vue.y, vue.m)
  const selectStyle: CSSProperties = { height: 32, border: 0, borderRadius: 'var(--crm-radius-md)', background: pal.surfaceDouce, color: pal.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, padding: '0 var(--crm-space-sm)', cursor: 'pointer', textTransform: 'capitalize' }
  const navStyle: CSSProperties = { width: 32, height: 32, flexShrink: 0, border: 0, borderRadius: 'var(--crm-radius-pill)', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }

  return (
    <div
      ref={boiteRef}
      style={{ position: 'relative' }}
      // ⚠ On MARQUE l'Échap du calendrier : sinon le piège de focus de la modale le
      // verrait aussi et fermerait la fiche entière.
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); fermer() } }}
    >
      <input
        ref={champRef}
        data-champ={champ}
        className={classeChamp}
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ ...styleChamp(focus), padding: '0 var(--crm-space-6xl) 0 var(--crm-space-xl)' }}
      />
      <button
        type="button"
        className={classeBouton}
        onClick={() => (open ? fermer() : ouvrir())}
        aria-label={labels.open}
        title={labels.open}
        aria-expanded={open}
        style={{ ...navStyle, position: 'absolute', right: 'var(--crm-space-2xs)', top: 'var(--crm-space-2xs)', background: open ? pal.surfaceDouce : 'transparent' }}
      >
        <NcvIcon name="calendar" size={16} stroke={open ? pal.ink : pal.muted} sw={1.8} />
      </button>

      {open && (
        <div role="group" aria-label={labels.open} style={{ position: 'absolute', top: 'calc(100% + var(--crm-space-sm))', ...(ancrage === 'gauche' ? { left: 0 } : { right: 0 }), zIndex: 60, width: 288, maxWidth: 'calc(100vw - var(--crm-space-6xl))', background: pal.popoverBg, border: `1px solid ${pal.popoverBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: pal.popoverShadow, padding: 'var(--crm-space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)' }}>
            <button type="button" className={classeBouton} onClick={() => decaler(-1)} aria-label={labels.previousMonth} style={navStyle}>
              <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(90deg)' }}><NcvIcon name="chevron" size={14} stroke={pal.inkSoft} sw={2.2} /></span>
            </button>
            <div style={{ flex: 1, display: 'flex', gap: 'var(--crm-space-xs)', justifyContent: 'center' }}>
              <select value={vue.m} onChange={(e) => setVue((v) => ({ ...v, m: Number(e.target.value) }))} aria-label={labels.month} style={selectStyle}>
                {nomsMois.map((nom, i) => <option key={nom} value={i}>{nom}</option>)}
              </select>
              <select value={vue.y} onChange={(e) => setVue((v) => ({ ...v, y: Number(e.target.value) }))} aria-label={labels.year} style={selectStyle}>
                {annees.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <button type="button" className={classeBouton} onClick={() => decaler(1)} aria-label={labels.nextMonth} style={navStyle}>
              <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(-90deg)' }}><NcvIcon name="chevron" size={14} stroke={pal.inkSoft} sw={2.2} /></span>
            </button>
          </div>

          <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: pal.muted, textTransform: 'capitalize' }}>
            {nomsJours.map((j, i) => <span key={i}>{j}</span>)}
          </div>

          <div ref={grilleRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--crm-space-2xs)' }}>
            {Array.from({ length: vides }, (_, i) => <span key={`v${i}`} aria-hidden="true" />)}
            {Array.from({ length: total }, (_, i) => {
              const jour = i + 1
              const iso = toIso(vue.y, vue.m, jour)
              const actif = choisie === iso
              const futur = compareIso(iso, max) > 0
              const aujourdhui = iso === max
              return (
                <button
                  key={jour}
                  type="button"
                  className={classeBouton}
                  data-iso={iso}
                  onClick={() => choisir(jour)}
                  onKeyDown={(e) => onClavierJour(e, jour)}
                  disabled={futur}
                  aria-pressed={actif}
                  // Un seul jour dans l'ordre de tabulation : la grille se parcourt aux flèches.
                  tabIndex={actif || (!choisie && jour === 1) ? 0 : -1}
                  style={{
                    height: 34, border: 0, borderRadius: 'var(--crm-radius-pill)', fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-md)', fontWeight: actif ? 600 : 500,
                    background: actif ? pal.accent : 'transparent',
                    color: actif ? pal.onAccent : futur ? pal.ghost : pal.ink,
                    boxShadow: aujourdhui && !actif ? `inset 0 0 0 1px ${pal.muted}` : 'none',
                    cursor: futur ? 'not-allowed' : 'pointer',
                  }}
                >
                  {jour}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Adresse avec les suggestions du registre fédéral des bâtiments (16.09.2026, « comme
 * dans l'onboarding »). MÊME SOURCE que `MxAddressAutocomplete` — `useSwissAddress`,
 * geo.admin.ch, service public sans clé — et une autre peau : celle de l'onboarding
 * vit sous `.megga-x`, dont les classes n'existent pas dans le CRM.
 *
 * ⚠ LA SAISIE LIBRE RESTE ENTIÈRE. Un immeuble neuf peut manquer au registre, une
 * adresse de domicile peut être à l'étranger : la liste propose, elle n'impose rien,
 * et ne dit rien quand elle n'a rien — pas de « aucune adresse trouvée » en plus.
 * Elle s'ouvre à la frappe, se referme au choix, à la sortie du champ et sur Échap.
 */
export function ChampAdresseSuisse({ pal, styleChamp, classeChamp, value, onChange, format, placeholder, listLabel, champ }: {
  pal: PaletteChamps
  /** Style de la case selon qu'elle a le focus. */
  styleChamp: (focus: boolean) => CSSProperties
  classeChamp?: string
  value: string
  onChange: (v: string) => void
  /** Ce qu'une suggestion retenue écrit dans la case. */
  format: (s: SwissAddressSuggestion) => string
  placeholder?: string
  listLabel: string
  /** Posé en `data-champ`, pour qu'on puisse y ramener le focus. */
  champ?: string
}) {
  const { setQuery, suggestions } = useSwissAddress(value)
  const [ouvert, setOuvert] = useState(false)
  const [focus, setFocus] = useState(false)
  const [hi, setHi] = useState(0)
  const visible = ouvert && suggestions.length > 0

  const choisir = (s?: SwissAddressSuggestion) => {
    if (!s) return
    const texte = format(s)
    onChange(texte)
    // La recherche suit la valeur retenue, mais la liste reste FERMÉE : sans `ouvert`
    // à faux, l'adresse choisie relancerait sa propre suggestion sous la case.
    setQuery(texte)
    setOuvert(false)
    setHi(0)
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(suggestions[hi]) }
    // ⚠ MARQUÉ seulement quand une liste est ouverte : sinon Échap doit fermer la fiche.
    else if (e.key === 'Escape') { e.preventDefault(); setOuvert(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={classeChamp}
        data-champ={champ}
        autoComplete="off"
        role="combobox"
        aria-expanded={visible}
        aria-autocomplete="list"
        value={value}
        onChange={(e) => { onChange(e.target.value); setQuery(e.target.value); setOuvert(true); setHi(0) }}
        onKeyDown={onKey}
        onFocus={() => setFocus(true)}
        onBlur={() => { setOuvert(false); setFocus(false) }}
        placeholder={placeholder}
        style={styleChamp(focus)}
      />
      {visible && (
        <div role="listbox" aria-label={listLabel} style={{ position: 'absolute', top: 'calc(100% + var(--crm-space-sm))', left: 0, right: 0, zIndex: 50, maxHeight: 264, overflowY: 'auto', background: pal.popoverBg, border: `1px solid ${pal.popoverBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: pal.popoverShadow, padding: 'var(--crm-space-xs)' }}>
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={i === hi}
              tabIndex={-1}
              onMouseEnter={() => setHi(i)}
              // `mousedown` + preventDefault : le champ garde le focus, son `onBlur` ne
              // referme pas la liste avant que le choix soit pris.
              onMouseDown={(e) => { e.preventDefault(); choisir(s) }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: i === hi ? pal.surfaceDouce : 'transparent' }}
            >
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: pal.ink }}>{s.street}</span>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: pal.muted }}>{`${s.postalCode} ${s.city}${s.canton ? ` · ${s.canton}` : ''}`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
