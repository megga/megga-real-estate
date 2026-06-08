// MEGGA X — Icon. Rend un glyphe d'icon-font la vitrine MEGGA (zone privée Unicode)
// avec la classe de police correspondante. Fidèle : même classe BRIX
// (icon-font-rounded / icon-font-social-media / custom-icon-font) + le glyphe.

import { cn } from '@/lib/utils'
import { MX_ICON_CLASS, type MxIconSet } from './iconGlyphs'

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  /** famille d'icônes — défaut: rounded (Line Rounded Icon Font Brix) */
  set?: MxIconSet
  /** codepoint zone privée, ex. 0xe834 */
  code: number
}

export default function MxIcon({ set = 'rounded', code, className, ...rest }: Props) {
  return (
    <span className={cn(MX_ICON_CLASS[set], className)} {...rest}>
      {String.fromCodePoint(code)}
    </span>
  )
}
