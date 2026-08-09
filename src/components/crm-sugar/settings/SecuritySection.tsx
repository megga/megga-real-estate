// MEGGA CRM Sugar v2 — Settings · Sécurité — maquette « Sugar Pure » (bento).
//
// Layout BENTO : colonne, gap 14, maxWidth 1040.
//   1. HERO sombre : titre + sous-titre.
//   2. grille 1fr/1fr : carte Mot de passe (PwdVaultLight) + carte SSO.
//   3. carte Sessions pleine largeur.
//
// CÂBLAGE RÉEL :
//   - Mot de passe    → useAuth().updatePassword / resetPassword (supabase.auth)
//   - Appareils       → useUserDevices (table user_devices, RLS self)
//   - SSO             → SSOConnectionsCard (useSsoIdentities)
//
// Le hero est volontairement sombre (texte blanc) dans les deux thèmes :
//   fond #0B0C0E en light, #16171F en dark — seule surface hors tokens clairs.

import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { SetIcon } from './atoms'
import { SET_PALETTE, SET_DARK } from './data'
import { crmStep } from '@/components/crm-sugar/tokens'
import { SSOConnectionsCard } from './SSOConnectionsCard'
import { useUserDevices, type UserDevice } from '@/hooks/useUserDevices'

const SET = SET_PALETTE

// Détection dark : SET_PALETTE est muté par applySetTheme avant le render ;
// la card dark vaut #16171F (signal stable). Sert au fond du hero.
const isDark = () => SET.card === SET_DARK.card

// ════════════════════════════════════════════════════════════════════════
//  Force d'un mot de passe (0–4) — barème de la maquette
// ════════════════════════════════════════════════════════════════════════
function scorePassword(s: string): number {
  if (!s) return 0
  let n = 0
  if (s.length >= 8) n++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) n++
  if (/\d/.test(s)) n++
  if (/[^A-Za-z0-9]/.test(s)) n++
  return Math.min(n, 4)
}
// Clés i18n indexées par score 0–4 — résolues via t() dans <Meter />.
const PWD_LABEL_KEYS = [
  'security.password.strengthTooShort',
  'security.password.strengthWeak',
  'security.password.strengthMedium',
  'security.password.strengthGood',
  'security.password.strengthStrong',
]
const PWD_COLORS = [SET.muted, SET.bad, SET.warn, SET.ok, SET.ok]

// ════════════════════════════════════════════════════════════════════════
//  Champ mot de passe (clair) avec œil show/hide
// ════════════════════════════════════════════════════════════════════════
function PwdField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  tone,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  tone?: string | null
}) {
  const { t } = useTranslation('settings')
  const [show, setShow] = useState(false)
  const [foc, setFoc] = useState(false)
  const ring = tone || (foc ? SET.ink : null)
  return (
    <div>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: 'var(--crm-text-sm)',
            fontWeight: 700,
            color: SET.inkSoft,
            marginBottom: 7,
            letterSpacing: -0.1,
          }}
        >
          {label}
        </label>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-sm)',
          height: 46,
          padding: '0 var(--crm-space-sm) 0 var(--crm-space-xl)',
          borderRadius: 'var(--crm-radius-xl)',
          background: foc ? SET.inputFocusBg : SET.cardSubtle,
          boxShadow: `inset 0 0 0 ${ring ? 1.5 : 1}px ${ring || SET.line}`,
          transition: 'box-shadow .15s, background .15s',
        }}
      >
        <input
          type={show ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          autoComplete="new-password"
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFoc(true)}
          onBlur={() => setFoc(false)}
          style={{
            flex: 1,
            minWidth: 0,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            color: SET.ink,
            letterSpacing: value && !show ? 2 : 0,
          }}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? t('security.password.hide') : t('security.password.show')}
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--crm-radius-sm)',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SetIcon name={show ? 'eyeOff' : 'eye'} size={15} stroke={show ? SET.ink : SET.muted} sw={1.7} />
        </button>
      </div>
    </div>
  )
}

