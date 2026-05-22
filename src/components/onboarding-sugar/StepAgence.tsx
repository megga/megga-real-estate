// MEGGA Onboarding — Étape Agence (la pivot)
// Source : handoff-onboarding/onboarding/megga-onboarding-step-agence.jsx
// States : search → selected → sent/validated → create (avec anti-doublon strict)
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { obPalette, type ObTheme } from './tokens'
import {
  ObBlackPill,
  ObCard,
  ObField,
  ObGhostPill,
  ObStepHeader,
  obInputStyle,
} from './primitives'
import { createAgency, joinAgency, searchAgencies } from './persistence'
import type { ObAgency, OnboardingData, Setter } from './types'
import PxIcon from '@/components/propertyx/PxIcon'
import { SWISS_CANTONS, CANTON_LABELS } from '@/hooks/useMarketFilters'

// ─── Agency logo (initials + tint dot) ───────────────────────────────

function ObAgencyMark({
  ag, size = 44, dark,
}: {
  ag: ObAgency
  size?: number
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: t.cardSubtle,
        color: t.ink,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.34,
        fontWeight: 700,
        letterSpacing: -0.4,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {ag.initials}
      <span
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 10,
          height: 10,
          borderRadius: 999,
          background: ag.tint,
          boxShadow: `0 0 0 2px ${t.card}`,
        }}
      />
    </div>
  )
}

// ─── Result row ──────────────────────────────────────────────────────

function ObAgencyRow({
  ag, onClick, dark, hovered, onHover,
}: {
  ag: ObAgency
  onClick: () => void
  dark?: boolean
  hovered: boolean
  onHover: () => void
}) {
  const t = obPalette(dark)
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '12px 16px',
        borderRadius: 14,
        border: 0,
        background: hovered ? t.cardSubtle : 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        transition: 'background .15s ease',
      }}
    >
      <ObAgencyMark ag={ag} size={40} dark={dark} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {ag.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.muted,
            fontWeight: 500,
            marginTop: 2,
          }}
        >
          {ag.city}, {ag.canton} · {ag.agents} agents · depuis {ag.since}
        </div>
      </div>
      <span
        style={{
          color: hovered ? t.ink : t.ghost,
          transition: 'color .15s',
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
        }}
      >
        <PxIcon name="chevron-right" size={16} />
      </span>
    </button>
  )
}

// ─── Search + live dropdown ──────────────────────────────────────────

