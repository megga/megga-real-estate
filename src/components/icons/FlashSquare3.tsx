// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const FlashSquare3 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M3 13.9825V10.0195" stroke="currentColor"></path>
<path d="M21 13.9825V10.0195" stroke="currentColor"></path>
<path d="M13.9785 3H10.0156" stroke="currentColor"></path>
<path d="M13.9785 21H10.0156" stroke="currentColor"></path>
<path d="M3.02539 16.9141C3.33771 19.147 4.81955 20.7174 7.07199 20.9801" stroke="currentColor"></path>
<path d="M16.8906 20.9801C19.1431 20.7164 20.6152 19.147 20.9275 16.9141" stroke="currentColor"></path>
<path d="M3.02539 7.09531C3.33771 4.86234 4.81955 3.28321 7.07199 3.01953" stroke="currentColor"></path>
<path d="M16.8906 3.01953C19.1431 3.28321 20.6152 4.86234 20.9275 7.09531" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M11.6337 7.46766L8.1002 12.3347C7.84807 12.6818 8.0961 13.1681 8.52488 13.1681H11.4154V16.224C11.4154 16.7324 12.0671 16.9444 12.3659 16.5321L15.8994 11.6656C16.1515 11.3184 15.9035 10.8316 15.4747 10.8316H12.5836V7.77627C12.5836 7.26739 11.9325 7.05582 11.6337 7.46766Z" stroke="currentColor"></path>
    </svg>
  ),
)

FlashSquare3.displayName = 'FlashSquare3'

export default FlashSquare3
