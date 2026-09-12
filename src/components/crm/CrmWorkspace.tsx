/**
 * CrmWorkspace — la coquille de travail : barre latérale, barre d'onglets, contenu.
 *
 * Elle remplace, dans chaque surface, le duo `<CrmSidebar/>` + contenu par un
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
 * ── LA BANDE EST PLEINE LARGEUR, AU-DESSUS DE TOUT (7 septembre 2026) ────────
 * ⛔ ELLE NE L'ÉTAIT PAS, ET CET EN-TÊTE EXPLIQUAIT POURQUOI : la bande prenait sa
 * hauteur à la COLONNE DE CONTENU, pour ne pas rouvrir le `calc` de la barre
 * latérale. Le prix de ce choix se voyait — retour de Julien, mesuré : la carte
 * latérale faisait **864 px** et le contenu **834**, parce qu'elle démarrait
 * au-dessus de la bande. Trente pixels d'écart entre deux cartes censées border
 * le même cadre, et le dock MEGGA AI (864 lui aussi) s'alignait sur la mauvaise.
 *
 * La bande passe donc au-dessus des deux, et démarre au bord GAUCHE. Les trois
 * pièces — carte latérale, contenu, dock — commencent alors sous elle et ferment
 * ensemble.
 *
 * ⚠ CE QUI REND LA CHOSE TENABLE : l'offset est publié en `--crm-chrome-top`, sur
 * la RACINE. Le dock est monté dans `App.tsx`, hors de cette coquille, et il est
 * en `position: fixed` — il n'hérite de rien. Une variable de racine est le seul
 * canal qu'ils partagent. Écrite par le SEUL écran visible (`useEcranActif`) :
 * chaque écran vivant l'écrirait sinon à son tour, et le nettoyage de l'un
 * effacerait celle dont l'autre a besoin.
 *
 * ── UNE SEULE FORME POUR DEUX RÉGIMES DE HAUTEUR ─────────────────────────────
 * Quinze surfaces sont en `height: 100vh` + `overflow: hidden` (écran figé),
 * cinq en `minHeight` (page qui défile). La colonne n'impose NI l'un NI l'autre :
 * elle hérite de la rangée qui l'accueille. Poser ici un `flex: 1, minHeight: 0`
 * ferait s'effondrer le contenu des cinq surfaces défilantes.
 */

import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CrmSidebar, type CrmSidebarProps } from './CrmSidebar'
import { useEcranActif } from '@/hooks/useEcranActif'
import CrmTabsBar from './CrmTabsBar'
import { useCrmTabsOptionnel } from '@/hooks/useCrmTabs'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * Hauteur totale prise par la bande : la puce (30) plus sa gouttière haute (12).
 * ⚠ Elle est publiée en `--crm-tabs-h` pour que les rares surfaces qui calculent
 * contre `100vh` puissent la défalquer sans la recopier.
 */
const H_BANDE = 42

/**
 * L'offset du chrome — ce que la bande prend en haut, gouttière comprise.
 *
 * Publié sur la racine parce que le dock MEGGA AI, monté hors de cette coquille
 * et en `position: fixed`, n'hérite d'aucune variable d'ici.
 */
const VAR_CHROME_TOP = '--crm-chrome-top'

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

  // ⚠ L'offset du chrome, publié sur la RACINE pour le dock (voir l'en-tête).
  // Écrit par le seul écran VISIBLE : chaque écran vivant l'écrirait sinon à son
  // tour, et le nettoyage de l'un effacerait celle dont l'autre a besoin.
  const ecranActif = useEcranActif()
  useEffect(() => {
    if (!ecranActif) return
    const racine = document.documentElement
    // ⚠ LA BANDE **PLUS** LA GOUTTIÈRE. `H_BANDE` seul collait les cartes sous la
    // dernière puce — mesuré : puce à 42, carte latérale à 42, zéro respiration.
    // Et surtout, 42 ne correspondait à RIEN côté contenu : le `<main>` porte son
    // propre `padding-top` de 12, donc son cadre bento commençait à 54. Les deux
    // cartes se ratent de douze pixels tant qu'elles ne lisent pas le même
    // nombre. Le cadre du contenu est la référence — c'est lui qu'on regarde.
    racine.style.setProperty(VAR_CHROME_TOP, avecOnglets
      ? `calc(${H_BANDE}px + var(--crm-space-lg))`
      : 'var(--crm-space-lg)')
    return () => { racine.style.removeProperty(VAR_CHROME_TOP) }
  }, [ecranActif, avecOnglets])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0,
      // ⚠ Ce que la bande prend au contenu, publié en variable.
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
          // ⚠ Gouttières ASYMÉTRIQUES, et c'est ce que fait le `<main>` : 12 px à
          // gauche, 24 à droite. La bande démarre donc au bord GAUCHE du cadre —
          // à l'aplomb de la carte latérale, qui commence désormais SOUS elle — et
          // la dernière commande de droite tombe à l'aplomb du bord droit.
          padding: 'var(--crm-space-lg) var(--crm-space-7xl) 0 var(--crm-space-lg)',
        }}>
          <CrmTabsBar sp={sidebar.sp} dark={sidebar.dark} setDark={sidebar.setDark} badges={badges} />
        </div>
      )}
      {/* ⚠ La RANGÉE, sous la bande : c'est elle qui porte désormais le duo
          carte latérale / contenu. Sans bande (mobile, bancs), elle reprend à son
          compte la gouttière haute que la bande fournissait. */}
      <div style={{
        display: 'flex', flex: 1, minWidth: 0,
        paddingTop: avecOnglets ? 0 : undefined,
        // ⛔ AUCUNE GOUTTIÈRE BASSE ICI, et c'est un gain de place assumé
        // (Julien : « mords un peu plus sur le bas »). Elle en portait une de 24,
        // qui s'AJOUTAIT au `padding-bottom` du `<main>` : le cadre bento fermait
        // donc à 852 sur 900 — quarante-huit pixels perdus, comptés deux fois. La
        // rangée descend maintenant jusqu'au pli, et c'est le `<main>` seul qui
        // tient la gouttière. Le cadre gagne 24 px et ferme à 876.
      }}>
        <CrmSidebar {...sidebar} />
        <div style={{
          display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default CrmWorkspace
