/**
 * Matching — la couverture de premier lancement (« Compte neuf »), port du handoff `crm-matching-firstrun.jsx`.
 *
 * Lot E1 (conception `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : le fil la montre à la
 * place de la page 0 quand l'agence n'a AUCUNE recherche d'acheteur active ET que le fil n'a lu aucun match — une
 * recherche close garde sa boucle (`ecranDuFil`) ; la Recherche reste en page 1.
 * Trois étapes, dans l'ordre de la boucle — un acheteur, les biens qu'on lui compare, les matchs —, et le bouton mène à
 * la création d'un contact. Un mandat n'est pas requis : le marché suffit.
 *
 * EXCEPTION TOKENS ASSUMÉE — comme `BiensFirstRun.tsx`, cette couverture est MONO-THÈME : fond sombre #030303 et textes
 * blancs en dur, quel que soit le thème de l'app (celle des Contacts suit le thème depuis le 16.09.2026). Ne PAS
 * « corriger » ces couleurs vers les jetons `sp.*` : la maquette repose dessus. Son anneau de focus est un barreau,
 * `MXC_SYSTEM.blue300`, l'encre claire de la direction sur fond sombre ; ses rayons et espacements passent par
 * l'échelle, sa police par `--crm-font`, comme tout le fil.
 *
 * COUVERTURE : illustration plein cadre (halftone violet/magenta sur noir, façon cover KYC), livrée avec le paquet de
 * design du 25 juillet. Les motifs occupent le coin haut-droit et le coin bas-gauche : le contenu est donc remonté
 * (paddingBottom) pour ne pas s'asseoir dessus.
 */
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'

/** Illustration plein cadre de la couverture. `null` ⇒ fond plat #030303. */
const COVER_SRC: string | null = '/matching/matching-cover.png'

/** Les 3 étapes de la boucle de match, dans son ordre — icône + clé i18n. */
const STEPS: { icon: MEIconName; key: string }[] = [
  { icon: 'users', key: 'acheteur' },
  { icon: 'home', key: 'biens' },
  { icon: 'sparkle', key: 'scores' },
]

interface MatchingFirstRunProps {
  /** Un premier acheteur (bouton « Ajouter un acheteur ») : la création d'un contact. */
  onAjouterAcheteur: () => void
}

/** Couverture premier lancement du Matching : la page 0 sans recherche active ni match lu (`ecranDuFil`). */
export default function MatchingFirstRun({ onAjouterAcheteur }: MatchingFirstRunProps) {
  const { t } = useTranslation('matching')

  return (
    <div
      className="mfr-root"
      data-screen-label="Matching · Premier lancement"
      style={{
        position: 'absolute',
        inset: 0,
        background: '#030303',
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: 'var(--crm-font), system-ui, sans-serif',
        color: '#FFFFFF',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`.mfr-root button:focus-visible{outline:2.5px solid ${MXC_SYSTEM.blue300};outline-offset:3px;}.mfr-root :focus:not(:focus-visible){outline:none;}`}</style>

      {COVER_SRC && (
        <img
          src={COVER_SRC}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, bottom: 0, left: -1, width: 'calc(100% + 2px)', height: '100%', objectFit: 'cover', objectPosition: 'center', pointerEvents: 'none' }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 2, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'calc(var(--crm-space-sm) * 7) calc(var(--crm-space-5xl) * 2)', paddingBottom: 'calc(var(--crm-space-5xl) * 9)' }}>
        <div style={{ maxWidth: 920, width: '100%', textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 600, letterSpacing: -1, lineHeight: 1.1, color: '#FFFFFF', textShadow: '0 0 24px rgba(255,255,255,0.5)' }}>
            {t('firstRun.title')}
          </h1>
        </div>

        {/* Une liste ORDONNÉE : l'ordre des étapes est le message, et un lecteur d'écran l'annonce. Le rôle est
            explicite parce que Safari retire la sémantique de liste à une liste sans puces. */}
        <ol role="list" style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--crm-space-4xl)', maxWidth: 860, width: '100%', margin: 'calc(var(--crm-space-5xl) * 2) 0 0' }}>
          {STEPS.map(s => (
            <li key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'var(--crm-space-sm) var(--crm-space-lg)' }}>
              <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <MEIcon name={s.icon} size={34} />
              </span>
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: '#FFFFFF', lineHeight: 1.25, marginTop: 'var(--crm-space-2xl)', textShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.title`)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: 'rgba(255,255,255,0.7)', marginTop: 'var(--crm-space-sm)', textShadow: '0 0 16px rgba(0,0,0,0.5)' }}>
                {t(`firstRun.${s.key}.sub`)}
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={onAjouterAcheteur}
          style={{
            marginTop: 'calc(var(--crm-space-5xl) * 2)', height: 48, padding: '0 calc(var(--crm-space-2xl) * 2)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: '#FFFFFF', color: '#030303',
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          }}
        >
          {t('firstRun.start')}
        </button>
      </div>
    </div>
  )
}
