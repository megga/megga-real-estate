/**
 * Page 404 de l'app — route `*`, publique (hors ProtectedRoute).
 *
 * Portée sur le gabarit Code AI X, celui de `sites/megga-vitrine/404.html` :
 * l'agent qui tombe sur une URL morte de app.megga.ch voit la même page que s'il
 * s'était trompé sur megga.ch. L'ancienne version était une composition maison
 * aux tokens du thème CRM, sans parenté avec le reste de la marque.
 *
 * Rien n'est réinventé — markup et classes recopiés de la vitrine, servis par la
 * feuille MEGGA X (transcription verbatim scopée `.megga-x`). Les deux voiles
 * (`bg-image-gradient-overlay`, `_404-image-blur-overlay`) sont des dégradés CSS
 * et un `backdrop-filter`, ils n'ont besoin d'aucun asset ; seule l'illustration
 * en est une, copiée dans `public/megga-x/images/` avec ses deux variantes
 * responsives.
 *
 * Une seule adaptation, assumée : le bouton ramène au tableau de bord et non à
 * l'accueil de la vitrine. Quelqu'un qui se perd sur app.megga.ch veut rentrer
 * dans l'app, pas en sortir. Le lien vers le centre d'aide est conservé de la
 * version précédente — c'est le second recours quand la page cherchée existait.
 *
 * Texte en français, comme la page qu'elle remplace : les surfaces publiques de
 * l'app ne passent pas par i18next (le garde `lint:i18n` ne couvre que les
 * surfaces agent).
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { MeggaX, MxLink } from '@/components/megga-x'
import { HELP_CENTER_URL } from '@/lib/help-articles'

/** Illustration servie depuis public/megga-x/images (cf. en-tête). Renommée à la
 *  copie : le nom d'origine annonçait le gabarit d'achat dans une URL publique. */
const IMG = '/megga-x/images/404-illustration'

export default function NotFoundPage() {
  const { t } = useTranslation('common')
  return (
    <MeggaX className="min-h-screen">
      <div className="page-wrapper">
        {/* Même en-tête que l'écran d'arrivée : le logo situe la marque sans
            proposer une navigation qui vit sur l'autre domaine. */}
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>

        <section className="section overflow-hidden">
          <div className="container-default w-container">
            <div className="_404-top-image-wrapper">
              <img
                alt={t('not_found.image_alt')}
                loading="lazy"
                sizes="(max-width: 1439px) 74vw, (max-width: 1919px) 59vw, 100vw"
                src={`${IMG}.png`}
                srcSet={`${IMG}-500.png 500w, ${IMG}-800.png 800w, ${IMG}.png 1700w`}
              />
              <div className="bg-image-gradient-overlay rectangle-gradient-bottom" />
              <div className="_404-image-blur-overlay" />
            </div>

            <div className="inner-container _506px center">
              <div className="position-relative---z-index-1">
                <div className="text-center">
                  <h1 className="mg-bottom-2x-extra-small">{t('not_found.title')}</h1>
                  <div className="mg-bottom-small">
                    <p className="paragraph-large">
                      {t('not_found.body')}
                    </p>
                  </div>
                  <div className="buttons-row">
                    <Link className="primary-button w-inline-block" to="/dashboard">
                      <div className="link-content-flex">
                        <div>{t('not_found.back')}</div>
                      </div>
                    </Link>
                  </div>
                  <div className="mg-top-small">
                    <MxLink href={HELP_CENTER_URL} target="_blank" rel="noopener noreferrer">
                      {t('not_found.help')}
                    </MxLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MeggaX>
  )
}
