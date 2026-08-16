// MEGGA CRM — page « Créer un bien » (/dashboard/listings/new).
//
// Le wizard épouse le PAGER : `WizardShell` est un plein écran par défaut
// (`position: fixed`, z-index 9000), on le monte donc en `embedded`
// (`position: absolute`, z-index 1) pour qu'il vive dans la coquille Sugar,
// à côté du rail — même mécanisme que `MatchingPage`.
//
// Le conteneur du wizard est `position: relative` et porte une hauteur : sans
// elle, un enfant en `position: absolute; inset: 0` s'effondrerait à zéro.
//
// `dark` lui est TRANSMIS : le wizard déduit sinon son thème de `data-theme`
// (clé `megga-theme`), quand le rail Sugar bascule `megga.sugar.dark`. Sans ce
// passage, il restait clair dans un chrome sombre.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WizardShell from '@/components/crm-wizard/WizardShell'
import { CrmTopNav, CrmIconRail, CRM_KEYFRAMES, type CrmScreenId } from '@/components/crm/CrmShell'
import { crmPalette } from '@/components/crm/tokens'
import { crmThemeVars } from '@/components/crm/crmThemeVars'
import { readCrmDark } from '@/lib/crmDark'

export default function ListingWizardPage() {
  const navigate = useNavigate()
  const onClose = () => navigate('/dashboard/listings')

  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && readCrmDark())
  const sgSp = useMemo(() => crmPalette(dark), [dark])
  const onCrmNav = (id: CrmScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onCrmCmd = () => {}

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: sgSp.pageBg, ...crmThemeVars(sgSp, dark) }}>
      <style>{CRM_KEYFRAMES}</style>
      <CrmTopNav active={'biens' as CrmScreenId} sp={sgSp} onNavigate={onCrmNav} onCmd={onCrmCmd} dark={dark} />
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <CrmIconRail active={'biens' as CrmScreenId} onNavigate={onCrmNav} onCmd={onCrmCmd} dark={dark} setDark={setDark} sp={sgSp} />
        <main style={{ flex: 1, minWidth: 0, padding: '92px 40px 40px' }}>
          <div style={{ position: 'relative', height: 'calc(100vh - 132px)', borderRadius: 26, overflow: 'hidden' }}>
            <WizardShell embedded dark={dark} onClose={onClose} />
          </div>
        </main>
      </div>
    </div>
  )
}
