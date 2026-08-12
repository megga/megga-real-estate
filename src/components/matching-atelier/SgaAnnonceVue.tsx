// Atelier Matching — vue « Annonce complète », concept IMMERSIF (variante actée).
// Photo pleine page + feuille dossier flottante à droite ; bento « chiffres »
// (valeur + clé, zéro icône) pour L'essentiel. Remplace la variante éditoriale
// (modal magazine à collage), non retenue.
//
// Choix non évidents :
//  · Montée dans un PORTAIL (SgaOverlayHost), comme les autres overlays. Le handoff
//    la voulait inline pour qu'elle épouse le bento du pager, mais sous le track
//    translaté la molette sur la photo remontait au pager et paginait vers
//    « Recherche » sans fermer la vue, et les points de page peignaient par-dessus
//    la feuille. Plein cadre = le rendu d'origine de la maquette, de toute façon.
//  · La feuille est réductible (open → folding → mini → unfolding) : l'agent peut
//    dégager la photo sans fermer la vue. Les états intermédiaires existent pour
//    laisser jouer l'animation avant de démonter le nœud.
//  · Retraits actés côté design : plus de veille marché (sparkline, jours au
//    marché, complétude), plus de carte Conditions, plus de mini-carte.
//  · « Meublé » est gaté sur `isFurnished === true` : la colonne a un DEFAULT
//    false en base, un test `!= null` afficherait « Meublé : Non » partout.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SgaIcon from './SgaIcon'
import { sgaFmtCHF } from './format'
import type { AtelierBuyer, AtelierListing } from './types'
import { useFocusTrap } from '@/hooks/useFocusTrap'

/** Cellules « L'essentiel » — les champs nuls sont filtrés, jamais rendus « null ». */
function sgiSpecCells(L: AtelierListing, t: (k: string, o?: Record<string, unknown>) => string) {
  const cells: Array<{ k: string; v: string }> = []
  if (L.rooms != null) cells.push({ k: t('atelier.specRooms'), v: `${L.rooms}` })
  if (L.area != null) cells.push({ k: t('atelier.specSurface'), v: `${L.area} m²` })
  if (L.beds != null) cells.push({ k: t('atelier.specBedrooms'), v: `${L.beds}` })
  if (L.baths != null) cells.push({ k: t('atelier.specBathrooms'), v: `${L.baths}` })
  if (L.floor != null) cells.push({ k: t('atelier.specFloor'), v: `${L.floor}ᵉ${L.lift ? t('atelier.floorLiftSuffix') : ''}` })
  if (L.year != null) cells.push({ k: t('atelier.specYear'), v: `${L.year}` })
  // gaté sur la valeur VRAIE (DEFAULT false en base — cf. en-tête)
  if (L.isFurnished) cells.push({ k: t('atelier.specFurnished'), v: t('atelier.yes') })
  if (L.photos > 0) cells.push({ k: t('atelier.specPhotos'), v: `${L.photos}` })
  return cells
}

/** Pilule référence copiable (L.ref est dérivée de la source, pas fabriquée). */
function SgiRefPill({ refCode }: { refCode: string }) {
  const { t } = useTranslation('matching')
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try { void navigator.clipboard?.writeText(refCode) } catch { /* no-op */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <button className="chip sm chip-outline nums sgn-refchip" title={t('atelier.copyRef')} onClick={copy}>
      <SgaIcon d={copied ? 'check' : 'copy'} size={11} />
      {copied ? t('atelier.refCopied') : refCode}
    </button>
  )
}

