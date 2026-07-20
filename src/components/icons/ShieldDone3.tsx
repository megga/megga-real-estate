// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldDone3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M11.9844 21.6057C14.3194 21.6057 19.6564 19.2837 19.6564 12.8787C19.6564 6.47473 19.9344 5.97373 19.3194 5.35773C18.7034 4.74173 15.4934 2.75073 11.9844 2.75073C8.47544 2.75073 5.26544 4.74173 4.65044 5.35773C4.03444 5.97373 4.31244 6.47473 4.31244 12.8787C4.31244 19.2837 9.65044 21.6057 11.9844 21.6057Z" stroke="currentColor"></path>
<path d="M9.38586 11.8749L11.2779 13.7699L15.1759 9.86987" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldDone3.displayName = 'ShieldDone3'

export default ShieldDone3
