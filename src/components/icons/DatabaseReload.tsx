// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseReload = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.3732 8.82182C15.4199 8.82182 18.7004 7.49845 18.7004 5.86599C18.7004 4.23353 15.4199 2.91016 11.3732 2.91016C7.32643 2.91016 4.0459 4.23353 4.0459 5.86599C4.0459 7.49845 7.32643 8.82182 11.3732 8.82182Z" stroke="currentColor"></path>
<path d="M4.0459 11.6836V17.5337C4.0459 17.5337 4.0459 20.1371 10.2374 20.43" stroke="currentColor"></path>
<path d="M18.7008 11.686V5.83594" stroke="currentColor"></path>
<path d="M10.2374 14.5785C4.0459 14.2856 4.0459 11.6821 4.0459 11.6821V5.83203" stroke="currentColor"></path>
<path d="M15.2102 15.2887C14.3058 15.8369 13.7021 16.8294 13.7021 17.9644C13.7021 19.6911 15.1013 21.0903 16.8281 21.0903C18.5548 21.0903 19.955 19.6911 19.955 17.9644C19.955 16.7423 19.2534 15.6845 18.2322 15.1699" stroke="currentColor"></path>
<path d="M18.2314 16.9006V15.1699H19.9522" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseReload.displayName = 'DatabaseReload'

export default DatabaseReload