function ObAgencySearch({
  query, setQuery, onPick, onCreate, dark,
}: {
  query: string
  setQuery: (v: string) => void
  onPick: (ag: ObAgency) => void
  onCreate: (q: string) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const [focused, setFocused] = useState(false)
  const [hoverIdx, setHoverIdx] = useState(0)
  const [results, setResults] = useState<ObAgency[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const q = query.trim()
  const showDropdown = focused && q.length > 0

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounced live search against Supabase
  useEffect(() => {
    if (q.length === 0) {
      setResults([])
      return
    }
    let cancelled = false
    const tm = setTimeout(async () => {
      const rows = await searchAgencies(q)
      if (!cancelled) {
        setResults(rows.slice(0, 6))
        setHoverIdx(0)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(tm)
    }
  }, [q])

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHoverIdx((i) => Math.min(i + 1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHoverIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hoverIdx < results.length) onPick(results[hoverIdx])
      else onCreate(query)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 720 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          background: t.card,
          borderRadius: 999,
          height: 76,
          padding: '0 28px',
          boxShadow: focused
            ? `${t.shadowHov}, 0 0 0 2px ${t.ink} inset`
            : t.shadow,
          transition: 'box-shadow .25s cubic-bezier(.22,1,.36,1)',
        }}
      >
        <PxIcon name="search" size={26} color={focused ? t.ink : t.muted} strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHoverIdx(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKey}
          placeholder="Naef, Cardis, Bernard Nicod, Régie Tournier…"
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.015em',
            color: t.ink,
            minWidth: 0,
          }}
        />
        {query.length > 0 && (
          <button
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: t.cardSubtle,
              color: t.inkSoft,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <PxIcon name="close" size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            right: 0,
            background: t.card,
            borderRadius: 22,
            padding: 8,
            boxShadow: t.shadowLg,
            zIndex: 30,
            animation: 'obScaleIn .18s cubic-bezier(.2,.8,.2,1) both',
            maxHeight: 380,
            overflowY: 'auto',
          }}
        >
          {results.length > 0 && (
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '10px 16px 6px',
              }}
            >
              {results.length} agence{results.length > 1 ? 's' : ''} trouvée
              {results.length > 1 ? 's' : ''}
            </div>
          )}

          {results.map((ag, i) => (
            <ObAgencyRow
              key={ag.id}
              ag={ag}
              hovered={hoverIdx === i}
              onHover={() => setHoverIdx(i)}
              onClick={() => onPick(ag)}
              dark={dark}
            />
          ))}

          {results.length > 0 && (
            <div
              style={{ height: 1, background: t.divider, margin: '6px 16px' }}
            />
          )}
          <button
            onMouseEnter={() => setHoverIdx(results.length)}
            onClick={() => onCreate(query)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              border: 0,
              background:
                hoverIdx === results.length ? t.cardSubtle : 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'background .15s ease',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: t.cardSubtle,
                color: t.ink,
                display: 'grid',
                placeItems: 'center',
                boxShadow:
                  hoverIdx === results.length
                    ? `0 0 0 2px ${t.ink} inset`
                    : 'none',
                transition: 'box-shadow .15s ease',
              }}
            >
              <PxIcon name="plus" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: -0.2,
                }}
              >
                {query.trim().length > 0
                  ? `Créer « ${query.trim()} »`
                  : "Mon agence n'est pas listée"}
              </div>
            </div>
            <span
              style={{
                color: hoverIdx === results.length ? t.ink : t.ghost,
                transition: 'color .15s',
              }}
            >
              <PxIcon name="chevron-right" size={16} />
            </span>
          </button>
        </div>
      )}

    </div>
  )
}

// ─── Selected agency card (preview + sent/validated states) ──────────

