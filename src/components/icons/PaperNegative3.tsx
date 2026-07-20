// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PaperNegative3 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M20.1599 8.29988L14.4899 2.89988C13.7599 2.79988 12.9399 2.74988 12.0399 2.74988C5.7499 2.74988 3.6499 5.06988 3.6499 11.9999C3.6499 18.9399 5.7499 21.2499 12.0399 21.2499C18.3399 21.2499 20.4399 18.9399 20.4399 11.9999C20.4399 10.5799 20.3499 9.34988 20.1599 8.29988Z" stroke="currentColor"></path>
<path d="M13.9343 2.83252V5.49352C13.9343 7.35152 15.4403 8.85652 17.2983 8.85652H20.2493" stroke="currentColor"></path>
<path d="M14.3124 12.9805H9.41235" stroke="currentColor"></path>
    </svg>
  ),
)

PaperNegative3.displayName = 'PaperNegative3'

export default PaperNegative3
