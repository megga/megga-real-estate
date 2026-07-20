// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Subtitle = forwardRef<SVGSVGElement, Props>(
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
      <path d="M7.77538 3.75781H16.2344C19.1777 3.75781 21.001 5.39922 20.9922 8.41641V15.5755C20.9922 18.5927 19.1689 20.2429 16.2256 20.2429H7.77538C4.84089 20.2429 3.00781 18.5635 3.00781 15.4987V8.41641C3.00781 5.39922 4.84089 3.75781 7.77538 3.75781Z" stroke="currentColor"></path>
<path d="M7.20312 15.832H9.41372M14.8577 15.832H16.7968" stroke="currentColor"></path>
<path d="M13.9635 12.375H11.6226M8.91773 12.375H7.26367" stroke="currentColor"></path>
<path d="M11.9866 15.832H11.9766" stroke="currentColor"></path>
<path d="M16.752 12.375H16.762" stroke="currentColor"></path>
<path d="M21 8.57422H3" stroke="currentColor"></path>
    </svg>
  ),
)

Subtitle.displayName = 'Subtitle'

export default Subtitle
