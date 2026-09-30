/**
 * Matching — la couverture de premier lancement (« Compte neuf »), port du handoff `crm-matching-firstrun.jsx`.
 *
 * Lot E1 (conception `docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : le fil la montre à la
 * place de la page 0 quand l'agence n'a AUCUNE recherche d'acheteur active ET que le fil n'a lu aucun match — une
 * recherche close garde sa boucle (`ecranDuFil`) ; la Recherche reste en page 1.
 * Trois étapes, dans l'ordre de la boucle — un acheteur, les biens qu'on lui compare, les matchs —, et le bouton mène à
 * la création d'un contact. Un mandat n'est pas requis : le marché suffit.
 *
 * Elle suit le THÈME, comme celle des Contacts depuis le 16.09.2026 (revue UX du 29.09.2026 : c'était le seul écran à
 * l'ignorer — un bloc noir au milieu d'un CRM clair). Le sombre garde la maquette à l'identique : fond #030303, encres
 * blanches, anneau de focus `MXC_SYSTEM.blue300` (l'accent y serait un bleu foncé sur presque-noir). Le clair prend le
 * fond de carte et les encres de la palette, et l'affordance principale y porte l'accent. Rayons et espacements passent
 * par l'échelle, la police par `--crm-font`, comme tout le fil.
 *
 * COUVERTURE : illustration plein cadre (halftone violet/magenta, façon cover KYC), livrée avec le paquet de design du
 * 25 juillet. Son fond noir est TRANSPARENT depuis le 29.09.2026 : recomposée sur #030303 elle rend l'original, et ses
 * points se posent aussi sur un fond clair. Les motifs occupent le coin haut-droit et le coin bas-gauche : le contenu
 * est donc remonté (paddingBottom) pour ne pas s'asseoir dessus.
 */
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { MXC_COLOR, MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'
import type { CrmPalette } from '@/components/crm/tokens'

/** Illustration plein cadre de la couverture, fond transparent. `null` ⇒ fond plat. */
const COVER_SRC: string | null = '/matching/matching-cover.png'

/** Les encres de la couverture, une par thème (même partage que la couverture des Contacts). */
interface EncresCouverture {
  fond: string; ink: string; sub: string; ring: string; halo: string; ombre: string
  bouton: { fond: string; ink: string; ombre: string }
}

function encresCouverture(sp: CrmPalette, dark: boolean): EncresCouverture {
  return dark
    ? {
        fond: MXC_COLOR.n100, ink: '#FFFFFF', sub: 'rgba(255,255,255,0.7)', ring: MXC_SYSTEM.blue300,
        halo: '0 0 24px rgba(255,255,255,0.5)', ombre: '0 0 20px rgba(0,0,0,0.5)',
        bouton: { fond: '#FFFFFF', ink: MXC_COLOR.n100, ombre: '0 12px 32px rgba(0,0,0,0.45)' },
      }
    : {
        fond: sp.cardBg, ink: sp.ink, sub: sp.sub, ring: sp.accent, halo: 'none', ombre: 'none',
        bouton: { fond: sp.accent, ink: encreSur(sp.accent), ombre: 'none' },
      }
}

/** Les 3 étapes de la boucle de match, dans son ordre — icône + clé i18n. */
const STEPS: { icon: MEIconName; key: string }[] = [
  { icon: 'users', key: 'acheteur' },
  { icon: 'home', key: 'biens' },
  { icon: 'sparkle', key: 'scores' },
]

interface MatchingFirstRunProps {
  sp: CrmPalette
  dark: boolean
  /** Un premier acheteur (bouton « Ajouter un acheteur ») : la création d'un contact. */
  onAjouterAcheteur: () => void
}

/** Couverture premier lancement du Matching : la page 0 sans recherche active ni match lu (`ecranDuFil`). */
export default function MatchingFirstRun({ sp, dark, onAjouterAcheteur }: MatchingFirstRunProps) {
  const { t } = useTranslation('matching')
  const encre = encresCouverture(sp, dark)

  return (
    <div
      className="mfr-root"
      data-screen-label="Matching · Premier lancement"
      style={{
        position: 'absolute',
        inset: 0,
        background: encre.fond,
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: 'var(--crm-font), system-ui, sans-serif',
        color: encre.ink,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <style>{`.mfr-root button:focus-visible{outline:2.5px solid ${encre.ring};outline-offset:3px;}.mfr-root :focus:not(:focus-visible){outline:none;}`}</style>

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
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 600, letterSpacing: -1, lineHeight: 1.1, color: encre.ink, textShadow: encre.halo }}>
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
              <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: encre.ink, lineHeight: 1.25, marginTop: 'var(--crm-space-2xl)', textShadow: encre.ombre }}>
                {t(`firstRun.${s.key}.title`)}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: encre.sub, marginTop: 'var(--crm-space-sm)', textShadow: encre.ombre }}>
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
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: encre.bouton.fond, color: encre.bouton.ink,
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', boxShadow: encre.bouton.ombre,
          }}
        >
          {t('firstRun.start')}
        </button>
      </div>
    </div>
  )
}
