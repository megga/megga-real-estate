/**
 * Bannière de consentement cookies (nLPD/RGPD) : essentiels toujours actifs,
 * analytics en opt-in. Montée globalement dans App. Le choix est persisté en
 * localStorage et diffusé au reste de l'app via l'event `cookie-consent-changed`.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const CONSENT_KEY = 'megga-cookie-consent'
const CONSENT_VERSION = '1.0'

interface CookieConsent {
  essential: true
  analytics: boolean
  timestamp: string
  version: string
}

/** Persiste le consentement en localStorage puis notifie l'app via un CustomEvent. */
function emitConsent(consent: CookieConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // localStorage unavailable — swallow
  }
  window.dispatchEvent(new CustomEvent('cookie-consent-changed', { detail: consent }))
}

/** Affiche la bannière tant qu'aucun consentement n'est enregistré ; propose accepter / refuser / préférences fines. */
export default function CookieBanner() {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [analyticsOptIn, setAnalyticsOptIn] = useState(false)
  const acceptButtonRef = useRef<HTMLButtonElement>(null)

  // Check for existing consent on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONSENT_KEY)
      if (!raw) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  // Focus the primary CTA when the banner appears
  useEffect(() => {
    if (visible && acceptButtonRef.current) {
      acceptButtonRef.current.focus()
    }
  }, [visible])

  if (!visible) return null

  const handleAcceptAll = () => {
    emitConsent({
      essential: true,
      analytics: true,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    })
    setVisible(false)
  }

  const handleRejectNonEssential = () => {
    emitConsent({
      essential: true,
      analytics: false,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    })
    setVisible(false)
  }

  const handleSavePreferences = () => {
    emitConsent({
      essential: true,
      analytics: analyticsOptIn,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    })
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('cookieBanner.title')}
      className="fixed inset-x-0 bottom-0 z-[90] pointer-events-none animate-[slideUp_0.3s_ease-out]"
      style={{
        // Inline animation fallback — the keyframe name above is harmless if undefined
      }}
    >
      <div className="max-w-5xl mx-auto m-3 md:m-4 pointer-events-auto">
        <div className="rounded-xl border border-theme-border bg-theme-card p-5 md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-theme-primary mb-1">
                {t('cookieBanner.title')}
              </h2>
              <p className="text-sm text-theme-secondary leading-relaxed">
                {t('cookieBanner.description')}{' '}
                <Link to="/privacy" className="text-theme-primary underline hover:no-underline">
                  {t('cookieBanner.privacyLink')}
                </Link>
              </p>
            </div>

            {showPreferences && (
              <div className="rounded-lg border border-theme-border p-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-theme-primary">
                      {t('cookieBanner.essentials')}
                    </div>
                    <div className="text-xs text-theme-secondary mt-0.5">
                      {t('cookieBanner.essentialsDescription')}
                    </div>
                  </div>
                  <div className="text-xs text-theme-muted">✓</div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-theme-primary">
                      {t('cookieBanner.analytics')}
                    </div>
                    <div className="text-xs text-theme-secondary mt-0.5">
                      {t('cookieBanner.analyticsDescription')}
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={analyticsOptIn}
                      onChange={(e) => setAnalyticsOptIn(e.target.checked)}
                      className="sr-only peer"
                      aria-label={t('cookieBanner.analytics')}
                    />
                    <div className="w-10 h-5 bg-theme-hover peer-checked:bg-theme-primary rounded-full transition-colors relative">
                      <div
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-theme-card transition-transform ${
                          analyticsOptIn ? 'translate-x-5' : ''
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              {!showPreferences && (
                <button
                  type="button"
                  onClick={() => setShowPreferences(true)}
                  className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                >
                  {t('cookieBanner.managePreferences')}
                </button>
              )}
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
              >
                {t('cookieBanner.rejectNonEssential')}
              </button>
              {showPreferences ? (
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
                >
                  {t('cookieBanner.savePreferences')}
                </button>
              ) : (
                <button
                  ref={acceptButtonRef}
                  type="button"
                  onClick={handleAcceptAll}
                  className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors"
                >
                  {t('cookieBanner.acceptAll')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
