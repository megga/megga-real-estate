/**
 * Le motif d'un refus, en UNE puce (conception de la boucle, §4.4) : un clic consigne. Les huit motifs portent
 * leur touche (1 à 8) ; Échap referme. La note, facultative, se tape AVANT la puce — d'où sa place, au-dessus :
 * sous les puces, elle se lirait comme la suite d'un geste que la puce a déjà consigné.
 *
 * ⚠ Les touches sont traitées ICI et marquées `preventDefault` : le clavier du fil (`MatchingFil`) les ignore
 * alors. Dans la note, un chiffre reste un chiffre. La première puce prend le focus à l'ouverture : les
 * chiffres répondent aussitôt, et la note est à un Maj+Tab. Échap depuis le bouton « Pas intéressé », HORS
 * de ce groupe, est entendu par le clavier du fil, qui referme de même.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CrmPalette } from '@/components/crm/tokens'
import { MOTIFS_REFUS, type MotifRefus } from './filBoucle'
import { encreAccent, unSeulClic } from './filAffichage'

interface Props {
  sp: CrmPalette
  onChoisir: (motif: MotifRefus, note: string | null) => void
  onAnnuler: () => void
}

export default function FilMotifs({ sp, onChoisir, onAnnuler }: Props) {
  const { t } = useTranslation('matching')
  const [note, setNote] = useState('')
  const noteId = useId()
  const premier = useRef<HTMLButtonElement>(null)
  // Ouvert par N ou par un clic : la première puce prend le focus, les chiffres et Échap répondent aussitôt.
  useEffect(() => { premier.current?.focus() }, [])
  const choisir = (motif: MotifRefus) => onChoisir(motif, note.trim() || null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onAnnuler(); return }
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
    const rang = Number(e.key)
    const motif = Number.isInteger(rang) ? MOTIFS_REFUS[rang - 1] : undefined
    if (motif) { e.preventDefault(); choisir(motif) }
  }
  return (
    <div role="group" aria-label={t('fil.motifsAide')} onKeyDown={onKeyDown}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{t('fil.motifsAide')}</span>
      <label htmlFor={noteId} className="sr-only">{t('fil.note')}</label>
      <input id={noteId} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('fil.note')} maxLength={500}
        style={{
          height: 34, border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-md)', background: sp.cardBg,
          color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
          paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)',
        }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
        {MOTIFS_REFUS.map((motif, i) => (
          <button key={motif} ref={i === 0 ? premier : undefined} type="button" onClick={unSeulClic(() => choisir(motif))}
            aria-keyshortcuts={String(i + 1)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 30,
              paddingLeft: 'var(--crm-space-md)', paddingRight: 'var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
              border: `1px solid ${sp.cardBorder}`, background: 'transparent', color: sp.ink, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500,
            }}>
            {t(`fil.motifs.${motif}`)}
            <kbd aria-hidden style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <button type="button" onClick={unSeulClic(onAnnuler)} style={{
        alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: encreAccent(sp),
      }}>
        {t('fil.annulerMotif')}
      </button>
    </div>
  )
}
