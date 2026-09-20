/**
 * Le menu des dossiers du studio — c'est le TITRE de la galerie qui s'ouvre :
 * « Toutes les productions », « Favoris », puis les dossiers de l'agence (renommer,
 * supprimer au survol), « Nouveau dossier », et le compteur du mois.
 *
 * ⚠ Un menu et non une colonne (Julien, 20.09.2026 : « le pager doit rester comme il
 * est partout, pour profiter de la plus grande surface disponible ») : la galerie prend
 * tout le cadre, comme Mes biens ou Contacts. La barre latérale n'accueille pas de
 * sous-entrées — repliée en rail de 84 px, elles n'auraient nulle part où vivre.
 *
 * ⚠ Les dossiers sont des FILTRES sur une seule liste : choisir un dossier change le
 * prédicat, rien ne se déplace. Le déplacement est un geste de la visionneuse.
 *
 * ⚠ L'élément ACTIF porte l'accent (CLAUDE.md §3), en aplat sous encre inversée.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useEcranActif } from '@/hooks/useEcranActif'
import type { LabsFolder, LabsView } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

interface Props {
  ls: LabsSurfaces
  folders: LabsFolder[]
  counts: Record<string, number>
  totalCount: number
  favCount: number
  folderId: string | null
  view: LabsView
  isLoading: boolean
  onSelectAll: () => void
  onSelectFavorites: () => void
  onSelectFolder: (id: string) => void
  onNewFolder: () => void
  onRenameFolder: (f: LabsFolder) => void
  onDeleteFolder: (f: LabsFolder) => void
  usage: { image: number; video: number }
  quota: { image: number; video: number }
}

export function LabsFolderMenu(p: Props) {
  const { t } = useTranslation('labs')
  const { ls } = p
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  // ⛔ Écran caché muet (keepalive des onglets) : l'Échap d'un autre onglet ne ferme pas ce menu.
  const actif = useEcranActif()

  useEffect(() => {
    if (!open || !actif) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [open, actif])

  const activeAll = p.view === 'all' && p.folderId === null
  const activeFav = p.view === 'favorites'
  const courant = p.folders.find((f) => f.id === p.folderId) ?? null
  const titre = activeFav ? t('menu.favorites') : courant?.name ?? t('menu.all')
  const choisir = (fn: () => void) => { fn(); setOpen(false) }

  return (
    <div ref={wrap} style={{ position: 'relative', minWidth: 0, flex: '1 1 220px', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu.aria')}
        title={titre}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0, maxWidth: '100%',
          height: 36, padding: '0 var(--crm-space-md) 0 var(--crm-space-sm)', border: 0, borderRadius: 'var(--crm-radius-md)',
          background: open ? ls.hover : 'transparent', color: ls.ink, fontFamily: 'inherit', cursor: 'pointer', transition: LABS_TRANSITION,
        }}
      >
        <MEIcon name={activeFav ? 'star' : courant ? 'archive' : 'gallery'} size={16} color={ls.sub} />
        <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {titre}
        </span>
        <span aria-hidden="true" style={{ color: ls.soft, fontSize: 'var(--crm-text-sm)' }}>▾</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('menu.aria')}
          style={{
            position: 'absolute', left: 0, top: 'calc(100% + var(--crm-space-sm))', width: 300, zIndex: 40,
            background: ls.solid, border: `1px solid ${ls.solidBorder}`, borderRadius: 'var(--crm-radius-2xl)', boxShadow: ls.solidShadow,
            padding: 'var(--crm-space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)',
            maxHeight: 'min(70vh, 560px)',
          }}
        >
          <Row ls={ls} icon="gallery" label={t('menu.all')} count={p.totalCount} active={activeAll} onClick={() => choisir(p.onSelectAll)} />
          <Row ls={ls} icon="star" label={t('menu.favorites')} count={p.favCount} active={activeFav} onClick={() => choisir(p.onSelectFavorites)} />

          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: ls.soft, padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-2xs)' }}>
            {t('menu.folders')}
          </div>

          <div className="scrollbar-hide" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', overflowY: 'auto', minHeight: 0 }}>
            {p.isLoading && p.folders.length === 0 && (
              <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-md)', fontSize: 'var(--crm-text-sm)', color: ls.soft }}>…</div>
            )}
            {!p.isLoading && p.folders.length === 0 && (
              <div style={{ padding: 'var(--crm-space-sm) var(--crm-space-md)', fontSize: 'var(--crm-text-sm)', color: ls.soft }}>{t('menu.noFolder')}</div>
            )}
            {p.folders.map((f) => (
              <Row
                key={f.id}
                ls={ls}
                icon="archive"
                label={f.name}
                count={p.counts[f.id] ?? 0}
                active={p.view === 'all' && p.folderId === f.id}
                onClick={() => choisir(() => p.onSelectFolder(f.id))}
                actions={[
                  { icon: 'edit', label: t('menu.rename'), onClick: () => choisir(() => p.onRenameFolder(f)) },
                  { icon: 'trash', label: t('menu.delete'), onClick: () => choisir(() => p.onDeleteFolder(f)) },
                ]}
              />
            ))}
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => choisir(p.onNewFolder)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xs)',
              height: 36, border: 0, borderRadius: LABS_PILL, background: ls.accent, color: ls.accentInk,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer', transition: LABS_TRANSITION,
            }}
          >
            <MEIcon name="plus" size={14} color={ls.accentInk} />
            {t('menu.newFolder')}
          </button>

          <div style={{ borderTop: `1px solid ${ls.bord}`, marginTop: 'var(--crm-space-sm)', padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', color: ls.sub, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
            <div style={{ fontWeight: 600, color: ls.ink }}>{t('menu.quotaTitle')}</div>
            {p.quota.image === 0 && p.quota.video === 0 ? (
              <div>{t('menu.quotaNone')}</div>
            ) : (
              <>
                <div>{t('menu.quotaImages', { used: p.usage.image, quota: p.quota.image })}</div>
                <div>{t('menu.quotaVideos', { used: p.usage.video, quota: p.quota.video })}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface RowAction { icon: MEIconName; label: string; onClick: () => void }

function Row(p: { ls: LabsSurfaces; icon: MEIconName; label: string; count: number; active: boolean; onClick: () => void; actions?: RowAction[] }) {
  const [hov, setHov] = useState(false)
  const { ls } = p
  const ink = p.active ? ls.accentInk : ls.ink
  const avecActions = hov && !!p.actions?.length
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        type="button"
        role="menuitemradio"
        aria-checked={p.active}
        onClick={p.onClick}
        title={p.label}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          height: 34, padding: '0 var(--crm-space-md)', border: 0, borderRadius: 'var(--crm-radius-md)',
          background: p.active ? ls.accent : hov ? ls.hover : 'transparent',
          color: ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: p.active ? 600 : 500,
          cursor: 'pointer', textAlign: 'left', transition: LABS_TRANSITION,
        }}
      >
        <MEIcon name={p.icon} size={14} color={ink} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</span>
        {!avecActions && (
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: ink, opacity: p.active ? 0.85 : 0.6, fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
        )}
      </button>
      {avecActions && (
        <div style={{ position: 'absolute', right: 'var(--crm-space-2xs)', display: 'flex', gap: 'var(--crm-space-2xs)' }}>
          {p.actions!.map((a) => (
            <button
              key={a.label}
              type="button"
              title={a.label}
              aria-label={a.label}
              onClick={(e) => { e.stopPropagation(); a.onClick() }}
              style={{
                width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 'var(--crm-radius-sm)',
                // Le filet porte l'affordance en sombre, où `elev` vaut la carte.
                border: p.active ? 0 : `1px solid ${ls.bordDouce}`,
                background: p.active ? ls.inkVeil(0.14) : ls.elev, color: ink, cursor: 'pointer',
              }}
            >
              <MEIcon name={a.icon} size={12} color={ink} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
