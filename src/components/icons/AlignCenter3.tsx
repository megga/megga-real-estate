// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const AlignCenter3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.9971 21V3" stroke="currentColor"></path>
<path d="M9.40696 20.0039H6.1401C4.94682 20.0039 3.98828 19.0356 3.98828 17.8521V15.9253C3.98828 14.732 4.94682 13.7734 6.1401 13.7734H9.40696" stroke="currentColor"></path>
<path d="M11.998 13.7734H17.8569C19.0404 13.7734 20.0087 14.732 20.0087 15.9253V17.8521C20.0087 19.0356 19.0404 20.0039 17.8569 20.0039H11.998" stroke="currentColor"></path>
<path d="M11.998 3.99414H15.6268C16.8201 3.99414 17.7786 4.96246 17.7786 6.14596V8.07282C17.7786 9.26611 16.8201 10.2246 15.6268 10.2246H11.998" stroke="currentColor"></path>
<path d="M9.40738 10.2246H8.36081C7.1773 10.2246 6.20898 9.26611 6.20898 8.07282V6.14596C6.20898 4.96246 7.1773 3.99414 8.36081 3.99414H9.40738" stroke="currentColor"></path>
    </svg>
  ),
)

AlignCenter3.displayName = 'AlignCenter3'

export default AlignCenter3
