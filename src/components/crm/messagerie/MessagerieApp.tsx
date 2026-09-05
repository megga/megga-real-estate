/**
 * Orchestrateur de l'écran Messagerie : chrome CRM (`CrmTopNav` + `CrmIconRail`,
 * copie du squelette de `CalendarApp`) puis le bento `296px | 1fr` de la maquette
 * (README §« Écrans »).
 *
 * Le rail (T2.4) est branché ; la liste, la lecture et les sept modales arrivent
 * aux tâches 2.5-2.11. L'état vide reste honnête — l'écran ne prétend pas
 * afficher des messages qu'il ne sait pas encore lire.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CrmTopNav, type CrmScreenId } from '@/components/crm/CrmShell'
import { CrmIconRail } from '@/components/crm/LiquidGlassRail'
import { crmPalette } from '@/components/crm/tokens'
import EtatVide from '@/components/crm/EtatVide'
import { useAuth } from '@/hooks/useAuth'
import { useMailAccounts } from '@/hooks/useMailAccounts'
import { useMailLabels } from '@/hooks/useMailLabels'
import { useMailFolderCounts } from '@/hooks/useMailThreads'
import { useMailRealtime } from '@/hooks/useMailRealtime'
import { MailRail } from './MailRail'
import { MailLabelMenu } from './MailLabelMenu'
import { mailReducer, initialMailState } from './mailState'
import { mailSurfaces } from './mailTokens'

interface Props { dark: boolean; setDark: (v: boolean) => void }

export function MessagerieApp({ dark, setDark }: Props) {
  const { t } = useTranslation('messages')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { profile } = useAuth()
  const sp = useMemo(() => crmPalette(dark), [dark])
  const ms = useMemo(() => mailSurfaces(sp, dark), [sp, dark])
  const accounts = useMailAccounts()
  const labels = useMailLabels()
  const [state, dispatch] = useReducer(mailReducer, null, () => initialMailState(null))
  const counts = useMailFolderCounts(state.accountId)
  // Un fil qui change chez le fournisseur (ou sous la main d'un collègue, sur une
  // boîte partagée) doit remonter sans rechargement : c'est ce qui fait bouger la
  // pastille de non-lus du rail.
  useMailRealtime(profile?.agency_id ?? null)

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

  const editLabel = labels.labels.find((l) => l.id === state.editLabelId) ?? null

  /**
   * Créer, renommer ou recolorer — un seul geste d'écran, trois mutations
   * possibles. ⚠ Renommer ET recolorer se font en DEUX appels enchaînés : les
   * deux mutations de `useMailLabels` écrivent une colonne chacune, et le
   * créateur rend toujours les deux valeurs (il ne sait pas laquelle a bougé).
   */
  const saveLabel = useCallback((v: { name: string; color: string }) => {
    const done = () => dispatch({ type: 'label-creator', open: false })
    if (editLabel) {
      labels.rename.mutate({ id: editLabel.id, name: v.name }, {
        onSuccess: () => labels.recolor.mutate({ id: editLabel.id, color: v.color }, { onSuccess: done }),
      })
    } else {
      labels.create.mutate(v, { onSuccess: done })
    }
  }, [editLabel, labels])

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
            <aside style={{ padding: 'var(--crm-space-7xl) var(--crm-space-6xl)', borderRight: `1px solid ${ms.bord2}`, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-7xl)', overflowY: 'auto', minHeight: 0 }}>
              <MailRail
                ms={ms}
                accounts={accounts.list}
                unread={accounts.unread}
                accountId={state.accountId}
                boxOpen={state.boxOpen}
                onToggleBox={() => dispatch({ type: 'toggle-box' })}
                onCloseBox={() => dispatch({ type: 'close-box' })}
                onSelectAccount={(id) => dispatch({ type: 'select-account', accountId: id })}
                onAddAccount={() => dispatch({ type: 'modal', modal: { kind: 'add-account', step: 'list' } })}
                onCompose={() => dispatch({ type: 'modal', modal: { kind: 'compose' } })}
                folder={state.folder}
                onFolder={(f) => dispatch({ type: 'folder', folder: f })}
                counts={counts}
                labels={labels.labels}
                activeLabelId={state.labelId}
                onLabel={(id) => dispatch({ type: 'label', labelId: id })}
                onLabelContext={(e, id) => dispatch({ type: 'label-ctx', ctx: { x: e.clientX, y: e.clientY, labelId: id } })}
                creatorOpen={state.labelCreatorOpen}
                editLabel={editLabel}
                onOpenCreator={() => dispatch({ type: 'label-creator', open: true })}
                onCloseCreator={() => dispatch({ type: 'label-creator', open: false })}
                onSaveLabel={saveLabel}
                creatorBusy={labels.create.isPending || labels.rename.isPending || labels.recolor.isPending}
              />
            </aside>
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

          {state.labelCtx && (
            <MailLabelMenu
              ms={ms}
              x={state.labelCtx.x}
              y={state.labelCtx.y}
              onClose={() => dispatch({ type: 'label-ctx', ctx: null })}
              onRename={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx?.labelId })}
              onRecolor={() => dispatch({ type: 'label-creator', open: true, editLabelId: state.labelCtx?.labelId })}
              onDelete={() => labels.remove.mutate(state.labelCtx!.labelId)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
