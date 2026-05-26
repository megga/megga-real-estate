// MEGGA CRM Sugar v2 — Settings Security section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step4.jsx` (SettingsSecuritySection + helpers).
// SSO add-on (step4-sso.jsx) reste pour un PR séparé — placeholder ici.

import { Fragment, useState, type ReactNode } from 'react'
import {
  ConfirmModal,
  Modal,
  SectionHeader,
  SetBlackBtn,
  SetCard,
  SetGhostBtn,
  SetIcon,
  StickySaveBar,
  Toast,
} from './atoms'
import { SET_PALETTE } from './data'
import { SSOConnectionsCard } from './SSOConnectionsCard'
import { MFAEnrollModal, MFABackupCodesModal } from '@/components/auth/MfaModals'

const SET = SET_PALETTE

interface SecurityData {
  sessionTimeout: number
  loginAlerts: boolean
  lastPwdChange: string
}

const DEFAULT_SECURITY: SecurityData = {
  sessionTimeout: 60,
  loginAlerts: true,
  lastPwdChange: 'il y a 2 mois',
}

// AuditEvent / AUDIT_LOG / AuditRow removed — the "Journal d'activité"
// card was redundant with /dashboard/audit. The full event log lives
// there and is wired to real `activity_events` data.

const SESSIONS_COUNT = 4

