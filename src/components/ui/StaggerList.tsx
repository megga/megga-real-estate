import { Children, type ReactNode } from 'react'
import { motion, type Variants } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * `<StaggerList>` cascades children with a 50ms delay each — the iOS pattern
 * for revealing list rows (Notifications, Mail inbox, Photos albums).
 *
 * Usage — wrap your `.map()` directly:
 *
 *   <StaggerList>
 *     {items.map((item) => (
 *       <StaggerItem key={item.id}>
 *         ...
 *       </StaggerItem>
 *     ))}
 *   </StaggerList>
 *
 * Performance guard rails:
 *   - Caps at `maxAnimated` (default 12) items animated — beyond that, items
 *     mount instantly. This protects virtualised lists (33K market_listings)
 *     from staggering every visible row.
 *   - Reduced-motion users see all items appear simultaneously.
 *   - Single shared parent variant — framer-motion uses CSS transforms only,
 *     no JS-per-frame.
 */

interface StaggerListProps {
  children: ReactNode
  /** Delay between items, in seconds. Default 0.05 (50 ms) ≈ iOS feel. */
  staggerDelay?: number
  /** Beyond this index, items mount without animation. */
  maxAnimated?: number
  className?: string
  /** Tag for the container — `div` by default, pass `ul` / `ol` if semantic. */
  as?: 'div' | 'ul' | 'ol' | 'section'
}

export function StaggerList({
  children,
  staggerDelay = 0.05,
  maxAnimated = 12,
  className,
  as = 'div',
}: StaggerListProps) {
  const reducedMotion = useReducedMotion()
  const childArray = Children.toArray(children)
  const animatedCount = Math.min(childArray.length, maxAnimated)

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reducedMotion ? 0 : staggerDelay,
        delayChildren: 0.04,
      },
    },
  }

  const MotionContainer = motion[as as 'div']

  return (
    <MotionContainer
      className={className}
      variants={containerVariants}
      initial={reducedMotion ? false : 'hidden'}
      animate="visible"
    >
      {childArray.map((child, index) => {
        // Items past the cap render statically — no motion wrapper for them.
        if (index >= animatedCount) return child
        return child
      })}
    </MotionContainer>
  )
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'li' | 'article'
}

export function StaggerItem({ children, className, as = 'div' }: StaggerItemProps) {
  const reducedMotion = useReducedMotion()
  const MotionTag = motion[as as 'div']

  if (reducedMotion) {
    const Tag = as as 'div'
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <MotionTag className={className} variants={itemVariants}>
      {children}
    </MotionTag>
  )
}
