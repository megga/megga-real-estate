import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { useProfileMeta } from '@/hooks/useProfileMeta'

type PageKey = 'info' | 'preferences' | 'notifications' | 'security' | 'privacy'

const PAGES: Array<{ key: PageKey; label: string; sub: string }> = [
  { key: 'info', label: 'Informations personnelles', sub: 'Nom, e-mail, téléphone, ville' },
  { key: 'preferences', label: 'Préférences', sub: 'Langues, devise, surfaces, tri' },
  { key: 'notifications', label: 'Notifications', sub: 'E-mail, push, SMS, fréquence' },
  { key: 'security', label: 'Sécurité', sub: 'Mot de passe, 2FA, sessions' },
  { key: 'privacy', label: 'Confidentialité & données', sub: 'Visibilité, export, suppression' },
]

interface FieldLabelProps {
  children: React.ReactNode
  hint?: string
}

function FieldLabel({ children, hint }: FieldLabelProps) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontFamily: T.fontStack, fontSize: 11, fontWeight: 700, color: T.ink, letterSpacing: 0.2 }}>
        {children}
      </div>
      {hint && <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        height: 38,
        padding: '0 12px',
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        fontFamily: T.fontStack,
        fontSize: 13,
        color: T.ink,
        outline: 'none',
        background: '#fff',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = T.accent)}
      onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
    />
  )
}

