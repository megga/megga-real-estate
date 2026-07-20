// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chart3BarRefresh = forwardRef<SVGSVGElement, Props>(
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
<path d="M21.3723 7.43297C20.8021 8.37287 19.7698 9.00141 18.5905 9.00141C16.7954 9.00141 15.3398 7.54584 15.3398 5.7507C15.3398 3.95459 16.7954 2.5 18.5905 2.5C19.8603 2.5 20.9607 3.22778 21.4958 4.29027" stroke="currentColor"></path>
<path d="M19.6953 4.2893H21.4943V2.5" stroke="currentColor"></path>
    </svg>
  ),
)

Chart3BarRefresh.displayName = 'Chart3BarRefresh'

export default Chart3BarRefresh
