// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const MoneyPaperStar = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.5116 18.7168H6.18941C4.22303 18.7168 3 17.3293 3 15.3659V7.96737C3 6.00391 4.22303 4.61646 6.18843 4.61646H17.8116C19.7711 4.61646 21 6.00391 21 7.96737V9.96586" stroke="currentColor"></path>
<path d="M6.21484 8.11719H7.61787" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.71289 11.6664C9.71289 10.4025 10.7374 9.37891 12.0004 9.37891C13.2642 9.37891 14.2888 10.4025 14.2888 11.6664C14.2888 12.9303 13.2642 13.9538 12.0004 13.9538C10.7374 13.9538 9.71289 12.9303 9.71289 11.6664Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M17.1335 15.3569L17.8817 13.7758C17.978 13.5695 18.2563 13.5695 18.3516 13.7758L19.0998 15.3569L20.7753 15.6118C20.9894 15.6449 21.075 15.9251 20.9193 16.0817L19.7089 17.3174L19.994 19.0629C20.031 19.2857 19.8062 19.458 19.6136 19.3509L18.1171 18.5278L16.6197 19.3509C16.4281 19.458 16.2023 19.2857 16.2393 19.0629L16.5244 17.3174L15.314 16.0817C15.1583 15.9251 15.2439 15.6449 15.458 15.6118L17.1335 15.3569Z" stroke="currentColor"></path>
    </svg>
  ),
)

MoneyPaperStar.displayName = 'MoneyPaperStar'

export default MoneyPaperStar
