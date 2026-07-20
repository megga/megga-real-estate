// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const ShieldLoad = forwardRef<SVGSVGElement, Props>(
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
      <path fillRule="evenodd" clipRule="evenodd" d="M3.75586 18.9006C3.75586 19.9866 4.63684 20.8666 5.72284 20.8666C6.80784 20.8666 7.68884 19.9866 7.68884 18.9006C7.68884 17.8146 6.80784 16.9336 5.72284 16.9336C4.63684 16.9336 3.75586 17.8146 3.75586 18.9006Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M16.3965 6.25995C16.3965 7.34595 17.2765 8.22595 18.3625 8.22595C19.4485 8.22595 20.3295 7.34595 20.3295 6.25995C20.3295 5.17395 19.4485 4.29297 18.3625 4.29297C17.2765 4.29297 16.3965 5.17395 16.3965 6.25995Z" stroke="currentColor"></path>
<path fillRule="evenodd" clipRule="evenodd" d="M12.0004 15.9377C12.0004 15.9377 14.6994 15.1207 14.6994 12.8687C14.6994 10.6147 14.7974 10.4407 14.5804 10.2217C14.3634 10.0037 12.3544 9.30469 12.0004 9.30469C11.6464 9.30469 9.63738 10.0057 9.42038 10.2217C9.20338 10.4387 9.30136 10.6147 9.30136 12.8687C9.30136 15.1217 12.0004 15.9377 12.0004 15.9377Z" stroke="currentColor"></path>
<path d="M3 12.6091C3.009 7.6361 7.03197 3.62109 12.004 3.62109C13.783 3.62109 15.441 4.14008 16.83 5.02908" stroke="currentColor"></path>
<path d="M20.9998 12.6172C20.9998 17.5902 16.9767 21.6212 12.0037 21.6212C10.2257 21.6212 8.56773 21.1032 7.17773 20.2142" stroke="currentColor"></path>
    </svg>
  ),
)

ShieldLoad.displayName = 'ShieldLoad'

export default ShieldLoad
