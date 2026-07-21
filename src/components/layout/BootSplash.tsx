/**
 * Écran d'arrivée sur le CRM — habillage de la vitrine (megga.ch).
 *
 * L'agent qui revient de megga.ch/login traversait quatre écrans différents
 * (page blanche du bundle, spinner nu, « Connexion en cours… » sur fond blanc,
 * squelette) avant de voir le CRM. Cet écran les remplace par UN seul, tenu de
 * bout en bout, dans les couleurs et la typo de la vitrine.
 *
 * Il existe en DEUX jumeaux qui se relaient sans coupure :
 *   1. `#megga-boot` dans index.html — peint dès la 1re frame, avant React ;
 *   2. ce composant — prend le relais dès que React commit (le jumeau HTML
 *      s'efface alors tout seul, cf. le script en bas d'index.html).
 *
 * ⚠ Les styles vivent UNIQUEMENT dans le `<style id="megga-boot-style">`
 * d'index.html (ils doivent y être inline pour peindre avant le bundle). Ce
 * composant en réutilise les classes : toute retouche visuelle se fait là-bas,
 * et le balisage des deux jumeaux doit rester identique — sinon la bascule
 * HTML → React clignote.
 *
 * Texte en français seul, comme la vitrine et l'écran de connexion d'où l'agent
 * arrive : le jumeau HTML n'a pas accès à i18next, et deux libellés divergents
 * feraient précisément le clignotement qu'on cherche à supprimer.
 */
import { cn } from '@/lib/utils'

interface Props {
  /** `megga-boot is-done` pour lancer le fondu de sortie (cf. index.html). */
  className?: string
}

/** Écran plein cadre : logo MEGGA, barre de progression, mention retardée. */
export default function BootSplash({ className }: Props) {
  return (
    <div className={cn('megga-boot', className)} role="status" aria-live="polite">
      {/* Halo bas — le dégradé du pied de page vitrine. L'image est servie
          depuis public/ (22 Ko) : la mettre en data-URI alourdirait l'index.html,
          qui est sur le chemin critique de TOUT le reste. */}
      <div className="megga-boot__glow" />
      {/* Source de vérité du tracé : public/megga-wordmark.svg. Inline (et non
          <img>) pour que le logo soit déjà là à la première frame du jumeau —
          une image en vol se verrait disparaître pendant le fondu. */}
      <svg className="megga-boot__logo" viewBox="0 0 1920 419" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <polygon points="92 0 237.62 219.08 384 0 475 0 475.31 63.04 363.87 229.77 237.7 418.79 104.93 220.12 104.62 419 0 419 0 0 92 0" />
        <polygon points="826 0 826.06 94.73 622.1 94.74 621.94 167.65 791.33 167.66 791.33 251.37 622.01 251.37 621.99 324.3 826.05 324.29 825.97 419 517.35 419 517 0 826 0" />
        <path d="M1052,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92-96.69-88.85-90.73-249.43,12.42-329.58,29.62-23.01,64.08-35.58,100.62-39.5h31Z" />
        <path d="M1732,0l188,418.23v.77h-104.98l-42.28-94.7h-124.31s-42.38,94.7-42.38,94.7h-104.22c.24-1.34.57-2.95,1.41-4.82L1690,0h42ZM1739.67,250.92l-29.06-64.46-29.15,64.86,58.21-.39Z" />
        <path d="M1351,419h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8Z" />
        <path d="M1351,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25,31.59-28.19,70.35-43.46,111.55-47.62h29Z" />
        <polygon points="475.11 419 370.91 419 370.69 251.26 475.21 95.29 475.11 419" />
      </svg>
      <div className="megga-boot__bar" />
      <p className="megga-boot__hint">Ouverture de votre espace</p>
    </div>
  )
}
