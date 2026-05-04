import { useRef, useState } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { useAvatar } from '@/hooks/useAvatar'
import { useProfileMeta, type ProfileMode } from '@/hooks/useProfileMeta'
import AvatarCropModal from '@/components/profile/AvatarCropModal'
import { CameraIcon, CheckIcon, VerifiedBadge } from '../icons'

const MODE_OPTIONS: Array<{ key: ProfileMode; label: string }> = [
  { key: 'buyer', label: 'Acheteur' },
  { key: 'mixed', label: 'Mixte' },
  { key: 'seller', label: 'Vendeur' },
]

interface ModeToggleProps {
  value: ProfileMode
  onChange: (next: ProfileMode) => void
}

function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: '#F2F4F8',
        border: `1px solid ${T.border}`,
      }}
    >
      {MODE_OPTIONS.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              height: 30,
              padding: '0 14px',
              borderRadius: 999,
              border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? T.ink : T.muted,
              boxShadow: active ? '0 1px 2px rgba(14,20,16,0.06)' : 'none',
              fontFamily: T.fontStack,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: -0.1,
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface StepDotProps {
  filled: boolean
  label: string
  sub: string
}

function StepDot({ filled, label, sub }: StepDotProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          flexShrink: 0,
          background: filled ? T.accent : '#fff',
          border: filled ? 'none' : `1.5px dashed ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
        }}
      >
        {filled ? <CheckIcon size={13} /> : null}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 12,
            fontWeight: 700,
            color: T.ink,
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 10.5,
            color: T.muted,
            lineHeight: 1.2,
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}

interface VerificationStripProps {
  verifications: { email: boolean; phone: boolean; id: boolean }
  onUpgrade: () => void
}

function VerificationStrip({ verifications: v, onUpgrade }: VerificationStripProps) {
  const score = (v.email ? 1 : 0) + (v.phone ? 1 : 0) + (v.id ? 1 : 0)
  const isFull = score === 3
  const pct = Math.round((score / 3) * 100)

  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: T.fontStack, fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: -0.1 }}>
            Identité MEGGA
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: isFull ? T.greenSoft : '#F2F4F8',
              color: isFull ? T.green : T.soft,
              fontFamily: T.fontStack,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            {isFull ? 'Complète' : `${score}/3`}
          </span>
        </div>
        {!isFull && (
          <button
            onClick={onUpgrade}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              background: T.ink,
              color: '#fff',
              border: 'none',
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.2,
            }}
          >
            Compléter →
          </button>
        )}
      </div>
      <div style={{ height: 4, background: '#F2F4F8', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isFull ? T.green : T.accent,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
        <StepDot filled={v.email} label="E-mail" sub={v.email ? 'Confirmé' : 'Non vérifié'} />
        <div style={{ width: 1, background: T.border }} />
        <StepDot filled={v.phone} label="Téléphone" sub={v.phone ? 'Code SMS confirmé' : 'Non vérifié'} />
        <div style={{ width: 1, background: T.border }} />
        <StepDot filled={v.id} label="Pièce d'identité" sub={v.id ? 'Vérifiée' : 'Active la signature C2PA forte'} />
      </div>
    </div>
  )
}

interface StatPillProps {
  value: number
  label: string
}

function StatPill({ value, label }: StatPillProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span
        style={{
          fontFamily: T.fontStack,
          fontSize: 16,
          fontWeight: 800,
          color: T.ink,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -0.3,
        }}
      >
        {value}
      </span>
      <span style={{ fontFamily: T.fontStack, fontSize: 12, color: T.soft }}>{label}</span>
    </div>
  )
}

interface Props {
  stats: { label: string; value: number }[]
  joinedDate: string
  city: string | null
  onUpgradeId: () => void
}

export default function ProfileHero({ stats, joinedDate, city, onUpgradeId }: Props) {
  const { user, profile } = useAuth()
  const { avatarUrl, saveDataUrl, removeAvatar } = useAvatar()
  const { meta, setMode } = useProfileMeta()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user || !profile) return null

  const name = profile.full_name || user.email || 'Vous'
  const email = user.email ?? ''
  const initials = name
    ? name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : (email[0] || 'U').toUpperCase()

  const dayLabel = new Date().toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })

  const verifications = {
    email: !!user.email,
    phone: !!profile.phone || meta.verifications.phone,
    id: meta.verifications.id,
  }

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setPendingImage(reader.result as string)
      setAvatarOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <div
        style={{
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: '26px 28px 22px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top row: greeting + mode toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 24,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 auto' }}>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 700,
                color: T.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              {dayLabel}
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 26,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: -0.7,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Bonjour {name.split(' ')[0]}.
            </div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <ModeToggle value={meta.mode} onChange={setMode} />
          </div>
        </div>

        {/* Identity row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleAvatarClick}
              title="Modifier la photo"
              style={{
                width: 76,
                height: 76,
                borderRadius: 999,
                background: avatarUrl ? `center/cover no-repeat url(${avatarUrl})` : T.ink,
                color: '#fff',
                border: `2px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: T.fontStack,
                fontSize: 24,
                fontWeight: 800,
                letterSpacing: 0.5,
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 2px 6px rgba(14,20,16,0.08)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                const ov = e.currentTarget.querySelector<HTMLSpanElement>('.avatar-overlay')
                if (ov) ov.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                const ov = e.currentTarget.querySelector<HTMLSpanElement>('.avatar-overlay')
                if (ov) ov.style.opacity = '0'
              }}
            >
              {!avatarUrl && initials}
              <span
                className="avatar-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'rgba(14,20,16,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.16s ease',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <CameraIcon size={20} />
                <span
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#fff',
                    letterSpacing: 0.3,
                    textTransform: 'uppercase',
                  }}
                >
                  Modifier
                </span>
              </span>
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 20,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: -0.4,
                }}
              >
                {name}
              </span>
              {verifications.id && (
                <span title="Identité vérifiée">
                  <VerifiedBadge size={20} />
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 13,
                color: T.soft,
                marginBottom: 10,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {city ? `${city} · ` : ''}Membre depuis {joinedDate}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
              {stats.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 18 }}>
                  {i > 0 && (
                    <span
                      style={{ width: 3, height: 3, borderRadius: 999, background: T.border, flexShrink: 0 }}
                    />
                  )}
                  <StatPill value={s.value} label={s.label} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <VerificationStrip verifications={verifications} onUpgrade={onUpgradeId} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <AvatarCropModal
        open={avatarOpen}
        imageSrc={pendingImage}
        existingAvatar={avatarUrl}
        onSave={(dataUrl) => {
          saveDataUrl(dataUrl)
          setAvatarOpen(false)
          setPendingImage(null)
        }}
        onDelete={() => {
          removeAvatar()
          setAvatarOpen(false)
          setPendingImage(null)
        }}
        onClose={() => {
          setAvatarOpen(false)
          setPendingImage(null)
        }}
      />
    </>
  )
}
