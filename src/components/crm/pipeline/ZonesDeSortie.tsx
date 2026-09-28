/**
 * « Conclu » et « Perdu » — les deux SORTIES du board, qui n'apparaissent que pendant un glisser
 * (27.09.2026).
 *
 * ⛔ POURQUOI PAS DES COLONNES. Le board d'avant gardait une colonne « Signé » qui ne retenait
 * presque rien : un deal qu'on y déposait était célébré puis sortait (`status = 'completed'`).
 * « Perdu », lui, ne s'atteignait que par un menu au survol. Une sortie n'a pas à occuper une
 * colonne en permanence ; elle a à être là au moment du geste.
 *
 * ⛔ UNE CAPSULE, PAS DEUX BANDEAUX (28.09.2026). La première version posait deux cadres en
 * pointillés de toute la largeur du board : ils cachaient le bas des colonnes, se lisaient comme
 * des emplacements vides de formulaire, et « Conclu » restait vert pendant chaque glisser, même
 * vers une colonne. Ici, une capsule flottante au bas du board — la grammaire de la bascule
 * Kanban / Timeline et des menus flottants — où les deux sorties sont NEUTRES au repos : seule
 * leur icône porte la couleur. La sortie visée se remplit de sa teinte, cerclée de son encre
 * (sans grossir : agrandie, elle débordait de la capsule).
 *
 * ⚠ Les enfants d'une sortie ne captent pas le glisser (`pointerEvents: 'none'`) : sans ça,
 * passer de l'aplat à l'icône déclenchait un `dragleave`, et la sortie clignotait sous le curseur.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '../tokens'
import { ton, type Ton } from './tons'

export type Sortie = 'conclu' | 'perdu'

interface Props {
  sp: CrmPalette
  survolee: Sortie | null
  onSurvol: (s: Sortie | null) => void
  onDepot: (s: Sortie) => void
}

const SORTIES: { id: Sortie; icone: 'check-circle' | 'close-circle'; ton: Ton; cle: string }[] = [
  { id: 'conclu', icone: 'check-circle', ton: 'conclu', cle: 'phases.conclu' },
  { id: 'perdu', icone: 'close-circle', ton: 'retard', cle: 'phases.perdu' },
]

export function ZonesDeSortie({ sp, survolee, onSurvol, onDepot }: Props) {
  const { t } = useTranslation('pipeline')
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 'var(--crm-space-4xl)', zIndex: 20,
      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs)', pointerEvents: 'auto',
        background: sp.solidBg, border: `1px solid ${sp.solidBorder}`, borderRadius: 'var(--crm-radius-pill)',
        boxShadow: sp.solidShadow, animation: 'crm-capsule-in .18s cubic-bezier(.2,.8,.2,1) both',
      }}>
        {SORTIES.map((z) => {
          const active = survolee === z.id
          const teinte = ton(z.ton, sp)
          return (
            <div
              key={z.id}
              onDragOver={(e) => { e.preventDefault(); if (!active) onSurvol(z.id) }}
              onDragLeave={() => onSurvol(null)}
              onDrop={(e) => { e.preventDefault(); onDepot(z.id) }}
              style={{
                width: 184, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 'var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
                background: active ? teinte.fond : 'transparent',
                boxShadow: active ? `inset 0 0 0 1.5px ${teinte.encre}` : 'none',
                color: active ? teinte.encre : sp.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                transition: 'background .12s, box-shadow .12s, color .12s',
              }}
            >
              <span style={{ display: 'inline-flex', pointerEvents: 'none' }}>
                <MEIcon name={z.icone} size={18} color={teinte.encre} />
              </span>
              <span style={{ pointerEvents: 'none' }}>{t(z.cle)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
