// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PieChart = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M20.999 11.4037C21.0555 8.15401 17.0644 2.91559 12.1996 3.0051C11.8201 3.01969 11.5156 3.3252 11.5029 3.70466C11.4854 5.38983 11.4893 8.22503 11.4952 10.135C11.4981 11.2432 12.3893 12.1373 13.4975 12.1441C15.5475 12.1587 18.6727 12.1704 20.3725 12.1276C20.7286 12.0692 20.9922 11.7647 20.999 11.4037Z" stroke="currentColor"></path>
<path d="M8.32094 3.78638C6.98627 4.38421 5.81738 5.29827 4.91545 6.44947C4.01351 7.60067 3.40569 8.95432 3.1446 10.3933C2.8835 11.8322 2.97699 13.3131 3.41699 14.7078C3.85698 16.1025 4.63021 17.3689 5.66977 18.3976C6.70932 19.4262 7.98388 20.186 9.38314 20.6112C10.7824 21.0364 12.2642 21.1143 13.7003 20.838C15.1364 20.5617 16.4836 19.9396 17.6252 19.0255C18.7668 18.1115 19.6684 16.933 20.2521 15.5921" stroke="currentColor"></path>
    </svg>
  ),
)

PieChart.displayName = 'PieChart'

export default PieChart
