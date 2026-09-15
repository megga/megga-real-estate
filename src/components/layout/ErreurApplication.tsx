/**
 * L'écran qui remplace l'application quand une page ne peut plus se rendre — le repli
 * d'`ErrorBoundary`. Refait le 15.09.2026 (Julien : « refaire et améliorer le design »).
 *
 * ⛔ PLEIN CADRE, HORS DE LA COQUILLE, et c'est voulu : l'erreur peut venir de la coquille
 * elle-même (barre latérale, bande d'onglets, dock), et un écran d'erreur qui la monterait
 * retomberait dans la même erreur. D'où des dépendances minimales : la palette se calcule
 * (`crmPalette`), le thème se suit par `useCrmDark` — qui n'exige aucun fournisseur —, les
 * textes passent par `i18n.t` et non par un hook qui pourrait suspendre : aucun routeur,
 * aucune requête, aucune session requis.
 *
 * La composition est celle de la page introuvable publique (`NotFoundPage`) : le logo situe
 * la marque, un titre, une phrase, les actions. L'action PRIMAIRE porte l'accent (CLAUDE.md
 * §3) : recharger est la sortie qui marche le plus souvent — un déploiement qui bascule, un
 * état passager — ; le tableau de bord reste le recours. La référence, quand l'erreur est
 * bien partie chez Sentry, permet au support de retrouver l'incident sans capture d'écran.
 */
import type { CSSProperties } from 'react'
import i18n from '@/i18n'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'
import { useCrmDark } from '@/lib/crmDark'
import { HELP_CENTER_URL } from '@/lib/help-articles'

interface Props {
  /** Les huit premiers caractères de l'événement Sentry, ou `null` s'il n'est pas parti. */
  reference: string | null
  onRecharger: () => void
  /** Récupération d'un chunk périmé en cours : l'écran patiente, il n'annonce aucune erreur. */
  miseAJour?: boolean
}

export default function ErreurApplication({ reference, onRecharger, miseAJour = false }: Props) {
  // Suivi, pas figé : une bascule faite dans un autre onglet s'applique ici aussi
  // (tests/unit/poussee-dock.spec.ts). Une lecture du stockage refusée retombe sur le clair.
  const dark = useCrmDark()
  const sp = crmPalette(dark)
  const t = (cle: string, o?: Record<string, string>) => i18n.t(`errorBoundary.${cle}`, o)

  const bouton = (primaire: boolean): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)',
    minHeight: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)',
    border: `1px solid ${primaire ? sp.accent : sp.cardBorder}`,
    background: primaire ? sp.accent : 'transparent', color: primaire ? sp.accentInk : sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: primaire ? 600 : 500,
    textDecoration: 'none', cursor: 'pointer', transition: 'opacity 120ms ease, border-color 120ms ease',
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: sp.pageBg, color: sp.ink, fontFamily: 'var(--crm-font), system-ui, sans-serif',
    }}>
      <header style={{ padding: 'var(--crm-space-5xl) var(--crm-space-6xl) 0' }}>
        {/* Le logo est noir : en sombre il s'inverse, comme dans l'en-tête des pages publiques. */}
        <img src="/megga-logo.svg" alt="MEGGA" style={{ display: 'block', height: 16, width: 'auto', filter: dark ? 'invert(1)' : undefined }} />
      </header>

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--crm-space-5xl) var(--crm-space-4xl) var(--crm-space-7xl)',
      }}>
        {miseAJour ? (
          <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {t('updating')}
          </p>
        ) : (
          <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* `line-height: 0` : un SVG en flux laisse sinon une bande fantôme sous lui. */}
            <span aria-hidden style={{ color: sp.sub, lineHeight: 0 }}><MEIcon name="alert" size={32} strokeWidth={1.5} /></span>
            <h1 style={{
              margin: 'var(--crm-space-2xl) 0 0', fontSize: 'var(--crm-text-3xl)', fontWeight: 600,
              letterSpacing: -0.4, lineHeight: 1.2,
            }}>
              {t('title')}
            </h1>
            <p style={{ margin: 'var(--crm-space-md) 0 0', maxWidth: '40ch', fontSize: 'var(--crm-text-md)', lineHeight: 1.55, color: sp.sub }}>
              {t('body')}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-5xl)' }}>
              <button
                type="button"
                onClick={onRecharger}
                style={bouton(true)}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
              >
                <MEIcon name="refresh" size={15} />
                {t('reload')}
              </button>
              {/* Un lien et non une navigation du routeur : l'erreur a pu naître au-dessus de lui. */}
              <a
                href="/dashboard"
                style={bouton(false)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = sp.ink }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = sp.cardBorder }}
              >
                {t('dashboard')}
              </a>
            </div>

            <p style={{ margin: 'var(--crm-space-5xl) 0 0', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
              {reference && (
                <>
                  {/* Sélectionnable d'un geste : c'est ce que le support demandera. */}
                  <span style={{ userSelect: 'all' }}>{t('reference', { id: reference })}</span>
                  <span aria-hidden> · </span>
                </>
              )}
              <a href={HELP_CENTER_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                {t('help')}
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
