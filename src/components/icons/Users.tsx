// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Users = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 12C21 7.03005 16.9709 3 12 3C7.02908 3 3 7.03005 3 12C3 16.9709 7.02908 21 12 21C16.9709 21 21 16.9709 21 12Z" stroke="currentColor"></path>
<path d="M4.99951 17.6457C5.60014 16.592 6.92622 15.7012 9.31071 15.7012C11.7095 15.7012 13.0361 16.5886 13.6366 17.6456" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0366 10.4138C12.0366 11.9151 10.8194 13.1323 9.3181 13.1323C7.8168 13.1323 6.59961 11.9151 6.59961 10.4138C6.59961 8.9125 7.8168 7.69531 9.3181 7.69531C10.8194 7.69531 12.0366 8.9125 12.0366 10.4138Z" stroke="currentColor"></path>
<path d="M18.972 17.6741C18.2705 17.3719 17.3785 17.1875 16.2635 17.1875C12.9283 17.1875 11.5853 18.8642 11.3911 20.3741L11.3467 20.9542" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M18.3793 12.7028C18.3793 13.8212 17.4725 14.7279 16.3542 14.7279C15.2358 14.7279 14.3291 13.8212 14.3291 12.7028C14.3291 11.5845 15.2358 10.6777 16.3542 10.6777C17.4725 10.6777 18.3793 11.5845 18.3793 12.7028Z" stroke="currentColor"></path>
    </svg>
  ),
)

Users.displayName = 'Users'

export default Users
