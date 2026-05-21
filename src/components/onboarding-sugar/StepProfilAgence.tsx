// MEGGA Onboarding — Étape Profil agence
// Source : handoff-onboarding/onboarding/megga-onboarding-step-profil-agence.jsx
// Variant A : agence rejointe → "tout est en place"
// Variant B : agence créée → form admin complet
import { useRef, useState, type DragEvent } from 'react'
import { obPalette, type ObTheme } from './tokens'
import {
  ObCard,
  ObField,
  ObIcon,
  ObStepHeader,
  obInputStyle,
  type ObIconName,
} from './primitives'
import { uploadAgencyLogo } from './persistence'
import type { OnboardingData, Setter, AgenceProfile } from './types'

// ─── Logo uploader (square) ──────────────────────────────────────────

function ObLogoUploader({
  value, onChange, dark, agencyId,
}: {
  value: string | null
  onChange: (v: string | null) => void
  dark?: boolean
  agencyId: string | null
}) {
  const t = obPalette(dark)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handle = async (f?: File) => {
    if (!f) return
    const localPreview = URL.createObjectURL(f)
    onChange(localPreview)
    if (!agencyId) return
    setUploading(true)
    try {
      const remote = await uploadAgencyLogo(f, agencyId)
      if (remote) onChange(remote)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDrag(false)
        handle(e.dataTransfer.files?.[0])
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        position: 'relative',
        width: 120,
        height: 120,
        borderRadius: 18,
        background: value ? 'transparent' : t.cardSubtle,
        backgroundImage: value ? `url(${value})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: drag
          ? `0 0 0 3px ${t.ink} inset, 0 12px 30px rgba(11,12,14,0.18)`
          : '0 12px 30px rgba(11,12,14,0.10), 0 2px 8px rgba(11,12,14,0.06)',
        transition: 'box-shadow .2s ease',
      }}
    >
      {!value && (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: t.card,
              color: t.ink,
              display: 'grid',
              placeItems: 'center',
              boxShadow: t.shadowSm,
            }}
          >
            <ObIcon name="upload" size={18} />
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            {drag ? 'Déposez' : 'Logo'}
          </div>
        </div>
      )}
      {uploading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            background: 'rgba(11,12,14,0.45)',
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          …
        </div>
      )}
      {value && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onChange(null)
          }}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: 0,
            background: t.card,
            color: t.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: t.shadowSm,
          }}
        >
          <ObIcon name="close" size={12} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </div>
  )
}

// ─── Variant A : joined agency ───────────────────────────────────────

function ObAgencyInheritedView({
  agName, agCity, agCanton, dark,
}: {
  agName: string
  agCity: string
  agCanton: string
  dark?: boolean
}) {
  const t = obPalette(dark)
  const tiles: Array<[ObIconName, string, string]> = [
    ['building', 'Logo et identité', "Définis par l'admin"],
    ['map', 'Adresse et contact', `${agCity}, ${agCanton}`],
    ['pipeline', 'Modèles de mandat', '12 templates partagés'],
    ['shield', 'Conformité LBA', 'Validée au niveau agence'],
  ]
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <ObCard padding={0} radius={24} dark={dark}>
        <div
          style={{
            padding: '32px 32px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: t.ink,
              color: t.card,
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 10px 22px rgba(11,12,14,0.20)',
            }}
          >
            <ObIcon
              name="check"
              size={26}
              sw={2.4}
              stroke={dark ? '#0B0C0E' : '#fff'}
            />
          </div>
          <div style={{ flex: 1 }}>
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
              Tout est déjà en place
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.5,
                lineHeight: 1.2,
              }}
            >
              Vous héritez de la fiche {agName}.
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: t.divider, margin: '0 32px' }} />

        <div
          style={{
            padding: '20px 32px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
          {tiles.map(([icon, title, sub], i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: 14,
                borderRadius: 14,
                background: t.cardSubtle,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: t.card,
                  color: t.ink,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  boxShadow: t.shadowSm,
                }}
              >
                <ObIcon name={icon} size={16} sw={1.6} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {title}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: t.muted,
                    fontWeight: 500,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ObCard>
    </div>
  )
}

// ─── Variant B : created agency → single-column form ─────────────────

const CANTONS_LIST = ['VD', 'GE', 'VS', 'FR', 'NE', 'JU', 'BE', 'ZH', 'BS', 'BL', 'TI'] as const

function ObAgencyCreatedForm({
  data, set, dark,
}: {
  data: OnboardingData
  set: Setter
  dark?: boolean
}) {
  const t: ObTheme = obPalette(dark)
  const created = data.agenceCreated
  const form: AgenceProfile = data.agenceProfile ?? {
    name: created?.name ?? '',
    city: created?.city ?? '',
    canton: created?.canton ?? 'VD',
    street: '',
    npa: '',
    phone: '',
    website: '',
    logo: null,
  }
  const upd = (patch: Partial<AgenceProfile>) =>
    set({ agenceProfile: { ...form, ...patch } })

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <ObCard padding={32} radius={24} dark={dark}>
        <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start' }}>
          <ObLogoUploader
            value={form.logo}
            onChange={(v) => upd({ logo: v })}
            dark={dark}
            agencyId={data.agenceCreatedId}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <ObField label="Nom commercial" dark={dark}>
              <input
                value={form.name}
                onChange={(e) => upd({ name: e.target.value })}
                placeholder="Régie Martin"
                style={obInputStyle(t)}
              />
            </ObField>
            <div style={{ height: 14 }} />
            <ObField label="Ville" dark={dark}>
              <input
                value={form.city}
                onChange={(e) => upd({ city: e.target.value })}
                placeholder="Lausanne"
                style={obInputStyle(t)}
              />
            </ObField>
          </div>
        </div>

        <div
          style={{
            height: 1,
            background: t.divider,
            margin: '26px 0 24px',
          }}
        />

        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Adresse
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 90px',
            gap: 12,
          }}
        >
          <ObField label="Rue + numéro" dark={dark}>
            <input
              value={form.street}
              onChange={(e) => upd({ street: e.target.value })}
              placeholder="Av. de la Gare 12"
              style={obInputStyle(t)}
            />
          </ObField>
          <ObField label="NPA" dark={dark}>
            <input
              value={form.npa}
              onChange={(e) => upd({ npa: e.target.value })}
              placeholder="1003"
              style={obInputStyle(t)}
            />
          </ObField>
          <ObField label="Canton" dark={dark}>
            <select
              value={form.canton}
              onChange={(e) => upd({ canton: e.target.value })}
              style={obInputStyle(t)}
            >
              {CANTONS_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </ObField>
        </div>

        <div style={{ height: 24 }} />
        <div style={{ height: 1, background: t.divider, margin: '0 0 24px' }} />

        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Contact
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <ObField label="Téléphone" dark={dark}>
            <input
              value={form.phone}
              onChange={(e) => upd({ phone: e.target.value })}
              placeholder="+41 21 555 12 34"
              style={obInputStyle(t)}
            />
          </ObField>
          <ObField label="Site web" dark={dark}>
            <input
              value={form.website}
              onChange={(e) => upd({ website: e.target.value })}
              placeholder="regie-martin.ch"
              style={obInputStyle(t)}
            />
          </ObField>
        </div>
      </ObCard>
    </div>
  )
}

// ─── Step wrapper ────────────────────────────────────────────────────

export function StepProfilAgence({
  data, set, dark,
}: {
  data: OnboardingData
  set: Setter
  dark?: boolean
}) {
  const created = data.agenceCreated
  const joined = data.agenceSelected
  const isCreator = !!created

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 8 }}>
      <ObStepHeader
        title={isCreator ? 'Votre agence.' : 'Tout est déjà prêt.'}
        sub={
          isCreator
            ? "Logo, adresse, contact. La cover et les options d'habillage public arriveront depuis vos paramètres."
            : 'Vous héritez de la fiche de votre agence. Continuez votre profil personnel à l\'étape suivante.'
        }
        dark={dark}
      />

      {isCreator ? (
        <ObAgencyCreatedForm data={data} set={set} dark={dark} />
      ) : (
        <ObAgencyInheritedView
          agName={joined?.name ?? 'agence'}
          agCity={joined?.city ?? ''}
          agCanton={joined?.canton ?? ''}
          dark={dark}
        />
      )}
    </div>
  )
}
