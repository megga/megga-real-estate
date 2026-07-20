// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const UserDelete = forwardRef<SVGSVGElement, Props>(
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
      <path d="M18.4272 16.046L14.8936 19.5796M18.4632 19.6165L14.8584 16.0117" stroke="currentColor"></path>
<path d="M5.53613 19.999C5.53613 17.8904 7.19981 15.2656 11.9945 15.2656" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.119 8.12542C16.119 10.4034 14.2716 12.2508 11.9936 12.2508C9.71559 12.2508 7.86816 10.4034 7.86816 8.12542C7.86816 5.84743 9.71559 4 11.9936 4C14.2716 4 16.119 5.84743 16.119 8.12542Z" stroke="currentColor"></path>
    </svg>
  ),
)

UserDelete.displayName = 'UserDelete'

export default UserDelete
