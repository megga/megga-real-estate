import { Linkedin, Instagram, Facebook } from 'lucide-react'

const LINKS_RECHERCHER = [
  { label: 'Acheter', href: '/acheter' },
  { label: 'Louer', href: '/louer' },
  { label: 'Estimer', href: '/estimations' },
  { label: 'Carte interactive', href: '/acheter' },
]

const LINKS_PRO = [
  { label: 'CRM immobilier', href: '/services' },
  { label: 'Publier un bien', href: '/publier' },
  { label: 'Tarifs agences', href: '/services' },
  { label: 'Devenir partenaire', href: '/register' },
]

const LINKS_MEGGA = [
  { label: 'À propos', href: '/services' },
  { label: 'Centre d\'aide', href: '/aide' },
  { label: 'Nous contacter', href: '/aide/contact' },
  { label: 'Confidentialité', href: '/privacy' },
  { label: 'Conditions générales', href: '/services' },
]

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
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
    </div>
  )
}

export default function Footer() {
  return (
    <footer className="bg-gray-50/50 border-t border-gray-200/60">

      {/* ─── Trust bar — Certifications ─── */}
      <div className="border-b border-gray-200/40">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-gray-400 text-center mb-5">
            Certifié et reconnu
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
            <p className="text-sm text-gray-400 mt-3 leading-relaxed max-w-[260px]">
              La plateforme immobilière suisse. Recherche intelligente, conformité intégrée.
            </p>
            <div className="flex items-center gap-2.5 mt-6">
              {[
                { icon: Linkedin, href: '#', label: 'LinkedIn' },
                { icon: Instagram, href: '#', label: 'Instagram' },
                { icon: Facebook, href: '#', label: 'Facebook' },
              ].map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-9 h-9 rounded-full border border-gray-200 hover:border-gray-400 hover:bg-white flex items-center justify-center transition-all"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Column 2 */}
          <FooterLinkColumn title="Rechercher" links={LINKS_RECHERCHER} />

          {/* Column 3 */}
          <FooterLinkColumn title="Professionnels" links={LINKS_PRO} />

          {/* Column 4 */}
          <FooterLinkColumn title="MEGGA" links={LINKS_MEGGA} />
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="border-t border-gray-200/60 py-6 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>&copy; {new Date().getFullYear()} MEGGA Real Estate</span>
            <span>·</span>
            <span>Fait en Suisse 🇨🇭</span>
            <span>·</span>
            <span>Conforme LPD</span>
          </div>
          <p className="text-xs text-gray-400 text-center md:text-right max-w-lg leading-relaxed">
            Plateforme technologique — les estimations sont indicatives. Données cartographiques swisstopo.
          </p>
        </div>
      </div>
    </footer>
  )
}