function ObAgencySelected({
  ag, onBack, onConfirm, onValidateNow, sent, validated, dark,
}: {
  ag: ObAgency
  onBack: () => void
  onConfirm: () => void
  onValidateNow: () => void
  sent: boolean
  validated: boolean
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div
      style={{
        animation: 'obFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
        width: '100%',
        maxWidth: 720,
      }}
    >
      <ObCard padding={0} radius={24} dark={dark}>
        <div
          style={{
            padding: '28px 30px 22px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 18,
          }}
        >
          <ObAgencyMark ag={ag} size={64} dark={dark} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Agence sélectionnée
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.5,
                marginBottom: 4,
              }}
            >
              {ag.name}
            </div>
            <div
              style={{ fontSize: 13, color: t.inkSoft, fontWeight: 500 }}
            >
              {ag.city}, {ag.canton} · {ag.agents} agents · depuis {ag.since}
            </div>
          </div>
          {!sent && (
            <button
              onClick={onBack}
              style={{
                background: 'transparent',
                border: 0,
                color: t.muted,
                cursor: 'pointer',
                padding: 8,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <PxIcon name="close" size={18} />
            </button>
          )}
        </div>

        <div style={{ height: 1, background: t.divider, margin: '0 30px' }} />

        <div style={{ padding: '22px 30px 26px' }}>
          {!sent && !validated && (
            <>
              <div
                style={{
                  fontSize: 13.5,
                  color: t.inkSoft,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  marginBottom: 22,
                }}
              >
                Votre demande sera envoyée à l'administrateur de {ag.name}. Vous
                pourrez accéder au CRM dès la validation (généralement sous 24h).
              </div>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {[
                  ["Vous rejoignez l'équipe existante", 'Pas de doublon créé'],
                  ["L'admin vérifie votre rôle", 'Sécurité LBA'],
                  [
                    'Vous héritez du logo, de l\'adresse, des modèles',
                    'Aucune ressaisie',
                  ],
                ].map(([title, sub], i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: t.cardSubtle,
                        color: t.ink,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      <PxIcon name="check" size={12} color={t.ink} strokeWidth={2.2} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: t.ink,
                          letterSpacing: -0.2,
                        }}
                      >
                        {title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: t.muted,
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        {sub}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                <ObBlackPill
                  onClick={onConfirm}
                  dark={dark}
                  icon={
                    <PxIcon
                      name="arrow-right"
                      size={16}
                      color={dark ? '#0B0C0E' : '#fff'}
                    />
                  }
                >
                  Rejoindre l'équipe
                </ObBlackPill>
                <ObGhostPill onClick={onBack} dark={dark}>
                  Changer d'agence
                </ObGhostPill>
              </div>
            </>
          )}

          {sent && !validated && (
            <div
              style={{ animation: 'obFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: t.cardSubtle,
                    color: t.ink,
                    display: 'grid',
                    placeItems: 'center',
                    animation: 'obRingPulse 2s ease-out infinite',
                  }}
                >
                  <PxIcon name="clock" size={20} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    Demande envoyée
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: t.muted,
                      fontWeight: 500,
                      marginTop: 2,
                    }}
                  >
                    L'admin de {ag.name} reçoit une notification.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: t.cardSubtle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12.5,
                  color: t.inkSoft,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                <PxIcon name="mail" size={16} color={t.muted} />
                <span>
                  Un email vous sera envoyé dès validation. Vous pouvez
                  continuer l'onboarding pendant ce temps.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 24,
                  alignItems: 'center',
                }}
              >
                <ObBlackPill onClick={onValidateNow} dark={dark} size="md">
                  Continuer
                </ObBlackPill>
                <button
                  onClick={onValidateNow}
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: t.muted,
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 8,
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  ⚡ Simuler validation admin
                </button>
              </div>
            </div>
          )}

          {validated && (
            <div
              style={{ animation: 'obFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: t.ink,
                    color: t.card,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <PxIcon
                    name="check"
                    size={20}
                    strokeWidth={2.4}
                    color={dark ? '#0B0C0E' : '#fff'}
                  />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.ink,
                      letterSpacing: -0.3,
                    }}
                  >
                    Bienvenue dans l'équipe
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: t.muted,
                      fontWeight: 500,
                      marginTop: 2,
                    }}
                  >
                    {ag.name} a validé votre demande.
                  </div>
                </div>
              </div>
              <ObBlackPill
                onClick={onValidateNow}
                dark={dark}
                icon={
                  <PxIcon
                    name="arrow-right"
                    size={16}
                    color={dark ? '#0B0C0E' : '#fff'}
                  />
                }
              >
                Continuer
              </ObBlackPill>
            </div>
          )}
        </div>
      </ObCard>
    </div>
  )
}

// ─── Inline create form + anti-doublon ───────────────────────────────

// 26 cantons suisses, triés alphabétiquement par code pour la trouvabilité
const CANTONS_LIST = [...SWISS_CANTONS].sort()

