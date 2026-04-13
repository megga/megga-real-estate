import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Linkedin, Instagram, Facebook } from 'lucide-react'

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h4 className="text-xs font-semibold text-gray-900 mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.href}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function Footer() {
  const { t } = useTranslation('common')

  const LINKS_RECHERCHER = [
    { label: t('footer.buy'), href: '/acheter' },
    { label: t('footer.rent'), href: '/louer' },
    { label: t('footer.estimate'), href: '/estimations' },
  ]

  const LINKS_PRO = [
    { label: t('footer.realEstateCRM'), href: '/services' },
    { label: t('footer.publishProperty'), href: '/publier' },
    { label: t('footer.agencyPricing'), href: '/services#tarifs' },
    { label: t('footer.becomePartner'), href: '/register' },
  ]

  const LINKS_MEGGA = [
    { label: t('footer.about'), href: '/services#about' },
    { label: t('footer.helpCenter'), href: '/aide' },
    { label: t('footer.contactUs'), href: '/aide/contact' },
    { label: t('footer.privacy'), href: '/privacy' },
    { label: t('footer.terms'), href: '/privacy' },
  ]

  return (
    <footer className="border-t border-gray-100">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="py-12 md:py-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 md:gap-8">

          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <img src="/megga-logo.svg" alt="MEGGA" className="h-5" />
            <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-[260px]">
              {t('footer.brandDescription')}
            </p>
            <div className="flex items-center gap-2 mt-5">
              {[
                { icon: Linkedin, href: 'https://www.linkedin.com/company/megga-real-estate', label: 'LinkedIn' },
                { icon: Instagram, href: 'https://www.instagram.com/megga.ch', label: 'Instagram' },
                { icon: Facebook, href: 'https://www.facebook.com/megga.ch', label: 'Facebook' },
              ].map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="w-8 h-8 rounded-full border border-gray-200 hover:border-gray-400 flex items-center justify-center transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Columns 2-4 */}
          <FooterLinkColumn title={t('footer.search')} links={LINKS_RECHERCHER} />
          <FooterLinkColumn title={t('footer.professionals')} links={LINKS_PRO} />
          <FooterLinkColumn title="MEGGA" links={LINKS_MEGGA} />
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>&copy; {new Date().getFullYear()} MEGGA</span>
            <span className="text-gray-200">·</span>
            <span>{t('footer.madeInSwitzerland')} 🇨🇭</span>
            <span className="text-gray-200">·</span>
            <span>{t('footer.lpd')}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://c2pa.org" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-70 transition-opacity">
              <img src="/c2pa-logo.svg" alt="C2PA" className="h-5" />
            </a>
            <a href="https://www.swissmadesoftware.org" target="_blank" rel="noopener noreferrer" className="opacity-40 hover:opacity-70 transition-opacity">
              <img src="/sms-logo.svg" alt="Swiss Made Software" className="h-6" />
            </a>
          </div>
        </div>
      </div>

      {/* Illustration skyline — compacte */}
      <div className="w-full overflow-hidden max-h-28 opacity-60">
        <img
          src="/illustration-footer.svg"
          alt=""
          className="w-full h-auto"
          loading="lazy"
          decoding="async"
        />
      </div>
    </footer>
  )
}