function Toggle({
  on,
  onChange,
  label,
  sub,
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
  sub?: string
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '14px 0',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            color: T.ink,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        {sub && <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <span
        style={{
          flexShrink: 0,
          width: 38,
          height: 22,
          borderRadius: 999,
          background: on ? T.accent : '#D5D8DD',
          position: 'relative',
          transition: 'background 0.18s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 18 : 2,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: '#fff',
            transition: 'left 0.18s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </span>
    </button>
  )
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 11,
          fontWeight: 800,
          color: T.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {children}
      </div>
      {sub && <div style={{ fontFamily: T.fontStack, fontSize: 12, color: T.soft }}>{sub}</div>}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: T.border, margin: '20px 0' }} />
}

interface Props {
  open: boolean
  onClose: () => void
  initialPage?: PageKey
}

export default function ProfileSettingsDrawer({ open, onClose, initialPage = 'info' }: Props) {
  const { user, profile } = useAuth()
  const { meta, update } = useProfileMeta()
  const [page, setPage] = useState<PageKey>(initialPage)

  useEffect(() => {
    if (open) setPage(initialPage)
  }, [open, initialPage])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const renderPage = () => {
    if (page === 'info') {
      return (
        <>
          <SectionTitle sub="Visibles uniquement par les agents que vous contactez.">Identité</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <FieldLabel>Nom complet</FieldLabel>
              <TextInput value={profile?.full_name ?? ''} onChange={() => undefined} placeholder="Camille Aebischer" />
            </div>
            <div>
              <FieldLabel>E-mail</FieldLabel>
              <TextInput value={user?.email ?? ''} onChange={() => undefined} type="email" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <FieldLabel>Téléphone</FieldLabel>
              <TextInput value={profile?.phone ?? ''} onChange={() => undefined} placeholder="+41 79 …" />
            </div>
            <div>
              <FieldLabel>Canton</FieldLabel>
              <TextInput value={profile?.canton ?? ''} onChange={() => undefined} placeholder="GE" />
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <FieldLabel hint="Une courte phrase qui apparaîtra sur votre profil public.">Bio</FieldLabel>
            <textarea
              value={meta.bio}
              onChange={(e) => update({ bio: e.target.value })}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontFamily: T.fontStack,
                fontSize: 13,
                color: T.ink,
                outline: 'none',
                background: '#fff',
                resize: 'vertical',
              }}
            />
          </div>
        </>
      )
    }

    if (page === 'preferences') {
      return (
        <>
          <SectionTitle sub="Personnalisez votre expérience MEGGA.">Affichage</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <FieldLabel>Devise</FieldLabel>
              <select
                value={meta.preferences.currency}
                onChange={(e) => update({ preferences: { currency: e.target.value as 'CHF' | 'EUR' } })}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  background: '#fff',
                }}
              >
                <option value="CHF">CHF — Franc suisse</option>
                <option value="EUR">EUR — Euro</option>
              </select>
            </div>
            <div>
              <FieldLabel>Surface</FieldLabel>
              <select
                value={meta.preferences.areaUnit}
                onChange={(e) => update({ preferences: { areaUnit: e.target.value as 'm2' | 'ft2' } })}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  background: '#fff',
                }}
              >
                <option value="m2">m² (mètres carrés)</option>
                <option value="ft2">ft² (pieds carrés)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <FieldLabel>Tri par défaut</FieldLabel>
            <select
              value={meta.preferences.defaultSort}
              onChange={(e) =>
                update({ preferences: { defaultSort: e.target.value as 'relevance' | 'price' | 'date' } })
              }
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                fontFamily: T.fontStack,
                fontSize: 13,
                background: '#fff',
              }}
            >
              <option value="relevance">Pertinence</option>
              <option value="price">Prix croissant</option>
              <option value="date">Plus récents</option>
            </select>
          </div>
        </>
      )
    }

    if (page === 'notifications') {
      return (
        <>
          <SectionTitle sub="Choisissez comment MEGGA vous contacte.">Canaux</SectionTitle>
          <Toggle
            on={meta.notifications.email}
            onChange={(v) => update({ notifications: { email: v } })}
            label="E-mail"
            sub="Alertes recherche, messages, mises à jour de mandat"
          />
          <Divider />
          <Toggle
            on={meta.notifications.push}
            onChange={(v) => update({ notifications: { push: v } })}
            label="Notifications push"
            sub="Sur le navigateur ou l'application MEGGA"
          />
          <Divider />
          <Toggle
            on={meta.notifications.sms}
            onChange={(v) => update({ notifications: { sms: v } })}
            label="SMS"
            sub="Pour les visites confirmées et urgences uniquement"
          />
          <Divider />
          <SectionTitle>Fréquence des alertes recherche</SectionTitle>
          <select
            value={meta.notifications.searchFreq}
            onChange={(e) =>
              update({
                notifications: { searchFreq: e.target.value as 'instant' | 'daily' | 'weekly' },
              })
            }
            style={{
              width: '100%',
              height: 38,
              padding: '0 12px',
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              fontFamily: T.fontStack,
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="instant">Instantané — dès qu'un bien correspond</option>
            <option value="daily">Quotidien — un récap par jour</option>
            <option value="weekly">Hebdomadaire — chaque lundi</option>
          </select>
        </>
      )
    }

    if (page === 'security') {
      return (
        <>
          <SectionTitle sub="Protégez votre compte MEGGA.">Authentification</SectionTitle>
          <Toggle
            on={meta.security.twoFactor}
            onChange={(v) => update({ security: { twoFactor: v } })}
            label="Double authentification (2FA)"
            sub="Code SMS ou application d'authentification"
          />
          <Divider />
          <Toggle
            on={meta.security.passkeys}
            onChange={(v) => update({ security: { passkeys: v } })}
            label="Passkeys"
            sub="Connexion biométrique sans mot de passe"
          />
          <Divider />
          <Toggle
            on={meta.security.loginAlerts}
            onChange={(v) => update({ security: { loginAlerts: v } })}
            label="Alertes de connexion"
            sub="E-mail à chaque connexion depuis un nouvel appareil"
          />
          <Divider />
          <SectionTitle>Sessions actives</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {meta.sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontStack, fontSize: 12, fontWeight: 700, color: T.ink }}>
                    {s.device}
                    {s.current && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: T.greenSoft,
                          color: T.green,
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        Actuelle
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, marginTop: 2 }}>
                    {s.location} · {s.lastActive}
                  </div>
                </div>
                {!s.current && (
                  <button
                    type="button"
                    style={{
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 999,
                      border: `1px solid ${T.border}`,
                      background: '#fff',
                      color: T.dangerDark,
                      fontFamily: T.fontStack,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Révoquer
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )
    }

    if (page === 'privacy') {
      return (
        <>
          <SectionTitle sub="Contrôlez ce que MEGGA partage et conserve.">Visibilité</SectionTitle>
          <Toggle
            on={meta.privacy.profilePublic}
            onChange={(v) => update({ privacy: { profilePublic: v } })}
            label="Profil public"
            sub="Les agents peuvent voir votre nom, ville et photo"
          />
          <Divider />
          <Toggle
            on={meta.privacy.analytics}
            onChange={(v) => update({ privacy: { analytics: v } })}
            label="Analyse d'usage"
            sub="Aide MEGGA à améliorer le produit (anonymisé)"
          />
          <Divider />
          <Toggle
            on={meta.privacy.marketing}
            onChange={(v) => update({ privacy: { marketing: v } })}
            label="Communications marketing"
            sub="Conseils, nouveautés produit, contenu éditorial"
          />
          <Divider />
          <SectionTitle>Vos données</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: '#fff',
                color: T.ink,
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Exporter mes données (JSON)
            </button>
            <button
              type="button"
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: `1px solid ${T.dangerDark}`,
                background: '#fff',
                color: T.dangerDark,
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Supprimer mon compte
            </button>
          </div>
        </>
      )
    }

    return null
  }

  if (!open) return null

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(14, 20, 16, 0.55)',
          opacity: 1,
          transition: 'opacity 240ms ease',
          zIndex: 90,
        }}
      />
      <div
        role="dialog"
        aria-label="Réglages du compte"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(720px, 100vw)',
          background: '#FAFAF7',
          boxShadow: '-12px 0 40px rgba(14,20,16,0.18)',
          transform: 'translateX(0)',
          transition: 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          zIndex: 91,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: T.fontStack,
        }}
      >
        <div
          style={{
            padding: '20px 28px',
            borderBottom: `1px solid ${T.border}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                color: T.muted,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Réglages
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 18,
                fontWeight: 800,
                color: T.ink,
                letterSpacing: -0.3,
                marginTop: 4,
              }}
            >
              {PAGES.find((p) => p.key === page)?.label}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: T.ink,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '200px 1fr',
            flex: 1,
            minHeight: 0,
          }}
        >
          <nav
            style={{
              borderRight: `1px solid ${T.border}`,
              padding: 12,
              background: '#FAFAF7',
              overflowY: 'auto',
            }}
          >
            {PAGES.map((p) => {
              const isActive = page === p.key
              return (
                <button
                  key={p.key}
                  onClick={() => setPage(p.key)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: isActive ? `1px solid ${T.border}` : '1px solid transparent',
                    borderRadius: 8,
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? T.ink : T.soft,
                    cursor: 'pointer',
                    fontFamily: T.fontStack,
                    fontSize: 12.5,
                    fontWeight: isActive ? 700 : 500,
                    marginBottom: 2,
                    boxShadow: isActive ? '0 1px 2px rgba(14,20,16,0.04)' : 'none',
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </nav>
          <div style={{ padding: '24px 28px', overflowY: 'auto' }}>{renderPage()}</div>
        </div>
      </div>
    </>,
    document.body
  )
}
