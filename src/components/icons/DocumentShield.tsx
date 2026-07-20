// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DocumentShield = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.785 3.28323C14.343 3.28323 14.877 3.51124 15.264 3.91424L19.055 7.86325C19.421 8.24425 19.627 8.75323 19.627 9.28323V17.4482C19.64 19.5032 18.023 21.2002 15.969 21.2832C15.969 21.2832 8.07402 21.2832 8.04302 21.2822C5.97102 21.2372 4.32797 19.5202 4.37297 17.4482V6.94122C4.42197 4.90122 6.09402 3.27523 8.13402 3.28323H13.785Z" stroke="currentColor"></path>
<path d="M14.2686 3.3457V6.23871C14.2676 7.64971 15.4106 8.79568 16.8226 8.79968H19.5616" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.5835 16.9096C11.5835 16.9096 14.0735 16.1556 14.0735 14.0776C14.0735 11.9986 14.1635 12.0656 13.9645 11.8636C13.7635 11.6626 11.9105 11.0176 11.5835 11.0176C11.2565 11.0176 9.40255 11.6636 9.20255 11.8636C9.00355 12.0636 9.09354 11.9976 9.09354 14.0776C9.09354 16.1556 11.5835 16.9096 11.5835 16.9096Z" stroke="currentColor"></path>
    </svg>
  ),
)

DocumentShield.displayName = 'DocumentShield'

export default DocumentShield
