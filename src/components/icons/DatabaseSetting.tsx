// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const DatabaseSetting = forwardRef<SVGSVGElement, Props>(
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
      <path d="M11.0656 8.91166C15.1123 8.91166 18.3928 7.58829 18.3928 5.95583C18.3928 4.32337 15.1123 3 11.0656 3C7.01881 3 3.73828 4.32337 3.73828 5.95583C3.73828 7.58829 7.01881 8.91166 11.0656 8.91166Z" stroke="currentColor"></path>
<path d="M3.73828 11.6875V17.5219C3.73828 17.5219 3.73828 20.4391 11.1083 20.4391" stroke="currentColor"></path>
<path d="M18.3916 10.8956V5.85156" stroke="currentColor"></path>
<path d="M3.73828 5.85156V11.686C3.73828 11.686 3.73828 14.6032 11.1083 14.6032" stroke="currentColor"></path>
<path d="M17.2882 14.1309V15.2757M17.2882 15.2757C16.024 15.2757 14.999 16.2998 14.999 17.564C14.999 18.8282 16.0239 19.8531 17.2881 19.8531C18.5523 19.8531 19.5772 18.8282 19.5772 17.564C19.5772 16.2998 18.5525 15.2757 17.2882 15.2757ZM17.2882 19.8545V20.9993M14.3145 15.849L15.3058 16.4209M19.2695 18.7103L20.2609 19.2822M14.3145 19.2822L15.3058 18.7103M19.2695 16.4218L20.2609 15.8499" stroke="currentColor"></path>
    </svg>
  ),
)

DatabaseSetting.displayName = 'DatabaseSetting'

export default DatabaseSetting
