// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Lamp6 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M9.42181 15.5816C7.07792 14.5931 5.43359 12.2716 5.43359 9.56087C5.43359 5.48412 9.15521 2.28401 13.3769 3.13925C15.8765 3.65104 17.8984 5.6612 18.4199 8.16077C19.098 11.427 17.3204 14.4374 14.5873 15.5923L14.5844 16.8796C14.5825 17.7076 13.9111 18.378 13.0841 18.378H10.9192C10.0883 18.378 9.41597 17.7027 9.41792 16.8728L9.42181 15.5816Z" stroke="currentColor"></path>
<path d="M10.7109 21H13.2864" stroke="currentColor"></path>
<path d="M14.5871 15.5938L12.1387 15.594" stroke="currentColor"></path>
    </svg>
  ),
)

Lamp6.displayName = 'Lamp6'

export default Lamp6
