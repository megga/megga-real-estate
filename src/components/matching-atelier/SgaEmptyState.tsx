// Atelier Matching — état VIDE du triptyque (handoff crm-matching-empty.jsx).
//
// Le vrai triptyque rendu SANS données : cockpit d'identité de substitution +
// trois panneaux (File · Annonce · Pourquoi ça matche), au lieu de l'unique
// panneau plein cadre qu'affichait le repo.
//
// DISTINCT de la couverture « compte neuf » (MatchingFirstRun) : ici l'agence a
// des mandats, c'est le moteur qui n'a rien rapproché. La copie du handoff
// (« Votre première annonce ici », « Créer un mandat ») décrit l'autre cas et
// serait FAUSSE ici — on porte la structure, pas ces libellés. Le geste utile
// dans ce cas-là reste le scan moteur, qu'on conserve en action principale.

import { useTranslation } from 'react-i18next'
import SgaIcon, { type SgaIconName } from './SgaIcon'
import { SGA_TABS } from './constants'

/** Bloc centré d'un panneau vide : icône, titre, sous-titre, action optionnelle. */
function SgaEmptyPanel({
  icon, title, sub, cta, onCta, primary, busy,
}: {
  icon: SgaIconName
  title: string
  sub: string
  cta?: string
  onCta?: () => void
  primary?: boolean
  busy?: boolean
}) {
  return (
    <div className="sga-empty" style={{ padding: '32px 26px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 288 }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', color: 'var(--ink)', marginBottom: 18 }}>
          <SgaIcon d={icon} size={44} />
        </span>
        <div className="t3 semi" style={{ color: 'var(--ink)', letterSpacing: -0.3 }}>{title}</div>
        <div className="t1 muted" style={{ marginTop: 8, lineHeight: 1.55, textWrap: 'pretty' }}>{sub}</div>
        {cta && (
          <button
            type="button"
            className={primary ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={onCta}
            disabled={busy}
            style={{ marginTop: 20 }}
          >
            {cta}
          </button>
        )}
      </div>
    </div>
  )
}

/** Cockpit de substitution — même grammaire que le Pupitre, sans bascule ni jauge. */
export function SgaEmptyCockpit() {
  const { t } = useTranslation('matching')
  return (
    <div className="sgk sgk-pupitre">
      <div className="sgk-id" data-static="true">
        <div className="sgk-thumb" style={{ width: 44, height: 44, borderRadius: 12, color: 'var(--ink-dim)' }}>
          <SgaIcon d="home" size={19} />
        </div>
        <div className="sgk-id-txt">
          <div className="sgk-id-line">
            <span className="sgk-title">{t('atelier.emptyStage.cockpitTitle')}</span>
          </div>
          <div className="sgk-price">{t('atelier.emptyStage.cockpitSub')}</div>
        </div>
      </div>

      <div className="sgk-flex" />

      {/* Onglets présents pour l'uniformité de la barre, inertes (rien à filtrer). */}
      <div className="seg sgk-seg" aria-hidden="true" style={{ pointerEvents: 'none', opacity: 0.6 }}>
        {SGA_TABS.map((tb, i) => (
          <button key={tb.key} type="button" tabIndex={-1} className="sga-seg-btn" data-active={i === 0}>
            {tb.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export interface SgaEmptyBodyProps {
  /** relance du moteur de matching — action principale de ce cas */
  scan?: { label: string; busy: boolean; run: () => void }
  onOpenContacts?: () => void
}

/** Les trois panneaux vides du triptyque. */
export function SgaEmptyBody({ scan, onOpenContacts }: SgaEmptyBodyProps) {
  const { t } = useTranslation('matching')
  return (
    <>
      <section className="sga-panel sga-enter" aria-label={t('atelier.emptyStage.queueAria')}>
        <div className="sga-emptyhead">
          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>{t('atelier.emptyStage.queueEyebrow')}</div>
            <div className="sga-emptyhead-n nums">0</div>
          </div>
          {/* Libellé de tri sur deux lignes, aligné à droite (le `\n` de la clé). */}
          <div className="eyebrow" style={{ textAlign: 'right', color: 'var(--ink-muted)', whiteSpace: 'pre-line', lineHeight: 1.45 }}>
            {t('atelier.emptyStage.sortedBy')}
          </div>
        </div>
        <SgaEmptyPanel
          icon="users"
          title={t('atelier.emptyStage.queueTitle')}
          sub={t('atelier.emptyStage.queueSub')}
          cta={onOpenContacts ? t('empty.cta') : undefined}
          onCta={onOpenContacts}
        />
      </section>

      <section className="sga-panel sga-enter d1" aria-label={t('atelier.emptyStage.listingAria')} style={{ position: 'relative' }}>
        <div className="sga-ph" aria-hidden="true" style={{ opacity: 0.55 }} />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
          <SgaEmptyPanel
            icon="home"
            title={t('atelier.emptyStage.listingTitle')}
            sub={t('atelier.emptyStage.listingSub')}
            cta={scan ? (scan.busy ? t('atelier.empty.scanning') : scan.label) : undefined}
            onCta={scan?.run}
            busy={scan?.busy}
            primary
          />
        </div>
      </section>

      <section className="sga-panel sga-enter d2" aria-label={t('atelier.emptyStage.whyAria')}>
        <SgaEmptyPanel
          icon="sparkle"
          title={t('atelier.emptyStage.whyTitle')}
          sub={t('atelier.emptyStage.whySub')}
        />
      </section>
    </>
  )
}
