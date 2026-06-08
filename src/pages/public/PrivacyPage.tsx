// MEGGA — Politique de confidentialité (LPD / nLPD suisse). Page légale minimale,
// sobre, aux tokens du thème CRM, sans dépendance Property X (l'ancienne page
// marketing a été archivée hors repo le 2026-06-08).

import { Link } from 'react-router-dom'

const SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Responsable du traitement',
    body: "MEGGA est responsable du traitement des données personnelles collectées via l'application. Pour toute question relative à vos données, contactez-nous à privacy@megga.ch.",
  },
  {
    title: '2. Données collectées',
    body: "Nous traitons les données que vous nous fournissez (identité, coordonnées, documents transmis dans le cadre d'un mandat ou d'une vérification KYC) ainsi que les données techniques nécessaires au fonctionnement du service (journaux de connexion, données d'usage).",
  },
  {
    title: '3. Finalités',
    body: "Les données sont traitées pour fournir le service (CRM transactionnel, gestion de mandats, vérifications de conformité), assurer la sécurité de la plateforme et respecter nos obligations légales, notamment en matière de lutte contre le blanchiment.",
  },
  {
    title: '4. Base légale',
    body: "Le traitement repose sur l'exécution du contrat, le respect d'obligations légales, votre consentement lorsqu'il est requis, et l'intérêt légitime à exploiter et sécuriser le service.",
  },
  {
    title: '5. Conservation',
    body: "Les données sont conservées le temps nécessaire aux finalités décrites et aux durées de conservation imposées par la loi, puis supprimées ou anonymisées.",
  },
  {
    title: '6. Sous-traitants',
    body: "Nous recourons à des prestataires d'hébergement et d'infrastructure agissant sur instruction et soumis à des obligations de confidentialité. Les données sont hébergées dans l'Union européenne.",
  },
  {
    title: '7. Vos droits',
    body: "Conformément à la loi fédérale sur la protection des données (LPD), vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition. Pour les exercer, écrivez à privacy@megga.ch.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-theme-page px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-theme-tertiary transition-colors hover:text-theme-primary"
        >
          ← Retour
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-theme-primary">
          Politique de confidentialité
        </h1>
        <p className="mt-2 text-sm text-theme-tertiary">
          Conforme à la loi fédérale suisse sur la protection des données (LPD).
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold text-theme-primary">{s.title}</h2>
              <p className="mt-2 text-base leading-relaxed text-theme-secondary">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