// Barre de force réutilisable (4 segments).
function Meter({ s }: { s: number }) {
  const { t } = useTranslation('settings')
  const col = PWD_COLORS[s]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
      <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', flex: 1 }}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: 6,
              flex: 1,
              borderRadius: 'var(--crm-radius-pill)',
              background: i < s ? col : SET.cardSubtle,
              transition: 'background .25s',
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 'var(--crm-text-md)',
          fontWeight: 800,
          color: col,
          letterSpacing: -0.1,
          whiteSpace: 'nowrap',
        }}
      >
        {t(PWD_LABEL_KEYS[s])}
      </span>
    </div>
  )
}

// CTA noir avec état désactivé (sur surface claire).
function SaveBtn({ ready, onClick, loading }: { ready: boolean; onClick: () => void; loading?: boolean }) {
  const { t } = useTranslation('settings')
  return (
    <button
      onClick={() => ready && !loading && onClick()}
      disabled={!ready || loading}
      style={{
        height: 40,
        padding: '0 var(--crm-space-5xl)',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: ready ? SET.black : SET.cardSubtle,
        color: ready ? SET.blackInk : SET.ghost,
        fontFamily: 'inherit',
        fontSize: 'var(--crm-text-md)',
        fontWeight: 700,
        cursor: ready && !loading ? 'pointer' : 'not-allowed',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        transition: 'background .18s, color .18s',
        boxShadow: ready ? '0 6px 16px rgba(11,12,14,0.18)' : `inset 0 0 0 1px ${SET.line}`,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 'var(--crm-radius-pill)',
            border: `2px solid ${SET.blackInk}4d`,
            borderTopColor: SET.blackInk,
            animation: 'setSpin .7s linear infinite',
          }}
        />
      ) : (
        <SetIcon name="check" size={14} stroke={ready ? SET.blackInk : SET.ghost} sw={2.4} />
      )}
      {t('page.save')}
    </button>
  )
}