function PasswordStrengthDemo() {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: SET.cardSubtle,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${SET.ok}18`,
          color: SET.ok,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SetIcon name="lock" size={16} stroke={SET.ok} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.1,
          }}
        >
          Mot de passe robuste
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 8,
            alignItems: 'center',
          }}
        >
          {[1, 2, 3, 4, 5].map(i => (
            <span
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 999,
                background: i <= 4 ? SET.ok : `${SET.muted}30`,
              }}
            />
          ))}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SET.ok,
              marginLeft: 8,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Fort
          </span>
        </div>
      </div>
    </div>
  )
}

interface PwdStepperProps {
  steps: string[]
  current: number
}

function PwdStepper({ steps, current }: PwdStepperProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 18,
      }}
    >
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <Fragment key={i}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: done ? SET.ok : active ? SET.ink : `${SET.muted}28`,
                  color: done || active ? '#fff' : SET.muted,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'all .2s',
                }}
              >
                {done ? <SetIcon name="check" size={11} stroke="#fff" sw={3} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: active ? SET.ink : SET.muted,
                  letterSpacing: -0.1,
                }}
              >
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? SET.ok : `${SET.muted}28`,
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

interface PwdFieldProps {
  label: string
  show: boolean
  setShow: (v: boolean) => void
  hint?: string
}

function PwdField({ label, show, setShow, hint }: PwdFieldProps) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: '0 4px 0 16px',
          borderRadius: 14,
          background: SET.cardSubtle,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        }}
      >
        <input
          type={show ? 'text' : 'password'}
          placeholder="••••••••••••"
          defaultValue=""
          style={{
            flex: 1,
            height: '100%',
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 14.5,
            fontWeight: 600,
            color: SET.ink,
            letterSpacing: 0.4,
          }}
        />
        <button
          onClick={() => setShow(!show)}
          style={{
            width: 36,
            height: 36,
            border: 0,
            borderRadius: 10,
            background: 'transparent',
            color: SET.muted,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            marginRight: 4,
          }}
        >
          <SetIcon name={show ? 'eyeOff' : 'eye'} size={15} stroke={SET.muted} />
        </button>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11.5,
            color: SET.muted,
            fontWeight: 500,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
    </label>
  )
}

interface PwdSuccessProps {
  title: string
  desc: string
  onClose: () => void
}

function PwdSuccess({ title, desc, onClose }: PwdSuccessProps) {
  return (
    <>
      <div style={{ textAlign: 'center', padding: '4px 4px 18px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            margin: '0 auto 16px',
            background: `${SET.ok}18`,
            color: SET.ok,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SetIcon name="check" size={32} stroke={SET.ok} sw={2.6} />
        </div>
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: '0 auto',
            maxWidth: 400,
            fontSize: 13.5,
            color: SET.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {desc}
        </p>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 10,
          marginTop: 8,
        }}
      >
        <SetBlackBtn onClick={onClose}>Terminé</SetBlackBtn>
      </div>
    </>
  )
}

type PwdMode = 'change' | 'forgot'

interface PasswordModalProps {
  onClose: () => void
  mode: PwdMode
  setMode: (m: PwdMode) => void
}

function PasswordModal({ onClose, mode, setMode }: PasswordModalProps) {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('julien.morel@megga.ch')
  const [sending, setSending] = useState(false)

  const titles: Record<PwdMode, string[]> = {
    change: ['Modifier le mot de passe', 'Mot de passe mis à jour'],
    forgot: [
      'Mot de passe oublié',
      'Lien envoyé',
      'Définir un nouveau mot de passe',
      'Mot de passe réinitialisé',
    ],
  }
  const stepLabels: Record<PwdMode, string[]> = {
    change: ['Saisir', 'Confirmé'],
    forgot: ['Email', 'Lien envoyé', 'Nouveau mdp', 'Confirmé'],
  }
  const title = titles[mode][step - 1]

  const handleNext = () => {
    setSending(true)
    setTimeout(() => {
      setSending(false)
      setStep(s => s + 1)
    }, 700)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <PwdStepper steps={stepLabels[mode]} current={step - 1} />

      {mode === 'change' && step === 1 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PwdField label="Mot de passe actuel" show={show} setShow={setShow} />
            <PwdField
              label="Nouveau mot de passe"
              show={show}
              setShow={setShow}
              hint="Minimum 12 caractères, dont 1 majuscule, 1 chiffre, 1 caractère spécial."
            />
            <PwdField label="Confirmer le nouveau mot de passe" show={show} setShow={setShow} />
          </div>
          <button
            onClick={() => setMode('forgot')}
            style={{
              marginTop: 14,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: SET.inkSoft,
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            J'ai oublié mon mot de passe actuel
          </button>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 22,
            }}
          >
            <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
            <SetBlackBtn loading={sending} onClick={handleNext}>
              Mettre à jour
            </SetBlackBtn>
          </div>
        </>
      )}

      {mode === 'change' && step === 2 && (
        <PwdSuccess
          title="Mot de passe mis à jour"
          desc="Toutes vos autres sessions actives ont été déconnectées par sécurité. Vous restez connecté sur cet appareil."
          onClose={onClose}
        />
      )}

      {mode === 'forgot' && step === 1 && (
        <>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 13.5,
              color: SET.inkSoft,
              lineHeight: 1.55,
            }}
          >
            Saisissez l'adresse email associée à votre compte MEGGA. Nous vous enverrons un
            lien sécurisé pour définir un nouveau mot de passe (valable 30 minutes).
          </p>
          <label style={{ display: 'block' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Adresse email
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 48,
                padding: '0 16px',
                borderRadius: 14,
                background: SET.cardSubtle,
                boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
              }}
            >
              <SetIcon name="mail" size={15} stroke={SET.muted} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  height: '100%',
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 600,
                  color: SET.ink,
                }}
              />
            </div>
          </label>
          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              background: `${SET.warn}10`,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <SetIcon name="info" size={15} stroke={SET.warn} sw={2} />
            <div
              style={{
                fontSize: 12,
                color: SET.ink,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Pour des raisons de sécurité, le lien sera valable 30 minutes et ne pourra être
              utilisé qu'une seule fois. Si vous ne recevez rien, vérifiez vos spams ou
              contactez votre admin d'agence.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              marginTop: 22,
            }}
          >
            <SetGhostBtn onClick={() => setMode('change')}>← Retour</SetGhostBtn>
            <div style={{ display: 'flex', gap: 10 }}>
              <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
              <SetBlackBtn
                loading={sending}
                onClick={handleNext}
                icon={
                  !sending && <SetIcon name="mail" size={13} stroke="#fff" sw={2.2} />
                }
              >
                Envoyer le lien
              </SetBlackBtn>
            </div>
          </div>
        </>
      )}

      {mode === 'forgot' && step === 2 && (
        <>
          <div style={{ textAlign: 'center', padding: '4px 4px 18px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                margin: '0 auto 16px',
                background: `${SET.ok}18`,
                color: SET.ok,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="mail" size={28} stroke={SET.ok} sw={2} />
            </div>
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 18,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.3,
              }}
            >
              Vérifiez votre boîte mail
            </h3>
            <p
              style={{
                margin: '0 auto',
                maxWidth: 380,
                fontSize: 13.5,
                color: SET.inkSoft,
                lineHeight: 1.55,
              }}
            >
              Un lien sécurisé a été envoyé à{' '}
              <strong style={{ color: SET.ink }}>{email}</strong>. Cliquez dessus pour définir
              votre nouveau mot de passe.
            </p>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <SetIcon name="clock" size={16} stroke={SET.warn} sw={2.2} />
            <div style={{ fontSize: 12, color: SET.ink, fontWeight: 500 }}>
              <strong>Demande #PWD-{Math.floor(Math.random() * 9000) + 1000}</strong> · expire
              dans 30 minutes
            </div>
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 11.5,
              color: SET.muted,
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            Pas reçu ?{' '}
            <button
              onClick={handleNext}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                color: SET.ink,
                fontFamily: 'inherit',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Simuler le clic sur le lien (démo)
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 22,
            }}
          >
            <SetBlackBtn onClick={onClose}>Fermer</SetBlackBtn>
          </div>
        </>
      )}

      {mode === 'forgot' && step === 3 && (
        <>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: `${SET.ok}10`,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginBottom: 18,
            }}
          >
            <SetIcon name="shield" size={15} stroke={SET.ok} sw={2} />
            <div
              style={{
                fontSize: 12,
                color: SET.ink,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Lien vérifié pour <strong>{email}</strong>. Choisissez un nouveau mot de passe
              robuste.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PwdField
              label="Nouveau mot de passe"
              show={show}
              setShow={setShow}
              hint="Minimum 12 caractères, dont 1 majuscule, 1 chiffre, 1 caractère spécial."
            />
            <PwdField label="Confirmer le nouveau mot de passe" show={show} setShow={setShow} />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 22,
            }}
          >
            <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
            <SetBlackBtn loading={sending} onClick={handleNext}>
              Réinitialiser
            </SetBlackBtn>
          </div>
        </>
      )}

      {mode === 'forgot' && step === 4 && (
        <PwdSuccess
          title="Mot de passe réinitialisé"
          desc="Votre mot de passe a été mis à jour avec succès. Toutes vos sessions actives ont été déconnectées par sécurité — reconnectez-vous avec votre nouveau mot de passe."
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

// AuditRow component removed alongside AUDIT_LOG (was rendering the
// "Journal d'activité" card that we trimmed — full log lives at
// /dashboard/audit).

export function SecuritySection() {
  const [data, setData] = useState<SecurityData>(DEFAULT_SECURITY)
  const [saved, setSaved] = useState<SecurityData>(DEFAULT_SECURITY)
  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdMode, setPwdMode] = useState<PwdMode>('change')
  const [revokeAll, setRevokeAll] = useState(false)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaModal, setMfaModal] = useState<'enroll' | 'backup' | null>(null)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaved(data)
      setSaving(false)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    }, 700)
  }

  // Suppress unused warnings — these are part of the section state surface
  void setData
  void setRevokeAll

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Sécurité"
          title="Protégez votre compte et celui de vos clients"
          sub="MEGGA traite des données de transaction sensibles. Gardez un mot de passe robuste et surveillez l'activité de votre compte."
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 20,
            alignItems: 'start',
          }}
        >
          <SetCard
            title="Mot de passe"
            sub={`Dernière modification ${data.lastPwdChange}.`}
            action={
              <SetBlackBtn
                size="sm"
                onClick={() => {
                  setPwdMode('change')
                  setPwdModalOpen(true)
                }}
                icon={<SetIcon name="key" size={13} stroke="#fff" sw={2.2} />}
              >
                Modifier
              </SetBlackBtn>
            }
          >
            <PasswordStrengthDemo />
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${SET.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    flexShrink: 0,
                    background: `${SET.warn}18`,
                    color: SET.warn,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <SetIcon name="help" size={14} stroke={SET.warn} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: SET.ink,
                      letterSpacing: -0.1,
                    }}
                  >
                    Mot de passe oublié&nbsp;?
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: SET.muted,
                      fontWeight: 500,
                      marginTop: 2,
                    }}
                  >
                    Lien sécurisé sur votre email vérifié.
                  </div>
                </div>
              </div>
              <SetGhostBtn
                size="sm"
                onClick={() => {
                  setPwdMode('forgot')
                  setPwdModalOpen(true)
                }}
                icon={<SetIcon name="mail" size={12} stroke={SET.inkSoft} />}
              >
                Reset
              </SetGhostBtn>
            </div>
          </SetCard>

          {/* "Journal d'activité" card removed — Tier 3 trim (Julien call):
              redundant with /dashboard/audit which already shows the full
              nLPD audit log. Helpers (AUDIT_LOG seed + AuditRow) kept in
              the file for now — small dead weight; will be removed when the
              real audit-log API is wired (separate chip). */}
        </div>

        {/* "Authentification à deux facteurs (2FA)" card + modals removed —
            Tier 3 trim. The MFA toggle was UI-only (local state, no
            Supabase backend). Re-add when MFA enrollment is properly
            wired to auth.mfa via Supabase. SSOConnectionsCard stays
            because it has a real OAuth flow. */}
        {false && (
        <SetCard
          title="Authentification à deux facteurs (2FA)"
          sub={
            mfaEnabled
              ? 'Activée · Application Authenticator + 10 codes de secours.'
              : 'Renforcez la sécurité de votre compte avec un code temporaire (TOTP) en plus de votre mot de passe.'
          }
          action={
            mfaEnabled ? (
              <SetGhostBtn
                size="sm"
                onClick={() => setMfaModal('backup')}
                icon={<SetIcon name="key" size={13} stroke={SET.inkSoft} />}
              >
                Régénérer les codes de secours
              </SetGhostBtn>
            ) : (
              <SetBlackBtn
                size="sm"
                onClick={() => setMfaModal('enroll')}
                icon={<SetIcon name="lock" size={13} stroke="#fff" sw={2.2} />}
              >
                Activer 2FA
              </SetBlackBtn>
            )
          }
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 14,
              background: SET.cardSubtle,
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: mfaEnabled ? `${SET.ok}18` : `${SET.muted}1A`,
                color: mfaEnabled ? SET.ok : SET.muted,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SetIcon
                name={mfaEnabled ? 'check' : 'lock'}
                size={16}
                stroke={mfaEnabled ? SET.ok : SET.muted}
                sw={2.2}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: -0.1,
                }}
              >
                {mfaEnabled
                  ? 'Protection 2FA active'
                  : 'Compatible Google Authenticator, Authy, 1Password, etc.'}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: SET.muted,
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                {mfaEnabled
                  ? 'Code 6 chiffres demandé à chaque nouvelle connexion.'
                  : 'TOTP standard (RFC 6238) · prend 30 secondes à activer.'}
              </div>
            </div>
            {mfaEnabled && (
              <SetGhostBtn
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.confirm('Désactiver la 2FA ? Votre compte sera moins protégé.')) {
                    setMfaEnabled(false)
                  }
                }}
              >
                Désactiver
              </SetGhostBtn>
            )}
          </div>
        </SetCard>
        )}

        <SSOConnectionsCard />
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setData(saved)}
      />
      <Toast open={toast} label="Sécurité enregistrée" />

      {pwdModalOpen && (
        <PasswordModal
          mode={pwdMode}
          setMode={setPwdMode}
          onClose={() => setPwdModalOpen(false)}
        />
      )}

      {revokeAll && (
        <ConfirmModal
          title="Déconnecter toutes les autres sessions ?"
          desc={`Vous resterez connecté sur cet appareil. ${SESSIONS_COUNT - 1} autres sessions seront fermées et devront se reconnecter.`}
          danger="Tout déconnecter"
          onCancel={() => setRevokeAll(false)}
          onConfirm={() => setRevokeAll(false)}
        />
      )}

      {mfaModal === 'enroll' && (
        <MFAEnrollModal
          onClose={() => setMfaModal(null)}
          onDone={() => {
            setMfaEnabled(true)
            setMfaModal(null)
          }}
        />
      )}
      {mfaModal === 'backup' && (
        <MFABackupCodesModal onClose={() => setMfaModal(null)} />
      )}
    </>
  )
}

// Suppress unused warning — kept for future revoke-all UI
void ({} as { _unused?: ReactNode })
