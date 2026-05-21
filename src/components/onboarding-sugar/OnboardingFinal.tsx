// MEGGA Onboarding — Écran final : fiche agent complète + CTA CRM
// Source : handoff-onboarding/onboarding/megga-onboarding-app.jsx → ObFinal
import { obPalette } from './tokens'
import { ObIcon } from './primitives'
import { ObBlackPill } from './primitives'
import type { AgentProfile, OnboardingData } from './types'

const ROLE_LABELS: Record<string, string> = {
  courtier: 'Courtier·ère',
  direction: 'Direction',
  admin: 'Administratif',
  stagiaire: 'Stage LBA',
}
const LANG_LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
  es: 'Español',
  pt: 'Português',
}

export function OnboardingFinal({
  data, dark, onEnter,
}: {
  data: OnboardingData
  dark?: boolean
  onEnter: () => void
}) {
  const t = obPalette(dark)
  const profile: Partial<AgentProfile> = data.agentProfile ?? {}
  const firstName = profile.firstName || 'Marie'
  const lastName = profile.lastName || 'Schaeffer'
  const fullName = `${firstName} ${lastName}`
  const initials =
    ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || 'MS'
  const role = ROLE_LABELS[profile.role ?? ''] ?? 'Courtier·ère'
  const phone = profile.phone || '+41 79 555 12 34'
  const langs = (profile.languages?.length ? profile.languages : ['fr', 'en'])
    .map((k) => LANG_LABELS[k] ?? k)
  const avatar = profile.avatar

  const ag = data.agenceSelected ??
    data.agenceCreated ??
    { name: 'votre agence', city: 'Lausanne', canton: 'VD' }
  const planLabel = data.plan === 'pro' ? 'Pro' : 'Découverte'
  const billing = data.billing === 'yearly' ? 'annuel' : 'mensuel'
  const today = new Date().toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      style={{
        maxWidth: 640,
        margin: '0 auto',
        paddingTop: 8,
        textAlign: 'center',
        animation: 'obFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 42,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: -1,
          lineHeight: 1.05,
        }}
      >
        Bienvenue, {firstName}.
      </h1>
      <p
        style={{
          margin: '0 auto 36px',
          maxWidth: 440,
          fontSize: 15.5,
          color: t.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
        }}
      >
        Votre fiche est prête. MEGGA vous attend dans Aujourd'hui.
      </p>

      <div
        style={{
          position: 'relative',
          background: t.card,
          borderRadius: 24,
          boxShadow: t.shadow,
          padding: '32px 32px 28px',
          textAlign: 'left',
          animation: 'obFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
          animationDelay: '0.1s',
          animationFillMode: 'both',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 20,
            alignItems: 'center',
            marginBottom: 26,
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: 76,
              height: 76,
              borderRadius: 999,
              background: avatar ? `url(${avatar}) center/cover` : t.cardSubtle,
              color: t.ink,
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.6,
              boxShadow: t.shadowSm,
            }}
          >
            {!avatar && initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.6,
                lineHeight: 1.15,
                marginBottom: 4,
              }}
            >
              {fullName}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: t.inkSoft,
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: t.cardSubtle,
                  color: t.ink,
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: -0.1,
                }}
              >
                {role}
              </span>
              <span>·</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{phone}</span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: t.divider, marginBottom: 20 }} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '18px 28px',
          }}
        >
          <div>
            <Eyebrow t={t}>Agence</Eyebrow>
            <div
              style={{
                fontSize: 14,
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
              {ag.city}, {ag.canton}
            </div>
          </div>
          <div>
            <Eyebrow t={t}>Forfait</Eyebrow>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: t.ink,
                letterSpacing: -0.2,
              }}
            >
              {planLabel}
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.muted,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              Facturation {billing}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Eyebrow t={t}>Langues parlées</Eyebrow>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {langs.map((l, i) => (
                <span
                  key={i}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: t.cardSubtle,
                    color: t.ink,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: -0.1,
                  }}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            paddingTop: 18,
            borderTop: `1px solid ${t.divider}`,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: 11.5,
            color: t.muted,
            fontWeight: 600,
            letterSpacing: 0.1,
          }}
        >
          <span>Membre depuis le {today}</span>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <ObBlackPill
          onClick={onEnter}
          dark={dark}
          size="lg"
          icon={<ObIcon name="arrowR" size={18} stroke={dark ? '#0B0C0E' : '#fff'} />}
        >
          Aller sur le CRM
        </ObBlackPill>
      </div>
    </div>
  )
}

function Eyebrow({
  children, t,
}: {
  children: React.ReactNode
  t: ReturnType<typeof obPalette>
}) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: t.muted,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}