// Sceau de succès centré.
function SuccessCenter({ sub }: { sub: string }) {
  const { t } = useTranslation('settings')
  return (
    <div
      style={{
        minHeight: 196,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 66,
          height: 66,
          flexShrink: 0,
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.ok,
          display: 'grid',
          placeItems: 'center',
          boxShadow: `0 8px 22px ${SET.ok}40`,
          animation: 'setRingPop .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <svg width={33} height={33} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4 10-12" />
        </svg>
      </div>
      <div style={{ marginTop: 18, fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: -0.3, color: SET.ink }}>
        {t('security.password.changedTitle')}
      </div>
      <div style={{ marginTop: 6, fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted }}>{sub}</div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  CARTE MOT DE PASSE — view · edit · forgot · sent · saved (câblage réel)
// ════════════════════════════════════════════════════════════════════════
function PwdVaultLight() {
  const { t } = useTranslation('settings')
  const { user, updatePassword, resetPassword } = useAuth()
  const toast = useToast()
  const verifiedEmail = user?.email ?? ''
  const maskEmail = (e: string) => {
    if (!e.includes('@')) return e
    const [u, d] = e.split('@')
    return `${u[0]}${'•'.repeat(Math.max(u.length - 1, 3))}@${d}`
  }

  const [mode, setMode] = useState<'view' | 'edit' | 'forgot' | 'sent' | 'saved'>('view')
  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [cf, setCf] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [saving, setSaving] = useState(false)

  const s = scorePassword(nw)
  const match = cf.length > 0 && nw === cf
  const ko = cf.length > 0 && nw !== cf
  // Supabase n'exige pas l'ancien mot de passe pour updateUser, mais l'UX
  // le demande (confirme l'identité côté écran) — non bloquant côté API.
  const canSave = cur.length >= 1 && s >= 3 && match && !saving
  const reset = () => {
    setCur('')
    setNw('')
    setCf('')
  }

  useEffect(() => {
    if (mode !== 'saved') return
    const t = setTimeout(() => setMode('view'), 3200)
    return () => clearTimeout(t)
  }, [mode])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const { error } = await updatePassword(nw)
    setSaving(false)
    if (error) {
      toast.error(t('security.failureWith', { message: error }))
      return
    }
    reset()
    setMode('saved')
  }

  const sendReset = async () => {
    if (!verifiedEmail) return
    const { error } = await resetPassword(verifiedEmail)
    if (error) {
      toast.error(t('security.failureWith', { message: error }))
      return
    }
    setMode('sent')
    setCooldown(30)
  }

  const cardStyle: React.CSSProperties = {
    background: SET.card,
    borderRadius: 'var(--crm-radius-5xl)',
    padding: 28,
    boxShadow: SET.shadow,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  }

  // En-tête partagé (masqué en saved).
  const Header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-2xl)', marginBottom: 22 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--crm-radius-lg)',
          flexShrink: 0,
          background: SET.black,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SetIcon name="lock" size={20} stroke={SET.blackInk} sw={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: -0.3, color: SET.ink }}>
          {t('security.password.title')}
        </h3>
        <p style={{ margin: '5px 0 0', fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 500, lineHeight: 1.5 }}>
          {mode === 'view' && t('security.password.descView')}
          {mode === 'edit' && t('security.password.descEdit')}
          {mode === 'forgot' && t('security.password.descForgot')}
          {mode === 'sent' && t('security.password.descSent')}
        </p>
      </div>
    </div>
  )

  return (
    <div style={cardStyle}>
      {mode !== 'saved' && Header}

      {mode === 'view' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-xl)',
              padding: 'var(--crm-space-2xl) var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-xl)',
              background: SET.cardSubtle,
              boxShadow: `inset 0 0 0 1px ${SET.line}`,
            }}
          >
            <span
              style={{
                flex: 1,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 'var(--crm-text-3xl)',
                letterSpacing: 4,
                color: SET.ink,
              }}
            >
              ••••••••••
            </span>
          </div>
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 'var(--crm-space-4xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--crm-space-xl)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 600 }}>
              {t('security.password.encryptedNote')}
            </span>
            <button
              onClick={() => setMode('edit')}
              style={{
                height: 36,
                padding: '0 var(--crm-space-3xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: SET.black,
                color: SET.blackInk,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-md)',
                boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
              }}
            >
              <SetIcon name="key" size={13} stroke={SET.blackInk} sw={2.2} /> {t('common:actions.edit')}
            </button>
          </div>
        </>
      )}

      {mode === 'edit' && (
        <div
          style={{
            animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--crm-space-2xl)',
          }}
        >
          <div>
            <PwdField label={t('security.password.currentLabel')} value={cur} onChange={setCur} placeholder={t('security.password.currentPlaceholder')} autoFocus />
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                onClick={() => {
                  reset()
                  setMode('forgot')
                }}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'var(--crm-text-sm)',
                  fontWeight: 700,
                  color: SET.inkSoft,
                  textDecoration: 'underline',
                  textUnderlineOffset: 2,
                  padding: 0,
                }}
              >
                {t('security.password.forgotLink')}
              </button>
            </div>
          </div>
          <div>
            <PwdField label={t('security.password.newLabel')} value={nw} onChange={setNw} placeholder={t('security.password.newPlaceholder')} />
            {nw && (
              <div style={{ marginTop: 10 }}>
                <Meter s={s} />
              </div>
            )}
          </div>
          <div>
            <PwdField
              label={t('security.password.confirmLabel')}
              value={cf}
              onChange={setCf}
              placeholder={t('security.password.confirmPlaceholder')}
              tone={ko ? SET.bad : match ? SET.ok : null}
            />
            {(match || ko) && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-sm)',
                  marginTop: 9,
                  fontSize: 'var(--crm-text-sm)',
                  fontWeight: 700,
                  color: match ? SET.ok : SET.bad,
                }}
              >
                <SetIcon name={match ? 'check' : 'x'} size={13} stroke={match ? SET.ok : SET.bad} sw={2.4} />
                {match ? t('security.password.keysMatch') : t('security.password.keysMismatch')}
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 4,
              paddingTop: 'var(--crm-space-3xl)',
              borderTop: `1px solid ${SET.line}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--crm-space-xl)',
            }}
          >
            <button
              onClick={() => {
                reset()
                setMode('view')
              }}
              style={ghostInline}
            >
              {t('common:actions.cancel')}
            </button>
            <SaveBtn ready={canSave} loading={saving} onClick={save} />
          </div>
        </div>
      )}

      {mode === 'forgot' && (
        <div
          style={{
            animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--crm-space-xl)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-xl)',
              padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-xl)',
              background: SET.cardSubtle,
              boxShadow: `inset 0 0 0 1px ${SET.line}`,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--crm-radius-md)',
                flexShrink: 0,
                background: SET.black,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="mail" size={16} stroke={SET.blackInk} sw={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 'var(--crm-text-sm)',
                  fontWeight: 800,
                  color: SET.muted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('security.password.sentTo')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: SET.ink, letterSpacing: -0.1, marginTop: 1 }}>
                {maskEmail(verifiedEmail)}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--crm-space-md)',
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 500,
              color: SET.muted,
              lineHeight: 1.5,
            }}
          >
            <SetIcon name="info" size={13} stroke={SET.muted} sw={1.8} />
            <span>{t('security.password.forgotInfo')}</span>
          </div>
          <div
            style={{
              marginTop: 4,
              paddingTop: 'var(--crm-space-3xl)',
              borderTop: `1px solid ${SET.line}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--crm-space-xl)',
            }}
          >
            <button onClick={() => setMode('edit')} style={ghostInline}>
              {t('common:actions.back')}
            </button>
            <button
              onClick={sendReset}
              disabled={!verifiedEmail}
              style={{
                height: 40,
                padding: '0 var(--crm-space-5xl)',
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: verifiedEmail ? SET.black : SET.cardSubtle,
                color: verifiedEmail ? SET.blackInk : SET.ghost,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 700,
                cursor: verifiedEmail ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--crm-space-md)',
                boxShadow: verifiedEmail ? '0 6px 16px rgba(11,12,14,0.18)' : 'none',
              }}
            >
              <SetIcon name="mail" size={14} stroke={verifiedEmail ? SET.blackInk : SET.ghost} sw={2} /> {t('security.password.sendLink')}
            </button>
          </div>
        </div>
      )}

      {mode === 'sent' && (
        <div
          style={{
            animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--crm-space-xl)',
              padding: 'var(--crm-space-3xl)',
              borderRadius: 'var(--crm-radius-2xl)',
              background: `${SET.ok}10`,
              boxShadow: `inset 0 0 0 1px ${SET.ok}28`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--crm-radius-md)',
                flexShrink: 0,
                background: SET.ok,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="check" size={19} stroke="#fff" sw={2.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: SET.ink, letterSpacing: -0.1 }}>
                {t('security.password.checkInbox')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: SET.muted, fontWeight: 500, marginTop: 3, lineHeight: 1.5 }}>
                <Trans
                  i18nKey="security.password.sentBody"
                  ns="settings"
                  values={{ email: maskEmail(verifiedEmail) }}
                  components={{ b: <strong style={{ color: SET.ink, fontWeight: 700 }} /> }}
                />
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 'var(--crm-space-3xl)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--crm-space-xl)',
            }}
          >
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SET.muted }}>
              {t('security.password.nothingReceived')}{' '}
              {cooldown > 0 ? (
                <span style={{ color: SET.ghost, fontWeight: 700 }}>{t('security.password.resendIn', { count: cooldown })}</span>
              ) : (
                <button
                  onClick={sendReset}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-sm)',
                    fontWeight: 800,
                    color: SET.ink,
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                    padding: 0,
                  }}
                >
                  {t('security.password.resend')}
                </button>
              )}
            </span>
            <button
              onClick={() => {
                reset()
                setMode('view')
              }}
              style={ghostInline}
            >
              {t('security.password.done')}
            </button>
          </div>
        </div>
      )}

      {mode === 'saved' && <SuccessCenter sub={t('security.password.changedSub')} />}
    </div>
  )
}

