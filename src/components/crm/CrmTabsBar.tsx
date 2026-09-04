/**
 * CrmTabsBar — la barre d'onglets du CRM, en tête de la zone de travail.
 *
 * Port de la référence de design « Onglets » (maquette ERP dentaire) sur les
 * jetons MEGGA X. Six mécanismes, tous ici : la puce, la bascule, le glisser pour
 * réordonner, le clic droit, le débordement « +N », les badges.
 *
 * ── CE QU'ELLE N'EST PAS ─────────────────────────────────────────────────────
 * Ce n'est pas une navigation par onglets. La barre latérale porte les dix
 * destinations ; ici chaque puce est un CONTEXTE OUVERT — deux fiches contact
 * côte à côte, chacune avec sa position d'écran. Le modèle vit dans
 * `src/lib/crmTabs.ts`, l'état dans `useCrmTabs`.
 *
 * ── TROIS ÉCARTS ASSUMÉS À LA MAQUETTE, CHACUN MESURÉ ────────────────────────
 * 1. **Géométrie arrondie aux barreaux.** La maquette demande 6 px et 14 px de
 *    padding, un rayon de ligne à 11 px, un texte à 12,5 px. Le cliquet de
 *    grammaire n'accorde à la zone `src/components/crm` que DEUX littéraux de
 *    rayon/espacement au total, et ils sont déjà pris par `LiquidGlassRail`.
 *    Tout passe donc par `var(--crm-space-*)` / `var(--crm-radius-*)`, arrondi au
 *    barreau — exactement ce que la barre latérale a fait de ses 28/22/26/14/11.
 *    Le texte descend à `--crm-text-sm` (12 px) : ajouter un 14ᵉ barreau de taille
 *    est refusé par une prétention de sévérité « dure ».
 * 2. **Badge à 11 px / 600, pas 10 px / 700.** La graisse ≥ 700 et les tailles
 *    hors échelle sont refusées par le même cliquet. `--crm-text-xs` est le
 *    barreau du badge dans tout le CRM.
 * 3. **Pas d'ombre.** La maquette n'en pose pas non plus ; en clair, la puce
 *    active se détache par son APLAT d'accent, en sombre par sa bordure.
 *
 * ── ET UN ÉCART QUI N'EN EST PAS UN : L'ACCENT ───────────────────────────────
 * La maquette peint la puce active en « posée sur un fond » (blanc sur gris).
 * MEGGA X peint l'élément ACTIF en accent (décision Julien du 10 août 2026), et
 * la table de report du handoff le dit aussi pour le badge. La puce active est
 * donc un aplat `sp.accent` sous encre `sp.accentInk` — 5,78:1, mesuré.
 * ⛔ Jamais un LIBELLÉ en accent sur fond sombre : l'accent y rend 3,44:1, sous
 * l'AA. C'est l'aplat qui porte, pas l'encre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from './tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'
import { useCrmTabs, useCrmTabBadges } from '@/hooks/useCrmTabs'
import { crmChipMaxWidth, crmDragBounds, crmVisibleWindow, type CrmTab } from '@/lib/crmTabs'
import { useAiPanel } from '@/hooks/useAiPanel'

/**
 * Hauteur d'une puce. Une HAUTEUR n'est pas un espacement : aucun barreau ne la couvre.
 *
 * ⚠ 30, et NON les 36 de la maquette (retour de Julien, 4 septembre 2026 : « encore plus
 * fin, que le pager soit un peu plus haut »). La bande prenait 48 px au cadre bento, soit
 * 7 % de sa hauteur à 1280x720 — cher pour du chrome. Les six pixels sont repris ICI et
 * pas sur les gouttières : ce sont elles qui portent l'alignement de la première puce sur
 * le haut de la carte latérale, et le décalage se verrait bien plus qu'une puce d'un cran
 * plus basse.
 *
 * ⛔ Plancher mesuré, ne pas descendre sous 28 : la puce loge une croix ronde (20), un
 * badge (16) et un libellé de 12 px. À 28 la croix n'a plus que 4 px de respiration,
 * au-dessous elle touche le bord de la pilule.
 */
const H_PUCE = 30
/** Pastille « +N » et bouton « + » — un cran sous la puce, comme la maquette. */
const H_PASTILLE = 26
/** Rond de la croix, et de son homologue dans le menu de débordement. */
const D_CROIX = 20

