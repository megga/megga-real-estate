// MEGGA CRM Sugar v2 — page « Créer un bien » (/dashboard/listings/new).
//
// Le wizard épouse le PAGER : `WizardShell` est un plein écran par défaut
// (`position: fixed`, z-index 9000), on le monte donc en `embedded`
// (`position: absolute`, z-index 1) pour qu'il vive dans la coquille Sugar,
// à côté du rail — même mécanisme que `MatchingPagerPage`.
//
// Le conteneur du wizard est `position: relative` et porte une hauteur : sans
// elle, un enfant en `position: absolute; inset: 0` s'effondrerait à zéro.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WizardShell from '@/components/crm-sugar-wizard/WizardShell'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { crmSugarPalette, type DarkTone, sugarThemeTokens, SUGAR_DARK_TONE } from '@/components/crm-sugar/tokens'
import { sugarThemeVars } from '@/components/crm-sugar/sugarThemeVars'

export default function WizardSugarV2Page() {
  const navigate = useNavigate()
  const onClose = () => navigate('/dashboard/listings')

  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem('megga.sugar.dark') === '1')
  const sgT = sugarThemeTokens(dark)
  const sgSp = useMemo(() => crmSugarPalette(sgT, dark, SUGAR_DARK_TONE as DarkTone), [sgT, dark])
  const onSugarNav = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onSugarCmd = () => {}

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: sgSp.pageBg, ...sugarThemeVars(sgSp, dark) }}>
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav active={'biens' as SugarScreenId} t={sgT} sp={sgSp} onNavigate={onSugarNav} onCmd={onSugarCmd} dark={dark} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail active={'biens' as SugarScreenId} onNavigate={onSugarNav} onCmd={onSugarCmd} dark={dark} setDark={setDark} sp={sgSp} />
        <main style={{ flex: 1, minWidth: 0, padding: '92px 40px 40px' }}>
          <div style={{ position: 'relative', height: 'calc(100vh - 132px)', borderRadius: 26, overflow: 'hidden' }}>
            <WizardShell embedded onClose={onClose} />
          </div>
        </main>
      </div>
    </div>
  )
}
