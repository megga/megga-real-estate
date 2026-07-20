// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const EmailLock = forwardRef<SVGSVGElement, Props>(
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
      <path d="M21 10.9636V9.28253C21 6.51953 19.155 4.26953 16.418 4.26953H7.582C4.845 4.26953 3 6.51953 3 9.28253V15.4636C3 18.2286 4.845 20.4765 7.582 20.4695H11.918" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M19.6027 20.9737H16.7867C16.0147 20.9737 15.3887 20.3477 15.3887 19.5757V17.9957C15.3887 17.2237 16.0147 16.5977 16.7867 16.5977H19.6027C20.3737 16.5977 21.0007 17.2237 21.0007 17.9957V19.5757C21.0007 20.3477 20.3737 20.9737 19.6027 20.9737Z" stroke="currentColor"></path>
<path d="M19.8776 16.6259V15.5859C19.8656 14.6579 19.1036 13.9139 18.1756 13.9259C17.2656 13.9369 16.5316 14.6689 16.5156 15.5779V16.6259" stroke="currentColor"></path>
<path d="M17.313 9.53125L13.314 12.7833C12.561 13.3813 11.493 13.3813 10.74 12.7833L6.70703 9.53125" stroke="currentColor"></path>
    </svg>
  ),
)

EmailLock.displayName = 'EmailLock'

export default EmailLock
