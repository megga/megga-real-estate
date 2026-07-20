// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const LockOpen = forwardRef<SVGSVGElement, Props>(
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
      <path d="M9.30374 21.9953H14.6957C16.2907 21.9953 17.0887 21.9953 17.7047 21.6997C18.3187 21.4045 18.8147 20.9086 19.1097 20.2939C19.4057 19.6783 19.4057 18.8806 19.4057 17.2853V15.1534C19.4057 13.5581 19.4057 12.7605 19.1097 12.1448C18.8147 11.5301 18.3187 11.0342 17.7047 10.7391C17.0887 10.4434 16.2907 10.4434 14.6957 10.4434H9.30374C7.70874 10.4434 6.91074 10.4434 6.29474 10.7391C5.68074 11.0342 5.18474 11.5301 4.88974 12.1448C4.59374 12.7605 4.59375 13.5581 4.59375 15.1534V17.2853C4.59375 18.8806 4.59374 19.6783 4.88974 20.2939C5.18474 20.9086 5.68074 21.4045 6.29474 21.6997C6.91074 21.9953 7.70874 21.9953 9.30374 21.9953Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.6413 16.2203C13.6413 17.1261 12.9073 17.8606 12.0013 17.8606C11.0953 17.8606 10.3613 17.1261 10.3613 16.2203C10.3613 15.3146 11.0953 14.5801 12.0013 14.5801C12.9073 14.5801 13.6413 15.3146 13.6413 16.2203Z" stroke="currentColor"></path>
<path d="M16.1954 6.90401C15.3894 4.58851 12.8585 3.36562 10.5435 4.17212C8.77046 4.78892 7.57645 6.45551 7.56445 8.33311V10.4433" stroke="currentColor"></path>
    </svg>
  ),
)

LockOpen.displayName = 'LockOpen'

export default LockOpen
