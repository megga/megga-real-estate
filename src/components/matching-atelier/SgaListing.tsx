// Atelier Matching — COL 2 · annonce pivot (hero photo, vignettes, prix,
// pilules specs, description, mini-carte placeholder). Port hi-fi du handoff.

import SgaIcon, { type SgaIconName } from './SgaIcon'
import { SgaPhoto } from './SgaPrimitives'
import { sgaFmtCHF } from './format'
import type { AtelierListing } from './types'

interface SgaListingProps {
  L: AtelierListing
  onOpenPhoto: (index: number) => void
  onOpenListing: () => void
}

export default function SgaListing({ L, onOpenPhoto, onOpenListing }: SgaListingProps) {
  const G = L.gallery
  const specs: Array<{ i: SgaIconName; t: string }> = []
  if (L.rooms != null) specs.push({ i: 'home', t: `${L.rooms} pièces` })
  if (L.area != null) specs.push({ i: 'surface', t: `${L.area} m²` })
  if (L.beds != null) specs.push({ i: 'bed', t: `${L.beds} ch.` })
  if (L.baths != null) specs.push({ i: 'bath', t: `${L.baths} sdb` })
  if (L.year != null) specs.push({ i: 'calendar', t: `${L.year}` })
  if (L.floor != null && L.floor > 0) specs.push({ i: 'lift', t: `${L.floor}ᵉ étage` })

  return (
    <section className="sga-panel sga-enter d1" aria-label="Annonce">
      <div className="sga-listing-scroll">
        <div className="sga-hero sga-photo-trigger" onClick={() => onOpenPhoto(0)}>
          {G[0]?.url ? (
            <img className="sga-hero-img" src={G[0].url} alt={G[0].label} draggable="false" />
          ) : (
            <div className="sga-ph">
              <div className="ph-lbl"><SgaIcon d="camera" size={26} /><span>photo principale</span></div>
            </div>
          )}
          <button
            className="sga-hero-cta"
            title="Voir l'annonce complète"
            onClick={e => { e.stopPropagation(); onOpenListing() }}
          >
            Voir l'annonce
          </button>
          <div className="count"><SgaIcon d="layers" size={13} /> {L.photos} photos</div>
          <div className="sga-zoomcue"><SgaIcon d="search" size={13} /> Ouvrir la galerie</div>
        </div>

        <div className="sga-thumbs">
          {[1, 2, 3].map(n => (
            <div className="sga-thumb sga-photo-trigger" key={n} onClick={() => onOpenPhoto(n)}>
              {G[n]?.url ? (
                <img className="sga-hero-img" src={G[n].url} alt={G[n].label} draggable="false" />
              ) : (
                <div className="sga-ph" />
              )}
            </div>
          ))}
          <div className="sga-thumb sga-photo-trigger" onClick={() => onOpenPhoto(4)}>
            {G[4]?.url ? (
              <img className="sga-hero-img dim" src={G[4].url} alt={G[4].label} draggable="false" />
            ) : (
              <div className="sga-ph" />
            )}
            {L.photos > 3 && <div className="more nums">{`+${L.photos - 3}`}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div className="t5 semi" style={{ marginBottom: 5, color: 'var(--ink)' }}>{L.title}</div>
            <div className="t2 muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SgaIcon d="location" size={15} /> {L.addr}
            </div>
            <div className="t1 dim nums" style={{ marginTop: 6 }}>{L.ref}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>
            <div className="t5 semi nums" style={{ color: 'var(--ink)' }}>{sgaFmtCHF(L.price)}</div>
            {L.priceWas ? (
              <div className="t1 dim nums" style={{ textDecoration: 'line-through' }}>{sgaFmtCHF(L.priceWas)}</div>
            ) : L.charges != null ? (
              <div className="t1 dim nums">+ {sgaFmtCHF(L.charges)} charges / mois</div>
            ) : null}
          </div>
        </div>

        {specs.length > 0 && (
          <div className="sga-specs">
            {specs.map(s => (
              <span className="sga-spec" key={s.t}><SgaIcon d={s.i} size={15} /> {s.t}</span>
            ))}
          </div>
        )}

        {L.desc && <div className="sga-desc">{L.desc}</div>}

        <SgaPhoto
          className="sga-map"
          label={`mini-carte · quartier ${L.quartier || L.canton}`}
          icon="location"
          iconSize={20}
          style={{ flex: 1 }}
        />
      </div>
    </section>
  )
}
