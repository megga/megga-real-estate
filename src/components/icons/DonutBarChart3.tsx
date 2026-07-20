// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DonutBarChart3 = forwardRef<SVGSVGElement, Props>(
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
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M15.6552 6.07122C12.5524 3.48186 7.92954 3.72041 5.11282 6.69576C4.22669 7.63179 3.6208 8.73148 3.29232 9.89127C2.53471 12.5662 3.25273 15.5608 5.41158 17.6046C7.00077 19.109 9.06172 19.8057 11.0876 19.7084C12.8547 19.6236 14.5952 18.9347 15.9726 17.651C16.1705 17.4665 16.1611 17.155 15.9646 16.969L14.3485 15.439C14.152 15.253 13.8434 15.2639 13.6374 15.4393C12.8389 16.1193 11.8555 16.4777 10.862 16.5097C9.70075 16.5471 8.52557 16.1387 7.6152 15.2768C6.38258 14.1099 5.95341 12.4128 6.34663 10.8774C6.5306 10.159 6.89459 9.47608 7.44054 8.89938C9.03977 7.21009 11.6349 7.02986 13.4447 8.40746C13.6601 8.57135 13.9688 8.56543 14.1548 8.36893L15.6848 6.75279C15.8708 6.55629 15.863 6.24459 15.6552 6.07122Z" stroke="currentColor"></path>
<path d="M19.0878 16.1683C19.294 16.3435 19.6052 16.319 19.7645 16.1003C21.6425 13.5217 21.3514 9.94202 19.0813 7.70075C18.8888 7.51064 18.5778 7.53677 18.4026 7.74298L17.2977 9.0435C17.1225 9.24972 17.1507 9.55712 17.3327 9.75728C18.4843 11.0231 18.6384 12.9181 17.7065 14.3534C17.5592 14.5803 17.581 14.8882 17.7873 15.0634L19.0878 16.1683Z" stroke="currentColor"></path>
<path d="M6.34679 10.8769L3.29248 9.89075" stroke="currentColor"></path>
<path d="M9.26562 16.2666L8.01221 19.1995" stroke="currentColor"></path>
    </svg>
  ),
)

DonutBarChart3.displayName = 'DonutBarChart3'

export default DonutBarChart3
