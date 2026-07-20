// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.0607 8.93704C15.1074 8.93704 18.3879 7.61368 18.3879 5.98122C18.3879 4.34876 15.1074 3.02539 11.0607 3.02539C7.01393 3.02539 3.7334 4.34876 3.7334 5.98122C3.7334 7.61368 7.01393 8.93704 11.0607 8.93704Z" stroke="currentColor"></path>
<path d="M18.8369 19.5439L20.2675 20.9745" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.2881 17.6582C14.2881 19.1282 15.4802 20.3213 16.9512 20.3213C17.6881 20.3213 18.3541 20.0228 18.8359 19.5439C19.3167 19.0533 19.6133 18.3932 19.6133 17.6582C19.6133 16.1882 18.4221 14.9951 16.9512 14.9951C15.4802 14.9951 14.2881 16.1882 14.2881 17.6582Z" stroke="currentColor"></path>
<path d="M3.7334 11.7627V17.5874C3.7334 17.5874 3.7334 20.4997 11.0911 20.4997" stroke="currentColor"></path>
<path d="M18.3881 11.7622V5.9375" stroke="currentColor"></path>
<path d="M3.7334 5.9375V11.7622C3.7334 11.7622 3.7334 14.6745 11.0911 14.6745" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseSearch.displayName = 'DatabaseSearch'

export default DatabaseSearch
