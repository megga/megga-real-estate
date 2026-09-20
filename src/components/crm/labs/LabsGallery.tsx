/**
 * La galerie du studio : colonnes CSS (masonry sans bibliothèque), une vignette par
 * production — image, photo importée, vidéo prête, vidéo en cours, échec — et les
 * gestes de survol (cocher, favori, ranger, refaire, animer, source, télécharger).
 *
 * ⚠ La hauteur d'une vignette vient de ce qu'on SAIT de l'image (largeur/hauteur,
 * sinon le ratio demandé) : la grille se pose avant que les octets n'arrivent, et ne
 * saute pas quand ils arrivent.
 *
 * ⚠ COLONNES ÉQUILIBRÉES, pas `column-count` : le CSS multi-colonnes remplit en flux
 * et laisse la dernière colonne à moitié vide (mesuré : 527 / 532 / 493 / 282 px).
 * `labsColonnes` place chaque tuile dans la plus courte — la règle vit là, éprouvée.
 *
 * ⚠ MOSAÏQUE COLLÉE, SANS RAYON (Julien, 20.09.2026 : « enlever les coins arrondis
 * dans les images ou vidéos générées, et l'espace vide entre les photos et vidéos »).
 * Les `0` sont des RESETS, pas des barreaux manquants — le cliquet de grammaire les
 * exclut nommément. ⛔ Et le survol perd son ombre avec eux : entre deux tuiles
 * jointives elle baverait sur la voisine. Le voile et les boutons portent seuls le
 * survol, comme dans la référence.
 *
 * ── LE CLIC A DEUX SENS, ET C'EST LE MODE QUI TRANCHE ────────────────────────
 * Hors sélection, cliquer une tuile l'OUVRE. Dès qu'une production est cochée, le
 * même clic COCHE — et plus rien ne s'ouvre au clic simple. C'est ce que font le
 * Finder et Google Photos, et c'est la seule façon de cocher douze tuiles sans viser
 * douze fois une case de 20 px. La croix de la barre de gestes rend le clic à
 * l'ouverture. ⚠ Maj+clic prend une PLAGE dans l'ordre de la liste (cf. `labsPlage`),
 * pas dans l'ordre visuel des colonnes, qui n'est écrit nulle part.
 */
