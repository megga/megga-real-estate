/**
 * Route `/dashboard/identite` sous 768 px (mobile, via ResponsiveRoute dans
 * App.tsx). La saisie d'identité légale (formulaires denses) ne se termine que sur
 * ordinateur — décision actée au plan étape 2. Cet écran l'explique et n'offre aucun
 * moyen de contourner : pas de lien vers le dashboard, qui redirigerait de toute façon
 * ici tant que le gate reste 'required'. Seule sortie : se déconnecter.
 *
 * ── Peau MEGGA X, comme le reste de l'entonnoir ────────────────────────────────────
 *
 * Cet écran portait les tokens du CRM (`bg-theme-page`, `text-theme-primary`…). Or
 * l'entonnoir d'identité ignore délibérément la préférence d'apparence de l'agent (cf.
 * l'en-tête d'IdentityShell) : ces tokens y résolvent donc en CLAIR, et le dirigeant
 * qui ouvrait le parcours sur son téléphone tombait sur une page blanche au milieu
 * d'un tunnel noir. Défaut relevé à l'audit du 03.08.2026 et laissé en attente ; repris
 * ici sur demande client.
 *
 * Le gabarit est repris de `IdentityPreparingScreen` / `IdentityWelcomeScreen`
 * (IdentityShell.tsx) — mêmes classes de la vitrine, même coquille `mx-appshell`, même
 * carte centrée dans la hauteur restante. Aucune valeur de couleur, de taille ou de
 * rayon n'est posée ici : tout vient de la peau, c'est la règle de l'entonnoir.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MeggaX, MxLink } from '@/components/megga-x'
import { useAuth } from '@/hooks/useAuth'

/** Invite « terminez sur ordinateur » — aucune sortie vers le CRM mobile. */
export default function IdentityMobileNotice() {
  const { t } = useTranslation('onboarding')
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <MeggaX>
      {/* `mx-appshell` plafonne la coquille à la hauteur de la fenêtre ; la carte se
          centre dans ce qui reste (`mx-scrollarea--center`) au lieu d'être poussée par
          les paddings fixes des sections de la vitrine. Sur un téléphone, ces 64/80 px
          se prendraient sur le message lui-même. */}
      <div className="page-wrapper full-height-page mx-appshell">
        {/* Même en-tête que les autres écrans de l'entonnoir, sans lien : l'agent est
            déjà connecté, le logo ne ramène pas à la vitrine. */}
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>
        <section className="section hero---br pd-top-0 pd-bottom-0 mx-grow mx-shellbody">
          <div className="container-default position-relative---z-index-1 w-container mx-scrollarea mx-scrollarea--center">
            <div className="inner-container _634px center">
              <div className="card sign-in-card">
                <div className="pd---content-inside-card">
                  <div className="inner-container _464px center">
                    <div className="text-center">
                      <p className="paragraph-small text-color-neutral-600">
                        {t('gate.mobileNotice.eyebrow')}
                      </p>
                      <h1 className="display-6 mg-top-4x-extra-small">
                        {t('gate.mobileNotice.title')}
                      </h1>
                      <div className="mg-top-4x-extra-small">
                        <p className="paragraph-large">{t('gate.mobileNotice.body')}</p>
                      </div>
                    </div>
                    <div className="mg-top-medium text-center">
                      {/* Un LIEN, pas un bouton — et surtout pas `secondary-button` :
                          mesuré à 375 px, il rend un pavé BLANC pleine largeur sur la
                          carte noire, donc plus criard que le primaire bleu qu'il était
                          censé effacer. Or se déconnecter n'est pas ce qu'on souhaite
                          voir faire ici : l'action attendue est de rouvrir le parcours
                          sur un ordinateur, et elle ne se clique pas sur cet écran. Un
                          bouton, quelle que soit sa variante, promettrait une issue que
                          cet écran n'a pas. Même choix que « Reprendre plus tard » sur
                          l'écran d'arrivée (IdentityWelcomeScreen). */}
                      <MxLink onClick={() => { void signOut().then(() => navigate('/login')) }}>
                        {/* `common:nav.logout` et non `common:logout` : la clé racine
                            n'existe dans aucune des 4 langues, i18next rendait donc le
                            CHEMIN — le bouton affichait « logout » en clair, partout.
                            Même correctif que dans IdentityShell (#1069), qui avait
                            laissé cet écran-ci de côté. */}
                        {t('common:nav.logout')}
                      </MxLink>
                    </div>
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
