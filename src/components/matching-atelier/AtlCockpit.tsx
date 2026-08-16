// Atelier Matching — cockpit « Pupitre » (handoff atelier-a-cockpit-v2.jsx,
// concept A — seule variante actée : `cockpit: "pupitre"`).
//
// Une barre, trois zones : l'ANNONCE en cours (vignette + titre + prix, cliquable
// pour changer de pivot) · la PROGRESSION de la session de triage · les FILTRES.
// Remplace l'ancien bandeau titre + onglets, qui n'offrait aucun moyen de changer
// d'annonce autrement que par deep-link `?annonce=`.
//
// Le concept B « Régie » du handoff n'est pas porté (variante non retenue), pas
// plus que la jauge à crans `SgkTicks` — définie dans la maquette mais jamais
// rendue par le code acté, qui utilise la jauge continue.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import AtlIcon from './AtlIcon'
import { SGA_TABS } from './constants'
import { atlFmtCHF } from './format'
import type { AtelierListing, AtelierPivot, AtelierTab } from './types'

/** Vignette carrée de l'annonce — repli sur une icône appareil photo si sans visuel. */
function SgkThumb({ url, size = 44, radius = 12 }: { url?: string | null; size?: number; radius?: number }) {
  return (
    <div className="sgk-thumb" style={{ width: size, height: size, borderRadius: radius }}>
      {url
        ? <img src={url} alt="" draggable="false" />
        : <AtlIcon d="camera" size={15} style={{ color: 'var(--ink-dim)' }} />}
    </div>
  )
}

/** Menu de bascule d'annonce — liste les annonces ayant des acheteurs en file. */
function SgkPivotMenu({
  pivots, currentKey, onPick, onOpenRecherche, onClose,
}: {
  pivots: AtelierPivot[]
  currentKey: string | null
  onPick: (key: string) => void
  onOpenRecherche?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('matching')
  return (
    <div role="menu" className="sgk-menu" aria-label={t('cockpit.switchAria')}>
      <div className="sgk-menu-h">
        <div className="eyebrow">{t('cockpit.switchTitle')}</div>
        <p className="sgk-menu-sub">{t('cockpit.switchHint')}</p>
      </div>
      {pivots.map(p => {
        const current = p.listing.key === currentKey
        return (
          <button
            key={p.listing.key}
            role="menuitem"
            className="sgk-menu-row"
            data-current={current}
            onClick={() => { if (!current) onPick(p.listing.key) }}
          >
            <SgkThumb url={p.listing.gallery?.[0]?.url} size={40} radius={10} />
            <div className="sgk-menu-txt">
              <div className="ttl">{p.listing.title}</div>
              <div className="meta nums">{atlFmtCHF(p.listing.price)}</div>
            </div>
            {current && (
              <span className="sgk-menu-check" aria-label={t('cockpit.currentListing')}>
                <AtlIcon d="check" size={12} sw={2.4} />
              </span>
            )}
          </button>
        )
      })}
      {onOpenRecherche && (
        <div className="sgk-menu-f">
          <button className="btn btn-ghost btn-sm" onClick={() => { onClose(); onOpenRecherche() }}>
            <AtlIcon d="search" size={14} />
            {t('cockpit.browseAll')}
          </button>
        </div>
      )}
    </div>
  )
}

export interface AtlCockpitProps {
  /** annonce pivot affichée dans la zone d'identité */
  listing: AtelierListing
  /** toutes les annonces pivots (bascule) — la bascule est masquée s'il n'y en a qu'une */
  pivots: AtelierPivot[]
  currentKey: string | null
  onPickPivot: (key: string) => void
  /** glisse le pager vers la Recherche — absent hors pager (démo, plein écran) */
  onOpenRecherche?: () => void
  /** acheteurs traités dans cette session de triage */
  done: number
  /** acheteurs de la file au départ */
  total: number
  tab: AtelierTab
  setTab: (tab: AtelierTab) => void
  countFor: (tab: AtelierTab) => number
  menuOpen: boolean
  setMenuOpen: (open: boolean | ((o: boolean) => boolean)) => void
}

/** Barre haute de l'atelier : identité de l'annonce, progression, filtres. */
export default function AtlCockpit({
  listing, pivots, currentKey, onPickPivot, onOpenRecherche,
  done, total, tab, setTab, countFor, menuOpen, setMenuOpen,
}: AtlCockpitProps) {
  const { t } = useTranslation('matching')
  const canSwitch = pivots.length > 1
  const remaining = total - done
  const pct = total ? Math.round((done / total) * 100) : 0

  // Échap ferme le menu — en capture, avant les raccourcis de triage de l'étage.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenuOpen(false) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [menuOpen, setMenuOpen])

  return (
    <div className="sgk sgk-pupitre">
      {menuOpen && <div className="sgk-veil" onClick={() => setMenuOpen(false)} />}

      <button
        type="button"
        className="sgk-id"
        data-static={!canSwitch}
        onClick={canSwitch ? () => setMenuOpen(o => !o) : undefined}
        title={canSwitch ? t('cockpit.switchTitle') : undefined}
        aria-haspopup={canSwitch ? 'menu' : undefined}
        aria-expanded={canSwitch ? menuOpen : undefined}
      >
        <SgkThumb url={listing.gallery?.[0]?.url} />
        <div className="sgk-id-txt">
          <div className="sgk-id-line">
            <span className="sgk-title">{listing.title}</span>
            {canSwitch && (
              <span className="sgk-chev" data-open={menuOpen}>
                <AtlIcon d="chevron-down" size={13} sw={2} />
              </span>
            )}
          </div>
          <div className="sgk-price nums">{atlFmtCHF(listing.price)}</div>
        </div>
      </button>

      {/* Progression — masquée tant qu'aucun acheteur n'est traité : à 0/total
          c'est du bruit, le compteur de la colonne file dit déjà le restant. */}
      {done > 0 && (
        <>
          <div className="sgk-div" />
          <div className="sgk-file" title={t('cockpit.progressAria', { done, total })}>
            {remaining > 0 ? (
              <>
                <span className="sgk-frac nums">
                  <span style={{ fontWeight: 600 }}>{done}</span><i>&nbsp;/&nbsp;{t('cockpit.processed', { total })}</i>
                </span>
                <div className="sgk-track" style={{ width: 84 }}>
                  <div className="sgk-fill" style={{ width: `${pct}%` }} />
                </div>
              </>
            ) : (
              <span className="sgk-file-done">
                <AtlIcon d="check" size={13} sw={2.4} />{t('cockpit.queueDone')}
              </span>
            )}
          </div>
        </>
      )}

      <div className="sgk-flex" />

      <div className="seg sgk-seg" role="tablist" aria-label={t('cockpit.filterAria')}>
        {SGA_TABS.map(tb => (
          <button
            key={tb.key}
            role="tab"
            aria-selected={tab === tb.key}
            className="sga-seg-btn"
            data-active={tab === tb.key}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}{tab === tb.key && <span className="cnt nums">{countFor(tb.key)}</span>}
          </button>
        ))}
      </div>

      {menuOpen && canSwitch && (
        <SgkPivotMenu
          pivots={pivots}
          currentKey={currentKey}
          onPick={key => { setMenuOpen(false); onPickPivot(key) }}
          onOpenRecherche={onOpenRecherche}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
