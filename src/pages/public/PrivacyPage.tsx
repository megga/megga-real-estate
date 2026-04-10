import { useTranslation } from 'react-i18next'

export default function PrivacyPage() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('privacy.title')}</h1>
        <p className="text-sm text-gray-500 mb-10">{t('privacy.lastUpdated')}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Responsable du traitement</h2>
            <p>
              MEGGA Real Estate, dont le siège est à Genève, Suisse, est responsable du traitement des données personnelles
              collectées via la plateforme megga.ch (ci-après « la Plateforme »).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Données collectées</h2>
            <p>Nous collectons les catégories de données suivantes :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Données d'identification</strong> : nom, prénom, adresse email, numéro de téléphone</li>
              <li><strong>Données professionnelles</strong> : agence, rôle, numéro IDE</li>
              <li><strong>Données de transaction</strong> : biens consultés, recherches effectuées, offres soumises</li>
              <li><strong>Données techniques</strong> : adresse IP, type de navigateur, pages visitées</li>
              <li><strong>Données de calendrier</strong> : événements et visites synchronisés via Google Calendar (si activé)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Finalités du traitement</h2>
            <p>Vos données sont traitées pour :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Fournir et améliorer les services de la Plateforme</li>
              <li>Gérer votre compte utilisateur et vos préférences</li>
              <li>Faciliter les transactions immobilières (matching, visites, offres)</li>
              <li>Assurer la conformité réglementaire (LAB/KYC)</li>
              <li>Synchroniser vos visites avec des services tiers (Google Calendar)</li>
              <li>Envoyer des communications transactionnelles (confirmations, relances)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Base légale</h2>
            <p>
              Le traitement est fondé sur l'exécution du contrat (conditions d'utilisation), votre consentement
              (intégrations tierces, cookies non essentiels), nos intérêts légitimes (amélioration du service, sécurité)
              et nos obligations légales (LAB/KYC).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Services tiers</h2>
            <p>Nous utilisons les services suivants :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Supabase</strong> (hébergement, base de données, authentification) — UE</li>
              <li><strong>Cloudflare</strong> (hébergement, CDN) — Global</li>
              <li><strong>Resend</strong> (envoi d'emails transactionnels)</li>
              <li><strong>Stripe</strong> (paiements et abonnements)</li>
              <li><strong>Google Calendar API</strong> (synchronisation calendrier, si activé par l'utilisateur)</li>
              <li><strong>Anthropic Claude API</strong> (assistance IA, copilote métier)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Durée de conservation</h2>
            <p>
              Les données personnelles sont conservées pendant la durée de votre relation contractuelle avec nous,
              puis archivées conformément aux obligations légales suisses (10 ans pour les données financières et KYC).
              Vous pouvez demander la suppression de votre compte à tout moment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Vos droits</h2>
            <p>Conformément à la Loi fédérale sur la protection des données (LPD), vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Droit d'accès à vos données personnelles</li>
              <li>Droit de rectification des données inexactes</li>
              <li>Droit à l'effacement de vos données</li>
              <li>Droit à la portabilité de vos données</li>
              <li>Droit d'opposition au traitement</li>
              <li>Droit de révoquer votre consentement à tout moment</li>
            </ul>
            <p className="mt-2">
              Pour exercer ces droits, contactez-nous à <strong>privacy@megga.ch</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :
              chiffrement en transit (TLS) et au repos, contrôle d'accès par rôles (RLS), audit trail,
              authentification à deux facteurs (disponible prochainement).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Contact</h2>
            <p>
              Pour toute question relative à la protection de vos données :<br />
              <strong>MEGGA Real Estate</strong><br />
              Genève, Suisse<br />
              <strong>privacy@megga.ch</strong>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
