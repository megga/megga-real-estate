// Gate de consentement nLPD — monté par ProtectedRoute autour du contenu
// protégé. Si l'utilisateur n'a pas accepté les versions COURANTES des CGU +
// politique de confidentialité (src/lib/consents.ts), une modal bloquante
// s'affiche à la session ; l'acceptation écrit la preuve immuable via la RPC
// record_consent (migration 20260705170000). Couvre le stock d'utilisateurs
// existants comme les nouveaux, sans toucher au flux de signup.
//
// Fail-open assumé : si la lecture échoue (bypass dev, réseau), on ne bloque
// pas l'app — la preuve manquante sera redemandée à la prochaine session.

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CURRENT_CONSENT_VERSIONS, LEGAL_URLS, type RequiredConsentType } from '@/lib/consents'

const REQUIRED: RequiredConsentType[] = ['terms', 'privacy']

// Dev/CI auth bypass (cf. useAuth.tsx) : la session est mockée, il n'y a pas
// de vraie identité GoTrue. La lecture user_consents part alors en anon et
// réussit à vide → `missing` non vide → la modale bloque *toutes* les pages
// (E2E fonctionnels + baselines visuelles). Le fail-open documenté en tête de
// fichier ne se déclenche pas car la lecture ne *échoue* pas, elle renvoie [].
// On saute donc explicitement la gate sous bypass — inerte en prod
// (import.meta.env.DEV=false, et useAuth throw si bypass sous PROD).
const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [checked, setChecked] = useState<Record<RequiredConsentType, boolean>>({
    terms: false,
    privacy: false,
  })
  const [marketing, setMarketing] = useState(false)

  const { data: rows, isSuccess } = useQuery({
    queryKey: ['user-consents', user?.id],
    enabled: !!user?.id && !DEV_BYPASS_AUTH,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_consents')
        .select('consent_type, version')
      if (error) throw error
      return data
    },
  })

  const missing = useMemo(() => {
    if (!isSuccess || !rows) return []
    return REQUIRED.filter(
      (type) => !rows.some((r) => r.consent_type === type && r.version === CURRENT_CONSENT_VERSIONS[type]),
    )
  }, [isSuccess, rows])

  const accept = useMutation({
    mutationFn: async () => {
      for (const type of missing) {
        const { error } = await supabase.rpc('record_consent', {
          p_type: type,
          p_version: CURRENT_CONSENT_VERSIONS[type],
        })
        if (error) throw error
      }
      if (marketing) {
        // Optionnel — même version que les CGU courantes.
        const { error } = await supabase.rpc('record_consent', {
          p_type: 'marketing',
          p_version: CURRENT_CONSENT_VERSIONS.terms,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-consents', user?.id] })
    },
  })

  const allChecked = missing.every((type) => checked[type])
  const showModal = !DEV_BYPASS_AUTH && !!user && isSuccess && missing.length > 0

  return (
    <>
      {children}
      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="consent-gate-title"
              className="w-full max-w-lg rounded-xl border border-theme-border bg-theme-card p-6"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-accent" aria-hidden />
                <h1 id="consent-gate-title" className="text-lg font-semibold text-theme-primary">
                  {t('consentGate.title')}
                </h1>
              </div>
              <p className="mt-2 text-sm text-theme-secondary">{t('consentGate.subtitle')}</p>

              <div className="mt-5 space-y-3">
                {missing.map((type) => (
                  <label key={type} className="flex items-start gap-3 text-sm text-theme-primary">
                    <input
                      type="checkbox"
                      checked={checked[type]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [type]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 accent-current"
                    />
                    <span>
                      {t(`consentGate.${type}Label`)}{' '}
                      <a
                        href={LEGAL_URLS[type]}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-theme-secondary underline underline-offset-2 hover:text-theme-primary"
                      >
                        {t(`consentGate.${type}Link`)}
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>{' '}
                      <span className="text-theme-muted">
                        ({t('consentGate.version')} {CURRENT_CONSENT_VERSIONS[type]})
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex items-start gap-3 text-sm text-theme-secondary">
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-current"
                  />
                  <span>{t('consentGate.marketingLabel')}</span>
                </label>
              </div>

              {accept.isError && (
                <p className="mt-3 text-sm text-red-500" role="alert">
                  {t('consentGate.error')}
                </p>
              )}

              <button
                type="button"
                disabled={!allChecked || accept.isPending}
                onClick={() => accept.mutate()}
                className="mt-5 w-full rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-secondary hover:bg-theme-hover disabled:opacity-50"
              >
                {accept.isPending ? t('consentGate.saving') : t('consentGate.accept')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