const ghostInline: React.CSSProperties = {
  height: 40,
  padding: '0 var(--crm-space-3xl)',
  borderRadius: 'var(--crm-radius-pill)',
  border: 0,
  background: 'transparent',
  color: SET.inkSoft,
  fontFamily: 'inherit',
  fontSize: 'var(--crm-text-md)',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: `inset 0 0 0 1px ${SET.line}`,
}


// ════════════════════════════════════════════════════════════════════════
//  HERO sombre — titre + sous-titre de la page Sécurité
// ════════════════════════════════════════════════════════════════════════
function HeroSecurity() {
  const { t } = useTranslation('settings')
  // En sombre le héro prend la couleur des cards ; le bloc immersif clair reste noir.
  const heroBg = isDark() ? crmStep('s2', '#16171F') : '#0B0C0E'
  return (
    <div
      style={{
        background: heroBg,
        borderRadius: 'var(--crm-radius-3xl)',
        padding: '30px 34px 28px',
        color: '#fff',
        boxShadow: isDark() ? SET.shadow : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ minWidth: 260 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -0.8 }}>{t('security.hero.title')}</h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 'var(--crm-text-lg)',
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: 440,
          }}
        >
          {t('security.hero.subtitleLine1')}
          <br />
          {t('security.hero.subtitleLine2')}
        </p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  CARTE Sessions — depuis useUserDevices (révocation = delete row)
