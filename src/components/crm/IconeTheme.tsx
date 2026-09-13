/**
 * Le glyphe de la bascule de thème — il TOURNE du soleil à la lune au lieu de
 * changer d'un coup.
 *
 * Le reste de la bascule est une révélation de l'écran entier
 * (`lib/crmDarkBascule.ts`) ; le glyphe, lui, est le seul élément qui CHANGE DE
 * FORME, et un échange instantané de pictogramme au milieu d'une révélation fluide
 * se lisait comme un saut. Il anime rotation, échelle et opacité — des propriétés
 * du compositeur —, jamais une couleur : la couleur, c'est la révélation qui la
 * porte. ⚠ La couche du nouvel écran est VIVANTE pendant la révélation : le glyphe
 * y tourne, il n'est pas figé dans la photo.
 *
 * En mouvement réduit : un simple échange, sans rotation ni ressort.
 */
import { AnimatePresence, motion } from 'motion/react'
import MEIcon from '@/components/propertyx/MEIcon'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export function IconeTheme({ dark, size, color, strokeWidth }: {
  dark: boolean
  size: number
  color?: string
  strokeWidth: number
}) {
  const reduit = useReducedMotion()
  const nom = dark ? 'moon' : 'sun'
  return (
    // ⚠ La couleur est posée sur l'ENVELOPPE, et les glyphes en héritent : l'astre
    // qui sort garde son élément d'avant la bascule — avec sa couleur propre, il
    // tournait dans l'ancienne encre et se fondait dans le nouveau fond.
    <span aria-hidden style={{ position: 'relative', width: size, height: size, display: 'inline-block', flexShrink: 0, color }}>
      {/* `initial={false}` : au montage, le glyphe est là — seul un CHANGEMENT s'anime. */}
      <AnimatePresence initial={false}>
        <motion.span
          key={nom}
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
          initial={reduit ? { opacity: 0 } : { rotate: -120, scale: 0.3, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={reduit ? { opacity: 0 } : { rotate: 120, scale: 0.3, opacity: 0 }}
          transition={reduit ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 24, mass: 0.7 }}
        >
          <MEIcon name={nom} size={size} strokeWidth={strokeWidth} />
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
