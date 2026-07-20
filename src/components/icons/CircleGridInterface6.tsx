// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const CircleGridInterface6 = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M6.12414 11.7617C4.52552 11.7617 3.23047 13.0577 3.23047 14.6554C3.23047 16.254 4.52552 17.5491 6.12414 17.5491C7.72276 17.5491 9.01781 16.254 9.01781 14.6554C9.01781 13.0577 7.72276 11.7617 6.12414 11.7617Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.5893 16.959C14.4732 16.959 13.5684 17.8639 13.5684 18.9799C13.5684 20.0959 14.4732 20.9998 15.5893 20.9998C16.7053 20.9998 17.6102 20.0959 17.6102 18.9799C17.6102 17.8639 16.7053 16.959 15.5893 16.959Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M15.9491 3C13.287 3 11.1289 5.15809 11.1289 7.82019C11.1289 10.4823 13.287 12.6404 15.9491 12.6404C18.6112 12.6404 20.7693 10.4823 20.7693 7.82019C20.7693 5.15809 18.6112 3 15.9491 3Z" stroke="currentColor"></path>
    </svg>
  ),
)

CircleGridInterface6.displayName = 'CircleGridInterface6'

export default CircleGridInterface6
