// MEGGA CRM Sugar v2 — Settings Security section (wired).
//
// Actions câblées :
//   - Modifier mon mot de passe → supabase.auth.updateUser({ password })
//   - Mot de passe oublié      → supabase.auth.resetPasswordForEmail()
//   - SSOConnectionsCard       → flow OAuth existant
//
// Retirés (chip dédié)
//   - MFA TOTP enroll/unenroll : besoin rewrite MfaModals pour appeler
//     supabase.auth.mfa.enroll/challenge/verify + Edge Function pour
//     backup codes (Supabase ne les supporte pas nativement).
//   - Sessions actives + revoke : besoin RPC dédiée pour lister
//     auth.sessions (ou Edge Function admin).
//   - Session timeout / Login alerts : besoin colonnes profiles.security_*
//     + listener côté auth refresh.
//   - StickySaveBar : plus rien à "enregistrer" au niveau section.

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import {
  Modal,
  SectionHeader,
  SetBlackBtn,
  SetCard,
  SetGhostBtn,
  SetIcon,
} from './atoms'
import { SET_PALETTE } from './data'
import { SSOConnectionsCard } from './SSOConnectionsCard'

const SET = SET_PALETTE

// ─── Password strength heuristic (12+ char / upper / digit / special) ────

interface Strength {
  score: 0 | 1 | 2 | 3 | 4 | 5
  label: string
  color: string
}

function scorePassword(pwd: string): Strength {
  if (!pwd) return { score: 0, label: 'Vide', color: SET.muted }
  let score = 0
  if (pwd.length >= 12) score++
  if (pwd.length >= 16) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  const labels = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Robuste', 'Excellent']
  const colors = [SET.bad, SET.bad, SET.warn, SET.warn, SET.ok, SET.ok]
  return {
    score: score as Strength['score'],
    label: labels[score],
    color: colors[score],
  }
}

