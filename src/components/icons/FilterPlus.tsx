// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FilterPlus = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.0913 3.86914C19.5732 3.86914 20.7739 5.06984 20.7739 6.55175V7.91495C20.7739 8.98235 20.3215 9.99915 19.5285 10.7143L14.607 15.5814C14.2839 15.8733 14.0991 16.2878 14.0991 16.7237V18.7115C14.0991 19.3411 13.7147 19.9074 13.1299 20.1399L11.2491 20.8892C10.2391 21.291 9.1425 20.5476 9.1425 19.4598V16.2381C9.1425 15.8304 8.98001 15.4393 8.69199 15.1503L4.32801 11.265C3.6216 10.5586 3.22461 9.60021 3.22461 8.60092V6.55175C3.22461 5.06984 4.42531 3.86914 5.90722 3.86914" stroke="currentColor"></path>
<path d="M14.4027 5.62734H9.14648M11.7748 8.25624V3" stroke="currentColor"></path>
    </svg>
  ),
)

FilterPlus.displayName = 'FilterPlus'

export default FilterPlus