/**
 * Nombre de puces visibles. Quatre quand le dock MEGGA AI est ouvert : il prend
 * 404 px, et six puces de 128 px n'y tiennent plus sans déborder sur le dock.
 */
const VIS_LARGE = 6
const VIS_DOCK = 4

/** Strate d'empilement — lue sur les voisins, pas copiée d'une convention. */
// La barre latérale est à 75, le dock MEGGA AI à 70, le bandeau d'usurpation à 90.
// La barre d'onglets vit DANS le flux, sous la barre latérale : 60 la met au-dessus
// du contenu sans jamais couvrir une popover de la barre latérale (9000) ni le
// bandeau. Ses deux menus, eux, sont PORTÉS et montent à 9000 — voir plus bas.
const Z_BARRE = 60
const Z_MENU = 9000

interface Props {
  sp: CrmPalette
  /**
   * Compteurs par section. Omis, la barre les lit ELLE-MÊME (`crm_tab_badges`).
   *
   * ⚠ Le badge n'est PAS une donnée d'onglet : deux onglets sur la même section
   * portent le même compte, et il suit la donnée, pas la pile. Le prop n'existe
   * que pour les bancs, qui n'ont pas de base derrière eux.
   */
  badges?: Record<string, { n: number; urgent?: boolean }>
}

// ─── La puce ────────────────────────────────────────────────────────────────

interface PuceProps {
  tb: CrmTab
  i: number
  actif: boolean
  fermable: boolean
  maxW: number
  sp: CrmPalette
  badge?: { n: number; urgent?: boolean }
  libelle: string
}

function styleDePuce(actif: boolean, maxW: number, sp: CrmPalette): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
    height: H_PUCE, maxWidth: maxW,
    // Asymétrique, comme la maquette : la croix comble la marge de droite.
    padding: '0 var(--crm-space-xs) 0 var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    cursor: 'pointer', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
    whiteSpace: 'nowrap', flexShrink: 1, minWidth: 0,
    border: `1px solid ${actif ? 'transparent' : 'transparent'}`,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    // ⚠ `fontFamily: inherit` et jamais un nom de police : Inter Tight est la
    // police du bureau agent, et `polices-domaines.spec.ts` refuse qu'un fichier
    // de bureau nomme une famille.
    fontFamily: 'inherit',
    transition: 'background-color .18s ease, color .18s ease',
  }
}

function Puce({ tb, i, actif, fermable, maxW, sp, badge, libelle }: PuceProps) {
  const { t } = useTranslation('common')
  const [survol, setSurvol] = useState(false)
  const [survolCroix, setSurvolCroix] = useState(false)

  const style = styleDePuce(actif, maxW, sp)
  if (!actif && survol) style.background = sp.focusSurface

  return (
    <div
      data-tabi={i}
      role="tab"
      aria-selected={actif}
      tabIndex={actif ? 0 : -1}
      title={libelle}
      onMouseEnter={() => setSurvol(true)}
      onMouseLeave={() => setSurvol(false)}
      style={style}
    >
      {tb.pinned && (
        <MEIcon name="pin" size={11} style={{ opacity: 0.65 }} />
      )}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {libelle}
      </span>
      {badge && badge.n > 0 && (
        <Badge n={badge.n} urgent={badge.urgent} actif={actif} sp={sp} />
      )}
      {fermable && (
        <span
          data-tabc={i}
          role="button"
          aria-label={t('tabs.close')}
          onMouseEnter={() => setSurvolCroix(true)}
          onMouseLeave={() => setSurvolCroix(false)}
          style={{
            width: D_CROIX, height: D_CROIX, borderRadius: 'var(--crm-radius-pill)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            // Sur une puce active peinte en accent, le survol de la croix
            // s'ÉCLAIRCIT au lieu de s'assombrir : un gris de survol sur un aplat
            // d'accent fait une tache sale.
            background: survolCroix ? (actif ? 'rgba(255,255,255,0.22)' : sp.cardSubBg) : 'transparent',
            color: actif ? sp.accentInk : sp.soft,
          }}
        >
          <MEIcon name="close" size={10} strokeWidth={2.2} />
        </span>
      )}
    </div>
  )
}

/**
 * Badge de puce.
 *
 * ⚠ Il S'INVERSE sur la puce active — c'est l'idiome déjà posé sur la cloche de
 * la barre latérale. Un badge d'accent sur un aplat d'accent serait invisible.
 */
