// Écran d'enrôlement 2FA obligatoire pour la section super-admin.
// Rendu par SuperAdminGuard quand le compte est allowlisté mais sans facteur
// TOTP vérifié. Réutilise useMfaTotp (enroll → QR/secret → verify) ; après
// succès, onEnrolled() re-évalue le gate. Le step-up AAL2 de la session est
// ensuite géré par ProtectedRoute (useMfaGate) au prochain login.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { useMfaTotp } from '@/hooks/useMfaTotp'

interface Props {
  onEnrolled: () => void
}

export default function AdminMfaRequired({ onEnrolled }: Props) {
  const { t } = useTranslation('admin')
  const mfa = useMfaTotp()
  const [step, setStep] = useState<'intro' | 'scan'>('intro')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const startEnroll = async () => {
    const ok = await mfa.enroll()
    if (ok) setStep('scan')
  }

  const submitCode = async () => {
    if (code.trim().length !== 6 || submitting) return
    setSubmitting(true)
    const ok = await mfa.verify(code.trim())
    setSubmitting(false)
    if (ok) onEnrolled()
  }

  return (
    <div className="flex justify-center px-4 pt-16">
      <div className="w-full max-w-md rounded-xl border border-theme-border bg-theme-card p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-admin-accent" aria-hidden />
          <h1 className="text-lg font-semibold text-theme-primary">{t('mfa.title')}</h1>
        </div>
        <p className="mt-2 text-sm text-theme-secondary">{t('mfa.subtitle')}</p>

        {mfa.error && (
          <p className="mt-3 text-sm text-red-500" role="alert">
            {mfa.error}
          </p>
        )}

        {step === 'intro' && (
          <button
            type="button"
            onClick={() => void startEnroll()}
            disabled={mfa.isLoading}
            className="mt-5 w-full rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-theme-hover disabled:opacity-50"
          >
            {t('mfa.enable')}
          </button>
        )}

        {step === 'scan' && (
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-theme-primary">{t('mfa.scanTitle')}</p>
              <p className="mt-1 text-xs text-theme-muted">{t('mfa.scanHint')}</p>
            </div>
            {/* Fond blanc fonctionnel (scannabilité du QR) — même pattern inline que la carte 2FA de SecuritySection. */}
            <div className="flex justify-center rounded-lg border border-theme-border p-3" style={{ background: '#fff' }}>
              {mfa.qr ? (
                <img src={mfa.qr} alt={t('mfa.qrAlt')} width={148} height={148} />
              ) : (
                <span className="text-xs text-theme-muted">{t('mfa.qrUnavailable')}</span>
              )}
            </div>
            <div>
              <p className="text-xs text-theme-muted">{t('mfa.secretLabel')}</p>
              <code className="mt-1 block break-all rounded-lg border border-theme-border bg-theme-section px-3 py-2 text-xs text-theme-secondary">
                {mfa.secret ?? '—'}
              </code>
            </div>
            <div>
              <label htmlFor="admin-mfa-code" className="text-xs text-theme-muted">
                {t('mfa.codeLabel')}
              </label>
              <input
                id="admin-mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCode()
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="mt-1 w-full rounded-lg border border-theme-border bg-theme-section px-3 py-2 text-center text-base tracking-[0.4em] text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-admin-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitCode()}
              disabled={code.trim().length !== 6 || submitting}
              className="w-full rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-theme-hover disabled:opacity-50"
            >
              {submitting ? t('mfa.verifying') : t('mfa.verify')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
