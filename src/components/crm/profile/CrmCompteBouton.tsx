/**
 * CrmCompteBouton — la pastille du compte, en haut à droite de la bande d'onglets.
 *
 * Elle ouvre le MÊME menu que la pastille du pied de la barre latérale
 * (`CrmProfileDropdown`), dans une autre pose : `coin`. Le menu se loge dans le
 * coin haut-droit du cadre de page, à son rayon mesuré — retour de Julien,
 * 14.09.2026 : « le dropdown doit épouser l'arrondi du pager ». La mesure et ses
 * raisons vivent dans `useCoinDuCadre`.
 *
 * ⚠ PORTÉ DANS `document.body`, comme les menus de la bande : un ancêtre qui
 * porterait un `transform` ou un `backdrop-filter` deviendrait le bloc conteneur de
 * ce `position: fixed`, et le coin mesuré en pixels de fenêtre tomberait à côté.
 *
 * ⚠ Les mêmes gestes que depuis la barre latérale, y compris sa règle des bancs :
 * depuis `/dev/*`, « Préférences » ne navigue pas (voir `CrmSidebar`, « LA BARRE NE
 * NAVIGUE PAS DEPUIS UN BANC ») — une cible `/dashboard/*` y enverrait en production.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '../tokens'
import { crmSidebarActiveFor, crmSidebarRouteOf } from '../crmSidebarNav'
import CrmProfileDropdown from './CrmProfileDropdown'
import { useAuth } from '@/hooks/useAuth'
import { useEcranActif } from '@/hooks/useEcranActif'
import { useCoinDuCadre } from '@/hooks/useCoinDuCadre'
import { openHelpFor } from '@/lib/help-articles'

interface Props {
  sp: CrmPalette
  dark: boolean
  setDark: (v: boolean) => void
  /** La bande qui porte la pastille : le cadre se cherche sous elle. */
  bandeRef: RefObject<HTMLElement | null>
  /** Diamètre des commandes rondes voisines, pour que la pastille soit de leur famille. */
  diametre: number
  /** Section active et clé d'aide de l'écran — les mêmes que reçoit la barre latérale. */
  active?: string
  helpKey?: string
}

/** Pastille d'avatar qui ouvre le menu du compte, logé dans le coin du cadre. */
export default function CrmCompteBouton({ sp, dark, setDark, bandeRef, diametre, active, helpKey }: Props) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut, profile, user } = useAuth()
  const ecranActif = useEcranActif()

  const [ouvert, setOuvert] = useState(false)
  const [survol, setSurvol] = useState(false)
  // L'URL de l'avatar QUI A ÉCHOUÉ, pas un booléen : comparée à l'URL courante, elle
  // se réarme d'elle-même quand l'agent change de photo (même règle que la barre).
  const [avatarCasse, setAvatarCasse] = useState<string | null>(null)
  const boutonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const coin = useCoinDuCadre(ouvert, bandeRef, boutonRef, menuRef)

  // Un écran d'onglet passé en arrière-plan referme son menu : porté dans `<body>`,
  // il échapperait au `visibility: hidden` de l'écran et resterait peint par-dessus
  // le suivant (même défaut, payé par les menus de la bande le 12.09.2026).
  if (!ecranActif && ouvert) setOuvert(false)

  // Clic dehors et Échap. ⚠ « Dehors » exclut la pastille ET le menu : ils ne sont
  // pas parents l'un de l'autre, le menu vit dans `<body>`.
  useEffect(() => {
    if (!ouvert || !ecranActif) return
    const onDown = (e: MouseEvent) => {
      const cible = e.target as Node
      if (boutonRef.current?.contains(cible) || menuRef.current?.contains(cible)) return
      setOuvert(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOuvert(false)
      boutonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ouvert, ecranActif])

  const nom = profile?.full_name?.trim() || user?.email?.split('@')[0] || t('profile.defaultName')
  const initiales = nom.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??'
  const avatarUrl = profile?.avatar_url?.trim() || ''

  const enBanc = location.pathname.startsWith('/dev/')
  const versReglages = () => {
    if (enBanc) return
    const route = crmSidebarRouteOf('settings')
    if (route) navigate(route)
  }

  return (
    <>
      <button
        ref={boutonRef}
        type="button"
        onClick={() => setOuvert(o => !o)}
        onMouseEnter={() => setSurvol(true)}
        onMouseLeave={() => setSurvol(false)}
        aria-label={t('profile.menu')}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        title={nom}
        style={{
          display: 'grid', placeItems: 'center', flexShrink: 0,
          width: diametre, height: diametre, padding: 0, overflow: 'hidden',
          border: 'none', borderRadius: 'var(--crm-radius-pill)',
          // La pastille d'avatar EST déjà l'accent : son état ouvert ne peut pas
          // « passer à l'accent », il garde `sp.ink` pour contraster (§3 de CLAUDE.md,
          // l'exception de la règle du 10 août 2026). Ici en ANNEAU, décollé du disque :
          // le vrai fond de la bande se voit entre les deux, sans halo à deviner.
          background: sp.accent, color: sp.accentInk,
          outline: ouvert || survol ? `2px solid ${ouvert ? sp.ink : sp.soft}` : 'none',
          outlineOffset: 2,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        {avatarUrl && avatarCasse !== avatarUrl ? (
          <img
            src={avatarUrl} alt="" loading="lazy"
            onError={() => setAvatarCasse(avatarUrl)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : initiales}
      </button>
      {ouvert && createPortal(
        <div ref={menuRef}>
          <CrmProfileDropdown
            sp={sp}
            dark={dark}
            setDark={setDark}
            coin={coin}
            onClose={() => setOuvert(false)}
            onSettings={versReglages}
            onHelp={() => openHelpFor(helpKey ?? active ?? crmSidebarActiveFor(location.pathname) ?? undefined)}
            onLogout={async () => { await signOut(); navigate('/login') }}
          />
        </div>,
        document.body,
      )}
    </>
  )
}
