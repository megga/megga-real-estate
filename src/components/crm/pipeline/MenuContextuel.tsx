/**
 * Le menu du CLIC DROIT du Pipeline (28.09.2026, Julien : « quand on fait un clic droit, qu'on
 * puisse avoir des options… comme dans un navigateur »). Carte du Kanban, ligne de la Timeline,
 * fond d'une colonne ou de la Timeline, fiche d'affaire : chacun y porte ses gestes.
 *
 * Ce qu'un navigateur fait, et que ce menu fait aussi :
 *  - il s'ouvre SOUS LE CURSEUR et ne sort jamais de l'écran (il se retourne vers le haut ou la
 *    gauche) ; ses sous-menus « › » s'ouvrent à côté, au survol comme à la flèche droite ;
 *  - il se pilote AU CLAVIER : ↑ ↓ pour choisir, → ← pour entrer dans un sous-menu ou en sortir,
 *    Entrée pour valider, Échap pour fermer ;
 *  - il se ferme au clic dehors, à la molette, au redimensionnement, quand la fenêtre perd le focus.
 *
 * ⛔ À LA MOLETTE, PAS À L'ÉVÉNEMENT `scroll`. Un `scroll` arrive une image APRÈS le défilement qui
 * l'a causé : la fin d'un défilement fluide, une position rendue par un onglet, le défilement qui
 * amène l'élément sous le curseur — et le menu se refermait dans la frame de son ouverture. Mesuré
 * le 28.09.2026 sur la fiche d'affaire : le menu apparaissait puis disparaissait, sans un geste.
 * C'est l'INTENTION de défiler qui le ferme (molette, glissé au doigt).
 *
 * ⛔ LE MENU NATIF RESTE À PORTÉE (`menuNatifVoulu`, `menuClicDroit.ts`) : sur un champ, un lien ou du texte
 * sélectionné, le clic droit est celui du navigateur (copier, coller, ouvrir le lien) — et ⇧ + clic
 * droit le rend partout. Un menu maison qui confisque « Copier » se fait haïr.
 *
 * ⚠ Porté dans `<body>`, en `position: fixed`, au-dessus de tout (320, comme les menus de la
 * Messagerie). Un VOILE transparent dessous reçoit le clic qui ferme : sans lui, un clic sur une
 * carte fermerait le menu ET ouvrirait la carte.
 *
 * ⛔ Écran caché muet (onglets gardés vivants) : son clavier se tait, et il se ferme — voir
 * `useEcranActif`.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MEIcon from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { CrmPalette } from '../tokens'
import type { EntreeMenu, MenuOuvert } from './menuClicDroit'
import { ton } from './tons'

/** Écart minimal entre le menu et le bord de l'écran. */
const MARGE = 8

const choisissable = (e: EntreeMenu | undefined): boolean =>
  !!e && (e.genre === 'sous-menu' || (e.genre === 'action' && !e.coche))

/** Le prochain élément choisissable dans un sens, en bouclant ; -1 s'il n'y en a aucun. */
function suivant(liste: EntreeMenu[], depuis: number, pas: 1 | -1): number {
  for (let k = 1; k <= liste.length; k++) {
    const i = (depuis + pas * k + liste.length * 2) % liste.length
    if (choisissable(liste[i])) return i
  }
  return -1
}

