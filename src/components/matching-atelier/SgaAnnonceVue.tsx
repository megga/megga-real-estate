// Atelier Matching — modal « Annonce complète » (hi-fi, handoff §6.5).
// Collage photo éditorial + caractéristiques + atouts + description à gauche ;
// rail sticky Prix / Veille marché / Commercialisation à droite. Les cartes
// Veille marché et Commercialisation n'apparaissent que pour les annonces de
// la veille (kind='market') — un bien interne n'a pas ces données.
// AUCUNE mention du portail source dans l'UI.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import SgaIcon from './SgaIcon'
import { sgaDateLong, sgaDateShort, sgaFmtCHF } from './format'
import SgaMiniMap from './SgaMiniMap'
import type { AtelierBuyer, AtelierListing } from './types'

/* ── collage photo éditorial (1 hero + 2 tuiles, labels de pièce) ──────── */
function SgvCollage({ L, onOpenPhoto }: { L: AtelierListing; onOpenPhoto: (i: number) => void }) {
  const G = L.gallery
  const rest = Math.max(0, (L.photos || G.length) - 3)
  const tile = (i: number, extra?: 'more') => (
    <div className={'sgv-cphoto' + (extra ? ` ${extra}` : '')} key={i} onClick={() => onOpenPhoto(i)}>
      {G[i]?.url ? (
        <img src={G[i].url} alt={G[i].label} loading="lazy" draggable="false" />
      ) : (
        <div className="sga-ph"><div className="ph-lbl"><SgaIcon d="camera" size={20} /></div></div>
      )}
      {G[i] && extra !== 'more' && <span className="cap">{G[i].label}</span>}
      {extra === 'more' && rest > 0 && (
        <div className="rest">
          <SgaIcon d="layers" size={18} />
          <span className="nums">+{rest} photos</span>
        </div>
      )}
    </div>
  )
  return (
    <div className="sgv-collage" aria-label={`${L.photos} photos — ouvrir la galerie`}>
      <div className="sgv-cphoto main" onClick={() => onOpenPhoto(0)}>
        {G[0]?.url ? (
          <img src={G[0].url} alt={G[0].label} draggable="false" />
        ) : (
          <div className="sga-ph"><div className="ph-lbl"><SgaIcon d="camera" size={26} /><span>photo principale</span></div></div>
        )}
        {G[0] && <span className="cap">{G[0].label}</span>}
        <div className="sga-zoomcue"><SgaIcon d="search" size={13} /> Ouvrir la galerie</div>
      </div>
      {tile(1)}
      {tile(2, 'more')}
    </div>
  )
}

function SgvSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className="eyebrow">{title}</span>
      </div>
      {children}
    </div>
  )
}

