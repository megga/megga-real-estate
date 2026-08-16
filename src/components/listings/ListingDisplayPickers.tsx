// MEGGA — Listing display variants pickers (form de création d'annonce).
// Expose toutes les variantes du proto MEGGA Bien.html (TWEAK_DEFAULTS) que
// l'agent peut choisir pour son annonce :
//   - contact_layout       (right / banner / floating)
//   - neighborhood_variant (scores / map)
//   - partner_agency       (none / naef / cardis / bernard)

import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
}

// ─── Generic option button ──────────────────────────────────────────────

interface VariantOption<T extends string> {
  value: T
  label: string
  description: string
  mock: ReactNode
}

interface VariantPickerProps<T extends string> {
  title: string
  subtitle?: string
  value: T | null | undefined
  onChange: (v: T | null) => void
  options: VariantOption<T>[]
  /** Permet de désélectionner (utile pour "Aucun partenaire") */
  allowNull?: boolean
  nullLabel?: string
  nullDescription?: string
}

function VariantPicker<T extends string>({
  title,
  subtitle,
  value,
  onChange,
  options,
  allowNull = false,
  nullLabel = 'Aucun',
  nullDescription = '',
}: VariantPickerProps<T>) {
  const items: Array<VariantOption<T> | { value: null; label: string; description: string; mock: ReactNode }> = allowNull
    ? [
        { value: null, label: nullLabel, description: nullDescription, mock: <NullMock /> },
        ...options,
      ]
    : options

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: M.ink }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 'var(--crm-text-sm)', color: M.muted, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
          gap: 10,
        }}
      >
        {items.map((opt) => {
          const selected = value === opt.value || (value == null && opt.value === null)
          return (
            <button
              key={opt.value === null ? '__null__' : opt.value}
              type="button"
              onClick={() => onChange(opt.value as T | null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                borderRadius: 10,
                border: selected ? `2px solid ${M.green}` : `1px solid ${M.border}`,
                background: selected ? '#F5F8FF' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!selected) e.currentTarget.style.borderColor = M.muted
              }}
              onMouseLeave={(e) => {
                if (!selected) e.currentTarget.style.borderColor = M.border
              }}
            >
              <div style={{ width: '100%' }}>{opt.mock}</div>
              <div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-md)',
                    fontWeight: 600,
                    color: selected ? M.green : M.ink,
                  }}
                >
                  {opt.label}
                </div>
                {opt.description && (
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: M.muted, marginTop: 2 }}>{opt.description}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const tile: CSSProperties = { borderRadius: 3, background: '#9DB1D9' }
const tileLight: CSSProperties = { borderRadius: 3, background: '#C7D5EB' }

