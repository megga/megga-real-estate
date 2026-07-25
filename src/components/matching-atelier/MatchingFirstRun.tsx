// MEGGA CRM — Matching · État « Compte neuf » (premier lancement).
// Port du handoff `crm-matching-firstrun.jsx` : remplace la page 0 du pager
// quand l'agence n'a encore ni mandat ni contact avec critères. Explique la
// boucle de match en 3 étapes et pointe vers le prérequis (créer un bien).
//
// EXCEPTION TOKENS ASSUMÉE — comme BiensFirstRun.tsx et ContactsFirstRun.tsx,
// cette couverture est MONO-THÈME : fond sombre #0A0B0D et textes blancs en dur,
// quel que soit le thème de l'app. Ne PAS « corriger » ces couleurs vers les
// tokens sp.* : la maquette repose dessus.
//
// COUVERTURE : illustration plein cadre (halftone violet/magenta sur noir,
// façon cover KYC), livrée avec le paquet de design du 25 juillet. Les motifs
// occupent le coin haut-droit et le coin bas-gauche : le contenu est donc
// remonté (paddingBottom) pour ne pas s'asseoir dessus.

import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'

/** Illustration plein cadre de la couverture. `null` ⇒ fond plat #0A0B0D. */
const COVER_SRC: string | null = '/matching/matching-cover.png'

/** Les 3 étapes de la boucle de match — icône + clé i18n. */
const STEPS: { icon: MEIconName; key: string }[] = [
  { icon: 'home', key: 'mandat' },
  { icon: 'users', key: 'contact' },
  { icon: 'sparkle', key: 'scores' },
]

interface MatchingFirstRunProps {
  /** Création du premier mandat (bouton « Continuer »). */
  onCreateListing: () => void
}

/** Couverture premier lancement du Matching (page 0 quand l'agence n'a aucun match). */
export default function MatchingFirstRun({ onCreateListing }: MatchingFirstRunProps) {
  const { t } = useTranslation('matching')

  return (
    <div
      className="mfr-root"
      data-screen-label="Matching · Premier lancement"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0A0B0D',
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: '#FFFFFF',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`.mfr-root button:focus-visible{outline:2.5px solid #8DA4FF;outline-offset:3px;}.mfr-root :focus:not(:focus-visible){outline:none;}`}</style>

      {COVER_SRC && (
        <img
          src={COVER_SRC}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, bottom: 0, left: -1, width: 'calc(100% + 2px)', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 40px', paddingBottom: 180 }}>
        <div style={{ maxWidth: 920, width: '100%', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: -1, lineHeight: 1.1, color: '#FFFFFF', textShadow: '0 0 24px rgba(255,255,255,0.5)' }}>
            {t('firstRun.title')}
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, maxWidth: 860, width: '100%', marginTop: 40 }}>
          {STEPS.map(s => (
            <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 12px' }}>
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 999, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <MEIcon name={s.icon} size={34} />
              </span>
              <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.3, color: '#FFFFFF', lineHeight: 1.25, marginTop: 16, textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.title`)}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 6, textShadow: '0 0 16px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.sub`)}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onCreateListing}
          style={{
            marginTop: 40, height: 48, padding: '0 30px', borderRadius: 999, border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, background: '#FFFFFF', color: '#0A0B0D',
            display: 'inline-flex', alignItems: 'center', gap: 9, boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          {t('firstRun.start')}
        </button>
      </div>
    </div>
  )
}
