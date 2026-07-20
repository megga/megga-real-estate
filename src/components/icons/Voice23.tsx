// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Voice23 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M13.7884 7.43804H15.9408" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.7083 11.0489H15.9431" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.2484 22.104V19.3326" stroke="currentColor" strokeLinecap="square"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.2485 15.7023C10.2078 15.7023 8.55304 14.0408 8.55304 11.9906V6.81664C8.55304 4.76641 10.2078 3.104 12.2485 3.104C14.2902 3.104 15.944 4.76641 15.944 6.81664V11.9906C15.944 14.0408 14.2902 15.7023 12.2485 15.7023Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M19.528 12.0201C19.528 16.0584 16.27 19.3324 12.2495 19.3324C8.22995 19.3324 4.97198 16.0584 4.97198 12.0201" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

Voice23.displayName = 'Voice23'

export default Voice23