function NullMock() {
  return (
    <div
      style={{
        width: '100%',
        height: 64,
        borderRadius: 6,
        border: `1.5px dashed ${M.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: M.muted,
        fontSize: 'var(--crm-text-xs)',
        fontWeight: 600,
        background: '#FAFBFD',
      }}
    >
      ✕
    </div>
  )
}

// ─── Contact layout picker ──────────────────────────────────────────────

export type ContactLayout = 'right' | 'banner' | 'floating'

interface ContactLayoutPickerProps {
  value: ContactLayout
  onChange: (v: ContactLayout) => void
}

export function ContactLayoutPicker({ value, onChange }: ContactLayoutPickerProps) {
  const { t } = useTranslation('listings')
  const opts: VariantOption<ContactLayout>[] = [
    {
      value: 'right',
      label: t('editor.contactLayout.right.label'),
      description: t('editor.contactLayout.right.description'),
      mock: (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 4, height: 64 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ ...tileLight, height: 18 }} />
            <div style={{ ...tileLight, flex: 1 }} />
          </div>
          <div style={{ ...tile, height: '100%' }} />
        </div>
      ),
    },
    {
      value: 'banner',
      label: t('editor.contactLayout.banner.label'),
      description: t('editor.contactLayout.banner.description'),
      mock: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: 64 }}>
          <div style={{ ...tile, height: 22 }} />
          <div style={{ ...tileLight, flex: 1 }} />
        </div>
      ),
    },
    {
      value: 'floating',
      label: t('editor.contactLayout.floating.label'),
      description: t('editor.contactLayout.floating.description'),
      mock: (
        <div style={{ position: 'relative', height: 64, background: '#F2F4F8', borderRadius: 4 }}>
          <div style={{ position: 'absolute', bottom: 4, right: 4, width: 26, height: 18, ...tile }} />
        </div>
      ),
    },
  ]
  return (
    <VariantPicker<ContactLayout>
      title={t('editor.contactLayout.title')}
      subtitle={t('editor.contactLayout.subtitle')}
      value={value}
      onChange={(v) => onChange(v ?? 'right')}
      options={opts}
    />
  )
}

// ─── Neighborhood variant picker ────────────────────────────────────────

export type NeighborhoodVariant = 'scores' | 'map'

interface NeighborhoodVariantPickerProps {
  value: NeighborhoodVariant
  onChange: (v: NeighborhoodVariant) => void
}

export function NeighborhoodVariantPicker({ value, onChange }: NeighborhoodVariantPickerProps) {
  const { t } = useTranslation('listings')
  const opts: VariantOption<NeighborhoodVariant>[] = [
    {
      value: 'map',
      label: t('editor.neighborhood.map.label'),
      description: t('editor.neighborhood.map.description'),
      mock: (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 4, height: 64 }}>
          <div
            style={{
              ...tile,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 8,
                height: 8,
                borderRadius: 999,
                background: '#fff',
                boxShadow: '0 0 0 3px #0041D9',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ ...tileLight, height: 8 }} />
            <div style={{ ...tileLight, height: 8 }} />
            <div style={{ ...tileLight, height: 8 }} />
            <div style={{ ...tileLight, height: 8 }} />
          </div>
        </div>
      ),
    },
    {
      value: 'scores',
      label: t('editor.neighborhood.scores.label'),
      description: t('editor.neighborhood.scores.description'),
      mock: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, height: 64 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
            <div style={{ ...tile, height: 22 }} />
            <div style={{ ...tile, height: 22 }} />
            <div style={{ ...tile, height: 22 }} />
          </div>
          <div style={{ ...tileLight, height: 16, borderLeft: `3px solid ${M.green}` }} />
          <div style={{ ...tileLight, flex: 1 }} />
        </div>
      ),
    },
  ]
  return (
    <VariantPicker<NeighborhoodVariant>
      title={t('editor.neighborhood.title')}
      subtitle={t('editor.neighborhood.subtitle')}
      value={value}
      onChange={(v) => onChange(v ?? 'map')}
      options={opts}
    />
  )
}

// ─── Partner agency picker ──────────────────────────────────────────────

export type PartnerAgencyKey = 'naef' | 'cardis' | 'bernard'

interface PartnerAgencyPickerProps {
  value: PartnerAgencyKey | null
  onChange: (v: PartnerAgencyKey | null) => void
}

export function PartnerAgencyPicker({ value, onChange }: PartnerAgencyPickerProps) {
  const { t } = useTranslation('listings')
  // Partner names + taglines are brand identity (proper nouns) — not translated.
  const PARTNERS: Array<{ key: PartnerAgencyKey; name: string; tagline: string; color: string; mono: string }> = [
    { key: 'naef', name: 'Naef Immobilier', tagline: 'Depuis 1881', color: '#0E1410', mono: 'N' },
    { key: 'cardis', name: "Cardis Sotheby's", tagline: 'International Realty', color: '#0B2545', mono: 'C' },
    { key: 'bernard', name: 'Bernard Nicod', tagline: 'Régie immobilière', color: '#9C1B2C', mono: 'BN' },
  ]
  const opts: VariantOption<PartnerAgencyKey>[] = PARTNERS.map((p) => ({
    value: p.key,
    label: p.name,
    description: p.tagline,
    mock: (
      <div
        style={{
          height: 64,
          borderRadius: 6,
          background: '#fff',
          border: `1px solid ${M.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 3,
            background: p.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            fontFamily: p.mono.length > 1 ? 'Manrope, sans-serif' : "'Cormorant Garamond', serif",
          }}
        >
          {p.mono}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ ...tileLight, height: 6, width: '80%' }} />
          <div style={{ height: 6, borderRadius: 3, background: p.color, opacity: 0.4, width: '50%' }} />
        </div>
      </div>
    ),
  }))
  return (
    <VariantPicker<PartnerAgencyKey>
      title={t('editor.partnerAgency.title')}
      subtitle={t('editor.partnerAgency.subtitle')}
      value={value}
      onChange={(v) => onChange(v as PartnerAgencyKey | null)}
      options={opts}
      allowNull
      nullLabel={t('editor.partnerAgency.none.label')}
      nullDescription={t('editor.partnerAgency.none.description')}
    />
  )
}
