// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterRefresh4 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M17.8283 4.61523C19.2459 4.61523 20.394 5.7643 20.394 7.18094V8.48471C20.394 9.50632 19.961 10.4793 19.2031 11.1623L14.4959 15.8179C14.1855 16.0972 14.0094 16.4941 14.0094 16.9106V18.8117C14.0094 19.414 13.6416 19.9559 13.0821 20.1788L11.2831 20.8949C10.317 21.2802 9.26812 20.5679 9.26812 19.5288V16.4465C9.26812 16.0563 9.11342 15.6817 8.8371 15.4064L4.66309 11.6897C3.98785 11.0134 3.60742 10.0969 3.60742 9.14146V7.18094C3.60742 5.7643 4.75649 4.61523 6.1741 4.61523" stroke="currentColor"></path>
<path d="M11.4649 4.58301L9.90625 3.79199C10.4647 3.2987 11.1974 3 12.001 3C13.7495 3 15.1671 4.41761 15.1671 6.16602" stroke="currentColor"></path>
<path d="M12.5381 7.74903L14.0967 8.54005C13.5383 9.03334 12.8056 9.33204 12.002 9.33204C10.2535 9.33204 8.83594 7.91443 8.83594 6.16602" stroke="currentColor"></path>
    </svg>
  ),
)

FilterRefresh4.displayName = 'FilterRefresh4'

export default FilterRefresh4
