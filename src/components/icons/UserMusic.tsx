// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserMusic = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.5905 12.327C20.5905 17.1167 16.7075 20.9997 11.9178 20.9997C7.12807 20.9997 3.24512 17.1167 3.24512 12.327C3.24512 7.53725 7.12807 3.6543 11.9178 3.6543C12.2836 3.6543 12.6446 3.67667 12.9987 3.72143" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.0374 7.41615C19.0374 8.40659 18.2347 9.20926 17.2443 9.20926C16.2548 9.20926 15.4521 8.40659 15.4521 7.41615C15.4521 6.42571 16.2548 5.62305 17.2443 5.62305C18.2347 5.62305 19.0374 6.42571 19.0374 7.41615Z" stroke="currentColor"></path>
<path d="M19.0361 7.41515V3C19.0361 3 19.5022 4.21227 20.7553 4.46718" stroke="currentColor"></path>
<path d="M7.65381 19.881C7.82407 18.5617 8.99645 17.0975 11.9104 17.0975C14.8554 17.0975 16.02 18.5695 16.1825 19.9053" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.3878 12.2945C14.3878 13.6576 13.2826 14.7628 11.9195 14.7628C10.5564 14.7628 9.45117 13.6576 9.45117 12.2945C9.45117 10.9314 10.5564 9.82617 11.9195 9.82617C13.2826 9.82617 14.3878 10.9314 14.3878 12.2945Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserMusic.displayName = 'UserMusic'

export default UserMusic
