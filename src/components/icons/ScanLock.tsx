// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ScanLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21.0013 16.498V18.075C21.0013 20.224 19.2583 21.967 17.1083 21.967H15.8193" stroke="currentColor"></path>
<path d="M2.99902 16.498V18.075C2.99902 20.224 4.74203 21.967 6.89203 21.967H8.14899" stroke="currentColor"></path>
<path d="M2.99902 9.43579V7.8588C2.99902 5.7098 4.74203 3.9668 6.89203 3.9668H8.18103" stroke="currentColor"></path>
<path d="M21.0005 9.43579V7.8588C21.0005 5.7098 19.2575 3.9668 17.1075 3.9668H15.8506" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M13.4509 13.3497C14.0559 12.9027 14.4529 12.1907 14.4529 11.3807C14.4529 10.0257 13.3539 8.92773 11.9999 8.92773C10.6449 8.92773 9.5459 10.0257 9.5459 11.3807C9.5459 12.1907 9.94291 12.9027 10.5479 13.3497L9.7879 15.6347C9.5659 16.3087 10.0669 17.0027 10.7759 17.0027H13.2239C13.9329 17.0027 14.4339 16.3087 14.2109 15.6347L13.4509 13.3497Z" stroke="currentColor"></path>
    </svg>
  ),
)

ScanLock.displayName = 'ScanLock'

export default ScanLock
