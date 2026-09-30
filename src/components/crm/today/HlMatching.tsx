/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception §5) : cinq actions au plus, chacune avec sa raison, et un
 * geste qui mène à la bonne place du fil, ou à la fiche du mandat. Une surface MONTRE et ORIENTE ; le fil agit.
 *
 * Présentationnel : `PageAujourdhuiH` porte la lecture (`useMatchingDuJour`), le vide et l'échec.
 * ⚠ Aucun littéral de rayon, d'espacement ni de taille de texte : le cliquet de `megga-x-grammar.spec.ts` compte ceux
 * de `crm/today`.
 */
import { useTranslation } from 'react-i18next'
import { TK, hlCtaStyle } from './tk'
import { RXIcon } from './kit'
import { ecrire, type ActionMatching, type GenreAction } from './matchingDuJour'

// ⚠ `arrow-down` pour la baisse, pas `trending-down` : MEIcon ne trace pas ce dernier, il retombe sur l'histogramme
// plein de la fonte, qui ne dit pas « baisse ».
const ICONE: Record<GenreAction, string> = { retour: 'clock', prix: 'arrow-down', mandat: 'home', marche: 'building' }
const CTA: Record<GenreAction, string> = {
  retour: 'today.h.matching.ctaRetour', prix: 'today.h.matching.ctaPrix',
  mandat: 'today.h.matching.ctaMandat', marche: 'today.h.matching.ctaMarche',
}

function HlActionLigne({ a, premiere, onAction }: { a: ActionMatching; premiere: boolean; onAction: (a: ActionMatching) => void }) {
  const { t } = useTranslation('dashboard')
  const { t: tm } = useTranslation('matching')
  const texte = ecrire(a, t, tm)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', minWidth: 0, borderTop: premiere ? 'none' : `1px solid ${TK.border}` }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-md)', background: TK.card, color: TK.inkDim, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <RXIcon name={ICONE[a.genre]} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Deux lignes au plus, et la phrase entière au survol : elle finit par le prénom, qu'une ligne unique coupait
            dès que la colonne se resserre. */}
        <div title={texte} style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.ink, whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{texte}</div>
        {a.detail && (
          <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: TK.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail}</div>
        )}
      </div>
      <button type="button" className="hl-cta" onClick={() => onAction(a)} style={hlCtaStyle()}>
        {t(CTA[a.genre])}
      </button>
    </div>
  )
}

/** Les actions du segment, puis « Voir tout », qui ouvre le fil. */
export default function HlMatching({ actions, total, onAction, onVoirTout }: {
  actions: ActionMatching[]
  total: number
  onAction: (a: ActionMatching) => void
  onVoirTout: () => void
}) {
  const { t } = useTranslation('dashboard')
  return (
    <>
      {actions.map((a, i) => <HlActionLigne key={a.cle} a={a} premiere={i === 0} onAction={onAction} />)}
      <button type="button" onClick={onVoirTout}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xs) var(--crm-space-2xs)', background: 'none', border: 0, borderTop: `1px solid ${TK.border}`, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.inkDim }}>
          {total > actions.length ? t('today.h.matching.voirToutCompte', { count: total }) : t('today.h.matching.voirTout')}
        </span>
        <RXIcon name="arrow" size={15} sw={2.2} color={TK.sub} />
      </button>
    </>
  )
}
