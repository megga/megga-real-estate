// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const PasswordUser = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.47437 3.28516H14.5273C16.2933 3.28516 17.3924 4.53214 17.3924 6.29614V11.0562C17.3924 12.8212 16.2933 14.0682 14.5263 14.0682H9.47437C7.70837 14.0682 6.61035 12.8212 6.61035 11.0562V6.29614C6.61035 4.53214 7.71337 3.28516 9.47437 3.28516Z" stroke="currentColor"></path>
<path d="M9.19824 14.0118V13.5198C9.19824 12.6068 9.92125 11.4648 11.9973 11.4648C14.0783 11.4648 14.8022 12.5958 14.8022 13.5098V14.0118" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.7889 7.64447C13.7889 8.63147 12.988 9.43347 12 9.43347C11.012 9.43347 10.21 8.63147 10.21 7.64447C10.21 6.65547 11.012 5.85547 12 5.85547C12.988 5.85547 13.7889 6.65547 13.7889 7.64447Z" stroke="currentColor"></path>
<path d="M3.51074 21.2821L6.33972 18.4531M3.51074 18.4531L6.33972 21.2821L3.51074 18.4531Z" stroke="currentColor"></path>
<path d="M17.6592 21.2821L20.4892 18.4531M17.6592 18.4531L20.4892 21.2821L17.6592 18.4531Z" stroke="currentColor"></path>
<path d="M10.585 21.2821L13.4149 18.4531M10.585 18.4531L13.4149 21.2821L10.585 18.4531Z" stroke="currentColor"></path>
    </svg>
  ),
)

PasswordUser.displayName = 'PasswordUser'

export default PasswordUser
