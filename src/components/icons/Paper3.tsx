// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Paper3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M14.3053 15.4498H8.90527" stroke="currentColor"></path>
<path d="M12.2604 11.4385H8.90442" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M20.1598 8.29988L14.4898 2.89988C13.7598 2.79988 12.9398 2.74988 12.0398 2.74988C5.74978 2.74988 3.64978 5.06988 3.64978 11.9999C3.64978 18.9399 5.74978 21.2499 12.0398 21.2499C18.3398 21.2499 20.4398 18.9399 20.4398 11.9999C20.4398 10.5799 20.3498 9.34988 20.1598 8.29988Z" stroke="currentColor"></path>
<path d="M13.9342 2.83252V5.49352C13.9342 7.35152 15.4402 8.85652 17.2982 8.85652H20.2492" stroke="currentColor"></path>
    </svg>
  ),
)

Paper3.displayName = 'Paper3'

export default Paper3
