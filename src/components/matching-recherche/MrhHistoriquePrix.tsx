/**
 * Matching · Recherche — l'historique du prix d'une annonce du marché : jours sur le marché, nombre de
 * changements, écart au premier prix de la série, la courbe, puis la liste des événements.
 *
 * Monté par la fiche de la Recherche (`MrhExtDetail`) et par la fiche autonome
 * (`ExternalListingDetailPage`) : une lecture (`useHistoriquePrix`), un rendu.
 *
 * ⚠ L'HISTORIQUE COMMENCE À LA MISE EN SERVICE (21.09.2026) — cf. `pige.ts`. L'écart se dit « depuis la
 * première détection » seulement si le premier PRIX de la série est celui de son apparition ; sinon
 * « depuis le {date} » de ce prix. Une apparition est datée à la détection par la collecte, jamais à la
 * publication : le dire autrement ferait passer un passage de la collecte pour une mise en ligne.
 * ⚠ UNE BAISSE D'AVANT LE SUIVI ne se dit pas « 0 changement · écart 0,0 % » sous une affiche qui porte
 * « −10 % » : sans changement depuis, les deux indicateurs cèdent la place à « Suivi depuis le … », qui dit
 * la baisse antérieure avec l'arrondi de l'affiche (`ecartPct`).
 * ⚠ Les jours sur le marché se lisent dans `first_seen_at` (`bien.enLigneDepuis`), pas dans
 * `days_on_market`, que RealAdvisor n'écrit jamais.
 * ⚠ Un prix absent ou nul (`prix` : affiché ou retiré, 0 ↔ X) se dit « prix sur demande », comme le prix
 * de la fiche : `formatCHF` rendrait « CHF — » ou « CHF 0 ».
 * ⚠ SVG à la main : un escalier de quelques points ne demande pas de librairie de graphiques.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { useHistoriquePrix } from '@/hooks/usePige'
import { formatCHF, formatDate } from '@/lib/utils'
import { mrhPriceDropInk } from './mrhCtx'
import { formaterPct, resumerHistorique, tracerCourbe, type GenrePoint, type PointPrix } from './pige'
import type { MrhBien } from './types'

/** Cadre du tracé en unités du viewBox ; l'SVG garde ses proportions et suit la largeur de la fiche. */
const LARGEUR = 600
const HAUTEUR = 120

interface Props {
  bien: MrhBien
  sp: CrmPalette
  dark: boolean
  /** Pose le titre de section, quand l'hôte n'en a pas (fiche autonome). */
  avecTitre?: boolean
  /** Banc : les points fournis au lieu d'être lus ; aucune requête ne part. */
  pointsDemo?: PointPrix[]
}

