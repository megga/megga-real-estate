// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Filter2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M9.49512 7.85779H19.1372" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M9.51039 7.7978C9.51039 6.35572 8.33265 5.1864 6.88019 5.1864C5.42774 5.1864 4.25 6.35572 4.25 7.7978C4.25 9.23987 5.42774 10.4092 6.88019 10.4092C8.33265 10.4092 9.51039 9.23987 9.51039 7.7978Z" stroke="currentColor"></path>
<path d="M15.0049 17.4706H5.36285" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M14.9896 17.4101C14.9896 15.968 16.1674 14.7987 17.6198 14.7987C19.0723 14.7987 20.25 15.968 20.25 17.4101C20.25 18.8522 19.0723 20.0215 17.6198 20.0215C16.1674 20.0215 14.9896 18.8522 14.9896 17.4101Z" stroke="currentColor"></path>
    </svg>
  ),
)

Filter2.displayName = 'Filter2'

export default Filter2
