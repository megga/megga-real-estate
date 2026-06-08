// MEGGA Onboarding — Étape Profil agence
// Source : handoff-onboarding/onboarding/megga-onboarding-step-profil-agence.jsx
// Variant A : agence rejointe → "tout est en place"
// Variant B : agence créée → form admin complet
import { useRef, useState, type DragEvent } from 'react'
import { obPalette, type ObTheme } from './tokens'
import {
  ObCard,
  ObField,
  obInputStyle,
} from './primitives'
import { uploadAgencyLogo } from './persistence'
import type { OnboardingData, Setter, AgenceProfile } from './types'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { SWISS_CANTONS, CANTON_LABELS } from '@/lib/swissCantons'

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
        border: value ? 'none' : `1px solid ${t.cardBorder}`,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: drag ? `0 0 0 2px ${t.ink} inset` : 'none',
        transition: 'box-shadow .18s ease, border-color .18s ease',
      }}
    >
      {!value && (
        <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
          <MEIcon name="upload" size={22} strokeWidth={1.7} color={t.ink} />
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
          <MEIcon name="close" size={12} strokeWidth={1.8} color={t.inkSoft} />
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
  const tiles: Array<[MEIconName, string, string]> = [
    ['building', 'Identité visuelle', "Configurée par l'équipe"],
    ['location', 'Adresse et contact', `${agCity}, ${agCanton}`],
    ['pipeline', 'Modèles partagés', '12 documents prêts à l’emploi'],
    ['shield', 'Conformité LBA', 'Active sur tous vos mandats'],
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
            <MEIcon
              name="check"
              size={26}
              strokeWidth={2.2}
              color={dark ? '#0B0C0E' : '#fff'}
            />
          </div>
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
              Vous rejoignez
            </div>
            <div
              style={{
                fontFamily:
                  '"Objectivity", "Plus Jakarta Sans", system-ui, sans-serif',
                fontSize: 26,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {agName}
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
                  width: 28,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  color: t.ink,
                  marginTop: 1,
                }}
              >
                <MEIcon name={icon} size={22} strokeWidth={1.7} color={t.ink} />
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

// 26 cantons suisses, triés alphabétiquement par code pour la trouvabilité
const CANTONS_LIST = [...SWISS_CANTONS].sort()

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
                <option key={c} value={c} title={CANTON_LABELS[c] ?? c}>
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
  const t = obPalette(dark)

  const heroTitle = isCreator ? 'Votre structure.' : 'Tout est déjà construit.'
  const heroSub = isCreator ? (
    <>
      Posons les fondations. Logo, adresse, contact.
      <br />
      Le branding public arrive plus tard, depuis vos paramètres.
    </>
  ) : (
    <>
      Votre équipe a posé les fondations.
      <br />
      Logo, adresse, conformité déjà en place.
    </>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 8 }}>
      {/* Hero form-first : H1 réduit + sub court, la card/form prend le devant */}
      <div
        style={{
          marginBottom: 32,
          animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
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
          {heroTitle}
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 480,
            fontSize: 15,
            fontWeight: 400,
            color: t.inkSoft,
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
          }}
        >
          {heroSub}
        </p>
      </div>

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
