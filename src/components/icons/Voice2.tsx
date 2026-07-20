// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Voice2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.2502 22.104V17.7141" stroke="currentColor" strokeLinecap="square"></path>
<path d="M9.52949 22.104H14.9697" stroke="currentColor" strokeLinecap="square"></path>
<path d="M20.7549 12.6037V8.21387" stroke="currentColor" strokeLinecap="square"></path>
<path d="M3.74512 12.604V8.21411" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.2504 17.7139C9.88378 17.7139 7.96484 15.7872 7.96484 13.4096V7.40945C7.96484 5.03185 9.88378 3.104 12.2504 3.104C14.6181 3.104 16.5359 5.03185 16.5359 7.40945V13.4096C16.5359 15.7872 14.6181 17.7139 12.2504 17.7139Z" stroke="currentColor" strokeLinecap="round"></path>
    </svg>
  ),
)

Voice2.displayName = 'Voice2'

export default Voice2
