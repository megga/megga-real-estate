// MEGGA CRM — Modale « Nouveau contact » (refonte Contacts Beta, port fidèle).
// Source design : `nc-bento-b-live.jsx` (NcbConceptBLive, concept D « Fiche vivante »)
// + `nc-bento-shared.jsx` + `nc-refonte-shared.jsx` (atomes NCV). Recréée en TSX
// propre : styles inline, police 'Inter Tight', composants au NIVEAU MODULE (hors du
// render) pour éviter la perte de focus des inputs.
//
// Mise en page : UN bento fusionné en TROIS compartiments, sans barre de pied —
// à gauche un « aperçu vivant » (photo, nom, type, méta, actions) qui se remplit
// pendant la saisie ; à droite la « Fiche express », le type en tête, puis deux
// compartiments côte à côte : « Coordonnées » (qui) et les critères ou le bien
// (quoi). Refonte du 16.09.2026 : en une seule colonne, chaque case s'étirait sur
// ~400 px et la note passait sous le pli à 900 px de haut. Sous 720 px de
// formulaire, les deux compartiments s'empilent (requête de conteneur). Le panneau
// reste LE seul élément scrollable. La modale REMPLIT le cadre (props `fill` du
// design) : racine 100%×100%, PAS de portail — l'overlay est posé par le parent
// (ContactsPager). Saisie : focus au prénom, ⌘⏎ / Ctrl⏎ crée, montants regroupés
// par milliers en quittant la case.
//
// Identité LBA : naissance / nationalité / résidence / adresse partent en colonnes
// typées de `contacts` (art. 3 LBA), converties par `identityToColumns()` — jamais
// dans form_data, car elles doivent rester requêtables par le KYC.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type JSX, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type CrmPalette } from '@/components/crm/tokens'
import type { CriteriaInput } from '@/lib/contactCriteria'
import { NcvIcon, type NcvIconName } from '@/components/crm/contacts-pager/ncvIcon'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { encreSur, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import MEIcon from '@/components/propertyx/MEIcon'
import { COUNTRIES, COUNTRY_DIAL_CODES, composePhone, countryForDialCode, dialCodeOptions } from '@/lib/countries'
import { identityToColumns, isInvalidSwissDate } from '@/lib/contactIdentity'
import { formatCHF, formatRent } from '@/lib/utils'
import { grouperMilliers, lireMontant } from '@/lib/montantSaisi'
import type { DuplicateCandidate } from '@/hooks/useContactDuplicates'
import type { ExtractLeadError, ExtractLeadResult } from '@/hooks/useExtractLead'
import { ChampAdresseSuisse, ChampDateNaissance, type PaletteChamps } from '@/components/crm/contacts-pager/ChampsIdentite'

// ═══════════════════════════════════════════════════════════════════════
//   API publique
// ═══════════════════════════════════════════════════════════════════════
export interface NewContactData {
  type: 'buyer' | 'tenant' | 'seller' | 'landlord'
  civility: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lang: string
  canal: string
  note: string
  photo?: string | null
  /** Colonnes d'identification LBA de `contacts`, prêtes à l'insert (identityToColumns). */
  birth_date: string | null
  nationality: string | null
  residence_country: string | null
  home_address: string | null
  criteria?: CriteriaInput // acheteur / locataire
  linkedBien?: { address: string; propType: string } // vendeur / bailleur
}

type ContactType = NewContactData['type']

// ═══════════════════════════════════════════════════════════════════════
//   Palette NCB dérivée de `sp` (mappe le design NCB_LIGHT / ncbBuildDark)
// ═══════════════════════════════════════════════════════════════════════
interface NcbC {
  white: string
  cardSubtle: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  accent: string
  onAccent: string
  ctaGhostBorder: string
  pageBg: string
  frameBorder: string
  cardShadow: string
  shadowSm: string
  shadowLg: string
  ctaShadow: string
  popoverBg: string
  popoverBorder: string
  popoverShadow: string
  typeColor: Record<ContactType, string>
  dark: boolean
  // ── Valeurs propres à l'aperçu vivant (le handoff les code en dur ; on les
  //    dérive ici pour éviter des ternaires `dark ? … : …` dispersés dans le JSX).
  /** Fond du bento fusionné. ⚠ Ses deux colonnes étant opaques et couvrant
   *  toute sa boîte, il ne peint plus rien — il reste le repli si l'une d'elles
   *  redevenait transparente. La colonne d'aperçu, elle, lit `white`. */
  surfaceBg: string
  /** Nom complet renseigné / vide. */
  nameInk: string
  nameGhost: string
  /** Lignes méta : icône, texte renseigné, texte vide. */
  metaIcon: string
  metaText: string
  metaGhost: string
  /** Message d'erreur de validation (lisible sur fond sombre). */
  errText: string
  /** CTA « Créer le contact » — actif / inactif. */
  ctaOnBg: string
  ctaOnInk: string
  ctaOffBg: string
  ctaOffInk: string
  /** CTA « Annuler » (ghost). */
  ctaGhostInk: string
}

const TYPE_COLOR: Record<ContactType, string> = {
  buyer: '#1E5BC6',
  tenant: '#0891B2',
  seller: '#C45A00',
  landlord: '#059669',
}

function buildC(sp: CrmPalette, dark: boolean): NcbC {
  if (!dark) {
    const accent = sp.accent
    return {
      white: '#FFFFFF',
      cardSubtle: '#F6F7F9',
      ink: sp.ink,
      inkSoft: sp.soft,
      muted: sp.sub,
      ghost: '#B5BAC2',
      line: 'rgba(15,23,42,0.07)',
      accent,
      onAccent: sp.accentInk,
      ctaGhostBorder: 'rgba(3,3,3,.14)',
      pageBg: sp.pageBg,
      frameBorder: sp.frameBorder,
      cardShadow: sp.shadow,
      shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
      shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
      ctaShadow: '0 8px 20px rgba(3,3,3,0.20)',
      popoverBg: sp.solidBg,
      popoverBorder: sp.solidBorder,
      popoverShadow: sp.solidShadow,
      typeColor: TYPE_COLOR,
      dark: false,
      surfaceBg: '#FFFFFF',
      nameInk: sp.ink,
      // ⚠ L'encre du VIDE, pas une décoration. Elle distingue « pas encore
      // saisi » de « saisi » dans l'aperçu vivant — c'est le seul repère de
      // progression de la carte. Elle valait #B5BAC2, mesuré à 1,95:1 : le
      // repère existait mais ne se lisait pas. Elle descend sur l'échelle
      // (`sub`, 5,57:1) et reste très en retrait de l'encre pleine, qui est
      // `soft` (#181818). L'écart de rôle survit, la lisibilité arrive.
      nameGhost: sp.sub,
      metaIcon: sp.soft,
      metaText: sp.soft,
      metaGhost: sp.sub,
      errText: '#B4293D',
      ctaOnBg: accent,
      ctaOnInk: '#FFFFFF',
      ctaOffBg: '#F6F7F9',
      ctaOffInk: '#B5BAC2',
      ctaGhostInk: sp.soft,
    }
  }
  return {
    white: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: 'rgba(255,255,255,0.28)',
    line: sp.cardBorder,
    accent: sp.accent,
    onAccent: sp.accentInk,
    ctaGhostBorder: sp.cardBorder,
    pageBg: sp.pageBg,
    frameBorder: sp.frameBorder,
    cardShadow: `inset 0 0 0 1px ${sp.cardBorder}, 0 10px 30px -14px rgba(0,0,0,.6)`,
    shadowSm: '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.6)',
    shadowLg: '0 24px 60px -12px rgba(0,0,0,.65), 0 8px 22px -10px rgba(0,0,0,.55)',
    ctaShadow: '0 10px 26px -8px rgba(0,0,0,.6)',
    // popovers/menus flottants = surface opaque du palier haut, jamais de verre
    popoverBg: sp.solidBg,
    popoverBorder: sp.solidBorder,
    popoverShadow: sp.solidShadow,
    typeColor: TYPE_COLOR,
    dark: true,
    // En sombre, la carte fusionnée reprend le noir de page pour se souder au cadre.
    surfaceBg: sp.solidBg,
    nameInk: '#FFFFFF',
    nameGhost: 'rgba(255,255,255,0.55)',
    metaIcon: 'rgba(255,255,255,0.75)',
    metaText: 'rgba(255,255,255,0.82)',
    // Même geste en sombre : 35 % donnait 3,12:1 sur la carte, 55 % donne
    // 6,24:1 — et reste bien en dessous des 82 % de l'encre pleine.
    metaGhost: 'rgba(255,255,255,0.55)',
    errText: '#E0738C',
    ctaOnBg: '#FFFFFF',
    ctaOnInk: sp.pageBg,
    ctaOffBg: 'rgba(255,255,255,0.12)',
    ctaOffInk: 'rgba(255,255,255,0.35)',
    ctaGhostInk: 'rgba(255,255,255,0.85)',
  }
}

// ── Styles d'input Sugar (sans bordure, ring au focus via CSS `.ncbm-in`) ──
const ncvInput = (C: NcbC): CSSProperties => ({
  width: '100%', height: 40, padding: '0 var(--crm-space-xl)', boxSizing: 'border-box',
  background: C.cardSubtle, border: 0, borderRadius: 'var(--crm-radius-lg)',
  color: C.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 500, fontFamily: 'inherit', outline: 'none',
})
const MONO: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' }
const ERR_RING: CSSProperties = { boxShadow: 'inset 0 0 0 2px #B4293D' }

/**
 * Input du panneau « Fiche express ». Le panneau est lui-même en `cardSubtle` :
 * les champs s'inversent en blanc pour rester lisibles (sans quoi champ et fond
 * se confondent).
 */
const inpW = (C: NcbC, err?: boolean): CSSProperties => ({
  ...ncvInput(C), background: C.white, ...(err ? ERR_RING : {}),
})
/** Variante select : même fond blanc, padding latéral réduit (chevron natif). */
const selW = (C: NcbC): CSSProperties => ({ ...inpW(C), padding: '0 var(--crm-space-md)' })

// ── 26 cantons groupés par région linguistique ─────────────────────────
interface CantonRegion { id: string; label: string; cantons: [string, string][] }
const CANTON_REGIONS: CantonRegion[] = [
  { id: 'romande', label: 'Suisse romande', cantons: [['GE', 'Genève'], ['VD', 'Vaud'], ['VS', 'Valais'], ['FR', 'Fribourg'], ['NE', 'Neuchâtel'], ['JU', 'Jura']] },
  {
    id: 'aleman', label: 'Suisse alémanique', cantons: [
      ['ZH', 'Zürich'], ['BE', 'Berne'], ['LU', 'Lucerne'], ['SO', 'Soleure'], ['BS', 'Bâle-Ville'], ['BL', 'Bâle-Camp.'],
      ['AG', 'Argovie'], ['ZG', 'Zoug'], ['SZ', 'Schwyz'], ['UR', 'Uri'], ['OW', 'Obwald'], ['NW', 'Nidwald'],
      ['GL', 'Glaris'], ['SH', 'Schaffhouse'], ['AR', 'Appenzell RE'], ['AI', 'Appenzell RI'], ['SG', 'St-Gall'],
      ['TG', 'Thurgovie'], ['GR', 'Grisons'],
    ],
  },
  { id: 'italienne', label: 'Suisse italienne', cantons: [['TI', 'Tessin']] },
]

// ═══════════════════════════════════════════════════════════════════════
//   ATOMES (module-level → focus des inputs préservé)
// ═══════════════════════════════════════════════════════════════════════
function NcvFieldM({ label, required, C, children }: { label?: string; required?: boolean; C: NcbC; children: ReactNode }) {
  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted, marginBottom: 'var(--crm-space-sm)' }}>
          {label}{required && <span style={{ color: C.inkSoft }}> *</span>}
        </label>
      )}
      {children}
    </div>
  )
}