/** L'historique du prix d'une annonce : indicateurs, courbe en escalier, liste des événements. */
export default function MrhHistoriquePrix({ bien, sp, dark, avecTitre = false, pointsDemo }: Props) {
  const { t, i18n } = useTranslation('matching')
  const live = useHistoriquePrix(pointsDemo ? null : bien.id)
  // Horloge figée au montage (idiome de `BpTopGallery`) : la courbe s'arrête à l'ouverture de la fiche.
  const [maintenant] = useState(() => Date.now())

  const titre = avecTitre ? (
    <h3 style={{ margin: '0 0 var(--crm-space-lg)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{t('recherche.historique.titre')}</h3>
  ) : null
  const message = (texte: string) => (
    <div>{titre}<div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{texte}</div></div>
  )

  if (!pointsDemo && live.isPending) {
    // Requête désactivée (pas de session) : rien à affirmer. En vol : place réservée, hauteur du tracé.
    if (live.fetchStatus !== 'fetching') return null
    return <div>{titre}<div aria-hidden="true" style={{ height: HAUTEUR, borderRadius: 'var(--crm-radius-lg)', background: sp.cardSubBg }} /></div>
  }
  if (!pointsDemo && live.isError) return message(t('recherche.historique.erreur'))

  const points = pointsDemo ?? live.data?.points ?? []
  const tronque = !pointsDemo && (live.data?.tronque ?? false)
  if (!points.length) return message(t('recherche.historique.vide'))

  const loyer = bien.transaction === 'location'
  const prixActuel = loyer ? bien.rent : bien.price
  const fin = bien.retireeLe ? Date.parse(bien.retireeLe) : maintenant
  const r = resumerHistorique(points, { enLigneDepuis: bien.enLigneDepuis, retireeLe: bien.retireeLe, prixActuel, prixOriginal: bien.price_original }, maintenant)
  const courbe = tracerCourbe(points, LARGEUR, HAUTEUR, fin)
  const encreBaisse = mrhPriceDropInk(dark)
  const chf = (v: number | null) => (v ? `${formatCHF(v)}${loyer ? ' ' + t('recherche.card.perMonth') : ''}` : t('recherche.detail.priceOnRequest'))
  const genre = (g: GenrePoint) => t(`recherche.historique.genre.${g}`)

  const kpi = (libelle: string, valeur: string, note: string | null, encre = sp.ink) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.sub }}>{libelle}</div>
      <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: encre, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>{valeur}</div>
      {note && <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>{note}</div>}
    </div>
  )

  const jours = r.joursSurMarche == null ? null
    : r.joursSurMarche === 0 ? t('recherche.historique.moinsUnJour')
      : t('recherche.historique.jours', { count: r.joursSurMarche })
  const depuis = r.refEcart == null ? null
    : r.refEcart.detection ? t('recherche.historique.depuisDetection')
      : t('recherche.historique.depuisDate', { date: formatDate(r.refEcart.quand) })
  // Déjà en baisse au début du suivi, et rien depuis : les deux indicateurs du suivi diraient « 0 » et
  // « 0,0 % » sous le prix barré de l'affiche. On dit d'où part l'historique, et ce qui l'a précédé.
  const baisseAvant = r.avantSuivi != null && r.debut ? { debut: r.debut.quand, pct: r.avantSuivi } : null
  const indicateursDuSuivi = !baisseAvant || r.changements > 0

  return (
    <div>
      {titre}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--crm-space-2xl) var(--crm-space-6xl)' }}>
        {jours && kpi(t('recherche.historique.surMarche'), jours, bien.retireeLe ? t('recherche.historique.retireeLe', { date: formatDate(bien.retireeLe) }) : null)}
        {indicateursDuSuivi && kpi(t('recherche.historique.changements'), String(r.changements), r.debut && !baisseAvant ? t('recherche.historique.suiviDepuis', { date: formatDate(r.debut.quand) }) : null)}
        {indicateursDuSuivi && r.ecartPct != null && kpi(t('recherche.historique.ecart'), formaterPct(r.ecartPct, i18n.language), depuis, r.ecartPct < 0 ? encreBaisse : sp.ink)}
        {baisseAvant && kpi(
          t('recherche.historique.suivi'),
          t('recherche.historique.depuisDate', { date: formatDate(baisseAvant.debut) }),
          t('recherche.historique.avantSuivi', { pct: formaterPct(baisseAvant.pct, i18n.language) }),
        )}
      </div>
      {courbe && (
        <svg viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} role="img" aria-label={t('recherche.historique.courbe')}
          style={{ display: 'block', width: '100%', height: 'auto', marginTop: 'var(--crm-space-4xl)', overflow: 'visible' }}>
          <path d={courbe.chemin} fill="none" stroke={sp.ink} strokeWidth={1.5} strokeLinejoin="round" />
          {courbe.marques.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={4}
              fill={m.genre === 'baisse' ? encreBaisse : sp.cardBg}
              stroke={m.genre === 'baisse' ? encreBaisse : sp.ink} strokeWidth={1.5} />
          ))}
        </svg>
      )}
      <ol style={{ listStyle: 'none', margin: 'var(--crm-space-4xl) 0 0', padding: 0, display: 'grid', gap: 'var(--crm-space-sm)' }}>
        {[...points].reverse().map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)', minWidth: 0, fontSize: 'var(--crm-text-md)' }}>
            <span style={{ flexShrink: 0, width: 88, fontWeight: 600, color: sp.sub }}>{formatDate(p.quand)}</span>
            <span style={{ flexShrink: 0, fontWeight: 600, color: p.genre === 'baisse' ? encreBaisse : sp.ink }}>{genre(p.genre)}</span>
            <span style={{ minWidth: 0, fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.ancienPrix != null && p.prix != null && p.ancienPrix !== p.prix
                ? `${t('recherche.bouge.deA', { avant: chf(p.ancienPrix), apres: chf(p.prix) })}${p.variationPct != null ? ` (${formaterPct(p.variationPct, i18n.language)})` : ''}`
                : chf(p.prix)}
            </span>
          </li>
        ))}
      </ol>
      {tronque && (
        <div style={{ marginTop: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub }}>
          {t('recherche.historique.tronque', { n: points.length })}
        </div>
      )}
    </div>
  )
}
