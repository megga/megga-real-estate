// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserHearing2 = forwardRef<SVGSVGElement, Props>(
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
      <path d="M5.49121 20.001C5.49121 17.8924 7.15489 15.2676 11.9496 15.2676C16.7442 15.2676 18.4079 17.8734 18.4079 19.983" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.1249 8.12346C16.1249 10.4014 14.2774 12.2489 11.9994 12.2489C9.72145 12.2489 7.87402 10.4014 7.87402 8.12346C7.87402 5.84548 9.72145 3.99805 11.9994 3.99805C14.2774 3.99805 16.1249 5.84548 16.1249 8.12346Z" stroke="currentColor"></path>
<path d="M18.8018 5.61523C19.2781 6.33451 19.5555 7.19692 19.5555 8.12398C19.5555 9.05105 19.2781 9.91346 18.8018 10.6327" stroke="currentColor"></path>
<path d="M5.19824 5.61523C4.72195 6.33451 4.44455 7.19692 4.44455 8.12398C4.44455 9.05105 4.72195 9.91346 5.19824 10.6327" stroke="currentColor"></path>
    </svg>
  ),
)

UserHearing2.displayName = 'UserHearing2'

export default UserHearing2
