// Atelier Matching — COL 2 · annonce pivot, refonte « la photo devient le panneau ».
// La photo occupe tout le panneau ; titre, adresse, prix et specs sont superposés
// en bas sur un voile dégradé. Le détail complet (description, carte, atouts) vit
// désormais dans la fiche immersive : chaque zone cliquable mène à `onOpenListing`,
// la galerie n'est plus une destination depuis cette colonne.
//
// Choix non évidents :
// - photo et vignettes sont des <button> (accès clavier) plutôt que des div/role ;
//   le bloc bas est en pointer-events:none pour laisser passer le clic vers la photo.
// - pas d'effet de survol transformant (règle projet) : le survol ne change que
//   l'opacité ou le fond, jamais l'échelle ou la position.
// - annonce sans photo (`gallery` vide, cas réel des biens sans média) : voile et
//   pellicule retirés, le bloc bas repasse en encre normale via `.noimg`.

import { useTranslation } from 'react-i18next'
import AtlIcon from './AtlIcon'
import { atlFmtCHF } from './format'
import type { AtelierListing } from './types'

interface AtlListingProps {
  L: AtelierListing
  onOpenListing: () => void
}

export default function AtlListing({ L, onOpenListing }: AtlListingProps) {
  const { t } = useTranslation('matching')
  const G = L.gallery
  const hasImg = !!G[0]?.url

  // Pellicule : jusqu'à 3 vignettes après la photo de scène.
  const strip = G.slice(1, 4).filter(p => !!p.url)
  const shown = 1 + strip.length
  const remaining = Math.max(0, (L.photos || G.length) - shown)

  // Gardes nullables conservées : la maquette écrit « null pièces » sans elles.
  const specs: string[] = []
  if (L.rooms != null) specs.push(t('atelier.roomsCount', { count: L.rooms }))
  if (L.area != null) specs.push(`${L.area} m²`)
  if (L.beds != null) specs.push(t('atelier.bedsAbbr', { count: L.beds }))
  if (L.baths != null) specs.push(t('atelier.bathsAbbr', { count: L.baths }))
  if (L.year != null) specs.push(`${L.year}`)
  if (L.floor != null && L.floor > 0) specs.push(t('atelier.floorOrdinal', { floor: L.floor }))

  return (
    <section className="atl-panel atl-enter d1 atl-immersive" aria-label={t('atelier.listing')}>
      <button
        type="button"
        className={`atl-stagephoto${hasImg ? '' : ' noimg'}`}
        aria-label={t('atelier.viewFullListing')}
        onClick={onOpenListing}
      >
        {hasImg ? (
          <img className="atl-hero-img" src={G[0].url} alt={G[0].label} draggable="false" />
        ) : (
          <div className="atl-ph">
            <div className="ph-lbl"><AtlIcon d="camera" size={26} /><span>{t('atelier.noPhotoYet')}</span></div>
          </div>
        )}
      </button>

      <div className="atl-lst-top">
        <button type="button" className="atl-glasspill" title={t('atelier.viewFullListing')} onClick={onOpenListing}>
          {t('atelier.viewListing')}
        </button>
      </div>

      {strip.length > 0 && (
        <div className="atl-filmstrip">
          {strip.map((p, i) => (
            <button
              type="button"
              className="fr"
              key={p.url}
              aria-label={t('atelier.viewFullListing')}
              onClick={onOpenListing}
            >
              <img className="atl-hero-img" src={p.url} alt={p.label} draggable="false" />
              {i === strip.length - 1 && remaining > 0 && (
                <span className="more nums">{`+${remaining}`}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className={`atl-lst-bottom${hasImg ? '' : ' noimg'}`}>
        <div className="row">
          <div style={{ minWidth: 0 }}>
            <div className="ttl">{L.title}</div>
            <div className="addr"><AtlIcon d="location" size={14} /> {L.addr}</div>
          </div>
          <div className="price nums">
            <div className="v">{atlFmtCHF(L.price)}</div>
            {L.priceWas ? (
              <div className="was">{t('atelier.priceBefore')} <s>{atlFmtCHF(L.priceWas)}</s></div>
            ) : L.charges != null ? (
              <div className="was">{t('atelier.chargesPerMonth', { value: atlFmtCHF(L.charges) })}</div>
            ) : null}
          </div>
        </div>
        {specs.length > 0 && (
          <div className="gspecs">
            {specs.map(s => <span className="atl-gspec nums" key={s}>{s}</span>)}
          </div>
        )}
      </div>
    </section>
  )
}
