// MEGGA CRM — page « Créer un bien » (/dashboard/listings/new).
//
// Le wizard épouse le PAGER : `WizardShell` est un plein écran par défaut
// (`position: fixed`, z-index 9000), on le monte donc en `embedded`
// (`position: absolute`, z-index 1) pour qu'il vive dans la coquille du CRM,
// à côté de la barre latérale — même mécanisme que `MatchingPage`.
//
// Le conteneur du wizard est `position: relative` et porte une hauteur : sans
// elle, un enfant en `position: absolute; inset: 0` s'effondrerait à zéro.
//
// `dark` lui est TRANSMIS : le wizard déduit sinon son thème de `data-theme`,
// quand la barre latérale bascule le réglage sombre. Sans ce passage, il
// restait clair dans un chrome sombre.

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import WizardShell from '@/components/crm-wizard/WizardShell'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { crmPalette } from '@/components/crm/tokens'
import { crmThemeVars } from '@/components/crm/crmThemeVars'
import { useCrmDarkPref } from '@/lib/crmDark'

export default function ListingWizardPage() {
  const navigate = useNavigate()
  const onClose = () => navigate('/dashboard/listings')

  const [dark, setDark] = useCrmDarkPref()
  const sgSp = useMemo(() => crmPalette(dark), [dark])

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: sgSp.pageBg, ...crmThemeVars(sgSp, dark) }}>
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <CrmWorkspace active="biens" sp={sgSp} dark={dark} setDark={setDark}>
        <main style={{ flex: 1, minWidth: 0, padding: 'var(--crm-space-lg) var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-lg)' }}>
          {/* Hauteur = 100vh moins les marges verticales de `main` ET la bande
              d'onglets, qui pousse ce `<main>` vers le bas. ⚠ `var(--crm-tabs-h)` vaut 0
              là où la bande n'est pas rendue (mobile, bancs) : sans elle, la page
              débordait de 48 px et le pied du wizard passait sous le pli.
              ⛔ LES DEUX VONT ENSEMBLE. La gouttière valait `24px 40px 40px`, et ce
              `calc` en défalquait la somme verticale, écrite en dur : `64px`. La
              normalisation des gouttières du 7 septembre 2026 la ramène à 12 + 24 =
              36 — changer l'une sans l'autre aurait fait déborder la page de 28 px,
              en silence. Le calc lit donc les MÊMES jetons que la gouttière. */}
          <div style={{ position: 'relative', height: 'calc(100vh - var(--crm-space-lg) - var(--crm-space-6xl) - var(--crm-tabs-h, 0px))', borderRadius: 26, overflow: 'hidden' }}>
            <WizardShell embedded dark={dark} onClose={onClose} />
          </div>
        </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}