function SgvPriceCard({ L }: { L: AtelierListing }) {
  const drop = L.priceWas ? L.priceWas - L.price : 0
  return (
    <div className="sgv-card">
      <span className="eyebrow">Prix de {L.transaction === 'Vente' ? 'vente' : 'location'}</span>
      <div className="sgv-price nums">{sgaFmtCHF(L.price)}</div>
      {drop > 0 && (
        <div className="sgv-delta">
          <span className="t1 dim nums" style={{ textDecoration: 'line-through' }}>{sgaFmtCHF(L.priceWas)}</span>
        </div>
      )}
      <div className="sgv-rows">
        {L.pricePerM2 != null && (
          <div className="sgv-row">
            <span className="ic"><SgaIcon d="surface" size={14} /></span>
            <span className="lb">Prix au m²</span>
            <span className="vl nums">{sgaFmtCHF(Math.round(L.pricePerM2))}</span>
          </div>
        )}
        {L.charges != null && (
          <div className="sgv-row">
            <span className="ic"><SgaIcon d="tag" size={14} /></span>
            <span className="lb">Charges mensuelles</span>
            <span className="vl nums">{sgaFmtCHF(L.charges)} / mois</span>
          </div>
        )}
        {drop > 0 && (
          <div className="sgv-row">
            <span className="ic"><SgaIcon d="trend-down" size={14} /></span>
            <span className="lb">Baisse constatée</span>
            <span className="vl nums">−{sgaFmtCHF(drop)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SgvSpecs({ L }: { L: AtelierListing }) {
  const cells: Array<{ d: Parameters<typeof SgaIcon>[0]['d']; k: string; v: string }> = []
  if (L.rooms != null) cells.push({ d: 'home', k: 'Pièces', v: `${L.rooms}` })
  if (L.area != null) cells.push({ d: 'surface', k: 'Surface', v: `${L.area} m²` })
  if (L.beds != null) cells.push({ d: 'bed', k: 'Chambres', v: `${L.beds}` })
  if (L.baths != null) cells.push({ d: 'bath', k: "Salles d'eau", v: `${L.baths}` })
  if (L.floor != null) cells.push({ d: 'lift', k: 'Étage', v: `${L.floor}ᵉ${L.lift ? ' · asc.' : ''}` })
  if (L.year != null) cells.push({ d: 'calendar', k: 'Année', v: `${L.year}` })
  if (L.kind === 'market') cells.push({ d: 'layers', k: 'Meublé', v: L.isFurnished ? 'Oui' : 'Non' })
  cells.push({ d: 'camera', k: 'Photos', v: `${L.photos}` })
  return (
    <SgvSection title="Caractéristiques">
      <div className="sgv-specgrid">
        {cells.map(c => (
          <div className="sgv-speccell" key={c.k}>
            <SgaIcon d={c.d} size={16} />
            <span className="k">{c.k}</span>
            <span className="v nums">{c.v}</span>
          </div>
        ))}
      </div>
    </SgvSection>
  )
}

/* sparkline 2 segments : prix stable puis baisse (ligne plate si stable) */
function SgvSpark({ L }: { L: AtelierListing }) {
  const drop = L.priceWas ? L.priceWas - L.price : 0
  const pts = drop > 0 ? '2,7 56,7 97,18' : '2,13 97,13'
  const end = drop > 0 ? [97, 18] : [97, 13]
  const start = drop > 0 ? [2, 7] : [2, 13]
  return (
    <div className="sgv-spark">
      <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={start[0]} cy={start[1]} r="2.4" fill="currentColor" />
        <circle cx={end[0]} cy={end[1]} r="2.4" fill="currentColor" />
      </svg>
      <div className="lbls">
        {L.firstSeenAt && <span className="nums">{sgaDateShort(L.firstSeenAt)} · {sgaFmtCHF(L.priceWas ?? L.price)}</span>}
        <span className="nums now">Aujourd'hui · {sgaFmtCHF(L.price)}</span>
      </div>
    </div>
  )
}

function SgvMarket({ L }: { L: AtelierListing }) {
  return (
    <div className="sgv-card">
      <span className="eyebrow">Veille marché</span>
      <SgvSpark L={L} />
      <div className="sgv-rows">
        {L.daysOnMarket != null && (
          <div className="sgv-row">
            <span className="ic"><SgaIcon d="clock" size={14} /></span>
            <span className="lb">Sur le marché</span>
            <span className="vl nums">{L.daysOnMarket} jours</span>
          </div>
        )}
        {L.firstSeenAt && (
          <div className="sgv-row">
            <span className="ic"><SgaIcon d="calendar" size={14} /></span>
            <span className="lb">Première détection</span>
            <span className="vl nums">{sgaDateLong(L.firstSeenAt)}</span>
          </div>
        )}
        <div className="sgv-row">
          <span className="ic"><SgaIcon d="camera" size={14} /></span>
          <span className="lb">Photos collectées</span>
          <span className="vl nums">{L.photos}</span>
        </div>
      </div>
      {L.qualityScore != null && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span className="t1 semi" style={{ color: 'var(--ink)' }}>Complétude du dossier</span>
            <span className="t1 dim nums">{L.qualityScore}/100</span>
          </div>
          <div className="sgv-qgauge"><i style={{ width: `${L.qualityScore}%` }} /></div>
          <div className="t1 muted" style={{ marginTop: 7 }}>Prix, surface, photos et localisation vérifiés.</div>
        </div>
      )}
    </div>
  )
}

function SgvAgency({ L }: { L: AtelierListing }) {
  const name = L.agency.name ?? '—'
  const init = name.split(/\s+/).filter(w => /^[A-ZÀ-Ž]/.test(w)).slice(0, 2).map(w => w[0]).join('') || 'R'
  return (
    <div className="sgv-card">
      <span className="eyebrow">Commercialisation</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="av" style={{ width: 44, height: 44, background: '#0B0C0E', fontSize: 14 }}>{init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t2 semi" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          {L.agency.phone && <div className="t1 muted nums" style={{ marginTop: 2 }}>{L.agency.phone}</div>}
        </div>
        {L.agency.phone && (
          <a className="btn btn-ghost btn-sm" href={`tel:${L.agency.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}>
            <SgaIcon d="phone" size={13} /> Appeler
          </a>
        )}
      </div>
      <div className="t1 muted">Coordonnées vérifiées par la veille marché.</div>
    </div>
  )
}

/* ════════════════ Modal « Annonce complète » ════════════════ */
interface SgaAnnonceVueProps {
  L: AtelierListing
  buyer: AtelierBuyer | null
  keysOff: boolean
  dark: boolean
  onClose: () => void
  onPropose: (() => void) | null
  onOpenPhoto: (i: number) => void
}

export default function SgaAnnonceVue({ L, buyer, keysOff, dark, onClose, onPropose, onOpenPhoto }: SgaAnnonceVueProps) {
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    if (closeTimer.current) return
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 230)
  }, [onClose])

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keysOff) return // la galerie ouverte au-dessus gère ses propres touches
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [keysOff, close])

  const copyRef = () => {
    try { void navigator.clipboard?.writeText(L.ref) } catch { /* no-op */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div
      className={'sga-overlay sgv-wrap' + (closing ? ' is-closing' : '')}
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="sgv-modal" role="dialog" aria-label="Annonce complète">
        {/* ── en-tête ── */}
        <div className="sgv-mo-head">
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="sgv-eyebrow-row">
              <button className="chip sm chip-outline nums sgv-ref" title="Copier la référence" onClick={copyRef}>
                <SgaIcon d={copied ? 'check' : 'copy'} size={11} />
                {copied ? 'Référence copiée' : L.ref}
              </button>
            </div>
            <div className="sgv-title">{L.title}</div>
            <div className="t2 muted" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <SgaIcon d="location" size={15} /> {L.addr} · {L.canton}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span className="chip sm">{L.transaction}</span>
              <span className="chip sm">{L.type}</span>
            </div>
          </div>
          <button className="btn circle" style={{ width: 40, minWidth: 40, height: 40 }} title="Fermer (Échap)" onClick={close}>
            <SgaIcon d="close" size={16} />
          </button>
        </div>

        {/* ── corps : contenu + rail sticky ── */}
        <div className="sgv-mo-scroll">
          <div className="sgv-mo-grid">
            <div className="col">
              <SgvCollage L={L} onOpenPhoto={onOpenPhoto} />
              <SgvSpecs L={L} />
              {L.features.length > 0 && (
                <SgvSection title="Atouts">
                  <div className="sga-specs">
                    {L.features.map(f => (
                      <span className="sga-spec" key={f}><SgaIcon d="check" size={14} /> {f}</span>
                    ))}
                  </div>
                </SgvSection>
              )}
              {L.desc && (
                <SgvSection title="Description">
                  <div className="sga-desc" style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{L.desc}</div>
                </SgvSection>
              )}
              <SgvSection title="Localisation">
                <SgaMiniMap lat={L.lat} lng={L.lng} address={L.addr} label={L.addr} dark={dark} className="sgv-map" />
              </SgvSection>
            </div>
            <div className="col side">
              <SgvPriceCard L={L} />
              {L.kind === 'market' && <SgvMarket L={L} />}
              {L.kind === 'market' && L.agency.name && <SgvAgency L={L} />}
            </div>
          </div>
        </div>

        {/* ── pied ── */}
        <div className="sgv-foot">
          <span style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={close}>Fermer</button>
          <button
            className="btn btn-primary"
            onClick={onPropose ? () => {
              if (closeTimer.current) return
              setClosing(true)
              closeTimer.current = setTimeout(onPropose, 230)
            } : close}
          >
            <SgaIcon d="send" size={16} /> {buyer && onPropose ? `Proposer à ${buyer.first}` : 'Proposer aux acheteurs'}
          </button>
        </div>
      </div>
    </div>
  )
}