import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import EtatVide from '@/components/crm/EtatVide'
import { labsAssetRatioPercent, labsColonnes, labsEstLocale, labsRelativeTime } from '@/lib/labs'
import type { LabsAsset } from '@/types/labs'
import { LABS_PILL, LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

export type LabsEmptyKind = 'all' | 'folder' | 'favorites' | 'filter' | 'search'

/** Ce que le clic rapporte à l'orchestrateur : sans lui, pas de plage ni d'addition. */
export interface LabsClicModif { shift: boolean; meta: boolean }

interface Props {
  ls: LabsSurfaces
  dark: boolean
  assets: LabsAsset[]
  cols: number
  isLoading: boolean
  isError: boolean
  emptyKind: LabsEmptyKind
  lang: string
  selection: Set<string>
  selectionActive: boolean
  onRetry: () => void
  onOpen: (index: number) => void
  onToggle: (id: string, mod: LabsClicModif) => void
  onFavorite: (a: LabsAsset) => void
  onAnimate: (a: LabsAsset) => void
  onUseSource: (a: LabsAsset) => void
  onDownload: (a: LabsAsset) => void
  onRanger: (a: LabsAsset, ancre: DOMRect) => void
  onRefaire: (a: LabsAsset) => void
}

export function LabsGallery(p: Props) {
  const { t } = useTranslation('labs')
  const { ls } = p

  if (p.isError) {
    return (
      <Centre>
        <EtatVide
          glyphe={<MEIcon name="alert" size={22} />}
          titre={t('error.title')}
          corps={t('error.body')}
          registre="erreur"
          action={{ libelle: t('error.retry'), onClick: p.onRetry }}
          dark={p.dark}
        />
      </Centre>
    )
  }

  if (p.isLoading && p.assets.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {Array.from({ length: p.cols }).map((_, c) => (
          <div key={c} style={{ flex: 1, minWidth: 0 }}>
            {[120, 80, 100, 130].map((ar, i) => (
              // ⚠ `hover` (s1) et non `elev` : en sombre `elev` vaut la carte, et le
              // squelette ne se verrait pas. Un placeholder est un ÉTAT, pas une surface.
              <div key={i} style={{ borderRadius: 0, background: ls.hover, opacity: (c + i) % 2 ? 0.45 : 0.6 }}>
                <div style={{ paddingBottom: `${ar}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (p.assets.length === 0) {
    const cle = p.emptyKind === 'folder' ? 'folder'
      : p.emptyKind === 'favorites' ? 'fav'
      : p.emptyKind === 'search' ? 'search'
      : p.emptyKind === 'filter' ? 'filter' : 'all'
    return (
      <Centre>
        <EtatVide
          glyphe={<MEIcon name={p.emptyKind === 'search' ? 'search' : 'sparkle'} size={22} />}
          titre={t(`empty.${cle}Title`)}
          corps={t(`empty.${cle}Body`)}
          registre="neutre"
          dark={p.dark}
        />
      </Centre>
    )
  }

  // ⚠ L'index d'ouverture reste celui de la LISTE, pas de la colonne : la visionneuse
  // navigue dans l'ordre chronologique, que le placement en colonnes ne doit pas trahir.
  const rang = new Map(p.assets.map((a, i) => [a.id, i]))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {labsColonnes(p.assets, p.cols).map((colonne, c) => (
        <div key={c} style={{ flex: 1, minWidth: 0 }}>
          {colonne.map((a) => (
            <Thumb
              key={a.id}
              ls={ls}
              asset={a}
              lang={p.lang}
              coche={p.selection.has(a.id)}
              selectionActive={p.selectionActive}
              onOpen={() => p.onOpen(rang.get(a.id) ?? 0)}
              onToggle={(mod) => p.onToggle(a.id, mod)}
              onFavorite={() => p.onFavorite(a)}
              onAnimate={() => p.onAnimate(a)}
              onUseSource={() => p.onUseSource(a)}
              onDownload={() => p.onDownload(a)}
              onRanger={(r) => p.onRanger(a, r)}
              onRefaire={() => p.onRefaire(a)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Centre({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '60%', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-7xl)' }}>{children}</div>
}

function Thumb(p: {
  ls: LabsSurfaces
  asset: LabsAsset
  lang: string
  coche: boolean
  selectionActive: boolean
  onOpen: () => void
  onToggle: (mod: LabsClicModif) => void
  onFavorite: () => void
  onAnimate: () => void
  onUseSource: () => void
  onDownload: () => void
  onRanger: (ancre: DOMRect) => void
  onRefaire: () => void
}) {
  const { t } = useTranslation('labs')
  const { ls, asset: a } = p
  const [hov, setHov] = useState(false)
  const enCours = a.status === 'generating' || a.status === 'pending'
  const echec = a.status === 'failed'
  // Une tuile LOCALE n'existe pas encore en base : rien à cocher, rien à ouvrir.
  const locale = labsEstLocale(a.id)
  const cochable = !locale
  const ratio = labsAssetRatioPercent(a)
  const src = a.kind === 'video' ? a.thumbnailUrl : (a.thumbnailUrl ?? a.url)

  const actions: { icon: MEIconName; label: string; onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void; on?: boolean }[] = []
  if (!locale) {
    // ⛔ REFAIRE MARCHE AUSSI SUR UN ÉCHEC — c'est même sa première raison d'être : la
    // réponse naturelle à « Échec » est de relancer, et elle demandait jusqu'ici
    // d'ouvrir la production ratée pour en recopier le prompt.
    if (a.prompt && a.kind !== 'video' && !enCours) {
      actions.push({ icon: 'refresh', label: t('thumb.redo'), onClick: p.onRefaire })
    }
    if (!enCours && !echec) {
      actions.push({ icon: 'star', label: a.isFavorite ? t('thumb.unfavorite') : t('thumb.favorite'), onClick: p.onFavorite, on: a.isFavorite })
      actions.push({
        icon: 'archive',
        label: t('thumb.move'),
        onClick: (e) => p.onRanger(e.currentTarget.getBoundingClientRect()),
      })
      if (a.kind !== 'video') {
        actions.push({ icon: 'play', label: t('thumb.animate'), onClick: p.onAnimate })
        actions.push({ icon: 'gallery', label: t('thumb.useSource'), onClick: p.onUseSource })
      }
      if (a.url) actions.push({ icon: 'download', label: t('thumb.download'), onClick: p.onDownload })
    }
  }

  const cliquer = (e: ReactMouseEvent) => {
    if (!cochable) return
    if (p.selectionActive || e.shiftKey || e.metaKey || e.ctrlKey) {
      p.onToggle({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey })
      return
    }
    p.onOpen()
  }

  return (
    <div
      role="button"
      tabIndex={locale ? -1 : 0}
      aria-label={a.prompt ?? t(`kind.${a.kind}`)}
      aria-pressed={p.selectionActive ? p.coche : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={cliquer}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cliquer(e as unknown as ReactMouseEvent) } }}
      style={{
        marginBottom: 0, position: 'relative', overflow: 'hidden', display: 'block',
        borderRadius: 0, background: ls.hover, cursor: locale ? 'default' : 'pointer', outline: 'none',
      }}
    >
      <div style={{ position: 'relative', paddingBottom: `${ratio}%` }}>
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            draggable={false}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: enCours ? 'blur(6px) brightness(.85)' : echec ? 'grayscale(1) brightness(.6)' : 'none',
              transform: enCours ? 'scale(1.04)' : 'none',
            }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: ls.soft }}>
            <MEIcon name={echec ? 'alert' : a.kind === 'video' ? 'play' : 'gallery'} size={22} color={ls.soft} />
          </div>
        )}

        {/* Voile bas : lisibilité des pilules. Un voile qui ASSOMBRIT, jamais le voile d'encre. */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(180deg, transparent 55%, ${ls.photoVeil(0.55)} 100%)`,
            opacity: hov || enCours || echec ? 1 : 0, transition: 'opacity .16s',
          }}
        />

        {/* ⚠ LA COCHÉE EST VOILÉE D'ACCENT, et pas seulement marquée d'une case : sur une
            mosaïque collée où rien ne sépare deux tuiles, un petit signe dans un coin se
            perd. Le voile se lit à un mètre, c'est lui qui dit « ces douze-là ». */}
        {p.coche && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: ls.accent, opacity: 0.28 }} />
        )}

        {cochable && (hov || p.selectionActive || p.coche) && (
          <button
            type="button"
            role="checkbox"
            aria-checked={p.coche}
            aria-label={p.coche ? t('selection.uncheck') : t('selection.check')}
            title={p.coche ? t('selection.uncheck') : t('selection.check')}
            onClick={(e) => { e.stopPropagation(); p.onToggle({ shift: e.shiftKey, meta: e.metaKey || e.ctrlKey }) }}
            style={{
              position: 'absolute', left: 'var(--crm-space-sm)', top: 'var(--crm-space-sm)',
              width: 22, height: 22, display: 'grid', placeItems: 'center', borderRadius: 'var(--crm-radius-xs)',
              border: p.coche ? 0 : `1px solid ${ls.onPhoto}`,
              background: p.coche ? ls.accent : ls.photoVeil(0.4), color: p.coche ? ls.accentInk : ls.onPhoto,
              backdropFilter: 'blur(6px)', cursor: 'pointer', padding: 0, transition: LABS_TRANSITION,
            }}
          >
            {p.coche && <MEIcon name="check" size={12} color={ls.accentInk} />}
          </button>
        )}

        {a.kind === 'video' && !enCours && !echec && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
              width: 40, height: 40, borderRadius: LABS_PILL, display: 'grid', placeItems: 'center',
              background: ls.photoVeil(0.55), backdropFilter: 'blur(6px)',
            }}
          >
            <MEIcon name="play" size={16} color={ls.onPhoto} />
          </div>
        )}

        {enCours && (
          <Badge ls={ls} style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <span className="labs-spin" aria-hidden="true" />
            {t(`status.${a.status}`)}
          </Badge>
        )}
        {echec && (
          <Badge ls={ls} style={{ left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            {t('status.failed')}
          </Badge>
        )}

        <Badge ls={ls} style={{ left: 'var(--crm-space-sm)', bottom: 'var(--crm-space-sm)', opacity: hov || a.kind === 'video' ? 1 : 0 }}>
          {t(`kind.${a.kind}`)}{a.kind === 'video' && a.durationS ? ` · ${Math.round(a.durationS)} s` : ''}
        </Badge>
        <Badge ls={ls} style={{ right: 'var(--crm-space-sm)', bottom: 'var(--crm-space-sm)', opacity: hov ? 1 : 0 }}>
          {labsRelativeTime(a.createdAt, p.lang)}
        </Badge>

        {actions.length > 0 && (
          <div
            style={{
              position: 'absolute', right: 'var(--crm-space-sm)', top: 'var(--crm-space-sm)',
              display: 'flex', gap: 'var(--crm-space-2xs)', opacity: hov || a.isFavorite ? 1 : 0, transition: 'opacity .16s',
            }}
          >
            {actions.map((ac) => (
              <button
                key={ac.label}
                type="button"
                title={ac.label}
                aria-label={ac.label}
                aria-pressed={ac.on}
                onClick={(e) => { e.stopPropagation(); ac.onClick(e) }}
                style={{
                  width: 28, height: 28, display: (hov || ac.on) ? 'grid' : 'none', placeItems: 'center', border: 0, borderRadius: LABS_PILL,
                  background: ac.on ? ls.accent : ls.photoVeil(0.6), color: ac.on ? ls.accentInk : ls.onPhoto,
                  backdropFilter: 'blur(6px)', cursor: 'pointer', transition: LABS_TRANSITION,
                }}
              >
                <MEIcon name={ac.icon} size={12} color={ac.on ? ls.accentInk : ls.onPhoto} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Badge({ ls, style, children }: { ls: LabsSurfaces; style?: CSSProperties; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
        padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-sm)',
        background: ls.photoVeil(0.62), color: ls.onPhoto, fontSize: 'var(--crm-text-xs)', fontWeight: 500,
        backdropFilter: 'blur(6px)', pointerEvents: 'none', whiteSpace: 'nowrap', transition: 'opacity .16s',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
