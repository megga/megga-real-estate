/**
 * Atomes du fil de matchs — l'avatar, la vignette d'un bien et le score, partagés par la liste, le
 * panneau et la sélection du marché : un même acheteur ou un même score ne se dessine jamais de deux
 * façons sur un écran.
 */
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { PalierScore } from './filModele'
import { teinteScore } from './filAffichage'

/** Initiales sur la sous-surface, neutres : une couleur d'avatar n'encode rien ici. */
export function FilAvatar({ sp, texte, taille }: { sp: CrmPalette; texte: string; taille: number }) {
  // Hors de la déclaration de style : le cliquet de grammaire lirait ce seuil comme une taille de texte.
  const texteGrand = taille >= 36
  return (
    <span aria-hidden style={{
      width: taille, height: taille, flex: 'none', display: 'grid', placeItems: 'center',
      borderRadius: 'var(--crm-radius-pill)', background: sp.cardSubBg, border: `1px solid ${sp.cardBorder}`,
      color: sp.ink, fontSize: texteGrand ? 'var(--crm-text-md)' : 'var(--crm-text-xs)', fontWeight: 600,
    }}>
      {texte}
    </span>
  )
}

/**
 * La première photo d'un bien, ou une maison en sourdine.
 *
 * `no-referrer` : Flatfox refuse les images demandées depuis un autre site (même règle que `MrhPhoto`).
 */
export function FilVignette({ sp, photo, largeur, hauteur }: { sp: CrmPalette; photo: string | null; largeur: number; hauteur: number }) {
  return (
    <span aria-hidden style={{
      width: largeur, height: hauteur, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
      borderRadius: 'var(--crm-radius-xs)', background: sp.cardSubBg,
    }}>
      {photo
        ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <MEIcon name="home" size={14} color={sp.sub} />}
    </span>
  )
}

/** Le score : le chiffre à l'encre, le palier dans la pastille. Toujours une estimation (CLAUDE.md §5). */
export function FilScore({ sp, score, palier, grand = false }: { sp: CrmPalette; score: number; palier: PalierScore; grand?: boolean }) {
  const { t } = useTranslation('matching')
  const libelle = t('fil.scoreAria', { score, palier: t(`fil.palier.${palier}`) })
  return (
    <span title={libelle} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', flex: 'none' }}>
      <span aria-hidden style={{ width: grand ? 10 : 8, height: grand ? 10 : 8, borderRadius: 'var(--crm-radius-pill)', background: teinteScore(palier, sp) }} />
      <span aria-hidden style={{ fontSize: grand ? 'var(--crm-text-6xl)' : 'var(--crm-text-md)', fontWeight: 600, color: sp.ink, fontVariantNumeric: 'tabular-nums' }}>
        {score}
      </span>
      <span className="sr-only">{libelle}</span>
    </span>
  )
}
