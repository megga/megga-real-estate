// MEGGA Marketplace — Bouton WhatsApp.
//
// Reprend l'anatomie "primary-button" du template Property X (= PxButton :
// pill radius 200, padding asymétrique pl-16/pr-6-10, texte 16/Medium, icône
// dans un cercle 28px à droite) mais avec le glyphe WhatsApp officiel
// (PxSocialIcon) au lieu de la flèche, et un fond vert de marque #25D366.
//
// Rôle : amorcer une conversation WhatsApp côté visiteur. Construit un lien
// `wa.me` (= zéro intégration, zéro API) :
//   - le numéro est normalisé (digits only, format international sans +)
//   - le message d'amorce est encodé et pré-rempli
//   - ouvre WhatsApp (mobile) ou WhatsApp Web (desktop) du visiteur
//
// C'est le 1er maillon de l'intégration WhatsApp : le client fait le premier
// pas en cliquant, la conversation arrive ensuite côté MEGGA. Aucun branchement
// OpenWA / Meta requis pour CE bouton.

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { buildWaMeUrl } from '@/lib/waMeUrl'
import { PX } from './tokens'
import PxSocialIcon from './PxSocialIcon'

const TAP_SCALE = 0.96
const TAP_SPRING = { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.6 }

const WA_GREEN = '#25D366'

export type PxWhatsAppVariant = 'brand' | 'dark' | 'invert'
export type PxWhatsAppSize = 'sm' | 'lg'

interface PxWhatsAppButtonProps {
  /** Numéro au format international, espaces/+/tirets tolérés (ex. "+41 79 123 45 67"). */
  phone: string
  /** Message d'amorce pré-rempli dans WhatsApp (sera encodé). */
  message?: string
  /** Libellé du bouton. */
  children?: ReactNode
  /** brand = vert WhatsApp (défaut, max reconnaissance) · dark/invert = monochrome Property X. */
  variant?: PxWhatsAppVariant
  size?: PxWhatsAppSize
  /** Prend toute la largeur du conteneur (utile en carte / formulaire). */
  fullWidth?: boolean
  className?: string
  /** aria-label personnalisé (sinon dérivé du libellé). */
  ariaLabel?: string
}

function palette(variant: PxWhatsAppVariant) {
  switch (variant) {
    case 'dark':
      // Monochrome Property X : fond noir, cercle blanc, glyphe noir.
      return { bg: PX.neutral700, text: PX.neutral100, circle: PX.neutral100, glyph: PX.neutral700, shadow: undefined as string | undefined }
    case 'invert':
      return { bg: PX.neutral100, text: PX.neutral700, circle: PX.neutral700, glyph: PX.neutral100, shadow: PX.shadow.small }
    case 'brand':
    default:
      // Vert WhatsApp, cercle blanc, glyphe vert — affordance universelle.
      return { bg: WA_GREEN, text: '#FFFFFF', circle: '#FFFFFF', glyph: WA_GREEN, shadow: undefined }
  }
}

export default function PxWhatsAppButton({
  phone,
  message,
  children = 'Discuter sur WhatsApp',
  variant = 'brand',
  size = 'lg',
  fullWidth = false,
  className,
  ariaLabel,
}: PxWhatsAppButtonProps) {
  const reducedMotion = useReducedMotion()
  const isLarge = size === 'lg'
  const p = palette(variant)
  const href = buildWaMeUrl(phone, message)

  const label = typeof children === 'string' ? children : 'WhatsApp'

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel ?? `${label} (s'ouvre dans WhatsApp)`}
      whileTap={reducedMotion ? undefined : { scale: TAP_SCALE }}
      transition={TAP_SPRING}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingLeft: 16,
        paddingRight: isLarge ? 10 : 6,
        paddingTop: isLarge ? 10 : 6,
        paddingBottom: isLarge ? 10 : 6,
        borderRadius: PX.radius.pill,
        background: p.bg,
        color: p.text,
        border: 0,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: p.shadow,
        textDecoration: 'none',
      }}
    >
      <span style={{ paddingTop: 2, display: 'inline-block' }}>{children}</span>
      <span style={{
        width: 28,
        height: 28,
        borderRadius: PX.radius.pill,
        background: p.circle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: p.glyph,
      }}>
        <PxSocialIcon name="whatsapp" size={16} color="mono" />
      </span>
    </motion.a>
  )
}