/**
 * Case numérique à flèches (pièces, surface). Un clic avance d'un pas, un appui
 * maintenu répète, ↑ / ↓ au clavier font de même. La saisie reste libre : on
 * tape toujours « 4.5 » ou « 112 », la flèche repart de ce qui est écrit, calé
 * sur le pas. Vide, ↑ part de `depart` — un minimum de 0,5 pièce ne sert à rien.
 */
function NcbPasM({ C, value, onChange, pas, min, max, depart, placeholder, labelPlus, labelMoins }: {
  C: NcbC; value: string; onChange: (v: string) => void
  pas: number; min: number; max: number; depart: number
  placeholder: string; labelPlus: string; labelMoins: string
}) {
  // La répétition tourne entre deux rendus : elle lit la valeur dans une ref,
  // mise à jour AVANT l'envoi, sans quoi chaque tic repartirait de la même.
  const valeur = useRef(value)
  useEffect(() => { valeur.current = value }, [value])
  const minuterie = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({})
  const arreter = () => { clearTimeout(minuterie.current.t); clearInterval(minuterie.current.i); minuterie.current = {} }
  useEffect(() => arreter, [])

  const lire = (s: string) => { const n = parseFloat(s.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : null }
  const actuel = lire(value)
  const avancer = (dir: 1 | -1) => {
    const v = lire(valeur.current)
    if (v === null && dir < 0) return
    const brut = v === null ? depart
      : dir > 0 ? Math.floor(v / pas + 1e-9) * pas + pas : Math.ceil(v / pas - 1e-9) * pas - pas
    const n = String(Math.round(Math.min(max, Math.max(min, brut)) * 10) / 10)
    if (n === valeur.current) return arreter()
    valeur.current = n
    onChange(n)
  }
  const bouton = (dir: 1 | -1) => {
    const off = dir > 0 ? actuel !== null && actuel >= max : actuel === null || actuel <= min
    return (
      <button
        type="button"
        className="ncbm-pas"
        tabIndex={-1}
        disabled={off}
        aria-label={dir > 0 ? labelPlus : labelMoins}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault() // garde le focus dans la case, pas de sélection de texte
          avancer(dir)
          minuterie.current.t = setTimeout(() => { minuterie.current.i = setInterval(() => avancer(dir), 70) }, 400)
        }}
        onPointerUp={arreter}
        onPointerLeave={arreter}
        onPointerCancel={arreter}
        // Activation sans pointeur (lecteur d'écran) : `detail` vaut 0.
        onClick={(e) => { if (e.detail === 0) avancer(dir) }}
        style={{
          flex: 1, minHeight: 0, padding: 0, border: 0, borderRadius: 'var(--crm-radius-xs)',
          background: 'transparent', color: off ? C.ghost : C.muted, cursor: off ? 'default' : 'pointer',
          display: 'grid', placeItems: 'center',
        }}
      >
        <MEIcon name={dir > 0 ? 'chevron-up' : 'chevron-down'} size={12} strokeWidth={2.4} style={{ display: 'block' }} />
      </button>
    )
  }
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="ncbm-in"
        role="spinbutton"
        inputMode={pas % 1 ? 'decimal' : 'numeric'}
        autoComplete="off"
        aria-valuenow={actuel ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          avancer(e.key === 'ArrowUp' ? 1 : -1)
        }}
        placeholder={placeholder}
        style={{ ...inpW(C), ...MONO, paddingRight: 'calc(var(--crm-space-6xl) + var(--crm-space-md))' }}
      />
      <div style={{
        position: 'absolute', top: 'var(--crm-space-xs)', bottom: 'var(--crm-space-xs)', right: 'var(--crm-space-xs)',
        width: 'var(--crm-space-6xl)', display: 'flex', flexDirection: 'column',
      }}>
        {bouton(1)}
        {bouton(-1)}
      </div>
    </div>
  )
}

/**
 * Case de montant (budget, loyer). Les apostrophes se posent PENDANT la frappe —
 * un zéro de trop se voit tout de suite — et le curseur reste derrière le même
 * chiffre. Un raccourci (« 900k », « 1.2m ») s'écrit tel quel et se relit
 * « 900'000 » en quittant la case ; `lireMontant` le comprend dès la frappe, donc
 * l'aperçu et la création aussi.
 */
function NcbMontantM({ C, value, onChange, placeholder, err, onFocus, onBlur }: {
  C: NcbC; value: string; onChange: (v: string) => void; placeholder: string; err?: boolean
  onFocus?: () => void; onBlur?: (e: FocusEvent<HTMLInputElement>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  // Nombre de chiffres à gauche du curseur, à reposer après le regroupement.
  const curseur = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current, n = curseur.current
    curseur.current = null
    if (!el || n === null || document.activeElement !== el) return
    let pos = 0
    for (let vus = 0; pos < el.value.length && vus < n; pos++) if (/\d/.test(el.value[pos])) vus++
    el.setSelectionRange(pos, pos)
  }, [value])
  return (
    <input
      ref={ref}
      className="ncbm-in"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        const brut = e.target.value
        // Rien que des chiffres : on regroupe. Une lettre ou un point, c'est un
        // raccourci en cours — le réécrire couperait la saisie.
        if (!/^[\d'’\s]*$/.test(brut)) return onChange(brut)
        curseur.current = brut.slice(0, e.target.selectionStart ?? brut.length).replace(/\D/g, '').length
        onChange(grouperMilliers(brut.replace(/\D/g, '').replace(/^0+(?=\d)/, '')))
      }}
      onFocus={onFocus}
      onBlur={(e) => {
        const n = lireMontant(value)
        if (n !== null) onChange(grouperMilliers(n))
        onBlur?.(e)
      }}
      placeholder={placeholder}
      style={{ ...inpW(C, err), ...MONO }}
    />
  )
}

function NcbCloseM({ C, onClick, label }: { C: NcbC; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0, background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}
    >
      <NcvIcon name="x" size={16} stroke={C.inkSoft} />
    </button>
  )
}

function NcbCtaM({ C, tone = 'ink', icon, onClick, disabled, children }: {
  C: NcbC; tone?: 'ink' | 'ghost'; icon?: NcvIconName; onClick?: () => void; disabled?: boolean; children: ReactNode
}) {
  const ink = tone === 'ink'
  const off = !!disabled
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap',
        border: ink ? 0 : `1px solid ${C.ctaGhostBorder}`,
        background: off ? C.cardSubtle : ink ? C.accent : 'transparent',
        color: off ? C.ghost : ink ? C.onAccent : C.inkSoft,
        boxShadow: ink && !off ? C.ctaShadow : 'none',
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
      }}
    >
      {icon && <NcvIcon name={icon} size={15} stroke={off ? C.ghost : ink ? C.onAccent : C.inkSoft} sw={2.2} />}
      {children}
    </button>
  )
}

function NcbTypePillM({ C, type, label }: { C: NcbC; type: ContactType; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: C.typeColor[type], color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

/**
 * Chip du panneau « Fiche express ». `onWhite` bascule l'état inactif sur blanc +
 * ombre : sur le fond `cardSubtle` du panneau, un chip inactif en `cardSubtle`
 * serait invisible.
 */
function NcvChipM({ C, active, onClick, check = true, onWhite = false, children }: {
  C: NcbC; active: boolean; onClick: () => void; check?: boolean; onWhite?: boolean; children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? C.accent : onWhite ? C.white : C.cardSubtle,
        color: active ? C.onAccent : C.inkSoft, border: 0,
        boxShadow: !active && onWhite ? C.shadowSm : 'none',
        fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
      }}
    >
      {active && check && <NcvIcon name="check" size={12} stroke={C.onAccent} sw={2.2} />}
      {children}
    </button>
  )
}

function NcvAvatarM({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: color, color: encreSur(color), display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 600, letterSpacing: 0.3, boxShadow: `0 6px 18px ${color}55` }}>
      {initials}
    </div>
  )
}

function NcbAvatarM({ photo, initials, color, size }: { photo: string | null; initials: string; color: string; size: number }) {
  return photo
    ? <img src={photo} alt="" style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', objectFit: 'cover', flexShrink: 0, boxShadow: '0 6px 18px rgba(15,23,42,0.14)' }} />
    : <NcvAvatarM initials={initials} color={color} size={size} />
}

// ── Sélecteur de photo (optionnel, repli sur initiales live) ───────────
function NcbPhotoPickerM({ C, photo, initials, color, onPick, onClear, addLabel, removeLabel }: {
  C: NcbC; photo: string | null; initials: string; color: string
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; addLabel: string; removeLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const S = 74
  const open = () => inputRef.current?.click()
  return (
    <div style={{ position: 'relative', width: S, height: S }}>
      <button
        type="button"
        className="ncbm-ico"
        onClick={open}
        aria-label={addLabel}
        style={{
          width: S, height: S, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden',
          background: photo ? 'transparent' : initials ? color : C.cardSubtle,
          display: 'grid', placeItems: 'center',
          boxShadow: photo ? C.shadowSm : initials ? `0 6px 18px ${color}55` : 'none',
        }}
      >
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials
            ? <span style={{ color: encreSur(color), fontWeight: 600, fontSize: S * 0.34, letterSpacing: 0.3 }}>{initials}</span>
            : <NcvIcon name="user" size={S * 0.42} stroke={C.ghost} sw={1.7} />}
      </button>
      {/* ⚠ REDONDANT, et c'est voulu : le bouton qu'il coiffe déclenche déjà
          `open`. En faire un second bouton donnerait DEUX arrêts de tabulation
          pour un seul geste. Il reste cliquable à la souris (il déborde du
          cercle, un clic dessus n'atteindrait pas le bouton) mais sort de
          l'arbre d'accessibilité. */}
      <span onClick={open} aria-hidden="true" style={{ position: 'absolute', right: -2, bottom: -2, width: 27, height: 27, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}>
        <NcvIcon name="camera" size={14} stroke={C.inkSoft} sw={1.8} />
      </span>
      {/* ⛔ SEUL CHEMIN VERS `onClear` — vérifié, il n'a pas d'autre appelant. En
          `<span onClick>` il n'était ni focusable ni actionnable au clavier :
          on pouvait AJOUTER une photo sans jamais pouvoir l'enlever. */}
      {photo && (
        <button
          type="button"
          className="ncbm-ico"
          onClick={onClear}
          aria-label={removeLabel}
          title={removeLabel}
          style={{ position: 'absolute', right: -2, top: -2, width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', border: 0, padding: 0, cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}
        >
          <NcvIcon name="x" size={11} stroke={C.inkSoft} sw={2.2} />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
    </div>
  )
}

// ── Éditeur de recadrage manuel ────────────────────────────────────────
function NcbCropEditorM({ C, src, onCancel, onDone, title, hint, cancelLabel, validateLabel, tint }: {
  C: NcbC; src: string; onCancel: () => void; onDone: (dataUrl: string) => void
  title: string; hint: string; cancelLabel: string; validateLabel: string
  /** Couleur du type sélectionné — teinte le voile (suffixe alpha 59 ≈ 35 %). */
  tint?: string
}) {
  const V = 236
  const OUT = 360
  const [dims, setDims] = useState<{ iw: number; ih: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOffState] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const baseScale = dims ? V / Math.min(dims.iw, dims.ih) : 1
  const ds = baseScale * zoom
  const dw = dims ? dims.iw * ds : 0
  const dh = dims ? dims.ih * ds : 0

  const clampXY = (x: number, y: number, z = zoom) => {
    const s = baseScale * z
    const w = (dims ? dims.iw : 0) * s
    const h = (dims ? dims.ih : 0) * s
    const minX = Math.min(0, V - w)
    const minY = Math.min(0, V - h)
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) }
  }
  const setOff = (x: number, y: number, z?: number) => setOffState(clampXY(x, y, z))

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const iw = e.currentTarget.naturalWidth
    const ih = e.currentTarget.naturalHeight
    const bs = V / Math.min(iw, ih)
    setDims({ iw, ih })
    setOffState({ x: (V - iw * bs) / 2, y: (V - ih * bs) / 2 })
    setZoom(1)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    setOff(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py))
  }
  const onPointerUp = () => { dragRef.current = null }

  const onZoom = (z: number) => {
    const Vc = V / 2
    const dsOld = baseScale * zoom
    const dsNew = baseScale * z
    const cx = (Vc - off.x) / dsOld
    const cy = (Vc - off.y) / dsOld
    setZoom(z)
    setOff(Vc - cx * dsNew, Vc - cy * dsNew, z)
  }

  const validate = () => {
    if (!dims || !imgRef.current) return
    const k = OUT / V
    const cv = document.createElement('canvas')
    cv.width = OUT
    cv.height = OUT
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(imgRef.current, off.x * k, off.y * k, dw * k, dh * k)
    onDone(cv.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: tint ? `${tint}59` : 'rgba(20,28,45,0.34)', backdropFilter: 'blur(2px)' }}>
      <div style={{ width: 340, background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-7xl) var(--crm-space-7xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: C.ink, alignSelf: 'flex-start' }}>{title}</div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: C.muted, alignSelf: 'flex-start', marginTop: 3, marginBottom: 16 }}>{hint}</div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ position: 'relative', width: V, height: V, borderRadius: 'var(--crm-radius-pill)', overflow: 'hidden', background: C.cardSubtle, cursor: 'grab', touchAction: 'none', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)' }}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImgLoad}
            draggable={false}
            style={{ position: 'absolute', left: off.x, top: off.y, width: dw || 'auto', height: dh || 'auto', maxWidth: 'none', pointerEvents: 'none', userSelect: 'none', opacity: dims ? 1 : 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', width: '100%', margin: '18px 0 20px' }}>
          <NcvIcon name="search" size={15} stroke={C.muted} />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.ink, cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', width: '100%', alignItems: 'center' }}>
          <NcbCtaM C={C} tone="ghost" onClick={onCancel}>{cancelLabel}</NcbCtaM>
          <div style={{ flex: 1 }} />
          <NcbCtaM C={C} onClick={validate}>{validateLabel}</NcbCtaM>
        </div>
      </div>
    </div>
  )
}

