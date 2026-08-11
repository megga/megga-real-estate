/** Pilule de verdict qualitatif du matching (mobile). */
import { useTranslation } from 'react-i18next'
import { useMobileTokens } from '../useMobileTokens'
import { verdictKey } from './vm'

interface MmVerdictProps {
  score: number
  big?: boolean
  /** sur une photo (skin verre dépoli sombre) vs sur carte (cardSubtle/ink). */
  onPhoto?: boolean
}

/**
 * Pilule de verdict qualitatif (Excellent / Très bon / Bon / À explorer). Le
 * score chiffré reste interne à l'algo — seul le libellé d'estimation s'affiche.
 */
export default function MmVerdict({ score, big = false, onPhoto = false }: MmVerdictProps) {
  const { tk } = useMobileTokens()
  const { t } = useTranslation('matching')
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        height: big ? 32 : 26,
        padding: big ? '0 15px' : '0 12px',
        borderRadius: 'var(--crm-radius-pill)',
        fontSize: big ? 13 : 11.5,
        fontWeight: 800,
        letterSpacing: -0.1,
        ...(onPhoto
          ? { background: 'rgba(3,3,3,0.78)', backdropFilter: 'blur(8px)', color: '#fff' }
          : { background: tk.cardSubtle, color: tk.ink }),
      }}
    >
      {t(`mobile.verdict.${verdictKey(score)}`)}
    </span>
  )
}
