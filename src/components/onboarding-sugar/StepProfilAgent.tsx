// MEGGA Onboarding — Étape Profil agent (Vous)
// Source : handoff-onboarding/onboarding/megga-onboarding-step-profil-agent.jsx
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { obPalette, type ObTheme } from './tokens'
import {
  ObCard,
  ObField,
  obInputStyle,
} from './primitives'
import { uploadAgentAvatar } from './persistence'
import PxIcon from '@/components/propertyx/PxIcon'
import type {
  AgentProfile,
  AgentRole,
  Language,
  OnboardingData,
  Setter,
} from './types'

function ObAvatarUploader({
  value, onChange, initials = 'MS', dark, userId,
}: {
  value: string | null
  onChange: (v: string | null) => void
  initials?: string
  dark?: boolean
  userId: string | null
}) {
  const t = obPalette(dark)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handle = async (f?: File) => {
    if (!f) return
    // Optimistic local preview
    const localPreview = URL.createObjectURL(f)
    onChange(localPreview)
    if (!userId) return // not signed in : keep blob URL only
    setUploading(true)
    try {
      const remote = await uploadAgentAvatar(f, userId)
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
        borderRadius: 999,
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
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: t.inkSoft,
            letterSpacing: -1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {initials}
        </div>
      )}

      {!value && (
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: 34,
            height: 34,
            borderRadius: 999,
            background: t.ink,
            color: t.card,
            display: 'grid',
            placeItems: 'center',
            boxShadow: `0 6px 14px rgba(11,12,14,0.25), 0 0 0 3px ${t.bg}`,
          }}
        >
          <PxIcon name="camera" size={15} color={dark ? '#0B0C0E' : '#fff'} strokeWidth={1.8} />
        </div>
      )}

      {uploading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
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
            top: 4,
            right: 4,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: `1px solid ${t.cardBorder}`,
            background: t.card,
            color: t.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <PxIcon name="close" size={12} color={t.inkSoft} strokeWidth={1.8} />
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

// ─── Multi-select chips ──────────────────────────────────────────────

function ObChipMulti<T extends string>({
  options, value, onChange, dark,
}: {
  options: Array<{ key: T; label: string }>
  value: T[]
  onChange: (v: T[]) => void
  dark?: boolean
}) {
  const t = obPalette(dark)
  const toggle = (k: T) => {
    if (value.includes(k)) onChange(value.filter((v) => v !== k))
    else onChange([...value, k])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = value.includes(opt.key)
        return (
          <button
            key={opt.key}
            onClick={() => toggle(opt.key)}
            style={{
              height: 36,
              padding: active ? '0 14px 0 10px' : '0 16px',
              borderRadius: 999,
              border: 0,
              background: active ? t.ink : t.cardSubtle,
              color: active ? (dark ? '#0B0C0E' : '#fff') : t.inkSoft,
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: -0.1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: active ? '0 4px 10px rgba(11,12,14,0.18)' : 'none',
              transition: 'all .15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {active && (
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: dark ? '#0B0C0E' : 'rgba(255,255,255,0.18)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <PxIcon
                  name="check"
                  size={10}
                  color={dark ? '#ECEDF3' : '#fff'}
                  strokeWidth={2.4}
                />
              </span>
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Step ────────────────────────────────────────────────────────────

const ROLES: Array<{ key: AgentRole; label: string }> = [
  { key: 'courtier', label: 'Courtier·ère' },
  { key: 'direction', label: 'Direction' },
  { key: 'admin', label: 'Administratif' },
  { key: 'stagiaire', label: 'Stage LBA' },
]

const LANGUAGES: Array<{ key: Language; label: string }> = [
  { key: 'fr', label: 'Français' },
  { key: 'en', label: 'English' },
  { key: 'de', label: 'Deutsch' },
  { key: 'it', label: 'Italiano' },
  { key: 'es', label: 'Español' },
  { key: 'pt', label: 'Português' },
]

export function StepProfilAgent({
  data, set, dark,
}: {
  data: OnboardingData
  set: Setter
  dark?: boolean
}) {
  const t: ObTheme = obPalette(dark)
  const { profile } = useAuth()

  const form: AgentProfile = data.agentProfile ?? {
    firstName: 'Marie',
    lastName: 'Schaeffer',
    avatar: null,
    role: 'courtier',
    phone: '',
    languages: ['fr', 'en'],
  }
  const upd = (patch: Partial<AgentProfile>) =>
    set({ agentProfile: { ...form, ...patch } })

  // Seed defaults into the wizard store so the footer "Continuer" CTA enables
  // on first render (canNext relies on agentProfile being present).
  useEffect(() => {
    if (!data.agentProfile) set({ agentProfile: form })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 8 }}>
      {/* Hero form-first : H1 réduit + sub court, la card prend le devant */}
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
          Vous, sur MEGGA.
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
          Photo, rôle, mobile, langues parlées.
          <br />
          Le reste se peaufine plus tard, depuis vos paramètres.
        </p>
      </div>

      <ObCard
        padding={32}
        radius={24}
        dark={dark}
        style={{ animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}
      >
        <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start' }}>
          <ObAvatarUploader
            value={form.avatar}
            onChange={(v) => upd({ avatar: v })}
            initials={(
              (form.firstName?.[0] ?? '') + (form.lastName?.[0] ?? '')
            ).toUpperCase()}
            dark={dark}
            userId={profile?.id ?? null}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              <ObField label="Prénom" dark={dark}>
                <input
                  value={form.firstName}
                  onChange={(e) => upd({ firstName: e.target.value })}
                  style={obInputStyle(t)}
                />
              </ObField>
              <ObField label="Nom" dark={dark}>
                <input
                  value={form.lastName}
                  onChange={(e) => upd({ lastName: e.target.value })}
                  style={obInputStyle(t)}
                />
              </ObField>
            </div>

            <div style={{ height: 14 }} />

            <ObField label="Mobile professionnel" dark={dark}>
              <input
                value={form.phone}
                onChange={(e) => upd({ phone: e.target.value })}
                placeholder="+41 79 555 12 34"
                style={obInputStyle(t)}
              />
            </ObField>
          </div>
        </div>

        <div style={{ height: 1, background: t.divider, margin: '26px 0 24px' }} />

        <ObField label="Rôle dans l'agence" dark={dark}>
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: t.cardSubtle,
            }}
          >
            {ROLES.map((r) => {
              const active = form.role === r.key
              return (
                <button
                  key={r.key}
                  onClick={() => upd({ role: r.key })}
                  style={{
                    flex: 1,
                    height: 38,
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
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </ObField>

        <div style={{ height: 24 }} />

        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: t.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Langues parlées
          </div>
          <ObChipMulti
            options={LANGUAGES}
            value={form.languages}
            onChange={(v) => upd({ languages: v })}
            dark={dark}
          />
        </div>
      </ObCard>
    </div>
  )
}