export function MenuContextuel({ sp, menu, onFermer }: { sp: CrmPalette; menu: MenuOuvert; onFermer: () => void }) {
  const racine = useRef<HTMLDivElement>(null)
  const sous = useRef<HTMLDivElement>(null)
  const boutons = useRef<(HTMLButtonElement | null)[]>([])
  const boutonsSous = useRef<(HTMLButtonElement | null)[]>([])
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [posSous, setPosSous] = useState<{ x: number; y: number } | null>(null)
  const [actif, setActif] = useState(-1)
  const [ouvert, setOuvert] = useState<number | null>(null)
  const [actifSous, setActifSous] = useState(-1)
  const [niveau, setNiveau] = useState<0 | 1>(0)
  const ecranActif = useEcranActif()
  const retour = useRef<Element | null>(document.activeElement)

  const entrees = menu.entrees
  const parent = ouvert !== null ? entrees[ouvert] : undefined
  const entreesSous = parent?.genre === 'sous-menu' ? parent.entrees : null

  // Sous le curseur, retourné vers le haut ou la gauche s'il sortirait de l'écran.
  useLayoutEffect(() => {
    const el = racine.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    let x = menu.x
    let y = menu.y
    if (x + width > window.innerWidth - MARGE) x = Math.max(MARGE, menu.x - width)
    if (y + height > window.innerHeight - MARGE) y = Math.max(MARGE, window.innerHeight - MARGE - height)
    setPos({ x, y })
  }, [menu])

  // Le sous-menu : à droite de son entrée, à gauche du menu s'il n'y a pas la place.
  useLayoutEffect(() => {
    const el = sous.current
    const item = ouvert !== null ? boutons.current[ouvert] : null
    if (!el || !item || !racine.current) { setPosSous(null); return }
    const m = racine.current.getBoundingClientRect()
    const r = item.getBoundingClientRect()
    const { width, height } = el.getBoundingClientRect()
    let x = m.right - 2
    if (x + width > window.innerWidth - MARGE) x = Math.max(MARGE, m.left - width + 2)
    let y = r.top - 4
    if (y + height > window.innerHeight - MARGE) y = Math.max(MARGE, window.innerHeight - MARGE - height)
    setPosSous({ x, y })
  }, [ouvert, pos])

  const fermer = () => {
    onFermer()
    if (retour.current instanceof HTMLElement && retour.current.isConnected) retour.current.focus({ preventScroll: true })
  }
  const fermerRef = useRef(fermer)
  useEffect(() => { fermerRef.current = fermer })

  const ouvrirSous = (i: number, clavier: boolean) => {
    setOuvert(i)
    setNiveau(clavier ? 1 : 0)
    const e = entrees[i]
    setActifSous(clavier && e?.genre === 'sous-menu' ? suivant(e.entrees, -1, 1) : -1)
  }
  const choisir = (e: EntreeMenu | undefined) => {
    if (!e || e.genre !== 'action' || e.coche) return
    fermer()
    e.onChoisir()
  }

  // Le clavier, en CAPTURE : ce que le menu prend n'atteint pas l'écran dessous (ses raccourcis).
  const etat = useRef({ actif, ouvert, actifSous, niveau })
  useEffect(() => { etat.current = { actif, ouvert, actifSous, niveau } })
  useEffect(() => {
    if (!ecranActif) { fermerRef.current(); return }
    const touche = (ev: KeyboardEvent) => {
      const { actif: a, ouvert: o, actifSous: as, niveau: n } = etat.current
      const liste = n === 1 && o !== null && entrees[o]?.genre === 'sous-menu' ? (entrees[o] as { entrees: EntreeMenu[] }).entrees : entrees
      const courant = n === 1 ? as : a
      const pose = (i: number) => (n === 1 ? setActifSous(i) : (setActif(i), setOuvert(null)))
      let pris = true
      switch (ev.key) {
        case 'ArrowDown': pose(suivant(liste, courant, 1)); break
        case 'ArrowUp': pose(suivant(liste, courant < 0 ? 0 : courant, -1)); break
        case 'Home': pose(suivant(liste, -1, 1)); break
        case 'End': pose(suivant(liste, 0, -1)); break
        case 'ArrowRight':
          if (n === 0 && entrees[a]?.genre === 'sous-menu') ouvrirSous(a, true)
          break
        case 'ArrowLeft':
          if (n === 1) { setNiveau(0); setOuvert(null) }
          break
        case 'Escape':
          if (n === 1) { setNiveau(0); setOuvert(null) } else fermerRef.current()
          break
        case 'Enter': case ' ': {
          const e = liste[courant]
          if (e?.genre === 'sous-menu' && n === 0) ouvrirSous(courant, true)
          else choisir(e)
          break
        }
        case 'Tab': break
        default: pris = false
      }
      if (pris) { ev.preventDefault(); ev.stopPropagation() }
    }
    // Un menu dont l'ancrage va bouger ment : il se ferme, comme celui d'un navigateur.
    const defile = (ev: Event) => {
      if (ev.target instanceof Node && (racine.current?.contains(ev.target) || sous.current?.contains(ev.target))) return
      fermerRef.current()
    }
    const quitte = () => fermerRef.current()
    window.addEventListener('keydown', touche, true)
    window.addEventListener('wheel', defile, { capture: true, passive: true })
    window.addEventListener('touchmove', defile, { capture: true, passive: true })
    window.addEventListener('resize', quitte)
    window.addEventListener('blur', quitte)
    return () => {
      window.removeEventListener('keydown', touche, true)
      window.removeEventListener('wheel', defile, true)
      window.removeEventListener('touchmove', defile, true)
      window.removeEventListener('resize', quitte)
      window.removeEventListener('blur', quitte)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecranActif, entrees])

  // Le focus suit l'entrée active : les lecteurs d'écran l'annoncent.
  useEffect(() => {
    const b = niveau === 1 ? boutonsSous.current[actifSous] : boutons.current[actif]
    b?.focus({ preventScroll: true })
  }, [actif, actifSous, niveau, posSous])
  // À l'ouverture, le focus entre dans le menu (sans entrée choisie : le premier ↓ la choisit).
  useEffect(() => { racine.current?.focus({ preventScroll: true }) }, [])

  const entree = (e: EntreeMenu, i: number, dansSous: boolean) => {
    if (e.genre === 'separateur') {
      return <div key={e.cle} role="separator" style={{ height: 1, background: sp.cardBorder, margin: 'var(--crm-space-2xs) var(--crm-space-xs)' }} />
    }
    const estActif = dansSous ? niveau === 1 && actifSous === i : actif === i && (niveau === 0 || ouvert === i)
    const danger = e.genre === 'action' && e.danger
    const coche = e.genre === 'action' && e.coche
    const encre = danger ? ton('retard', sp).encre : sp.ink
    return (
      <button
        key={e.cle}
        ref={(b) => { (dansSous ? boutonsSous : boutons).current[i] = b }}
        type="button"
        tabIndex={-1}
        role={e.genre === 'action' && e.coche !== undefined ? 'menuitemradio' : 'menuitem'}
        aria-checked={e.genre === 'action' && e.coche !== undefined ? coche : undefined}
        aria-haspopup={e.genre === 'sous-menu' ? 'menu' : undefined}
        aria-expanded={e.genre === 'sous-menu' ? ouvert === i : undefined}
        onMouseEnter={() => {
          if (dansSous) { setNiveau(1); setActifSous(i); return }
          setActif(i)
          if (e.genre === 'sous-menu') ouvrirSous(i, false)
          else { setOuvert(null); setNiveau(0) }
        }}
        onClick={() => { if (e.genre === 'sous-menu') ouvrirSous(i, true); else choisir(e) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', width: '100%', minHeight: 32, textAlign: 'left',
          padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, outline: 'none',
          background: estActif ? sp.focusSurface : 'transparent', color: coche ? sp.sub : encre,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', cursor: coche ? 'default' : 'pointer',
        }}
      >
        {e.genre === 'action' && e.pastille
          ? <span aria-hidden style={{ width: 8, height: 8, margin: '0 var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', background: e.pastille, flexShrink: 0 }} />
          : e.icone
            ? <MEIcon name={e.icone} size={14} color={e.genre === 'action' && e.teinte ? e.teinte : danger ? encre : sp.sub} />
            : <span aria-hidden style={{ width: 14, flexShrink: 0 }} />}
        <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{e.libelle}</span>
        {coche && <MEIcon name="check" size={13} color={sp.sub} />}
        {e.genre === 'sous-menu' && <MEIcon name="chevron-right" size={13} color={sp.sub} />}
      </button>
    )
  }

  const panneau = {
    position: 'fixed' as const, zIndex: 320, minWidth: 220, display: 'flex', flexDirection: 'column' as const,
    padding: 'var(--crm-space-2xs)', background: sp.solidBg, border: `1px solid ${sp.solidBorder}`,
    borderRadius: 'var(--crm-radius-lg)', boxShadow: sp.solidShadow, outline: 'none',
    fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
  }

  return createPortal(
    <>
      <div
        onClick={fermer}
        onContextMenu={(ev) => { ev.preventDefault(); fermer() }}
        style={{ position: 'fixed', inset: 0, zIndex: 319 }}
      />
      <div ref={racine} role="menu" aria-label={menu.libelle} tabIndex={-1} onContextMenu={(ev) => ev.preventDefault()} style={{
        ...panneau, left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? 'visible' : 'hidden',
        animation: 'qaFade .12s ease-out',
      }}>
        {entrees.map((e, i) => entree(e, i, false))}
      </div>
      {entreesSous && (
        <div ref={sous} role="menu" aria-label={parent?.genre === 'sous-menu' ? parent.libelle : undefined} tabIndex={-1}
          onContextMenu={(ev) => ev.preventDefault()}
          style={{ ...panneau, left: posSous?.x ?? 0, top: posSous?.y ?? 0, visibility: posSous ? 'visible' : 'hidden' }}>
          {entreesSous.map((e, i) => entree(e, i, true))}
        </div>
      )}
    </>,
    document.body,
  )
}
