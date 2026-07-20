// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter12 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
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
      <path d="M3 5.96641C3 4.44663 4.23178 3.21484 5.75157 3.21484H18.2484C19.7682 3.21484 21 4.44663 21 5.96641V7.36457C21 8.45917 20.5359 9.5022 19.7225 10.2358L14.6747 15.2272C14.3429 15.5268 14.1532 15.953 14.1532 16.3996V18.438C14.1532 19.084 13.7601 19.6649 13.1598 19.9033L11.2304 20.6719C10.1951 21.0845 9.06941 20.3217 9.06941 19.2066V15.9014C9.06941 15.4831 8.90303 15.0812 8.60724 14.7854L4.13157 10.8011C3.40768 10.0762 3 9.09355 3 8.06803V5.96641Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter12.displayName = 'Filter12'

export default Filter12
