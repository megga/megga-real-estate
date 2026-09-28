/**
 * Colonne d'une PHASE du Pipeline (proposition du 27.09.2026).
 *
 * ⛔ DES COLONNES DE MÊME LARGEUR. L'ancienne posait `flex: 0 0 252px`, mais le texte insécable
 * des cartes imposait sa largeur minimale : mesuré à 1440 px, les huit colonnes allaient de 287
 * à 372 px. Ici `flex: 1 1 0` et `minWidth: 0` — les cinq se partagent l'écran, le texte
 * s'ellipse.
 *
 * ⚠ LE FOND EST NEUTRE, DANS LES DEUX THÈMES. La phase se lit au libellé et au FILET du haut
 * (3 px, sa teinte) : mis bout à bout, les cinq filets gardent le balayage indigo → orange, la
 * même forme que le sombre porte depuis le 20.09.2026. En clair, les huit aplats pastel du board
 * d'avant rivalisaient avec les cartes — c'est l'écart que ce banc sert à juger.
 *
 * ⚠ Le total ne compte que les VENTES : un loyer additionné à des prix de vente ne veut rien
 * dire (le board d'avant affichait « CHF 0.00M » pour un loyer de 2'950).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmVoileEncre, type CrmPalette } from '../tokens'
import type { Phase } from './phases'
import { montantCourt } from './phases'

interface Props {
  phase: Phase
  /** La première colonne n'a pas de filet à gauche : il doublerait la bordure du cadre. */
  premiere: boolean
  /** La dernière touche le coin bas droit du cadre, comme la première son coin bas gauche. */
  derniere: boolean
  nombre: number
  /** Somme des ventes de la colonne, en CHF ; 0 n'affiche rien. */
  totalVentes: number
  sp: CrmPalette
  dark: boolean
  cibleDeDepot: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: () => void
  /** « + Ajouter » en pied de colonne ; `null` quand la phase ne se crée pas à la main. */
  onAjouter: (() => void) | null
  /** La carte fantôme de création, en tête de pile quand elle est ouverte. */
  formulaire: ReactNode
  children: ReactNode
}

export function PhaseColumn({
  phase, premiere, derniere, nombre, totalVentes, sp, dark, cibleDeDepot,
  onDragOver, onDragLeave, onDrop, onAjouter, formulaire, children,
}: Props) {
  const { t, i18n } = useTranslation('pipeline')
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      style={{
        flex: '1 1 0', minWidth: 196, height: '100%', minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)',
        borderTop: `3px solid ${phase.teinte}`,
        // ⛔ Les deux colonnes du bord épousent le coin arrondi du cadre (Julien, 28.09.2026). Carrées,
        // leur aplat et leur anneau de dépôt étaient rognés par la courbe : l'anneau s'arrêtait là où
        // elle commence, et le coin paraissait cassé, en couleur, sous le curseur.
        borderBottomLeftRadius: premiere ? 'var(--crm-radius-6xl)' : 0,
        borderBottomRightRadius: derniere ? 'var(--crm-radius-6xl)' : 0,
        borderLeft: premiere ? 'none' : `1px solid ${crmVoileEncre(dark, dark ? 0.09 : 0.08)}`,
        padding: 'var(--crm-space-2xl) var(--crm-space-lg) var(--crm-space-lg)', boxSizing: 'border-box',
        background: cibleDeDepot ? crmVoileEncre(dark, dark ? 0.04 : 0.03) : 'transparent',
        boxShadow: cibleDeDepot ? `inset 0 0 0 2px ${phase.teinte}` : 'none',
        transition: 'background .15s, box-shadow .15s',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', padding: '0 var(--crm-space-2xs)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', minWidth: 0 }}>
          <span style={{
            fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink, letterSpacing: -0.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{t(`phases.noms.${phase.id}`)}</span>
          <span style={{
            marginLeft: 'auto', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.sub,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{nombre}</span>
        </div>
        {/* La ligne reste là quand elle est vide : les cinq en-têtes gardent la même hauteur. */}
        <div style={{
          minHeight: 16, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>{totalVentes > 0 ? `CHF ${montantCourt(totalVentes, i18n.language)}` : ''}</div>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)',
        // La place de l'ombre de carte et de l'anneau de survol, que le défilement couperait.
        padding: 'var(--crm-space-2xs)', margin: 'calc(-1 * var(--crm-space-2xs))',
      }}>
        {formulaire}
        {children}
        {onAjouter && !formulaire && (
          <button
            type="button"
            onClick={onAjouter}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flexShrink: 0,
              border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              padding: 'var(--crm-space-md) var(--crm-space-xs)', borderRadius: 'var(--crm-radius-md)',
              fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = sp.ink }}
            onMouseLeave={(e) => { e.currentTarget.style.color = sp.sub }}
          >
            <MEIcon name="plus" size={12} color="currentColor" />
            {t('phases.ajouter')}
          </button>
        )}
      </div>
    </div>
  )
}
