import { useState } from 'react';
import { Linkedin, Instagram, Facebook, ChevronDown, Check, ArrowRight } from 'lucide-react';

const LINKS_RECHERCHER = [
  { label: 'Acheter', href: '/search?context=acheter' },
  { label: 'Louer', href: '/search?context=louer' },
  { label: 'Estimer', href: '/estimer' },
  { label: 'Nouveautés', href: '/nouveautes', badge: 'New' },
  { label: 'Carte interactive', href: '/carte' },
];

const LINKS_PRO = [
  { label: 'CRM intégré', href: '/pro/crm' },
  { label: 'Publier un bien', href: '/publier' },
  { label: 'Tarifs', href: '/tarifs' },
  { label: 'Rejoindre MEGGA', href: '/register' },
  { label: 'Intégrations', href: '/pro/integrations' },
];

const LINKS_MEGGA = [
  { label: 'À propos', href: '/a-propos' },
  { label: 'Contact', href: '/contact' },
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'Confidentialité', href: '/confidentialite' },
  { label: 'CGU', href: '/cgu' },
];

const CATEGORIES = [
  'Immobilier par canton',
  'Locations par ville',
  'Estimations',
  'Financement',
];

const CTA_BULLETS = [
  'CRM intégré avec pipeline intelligent',
  'Conformité LAB automatisée',
  'Portail vendeur dédié pour vos clients',
];

const CTA_STATS = [
  { value: "12'500+", label: 'biens en ligne' },
  { value: '200+', label: 'agents partenaires' },
  { value: '26', label: 'cantons couverts' },
];

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string; badge?: string }[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">{title}</h4>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="inline-flex items-center text-sm text-gray-700 opacity-65 hover:opacity-100 hover:text-accent hover:pl-1 transition-all py-1"
            >
              {link.label}
              {link.badge && (
                <span className="text-[9px] font-semibold bg-accent/15 text-accent px-1.5 py-0.5 rounded ml-2">
                  {link.badge}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <footer className="bg-[#F5F5F5] border-t border-[var(--color-border)]">
      {/* ─── Floating CTA card ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-[60px] relative z-10">
        <div className="bg-accent rounded-2xl p-8 md:p-12 shadow-lg">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-center">
            {/* Left — text */}
            <div className="flex-[3]">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Vous êtes professionnel de l&apos;immobilier ?
              </h2>
              <p className="text-sm text-white/80 mt-2">
                Rejoignez MEGGA et accédez aux outils les plus avancés du marché suisse.
              </p>

              <div className="mt-5 space-y-2.5">
                {CTA_BULLETS.map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-white shrink-0" />
                    <span className="text-sm text-white/90">{point}</span>
                  </div>
                ))}
              </div>

              <a
                href="/register"
                className="inline-flex items-center gap-2 mt-6 px-6 h-11 bg-white text-accent font-medium rounded-xl hover:bg-white/90 transition-colors text-sm shadow-lg"
              >
                Découvrir MEGGA Pro
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Right — stats */}
            <div className="flex-[2] w-full">
              <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
                {CTA_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center lg:text-left"
                  >
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-white/60 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer content ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Main grid */}
        <div className="pt-16 md:pt-20 pb-12 md:pb-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2.2fr_1fr_1fr_1fr] gap-10 md:gap-8">
          {/* Column 1 — Brand */}
          <div>
            <span className="text-xl font-bold tracking-tight text-gray-900">MEGGA</span>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-[280px]">
              Le portail immobilier suisse nouvelle génération. Trouvez, louez, estimez — simplement.
            </p>
            <div className="flex items-center gap-2 mt-5">
              {[
                { icon: Linkedin, href: '#', label: 'LinkedIn' },
                { icon: Instagram, href: '#', label: 'Instagram' },
                { icon: Facebook, href: '#', label: 'Facebook' },
              ].map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-9 h-9 rounded-lg bg-white border border-[var(--color-border)] hover:border-accent flex items-center justify-center transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-400 hover:text-accent transition-colors" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Column 2 — Rechercher */}
          <FooterLinkColumn title="Rechercher" links={LINKS_RECHERCHER} />

          {/* Column 3 — Professionnels */}
          <FooterLinkColumn title="Pour les professionnels" links={LINKS_PRO} />

          {/* Column 4 — MEGGA */}
          <FooterLinkColumn title="MEGGA" links={LINKS_MEGGA} />
        </div>

        {/* Categories bar */}
        <div className="border-t border-[var(--color-border)] py-4 flex flex-wrap">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat}
              onClick={() => setOpenCategory(openCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 px-4 py-2 transition-colors cursor-pointer ${
                i < CATEGORIES.length - 1 ? 'border-r border-[var(--color-border)]' : ''
              }`}
            >
              {cat}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openCategory === cat ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>

        {/* Copyright */}
        <div className="border-t border-[var(--color-border)] py-5 flex flex-col md:flex-row justify-between items-center gap-2">
          <span className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} MEGGA Real Estate. Tous droits réservés.
          </span>
          <span className="text-xs text-gray-400">
            Fait en Suisse 🇨🇭
          </span>
        </div>

        {/* Legal disclaimer */}
        <div className="text-center text-[10px] text-gray-400/60 leading-relaxed px-4 md:px-8 pb-6">
          MEGGA Real Estate est une plateforme technologique. Les estimations sont indicatives et ne constituent pas une évaluation officielle. Les transactions immobilières sont soumises à la législation suisse, notamment la LBA. Consultez un professionnel pour tout conseil juridique ou financier.
        </div>
      </div>
    </footer>
  );
}