// ════════════════════════════════════════════════════════════════════════
function deviceIcon(d: UserDevice): 'app' | 'keyboard' {
  // app = mobile/tablette ; keyboard = desktop/laptop (line icons dispo).
  const ua = (d.user_agent ?? '').toLowerCase()
  const os = (d.os ?? '').toLowerCase()
  if (/iphone|android|ipad|mobile|ios|tablet/.test(ua) || /ios|android/.test(os)) return 'app'
  return 'keyboard'
}

// `t` injecté depuis SessionsCard (fonction pure, hors composant).
type TFunc = ReturnType<typeof useTranslation>['t']

function deviceLabel(d: UserDevice, t: TFunc): string {
  const b = d.browser?.trim()
  const o = d.os?.trim()
  if (b && o) return `${b} · ${o}`
  if (b) return b
  if (o) return o
  if (d.user_agent) return d.user_agent.slice(0, 48)
  return t('security.sessions.unknownDevice')
}

function relativeTime(iso: string, t: TFunc): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('security.sessions.justNow')
  if (min < 60) return t('security.sessions.minutesAgo', { count: min })
  const h = Math.floor(min / 60)
  if (h < 24) return t('security.sessions.hoursAgo', { count: h })
  const dDays = Math.floor(h / 24)
  if (dDays < 7) return t('security.sessions.daysAgo', { count: dDays })
  try {
    return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'
  }
}

