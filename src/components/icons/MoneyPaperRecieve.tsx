// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperRecieve = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.2968 19.0398H6.18447C4.22106 19.0398 3 17.6543 3 15.6938V8.30619C3 6.34569 4.22106 4.96021 6.1835 4.96021H17.7908C19.7474 4.96021 20.9743 6.34569 20.9743 8.30619V10.3017" stroke="currentColor"></path>
<path d="M6.20898 8.45605H7.61004" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.70117 11.9993C9.70117 10.7374 10.7237 9.71484 11.9857 9.71484C13.2476 9.71484 14.2702 10.7374 14.2702 11.9993C14.2702 13.2613 13.2476 14.2838 11.9857 14.2838C10.7237 14.2838 9.70117 13.2613 9.70117 11.9993Z" stroke="currentColor"></path>
<path d="M18.0907 14.3857L15.957 16.5185L18.0907 18.6521" stroke="currentColor"></path>
<path d="M15.957 16.5186L20.9998 16.5189" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperRecieve.displayName = 'MoneyPaperRecieve'

export default MoneyPaperRecieve
