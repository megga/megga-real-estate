// MEGGA CRM Sugar v2 — Nouveau contact (modal 880px, 2 colonnes)
// 1:1 port from `crm-screen-contacts-sugar-new.jsx` (CtModalNewContact).

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Trans, useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'

export type NewContactType = 'buyer' | 'tenant' | 'seller' | 'landlord'

export interface NewContactPayload {
  type: NewContactType
  civility: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lang: string
  source: string
  assignedTo: string
  tags: string[]
  notes: string
  criteria?: {
    transaction: 'vente' | 'location'
    types: string[]
    cantons: string[]
    budgetMin?: number
    budgetMax?: number
    roomsMin?: number
  }
  linkedBien?: {
    address: string
    type: string
    rooms?: number
  }
}

// Listes constantes : on conserve des clés i18n stables (`labelKey`/`descKey`)
// résolues au rendu via `t(...)` — pas de texte FR en dur.
const NC_TYPES: {
  id: NewContactType
  labelKey: string
  icon: MEIconName
  color: string
  descKey: string
}[] = [
  { id: 'buyer', labelKey: 'contactType.buyer', icon: 'search', color: '#0041D9', descKey: 'newContact.typeDesc.buyer' },
  { id: 'tenant', labelKey: 'contactType.tenant', icon: 'home', color: '#06B6D4', descKey: 'newContact.typeDesc.tenant' },
  { id: 'seller', labelKey: 'contactType.seller', icon: 'flag', color: '#B45309', descKey: 'newContact.typeDesc.seller' },
  { id: 'landlord', labelKey: 'contactType.landlord', icon: 'building', color: '#0E9F6E', descKey: 'newContact.typeDesc.landlord' },
]

const NC_CIVILITIES = [
  { id: 'mr', labelKey: 'newContact.civility.mr' },
  { id: 'mrs', labelKey: 'newContact.civility.mrs' },
  { id: 'x', labelKey: 'newContact.civility.other' },
]

// Codes de langue affichés tels quels (FR/DE/IT/EN) — non traduits.
const NC_LANGS = [
  { id: 'fr', label: 'FR' },
  { id: 'de', label: 'DE' },
  { id: 'it', label: 'IT' },
  { id: 'en', label: 'EN' },
]

const NC_SOURCES = [
  { id: 'website', labelKey: 'newContact.source.website' },
  { id: 'referral', labelKey: 'newContact.source.referral' },
  { id: 'portal', labelKey: 'newContact.source.portal' },
  { id: 'walk-in', labelKey: 'newContact.source.walkIn' },
  { id: 'csv', labelKey: 'newContact.source.import' },
  { id: 'other', labelKey: 'newContact.source.other' },
]

const NC_AGENTS = [
  { id: 'agt-1', name: 'Gregory Lyonnet' },
  { id: 'agt-2', name: 'Mathilde Laurent' },
  { id: 'agt-3', name: 'Romain Saulnier' },
  { id: 'agt-4', name: 'Élodie Chen' },
]

// Valeurs de tags persistées telles quelles (deviennent la donnée stockée) —
// non traduites.
const NC_TAG_SUGGESTIONS = [
  'famille', 'primo-accédant', 'investisseur', 'haute valeur',
  'urgent', 'succession', 'expat', 'locataire',
]

const NC_PROPERTY_TYPES = [
  { id: 'appartement', labelKey: 'newContact.propertyType.apartment' },
  { id: 'maison', labelKey: 'newContact.propertyType.house' },
  { id: 'terrain', labelKey: 'newContact.propertyType.land' },
  { id: 'commercial', labelKey: 'newContact.propertyType.commercial' },
]

const NC_CANTONS = ['GE', 'VD', 'VS', 'FR', 'NE', 'JU', 'BE', 'ZH']

function ncFmtCHF(n: number): string {
  if (!n) return '—'
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1).replace('.', ',') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'k'
  return String(n)
}

interface ModalNewContactProps {
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onSave: (data: NewContactPayload) => void
  /** When true: disable save button, show "Création..." label. Parent should
   * close the modal itself on mutation success. */
  isPending?: boolean
  /** Error message to display inline above the action row (mutation failure). */
  error?: string | null
}

