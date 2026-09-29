/**
 * Les TONS d'état de la proposition Pipeline (27.09.2026) — encre, fond et filet, par thème.
 *
 * ⛔ AUCUN LITTÉRAL ICI. Le clair prend `STATUT_CLAIR`, source unique des encres d'état sur
 * blanc (`statut-clair.spec.ts` refuse la copie suivante) ; le sombre prend les barreaux PÂLES
 * de la vitrine (`MXC_SYSTEM`), les seuls qui tiennent sur `#16181c` (CLAUDE.md §3, point 4).
 * L'accent en ENCRE sur sombre est `blue300` : `#424bfb` y rend 3,44:1 (point 3).
 *
 * ⚠ Les fonds sont des MÉLANGES vers la carte, pas des voiles : une pastille d'échéance se pose
 * sur une carte opaque, et un aplat calculé garde le même contraste quelle que soit la colonne.
 */
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'
import { crmMix, type CrmPalette } from '../tokens'

export type Ton = 'retard' | 'aujourdhui' | 'aPlanifier' | 'conclu' | 'neutre'

export interface TonRendu { encre: string; fond: string; filet: string }

export function ton(t: Ton, sp: CrmPalette): TonRendu {
  const carte = sp.cardBg
  if (t === 'neutre') return { encre: sp.ink, fond: carte, filet: sp.cardBorder }
  if (!sp.isDark) {
    if (t === 'retard') return { encre: STATUT_CLAIR.errInk, fond: STATUT_CLAIR.errFill, filet: STATUT_CLAIR.errLine }
    if (t === 'aPlanifier') return { encre: STATUT_CLAIR.warnInk, fond: STATUT_CLAIR.warnFill, filet: STATUT_CLAIR.warnLine }
    if (t === 'conclu') return { encre: STATUT_CLAIR.okInk, fond: STATUT_CLAIR.okFill, filet: STATUT_CLAIR.okLine }
    return { encre: sp.accent, fond: crmMix(sp.accent, carte, 0.9), filet: crmMix(sp.accent, carte, 0.6) }
  }
  const pale = t === 'retard' ? MXC_SYSTEM.red400
    : t === 'aPlanifier' ? MXC_SYSTEM.yellow400
      : t === 'conclu' ? MXC_SYSTEM.green400
        : MXC_SYSTEM.blue300
  // L'accent garde son APLAT (#424bfb) pour le fond : c'est l'encre, et elle seule, qui change.
  const base = t === 'aujourdhui' ? sp.accent : pale
  return { encre: pale, fond: crmMix(base, carte, t === 'aujourdhui' ? 0.8 : 0.86), filet: crmMix(pale, carte, 0.55) }
}
