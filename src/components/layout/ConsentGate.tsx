/**
 * Écran de consentement nLPD — monté par ProtectedRoute autour du contenu
 * protégé. Quand un document attend une acceptation, il REMPLACE ce contenu au
 * lieu de se poser dessus : c'était une modale lâchée par-dessus le wizard
 * d'identité à moitié visible, ce qui se lisait comme une interruption plutôt
 * que comme une étape.
 *
 * Il ne se déclenche plus au premier passage du cas courant : la case cochée
 * sur megga.ch/signup est désormais enregistrée à la création du compte
 * (trigger `handle_new_user`, migration 20260731210000). Restent deux cas, tous
 * deux légitimes :
 *   * inscription par Google/Microsoft — le parcours quitte megga.ch avant que
 *     le compte existe et `signInWithOAuth` ne transporte pas de métadonnées,
 *     la preuve ne peut donc pas être écrite à la création ;
 *   * bump de version d'un document sur un compte existant.
 *
 * Ce qui manque est calculé EN BASE (`pending_consents()`), versions comprises :
 * le bundle n'en tient plus la liste. L'acceptation écrit la preuve immuable
 * via `record_consent`.
 *
 * Fail-open assumé : si la lecture échoue (bypass dev, réseau), on ne bloque
 * pas l'app — la preuve manquante sera redemandée à la prochaine session.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { crmPalette } from '@/components/crm/tokens'
import { LEGAL_URLS, type RequiredConsentType } from '@/lib/consents'

interface PendingConsent {
  consent_type: RequiredConsentType
  version: string
}

// Dev/CI auth bypass (cf. useAuth.tsx) : la session est mockée, il n'y a pas
// de vraie identité GoTrue. La lecture part alors en anon et réussit à vide →
// l'écran bloquerait *toutes* les pages (E2E fonctionnels + baselines
// visuelles). Le fail-open documenté en tête de fichier ne se déclenche pas car
// la lecture n'*échoue* pas, elle renvoie []. On saute donc explicitement la
// gate sous bypass — inerte en prod (import.meta.env.DEV=false, et useAuth
// throw si bypass sous PROD).
const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'

/**
 * Thème lu sur le document, pas par `useTheme()` : le ThemeProvider vit dans
 * AgentLayout, donc DANS le contenu que cet écran remplace — le hook
 * lèverait. `data-theme` est posé par le script d'amorçage d'index.html, avant
 * même React ; sans attribut, on suit la préférence système comme lui.
 */
function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'dark') return true
  if (attr === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export default function ConsentGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const dark = isDarkTheme()
  const sp = useMemo(() => crmPalette(dark), [dark])

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [marketing, setMarketing] = useState(false)

  const { data: pending, isSuccess } = useQuery({
    queryKey: ['pending-consents', user?.id],
    enabled: !!user?.id && !DEV_BYPASS_AUTH,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pending_consents')
      if (error) throw error
      return (data ?? []) as PendingConsent[]
    },
  })

  const accept = useMutation({
    mutationFn: async () => {
      for (const row of pending ?? []) {
        const { error } = await supabase.rpc('record_consent', {
          p_type: row.consent_type,
          p_version: row.version,
        })
        if (error) throw error
      }
      if (marketing) {
        // Opt-in sans document propre : `p_version` omis, le serveur l'aligne
        // sur la version courante des CGU (migration 20260731210000).
        const { error } = await supabase.rpc('record_consent', { p_type: 'marketing' })
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pending-consents', user?.id] })
    },
  })

  const showGate = !DEV_BYPASS_AUTH && !!user && isSuccess && (pending?.length ?? 0) > 0
  if (!showGate) return <>{children}</>

  const rows = pending ?? []
  const allChecked = rows.every((row) => checked[row.consent_type])
  const canSubmit = allChecked && !accept.isPending

  return (
    <main
      style={{
        minHeight: '100vh',
        background: sp.pageBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <section
        aria-labelledby="consent-gate-title"
        style={{
          width: '100%',
          maxWidth: 460,
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 24,
          padding: '32px 28px',
          boxShadow: sp.shadow,
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: sp.accent,
            color: sp.accentInk,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldCheck size={22} strokeWidth={2} />
        </div>

        <h1
          id="consent-gate-title"
          style={{ margin: '16px 0 0', fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.4, color: sp.ink }}
        >
          {t('consentGate.title')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 'var(--crm-text-lg)', lineHeight: 1.5, color: sp.sub }}>
          {t('consentGate.subtitle')}
        </p>

        {/* Les cases s'alignent à gauche : un libellé cochable centré se lit mal
            et laisse la case flotter loin de son texte. */}
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
          {rows.map((row) => (
            <label
              key={row.consent_type}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.ink, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={!!checked[row.consent_type]}
                onChange={(e) => setChecked((prev) => ({ ...prev, [row.consent_type]: e.target.checked }))}
                style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: sp.accent, cursor: 'pointer' }}
              />
              <span>
                {t(`consentGate.${row.consent_type}Label`)}{' '}
                <a
                  href={LEGAL_URLS[row.consent_type]}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: sp.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}
                >
                  {t(`consentGate.${row.consent_type}Link`)}
                  <ExternalLink size={12} style={{ display: 'inline', marginLeft: 4, verticalAlign: -1 }} aria-hidden />
                </a>{' '}
                <span style={{ color: sp.soft }}>
                  ({t('consentGate.version')} {row.version})
                </span>
              </span>
            </label>
          ))}

          <label
            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: sp.sub, cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: sp.accent, cursor: 'pointer' }}
            />
            <span>{t('consentGate.marketingLabel')}</span>
          </label>
        </div>

        {accept.isError && (
          <p role="alert" style={{ margin: '16px 0 0', fontSize: 'var(--crm-text-md)', color: '#EF4444' }}>
            {t('consentGate.error')}
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => accept.mutate()}
          style={{
            marginTop: 26,
            width: '100%',
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: sp.accent,
            color: sp.accentInk,
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: canSubmit ? 1 : 0.45,
          }}
        >
          {accept.isPending ? t('consentGate.saving') : t('consentGate.accept')}
        </button>
      </section>
    </main>
  )
}
