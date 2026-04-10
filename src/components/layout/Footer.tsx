import { useTranslation } from 'react-i18next'
import { Linkedin, Instagram, Facebook } from 'lucide-react'

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h4 className="text-xs font-semibold text-gray-900 mb-4">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {link.label}
            </a>
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
    { label: t('footer.interactiveMap'), href: '/acheter' },
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
    <footer className="bg-gray-50/50 border-t border-gray-200/60">

      {/* ─── Trust bar — Certifications ─── */}
      <div className="border-b border-gray-200/40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          <p className="text-xs font-medium capitalize text-gray-500 text-center mb-5">
            {t('footer.certifiedRecognized')}
          </p>
          <div className="flex items-center justify-center gap-10 md:gap-16">
            {/* C2PA */}
            <a
              href="https://c2pa.org"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
              title="Coalition for Content Provenance and Authenticity"
            >
              <img src="/c2pa-logo.svg" alt="C2PA — Coalition for Content Provenance and Authenticity" className="h-8 md:h-9" />
            </a>

            {/* Separator */}
            <div className="w-px h-10 bg-gray-200" />

            {/* Swiss Made Software */}
            <a
              href="https://www.swissmadesoftware.org"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
              title="Swiss Made Software"
            >
              <img src="/sms-logo.svg" alt="Swiss Made Software" className="h-10 md:h-11" />
            </a>
          </div>
        </div>
      </div>

      {/* ─── Main footer ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="py-12 md:py-14 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-[2.2fr_1fr_1fr_1fr] gap-10 md:gap-8">

          {/* Column 1 — Brand */}
          <div className="col-span-2 md:col-span-1">
            <img src="/megga-logo.svg" alt="MEGGA" className="h-5" />
            <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-[260px]">
              {t('footer.brandDescription')}
            </p>
            <div className="flex items-center gap-2.5 mt-6">
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
                    className="w-9 h-9 rounded-full border border-gray-200 hover:border-gray-400 hover:bg-white flex items-center justify-center transition-all"
                  >
                    <Icon className="w-4 h-4 text-gray-500" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Column 2 */}
          <FooterLinkColumn title={t('footer.search')} links={LINKS_RECHERCHER} />

          {/* Column 3 */}
          <FooterLinkColumn title={t('footer.professionals')} links={LINKS_PRO} />

          {/* Column 4 */}
          <FooterLinkColumn title="MEGGA" links={LINKS_MEGGA} />
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="border-t border-gray-200/60 py-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>&copy; {new Date().getFullYear()} MEGGA Real Estate</span>
            <span>·</span>
            <span>{t('footer.madeInSwitzerland')} 🇨🇭</span>
            <span>·</span>
            <span>{t('footer.lpd')}</span>
          </div>
          <p className="text-xs text-gray-500 text-center md:text-right max-w-lg leading-relaxed">
            {t('footer.disclaimer')}
          </p>
        </div>
      </div>

      {/* ─── Illustration skyline ─── */}
      <div className="w-full overflow-hidden">
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
