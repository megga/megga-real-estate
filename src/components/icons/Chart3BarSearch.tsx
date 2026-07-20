// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarSearch = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.33398 10.8916V17.0661M11.5337 7.9375V17.0659M15.6651 14.1545V17.0656" stroke="currentColor"></path>
<path d="M11.7178 3.5H7.28313C4.34378 3.5 2.5 5.58119 2.5 8.52735V16.4736C2.5 19.4198 4.33503 21.5 7.28313 21.5H15.7169C18.6659 21.5 20.5 19.4198 20.5 16.4736V12.5274" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.9467 7.05352C17.9883 8.09508 19.6775 8.09508 20.719 7.05352C21.7606 6.01196 21.7606 4.32273 20.719 3.28117C19.6775 2.23961 17.9883 2.23961 16.9467 3.28117C15.9051 4.32273 15.9051 6.01196 16.9467 7.05352Z" stroke="currentColor"></path>
<path d="M15.1534 8.84639L16.9451 7.0546" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarSearch.displayName = 'Chart3BarSearch'

export default Chart3BarSearch
