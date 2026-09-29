/**
 * Matching · Recherche — « Ce qui a bougé » : les annonces apparues, en baisse ou retirées sur la période
 * choisie, de la plus récente à la plus ancienne.
 *
 * Présentationnel : `MatchingRechercheHybride` porte la requête (`usePigeMouvements`), les filtres, la
 * période et la pagination ; ce composant rend une ligne par mouvement, ses états et la suite.
 *
 * ⚠ AUCUN TOTAL : le flux se pagine par clé et ne se compte pas (CLAUDE.md §7).
 * ⚠ Les mouvements datent de la mise en service de la pige : un flux vide dans les premiers jours ne dit
 * pas que le marché dort, il dit que le suivi commence — l'état vide le dit.
 * ⛔ DEUX VIDES À NE PAS CONFONDRE. Les jetons CLIENT (texte, pièces, surface) ne filtrent que les
 * mouvements CHARGÉS : si aucun ne passe, le flux n'est pas vide, il est filtré — « aucune nouvelle
 * annonce sur cette période » serait faux, et cacher « Voir plus » empêcherait d'aller chercher la suite
 * où l'annonce se trouve peut-être. D'où `charges`, le compte d'AVANT ces filtres.
 * ⛔ Une page suivante en échec n'efface pas les précédentes : la liste reste, « Réessayer » dessous.
 * Lot D1 (conception §7bis) : une ligne dit « 3 acheteurs » quand des acheteurs compatibles existent
 * (`usePigeAcheteurs`), et rien sinon ; la pastille ouvre la fiche de l'annonce sur « Qui pour ce bien ? ».
 * ⚠ Aucun littéral de rayon ni d'espacement : le cliquet de `megga-x-grammar.spec.ts` compte ceux du
 * dossier, et ce fichier n'en ajoute pas.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EtatVide from '@/components/crm/EtatVide'
import { formatCHF } from '@/lib/utils'
import MrhPhoto from './MrhPhoto'
import RechIcon from './RechIcon'
import { mrhPriceDropInk, type MrhCtx } from './mrhCtx'
import { formaterPct, quandRelatif, type EtatFlux, type GenreMouvement, type MouvementPige } from './pige'
import type { MrhBien } from './types'

interface Props {
  genre: GenreMouvement
  /** Les mouvements à montrer : ceux qui passent les jetons client. */
  mouvements: MouvementPige[]
  /** Les mouvements CHARGÉS, avant les jetons client — de quoi distinguer un flux vide d'un flux filtré. */
  charges: number
  etat: EtatFlux
  /** Une page de plus existe : la dernière chargée était pleine. */
  suiteDisponible: boolean
  chargeSuite: boolean
  /** La dernière page suivante a échoué ; les précédentes restent affichées. */
  suiteEnEchec: boolean
  onSuite: () => void
  onReessayer: () => void
  onOuvrir: (b: MrhBien) => void
  /** Lot D1 : annonce → acheteurs compatibles ; une ligne ne dit rien sans eux. */
  acheteurs?: ReadonlyMap<string, number>
  /** La pastille « 3 acheteurs » : la fiche de l'annonce, sur « Qui pour ce bien ? ». */
  onQuiPour?: (b: MrhBien) => void
  ctx: MrhCtx
}