// ── Date de naissance : saisie clavier + calendrier ────────────────────
/** Libellés du calendrier — ceux de l'onboarding (`onboarding:wizard.date.*`), déjà en 4 langues. */

/**
 * Les indispensables — MÊMES ids que la fiche contact (`CD_MUSTHAVE`) et que l'extraction
 * (`LEAD_FEATURES`), pour qu'un « balcon » saisi ici se relise « Balcon » sur la fiche et
 * pèse dans le matching. Libellés : `fiche.feature.*`, déjà en quatre langues.
 */
const FEATURES: { id: string; k: string }[] = [
  { id: 'balcon', k: 'fiche.feature.balcon' },
  { id: 'terrasse', k: 'fiche.feature.terrasse' },
  { id: 'jardin', k: 'fiche.feature.jardin' },
  { id: 'vue lac', k: 'fiche.feature.vueLac' },
  { id: 'ascenseur', k: 'fiche.feature.ascenseur' },
  { id: 'parking', k: 'fiche.feature.parking' },
  { id: 'garage', k: 'fiche.feature.garage' },
  { id: 'cave', k: 'fiche.feature.cave' },
]
const TYPE_EN_FR: Record<string, string> = { apartment: 'appartement', house: 'maison', land: 'terrain', commercial: 'commercial' }

// ── Cantons : pastilles romandes + barre de recherche ──────────────────
const CANTONS_TOUS = CANTON_REGIONS.flatMap((r) => r.cantons)
const CANTONS_ROMANDS = CANTON_REGIONS[0].cantons.map(([c]) => c)

/** Minuscules sans diacritiques : « zu » doit trouver « Zürich », « neu » « Neuchâtel ». */
const plier = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Sélecteur de cantons (refonte du 16.09.2026).
 *
 * ⛔ IL REMPLACE UNE AUTOCOMPLÉTION QUI NE SE REFERMAIT PAS. Sa liste s'ouvrait dès
 * le focus, restait ouverte après chaque choix « pour enchaîner », VERS LE HAUT
 * par-dessus les champs voisins, et ne partait qu'au clic ailleurs ou sur Échap :
 * la saisie restait bloquée derrière 26 lignes (Julien).
 *
 * Deux voies, et aucune ne laisse de liste ouverte :
 *  - les six cantons romands — le marché de l'agence — en pastilles à bascule,
 *    un clic chacun ;
 *  - la barre « Tapez un canton » pour les 26, gardée à la demande de Julien. Ses
 *    résultats n'existent QUE pendant la frappe, s'ouvrent vers le bas, et
 *    partent dès qu'un canton est choisi (clic ou Entrée), au clic dehors, à la
 *    sortie du champ ou sur Échap.
 * Un canton hors Romandie choisi rejoint la rangée en pastille active ; un clic
 * dessus le retire.
 */