/** Régie qui commercialise — uniquement sur une annonce de la veille marché. */
function SgiAgence({ L }: { L: AtelierListing }) {
  const { t } = useTranslation('matching')
  const name = L.agency.name
  if (L.kind !== 'market' || !name) return null
  const init = name.split(/\s+/).filter(w => /^[A-ZÀ-Ž]/.test(w)).slice(0, 2).map(w => w[0]).join('') || 'R'
  return (
    <div className="sgn-card">
      <span className="eyebrow">{t('atelier.marketing')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="av" style={{ width: 42, height: 42, background: '#0B0C0E', fontSize: 13.5 }}>{init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t2 semi sgn-ell" style={{ color: 'var(--ink)' }}>{name}</div>
          {L.agency.phone && <div className="t1 muted nums" style={{ marginTop: 2 }}>{L.agency.phone}</div>}
        </div>
        {L.agency.phone && (
          <a className="btn btn-ghost btn-sm" href={`tel:${L.agency.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}>
            <SgaIcon d="phone" size={13} /> {t('common:actions.call')}
          </a>
        )}
      </div>
    </div>
  )
}

/** États de la feuille — les deux états en « -ing » laissent jouer l'animation. */
type SgiSheetState = 'open' | 'folding' | 'mini' | 'unfolding'

interface SgaAnnonceVueProps {
  L: AtelierListing
  buyer: AtelierBuyer | null
  onClose: () => void
  onPropose: (() => void) | null
}

export default function SgaAnnonceVue({ L, buyer, onClose, onPropose }: SgaAnnonceVueProps) {
  const { t } = useTranslation('matching')
  const refPiegeFocus = useFocusTrap(true, onClose)
  const G = L.gallery
  const hasImg = !!G[0]?.url

  const [idx, setIdx] = useState(0)
  const [sheet, setSheet] = useState<SgiSheetState>('open')
  const [filmOpen, setFilmOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const foldTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback((after?: () => void) => {
    if (closeTimer.current) return
    setClosing(true)
    closeTimer.current = setTimeout(after ?? onClose, 260)
  }, [onClose])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (foldTimer.current) clearTimeout(foldTimer.current)
  }, [])

  // Échap ferme. Plus de galerie au-dessus : cette vue est le dernier overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close])

  // ← / → : photo précédente / suivante
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasImg || G.length < 2) return
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setIdx(i => (i + 1) % G.length) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setIdx(i => (i - 1 + G.length) % G.length) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [hasImg, G.length])

  const fold = () => { setSheet('folding'); foldTimer.current = setTimeout(() => setSheet('mini'), 260) }
  const unfold = () => { setSheet('unfolding'); foldTimer.current = setTimeout(() => setSheet('open'), 190) }
  const propose = () => (onPropose ? close(onPropose) : close())

  const cur = G[idx] ?? G[0] ?? null
  const cells = sgiSpecCells(L, t).slice(0, 6)

  return (
    <div
      className={'sgi-stage' + (closing ? ' is-closing' : '')}
      ref={refPiegeFocus}
      role="dialog"
      aria-label={t('atelier.fullListing')}
    >
      {/* ── photo pleine page (clic = photo suivante) ── */}
      <div
        className={'sgi-photo' + (hasImg ? '' : ' noimg')}
        onClick={hasImg && G.length > 1 ? () => setIdx(i => (i + 1) % G.length) : undefined}
        title={hasImg && G.length > 1 ? t('atelier.nextPhoto') : undefined}
      >
        {hasImg && cur ? (
          <img key={idx} src={cur.url} alt={cur.label} draggable="false" />
        ) : (
          <div className="sga-ph"><div className="ph-lbl"><SgaIcon d="camera" size={30} /><span>{t('atelier.noPhotoYet')}</span></div></div>
        )}

        <div className="sgi-chrome" onClick={e => e.stopPropagation()}>
          <button className="sgi-xcircle" title={t('atelier.closeEsc')} onClick={() => close()}>
            <SgaIcon d="close" size={16} />
          </button>
          {hasImg && cur?.label && <span className="sgi-glass static">{cur.label}</span>}
        </div>

        <div className="sgi-id" onClick={e => e.stopPropagation()}>
          <h2 className="sgi-title">{L.title}</h2>
          <div className="sgi-addr">
            <SgaIcon d="location" size={15} /> {L.canton ? `${L.addr} · ${L.canton}` : L.addr}
          </div>
          {hasImg && (
            <div className="sgi-film">
              {(filmOpen ? G : G.slice(0, 4)).map((p, i) => (
                <button
                  // `xtra` = vignette apparue au dépliage : elle monte en cascade
                  // (le délai est inline, la durée et la courbe sont en CSS).
                  className={'fr' + (i === idx ? ' on' : '') + (i >= 4 ? ' xtra' : '')}
                  key={p.url + String(i)}
                  title={p.label}
                  style={i >= 4 ? { animationDelay: `${(i - 4) * 45}ms` } : undefined}
                  onClick={() => setIdx(i)}
                >
                  <img src={p.url} alt={p.label} loading="lazy" draggable="false" />
                </button>
              ))}
              {G.length > 4 && (
                <button
                  className="fr more nums"
                  title={filmOpen ? t('atelier.collapseFilmstrip') : t('atelier.allPhotos')}
                  onClick={() => setFilmOpen(v => !v)}
                >
                  {filmOpen ? <SgaIcon d="close" size={14} /> : `+${G.length - 4}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── feuille dossier (réductible) ── */}
      {sheet === 'open' || sheet === 'folding' ? (
        <aside className={'sgi-sheet' + (sheet === 'folding' ? ' is-folding' : '')}>
          <div className="sgi-sh-head">
            <div className="sgi-sh-toprow">
              <div className="chips">
                <span className="chip sm">{L.transaction}</span>
                {L.type && <span className="chip sm">{L.type}</span>}
                <SgiRefPill refCode={L.ref} />
              </div>
              <button className="sgi-fold" title={t('atelier.collapseSheet')} onClick={fold}>
                <SgaIcon d="chevron-right" size={15} />
              </button>
            </div>
            <div className="sgi-price nums">{sgaFmtCHF(L.price)}</div>
          </div>

          <div className="sgi-sh-scroll">
            {cells.length > 0 && (
              <div className="sgn-block">
                <span className="eyebrow">{t('atelier.sectionEssential')}</span>
                <div className="sgi-bento-num">
                  {cells.map(c => (
                    <div className="ncell" key={c.k}>
                      <span className="nv nums">{c.v}</span>
                      <span className="nk">{c.k}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {L.features.length > 0 && (
              <div className="sgn-block">
                <span className="eyebrow">{t('atelier.sectionFeatures')}</span>
                <div className="sgn-feats">
                  {L.features.map(f => <span className="sgn-feat" key={f}>{f}</span>)}
                </div>
              </div>
            )}
            {L.desc && (
              <div className="sgn-block">
                <span className="eyebrow">{t('atelier.sectionDescription')}</span>
                <p className="sgn-desc">{L.desc}</p>
              </div>
            )}
            <SgiAgence L={L} />
          </div>

          <div className="sgi-sh-foot">
            <button className="btn btn-ghost" onClick={() => close()}>{t('common:actions.close')}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={propose}>
              <SgaIcon d="send" size={16} />
              {buyer && onPropose ? t('atelier.proposeToBuyer', { name: buyer.first }) : t('atelier.proposeToBuyers')}
            </button>
          </div>
        </aside>
      ) : (
        <div className={'sgi-mini' + (sheet === 'unfolding' ? ' is-closing' : '')}>
          <button className="mopen" title={t('atelier.expandSheet')} onClick={unfold}>
            <SgaIcon d="chevron-right" size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="mp nums">{sgaFmtCHF(L.price)}</span>
          <button className="btn btn-primary" style={{ padding: '10px 18px', fontSize: 13.5 }} onClick={propose}>
            {t('atelier.propose')}
          </button>
        </div>
      )}
    </div>
  )
}
