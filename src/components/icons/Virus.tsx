// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Virus = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M12.5802 19.2994H11.4192C9.22816 19.2994 7.45117 17.5224 7.45117 15.3304V12.7024C7.45117 10.5114 9.22816 8.73438 11.4192 8.73438H12.5802C14.7722 8.73438 16.5492 10.5114 16.5492 12.7024V15.3304C16.5492 17.5224 14.7722 19.2994 12.5802 19.2994Z" stroke="currentColor"></path>
<path d="M4.07422 6.09375L4.26721 7.2298C4.44521 8.2778 5.1572 9.15478 6.1452 9.54578L8.2182 10.3558" stroke="currentColor"></path>
<path d="M7.452 12.6948C6.039 12.5888 4.635 12.4518 3 13.1088" stroke="currentColor"></path>
<path d="M4.07422 19.6885L4.27222 18.5535C4.44322 17.5095 5.15722 16.6386 6.14722 16.2426L7.4812 15.7266" stroke="currentColor"></path>
<path d="M16.5273 15.7266L17.8474 16.2416C18.8384 16.6386 19.5514 17.5095 19.7364 18.5535L19.9203 19.6885" stroke="currentColor"></path>
<path d="M16.5488 12.6948C17.9618 12.5888 19.3658 12.4518 21.0008 13.1088" stroke="currentColor"></path>
<path d="M19.9253 6.09375L19.7313 7.2298C19.5533 8.2778 18.8413 9.15478 17.8533 9.54578L15.7812 10.3558" stroke="currentColor"></path>
<path d="M9.35938 9.31787V7.5199C9.35938 6.0609 10.5414 4.87891 12.0004 4.87891C13.4594 4.87891 14.6414 6.0609 14.6414 7.5199V9.31787" stroke="currentColor"></path>
<path d="M12 9.05078V19.3008" stroke="currentColor"></path>
    </svg>
  ),
)

Virus.displayName = 'Virus'

export default Virus