function NcbCantonPickerM({ C, value, onChange, placeholder }: {
  C: NcbC; value: string[]; onChange: (v: string[]) => void; placeholder: string
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)

  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((x) => x !== code) : [...value, code])
  const ql = plier(q.trim())
  const matches = ql
    ? CANTONS_TOUS.filter(([c, n]) => plier(c).startsWith(ql) || plier(n).includes(ql))
    : []
  const ouvert = matches.length > 0
  const pastilles = CANTONS_TOUS.filter(([c]) => CANTONS_ROMANDS.includes(c) || value.includes(c))

  const choisir = (code?: string) => {
    if (!code) return
    toggle(code)
    setQ(''); setHi(0)
  }
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && ouvert) { e.preventDefault(); choisir(matches[hi]?.[0]) }
    else if (e.key === 'ArrowDown' && ouvert) { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp' && ouvert) { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    // ⚠ On MARQUE l'événement SEULEMENT s'il y avait une liste à fermer : sans ça, le
    // piège de focus de la modale verrait le même Échap et fermerait la modale
    // entière ; et sans liste, Échap doit continuer de fermer la modale.
    else if (e.key === 'Escape' && q) { e.preventDefault(); setQ(''); setHi(0) }
  }

  const pastille = (actif: boolean): CSSProperties => ({
    height: 34, padding: '0 var(--crm-space-md)', minWidth: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
    background: actif ? C.accent : C.white, color: actif ? C.onAccent : C.inkSoft,
    boxShadow: actif ? 'none' : C.shadowSm,
  })

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
      {pastilles.map(([c, n]) => {
        const on = value.includes(c)
        return (
          <button key={c} type="button" className="ncbm-ico" aria-pressed={on} aria-label={n} title={n} onClick={() => toggle(c)} style={pastille(on)}>
            {c}
          </button>
        )
      })}

      {/* La barre prend le reste de la rangée, ou une rangée entière si elle est trop
          courte. Ses résultats sont ancrés sous ELLE, pas sous les pastilles. */}
      <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
        <span style={{ position: 'absolute', left: 'var(--crm-space-lg)', top: 0, bottom: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <NcvIcon name="search" size={14} stroke={C.muted} sw={2} />
        </span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setHi(0) }}
          onKeyDown={onKey}
          onBlur={() => { setQ(''); setHi(0) }}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={ouvert}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          className="ncbm-in"
          style={{ ...inpW(C), height: 34, padding: '0 var(--crm-space-xl) 0 calc(var(--crm-space-6xl) + var(--crm-space-md))', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-md)' }}
        />
        {ouvert && (
          <div role="listbox" aria-label={placeholder} style={{ position: 'absolute', top: 'calc(100% + var(--crm-space-sm))', left: 0, right: 0, minWidth: 200, zIndex: 50, maxHeight: 240, overflowY: 'auto', background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-xs)' }}>
            {matches.map(([c, n], i) => {
              const on = value.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={on}
                  tabIndex={-1}
                  onMouseEnter={() => setHi(i)}
                  // `mousedown` + preventDefault : le champ garde le focus, donc son
                  // `onBlur` (qui vide la recherche) ne part pas avant le choix.
                  onMouseDown={(e) => { e.preventDefault(); choisir(c) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: i === hi ? C.cardSubtle : 'transparent' }}
                >
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: C.ink, width: 24 }}>{c}</span>
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: C.muted, flex: 1 }}>{n}</span>
                  {on && <NcvIcon name="check" size={13} stroke={C.ink} sw={2.4} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ligne méta de l'aperçu vivant (icône + valeur, état vide « ghost ») ─
function MetaLineM({ C, icon, ghost, children }: { C: NcbC; icon: NcvIconName; ghost: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ghost ? C.metaGhost : C.metaText }}>
      <span style={{ width: 24, height: 24, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <NcvIcon name={icon} size={19} stroke={C.metaIcon} sw={1.8} />
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

/**
 * « Ce contact existe déjà » — une ligne par doublon, posée au-dessus du bouton de
 * création, là où l'œil passe AVANT de créer.
 *
 * ⚠ VOLONTAIREMENT SOBRE (16.09.2026) : ni titre, ni raison du rapprochement, ni
 * coordonnées. La première version en portait quatre lignes (« Un contact similaire
 * déjà dans votre agence », « téléphone · +41… », « Ouvrir ») et se lisait comme un
 * formulaire de plus. Le nom suffit ; la ligne entière ouvre la fiche.
 *
 * ⚠ Il PRÉVIENT, il ne bloque pas : deux homonymes existent. Le bouton devient
 * « Créer quand même ». Deux lignes au plus : l'aperçu ne défile pas.
 */
function DoublonsM({ C, doublons, existsLabel, openLabel, onOpen }: {
  C: NcbC
  doublons: DuplicateCandidate[]
  /** « existe déjà » — suit le nom. */
  existsLabel: string
  /** « Ouvrir » — nom accessible et info-bulle, jamais affiché. */
  openLabel: string
  onOpen?: (id: string) => void
}) {
  // Pastille pâle ⇒ encre sombre (CLAUDE.md §3, règle 4), calculée et non supposée.
  const pastille = MXC_SYSTEM.yellow400
  return (
    <div role="status" style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)', marginBottom: 'var(--crm-space-lg)' }}>
      {doublons.slice(0, 2).map((d) => {
        const nom = `${d.first_name} ${d.last_name}`.trim()
        const initiales = ((d.first_name[0] || '') + (d.last_name[0] || '')).toUpperCase()
        return (
          <button
            key={d.id}
            type="button"
            className="ncbm-ico"
            onClick={onOpen ? () => onOpen(d.id) : undefined}
            disabled={!onOpen}
            aria-label={`${openLabel} · ${nom}`}
            title={openLabel}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', border: 0, borderRadius: 'var(--crm-radius-pill)', background: C.cardSubtle, padding: 'var(--crm-space-xs) var(--crm-space-md) var(--crm-space-xs) var(--crm-space-xs)', cursor: onOpen ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--crm-radius-pill)', background: pastille, color: encreSur(pastille), display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xs)', fontWeight: 600 }}>
              {initiales}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--crm-text-md)' }}>
              <span style={{ fontWeight: 600, color: C.ink }}>{nom}</span>
              <span style={{ fontWeight: 500, color: C.muted }}> {existsLabel}</span>
            </span>
            {onOpen && (
              <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', transform: 'rotate(-90deg)' }}>
                <NcvIcon name="chevron" size={14} stroke={C.muted} sw={2.2} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Textes de la colonne d'aperçu — résolus par le parent (i18n hors des atomes). */
interface PreviewLabels {
  namePlaceholder: string
  email: string
  phone: string
  birth: string
  budget: string
  cantons: string
  cancel: string
  addPhoto: string
  removePhoto: string
  /** Rappel du raccourci clavier, sous le CTA. */
  shortcut: string
}

/**
 * Colonne gauche « aperçu vivant » : la fiche telle qu'elle existera, qui se
 * remplit à mesure de la saisie, et qui porte les deux actions. Elle ne scrolle
 * jamais — le spacer `flex:1` pousse les CTA en bas quelle que soit la hauteur.
 */
function PreviewColM({
  C, photo, initials, tint, type, typeLabel, fullName, email, phone, birth, budgetLine, cantonsLine,
  isBuyer, labels, alerte, messages, canSubmit, submitLabel, onSubmit, onCancel, onPick, onClear,
}: {
  C: NcbC
  photo: string | null
  initials: string
  tint: string
  type: ContactType
  typeLabel: string
  fullName: string
  /** E-mail VALIDE seulement — une adresse à moitié tapée resterait en ghost. */
  email: string
  /** Numéro composé (indicatif compris), vide tant que le numéro local l'est. */
  phone: string
  birth: string
  /** Budget / loyer / adresse du bien déjà formaté, ou null si non renseigné. */
  budgetLine: string | null
  /** Cantons joints, ou null si aucun. */
  cantonsLine: string | null
  isBuyer: boolean
  labels: PreviewLabels
  /** Posé au-dessus des erreurs et des CTA — les doublons possibles. */
  alerte?: ReactNode
  /** Erreurs à afficher au-dessus des CTA (validation, puis serveur). */
  messages: string[]
  canSubmit: boolean
  /** Libellé du CTA principal (bascule sur « Création… » pendant l'envoi). */
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div style={{ width: 288, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--crm-space-7xl) var(--crm-space-4xl) var(--crm-space-4xl)', textAlign: 'center', minHeight: 0, overflowY: 'auto', background: C.white }}>
      <NcbPhotoPickerM C={C} photo={photo} initials={initials} color={tint} onPick={onPick} onClear={onClear} addLabel={labels.addPhoto} removeLabel={labels.removePhoto} />
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: fullName ? C.nameInk : C.nameGhost, marginTop: 'var(--crm-space-lg)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fullName || labels.namePlaceholder}
      </div>
      <div style={{ marginTop: 'var(--crm-space-sm)' }}><NcbTypePillM C={C} type={type} label={typeLabel} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', alignSelf: 'stretch', marginTop: 'var(--crm-space-6xl)', textAlign: 'left' }}>
        <MetaLineM C={C} icon="mail" ghost={!email}>{email || labels.email}</MetaLineM>
        <MetaLineM C={C} icon="phone" ghost={!phone}>{phone || labels.phone}</MetaLineM>
        <MetaLineM C={C} icon="calendar" ghost={!birth}>{birth || labels.birth}</MetaLineM>
        <MetaLineM C={C} icon={isBuyer ? 'wallet' : 'pin'} ghost={!budgetLine}>{budgetLine || labels.budget}</MetaLineM>
        {isBuyer && <MetaLineM C={C} icon="pin" ghost={!cantonsLine}>{cantonsLine || labels.cantons}</MetaLineM>}
      </div>
      <div style={{ flex: 1 }} />
      {alerte}
      {messages.map((m) => (
        <div key={m} role="alert" style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: C.errText, marginBottom: 'var(--crm-space-lg)', alignSelf: 'stretch', textAlign: 'left' }}>{m}</div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', alignSelf: 'stretch' }}>
        <button
          type="button"
          onClick={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit}
          style={{
            height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)', fontWeight: 600,
            background: canSubmit ? C.ctaOnBg : C.ctaOffBg,
            color: canSubmit ? C.ctaOnInk : C.ctaOffInk,
            boxShadow: canSubmit && !C.dark ? C.ctaShadow : 'none',
          }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 44, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
            border: `1px solid ${C.dark ? 'rgba(255,255,255,0.22)' : C.ctaGhostBorder}`,
            background: 'transparent', color: C.ctaGhostInk,
          }}
        >
          {labels.cancel}
        </button>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: C.metaGhost }}>{labels.shortcut}</div>
      </div>
    </div>
  )
}

// ── Coller un message ──────────────────────────────────────────────────
/**
 * « Coller un message » (16.09.2026) : l'agent colle un e-mail ou un WhatsApp, MEGGA AI
 * (edge `extract-lead`, la même que « Importer des leads ») en tire nom, coordonnées,
 * intention, budget, pièces et zone, et la fiche se PRÉREMPLIT.
 *
 * ⚠ RIEN N'EST CRÉÉ ICI. L'extraction remplit des cases que l'agent relit, puis il crée
 * lui-même — validation humaine (CLAUDE.md §5). Le texte collé n'est pas conservé : il
 * part à l'edge, qui masque les données sensibles avant le modèle et journalise l'appel,
 * et il meurt avec cette fenêtre.
 *
 * Voile DANS la modale, comme la confirmation d'identité.
 */
function NcbCollerMessageM({ C, enCours, erreur, labels, onAnalyser, onFermer }: {
  C: NcbC
  enCours: boolean
  /** Message d'erreur déjà traduit, ou null. */
  erreur: string | null
  labels: { title: string; placeholder: string; analyze: string; analyzing: string; cancel: string }
  onAnalyser: (texte: string) => void
  onFermer: () => void
}) {
  const [texte, setTexte] = useState('')
  const pret = texte.trim().length >= 10 && !enCours
  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: C.dark ? 'rgba(0,0,0,0.55)' : 'rgba(3,3,3,0.28)', backdropFilter: 'blur(2px)', padding: 'var(--crm-space-6xl)' }}
      onKeyDown={(e) => {
        // ⚠ Échap MARQUÉ (sinon le piège de focus fermerait la fiche) ; ⌘⏎ analyse, et
        // ne remonte pas jusqu'au raccourci de création de la fiche.
        if (e.key === 'Escape') { e.preventDefault(); onFermer() }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); if (pret) onAnalyser(texte) }
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !enCours) onFermer() }}
    >
      <div role="dialog" aria-modal="true" aria-label={labels.title} style={{ width: 520, maxWidth: '100%', background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-6xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
        <textarea
          className="ncbm-in"
          autoFocus
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.title}
          disabled={enCours}
          style={{ ...inpW(C), background: C.cardSubtle, height: 220, padding: 'var(--crm-space-lg) var(--crm-space-xl)', resize: 'none', lineHeight: 1.5, display: 'block' }}
        />
        {erreur && <div role="alert" style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: C.errText }}>{erreur}</div>}
        <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFermer} disabled={enCours} style={{ height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${C.ctaGhostBorder}`, background: 'transparent', color: C.ctaGhostInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: enCours ? 'default' : 'pointer' }}>
            {labels.cancel}
          </button>
          <button type="button" onClick={() => pret && onAnalyser(texte)} disabled={!pret} style={{ height: 40, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: pret || enCours ? C.ctaOnBg : C.ctaOffBg, color: pret || enCours ? C.ctaOnInk : C.ctaOffInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: pret ? 'pointer' : 'default' }}>
            {enCours ? labels.analyzing : labels.analyze}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirmation « identité incomplète » ───────────────────────────────
/**
 * Posée AVANT la création d'un acheteur ou d'un vendeur dont l'identification LBA
 * (art. 3 : naissance, nationalité, résidence, adresse) est incomplète — demande
 * de Julien, 16.09.2026 : sans elle, le dossier KYC ne pourra pas être validé, et
 * l'agent doit le savoir au moment où il peut encore la saisir.
 *
 * ⚠ Elle PRÉVIENT, elle ne bloque pas : un premier appel n'apporte souvent qu'un
 * nom et un numéro, et l'identité se complète sur la fiche. L'action PRIMAIRE est
 * la plus sûre — compléter — et « Créer sans l'identité » reste en second.
 *
 * ⚠ Ni locataire ni propriétaire : aucun dossier KYC n'existe pour eux (`KycType`
 * ne connaît que `buyer_*` et `seller_*`), la fenêtre leur mentirait.
 *
 * Voile DANS la modale, comme le recadrage photo : il couvre la fiche et non l'écran.
 */
function NcbIdentiteConfirmM({ C, manquants, labels, onComplete, onCreateAnyway, onCancel }: {
  C: NcbC
  /** Libellés des champs manquants, dans l'ordre du formulaire. */
  manquants: string[]
  labels: { title: string; body: string; complete: string; createAnyway: string }
  onComplete: () => void
  onCreateAnyway: () => void
  onCancel: () => void
}) {
  const pastille = MXC_SYSTEM.yellow400
  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: C.dark ? 'rgba(0,0,0,0.55)' : 'rgba(3,3,3,0.28)', backdropFilter: 'blur(2px)', padding: 'var(--crm-space-6xl)' }}
      // ⚠ Échap MARQUÉ : le piège de focus de la modale fermerait sinon la fiche entière.
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onCancel() } }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="ncbm-id-titre" aria-describedby="ncbm-id-texte" style={{ width: 400, maxWidth: '100%', background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-6xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: pastille, display: 'grid', placeItems: 'center' }}>
          <NcvIcon name="shield" size={20} stroke={encreSur(pastille)} sw={2} />
        </span>
        <div id="ncbm-id-titre" style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: C.ink }}>{labels.title}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
          {manquants.map((m) => (
            <span key={m} style={{ height: 26, padding: '0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: C.cardSubtle, color: C.inkSoft, fontSize: 'var(--crm-text-sm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>{m}</span>
          ))}
        </div>
        <div id="ncbm-id-texte" style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: C.muted, lineHeight: 1.5 }}>{labels.body}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-sm)' }}>
          <button type="button" onClick={onCreateAnyway} style={{ flex: '1 1 140px', height: 44, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${C.ctaGhostBorder}`, background: 'transparent', color: C.ctaGhostInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', padding: '0 var(--crm-space-lg)' }}>
            {labels.createAnyway}
          </button>
          <button type="button" autoFocus onClick={onComplete} style={{ flex: '1 1 140px', height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, background: C.ctaOnBg, color: C.ctaOnInk, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', padding: '0 var(--crm-space-lg)' }}>
            {labels.complete}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tuile secondaire (écran de confirmation) ───────────────────────────
function SecTileM({ C, icon, title, sub, onClick }: { C: NcbC; icon: NcvIconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: 1, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 0, background: C.white, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.cardShadow, padding: 'var(--crm-space-3xl) var(--crm-space-4xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0, display: 'grid', placeItems: 'center', background: C.cardSubtle }}>
        <NcvIcon name={icon} size={18} stroke={C.inkSoft} sw={1.9} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   État de formulaire
// ═══════════════════════════════════════════════════════════════════════
interface FormState {
  type: ContactType
  civ: string
  firstName: string
  lastName: string
  /** JJ.MM.AAAA (saisie suisse) — converti en `date` ISO par identityToColumns. */
  birth: string
  /** ISO 3166-1 alpha-2. */
  nationality: string
  residence: string
  homeAddress: string
  email: string
  phone: string
  lang: string
  canal: string
  photo: string | null
  budgetMin: string
  budgetMax: string
  rentMax: string
  pTypes: string[]
  cantons: string[]
  /** Communes ou quartiers — lus dans un message collé, retirables un à un. */
  cities: string[]
  rooms: string
  /** Surface minimum en m². */
  surface: string
  /** Indispensables : ids de `FEATURES` (ceux de la fiche contact). */
  features: string[]
  address: string
  propType: string
  note: string
}

const EMPTY: FormState = {
  // Nationalité / résidence démarrent VIDES et non à 'CH'. Le prototype pré-remplit
  // « Suisse », mais le bloc « Identité complète » qui les porte est replié par défaut :
  // un défaut y serait persisté comme une donnée d'identification LBA que l'agent n'a
  // jamais vue ni confirmée, et qui alimente le scoring de risque pays (listes FATF).
  // Une case vide se lit « — » sur la fiche — l'absence de donnée reste visible.
  type: 'buyer', civ: 'mrs', firstName: '', lastName: '', birth: '', nationality: '', residence: '', homeAddress: '',
  email: '', phone: '', lang: 'fr', canal: 'whatsapp', photo: null,
  budgetMin: '', budgetMax: '', rentMax: '', pTypes: ['appartement'], cantons: ['GE', 'VD'], cities: [], rooms: '', surface: '', features: [], address: '', propType: 'appartement', note: '',
}

const TYPE_IDS: ContactType[] = ['buyer', 'tenant', 'seller', 'landlord']

const emailOkFn = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const parseNum = (s: string): number | null => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n !== 0 ? n : null
}

// ═══════════════════════════════════════════════════════════════════════
//   MODALE
// ═══════════════════════════════════════════════════════════════════════
export default function NewContactModal({
  sp,
  dark,
  onClose,
  onCreate,
  isPending,
  error,
  onOpenMatching,
  onOpenKyc,
  onOpenFiche,
  duplicates = [],
  onIdentityChange,
  onOpenDuplicate,
  onExtract,
}: {
  sp: CrmPalette
  dark: boolean
  onClose: () => void
  onCreate: (data: NewContactData) => Promise<void>
  isPending: boolean
  error: string | null
  onOpenMatching: () => void
  /** Écran de confirmation — tuiles secondaires (contact créé). Repli sur onClose. */
  onOpenKyc?: () => void
  onOpenFiche?: () => void
  /** Doublons possibles de la saisie — cherchés par le PARENT (la modale ne lit pas la base). */
  duplicates?: DuplicateCandidate[]
  /**
   * Remonte l'identité saisie, pour la recherche de doublons. N'y figurent que des
   * valeurs EXPLOITABLES : un e-mail valide, un téléphone d'au moins six chiffres.
   * ⚠ Doit être stable (un setter d'état) : c'est une dépendance d'effet.
   */
  onIdentityChange?: (identite: { email: string; phone: string; firstName: string; lastName: string }) => void
  /** Ouvre la fiche d'un doublon. */
  onOpenDuplicate?: (id: string) => void
  /**
   * Extraction MEGGA AI d'un message collé (edge `extract-lead`), fournie par le PARENT —
   * la modale ne lit pas la base. Absente ⇒ pas de bouton « Coller un message ».
   */
  onExtract?: (texte: string) => Promise<ExtractLeadResult>
}): JSX.Element {
  const { t, i18n } = useTranslation('contacts')
  /**
   * ⚠ LE TÉLÉPHONE EN DEUX CONTRÔLES — l'indicatif se CHOISIT, le reste se tape.
   * Même système que l'onboarding (`OcBooking`), et pour la même raison mesurée
   * là-bas : un champ libre laissait arriver « 079 874 94 84 », « 0041 79… » et
   * « +41 79… » dans la même colonne. C'est un numéro d'ENVOI — la passerelle
   * WhatsApp attend un format international, et un zéro de tête suisse ne s'y
   * traduit pas tout seul.
   *
   * Suisse par défaut (c'est le marché) ; la liste suit l'ordre des PAYS et non
   * celui des indicatifs, un agent cherchant son pays par son nom.
   *
   * ⚠ Un numéro local VIDE rend un téléphone VIDE, jamais l'indicatif seul :
   * sans ça un formulaire non renseigné enverrait « +41 » comme numéro.
   */
  // ⚠ La modale declarait `aria-modal` SANS piéger le focus : 53 elements
  // focusables la precedaient dans l'ordre de tabulation — la barre, le rail et
  // les lignes de la liste QUI SONT DERRIERE ELLE. `aria-modal` annonce aux
  // lecteurs d'ecran que le reste est inerte : sans piege, il MENT.
  const refPiege = useFocusTrap(true, onClose)
  const [paysTel, setPaysTel] = useState('CH')
  const [numeroLocal, setNumeroLocal] = useState('')
  // 195 options traduites et retriées : sans mémoïsation, la liste entière serait
  // reconstruite à chaque frappe dans les champs voisins.
  const optionsIndicatif = useMemo(() => dialCodeOptions(i18n.language), [i18n.language])
  const majPaysTel = (iso: string) => {
    setPaysTel(iso)
    setF((s) => ({ ...s, phone: composePhone(iso, numeroLocal) }))
  }
  const majNumeroLocal = (local: string) => {
    setNumeroLocal(local)
    setF((s) => ({ ...s, phone: composePhone(paysTel, local) }))
  }
  const C = useMemo(() => buildC(sp, dark), [sp, dark])
  const palChamps = useMemo<PaletteChamps>(() => ({
    ink: C.ink, inkSoft: C.inkSoft, muted: C.muted, ghost: C.ghost, accent: C.accent, onAccent: C.onAccent,
    surfaceDouce: C.cardSubtle, popoverBg: C.popoverBg, popoverBorder: C.popoverBorder, popoverShadow: C.popoverShadow,
  }), [C])

  const [f, setF] = useState<FormState>(EMPTY)
  const [tried, setTried] = useState(false)
  const [created, setCreated] = useState(false)
  const [moreId, setMoreId] = useState(false)
  const [confirmIdentite, setConfirmIdentite] = useState(false)
  // Champ à focaliser une fois « Identité complète » dépliée — une ref et un effet,
  // parce que le champ n'existe pas encore au moment du clic.
  const champAFocaliser = useRef<string | null>(null)
  useEffect(() => {
    const champ = champAFocaliser.current
    if (!champ) return
    champAFocaliser.current = null
    refPiege.current?.querySelector<HTMLElement>(`[data-champ="${champ}"]`)?.focus()
  })
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const onField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))
  const toggleIn = (k: 'pTypes' | 'features', v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }))
  const setMontant = (k: 'budgetMin' | 'budgetMax' | 'rentMax') => (v: string) => setF((s) => ({ ...s, [k]: v }))
  // Le contrôle min ≤ max se tait tant que l'agent est dans l'une des deux cases :
  // sans ça, taper « 1'300'000 » en max sous un min de 900'000 rougirait à chaque
  // chiffre. Passer du min au max ne compte pas comme une sortie.
  const [budgetEnSaisie, setBudgetEnSaisie] = useState(false)
  const quitterBudget = (e: FocusEvent<HTMLInputElement>) => {
    if (!(e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest('[data-budget]'))) setBudgetEnSaisie(false)
  }

  const isBuyer = f.type === 'buyer' || f.type === 'tenant'
  const tc = C.typeColor[f.type]
  const fullName = `${f.firstName} ${f.lastName}`.trim()
  const initials = ((f.firstName[0] || '') + (f.lastName[0] || '')).toUpperCase()
  const emailOk = emailOkFn(f.email)
  const emailSaisi = f.email.trim() !== ''
  // ⛔ UN E-MAIL N'EST PLUS OBLIGATOIRE (16.09.2026) — un e-mail OU un téléphone. Le
  // prospect qui appelle ou écrit sur WhatsApp donne rarement son adresse : la règle
  // précédente forçait l'agent à en inventer une, ou à renoncer à créer le contact.
  // Six chiffres utiles au moins (le zéro de tête ne compte pas, `composePhone` le retire).
  const telOk = numeroLocal.replace(/\D/g, '').replace(/^0+/, '').length >= 6
  const joignable = emailOk || telOk
  // Une date impossible (30.02.1990, 5.3.80…) ne doit PAS passer : parseSwissDate la
  // convertirait en null et le contact serait créé sans date de naissance, alors que
  // l'agent l'a saisie. Même garde que CdIdentityModal sur la fiche, pour que les deux
  // surfaces refusent exactement le même contenu.
  const birthKo = isInvalidSwissDate(f.birth)
  // Un e-mail SAISI doit être valide, même quand le téléphone suffirait : sinon une
  // adresse mal tapée partirait en base sans prévenir.
  const identiteOk = !!(f.firstName.trim() && f.lastName.trim()) && joignable && (!emailSaisi || emailOk) && !birthKo
  const bMin = lireMontant(f.budgetMin)
  const bMax = lireMontant(f.budgetMax)
  const rMax = lireMontant(f.rentMax)
  // Un min au-dessus du max ne trouverait aucun bien : on refuse, sans inverser en silence.
  const budgetKo = f.type === 'buyer' && bMin !== null && bMax !== null && bMin > bMax
  const budgetKoVisible = budgetKo && (tried || !budgetEnSaisie)
  const valid = identiteOk && !budgetKo
  const canSubmit = valid && !isPending

  useEffect(() => {
    onIdentityChange?.({
      email: emailOk ? f.email.trim() : '',
      phone: telOk ? f.phone : '',
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
    })
  }, [onIdentityChange, emailOk, telOk, f.email, f.phone, f.firstName, f.lastName])

  const typeLabel = (id: ContactType) => t(`contactType.${id}`)

  const buildData = (): NewContactData => {
    const data: NewContactData = {
      type: f.type,
      civility: f.civ,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      lang: f.lang,
      canal: f.canal,
      note: f.note.trim(),
      photo: f.photo,
      // Colonnes typées LBA (art. 3) — jamais dans form_data : le KYC les requête.
      ...identityToColumns({ birth: f.birth, nationality: f.nationality, residence: f.residence, homeAddress: f.homeAddress }),
    }
    if (isBuyer) {
      data.criteria = {
        transaction: f.type === 'tenant' ? 'location' : 'vente',
        types: f.pTypes,
        cantons: f.cantons,
        budgetMin: f.type === 'tenant' ? null : bMin,
        budgetMax: f.type === 'tenant' ? rMax : bMax,
        roomsMin: parseNum(f.rooms),
        cities: f.cities,
        areaMin: parseNum(f.surface),
        mustHave: f.features,
      }
    } else {
      data.linkedBien = { address: f.address.trim(), propType: f.propType }
    }
    return data
  }

  // Identification LBA (art. 3) incomplète — seulement là où un dossier KYC existe.
  // ── Coller un message : extraction, puis préremplissage des cases VIDES ──
  const [collerOuvert, setCollerOuvert] = useState(false)
  const [collerEnCours, setCollerEnCours] = useState(false)
  const [collerErreur, setCollerErreur] = useState<string | null>(null)
  const [prerempli, setPrerempli] = useState(false)

  const analyserMessage = async (texte: string) => {
    if (!onExtract) return
    setCollerEnCours(true); setCollerErreur(null)
    try {
      const { extracted: x } = await onExtract(texte)
      // ⛔ LES CASES DÉJÀ REMPLIES NE SONT JAMAIS ÉCRASÉES : ce que l'agent a tapé prime
      // sur ce que le modèle a lu. Seule l'intention change le type, puisque le message
      // est justement là pour la dire.
      const groupe = (n: number) => grouperMilliers(Math.round(n))
      // Lieux. L'extraction rend cantons et communes séparés ; l'ANCIENNE (edge pas encore
      // redéployée) ne rend que `zone`, découpée ici par virgules, un nom de canton en
      // devenant le code.
      const lieux = x.cities ?? x.zone.split(',').map((z) => z.trim()).filter(Boolean)
      const cantonsLus = new Set(x.cantons ?? [])
      const communes: string[] = []
      for (const lieu of lieux) {
        const c = CANTONS_TOUS.find(([code, nom]) => plier(code) === plier(lieu) || plier(nom) === plier(lieu))?.[0]
        if (c && !x.cantons) cantonsLus.add(c)
        else communes.push(lieu)
      }
      // Téléphone : l'indicatif repositionne le sélecteur, le reste va dans la case.
      if (x.phone && !numeroLocal.trim()) {
        const brut = x.phone.trim().replace(/^00/, '+')
        const indicatif = brut.startsWith('+') ? Object.values(COUNTRY_DIAL_CODES).filter((c) => brut.replace(/[^\d+]/g, '').startsWith(`+${c}`)).sort((a, b) => b.length - a.length)[0] : undefined
        const iso = indicatif ? countryForDialCode(indicatif) ?? paysTel : paysTel
        const local = indicatif ? brut.replace(new RegExp(`^\\+\\s*${indicatif}\\s*`), '') : brut
        setPaysTel(iso); setNumeroLocal(local)
        setF((s) => ({ ...s, phone: composePhone(iso, local) }))
      }
      // L'identité complète se DÉPLIE si le message en porte : ce qui est prérempli doit se voir.
      if (x.nationality || x.residenceCountry || x.homeAddress) setMoreId(true)
      setF((s) => {
        const type: ContactType = x.intent === 'seller' ? 'seller' : x.intent === 'tenant' ? 'tenant' : 'buyer'
        const n = { ...s, type }
        const vide = (v: string) => !v.trim()
        // Qui
        if (vide(s.firstName) && x.firstName) n.firstName = x.firstName
        if (vide(s.lastName) && x.lastName) n.lastName = x.lastName
        if (vide(s.email) && x.email) n.email = x.email
        if (x.civility) n.civ = x.civility
        if (x.language) n.lang = x.language
        if (x.preferredChannel) n.canal = x.preferredChannel
        if (!s.nationality && x.nationality && COUNTRIES.some((p) => p.code === x.nationality)) n.nationality = x.nationality
        if (!s.residence && x.residenceCountry && COUNTRIES.some((p) => p.code === x.residenceCountry)) n.residence = x.residenceCountry
        if (vide(s.homeAddress) && x.homeAddress) n.homeAddress = x.homeAddress
        // Ce qu'il cherche, ou ce qu'il confie
        const types = (x.propertyTypes ?? []).map((ty) => TYPE_EN_FR[ty]).filter(Boolean)
        if (type === 'seller') {
          if (vide(s.address) && (x.propertyAddress || lieux.length)) n.address = x.propertyAddress || lieux.join(', ')
          if (types[0]) n.propType = types[0]
        } else {
          if (x.rooms && vide(s.rooms)) n.rooms = String(x.rooms)
          if (x.surfaceMin && vide(s.surface)) n.surface = String(x.surfaceMin)
          if (type === 'buyer' && x.budget && vide(s.budgetMax)) n.budgetMax = groupe(x.budget)
          if (type === 'buyer' && x.budgetMin && vide(s.budgetMin)) n.budgetMin = groupe(x.budgetMin)
          if (type === 'tenant' && x.budget && vide(s.rentMax)) n.rentMax = groupe(x.budget)
          // Types, cantons : le message REMPLACE la présélection par défaut (appartement ;
          // GE, VD) — c'est lui qui dit ce que cherche ce client-là.
          if (types.length) n.pTypes = types
          if (cantonsLus.size) n.cantons = [...cantonsLus]
          if (communes.length) n.cities = [...new Set([...s.cities, ...communes])]
          if (x.features?.length) n.features = [...new Set([...s.features, ...x.features.filter((id) => FEATURES.some((ft) => ft.id === id))])]
        }
        // ⛔ RIEN DANS LA NOTE. Elle appartient à l'agent ; un message collé n'y écrit pas
        // (Julien, 16.09.2026 : « ne pas confondre la note et l'import du lead »). Ce qui
        // n'a pas de case dans la fiche n'est pas recopié.
        return n
      })
      setPrerempli(true)
      setCollerOuvert(false)
    } catch (e) {
      const code = (e as ExtractLeadError | undefined)?.code
      setCollerErreur(t(
        code === 'unauthorized' ? 'import.lead.errors.unauthorized'
          : code === 'text_too_short' ? 'import.lead.errors.textTooShort'
            : code === 'rate_limit_exceeded' ? 'import.lead.errors.rateLimit'
              : code === 'llm_unavailable' ? 'import.lead.errors.llmUnavailable'
                : 'import.lead.errors.generic',
      ))
    } finally {
      setCollerEnCours(false)
    }
  }

  const kycConcerne = f.type === 'buyer' || f.type === 'seller'
  const identiteManquante = [
    { champ: 'birth', vide: !f.birth.trim(), label: t('newContactPager.birth') },
    { champ: 'nationality', vide: !f.nationality, label: t('newContactPager.nationality') },
    { champ: 'residence', vide: !f.residence, label: t('newContactPager.residence') },
    { champ: 'homeAddress', vide: !f.homeAddress.trim(), label: t('newContactPager.homeAddress') },
  ].filter((c) => c.vide)

  const submit = async (sansIdentite = false) => {
    if (!valid) { setTried(true); return }
    if (kycConcerne && identiteManquante.length > 0 && !sansIdentite) { setConfirmIdentite(true); return }
    try {
      await onCreate(buildData())
      setCreated(true)
    } catch {
      // L'erreur est reflétée via le prop `error` — on reste ouvert.
    }
  }
  const reset = () => { setF(EMPTY); setTried(false); setCreated(false); setMoreId(false); setConfirmIdentite(false); setPrerempli(false); setNumeroLocal(''); setPaysTel('CH') }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setCropSrc(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(file)
    e.target.value = ''
  }
  const clearPhoto = () => setF((s) => ({ ...s, photo: null }))

  const shellStyle: CSSProperties = {
    width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
    background: C.pageBg, color: C.ink, fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
  }
  const focusCss = (
    <style>{`
      .ncbm-in:focus { box-shadow: inset 0 0 0 2px ${C.accent}; }
      .ncbm-pas:not(:disabled):hover { color: ${C.ink} !important; background: ${C.cardSubtle} !important; }
      /* ⚠ outline et non box-shadow : ces deux boutons posent déjà une ombre EN
         LIGNE, qui l'emporterait sur la règle. Et :focus-visible, pour ne pas
         cercler la pastille à chaque clic de souris. */
      .ncbm-ico:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
      /* Les deux compartiments du formulaire. Côte à côte tant qu'ils tiennent,
         empilés sous 720 px de formulaire — requête de CONTENEUR et non de
         fenêtre : la modale remplit le cadre du CRM, dont la largeur dépend de
         la barre latérale et du dock MEGGA AI, pas de l'écran. */
      .ncbm-form { container-type: inline-size; }
      .ncbm-cols { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .ncbm-col { display: flex; flex-direction: column; gap: var(--crm-space-2xl); padding: var(--crm-space-4xl) var(--crm-space-6xl) var(--crm-space-6xl); min-width: 0; }
      .ncbm-col-b { border-left: 1px solid ${C.line}; }
      @container (max-width: 720px) {
        .ncbm-cols { grid-template-columns: minmax(0, 1fr); }
        .ncbm-col-b { border-left: 0; border-top: 1px solid ${C.line}; }
      }
      @keyframes sgFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  )

  // ══════════════════ Écran de confirmation « héros » ══════════════════
  if (created) {
    const GREEN = C.typeColor.landlord
    const heroVeil = C.dark ? 'rgba(3,3,3,0.10)' : 'rgba(255,255,255,0.12)'
    const heroSub = C.dark ? 'rgba(3,3,3,0.60)' : 'rgba(255,255,255,0.72)'
    const heroChev = C.dark ? 'rgba(3,3,3,0.70)' : 'rgba(255,255,255,0.85)'
    return (
      <div className={C.dark ? 'ncbm-dark' : undefined} style={shellStyle}>
        {focusCss}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 46 }}>
          <div style={{ width: 560, display: 'flex', flexDirection: 'column', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginBottom: 20 }}>
              <NcbAvatarM photo={f.photo} initials={initials} color={tc} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: GREEN }}>{t('newContactPager.created.eyebrow')}</div>
                <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: C.ink, marginTop: 1 }}>{fullName}</div>
              </div>
              <NcbTypePillM C={C} type={f.type} label={typeLabel(f.type)} />
            </div>
            <button
              type="button"
              onClick={onOpenMatching}
              style={{ fontFamily: 'inherit', cursor: 'pointer', border: 0, textAlign: 'left', background: C.accent, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-6xl) var(--crm-space-7xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)', boxShadow: C.dark ? '0 20px 44px rgba(0,0,0,0.5)' : '0 20px 44px rgba(3,3,3,0.26)' }}
            >
              <span style={{ width: 48, height: 48, borderRadius: 'var(--crm-radius-xl)', flexShrink: 0, display: 'grid', placeItems: 'center', background: heroVeil }}>
                <NcvIcon name="sparkle" size={24} stroke={C.onAccent} sw={1.9} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 500, color: C.onAccent, letterSpacing: -0.3 }}>{t('newContactPager.created.heroTitle')}</div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: heroSub, marginTop: 3 }}>{t('newContactPager.created.heroSub')}</div>
              </div>
              <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(-90deg)' }}>
                <NcvIcon name="chevron" size={20} stroke={heroChev} sw={2.2} />
              </span>
            </button>
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
              <SecTileM C={C} icon="shield" title={t('newContactPager.created.kycTitle')} sub={t('newContactPager.created.kycSub')} onClick={onOpenKyc ?? onClose} />
              <SecTileM C={C} icon="user" title={t('newContactPager.created.ficheTitle')} sub={t('newContactPager.created.ficheSub')} onClick={onOpenFiche ?? onClose} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
              <NcbCtaM C={C} tone="ghost" icon="plus" onClick={reset}>{t('newContactPager.created.createAnother')}</NcbCtaM>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════ Formulaire — bento fusionné (concept D) ══════════════
  // Ligne méta « argent » : jamais de concaténation brute, formatCHF porte
  // l'apostrophe suisse (CHF 900'000) exigée par CLAUDE.md §6.
  const budgetLine = isBuyer
    ? (f.type === 'tenant'
      ? (rMax !== null ? formatRent(rMax) : null)
      : (bMin !== null || bMax !== null ? `${bMin !== null ? formatCHF(bMin) : '…'} – ${bMax !== null ? formatCHF(bMax) : '…'}` : null))
    : (f.address.trim() || null)
  const budgetFallback = isBuyer
    ? (f.type === 'tenant' ? t('newContactPager.preview.rentMax') : t('newContactPager.preview.budget'))
    : t('newContactPager.preview.propertyAddress')
  const critTitle = isBuyer
    // « Critères » tout court : l'achat ou la location se lit déjà dans le sélecteur de type.
    ? t('newContactPager.criteria')
    : (f.type === 'seller' ? t('newContact.property.titleSell') : t('newContact.property.titleRent'))
  const messages: string[] = []
  // Message dédié : sinon une date impossible grise le CTA en affichant « Prénom, nom
  // et e-mail valide requis », alors que ces trois champs sont corrects.
  if (tried && birthKo) messages.push(t('newContactPager.birthError'))
  if (tried && !birthKo && emailSaisi && !emailOk) messages.push(t('newContactPager.emailError'))
  else if (tried && !identiteOk && !birthKo) messages.push(t('newContactPager.validationError'))
  if (tried && budgetKo) messages.push(t('newContactPager.budgetOrder'))
  if (error) messages.push(error)

  // ⌘⏎ / Ctrl⏎ crée depuis n'importe quel champ : la main reste sur le clavier du
  // prénom jusqu'à la note, sans aller chercher le bouton en bas de l'aperçu.
  const onRaccourci = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Pas sous la confirmation : ⌘⏎ n'y doit pas valoir « créer sans l'identité ».
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !confirmIdentite && !collerOuvert) { e.preventDefault(); void submit() }
  }

  const titreSection: CSSProperties = { margin: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: C.ink }

  // Beta v1 supprime le titre héros (D7) : sans lui la modale n'a plus aucun nom
  // accessible. Le libellé du panneau sert de nom, sans rien ajouter à l'écran.
  return (
    <div ref={refPiege} role="dialog" aria-modal="true" aria-label={t('newContactPager.expressCard')} className={C.dark ? 'ncbm-dark' : undefined} style={shellStyle} onKeyDown={onRaccourci}>
      {focusCss}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ⚠ BENTO FUSIONNÉ : ni padding ni gap. Les colonnes touchent le cadre et
            se touchent entre elles — c'est la SEULE façon qu'elles lisent comme une
            surface unique et non comme des cartes posées dedans. Le rayon vit ici,
            et `overflow: hidden` le fait porter à toutes : leur donner chacune le
            leur rouvrirait la couture.

            ⚠ SANS GAP, C'EST UN FILET QUI SÉPARE — pas un écart de ton. Premier
            essai : donner à chaque colonne un palier différent. Mesuré, ça ne
            sépare RIEN — 1,024:1 en sombre, quand `CLAUDE.md` §3 cite justement
            1,036:1 comme l'écart qui ne se voit pas. Ce sont les `border*` des
            compartiments qui font le travail. Même geste que `NewDealModal`.

            ⛔ PAS DE LARGEUR BORNÉE. Un `maxWidth` centré (16.09.2026) laissait le
            fond de page de part et d'autre sur un écran large : la modale épouse le
            pager ENTIER (Julien). Ce sont les compartiments qui gardent les cases
            courtes, pas une borne. */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden', background: C.surfaceBg, boxShadow: C.cardShadow }}>

          {/* Aperçu vivant — se remplit pendant la saisie */}
          <PreviewColM
            C={C}
            photo={f.photo}
            initials={initials}
            tint={tc}
            type={f.type}
            typeLabel={typeLabel(f.type)}
            fullName={fullName}
            email={emailOk ? f.email.trim() : ''}
            // Affiché comme l'agent l'a tapé, indicatif devant — la valeur ENVOYÉE reste
            // `f.phone`, compacte (+41794128803), que la passerelle WhatsApp attend.
            phone={f.phone ? `+${COUNTRY_DIAL_CODES[paysTel] ?? '41'} ${numeroLocal.trim().replace(/^0+/, '')}` : ''}
            birth={f.birth}
            budgetLine={budgetLine}
            cantonsLine={f.cantons.length || f.cities.length ? [...f.cantons, ...f.cities].join(' · ') : null}
            isBuyer={isBuyer}
            labels={{
              namePlaceholder: t('newContactPager.preview.name'),
              email: t('newContactPager.email'),
              phone: t('newContactPager.phone'),
              birth: t('newContactPager.birth'),
              budget: budgetFallback,
              cantons: t('newContact.cantons'),
              cancel: t('newContactPager.cancel'),
              addPhoto: t('newContactPager.addPhoto'),
              removePhoto: t('newContactPager.removePhoto'),
              shortcut: t('newContact.shortcutCreate'),
            }}
            alerte={duplicates.length > 0 ? (
              <DoublonsM
                C={C}
                doublons={duplicates}
                existsLabel={t('newContactPager.duplicate.exists')}
                openLabel={t('newContactPager.duplicate.open')}
                onOpen={onOpenDuplicate}
              />
            ) : null}
            messages={messages}
            canSubmit={canSubmit}
            submitLabel={isPending ? t('newContact.creating') : duplicates.length > 0 ? t('newContactPager.duplicate.createAnyway') : t('newContact.submit')}
            onSubmit={() => void submit()}
            onCancel={onClose}
            onPick={onPickPhoto}
            onClear={clearPhoto}
          />

          {/* Fiche express — le type en tête, puis DEUX compartiments côte à côte :
              qui est la personne, et ce qu'elle cherche (ou le bien qu'elle confie). */}
          <div className="ncbm-form" style={{ flex: 1, minWidth: 0, background: C.cardSubtle, borderLeft: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-lg) var(--crm-space-2xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl)', borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: C.ink }}>{t('newContactPager.expressCard')}</div>
              {/* Type — segmenté compact : il décide du second compartiment, il se
                  choisit donc AVANT, et d'un seul regard. */}
              <div style={{ display: 'flex', gap: 'var(--crm-space-2xs)', background: C.white, padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', boxShadow: C.shadowSm }}>
                {TYPE_IDS.map((id) => {
                  const on = f.type === id
                  const col = C.typeColor[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setF((s) => ({ ...s, type: id }))}
                      style={{
                        height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap',
                        background: on ? col : 'transparent', color: on ? '#fff' : C.inkSoft,
                      }}
                    >
                      {typeLabel(id)}
                    </button>
                  )
                })}
              </div>
              <div style={{ flex: 1 }} />
              {onExtract && (() => {
                // Deux états. Avant : « ✦ Coller un message ». Après : « ⚠ À vérifier », en ambre
                // DOUX (Julien, 16.09.2026) — plus d'étoile, plus de « prérempli » : l'agent doit
                // relire, c'est tout ce que la pastille a à dire. Un clic recolle un message.
                // Clair : la paire fond/encre d'alerte partagée (`STATUT_CLAIR`, 4,9:1). Sombre :
                // le jaune de la direction en encre (≈10:1), sur ce même jaune très atténué.
                // Filet de 2 px, teinté de l'ENCRE et non plus du jaune pâle : à 1 px il se perdait
                // dans le fond, et la pastille se lisait comme un bouton ordinaire.
                const ambre = C.dark
                  ? { fond: `${MXC_SYSTEM.yellow400}1f`, encre: MXC_SYSTEM.yellow400, filet: `${MXC_SYSTEM.yellow400}73` }
                  : { fond: STATUT_CLAIR.warnFill, encre: STATUT_CLAIR.warnInk, filet: `${STATUT_CLAIR.warnInk}59` }
                return (
                  <button
                    type="button"
                    className="ncbm-ico"
                    onClick={() => { setCollerErreur(null); setCollerOuvert(true) }}
                    style={{
                      height: 36, borderRadius: 'var(--crm-radius-pill)', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', whiteSpace: 'nowrap',
                      ...(prerempli
                        ? { border: `2px solid ${ambre.filet}`, background: ambre.fond, color: ambre.encre, boxShadow: 'none', padding: '0 var(--crm-space-2xl) 0 var(--crm-space-lg)' }
                        : { border: 0, background: C.white, color: C.inkSoft, boxShadow: C.shadowSm, padding: '0 var(--crm-space-2xl)' }),
                    }}
                  >
                    {/* Pas d'étoile sur « Coller un message » (retirée le 16.09.2026, décision Julien). */}
                    {prerempli && (
                      // ⚠ Remonté d'un pixel : le triangle porte sa masse en BAS de sa boîte, et
                      // centré géométriquement il paraissait tomber sous la ligne du texte.
                      <MEIcon name="alert" size={16} color={ambre.encre} strokeWidth={2.2} style={{ display: 'block', transform: 'translateY(-1.5px)' }} />
                    )}
                    {prerempli ? t('newContactPager.paste.filled') : t('newContactPager.paste.button')}
                  </button>
                )
              })()}
              <NcbCloseM C={C} onClick={onClose} label={t('newContactPager.close')} />
            </div>

            <div className="ncbm-cols">
              {/* ── Compartiment 1 : qui ── */}
              <section className="ncbm-col">
                {/* Pas d'indice « un e-mail ou un téléphone suffit » sous le titre (retiré le
                    16.09.2026, trop de texte) : la règle se dit au moment où elle bloque —
                    anneau sur les deux cases et message au-dessus du bouton. */}
                <h3 style={titreSection}>{t('detail.contactInfo')}</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                  <NcvFieldM C={C} label={t('newContactPager.civ')}>
                    <select className="ncbm-in" value={f.civ} onChange={onField('civ')} style={selW(C)}>
                      <option value="mrs">{t('newContact.civility.mrs')}</option>
                      <option value="mr">{t('newContact.civility.mr')}</option>
                    </select>
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.firstName')} required>
                    {/* Le focus s'ouvre ICI : le type a un défaut, le prénom n'en a pas. */}
                    <input className="ncbm-in" autoFocus autoComplete="off" value={f.firstName} onChange={onField('firstName')} style={inpW(C, tried && !f.firstName.trim())} />
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.lastName')} required>
                    <input className="ncbm-in" autoComplete="off" value={f.lastName} onChange={onField('lastName')} style={inpW(C, tried && !f.lastName.trim())} />
                  </NcvFieldM>
                </div>

                <NcvFieldM C={C} label={t('newContactPager.email')}>
                  <input className="ncbm-in" type="email" inputMode="email" autoComplete="off" value={f.email} onChange={onField('email')} placeholder={t('newContactPager.emailPlaceholder')} style={inpW(C, tried && (emailSaisi ? !emailOk : !joignable))} />
                </NcvFieldM>

                <NcvFieldM C={C} label={t('newContactPager.phone')}>
                  {/* ⚠ Colonne d'indicatif à largeur BORNÉE : un `<select>` prend la
                      largeur de sa plus longue option, et « Îles Salomon +677 »
                      écraserait la colonne du numéro. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 8.5rem) minmax(0, 1fr)', gap: 'var(--crm-space-sm)' }}>
                    <select className="ncbm-in" value={paysTel} onChange={(e) => majPaysTel(e.target.value)}
                            aria-label={t('newContactPager.dialCode')} style={selW(C)}>
                      {optionsIndicatif.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input className="ncbm-in" type="tel" inputMode="tel" autoComplete="off" value={numeroLocal}
                           onChange={(e) => majNumeroLocal(e.target.value)} style={{ ...inpW(C, tried && !joignable), ...MONO }} />
                  </div>
                </NcvFieldM>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                  <NcvFieldM C={C} label={t('newContactPager.lang')}>
                    <select className="ncbm-in" value={f.lang} onChange={onField('lang')} style={selW(C)}>
                      <option value="fr">{t('newContactPager.langOpt.fr')}</option>
                      <option value="de">{t('newContactPager.langOpt.de')}</option>
                      <option value="en">{t('newContactPager.langOpt.en')}</option>
                      <option value="it">{t('newContactPager.langOpt.it')}</option>
                    </select>
                  </NcvFieldM>
                  {/* Naissance (LBA, en clair) */}
                  <NcvFieldM C={C} label={t('newContactPager.birth')}>
                    <ChampDateNaissance
                      pal={palChamps}
                      styleChamp={() => ({ ...inpW(C, isInvalidSwissDate(f.birth)), ...MONO })}
                      classeChamp="ncbm-in"
                      classeBouton="ncbm-ico"
                      value={f.birth}
                      onChange={(v) => setF((s) => ({ ...s, birth: v }))}
                      invalid={isInvalidSwissDate(f.birth)}
                      placeholder={t('newContactPager.birthPlaceholder')}
                      champ="birth"
                      labels={{
                        open: t('onboarding:wizard.date.open'),
                        previousMonth: t('onboarding:wizard.date.previousMonth'),
                        nextMonth: t('onboarding:wizard.date.nextMonth'),
                        month: t('onboarding:wizard.date.month'),
                        year: t('onboarding:wizard.date.year'),
                      }}
                    />
                  </NcvFieldM>
                </div>

                <NcvFieldM C={C} label={t('newContactPager.canal')}>
                  <div style={{ display: 'flex', gap: 'var(--crm-space-2xs)', background: C.white, padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-lg)', boxShadow: C.shadowSm }}>
                    {(['whatsapp', 'sms', 'call', 'email'] as const).map((cv) => {
                      const on = f.canal === cv
                      return (
                        <button
                          key={cv}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setF((s) => ({ ...s, canal: cv }))}
                          style={{ flex: 1, height: 30, borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', background: on ? C.accent : 'transparent', color: on ? C.onAccent : C.muted }}
                        >
                          {t(`newContactPager.canalOpt.${cv}`)}
                        </button>
                      )
                    })}
                  </div>
                </NcvFieldM>

                {/* Identité complète — replié par défaut (données LBA secondaires) */}
                <button
                  type="button"
                  aria-expanded={moreId}
                  onClick={() => setMoreId((m) => !m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' }}
                >
                  <span style={{ display: 'grid', placeItems: 'center', transform: moreId ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}>
                    <NcvIcon name="chevron" size={14} stroke={C.muted} sw={2} />
                  </span>
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: C.inkSoft }}>{t('newContactPager.moreIdentity')}</span>
                  {!moreId && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted }}>{t('newContactPager.moreIdentityHint')}</span>}
                </button>
                {moreId && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                      <NcvFieldM C={C} label={t('newContactPager.nationality')}>
                        <select className="ncbm-in" data-champ="nationality" value={f.nationality} onChange={onField('nationality')} style={selW(C)}>
                          <option value="">{t('fiche.identity.countryNone')}</option>
                          {COUNTRIES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                      </NcvFieldM>
                      <NcvFieldM C={C} label={t('newContactPager.residence')}>
                        <select className="ncbm-in" data-champ="residence" value={f.residence} onChange={onField('residence')} style={selW(C)}>
                          <option value="">{t('fiche.identity.countryNone')}</option>
                          {COUNTRIES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                        </select>
                      </NcvFieldM>
                    </div>
                    <NcvFieldM C={C} label={t('newContactPager.homeAddress')}>
                      {/* Mêmes suggestions pour le domicile ; une adresse à l'étranger se tape librement. */}
                      <ChampAdresseSuisse
                        pal={palChamps}
                        styleChamp={() => inpW(C)}
                        classeChamp="ncbm-in"
                        champ="homeAddress"
                        value={f.homeAddress}
                        onChange={(v) => setF((s) => ({ ...s, homeAddress: v }))}
                        format={(s) => `${s.street}, ${s.postalCode} ${s.city}`}
                        listLabel={t('onboarding:wizard.agence.address.listLabel')}
                      />
                    </NcvFieldM>
                  </>
                )}
              </section>

              {/* ── Compartiment 2 : ce qu'elle cherche, ou le bien — adapté au type ── */}
              <section className="ncbm-col ncbm-col-b">
                <h3 style={titreSection}>{critTitle}</h3>
                {isBuyer ? (
                  <>
                    {/* Montants, puis pièces et surface. Le locataire n'a qu'un montant : ses
                        trois cases tiennent sur une rangée. */}
                    {f.type === 'tenant' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--crm-space-lg)' }}>
                        <NcvFieldM C={C} label={t('newContactPager.rentMax')}>
                          <NcbMontantM C={C} value={f.rentMax} onChange={setMontant('rentMax')} placeholder={t('newContactPager.rentMaxPlaceholder')} />
                        </NcvFieldM>
                        <NcvFieldM C={C} label={t('newContact.minRooms')}>
                          <NcbPasM C={C} value={f.rooms} onChange={(v) => setF((s) => ({ ...s, rooms: v }))} pas={0.5} min={1} max={20} depart={3.5} placeholder={t('newContactPager.roomsPlaceholder')} labelPlus={t('newContactPager.stepUp')} labelMoins={t('newContactPager.stepDown')} />
                        </NcvFieldM>
                        <NcvFieldM C={C} label={t('fiche.crit.areaMin')}>
                          <NcbPasM C={C} value={f.surface} onChange={(v) => setF((s) => ({ ...s, surface: v }))} pas={5} min={10} max={2000} depart={80} placeholder="m²" labelPlus={t('newContactPager.stepUp')} labelMoins={t('newContactPager.stepDown')} />
                        </NcvFieldM>
                      </div>
                    ) : (
                      <>
                        <div data-budget="" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                          {(['budgetMin', 'budgetMax'] as const).map((k) => (
                            <NcvFieldM key={k} C={C} label={t(`newContactPager.${k}`)}>
                              <NcbMontantM
                                C={C}
                                value={f[k]}
                                onChange={setMontant(k)}
                                placeholder={t(`newContactPager.${k}Placeholder`)}
                                err={budgetKoVisible}
                                onFocus={() => setBudgetEnSaisie(true)}
                                onBlur={quitterBudget}
                              />
                            </NcvFieldM>
                          ))}
                          {budgetKoVisible && (
                            <p role="alert" style={{ gridColumn: '1 / -1', margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.errText }}>
                              {t('newContactPager.budgetOrder')}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                          <NcvFieldM C={C} label={t('newContact.minRooms')}>
                            <NcbPasM C={C} value={f.rooms} onChange={(v) => setF((s) => ({ ...s, rooms: v }))} pas={0.5} min={1} max={20} depart={3.5} placeholder={t('newContactPager.roomsPlaceholder')} labelPlus={t('newContactPager.stepUp')} labelMoins={t('newContactPager.stepDown')} />
                          </NcvFieldM>
                          <NcvFieldM C={C} label={t('fiche.crit.areaMin')}>
                            <NcbPasM C={C} value={f.surface} onChange={(v) => setF((s) => ({ ...s, surface: v }))} pas={5} min={10} max={2000} depart={80} placeholder="m²" labelPlus={t('newContactPager.stepUp')} labelMoins={t('newContactPager.stepDown')} />
                          </NcvFieldM>
                        </div>
                      </>
                    )}
                    <NcvFieldM C={C} label={t('newContact.propertyTypeLabel')}>
                      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                        {(['appartement', 'maison', 'terrain', 'commercial'] as const).map((id) => (
                          <NcvChipM key={id} C={C} active={f.pTypes.includes(id)} check={false} onWhite onClick={() => toggleIn('pTypes', id)}>
                            {t(`newContact.propertyType.${id === 'appartement' ? 'apartment' : id === 'maison' ? 'house' : id === 'terrain' ? 'land' : 'commercial'}`)}
                          </NcvChipM>
                        ))}
                      </div>
                    </NcvFieldM>
                    <NcvFieldM C={C} label={t('newContact.cantons')}>
                      <NcbCantonPickerM C={C} value={f.cantons} onChange={(v) => setF((s) => ({ ...s, cantons: v }))} placeholder={t('newContactPager.cantonPlaceholder')} />
                    </NcvFieldM>
                    {/* Communes et quartiers : ils n'arrivent que d'un message collé, d'où une
                        rangée qui n'existe que s'il y en a — chacun se retire d'un clic. */}
                    {f.cities.length > 0 && (
                      <NcvFieldM C={C} label={t('fiche.crit.sectors')}>
                        <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                          {f.cities.map((ville) => (
                            <button
                              key={ville}
                              type="button"
                              className="ncbm-ico"
                              aria-label={`${ville} ×`}
                              onClick={() => setF((s) => ({ ...s, cities: s.cities.filter((v) => v !== ville) }))}
                              style={{ height: 34, padding: '0 var(--crm-space-md) 0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: C.accent, color: C.onAccent, boxShadow: 'none', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', whiteSpace: 'nowrap' }}
                            >
                              {ville}
                              <NcvIcon name="x" size={11} stroke={C.onAccent} sw={2.4} />
                            </button>
                          ))}
                        </div>
                      </NcvFieldM>
                    )}
                    <NcvFieldM C={C} label={t('fiche.crit.mustHave')}>
                      <div style={{ display: 'flex', gap: 'var(--crm-space-sm)', flexWrap: 'wrap' }}>
                        {FEATURES.map((ft) => (
                          <NcvChipM key={ft.id} C={C} active={f.features.includes(ft.id)} check={false} onWhite onClick={() => toggleIn('features', ft.id)}>
                            {t(ft.k)}
                          </NcvChipM>
                        ))}
                      </div>
                    </NcvFieldM>
                  </>
                ) : (
                  <>
                    <NcvFieldM C={C} label={t('newContact.property.address')}>
                      <ChampAdresseSuisse
                        pal={palChamps}
                        styleChamp={() => inpW(C)}
                        classeChamp="ncbm-in"
                        value={f.address}
                        onChange={(v) => setF((s) => ({ ...s, address: v }))}
                        format={(s) => `${s.street}, ${s.postalCode} ${s.city}`}
                        placeholder={t('newContactPager.addressPlaceholder')}
                        listLabel={t('onboarding:wizard.agence.address.listLabel')}
                      />
                    </NcvFieldM>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--crm-space-lg)' }}>
                      <NcvFieldM C={C} label={t('newContact.property.type')}>
                        <select className="ncbm-in" value={f.propType} onChange={onField('propType')} style={selW(C)}>
                          <option value="appartement">{t('newContact.propertyType.apartment')}</option>
                          <option value="maison">{t('newContact.propertyType.house')}</option>
                          <option value="terrain">{t('newContact.propertyType.land')}</option>
                          <option value="commercial">{t('newContact.propertyType.commercial')}</option>
                        </select>
                      </NcvFieldM>
                    </div>
                  </>
                )}

                {/* Note — absorbe la hauteur résiduelle du compartiment */}
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'block', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted, marginBottom: 'var(--crm-space-sm)' }}>{t('newContactPager.note')}</label>
                  <textarea
                    className="ncbm-in"
                    value={f.note}
                    onChange={onField('note')}
                    placeholder={t('newContactPager.notePlaceholder')}
                    style={{ ...inpW(C), flex: 1, height: 'auto', minHeight: 96, padding: 'var(--crm-space-lg) var(--crm-space-xl)', resize: 'none', lineHeight: 1.5, display: 'block' }}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {collerOuvert && (
        <NcbCollerMessageM
          C={C}
          enCours={collerEnCours}
          erreur={collerErreur}
          labels={{
            title: t('newContactPager.paste.button'),
            placeholder: t('newContactPager.paste.placeholder'),
            analyze: t('import.lead.analyze'),
            analyzing: t('import.lead.analyzing'),
            cancel: t('newContactPager.cancel'),
          }}
          onAnalyser={(texte) => void analyserMessage(texte)}
          onFermer={() => { if (!collerEnCours) setCollerOuvert(false) }}
        />
      )}

      {confirmIdentite && (
        <NcbIdentiteConfirmM
          C={C}
          manquants={identiteManquante.map((c) => c.label)}
          labels={{
            title: t('newContactPager.identityConfirm.title'),
            body: t('newContactPager.identityConfirm.body'),
            complete: t('newContactPager.identityConfirm.complete'),
            createAnyway: t('newContactPager.identityConfirm.createAnyway'),
          }}
          onCancel={() => setConfirmIdentite(false)}
          onCreateAnyway={() => { setConfirmIdentite(false); void submit(true) }}
          onComplete={() => {
            setConfirmIdentite(false)
            // La date vit hors du bloc replié ; les trois autres dedans.
            if (identiteManquante.some((c) => c.champ !== 'birth')) setMoreId(true)
            champAFocaliser.current = identiteManquante[0]?.champ ?? null
          }}
        />
      )}

      {cropSrc && (
        <NcbCropEditorM
          C={C}
          src={cropSrc}
          tint={tc}
          onCancel={() => setCropSrc(null)}
          onDone={(url) => { setF((s) => ({ ...s, photo: url })); setCropSrc(null) }}
          title={t('newContactPager.crop.title')}
          hint={t('newContactPager.crop.hint')}
          cancelLabel={t('newContactPager.cancel')}
          validateLabel={t('newContactPager.crop.validate')}
        />
      )}
    </div>
  )
}
