// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PieChartBox = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.78313 21.0005H16.2178C19.1659 21.0005 21 18.9203 21 15.9741V8.02784C21 5.08168 19.1659 3.00049 16.2169 3.00049H7.78313C4.83503 3.00049 3 5.08168 3 8.02784V15.9741C3 18.9203 4.84378 21.0005 7.78313 21.0005Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.6226 11.1404C16.6479 9.68487 14.8615 7.34001 12.683 7.3799C12.5128 7.38671 12.3766 7.5239 12.3707 7.69417C12.3629 8.44822 12.3649 9.71698 12.3678 10.5732C12.3688 11.0684 12.7677 11.4683 13.2639 11.4722C14.1814 11.4781 15.5815 11.4839 16.3424 11.4644C16.501 11.4382 16.6197 11.302 16.6226 11.1404Z" stroke="currentColor"></path>
<path d="M9.62873 8.03142C9.02109 8.39449 8.50494 8.89224 8.12006 9.48631C7.73519 10.0804 7.49186 10.7549 7.40885 11.4578C7.32584 12.1608 7.40536 12.8734 7.64128 13.5408C7.8772 14.2082 8.26321 14.8125 8.76957 15.3071C9.27592 15.8017 9.8891 16.1734 10.5618 16.3936C11.2345 16.6139 11.9488 16.6766 12.6497 16.5772C13.3505 16.4777 14.0191 16.2186 14.604 15.8199C15.1889 15.4212 15.6744 14.8935 16.0231 14.2776" stroke="currentColor"></path>
    </svg>
  ),
)

PieChartBox.displayName = 'PieChartBox'

export default PieChartBox
