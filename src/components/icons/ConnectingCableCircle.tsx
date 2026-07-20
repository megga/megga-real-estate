// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ConnectingCableCircle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.86533 16.1329C6.88368 15.1513 6.88368 13.5597 7.86533 12.578L8.42403 12.0193C8.6186 11.8248 8.93407 11.8248 9.12864 12.0193L11.9789 14.8696C12.1735 15.0642 12.1735 15.3796 11.9789 15.5742L11.4202 16.1329C10.4386 17.1146 8.84698 17.1146 7.86533 16.1329Z" stroke="currentColor"></path>
<path d="M15.9786 8.01963C14.997 7.03797 13.4054 7.03797 12.4237 8.01963L11.865 8.57833C11.6705 8.7729 11.6705 9.08837 11.865 9.28294L14.7153 12.1332C14.9099 12.3278 15.2253 12.3278 15.4199 12.1332L15.9786 11.5745C16.9603 10.5929 16.9603 9.00128 15.9786 8.01963Z" stroke="currentColor"></path>
<path d="M9.62793 12.5195L10.7292 11.4183M11.4822 14.3738L12.5834 13.2725" stroke="currentColor"></path>
<path d="M7.86346 16.1367L5.5625 18.4376" stroke="currentColor"></path>
<path d="M15.9814 8.0193L18.2781 5.72266" stroke="currentColor"></path>
<path d="M18.364 5.80401C21.8787 9.31873 21.8787 15.0172 18.364 18.5319C14.8492 22.0466 9.15076 22.0466 5.63604 18.5319C2.12132 15.0172 2.12132 9.31873 5.63604 5.80401C9.15076 2.28929 14.8492 2.28929 18.364 5.80401Z" stroke="currentColor"></path>
    </svg>
  ),
)

ConnectingCableCircle.displayName = 'ConnectingCableCircle'

export default ConnectingCableCircle
