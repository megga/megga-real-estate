// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const SquareTouchIdLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M20.8801 12.92V8.918C20.8801 6.012 19.0701 3.95898 16.1611 3.95898H7.83911C4.93911 3.95898 3.12012 6.012 3.12012 8.918V16.76C3.12012 19.665 4.93011 21.719 7.83911 21.719H12.3201" stroke="currentColor"></path>
<path d="M8.07129 10.6796C8.84729 9.31357 10.3163 8.39258 12.0003 8.39258C12.6173 8.39258 13.2063 8.51556 13.7413 8.73956" stroke="currentColor"></path>
<path d="M15.6924 10.3066C16.0814 10.8586 16.3504 11.5007 16.4614 12.1967" stroke="currentColor"></path>
<path d="M13.7416 14.7469V13.0739C13.7416 12.0919 12.9446 11.2949 11.9616 11.2949C10.9796 11.2949 10.1826 12.0919 10.1826 13.0739V13.5509" stroke="currentColor"></path>
<path d="M7.4834 16.2658V13.4668" stroke="currentColor"></path>
<path d="M10.1826 17.2875V15.6855" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.1538 21.96H16.5498C15.8368 21.96 15.2588 21.381 15.2588 20.668V19.207C15.2588 18.493 15.8368 17.916 16.5498 17.916H19.1538C19.8668 17.916 20.4458 18.493 20.4458 19.207V20.668C20.4458 21.381 19.8668 21.96 19.1538 21.96Z" stroke="currentColor"></path>
<path d="M19.4078 17.9406V17.0126C19.3968 16.1546 18.6918 15.4676 17.8338 15.4786C16.9938 15.4896 16.3148 16.1656 16.2998 17.0066V17.9406" stroke="currentColor"></path>
    </svg>
  ),
)

SquareTouchIdLock.displayName = 'SquareTouchIdLock'

export default SquareTouchIdLock
