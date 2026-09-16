/**
 * « Nouveau bien » — la page qui porte la création d'annonce en quatre étapes.
 *
 * Route : `/dashboard/listings/new` (bureau ; le mobile garde son propre wizard).
 * ⚠ Elle a REMPLACÉ l'ancien wizard (`WizardShell` + sept étapes) le 16.09.2026, sur
 * décision de Julien. « Créer un bien » dans la galerie ouvre le même composant dans le
 * pager ; cette route sert les liens directs (barre latérale, ⌘K).
 *
 * Même cadre que « Mes biens » et la fiche bien : la coquille `CrmWorkspace`, puis un cadre
 * arrondi aux mêmes marges — ouvrir la création depuis la galerie ne fait rien sauter.
 */
import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import NouveauBien from '@/components/crm/biens/nouveau/NouveauBien'
import { useCrmDarkPref } from '@/lib/crmDark'

export default function NouveauBienPage() {
  const navigate = useNavigate()
  const [dark, setDark] = useCrmDarkPref()
  const sp = crmPalette(dark)
  return (
    <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="biens" sp={sp} dark={dark} setDark={setDark}>
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
            <div style={{ position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow }}>
              <NouveauBien dark={dark} onClose={() => navigate('/dashboard/listings')} onOuvrirBien={(id) => navigate(`/dashboard/listings/${id}`)} />
            </div>
          </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}