function SessionsCard() {
  const { t } = useTranslation('settings')
  const { devices, isLoading, revoke, currentId, error } = useUserDevices()
  const [closing, setClosing] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    setClosing(id)
    setTimeout(() => {
      void revoke(id)
      setClosing(null)
    }, 280)
  }

  const others = devices.filter(d => d.id !== currentId).length
  const subtitle = isLoading
    ? t('security.sessions.loadingDevices')
    : others > 0
      ? t('security.sessions.activeCount', { count: devices.length })
      : t('security.sessions.thisDeviceOnly')

  return (
    <div style={{ background: SET.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: SET.shadow }}>
      <div style={{ padding: '26px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-3xl)', marginBottom: 20 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--crm-radius-lg)',
              flexShrink: 0,
              background: SET.cardSubtle,
              color: SET.ink,
              display: 'grid',
              placeItems: 'center',
              boxShadow: `inset 0 0 0 1px ${SET.line}`,
            }}
          >
            <SetIcon name="keyboard" size={17} stroke={SET.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--crm-text-2xl)', fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
              {t('security.sessions.title')}
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', color: SET.muted, fontWeight: 500, lineHeight: 1.5 }}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 28px 22px' }}>
        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[0, 1].map(i => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-2xl)',
                  padding: 'var(--crm-space-2xl) 0',
                  borderTop: i > 0 ? `1px solid ${SET.line}` : 'none',
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-md)', background: SET.cardSubtle, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '40%', height: 12, borderRadius: 'var(--crm-radius-xs)', background: SET.cardSubtle }} />
                  <div style={{ width: '60%', height: 10, borderRadius: 'var(--crm-radius-xs)', background: SET.cardSubtle, marginTop: 7 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty / error */}
        {!isLoading && devices.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-lg)',
              padding: 'var(--crm-space-2xl) 0 var(--crm-space-xs)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--crm-radius-sm)',
                flexShrink: 0,
                background: `${SET.muted}18`,
                color: SET.muted,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="info" size={15} stroke={SET.muted} sw={2} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 600 }}>
              {error ? t('security.sessions.loadError') : t('security.sessions.empty')}
            </div>
          </div>
        )}

        {/* Liste */}
        {!isLoading &&
          devices.map((d, i) => {
            const current = d.id === currentId
            const loc = [d.city, d.country].filter(Boolean).join(', ')
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-2xl)',
                  padding: 'var(--crm-space-2xl) 0',
                  borderTop: i > 0 ? `1px solid ${SET.line}` : 'none',
                  opacity: closing === d.id ? 0 : 1,
                  transform: closing === d.id ? 'translateX(12px)' : 'none',
                  transition: 'opacity .26s ease, transform .26s ease',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--crm-radius-md)',
                    flexShrink: 0,
                    background: current ? SET.black : SET.cardSubtle,
                    color: current ? SET.blackInk : SET.ink,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: current ? 'none' : `inset 0 0 0 1px ${SET.line}`,
                  }}
                >
                  <SetIcon name={deviceIcon(d)} size={17} stroke={current ? SET.blackInk : SET.ink} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                    <span
                      style={{
                        fontSize: 'var(--crm-text-lg)',
                        fontWeight: 700,
                        color: SET.ink,
                        letterSpacing: -0.1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {deviceLabel(d, t)}
                    </span>
                    {current && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 20,
                          padding: '0 var(--crm-space-md)',
                          borderRadius: 'var(--crm-radius-pill)',
                          background: `${SET.ok}18`,
                          color: SET.ok,
                          fontSize: 'var(--crm-text-xs)',
                          fontWeight: 800,
                          letterSpacing: 0.3,
                          flexShrink: 0,
                        }}
                      >
                        {t('security.sessions.thisDevice')}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--crm-text-sm)',
                      color: SET.muted,
                      fontWeight: 500,
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {loc || t('security.sessions.unknownLocation')}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-sm)',
                    color: SET.muted,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                    marginRight: current ? 0 : 4,
                  }}
                >
                  {relativeTime(d.last_seen_at, t)}
                </div>
                {!current && (
                  <button
                    onClick={() => handleRevoke(d.id)}
                    style={{
                      height: 36,
                      padding: '0 var(--crm-space-2xl)',
                      borderRadius: 'var(--crm-radius-pill)',
                      border: 0,
                      background: 'transparent',
                      color: SET.inkSoft,
                      fontFamily: 'inherit',
                      fontSize: 'var(--crm-text-md)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: `inset 0 0 0 1px ${SET.line}`,
                    }}
                  >
                    {t('security.sessions.disconnect')}
                  </button>
                )}
              </div>
            )
          })}

        {/* Toutes les autres sessions déconnectées */}
        {!isLoading && devices.length > 0 && others === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--crm-space-lg)',
              padding: 'var(--crm-space-2xl) 0 var(--crm-space-xs)',
              borderTop: `1px solid ${SET.line}`,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 'var(--crm-radius-sm)',
                flexShrink: 0,
                background: `${SET.ok}15`,
                color: SET.ok,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="check" size={15} stroke={SET.ok} sw={2.2} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-md)', color: SET.muted, fontWeight: 600 }}>
              {t('security.sessions.allOthersDisconnected')}
            </div>
          </div>
        )}

        {/* Note : limite révocation JWT (suivi passe ultérieure) */}
        {!isLoading && others > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-lg)',
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--crm-space-lg)',
            }}
          >
            <SetIcon name="info" size={14} stroke={SET.muted} sw={2} />
            <div style={{ fontSize: 'var(--crm-text-sm)', color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
              {t('security.sessions.revokeNote')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  SECTION — bento (colonne, gap 14, maxWidth 1040)
// ════════════════════════════════════════════════════════════════════════
export function SecuritySection() {
  return (
    <div
      style={{
        maxWidth: 1040,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--crm-space-2xl)',
        paddingBottom: 'var(--crm-space-7xl)',
        animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <HeroSecurity />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 'var(--crm-space-2xl)',
          alignItems: 'stretch',
        }}
      >
        <PwdVaultLight />
        <SSOConnectionsCard />
      </div>

      <SessionsCard />
    </div>
  )
}
