// MEGGA X — Link. Transcription fidèle de la vitrine MEGGA : <a class="link-single">
// dans un .link-content-flex avec icônes optionnelles gauche/droite.
//
// Rend un <button> quand aucun `href` n'est fourni. La vitrine est un site de
// pages : tous ses liens NAVIGUENT, elle n'a donc jamais eu besoin de la
// distinction. Le CRM, lui, a des actions qui portent l'allure d'un lien sans
// aller nulle part (« Reprendre plus tard », « Se déconnecter »). Les écrire
// `<a href="#">` avec preventDefault les annonce comme des liens aux lecteurs
// d'écran et les fait apparaître dans la liste des liens de la page, alors
// qu'elles n'y mènent pas. La peau est la même dans les deux cas, seule la
// balise change.
import { cn } from '@/lib/utils'

interface Common {
  /** graisse medium (.medium de la source) */
  medium?: boolean
  /** couleur primaire (.text-color-primary-1) */
  primary?: boolean
  /** taille de texte display (1 ou 2 dans le style guide) */
  display?: 1 | 2
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

type AsAnchor = Common & React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
type AsButton = Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & { href?: undefined }

export default function MxLink({
  medium,
  primary,
  display = 1,
  iconLeft,
  iconRight,
  className,
  children,
  ...rest
}: AsAnchor | AsButton) {
  const classes = cn(
    `display-${display}`,
    'link-single',
    'w-inline-block',
    medium && 'medium',
    primary && 'text-color-primary-1',
    className,
  )
  const inner = (
    <div className="link-content-flex">
      {iconLeft != null && <div className="link-item-icon-left">{iconLeft}</div>}
      <div>{children}</div>
      {iconRight != null && <div className="link-item-icon-right">{iconRight}</div>}
    </div>
  )

  if (rest.href != null) {
    return <a className={classes} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{inner}</a>
  }
  // `mx-linkbutton` neutralise l'apparence native du bouton : la peau reste
  // celle de `.link-single`, seul le rôle change.
  return (
    <button type="button" className={cn(classes, 'mx-linkbutton')} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  )
}
