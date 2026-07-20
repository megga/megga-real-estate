// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const GraphChart2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20 20.001H6C4.89543 20.001 4 19.1055 4 18.001V4.00098" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M10.1869 12.9638C10.1869 13.7614 9.54064 14.4069 8.74386 14.4069C7.94621 14.4069 7.30078 13.7614 7.30078 12.9638C7.30078 12.1661 7.94621 11.5207 8.74386 11.5207C9.54064 11.5207 10.1869 12.1661 10.1869 12.9638Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.1284 12.8007C16.1284 12.0039 16.7747 11.3576 17.5715 11.3576C18.3691 11.3576 19.0146 12.0039 19.0146 12.8007C19.0146 13.5983 18.3691 14.2438 17.5715 14.2438C16.7782 14.2472 16.1319 13.6062 16.1284 12.8129V12.8007Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.6347 7.85C14.6347 8.64678 13.9884 9.29308 13.1916 9.29308C12.394 9.29308 11.7485 8.64678 11.7485 7.85C11.7485 7.05235 12.394 6.40692 13.1916 6.40692C13.9884 6.40692 14.6347 7.05235 14.6347 7.85Z" stroke="currentColor"></path>
<path d="M9.71973 11.9095L12.2153 8.90765" stroke="currentColor"></path>
<path d="M16.5902 11.7495L14.1729 8.90424" stroke="currentColor"></path>
    </svg>
  ),
)

GraphChart2.displayName = 'GraphChart2'

export default GraphChart2
