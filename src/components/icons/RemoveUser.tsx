// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const RemoveUser = forwardRef<SVGSVGElement, Props>(
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
      <path d="M4.9707 19.999C4.9707 17.8904 6.63438 15.2656 11.4291 15.2656" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.5536 8.12542C15.5536 10.4034 13.7061 12.2508 11.4282 12.2508C9.15016 12.2508 7.30273 10.4034 7.30273 8.12542C7.30273 5.84743 9.15016 4 11.4282 4C13.7061 4 15.5536 5.84743 15.5536 8.12542Z" stroke="currentColor"></path>
<path d="M19.029 18.6133H13.9316" stroke="currentColor"></path>
    </svg>
  ),
)

RemoveUser.displayName = 'RemoveUser'

export default RemoveUser
