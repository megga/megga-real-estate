/**
 * Les trois onglets du fil (conception de la boucle, §5) : « À proposer », « En attente », « À conclure »,
 * chacun avec le compte de ses LIGNES (conception du fil, §3.1). Un match n'est que dans un onglet.
 *
 * ⚠ Un `tablist` à tabindex itinérant : ←/→ passent d'un onglet à l'autre, Tab entre dans la liste. L'onglet
 * ACTIF porte l'accent (CLAUDE.md §3), en filet sous le libellé — l'accent brut tombe sous 3:1 sur sombre.
 *
 * ⚠ UN SEUL `tabpanel` pour les trois, posé par `MatchingFil` (`idsOnglets`) : il ne monte que le contenu de
 * l'onglet actif. Chaque onglet le désigne (`aria-controls`), et lui se nomme par l'onglet actif.
 */
import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { ONGLETS, type FilOnglet, type IdsOnglets } from './filBoucle'
import { encreAccent } from './filAffichage'

interface Props {
  sp: CrmPalette
  onglet: FilOnglet
  comptes: Record<FilOnglet, number>
  ids: IdsOnglets
  onChoisir: (o: FilOnglet) => void
}

export default function FilOnglets({ sp, onglet, comptes, ids, onChoisir }: Props) {
  const { t } = useTranslation('matching')
  const boutons = useRef<Partial<Record<FilOnglet, HTMLButtonElement | null>>>({})
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = ONGLETS.indexOf(onglet)
    const suivant = ONGLETS[(i + (e.key === 'ArrowRight' ? 1 : ONGLETS.length - 1)) % ONGLETS.length]!
    onChoisir(suivant)
    boutons.current[suivant]?.focus()
  }
  return (
    <div role="tablist" aria-label={t('fil.onglets.aria')} onKeyDown={onKeyDown} style={{
      display: 'flex', gap: 'var(--crm-space-2xl)', padding: '0 var(--crm-space-6xl)', borderBottom: `1px solid ${sp.cardBorder}`,
    }}>
      {ONGLETS.map((o) => {
        const actif = o === onglet
        return (
          <button key={o} ref={(el) => { boutons.current[o] = el }} type="button" role="tab" id={ids.onglet(o)}
            aria-selected={actif} aria-controls={ids.panneau}
            tabIndex={actif ? 0 : -1} onClick={() => onChoisir(o)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 40, padding: 0,
              border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)',
              fontWeight: actif ? 600 : 500, color: actif ? sp.ink : sp.sub,
              boxShadow: actif ? `inset 0 -2px 0 ${encreAccent(sp)}` : 'none',
            }}>
            {t(`fil.onglets.${o}`)}
            <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{comptes[o]}</span>
          </button>
        )
      })}
    </div>
  )
}
