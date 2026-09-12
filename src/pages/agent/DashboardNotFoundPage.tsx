/**
 * L'écran « page introuvable » du CRM — DANS la coquille, jamais à côté.
 *
 * ⛔ POURQUOI IL EXISTE. Un chemin inconnu sous `/dashboard` rendait le 404
 * global de l'application : plein cadre, sans barre latérale, sans bande
 * d'onglets. Retour de Julien, 7 septembre 2026 — « ça me sort de la zone de
 * contexte ». Il a raison, et c'est plus qu'une gêne visuelle : la pile
 * d'onglets est TOUJOURS OUVERTE derrière, mais on ne la voit plus, donc on ne
 * peut plus y revenir autrement que par le bouton « précédent » du navigateur.
 * Une adresse fausse ne devrait pas coûter le plan de travail.
 *
 * ⚠ Il ne remplace pas `NotFoundPage`, qui garde tout ce qui est hors du CRM
 * (la vitrine, l'authentification, les liens publics) : là, il n'y a pas de
 * coquille à préserver, et l'afficher pleine page est juste.
 *
 * ⚠ Aucune section allumée dans la barre latérale : `crmSidebarActiveFor` ne
 * reconnaît pas ce chemin, et c'est le comportement voulu — on n'est nulle part.
 */

import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import EtatVide from '@/components/crm/EtatVide'
import { RailIcon } from '@/components/crm/LiquidGlassRail'
import { crmPalette } from '@/components/crm/tokens'
import { useCrmDarkPref } from '@/lib/crmDark'
import { useTabLabel } from '@/hooks/useCrmTabs'

export default function DashboardNotFoundPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()

  const [dark, setDark] = useCrmDarkPref()

  const sp = crmPalette(dark)

  /**
   * ⚠ L'ONGLET ET LA BARRE LATÉRALE MENTAIENT TOUS LES DEUX, et pour la même
   * raison : `crmSidebarActiveFor` classe par spécificité et teste `/dashboard`
   * en dernier — mais il le teste, et tout chemin inconnu commence par
   * `/dashboard/`. La puce s'appelait donc « Aujourd'hui » et la barre l'allumait,
   * au-dessus d'un écran qui dit « cette page n'existe pas ».
   *
   * L'écran, lui, SAIT ce qu'il est : il pose son propre libellé (`useTabLabel`,
   * la porte prévue pour ça) et passe `active=""` à la coquille pour n'allumer
   * aucune section. Corriger `crmSidebarActiveFor` n'aurait pas marché — elle ne
   * connaît pas la table des routes, donc elle ne peut pas savoir qu'un chemin
   * n'existe pas.
   */
  useTabLabel(t('notFound.tab'))

  return (
    <div style={{
      background: sp.pageBg,
      minHeight: '100vh',
      fontFamily: 'var(--crm-font), system-ui, sans-serif',
      color: sp.ink,
    }}>
      <style>{CRM_KEYFRAMES}</style>
      <div style={{ display: 'flex' }}>
        <CrmWorkspace active="" sp={sp} dark={dark} setDark={setDark}>
          <main style={{
            flex: 1, minWidth: 0, display: 'flex',
            padding: 'var(--crm-space-lg) var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-lg)',
          }}>
            <EtatVide
              dark={dark}
              glyphe={<RailIcon name="search" size={22} />}
              titre={t('notFound.title')}
              // ⚠ Le chemin est REPRIS tel quel : sans lui, on ne sait pas ce
              // qu'on a mal tapé, et le message ne sert qu'à s'excuser.
              corps={t('notFound.body', { chemin: location.pathname })}
              action={{ libelle: t('notFound.action'), onClick: () => navigate('/dashboard') }}
            />
          </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}
