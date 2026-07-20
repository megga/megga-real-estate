// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldRemove = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3237 13.6284C19.3237 19.7416 11.9997 21.959 11.9997 21.959C11.9997 21.959 4.67669 19.7426 4.67669 13.6284C4.67669 7.51419 4.40969 7.03648 4.99769 6.44878C5.58669 5.86018 11.0397 3.95898 11.9997 3.95898C12.9607 3.95898 18.4127 5.85528 19.0007 6.44878C19.5897 7.04138 19.3237 7.51519 19.3237 13.6284Z" stroke="currentColor"></path>
<path d="M10.2061 14.5308L13.7941 10.9434M13.7941 14.5308L10.2061 10.9434L13.7941 14.5308Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldRemove.displayName = 'ShieldRemove'

export default ShieldRemove
