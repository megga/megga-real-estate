/**
 * En-tête des pages publiques tokenisées (gestion de visite, retour de visite).
 *
 * Marque seule, sans navigation : ces pages s'ouvrent depuis un lien e-mail reçu
 * par un client, qui n'a pas de compte et n'a rien à faire ailleurs dans l'app.
 *
 * Remplace `HomeStickyHeader` (retiré le 2026-07-20), hérité du site public :
 * sa nav pointait vers /buy /rent /estimates /services /agencies, toutes
 * redirigées hors app depuis le pivot CRM-first — chaque lien éjectait le
 * client vers megga.ch au milieu de sa confirmation de visite.
 */
export default function PublicPageHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-theme-border bg-theme-page/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <img src="/megga-logo.svg" alt="MEGGA" className="h-5 w-auto dark:invert" />
      </div>
    </header>
  )
}
