// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Store8 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3.7925 10.5035C4.55531 11.2255 5.68784 11.4026 6.69584 11.1068L6.96924 11.026C7.41194 10.8966 7.88675 10.9317 8.30416 11.1253L10.4894 12.1381C11.4478 12.5818 12.5531 12.5818 13.5105 12.1381L15.6958 11.1253C16.1142 10.9317 16.588 10.8966 17.0307 11.026L17.3041 11.1068C18.3121 11.4026 19.4456 11.2255 20.2084 10.5035C20.7572 9.98398 21.089 9.27371 20.979 8.51091C20.8623 7.69945 20.4711 6.42292 20.1306 5.40422C19.8115 4.44876 18.9183 3.8066 17.9112 3.8066H6.07606C5.06514 3.8066 4.16807 4.4546 3.85282 5.41589C3.5191 6.43265 3.13769 7.70334 3.02094 8.51091C2.91099 9.27371 3.24374 9.98398 3.7925 10.5035Z" stroke="currentColor"></path>
<path d="M7.4834 10.9364L8.22967 7.99023" stroke="currentColor"></path>
<path d="M16.5158 10.9364L15.7695 7.99023" stroke="currentColor"></path>
<path d="M19.4605 11.0508V16.0265C19.4605 18.4677 17.9398 20.1928 15.4957 20.1928H8.50391C6.05884 20.1928 4.53809 18.4677 4.53809 16.0265V11.0508" stroke="currentColor"></path>
<path d="M9.60059 20.1933V17.3348C9.60059 16.356 10.3945 15.561 11.3743 15.561H12.6898C13.6335 15.561 14.3983 16.3268 14.3983 17.2705V20.1933" stroke="currentColor"></path>
    </svg>
  ),
)

Store8.displayName = 'Store8'

export default Store8