function ObAgencyCreate({
  initialName, onBack, onCreated, dark,
}: {
  initialName: string
  onBack: () => void
  onCreated: (res: {
    joinExisting?: ObAgency
    created?: { agencyId: string; name: string; city: string; canton: string; solo: boolean }
  }) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const [solo, setSolo] = useState(false)
  const [name, setName] = useState(initialName || '')
  const [city, setCity] = useState('')
  const [canton, setCanton] = useState('VD')
  const [conflict, setConflict] = useState<ObAgency | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Live conflict detection via Supabase (case-insensitive name match)
  useEffect(() => {
    if (name.trim().length < 3) {
      setConflict(undefined)
      return
    }
    let cancelled = false
    const tm = setTimeout(async () => {
      const rows = await searchAgencies(name)
      if (cancelled) return
      const nn = name.trim().toLowerCase()
      const match = rows.find((a) => {
        const an = a.name.toLowerCase()
        return an === nn || an.includes(nn) || nn.includes(an)
      })
      setConflict(match)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(tm)
    }
  }, [name])

  const canSubmit = name.trim().length >= 3 && city.trim().length >= 2 && !submitting

  const submitCreate = async () => {
    setSubmitting(true)
    setServerError(null)
    const res = await createAgency(name, city, canton, solo)
    setSubmitting(false)
    if (res.ok) {
      onCreated({
        created: { agencyId: res.agencyId, name: name.trim(), city: city.trim(), canton, solo },
      })
    } else if (res.conflict) {
      setServerError(
        'Une agence du même nom existe déjà sur MEGGA. Rejoignez-la pour éviter un doublon.',
      )
    } else {
      setServerError(res.message)
    }
  }

  return (
    <div
      style={{
        animation: 'obFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
        width: '100%',
        maxWidth: 720,
      }}
    >
      <ObCard padding={30} radius={24} dark={dark}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: t.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {solo ? 'Créer votre cabinet solo' : 'Créer une nouvelle agence'}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.5,
              }}
            >
              {solo ? 'Vous êtes seul·e' : 'Vous serez admin'}
            </div>
          </div>
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 0,
              color: t.muted,
              cursor: 'pointer',
              padding: 8,
              borderRadius: 999,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <PxIcon name="close" size={18} />
          </button>
        </div>

        <SegmentedControl t={t} solo={solo} setSolo={setSolo} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ObField
            label={solo ? 'Nom de votre cabinet' : "Nom de l'agence"}
            dark={dark}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={solo ? 'Cabinet Marie Schaeffer' : 'Régie Martin'}
              style={obInputStyle(t)}
            />
          </ObField>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: 14,
            }}
          >
            <ObField label="Ville" dark={dark}>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Lausanne"
                style={obInputStyle(t)}
              />
            </ObField>
            <ObField label="Canton" dark={dark}>
              <select
                value={canton}
                onChange={(e) => setCanton(e.target.value)}
                style={obInputStyle(t)}
              >
                {CANTONS_LIST.map((c) => (
                  <option key={c} value={c} title={CANTON_LABELS[c] ?? c}>
                    {c}
                  </option>
                ))}
              </select>
            </ObField>
          </div>
        </div>

        {conflict && (
          <div
            style={{
              marginTop: 18,
              padding: '14px 18px',
              borderRadius: 14,
              background: t.cardSubtle,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              animation: 'obFadeIn .25s ease both',
            }}
          >
            <div style={{ color: t.warn, flexShrink: 0, marginTop: 1 }}>
              <PxIcon name="alert" size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: -0.2,
                }}
              >
                Une agence similaire existe déjà
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: t.inkSoft,
                  fontWeight: 500,
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: t.ink, fontWeight: 700 }}>
                  {conflict.name}
                </strong>{' '}
                à {conflict.city} · {conflict.agents} agents. Rejoignez-la pour
                éviter un doublon — un seul espace agence par structure sur
                MEGGA.
              </div>
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => onCreated({ joinExisting: conflict })}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 999,
                    border: 0,
                    background: t.ink,
                    color: t.card,
                    fontFamily: 'inherit',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Rejoindre {conflict.name}
                </button>
              </div>
            </div>
          </div>
        )}

        {serverError && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 12,
              background: t.cardSubtle,
              color: t.err,
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {serverError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <ObBlackPill
            disabled={!canSubmit || !!conflict}
            onClick={submitCreate}
            dark={dark}
            icon={
              <PxIcon
                name="arrow-right"
                size={16}
                color={dark ? '#0B0C0E' : '#fff'}
              />
            }
          >
            {submitting
              ? 'Création…'
              : solo
                ? 'Créer mon cabinet'
                : 'Créer cette agence'}
          </ObBlackPill>
          <ObGhostPill onClick={onBack} dark={dark}>
            Retour
          </ObGhostPill>
        </div>
      </ObCard>
    </div>
  )
}

