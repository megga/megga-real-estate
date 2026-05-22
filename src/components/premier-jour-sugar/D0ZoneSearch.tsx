// MEGGA Premier jour — Q2 Zone : autocomplete multi-sélection
// Recherche accent-insensible sur 60+ zones suisses + synonymes.
// Source : handoff-premier-jour/premier-jour/crm-day0-calibration.jsx → D0ZoneSearch
import { useMemo, useRef, useState } from 'react'
import { obPalette, type ObTheme } from '@/components/onboarding-sugar/tokens'
import PxIcon, { type PxIconName } from '@/components/propertyx/PxIcon'
import { D0_ZONES, d0ZoneSubtitle, type D0Zone } from './data'

const TYPE_ORDER: Record<D0Zone['type'], number> = {
  country: 0,
  region: 1,
  canton: 2,
  city: 3,
}

const iconFor = (z: D0Zone): PxIconName => {
  if (z.type === 'city') return 'building'
  if (z.type === 'region') return 'location'
  if (z.type === 'country') return 'globe'
  return 'flag'
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function D0ZoneSearch({
  value,
  onChange,
  dark,
}: {
  value: string[]
  onChange: (next: string[]) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIds = useMemo(() => new Set(value), [value])
  const selected = useMemo(
    () => value.map((id) => D0_ZONES.find((z) => z.id === id)).filter((z): z is D0Zone => !!z),
    [value],
  )

  const nq = normalize(query.trim())

  const suggestions = useMemo(() => {
    const matches = (z: D0Zone) => {
      if (!nq) return !!z.popular
      const hay = [z.label, z.code ?? '', z.id, ...z.cantons, ...(z.alt ?? [])]
        .map(normalize)
        .join(' ')
      return hay.includes(nq)
    }
    return D0_ZONES.filter((z) => !selectedIds.has(z.id))
      .filter(matches)
      .sort((a, b) => {
        const d = TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
        return d !== 0 ? d : a.label.localeCompare(b.label, 'fr')
      })
      .slice(0, 8)
  }, [nq, selectedIds])

  const addZone = (id: string) => {
    onChange(Array.from(new Set([...value, id])))
    setQuery('')
    inputRef.current?.focus()
  }

  const removeZone = (id: string) => {
    onChange(value.filter((v) => v !== id))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      e.preventDefault()
      removeZone(selected[selected.length - 1].id)
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      addZone(suggestions[0].id)
    } else if (e.key === 'Escape' && query) {
      e.preventDefault()
      setQuery('')
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Barre de recherche XL pill — cohérent avec Step 2 Agence du wizard.
          Pill 999px, height 76, font 22 medium, focus ring 2px ink inset. */}
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
        <PxIcon
          name="search"
          size={26}
          color={focused ? t.ink : t.muted}
          strokeWidth={1.8}
        />
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length === 0
              ? 'Genève, Vaud, Suisse romande…'
              : 'Ajouter une autre zone…'
          }
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            color: t.ink,
            fontFamily: 'inherit',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.015em',
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Effacer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: t.cardSubtle,
              color: t.muted,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'background .15s ease',
            }}
          >
            <PxIcon name="close" size={14} color="currentColor" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Tags sélectionnés */}
      {selected.length > 0 && (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            animation: 'd0FadeIn .25s ease both',
          }}
        >
          {selected.map((z) => (
            <div
              key={z.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 6px 7px 14px',
                borderRadius: 999,
                background: t.black,
                color: dark ? '#0B0C0E' : '#fff',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: -0.1,
                boxShadow: t.shadowSm,
                animation: 'd0SlideUp .25s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              {z.label}
              <button
                onClick={() => removeZone(z.id)}
                aria-label={`Retirer ${z.label}`}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: 0,
                  background: dark ? 'rgba(11,12,14,0.20)' : 'rgba(255,255,255,0.22)',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <PxIcon name="close" size={10} color="currentColor" strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions — sans eyebrow (le dropdown parle de lui-même) */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 20,
              boxShadow: t.shadow,
              overflow: 'hidden',
            }}
          >
            {suggestions.map((z, i) => (
              <ZoneRow
                key={z.id}
                z={z}
                icon={iconFor(z)}
                onClick={() => addZone(z.id)}
                divider={i > 0}
                dark={dark}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {query && suggestions.length === 0 && (
        <div
          style={{
            marginTop: 18,
            padding: '22px 24px',
            background: t.card,
            border: `1px solid ${t.cardBorder}`,
            borderRadius: 20,
            boxShadow: t.shadow,
            color: t.muted,
            fontSize: 14,
            fontWeight: 500,
            textAlign: 'center',
            letterSpacing: -0.1,
          }}
        >
          Aucun résultat pour «&nbsp;{query}&nbsp;». Essayez un canton ou une ville.
        </div>
      )}
    </div>
  )
}

function ZoneRow({
  z,
  icon,
  onClick,
  divider,
  dark,
  t,
}: {
  z: D0Zone
  icon: PxIconName
  onClick: () => void
  divider: boolean
  dark?: boolean
  t: ObTheme
}) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 0,
        background: h ? t.cardSubtle : 'transparent',
        cursor: 'pointer',
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: 'inherit',
        borderTop: divider
          ? `1px solid ${dark ? 'rgba(236,237,243,0.06)' : 'rgba(11,12,14,0.05)'}`
          : '0',
        transition: 'background .15s ease',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 28,
          color: t.inkSoft,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <PxIcon name={icon} size={18} color="currentColor" strokeWidth={1.7} />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14.5,
          fontWeight: 600,
          color: t.ink,
          letterSpacing: -0.2,
        }}
      >
        {z.label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.muted,
          fontWeight: 500,
          letterSpacing: -0.1,
          flexShrink: 0,
        }}
      >
        {d0ZoneSubtitle(z)}
      </div>
    </button>
  )
}