function Badge({ n, urgent, actif, sp }: { n: number; urgent?: boolean; actif: boolean; sp: CrmPalette }) {
  const { t } = useTranslation('common')
  // ⛔ CE TERNAIRE ÉTAIT MORT jusqu'au 4 septembre 2026 : il peignait l'urgence avec
  // `sp.focusBg`/`sp.focusInk`, or `mxCrmPalette` les définit comme `C.accent`/`C.n1000` —
  // c'est-à-dire EXACTEMENT la paire d'accent de la branche ordinaire. Les deux variantes
  // rendaient donc le même badge, et la « variante rouge » du handoff n'existait pas.
  //
  // ⚠ `MXC_SYSTEM.red400` est un barreau DÉRIVÉ, pas un littéral : le cliquet des couleurs
  // (zone `src/components/crm` plafonnée au chiffre EXACT de ses hex) ne le compte pas.
  // Et il est PÂLE, réglé pour un aplat : `encreSur` lui pose donc l'encre sombre, comme
  // la règle des couleurs de système l'exige. Un blanc dessus rendrait 1,9:1.
  const fond = actif ? sp.accentInk : urgent ? MXC_SYSTEM.red400 : sp.accent
  const encre = actif ? sp.accent : urgent ? encreSur(MXC_SYSTEM.red400) : sp.accentInk
  return (
    <span
      title={urgent ? t('tabs.badgeUrgent') : t('tabs.badgeCount')}
      style={{
        fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        minWidth: 17, height: 16, padding: '0 var(--crm-space-2xs)',
        borderRadius: 'var(--crm-radius-pill)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxSizing: 'border-box', flexShrink: 0,
        background: fond, color: encre,
      }}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

// ─── La barre ───────────────────────────────────────────────────────────────

export function CrmTabsBar({ sp, badges: override }: Props) {
  const { t } = useTranslation('common')
  const api = useCrmTabs()
  const serveur = useCrmTabBadges()
  const badges = override ?? serveur
  const ai = useAiPanel()
  const dockOuvert = !!(ai.enabled && ai.isOpen)

  const barreRef = useRef<HTMLDivElement | null>(null)
  // ⚠ Le menu de débordement s'aligne sur la PASTILLE « +N », pas sur la barre :
  // ancré à la barre il s'ouvrait à gauche de l'écran, à des centaines de pixels
  // du bouton qui l'ouvre (vu à l'écran le 4 septembre 2026).
  const plusRef = useRef<HTMLButtonElement | null>(null)
  const [menuPlus, setMenuPlus] = useState(false)
  const [survolPlus, setSurvolPlus] = useState(false)
  const [survolNeuf, setSurvolNeuf] = useState(false)
  const [ctx, setCtx] = useState<{ i: number; x: number; y: number } | null>(null)

  const { tabs, active } = api
  const nTabs = tabs.length
  const vis = dockOuvert ? VIS_DOCK : VIS_LARGE
  const maxW = crmChipMaxWidth(nTabs, dockOuvert)
  const { visibles, caches } = useMemo(
    () => crmVisibleWindow(nTabs, active, vis),
    [nTabs, active, vis],
  )

  /** Libellé d'affichage — le nom résolu, sinon le nom de la section, sinon un repli. */
  const libelleDe = useCallback((tb: CrmTab): string => {
    if (tb.label) return tb.label
    if (tb.section) return t(`nav.${SECTION_LABEL[tb.section] ?? tb.section}`)
    return t('tabs.untitled')
  }, [t])

  // ── Délégation : UN onClick et UN onPointerDown pour toute la barre ────────
  const onClic = useCallback((e: React.MouseEvent) => {
    // Un glisser qui vient de se terminer ne doit pas se conclure en bascule.
    if (Date.now() - supRef.current < 250) return
    const cible = e.target as HTMLElement
    const croix = cible.closest('[data-tabc]')
    if (croix) {
      e.stopPropagation()
      api.fermer(Number((croix as HTMLElement).dataset.tabc))
      return
    }
    const puce = cible.closest('[data-tabi]')
    if (!puce) return
    setMenuPlus(false)
    api.selectionner(Number((puce as HTMLElement).dataset.tabi))
  }, [api])

  // ── Clic droit ────────────────────────────────────────────────────────────
  // Position RELATIVE à la barre (rect de la puce − rect de la barre), pas
  // `clientX/clientY` : le menu s'aligne sur le bord gauche de la puce et reste
  // juste même si la barre se décale (ouverture du dock, repli de la latérale).
  const onCtx = useCallback((e: React.MouseEvent) => {
    const puce = (e.target as HTMLElement).closest('[data-tabi]')
    if (!puce) return
    e.preventDefault()
    const r = puce.getBoundingClientRect()
    setCtx({ i: Number((puce as HTMLElement).dataset.tabi), x: Math.round(r.left), y: Math.round(r.bottom + 8) })
    setMenuPlus(false)
  }, [])

  // ── Glisser pour réordonner (modèle Chrome) ───────────────────────────────
  const dragRef = useRef<{
    el: HTMLElement; puces: HTMLElement[]; idx: number[]; from: number; target: number
    lo: number; hi: number; rects: DOMRect[]; startX: number; bouge: boolean; dx: number
  } | null>(null)
  const supRef = useRef(0)

  const nettoyer = useCallback(() => {
    const d = dragRef.current
    if (!d) return
    d.puces.forEach((c) => { c.style.removeProperty('transform') })
    d.el.style.removeProperty('position')
    d.el.style.removeProperty('z-index')
    document.body.style.removeProperty('user-select')
    document.body.style.removeProperty('cursor')
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    const cible = e.target as HTMLElement
    if (cible.closest('[data-tabc]')) return
    const el = cible.closest('[data-tabi]') as HTMLElement | null
    if (!el?.parentElement) return
    const puces = Array.from(el.parentElement.querySelectorAll('[data-tabi]')) as HTMLElement[]
    if (puces.length < 2) return

    const idx = puces.map((c) => Number(c.dataset.tabi))
    const from = puces.indexOf(el)

    /**
     * Bornes du glisser : le bloc CONTIGU de rangs réels qui entoure la puce tirée,
     * et de même épinglage.
     *
     * ⛔ LA FENÊTRE VISIBLE N'EST PAS TOUJOURS CONTIGUË, et c'est ce qui rendait le
     * glisser faux au-delà de six onglets. Quand l'actif est hors fenêtre, il EMPRUNTE
     * le dernier créneau : à 15 onglets avec l'actif au rang 12, la barre montre les
     * rangs [0,1,2,3,4,12]. Tirer la puce du créneau 4 vers le créneau 5 — UN cran à
     * l'écran — la déplaçait alors du rang 4 au rang 12 : huit rangs franchis, et la
     * puce SORTAIT du champ visible à l'arrivée. Mesuré le 4 septembre 2026.
     *
     * Le dernier créneau n'est pas « la position 6 de la pile », c'est un siège
     * emprunté. On ne peut donc pas y déposer quoi que ce soit : le glisser se limite
     * aux créneaux dont les rangs réels se suivent. On réordonne ce qu'on voit, et rien
     * ne se téléporte.
     */
    const { lo, hi } = crmDragBounds(idx, from, (rang) => !!tabs[rang]?.pinned)
    // Rien à réordonner : la puce est seule dans son bloc contigu.
    if (lo === hi) return

    dragRef.current = {
      el, puces, idx, from, target: from,
      lo, hi,
      // ⚠ Les rects sont mesurés UNE fois et servent de référence pour tout le
      // geste. Les relire pendant le glisser lirait un layout déjà déformé par
      // les transforms qu'on vient de poser, et les puces se mettraient à osciller.
      rects: puces.map((c) => c.getBoundingClientRect()),
      startX: e.clientX, bouge: false, dx: 0,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.bouge) {
      // Seuil : en deçà, c'est un clic. Sans lui, un clic un peu appuyé
      // réordonnerait la barre au lieu de changer d'onglet.
      if (Math.abs(dx) < 4) return
      d.bouge = true
      d.el.style.position = 'relative'
      d.el.style.zIndex = '6'
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
    }
    d.dx = dx
    d.el.style.transform = `translateX(${dx}px) scale(1.025)`

    const centre = d.rects[d.from].left + d.rects[d.from].width / 2 + dx
    let target = d.from
    for (let k = d.lo; k <= d.hi; k++) {
      if (k === d.from) continue
      const milieu = d.rects[k].left + d.rects[k].width / 2
      if (k < d.from && centre < milieu) target = Math.min(target, k)
      if (k > d.from && centre > milieu) target = Math.max(target, k)
    }
    if (target === d.target) return
    d.target = target

    // Les voisines cèdent la place : on recalcule les positions d'arrivée en
    // réinsérant l'index tiré à la place visée.
    const ordre = d.puces.map((_, k) => k)
    ordre.splice(target, 0, ordre.splice(d.from, 1)[0])
    let x = d.rects[0].left
    const gauche: Record<number, number> = {}
    ordre.forEach((k) => { gauche[k] = x; x += d.rects[k].width + 4 })
    d.puces.forEach((c, k) => {
      if (k === d.from) return
      c.style.transform = `translateX(${gauche[k] - d.rects[k].left}px)`
    })
  }, [])

  const onPointerUp = useCallback(() => {
    const d = dragRef.current
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    if (!d) return
    if (!d.bouge) { dragRef.current = null; nettoyer(); return }
    // Fenêtre de silence : le `click` qui suit ce `pointerup` ne doit pas basculer.
    supRef.current = Date.now()
    const from = d.idx[d.from]
    const to = d.idx[d.target]
    nettoyer()
    dragRef.current = null
    // ⚠ La maquette pose TROIS filets ici (onComplete du ressort, un rAF, un
    // setTimeout) parce que son runtime ne transmet pas les rappels de setState.
    // En React standard le rendu suit l'état : un seul chemin suffit, et poser
    // les trois ferait trois validations du même déplacement.
    if (from !== to) api.deplacer(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, nettoyer])

  /**
   * Retrait des écouteurs AU DÉMONTAGE, et au démontage seulement.
   *
   * ⛔ AVEC `[onPointerMove, onPointerUp]` EN DÉPENDANCES, CET EFFET TUAIT LE GLISSER
   * EN COURS. `onPointerUp` se referme sur `api`, dont l'identité change à chaque
   * changement d'état — et un glisser EN produit (le survol d'une puce, une sauvegarde
   * qui revient). Le nettoyage partait alors au milieu du geste, retirait les écouteurs,
   * et la puce restait collée au curseur sans que rien ne valide le déplacement.
   *
   * ⚠ Les handlers passent donc par des refs, et l'effet n'a plus AUCUNE dépendance :
   * il ne peut plus partir qu'au démontage réel.
   */
  const moveRef = useRef(onPointerMove)
  const upRef = useRef(onPointerUp)
  useEffect(() => { moveRef.current = onPointerMove; upRef.current = onPointerUp })
  useEffect(() => () => {
    window.removeEventListener('pointermove', moveRef.current)
    window.removeEventListener('pointerup', upRef.current)
    window.removeEventListener('pointercancel', upRef.current)
  }, [])

  // ── Clavier ───────────────────────────────────────────────────────────────
  // ⛔ Ni Ctrl+W ni Ctrl+1..9 : le navigateur se les réserve et ne les rend pas
  // annulables. Les lier ici fermerait l'onglet du NAVIGATEUR en croyant fermer
  // celui du CRM. Alt est libre, dans les deux systèmes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key >= '1' && e.key <= '9') {
        const i = Number(e.key) - 1
        if (i < tabs.length) { e.preventDefault(); api.selectionner(i) }
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const pas = e.key === 'ArrowRight' ? 1 : -1
        api.selectionner((active + pas + tabs.length) % tabs.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [api, active, tabs.length])

  // Fermer les menus à l'Échap.
  useEffect(() => {
    if (!ctx && !menuPlus) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCtx(null); setMenuPlus(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctx, menuPlus])

  if (!nTabs) return <div style={{ height: H_PUCE }} aria-hidden />

  const ctxTab = ctx ? tabs[ctx.i] : null

  return (
    <div
      ref={barreRef}
      role="tablist"
      aria-label={t('tabs.bar')}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)',
        minWidth: 0, position: 'relative', zIndex: Z_BARRE,
        height: H_PUCE, fontFamily: 'inherit',
      }}
    >
      <div
        onClick={onClic}
        onPointerDown={onPointerDown}
        onContextMenu={onCtx}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', minWidth: 0 }}
      >
        {visibles.map((i) => (
          <Puce
            key={tabs[i].id}
            tb={tabs[i]} i={i}
            actif={i === active}
            // Une puce épinglée perd sa croix : elle ne se ferme qu'après
            // détachement, par le menu. C'est le sens de l'épingle.
            fermable={nTabs > 1 && !tabs[i].pinned}
            maxW={maxW} sp={sp}
            badge={tabs[i].section ? badges?.[tabs[i].section] : undefined}
            libelle={libelleDe(tabs[i])}
          />
        ))}
      </div>

      {caches.length > 0 && (
        <button
          ref={plusRef}
          type="button"
          onClick={() => { setMenuPlus((v) => !v); setCtx(null) }}
          onMouseEnter={() => setSurvolPlus(true)}
          onMouseLeave={() => setSurvolPlus(false)}
          title={t('tabs.more')}
          aria-haspopup="menu"
          aria-expanded={menuPlus}
          style={{
            height: H_PASTILLE, padding: '0 var(--crm-space-lg)',
            borderRadius: 'var(--crm-radius-pill)',
            background: sp.cardBg,
            // La maquette fait foncer la BORDURE au survol, pas le fond : la pastille
            // porte déjà un fond, l'assombrir la ferait passer pour un état actif.
            border: `1px solid ${survolPlus ? sp.soft : sp.cardBorder}`,
            display: 'flex', alignItems: 'center', flexShrink: 0,
            transition: 'border-color .18s ease',
            fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {`+${caches.length}`}
        </button>
      )}

      <button
        type="button"
        onClick={() => api.ouvrirNouvel()}
        onMouseEnter={() => setSurvolNeuf(true)}
        onMouseLeave={() => setSurvolNeuf(false)}
        title={t('tabs.new')}
        aria-label={t('tabs.new')}
        style={{
          width: H_PASTILLE, height: H_PASTILLE, flexShrink: 0,
          borderRadius: 'var(--crm-radius-pill)', border: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontFamily: 'inherit',
          // Sans fond au repos, comme la maquette ; le survol le révèle.
          background: survolNeuf ? sp.focusSurface : 'transparent',
          color: survolNeuf ? sp.ink : sp.sub,
          transition: 'background-color .18s ease, color .18s ease',
        }}
      >
        <MEIcon name="plus" size={14} strokeWidth={1.9} />
      </button>

      {/* ── Menu de débordement ──────────────────────────────────────────────
          PORTÉ dans document.body, comme la popover des notifications : un
          ancêtre qui porterait un `backdrop-filter` deviendrait bloc conteneur de
          tout `position:fixed` descendant et garerait le menu hors écran. Le
          défaut a déjà été payé sur le menu « ⋯ » d'une notification. */}
      {menuPlus && caches.length > 0 && createPortal(
        <>
          <div onClick={() => setMenuPlus(false)} style={{ position: 'fixed', inset: 0, zIndex: Z_MENU - 1 }} />
          <MenuDebordement
            caches={caches} tabs={tabs} sp={sp} libelleDe={libelleDe} badges={badges}
            ancre={plusRef.current}
            onChoisir={(i) => { setMenuPlus(false); api.selectionner(i) }}
            onFermer={(i) => { setMenuPlus(false); api.fermer(i) }}
          />
        </>,
        document.body,
      )}

      {/* ── Menu contextuel (clic droit) ─────────────────────────────────── */}
      {ctxTab && createPortal(
        <>
          <div onClick={() => setCtx(null)} style={{ position: 'fixed', inset: 0, zIndex: Z_MENU - 1 }} />
          <div
            role="menu"
            style={{
              position: 'fixed', left: ctx!.x, top: ctx!.y, zIndex: Z_MENU, width: 224,
              background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
              borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-xs)',
              display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
              boxShadow: sp.solidShadow, fontFamily: 'inherit',
            }}
          >
            <div style={{
              fontSize: 'var(--crm-text-xs)', color: sp.soft, fontWeight: 600,
              padding: 'var(--crm-space-xs) var(--crm-space-lg) var(--crm-space-2xs)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {libelleDe(ctxTab)}
            </div>
            <LigneMenu
              icone="pin" sp={sp}
              libelle={ctxTab.pinned ? t('tabs.unpin') : t('tabs.pin')}
              onClick={() => { api.basculerEpingle(ctx!.i); setCtx(null) }}
            />
            <LigneMenu
              icone="copy" sp={sp} libelle={t('tabs.duplicate')}
              onClick={() => { api.dupliquer(ctx!.i); setCtx(null) }}
            />
            {nTabs > 1 && (
              <LigneMenu
                icone="close" sp={sp} libelle={t('tabs.closeOthers')}
                onClick={() => { api.fermerAutres(ctx!.i); setCtx(null) }}
              />
            )}
            {nTabs > 1 && !ctxTab.pinned && (
              <LigneMenu
                icone="close" sp={sp} libelle={t('tabs.closeThis')}
                onClick={() => { const i = ctx!.i; setCtx(null); api.fermer(i) }}
              />
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

/** Une ligne de menu — même géométrie pour le clic droit et le débordement. */
function LigneMenu({ icone, libelle, onClick, sp }: {
  icone: 'pin' | 'copy' | 'close'; libelle: string; onClick: () => void; sp: CrmPalette
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <button
      type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-lg)', border: 0, width: '100%',
        background: survol ? sp.focusSurface : 'transparent',
        color: sp.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 500,
        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <MEIcon name={icone} size={13} strokeWidth={1.8} color={sp.sub} />
      {libelle}
    </button>
  )
}

/** Le menu « +N » — même famille que le menu contextuel, un cran plus large. */
function MenuDebordement({ caches, tabs, sp, libelleDe, ancre, badges, onChoisir, onFermer }: {
  caches: number[]; tabs: CrmTab[]; sp: CrmPalette
  libelleDe: (t: CrmTab) => string
  ancre: HTMLElement | null
  badges?: Record<string, { n: number; urgent?: boolean }>
  onChoisir: (i: number) => void; onFermer: (i: number) => void
}) {
  const { t } = useTranslation('common')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // ⛔ Ni ResizeObserver ni rAF pour la mesure initiale : le premier ne livre pas
  // sa notification de départ sur ces éléments, le second est GELÉ quand le rendu
  // l'est (onglet d'arrière-plan, volet d'aperçu masqué) — les deux laissaient des
  // popovers garées hors écran, défaut mesuré le 4 septembre 2026. `queueMicrotask`
  // mesure après le montage, toujours.
  useEffect(() => {
    if (!ancre) return
    queueMicrotask(() => {
      const r = ancre.getBoundingClientRect()
      setPos({ x: Math.round(r.left), y: Math.round(r.bottom + 8) })
    })
  }, [ancre])

  if (!pos) return null
  return (
    <div
      role="menu"
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: Z_MENU, width: 270,
        background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
        borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-xs)',
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
        boxShadow: sp.solidShadow, fontFamily: 'inherit',
        maxHeight: '60vh', overflowY: 'auto',
      }}
      className="scrollbar-hide"
    >
      {caches.map((i) => (
        <LigneDebordement
          key={tabs[i].id} sp={sp} libelle={libelleDe(tabs[i])}
          fermable={tabs.length > 1 && !tabs[i].pinned}
          badge={tabs[i].section ? badges?.[tabs[i].section] : undefined}
          onClick={() => onChoisir(i)} onFermer={() => onFermer(i)}
          labelFermer={t('tabs.close')}
        />
      ))}
    </div>
  )
}

function LigneDebordement({ libelle, fermable, badge, onClick, onFermer, sp, labelFermer }: {
  libelle: string; fermable: boolean; onClick: () => void; onFermer: () => void
  badge?: { n: number; urgent?: boolean }
  sp: CrmPalette; labelFermer: string
}) {
  const [survol, setSurvol] = useState(false)
  return (
    <div
      role="menuitem" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-sm) var(--crm-space-lg)',
        borderRadius: 'var(--crm-radius-lg)', cursor: 'pointer',
        fontSize: 'var(--crm-text-sm)', color: sp.ink,
        background: survol ? sp.focusSurface : 'transparent',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {libelle}
      </span>
      {badge && badge.n > 0 && <Badge n={badge.n} urgent={badge.urgent} actif={false} sp={sp} />}
      {fermable && (
        <span
          role="button" aria-label={labelFermer}
          onClick={(e) => { e.stopPropagation(); onFermer() }}
          style={{
            width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: sp.soft, flexShrink: 0,
          }}
        >
          <MEIcon name="close" size={9} strokeWidth={2.2} />
        </span>
      )}
    </div>
  )
}

/**
 * Clé i18n du libellé d'une section — la même table que la barre latérale.
 * ⚠ Les deux chromes doivent nommer une section À L'IDENTIQUE : lire « Biens »
 * dans la colonne et « Annonces » sur la puce ferait douter que ce soit le même
 * écran.
 */
const SECTION_LABEL: Record<string, string> = {
  today: 'today', calendar: 'calendar', contacts: 'contacts', biens: 'listings',
  matching: 'matching', pipeline: 'pipeline', parcours: 'journey', kyc: 'kyc',
  dashboard: 'dashboard', settings: 'settings',
}

export default CrmTabsBar
