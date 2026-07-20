// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldAdd = forwardRef<SVGSVGElement, Props>(
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
      <path d="M19.3235 13.6284C19.3235 19.7416 11.9999 21.959 11.9999 21.959C11.9999 21.959 4.67644 19.7426 4.67644 13.6284C4.67644 7.51419 4.40984 7.03648 4.99844 6.44878C5.58614 5.86018 11.0396 3.95898 11.9999 3.95898C12.9602 3.95898 18.4128 5.85528 19.0014 6.44878C19.5891 7.04138 19.3235 7.51519 19.3235 13.6284Z" stroke="currentColor"></path>
<path d="M9.46387 12.7382H14.537M12.0004 15.2743V10.2012V15.2743Z" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldAdd.displayName = 'ShieldAdd'

export default ShieldAdd
