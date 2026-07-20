// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperPlus3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M20.1601 8.29988L14.4901 2.89988C13.7601 2.79988 12.9401 2.74988 12.0401 2.74988C5.75015 2.74988 3.65015 5.06988 3.65015 11.9999C3.65015 18.9399 5.75015 21.2499 12.0401 21.2499C18.3401 21.2499 20.4401 18.9399 20.4401 11.9999C20.4401 10.5799 20.3501 9.34988 20.1601 8.29988Z" stroke="currentColor"></path>
<path d="M13.9341 2.83252V5.49352C13.9341 7.35152 15.4401 8.85652 17.2981 8.85652H20.2491" stroke="currentColor"></path>
<path d="M14.3124 12.9805H9.41235" stroke="currentColor"></path>
<path d="M11.8633 15.4306V10.5306" stroke="currentColor"></path>
    </svg>
  ),
)

PaperPlus3.displayName = 'PaperPlus3'

export default PaperPlus3
