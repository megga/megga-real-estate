// GÉNÉRÉ (ne pas éditer) — node scripts/iconly-ingest.mjs
import { forwardRef, type SVGProps } from 'react'

interface Props extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  /** Côté du carré de rendu, en px. */
  size?: number | string
}

const Chat2 = forwardRef<SVGSVGElement, Props>(
  ({ size = 24, strokeWidth = 1.5, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M18.7981 18.5225C16.943 20.3778 14.5012 21.2761 12.0747 21.2237C8.7795 21.1525 3 21.2042 3 21.2042L5.02533 17.9754C5.02533 17.9754 3.04819 15.0387 3.04819 12.0045C3.04644 9.64195 3.94595 7.27993 5.75162 5.47466C9.35096 1.874 15.1987 1.874 18.7981 5.47373C22.4039 9.07996 22.3974 14.9228 18.7981 18.5225Z" stroke="currentColor" strokeLinecap="round"></path>
<path d="M8.56455 12.3808H8.46581" stroke="currentColor" strokeLinecap="square"></path>
<path d="M12.2989 12.3809H12.2002" stroke="currentColor" strokeLinecap="square"></path>
<path d="M16.0333 12.3808H15.9346" stroke="currentColor" strokeLinecap="square"></path>
    </svg>
  ),
)

Chat2.displayName = 'Chat2'

export default Chat2
