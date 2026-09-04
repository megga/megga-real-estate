/**
 * Orchestrateur de l'écran Messagerie : chrome CRM (`CrmTopNav` + `CrmIconRail`,
 * copie du squelette de `CalendarApp`) puis le bento `296px | 1fr` de la maquette
 * (README §« Écrans »).
 *
 * Les trois zones (rail, liste, lecture) et les sept modales arrivent aux tâches
 * 2.4-2.11 ; cette version monte le cadre et l'état, avec un état vide honnête —
 * elle ne prétend pas afficher des messages qu'elle ne sait pas encore lire.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CrmTopNav, type CrmScreenId } from '@/components/crm/CrmShell'
import { CrmIconRail } from '@/components/crm/LiquidGlassRail'
import { crmPalette } from '@/components/crm/tokens'
import EtatVide from '@/components/crm/EtatVide'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { mailReducer, initialMailState } from './mailState'
import { mailSurfaces } from './mailTokens'

interface Props { dark: boolean; setDark: (v: boolean) => void }

export function MessagerieApp({ dark, setDark }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ms = useMemo(() => mailSurfaces(sp, dark), [sp, dark])
  const accounts = useMailAccounts()
  const [state, dispatch] = useReducer(mailReducer, null, () => initialMailState(null))

  // Première boîte visible = boîte courante ; `?account=` (retour de pop-up sans opener) prime.
  useEffect(() => {
    if (state.accountId || accounts.list.length === 0) return
    const wanted = params.get('account')
    const first = accounts.list.find((a) => a.id === wanted) ?? accounts.list[0]
    dispatch({ type: 'select-account', accountId: first.id })
  }, [accounts.list, params, state.accountId])
  // `?add=1` (depuis Réglages) ouvre l'assistant.
  useEffect(() => {
    if (params.get('add') === '1') { dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }); params.delete('add'); setParams(params, { replace: true }) }
  }, [params, setParams])

  const onNavigate = useCallback((id: CrmScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
    }
  }, [navigate])

  return (
    <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font)', color: sp.ink }}>
      <CrmTopNav active="messagerie" sp={sp} dark={dark} onNavigate={onNavigate} helpKey="messagerie" />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmIconRail active="messagerie" sp={sp} dark={dark} setDark={setDark} onNavigate={onNavigate} />
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div
            data-mail-bento
            style={{
              position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
              border: `1px solid ${ms.bord2}`, boxShadow: ms.shadow, background: ms.side,
              display: 'grid', gridTemplateColumns: '296px 1fr', gridTemplateRows: '1fr', minHeight: 0,
            }}
          >
            {/* Rail (T2.4) */}
            <aside style={{ padding: 'var(--crm-space-7xl) var(--crm-space-6xl)', borderRight: `1px solid ${ms.bord2}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0 }} />
            {/* Liste / lecture (T2.5, T2.6) */}
            <section style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              {accounts.isLoading ? null : accounts.list.length === 0 ? (
                <div style={{ margin: 'auto' }}>
                  <EtatVide dark={dark} registre="aFaire" titre={t('mail.empty.noAccount.title')} corps={t('mail.empty.noAccount.body')}
                    action={{ libelle: t('mail.add.cta'), onClick: () => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } }) }} />
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
