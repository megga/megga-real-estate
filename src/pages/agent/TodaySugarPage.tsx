// MEGGA CRM Sugar v2 — Today screen (page d'atterrissage agent).
//
// Source de vérité 100% Supabase :
//   - Empty state si l'agence n'a pas encore de contacts
//   - Pipeline du jour (KPI donuts + stats) câblé sur useTodaySugarKpi
//     (reminders / transactions / matches réels)
//   - Pastille checklist d'activation (persistée via profiles.activation_checklist)
//
// Tout le reste (parcours horizontal hardcodé, knowledge table mock, popovers
// fake AI, Focus mode SugarFocusView, export CSV bidon) a été retiré dans
// le pass d'audit "tout bouton fait ce qu'il dit". Les éléments retirés sont
// re-introductibles via PR dédiées une fois les règles d'aggrégation
// reminders→colonnes définies.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import { useTodaySugarKpi } from '@/hooks/useTodaySugarKpi'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import CRMIcon from '@/components/crm-sugar/CRMIcon'
import {
  SugarTopNav, SugarIconRail, SugarFrame, SugarRoundIconBtn,
  SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  SugarDonut, SugarPipelineStat,
} from '@/components/crm-sugar/SugarTodayComponents'
import {
  useSugarPopover, SugarPopover,
  SugarPipelineDrill,
  type PipelineDrillKind,
} from '@/components/crm-sugar/SugarPopovers'
import { ActivationChecklistPill } from '@/components/premier-jour-sugar/ActivationChecklistPill'

const DARK_TONE: DarkTone = 'meggaAi'

export default function TodaySugarPage() {
  const navigate = useNavigate()

  // ─── Theme: dark/light, tied to the icon-rail toggle ─────────────────
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  // ─── KPIs live (Supabase) ───────────────────────────────────────────
  const kpi = useTodaySugarKpi()

  // ─── Real agency contacts (used to decide empty vs pipeline state) ──
  const { contacts: realContacts, isLoading: contactsLoading } = useContactsSugar()
  const hasRealAgencyContacts = !contactsLoading && realContacts.length > 0

  // Pipeline drill popover (only popover left — navigates to real pipeline).
  const pipelinePop = useSugarPopover<{ kind: PipelineDrillKind }>()

  const onCmd = () => {
    /* Command palette pas encore wired — pas de toast "à venir" qui fait illusion. */
  }

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     navigate('/dashboard'); break
      case 'pipeline':  navigate('/dashboard/pipeline'); break
      case 'matching':  navigate('/dashboard/matching'); break
      case 'contacts':  navigate('/dashboard/contacts'); break
      case 'biens':     navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar':  navigate('/dashboard/calendar'); break
      case 'docs':      navigate('/dashboard/documents'); break
      case 'kyc':       navigate('/dashboard/kyc'); break
      case 'reseau':    navigate('/dashboard/reseau'); break
      case 'parcours':  navigate('/dashboard/parcours'); break
      case 'ai':
      case 'julien':    navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings':  navigate('/dashboard/settings'); break
      default:
        /* Pas de toast "à venir" — un bouton qui ne fait rien doit disparaître,
           pas faire semblant. */
    }
  }

  // Real current date in fr-CH (e.g. "mardi 27 mai 2026").
  const todayLabel = new Date().toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div style={{
      background: sp.pageBg,
      minHeight: '100vh',
      fontFamily: 'Manrope, system-ui, sans-serif',
      color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav active="today" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="today"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main style={{ flex: 1, padding: '32px 40px 80px 0', minWidth: 0 }}>
          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <h1 style={{
              margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: sp.ink,
              lineHeight: 1,
            }}>Aujourd'hui</h1>
            <span style={{
              fontSize: 13, color: sp.sub, marginLeft: 6, fontWeight: 500,
              textTransform: 'capitalize',
            }}>
              {todayLabel}
            </span>
          </div>

          {!contactsLoading && !hasRealAgencyContacts ? (
            // EMPTY STATE — fresh agency, no contacts yet.
            <SugarFrame sp={sp} title="Démarrez votre journée">
              <div style={{
                padding: '64px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                textAlign: 'center',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 999,
                  background: sp.cardSubBg, display: 'grid', placeItems: 'center',
                }}>
                  <CRMIcon name="plus" size={32} stroke={sp.soft} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: sp.ink, marginBottom: 4 }}>
                    Votre journée commence ici
                  </div>
                  <div style={{ fontSize: 13, color: sp.sub, maxWidth: 420, lineHeight: 1.5 }}>
                    Importez ou créez vos premiers contacts pour voir vos
                    relances, qualifications et offres s'afficher
                    automatiquement.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => navigate('/dashboard/contacts')}
                    style={{
                      height: 40, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
                      background: sp.ink, color: sp.pageBg,
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                      boxShadow: sp.focusShadow,
                    }}
                  >
                    + Créer un contact
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/contacts/import')}
                    style={{
                      height: 40, padding: '0 18px', borderRadius: 999, cursor: 'pointer',
                      background: 'transparent', color: sp.ink,
                      border: `1px solid ${sp.cardBorder}`,
                      fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >
                    Importer un CSV
                  </button>
                </div>
              </div>
            </SugarFrame>
          ) : (
            <SugarFrame
              sp={sp}
              title="Pipeline du jour"
              actions={
                <SugarRoundIconBtn sp={sp} onClick={() => navigate('/dashboard/pipeline')}>
                  <CRMIcon name="arrowR" size={18} stroke={sp.soft} />
                </SugarRoundIconBtn>
              }
            >
              <div style={{
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                padding: '10px 0 4px',
              }}>
                <SugarDonut sp={sp} value={kpi.executedToday} total={Math.max(kpi.executedTotal, 1)}
                  color="#0041D9" bg={dark ? '#1A2A4D' : '#E8EFFE'} label="Exécutées"
                  onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'executed' })} />
                <SugarDonut sp={sp} value={kpi.activeTasks} total={kpi.activeTarget}
                  color="#E53935" bg={dark ? '#3A1F22' : '#FDECEA'} label="Actives"
                  onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'active' })} />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-around', marginTop: 10,
                fontSize: 11.5, color: sp.sub,
              }}>
                <SugarPipelineStat sp={sp}
                  value={`CHF ${(kpi.pipelineValue / 1e6).toFixed(1)}M`}
                  valueColor={sp.ink} label="Pipeline"
                  onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'pipeline' })} />
                <SugarPipelineStat sp={sp}
                  value={kpi.newMatchesToday > 0 ? `+${kpi.newMatchesToday}` : '0'}
                  valueColor="#0E9F6E" label="Nouveaux matchs"
                  onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'matches' })} />
                <SugarPipelineStat sp={sp}
                  value={String(kpi.atRisk)}
                  valueColor="#F59E0B" label="À risque"
                  onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'risk' })} />
              </div>
            </SugarFrame>
          )}

          {pipelinePop.open && (
            <SugarPopover anchorRect={pipelinePop.anchorRect} sp={sp} dark={dark} onClose={pipelinePop.close} width={340}>
              <SugarPipelineDrill sp={sp}
                kind={pipelinePop.payload?.kind}
                onClose={pipelinePop.close}
                onPickItem={it => {
                  if (it.id === 'all') {
                    pipelinePop.close()
                    navigate('/dashboard/pipeline')
                  }
                }} />
            </SugarPopover>
          )}
        </main>
      </div>

      <ActivationChecklistPill dark={dark} defaultOpen={false} />
    </div>
  )
}