export default function MrhBouge({ genre, mouvements, charges, etat, suiteDisponible, chargeSuite, suiteEnEchec, onSuite, onReessayer, onOuvrir, acheteurs, onQuiPour, ctx }: Props) {
  const { t } = useTranslation('matching')
  const { sp, surf, dark, ACC, ONACC } = ctx
  // Horloge figée au montage : « hier » ne bascule pas pendant qu'on lit (idiome de `BpTopGallery`).
  const [maintenant] = useState(() => Date.now())

  const bouton = (libelle: string, onClick: () => void, occupe = false) => (
    <button onClick={onClick} disabled={occupe}
      style={{ height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: occupe ? 'default' : 'pointer', background: ACC, color: ONACC, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, opacity: occupe ? 0.6 : 1 }}>
      {libelle}
    </button>
  )

  // Sous la liste (ou sous le vide filtré) : la page suivante, sa relance si elle a échoué. Pendant la
  // relance, TanStack garde l'échec levé : « Chargement… » passe donc avant « Réessayer ».
  const suite = chargeSuite ? (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--crm-space-6xl)' }}>
      {bouton(t('recherche.bouge.chargement'), onSuite, true)}
    </div>
  ) : suiteEnEchec ? (
    <div role="alert" style={{ display: 'grid', justifyItems: 'center', gap: 'var(--crm-space-lg)', marginTop: 'var(--crm-space-6xl)', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub, textAlign: 'center' }}>
      <span>{t('recherche.bouge.suiteErreur')}</span>
      {bouton(t('recherche.retry'), onSuite)}
    </div>
  ) : suiteDisponible ? (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--crm-space-6xl)' }}>
      {bouton(t('recherche.bouge.voirPlus'), onSuite)}
    </div>
  ) : null

  if (etat === 'chargement' || etat === 'lent') {
    return (
      <div role="status" style={{ display: 'grid', placeItems: 'center', alignContent: 'center', minHeight: 240, gap: 'var(--crm-space-2xl)', color: sp.sub, fontSize: 'var(--crm-text-lg)', fontWeight: 600, textAlign: 'center' }}>
        <span>{etat === 'lent' ? t('recherche.slow') : t('recherche.bouge.chargement')}</span>
        {etat === 'lent' && bouton(t('recherche.retry'), onReessayer)}
      </div>
    )
  }
  if (etat === 'erreur' || etat === 'bloque') {
    return (
      <EtatVide dark={dark} registre="erreur"
        titre={etat === 'erreur' ? t('recherche.bouge.erreur') : t('recherche.blocked')}
        action={{ libelle: t('recherche.retry'), onClick: onReessayer }} />
    )
  }
  if (!mouvements.length) {
    // Des mouvements chargés et aucun à montrer : le vide vient des jetons client, pas du marché — et la
    // suite, s'il y en a une, reste à portée.
    const vide = charges > 0
      ? <EtatVide dark={dark} titre={t('recherche.bouge.filtreVide', { count: charges })} corps={t('recherche.bouge.filtreVideCorps')} />
      : <EtatVide dark={dark} titre={t(`recherche.bouge.vide.${genre}`)} corps={t('recherche.bouge.videCorps')} />
    return suite ? <div>{vide}{suite}</div> : vide
  }

  return (
    <div>
      {/* `mrh-flux` : la grille commune des lignes (`mrh.css`) — toutes les dates s'alignent, pastille ou non. */}
      <ol className="mrh-flux" aria-label={t(`recherche.vue.${genre}`)} style={{ listStyle: 'none', margin: 0, padding: 0, background: surf.card, border: surf.hairline, borderRadius: 'var(--crm-radius-4xl)', boxShadow: surf.shadow, overflow: 'hidden' }}>
        {mouvements.map((m, i) => (
          <LigneFlux key={m.id} m={m} bordure={i > 0} maintenant={maintenant} onOuvrir={onOuvrir} ctx={ctx}
            acheteurs={acheteurs?.get(m.bien.id) ?? 0} onQuiPour={onQuiPour} />
        ))}
      </ol>
      {suite}
    </div>
  )
}

/**
 * Une ligne : vignette, identité, ce qui a bougé, et quand. Toute la ligne ouvre la fiche ; la pastille des acheteurs
 * compatibles (lot D1), elle, ouvre la fiche sur « Qui pour ce bien ? ».
 */