function SegmentedControl({
  t, solo, setSolo,
}: {
  t: ObTheme
  solo: boolean
  setSolo: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: t.cardSubtle,
        marginBottom: 18,
      }}
    >
      {[
        { key: false, label: 'Agence (équipe)' },
        { key: true, label: 'Indépendant·e' },
      ].map((opt, i) => {
        const active = solo === opt.key
        return (
          <button
            key={i}
            onClick={() => setSolo(opt.key)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 999,
              border: 0,
              background: active ? t.card : 'transparent',
              color: active ? t.ink : t.muted,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: -0.1,
              cursor: 'pointer',
              boxShadow: active ? t.shadowSm : 'none',
              transition: 'all .2s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step wrapper (orchestrates states) ──────────────────────────────

export function StepAgence({
  data, set, dark,
}: {
  data: OnboardingData
  set: Setter
  dark?: boolean
}) {
  const t = obPalette(dark)
  const mode = data.agenceMode
  const selected = data.agenceSelected
  const sent = data.agenceSent
  const validated = data.agenceValidated
  const [query, setQuery] = useState(data.agenceQuery || '')

  useEffect(() => {
    set({ agenceQuery: query })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const reset = () =>
    set({
      agenceSelected: null,
      agenceSent: false,
      agenceValidated: false,
      agenceCreated: null,
      agenceMode: 'search',
    })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingTop: 8 }}>
      {/* Search-first hero : H1 plus petit, sub court, l'input devient le héros */}
      {mode === 'search' && !selected && (
        <div style={{ marginBottom: 32, animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
          <h1
            style={{
              margin: '0 0 10px',
              fontFamily:
                '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
              fontSize: 40,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.0,
              textTransform: 'uppercase',
            }}
          >
            Votre structure.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 400,
              color: t.inkSoft,
              lineHeight: 1.5,
              letterSpacing: '-0.005em',
            }}
          >
            Cherchez-la dans notre annuaire, ou créez-la maintenant.
          </p>
        </div>
      )}
      {/* Pour les états "selected" et "create", on garde un header step plus
          conventionnel pour éviter un H1 monumental qui distrait du form/card */}
      {(mode === 'search' && selected) || mode === 'create' ? (
        <ObStepHeader
          title="Votre structure"
          sub={
            mode === 'create'
              ? 'Posons les fondations de votre structure.'
              : "L'agence sélectionnée."
          }
          dark={dark}
        />
      ) : null}

      {mode === 'search' && !selected && (
        <ObAgencySearch
          query={query}
          setQuery={setQuery}
          onPick={(ag) => set({ agenceSelected: ag, agenceMode: 'search' })}
          onCreate={(q) => set({ agenceMode: 'create', agenceQuery: q })}
          dark={dark}
        />
      )}

      {mode === 'search' && selected && (
        <ObAgencySelected
          ag={selected}
          sent={sent}
          validated={validated}
          onBack={reset}
          onConfirm={async () => {
            // Phase MVP : attache directe via RPC join_agency
            const ok = await joinAgency(selected.id)
            set({ agenceSent: true, agenceValidated: ok })
          }}
          onValidateNow={() => {
            if (!validated) set({ agenceValidated: true })
            else set({ _agenceDone: true })
          }}
          dark={dark}
        />
      )}

      {mode === 'create' && (
        <ObAgencyCreate
          initialName={query}
          onBack={() => set({ agenceMode: 'search' })}
          onCreated={(res) => {
            if (res.joinExisting) {
              set({ agenceMode: 'search', agenceSelected: res.joinExisting })
            } else if (res.created) {
              set({
                agenceCreated: {
                  name: res.created.name,
                  city: res.created.city,
                  canton: res.created.canton,
                  solo: res.created.solo,
                },
                agenceCreatedId: res.created.agencyId,
                _agenceDone: true,
              })
            }
          }}
          dark={dark}
        />
      )}
    </div>
  )
}