export function ModalNewContact({ sp, dark, onClose, onSave, isPending = false, error = null }: ModalNewContactProps) {
  const { t } = useTranslation('contacts')
  const [type, setType] = useState<NewContactType>('buyer')
  const [civility, setCivility] = useState('mr')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [lang, setLang] = useState('fr')
  const [source, setSource] = useState('website')
  const [assignedTo, setAssigned] = useState('agt-1')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')
  const [rgpd, setRgpd] = useState(false)

  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [propTypes, setPropTypes] = useState<string[]>([])
  const [cantons, setCantons] = useState<string[]>([])
  const [roomsMin, setRoomsMin] = useState('')

  const [bienAddress, setBienAddress] = useState('')
  const [bienType, setBienType] = useState('appartement')
  const [bienRooms, setBienRooms] = useState('')

  const isBuyerSide = type === 'buyer' || type === 'tenant'
  const isSellerSide = type === 'seller' || type === 'landlord'

  const canSave = !!(
    firstName.trim() &&
    lastName.trim() &&
    (email.trim() || phone.trim()) &&
    rgpd
  )

  const handleSave = () => {
    if (!canSave || isPending) return
    onSave({
      type,
      civility,
      firstName,
      lastName,
      email,
      phone,
      lang,
      source,
      assignedTo,
      tags,
      notes,
      criteria: isBuyerSide
        ? {
            transaction: type === 'tenant' ? 'location' : 'vente',
            types: propTypes,
            cantons,
            budgetMin: budgetMin ? Number(budgetMin) : undefined,
            budgetMax: budgetMax ? Number(budgetMax) : undefined,
            roomsMin: roomsMin ? Number(roomsMin) : undefined,
          }
        : undefined,
      linkedBien: isSellerSide
        ? {
            address: bienAddress,
            type: bienType,
            rooms: bienRooms ? Number(bienRooms) : undefined,
          }
        : undefined,
    })
    // NOTE: don't close here — parent closes on mutation success so we can
    // keep the modal open + display the error inline on failure.
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, email, phone, type, rgpd])

  const addTag = (t: string) => {
    const v = (t || '').trim()
    if (!v || tags.includes(v)) return
    setTags([...tags, v])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter(x => x !== t))

  const togglePropType = (id: string) =>
    setPropTypes(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const toggleCanton = (c: string) =>
    setCantons(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))

  // ── Styles ───────────────────────────────────────────────────────
  const modalBg = dark ? '#101019' : '#FFFFFF'
  const surfaceBg = dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'
  const surfaceBorder = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'
  const subSurfaceBg = dark ? 'rgba(255,255,255,0.03)' : '#F5F6F8'
  const fieldBg = dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF'
  const fieldBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)'
  const dividerColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'
  const stripBg = dark ? 'rgba(255,255,255,0.02)' : '#FAFBFC'
  const primaryBg = dark ? '#FFFFFF' : sp.ink
  const primaryInk = dark ? '#0A0A0F' : '#FFFFFF'

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: sp.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    display: 'block',
  }
  const inputStyle: CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    boxSizing: 'border-box',
    background: fieldBg,
    border: `1px solid ${fieldBorder}`,
    borderRadius: 10,
    color: sp.ink,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  }
  const colTitleStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    color: sp.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    margin: '0 0 14px',
    paddingBottom: 8,
    borderBottom: `1px solid ${dividerColor}`,
  }

  return createPortal(
    <div
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-new-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: dark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,42,0.48)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        animation: 'ctModalFade 220ms cubic-bezier(.22,1,.36,1)',
      }}
    >
      <style>{`
        @keyframes ctModalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctModalLift { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
        .nc-input:focus { border-color: ${sp.ink} !important; box-shadow: 0 0 0 3px ${
          dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'
        } !important; }
      `}</style>
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 'min(880px, 100%)',
          maxHeight: 'calc(100vh - 64px)',
          background: modalBg,
          border: `1px solid ${surfaceBorder}`,
          borderRadius: 24,
          boxShadow: '0 24px 64px rgba(15,23,42,0.28)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'ctModalLift 280ms cubic-bezier(.22,1,.36,1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${dividerColor}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: primaryBg,
              color: primaryInk,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <MEIcon name="users" size={16} color={primaryInk} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="ct-new-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -0.4,
              }}
            >
              {t('newContact.title')}
            </h2>
            <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>
              {t('newContact.subtitle')} ·{' '}
              {(() => {
                const dk = NC_TYPES.find(x => x.id === type)?.descKey
                return dk ? t(dk) : ''
              })()}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common:actions.close')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: sp.sub,
              fontSize: 20,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Type segments */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${dividerColor}`,
            background: dark ? 'rgba(255,255,255,0.02)' : '#FAFBFC',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8,
            }}
          >
            {NC_TYPES.map(tt => {
              const active = type === tt.id
              return (
                <button
                  key={tt.id}
                  onClick={() => setType(tt.id)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: active ? primaryBg : surfaceBg,
                    border: `1px solid ${active ? primaryBg : fieldBorder}`,
                    color: active ? primaryInk : sp.ink,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    textAlign: 'left',
                    transition: 'background 140ms ease, border-color 140ms ease',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: active ? 'rgba(255,255,255,0.14)' : `${tt.color}1A`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <MEIcon
                      name={tt.icon}
                      size={14}
                      color={active ? primaryInk : tt.color}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>
                      {t(tt.labelKey)}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        marginTop: 2,
                        lineHeight: 1.2,
                        color: active ? 'rgba(255,255,255,0.65)' : sp.sub,
                        fontWeight: 500,
                      }}
                    >
                      {t(tt.descKey)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Body 2 colonnes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Colonne G : identité */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              borderRight: `1px solid ${dividerColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <h3 style={colTitleStyle}>{t('newContact.identity')}</h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label style={labelStyle}>{t('newContact.civilityLabel')}</label>
                <select
                  value={civility}
                  onChange={e => setCivility(e.target.value)}
                  className="nc-input"
                  style={inputStyle}
                >
                  {NC_CIVILITIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {t(c.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('newContact.firstName')}</label>
                <input
                  className="nc-input"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder={t('newContact.firstNamePlaceholder')}
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div>
                <label style={labelStyle}>{t('newContact.lastName')}</label>
                <input
                  className="nc-input"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder={t('newContact.lastNamePlaceholder')}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('newContact.email')}</label>
              <input
                className="nc-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="m.bertrand@bluewin.ch"
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr',
                gap: 10,
              }}
            >
              <div>
                <label style={labelStyle}>{t('newContact.phone')}</label>
                <input
                  className="nc-input"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+41 79 412 88 02"
                  style={{
                    ...inputStyle,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>{t('newContact.language')}</label>
                <div style={{ display: 'flex', gap: 4, height: 38 }}>
                  {NC_LANGS.map(l => {
                    const active = lang === l.id
                    return (
                      <button
                        key={l.id}
                        onClick={() => setLang(l.id)}
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          background: active ? primaryBg : fieldBg,
                          border: `1px solid ${active ? primaryBg : fieldBorder}`,
                          color: active ? primaryInk : sp.ink,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {l.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>{t('newContact.leadSource')}</label>
                <select
                  className="nc-input"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  style={inputStyle}
                >
                  {NC_SOURCES.map(s => (
                    <option key={s.id} value={s.id}>
                      {t(s.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('newContact.assignedAgent')}</label>
                <select
                  className="nc-input"
                  value={assignedTo}
                  onChange={e => setAssigned(e.target.value)}
                  style={inputStyle}
                >
                  {NC_AGENTS.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('newContact.tags')}</label>
              {tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  {tags.map(t => (
                    <span
                      key={t}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px 4px 10px',
                        borderRadius: 999,
                        background: subSurfaceBg,
                        color: sp.ink,
                        fontSize: 11,
                        fontWeight: 600,
                        border: `1px solid ${fieldBorder}`,
                      }}
                    >
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        style={{
                          background: 'none',
                          border: 0,
                          color: sp.sub,
                          cursor: 'pointer',
                          fontSize: 12,
                          lineHeight: 1,
                          padding: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="nc-input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (e.key === 'Backspace' && !tagInput && tags.length) {
                    setTags(tags.slice(0, -1))
                  }
                }}
                placeholder={t('newContact.tagPlaceholder')}
                style={inputStyle}
              />
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 5,
                  marginTop: 8,
                }}
              >
                {NC_TAG_SUGGESTIONS.filter(s => !tags.includes(s))
                  .slice(0, 5)
                  .map(s => (
                    <button
                      key={s}
                      onClick={() => addTag(s)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 999,
                        background: 'transparent',
                        border: `1px dashed ${fieldBorder}`,
                        color: sp.sub,
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      + {s}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label style={labelStyle}>{t('newContact.note')}</label>
              <textarea
                className="nc-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('newContact.notePlaceholder')}
                style={{
                  ...inputStyle,
                  height: 76,
                  padding: '10px 12px',
                  resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
            </div>
          </div>

          {/* Colonne D : contextuelle */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {isBuyerSide && (
              <>
                <h3 style={colTitleStyle}>
                  {type === 'tenant'
                    ? t('newContact.searchCriteria.titleRent')
                    : t('newContact.searchCriteria.titleBuy')}
                </h3>

                <div>
                  <label style={labelStyle}>
                    {type === 'tenant'
                      ? t('newContact.searchCriteria.maxRent')
                      : t('newContact.searchCriteria.budget')}
                  </label>
                  {type === 'tenant' ? (
                    <input
                      className="nc-input"
                      type="number"
                      inputMode="numeric"
                      value={budgetMax}
                      onChange={e => setBudgetMax(e.target.value)}
                      placeholder="3500"
                      style={{
                        ...inputStyle,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <input
                        className="nc-input"
                        type="number"
                        inputMode="numeric"
                        value={budgetMin}
                        onChange={e => setBudgetMin(e.target.value)}
                        placeholder={t('newContact.searchCriteria.budgetMinPlaceholder')}
                        style={{
                          ...inputStyle,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                      <input
                        className="nc-input"
                        type="number"
                        inputMode="numeric"
                        value={budgetMax}
                        onChange={e => setBudgetMax(e.target.value)}
                        placeholder={t('newContact.searchCriteria.budgetMaxPlaceholder')}
                        style={{
                          ...inputStyle,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      />
                    </div>
                  )}
                  {(budgetMin || budgetMax) && (
                    <div
                      style={{
                        fontSize: 11,
                        color: sp.sub,
                        marginTop: 6,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    >
                      {budgetMin ? ncFmtCHF(Number(budgetMin)) : '—'} →{' '}
                      {budgetMax ? ncFmtCHF(Number(budgetMax)) : '—'} CHF
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>{t('newContact.propertyTypeLabel')}</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {NC_PROPERTY_TYPES.map(p => {
                      const active = propTypes.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePropType(p.id)}
                          style={{
                            height: 32,
                            padding: '0 12px',
                            borderRadius: 999,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            background: active ? primaryBg : fieldBg,
                            border: `1px solid ${active ? primaryBg : fieldBorder}`,
                            color: active ? primaryInk : sp.ink,
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {active && <span style={{ fontSize: 10 }}>✓</span>}
                          {t(p.labelKey)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t('newContact.cantons')}</label>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {NC_CANTONS.map(c => {
                      const active = cantons.includes(c)
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCanton(c)}
                          style={{
                            width: 38,
                            height: 30,
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            background: active ? primaryBg : fieldBg,
                            border: `1px solid ${active ? primaryBg : fieldBorder}`,
                            color: active ? primaryInk : sp.ink,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.3,
                          }}
                        >
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>{t('newContact.minRooms')}</label>
                  <input
                    className="nc-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    step="0.5"
                    value={roomsMin}
                    onChange={e => setRoomsMin(e.target.value)}
                    placeholder={t('newContact.minRoomsPlaceholder')}
                    style={{
                      ...inputStyle,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: subSurfaceBg,
                    border: `1px solid ${fieldBorder}`,
                    fontSize: 11.5,
                    color: sp.sub,
                    lineHeight: 1.55,
                  }}
                >
                  <Trans
                    t={t}
                    i18nKey="newContact.matchingHint"
                    components={{ strong: <strong style={{ color: sp.ink }} />, br: <br /> }}
                  />
                </div>
              </>
            )}

            {isSellerSide && (
              <>
                <h3 style={colTitleStyle}>
                  {type === 'seller'
                    ? t('newContact.property.titleSell')
                    : t('newContact.property.titleRent')}
                </h3>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: subSurfaceBg,
                    border: `1px solid ${fieldBorder}`,
                    fontSize: 11.5,
                    color: sp.sub,
                    lineHeight: 1.55,
                    marginBottom: 6,
                  }}
                >
                  <Trans
                    t={t}
                    i18nKey="newContact.property.minFicheHint"
                    components={{ strong: <strong style={{ color: sp.ink }} /> }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>{t('newContact.property.address')}</label>
                  <input
                    className="nc-input"
                    value={bienAddress}
                    onChange={e => setBienAddress(e.target.value)}
                    placeholder={t('newContact.property.addressPlaceholder')}
                    style={inputStyle}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr',
                    gap: 10,
                  }}
                >
                  <div>
                    <label style={labelStyle}>{t('newContact.property.type')}</label>
                    <select
                      className="nc-input"
                      value={bienType}
                      onChange={e => setBienType(e.target.value)}
                      style={inputStyle}
                    >
                      {NC_PROPERTY_TYPES.map(p => (
                        <option key={p.id} value={p.id}>
                          {t(p.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>{t('newContact.property.rooms')}</label>
                    <input
                      className="nc-input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="20"
                      step="0.5"
                      value={bienRooms}
                      onChange={e => setBienRooms(e.target.value)}
                      placeholder="4.5"
                      style={{
                        ...inputStyle,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    />
                  </div>
                </div>

                <button
                  style={{
                    height: 40,
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: subSurfaceBg,
                    border: `1px dashed ${fieldBorder}`,
                    color: sp.soft,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <MEIcon name="plus" size={12} color={sp.soft} />
                  {t('newContact.property.openWizard')}
                </button>

                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: subSurfaceBg,
                    border: `1px solid ${fieldBorder}`,
                    fontSize: 11.5,
                    color: sp.sub,
                    lineHeight: 1.55,
                  }}
                >
                  <Trans
                    t={t}
                    i18nKey="newContact.property.mandateKycHint"
                    components={{ strong: <strong style={{ color: sp.ink }} /> }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${dividerColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: stripBg,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: 11.5,
              color: sp.soft,
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={rgpd}
              onChange={e => setRgpd(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: sp.ink,
                margin: 0,
                cursor: 'pointer',
              }}
            />
            <Trans
              t={t}
              i18nKey="newContact.gdprConsent"
              components={{ strong: <strong style={{ color: sp.ink, fontWeight: 700 }} /> }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {error && (
              <div
                role="alert"
                style={{
                  fontSize: 12,
                  color: '#B91C1C',
                  fontWeight: 600,
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 8,
                  padding: '6px 10px',
                  marginRight: 4,
                  maxWidth: 360,
                }}
              >
                {error}
              </div>
            )}
            <span
              style={{
                fontSize: 11,
                color: sp.sub,
                fontWeight: 500,
                marginRight: 4,
              }}
            >
              {t('newContact.shortcutCreate')}
            </span>
            <button
              onClick={onClose}
              disabled={isPending}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                background: 'transparent',
                border: `1px solid ${fieldBorder}`,
                color: sp.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isPending}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 999,
                background: canSave && !isPending ? primaryBg : subSurfaceBg,
                border: 0,
                color: canSave && !isPending ? primaryInk : sp.sub,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: canSave && !isPending ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: canSave && !isPending ? sp.focusShadow : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: canSave && !isPending ? 1 : 0.7,
              }}
            >
              <MEIcon
                name="check"
                size={12}
                color={canSave && !isPending ? primaryInk : sp.sub}
              />
              {isPending ? t('newContact.creating') : t('newContact.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
