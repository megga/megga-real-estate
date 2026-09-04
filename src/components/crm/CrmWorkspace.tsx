/**
 * CrmWorkspace — la coquille de travail : barre latérale, barre d'onglets, contenu.
 *
 * Elle remplace, dans les vingt surfaces, le duo `<CrmSidebar/>` + contenu par un
 * seul point de montage. Ce n'est pas du sucre : la barre d'onglets doit se poser
 * AU-DESSUS du contenu et à DROITE de la barre latérale, et cette forme-là ne
 * s'obtient pas en ajoutant un frère à la barre latérale (ils sont dans une
 * RANGÉE flex : un frère y devient une colonne, pas une bande).
 *
 * ── POURQUOI PAS DANS LE `<main>`, ET C'EST MESURÉ ───────────────────────────
 * Sept surfaces capturent la molette sur leur cadre bento en `passive: false`
 * avec un `preventDefault()` inconditionnel (TodayPage, MatchingPage,
 * PipelinePage, BiensPager, KycPagerFrame, ContactsPager, ContactDetailPager) :
 * le handler remonte de `e.target` jusqu'au cadre et pagine si aucun ancêtre
 * n'est nativement défilable. Une barre d'onglets posée DANS ce cadre ferait
 * changer la page du pager au premier coup de molette sur une puce. Elle vit
 * donc dans une colonne insérée entre la rangée et le `<main>`.
 *
 * ── ET POURQUOI LA BARRE LATÉRALE NE BOUGE PAS ───────────────────────────────
 * `CrmSidebar` est en `calc(100vh - 34px)`, valeur accordée au pixel près sur les
 * gouttières du `<main>` (12 en haut, 22 en bas). La bande d'onglets prend sa
 * hauteur à la COLONNE DE CONTENU, pas à la rangée : la carte latérale garde donc
 * exactement son cadre, et les deux restent alignées en haut. C'est ce qui a
 * décidé la forme — une bande pleine largeur au-dessus des deux aurait fallu
 * rouvrir ce `calc`, et avec lui l'alignement que la barre latérale venait de
 * gagner.
 *
 * ── UNE SEULE FORME POUR DEUX RÉGIMES DE HAUTEUR ─────────────────────────────
 * Quinze surfaces sont en `height: 100vh` + `overflow: hidden` (écran figé),
 * cinq en `minHeight` (page qui défile). La colonne n'impose NI l'un NI l'autre :
 * elle hérite de la rangée qui l'accueille. Poser ici un `flex: 1, minHeight: 0`
 * ferait s'effondrer le contenu des cinq surfaces défilantes.
 */

import type { CSSProperties, ReactNode } from 'react'
import { CrmSidebar, type CrmSidebarProps } from './CrmSidebar'
import CrmTabsBar from './CrmTabsBar'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * Hauteur totale prise par la bande : la puce (36) plus sa gouttière haute (12).
 * ⚠ Elle est publiée en `--crm-tabs-h` pour que les rares surfaces qui calculent
 * contre `100vh` puissent la défalquer sans la recopier.
 */
const H_BANDE = 48

interface Props extends CrmSidebarProps {
  children: ReactNode
  /**
   * Compteurs de badge par section, quand l'appelant en a.
   * ⚠ Le badge suit la DONNÉE, pas l'onglet : il se recalcule à chaque rendu
   * depuis la section affichée, il n'est jamais stocké dans la pile.
   */
  badges?: Record<string, { n: number; urgent?: boolean }>
}

export function CrmWorkspace({ children, badges, ...sidebar }: Props) {
  const tabs = useCrmTabsOptionnel()
  const isMobile = useIsMobile()

  // ⛔ Pas de barre d'onglets sans fournisseur (bancs `/dev/biens`, `/dev/contacts`,
  // qui sont des routes de premier niveau hors `AgentLayout`), ni sur mobile — le
  // CRM mobile a DÉJÀ sa propre barre d'onglets, une pilule flottante à cinq
  // destinations, et deux barres par écran ne se discutent pas.
  const avecOnglets = !!tabs && !isMobile

  return (
    <>
      <CrmSidebar {...sidebar} />
      <div style={{
        display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0,
        // ⚠ La hauteur que la bande PREND, publiée en variable CSS.
        //
        // Les surfaces à hauteur FIGÉE n'en ont pas besoin (leur `<main>` est un
        // `flex: 1` qui se répartit tout seul). Mais celles qui calculent une hauteur
        // contre `100vh` — `ListingWizardPage` posait `height: calc(100vh - 64px)` en
        // supposant que son `<main>` commençait en haut de la fenêtre — débordaient
        // d'exactement cette valeur : la page se mettait à défiler et le pied du wizard
        // passait sous le pli. Elles lisent donc `var(--crm-tabs-h, 0px)`, qui vaut zéro
        // partout où la bande n'est pas rendue (mobile, bancs sans fournisseur).
        ['--crm-tabs-h' as string]: avecOnglets ? `${H_BANDE}px` : '0px',
      } as CSSProperties}>
        {avecOnglets && (
          <div style={{
            flexShrink: 0,
            // Aligné sur la gouttière gauche du `<main>` (`--crm-space-lg`), pour
            // que la première puce tombe à l'aplomb du bord du cadre bento.
            padding: 'var(--crm-space-lg) var(--crm-space-lg) 0',
          }}>
            <CrmTabsBar sp={sidebar.sp} badges={badges} />
          </div>
        )}
        {children}
      </div>
    </>
  )
}

export default CrmWorkspace