function PwdField({
  label,
  value,
  onChange,
  show,
  setShow,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  setShow: (s: boolean) => void
  hint?: string
}) {
  return (
    <div>
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
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
          style={{
            width: '100%',
            height: 48,
            padding: '0 44px 0 14px',
            borderRadius: 14,
            border: 0,
            background: SET.cardSubtle,
            fontFamily: 'inherit',
            fontSize: 14,
            color: SET.ink,
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'Masquer' : 'Afficher'}
          style={{
            position: 'absolute',
            right: 10,
            top: 10,
            width: 28,
            height: 28,
            border: 0,
            background: 'transparent',
            color: SET.muted,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SetIcon name={show ? 'eyeOff' : 'eye'} size={14} stroke={SET.muted} />
        </button>
      </div>
      {hint && (
        <div style={{ fontSize: 11.5, color: SET.muted, marginTop: 6, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

// ─── PasswordChangeModal (wired) ─────────────────────────────────────────

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [show, setShow] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()
  const strength = scorePassword(newPwd)

  const canSubmit =
    !sending &&
    newPwd.length >= 12 &&
    newPwd === confirmPwd &&
    strength.score >= 3

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSending(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec : ${msg}`)
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <Modal title="Mot de passe mis à jour" onClose={onClose}>
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              background: `${SET.ok}18`,
              margin: '0 auto 14px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SetIcon name="check" size={28} stroke={SET.ok} sw={2.4} />
          </div>
          <div style={{ fontSize: 14, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
            Votre nouveau mot de passe est actif. Restez connecté sur cet appareil — les autres
            sessions resteront ouvertes (gestion sessions à venir).
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <SetBlackBtn onClick={onClose}>Fermer</SetBlackBtn>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Modifier le mot de passe" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PwdField
          label="Nouveau mot de passe"
          value={newPwd}
          onChange={setNewPwd}
          show={show}
          setShow={setShow}
          hint="Minimum 12 caractères, dont 1 majuscule, 1 chiffre, 1 caractère spécial."
        />
        {newPwd && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              background: SET.cardSubtle,
            }}
          >
            <div style={{ flex: 1, display: 'flex', gap: 4 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 999,
                    background: i < strength.score ? strength.color : `${SET.muted}30`,
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: strength.color }}>
              {strength.label}
            </span>
          </div>
        )}
        <PwdField
          label="Confirmer le nouveau mot de passe"
          value={confirmPwd}
          onChange={setConfirmPwd}
          show={show}
          setShow={setShow}
        />
        {confirmPwd && newPwd !== confirmPwd && (
          <div style={{ fontSize: 12, color: SET.bad, fontWeight: 600 }}>
            Les mots de passe ne correspondent pas.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
        <SetBlackBtn loading={sending} onClick={handleSubmit} disabled={!canSubmit}>
          Mettre à jour
        </SetBlackBtn>
      </div>
    </Modal>
  )
}

// ─── PasswordResetModal (wired) ──────────────────────────────────────────

function PasswordResetModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const toast = useToast()

  const handleSend = async () => {
    setSending(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec : ${msg}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={done ? 'Lien envoyé' : 'Mot de passe oublié'} onClose={onClose}>
      {done ? (
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              background: `${SET.ok}18`,
              margin: '0 auto 14px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <SetIcon name="mail" size={28} stroke={SET.ok} sw={2.2} />
          </div>
          <div style={{ fontSize: 14, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
            Vérifiez la boîte de <strong style={{ color: SET.ink }}>{email}</strong>. Le lien
            expire dans 1 heure.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
            <SetBlackBtn onClick={onClose}>Fermer</SetBlackBtn>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 18px', fontSize: 13.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
            Nous enverrons un lien sécurisé sur <strong style={{ color: SET.ink }}>{email}</strong>{' '}
            pour définir un nouveau mot de passe.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
            <SetBlackBtn loading={sending} onClick={handleSend}>
              Envoyer le lien
            </SetBlackBtn>
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── SecuritySection ─────────────────────────────────────────────────────

export function SecuritySection() {
  const { user } = useAuth()
  const [changeOpen, setChangeOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [lastSignIn, setLastSignIn] = useState<string | null>(null)

  // Affiche la dernière connexion via auth.user metadata (read-only)
  useEffect(() => {
    if (user?.last_sign_in_at) {
      try {
        const date = new Date(user.last_sign_in_at)
        setLastSignIn(date.toLocaleDateString('fr-CH', {
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }))
      } catch { /* ignore */ }
    }
  }, [user?.last_sign_in_at])

  const userEmail = user?.email ?? ''

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Sécurité"
          title="Protégez votre compte et celui de vos clients"
          sub="Gérez votre mot de passe et vos connexions Single Sign-On. La 2FA TOTP et la gestion fine des sessions arrivent prochainement."
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
            sub={lastSignIn ? `Dernière connexion : ${lastSignIn}.` : 'Compte chargé.'}
            action={
              <SetBlackBtn
                size="sm"
                onClick={() => setChangeOpen(true)}
                icon={<SetIcon name="key" size={13} stroke="#fff" sw={2.2} />}
              >
                Modifier
              </SetBlackBtn>
            }
          >
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                background: SET.cardSubtle,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
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
                <div style={{ fontSize: 13.5, fontWeight: 700, color: SET.ink }}>
                  Authentification active
                </div>
                <div style={{ fontSize: 11.5, color: SET.muted, marginTop: 2 }}>
                  {userEmail}
                </div>
              </div>
            </div>

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
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
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: SET.ink }}>
                    Mot de passe oublié&nbsp;?
                  </div>
                  <div style={{ fontSize: 11, color: SET.muted, marginTop: 2 }}>
                    Lien sécurisé sur votre email vérifié.
                  </div>
                </div>
              </div>
              <SetGhostBtn
                size="sm"
                onClick={() => setResetOpen(true)}
                icon={<SetIcon name="mail" size={12} stroke={SET.inkSoft} />}
                disabled={!userEmail}
              >
                Reset
              </SetGhostBtn>
            </div>
          </SetCard>

          <SSOConnectionsCard />
        </div>
      </div>

      {changeOpen && (
        <PasswordChangeModal onClose={() => setChangeOpen(false)} />
      )}
      {resetOpen && userEmail && (
        <PasswordResetModal email={userEmail} onClose={() => setResetOpen(false)} />
      )}
    </>
  )
}
