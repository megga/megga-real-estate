// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Incognito = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M10.1759 17.4464C10.1759 19.2194 8.73886 20.6563 6.96586 20.6563C5.19286 20.6563 3.75586 19.2194 3.75586 17.4464C3.75586 15.6734 5.19286 14.2363 6.96586 14.2363C8.73886 14.2363 10.1759 15.6734 10.1759 17.4464Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.2462 17.4464C20.2462 19.2194 18.8092 20.6563 17.0362 20.6563C15.2632 20.6563 13.8262 19.2194 13.8262 17.4464C13.8262 15.6734 15.2632 14.2363 17.0362 14.2363C18.8092 14.2363 20.2462 15.6734 20.2462 17.4464Z" stroke="currentColor"></path>
<path d="M10.1758 17.4072C11.4478 16.9842 12.6638 16.9892 13.8258 17.4072" stroke="currentColor"></path>
<path d="M18.753 10.1252L18.483 7.40021C18.286 5.41821 16.619 3.9082 14.627 3.9082H9.376C7.384 3.9082 5.717 5.41821 5.52 7.40021L5.25 10.1252" stroke="currentColor"></path>
<path d="M3 10.7911C8.955 9.81006 14.956 9.82406 21 10.7911" stroke="currentColor"></path>
    </svg>
  ),
)

Incognito.displayName = 'Incognito'

export default Incognito