function LigneFlux({ m, bordure, maintenant, onOuvrir, ctx, acheteurs, onQuiPour }: {
  m: MouvementPige; bordure: boolean; maintenant: number; onOuvrir: (b: MrhBien) => void; ctx: MrhCtx
  acheteurs: number; onQuiPour?: (b: MrhBien) => void
}) {
  const { t, i18n } = useTranslation('matching')
  const { sp, surf, dark, line, chipBg } = ctx
  const b = m.bien
  const loyer = b.transaction === 'location'
  const encreBaisse = mrhPriceDropInk(dark)
  const chf = (v: number | null) => (v ? `${formatCHF(v)}${loyer ? ' ' + t('recherche.card.perMonth') : ''}` : t('recherche.card.estimate'))
  const q = quandRelatif(m.quand, maintenant)
  const quand = q.cle === 'aujourdhui' ? t('recherche.bouge.quandAujourdhui')
    : q.cle === 'hier' ? t('recherche.bouge.quandHier')
      : t('recherche.bouge.quandJours', { count: q.jours })
  const detail = m.genre === 'baisse' ? t('recherche.bouge.deA', { avant: chf(m.ancienPrix), apres: chf(m.prix) })
    : m.genre === 'retrait' ? t('recherche.bouge.dernierPrix', { prix: chf(m.prix) })
      : chf(m.prix)
  // Une annonce qui apparaît dans la pige peut être en ligne depuis des jours (la collecte RealAdvisor
  // la voit en moyenne 4,5 jours après sa publication) : on le dit, au-delà d'un jour.
  const age = m.joursSurMarche == null ? null
    : m.genre === 'apparition' ? (m.joursSurMarche > 1 ? t('recherche.bouge.enLigneDepuis', { count: m.joursSurMarche }) : null)
      : t('recherche.bouge.apresJours', { count: m.joursSurMarche })

  return (
    <li className="mrh-flux-item" style={{ borderTop: bordure ? '1px solid ' + line : 'none' }}>
      {/* Pas de `background` en ligne : le fond au repos et au survol vit dans `mrh.css`, sur la ligne ENTIÈRE — la
          pastille des acheteurs est un second bouton, frère du premier (un bouton n'en contient pas un autre). Le
          bouton de ligne est ÉTIRÉ (`::after`, `mrh.css`) : la bande autour de la pastille ouvre la fiche, elle aussi. */}
      <button onClick={() => onOuvrir(b)} className="mrh-flux-ligne"
        style={{ minWidth: 0, display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) auto', alignItems: 'center', gap: 'var(--crm-space-2xl)', padding: 'var(--crm-space-lg) var(--crm-space-4xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: sp.ink }}>
        <span style={{ position: 'relative', display: 'block', width: 56, height: 56, borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', background: surf.cardSub }}>
          <MrhPhoto url={b.photos[0] ?? null} dark={dark} fallbackBg={surf.cardSub} fallbackInk={sp.sub} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</span>
          <span style={{ display: 'block', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[b.typeLabel, b.city, b.canton].filter(Boolean).join(' · ')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink }}>
            {m.genre === 'baisse' && <RechIcon name="trendDown" size={13} stroke={encreBaisse} />}
            <span>{detail}</span>
            {m.genre === 'baisse' && m.variationPct != null && <span style={{ color: encreBaisse }}>{formaterPct(m.variationPct, i18n.language)}</span>}
            {age && <span style={{ fontWeight: 500, color: sp.sub }}>{age}</span>}
          </span>
        </span>
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub, whiteSpace: 'nowrap' }}>{quand}</span>
      </button>
      {/* Lot D1 : la ligne dit s'il existe des acheteurs compatibles, jamais qu'il n'y en a pas.
          Une PUCE de l'écran : `chipBg` sous l'anneau du filet (`line`), comme les segments et les cases de sélection.
          ⚠ Ni l'un ni l'autre n'est décoratif en sombre, où carte et ligne ne font qu'une surface (20.09.2026) : sans
          l'anneau, mesuré au banc, la pastille n'avait aucun contour (ΔL* 0,00) ; et un fond OPAQUE — `surf.cardSub`,
          celui des vignettes — trouait la ligne survolée. `chipBg` y est un voile : il éclaircit la ligne, pas l'inverse. */}
      {acheteurs > 0 && onQuiPour && (
        <button type="button" className="mrh-flux-pastille" onClick={() => onQuiPour(b)} aria-label={t('recherche.bouge.acheteursAria', { count: acheteurs, titre: b.title })}
          style={{ marginRight: 'var(--crm-space-4xl)', padding: 'var(--crm-space-2xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: chipBg, boxShadow: 'inset 0 0 0 1px ' + line, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {t('recherche.bouge.acheteurs', { count: acheteurs })}
        </button>
      )}
    </li>
  )
}
