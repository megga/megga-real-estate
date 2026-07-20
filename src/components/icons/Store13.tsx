// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store13 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.04099 7.87932C9.04099 9.51387 7.71583 10.839 6.08226 10.839C4.44771 10.839 3.12256 9.51387 3.12256 7.87932V5.3088C3.12256 4.03424 4.15583 3 5.43039 3H18.57C19.8446 3 20.8778 4.03424 20.8778 5.3088V7.87932C20.8778 9.51387 19.5527 10.839 17.9181 10.839C16.2846 10.839 14.9594 9.51387 14.9594 7.87932V6.95405" stroke="currentColor"></path>
<path d="M4.05566 10.1377V18.1236C4.06345 19.7192 5.36428 21.0074 6.95991 20.9996H17.0386C18.6343 21.0084 19.9361 19.7221 19.9448 18.1265V18.1246V10.1299" stroke="currentColor"></path>
<path d="M9.28711 21.0001V17.1647C9.28711 15.6654 10.5023 14.4512 12.0007 14.4512C13.5 14.4512 14.7152 15.6654 14.7152 17.1647V21.0001" stroke="currentColor"></path>
<path d="M14.9594 7.87888C14.9594 9.51343 13.6343 10.8386 12.0007 10.8386C10.3662 10.8386 9.04102 9.51343 9.04102 7.87888V6.95361" stroke="currentColor"></path>
    </svg>
  ),
)

Store13.displayName = 'Store13'

export default Store13
