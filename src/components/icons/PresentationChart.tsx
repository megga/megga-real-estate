// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PresentationChart = forwardRef<SVGSVGElement, Props>(
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
      <path d="M16.144 12.3369V11.5875" stroke="currentColor"></path>
<path d="M6.88349 3.00119H17.1164C19.2576 3.00119 20.9926 4.73619 20.9926 6.87735V12.4866C20.9926 14.6268 19.2576 16.3628 17.1164 16.3628H6.88349C4.74232 16.3628 3.00732 14.6268 3.00732 12.4866V6.87735C3.00732 4.73619 4.74232 3.00119 6.88349 3.00119Z" stroke="currentColor"></path>
<path d="M12.0002 16.3625V21.001M12.0002 16.3625L17.5663 21.001M12.0002 16.3625L6.43408 21.001" stroke="currentColor"></path>
<path d="M7.85596 12.3371V7.02637" stroke="currentColor"></path>
<path d="M12 12.3371V9.7959" stroke="currentColor"></path>
    </svg>
  ),
)

PresentationChart.displayName = 'PresentationChart'

export default PresentationChart
