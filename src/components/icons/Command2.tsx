// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Command2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M6.28612 8.57129C5.024 8.57129 4 7.54824 4 6.28518C4 5.02306 5.024 4 6.28612 4C7.54824 4 8.57224 5.02306 8.57224 6.28518V17.7139C8.57224 18.976 7.54824 20 6.28612 20C5.024 20 4 18.976 4 17.7139C4 16.4518 5.024 15.4287 6.28612 15.4287H17.7148C18.9769 15.4287 20 16.4518 20 17.7139C20 18.976 18.9769 20 17.7148 20C16.4527 20 15.4287 18.976 15.4287 17.7139V6.28518C15.4287 5.02306 16.4527 4 17.7148 4C18.9769 4 20 5.02306 20 6.28518C20 7.54824 18.9769 8.57129 17.7148 8.57129H6.28612Z" stroke="currentColor"></path>
    </svg>
  ),
)

Command2.displayName = 'Command2'

export default Command2
