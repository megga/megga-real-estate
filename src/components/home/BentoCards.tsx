function IllustrationAcheter() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-40">
      {/* Ground */}
      <ellipse cx="100" cy="145" rx="70" ry="8" fill="#E0F2FE" />
      {/* House body */}
      <rect x="60" y="70" width="80" height="65" rx="4" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="1.5" />
      {/* Roof */}
      <path d="M50 75 L100 35 L150 75" fill="#3B82F6" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Door */}
      <rect x="88" y="100" width="24" height="35" rx="3" fill="#2563EB" />
      <circle cx="107" cy="118" r="2" fill="#BFDBFE" />
      {/* Window left */}
      <rect x="68" y="82" width="16" height="16" rx="2" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1" />
      <line x1="76" y1="82" x2="76" y2="98" stroke="#93C5FD" strokeWidth="0.8" />
      <line x1="68" y1="90" x2="84" y2="90" stroke="#93C5FD" strokeWidth="0.8" />
      {/* Window right */}
      <rect x="116" y="82" width="16" height="16" rx="2" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="1" />
      <line x1="124" y1="82" x2="124" y2="98" stroke="#93C5FD" strokeWidth="0.8" />
      <line x1="116" y1="90" x2="132" y2="90" stroke="#93C5FD" strokeWidth="0.8" />
      {/* Chimney */}
      <rect x="120" y="42" width="12" height="22" rx="2" fill="#93C5FD" />
      {/* Tree */}
      <rect x="162" y="105" width="6" height="30" rx="2" fill="#A78BFA" />
      <circle cx="165" cy="95" r="16" fill="#C4B5FD" />
      <circle cx="158" cy="102" r="10" fill="#DDD6FE" />
      {/* Person */}
      <circle cx="42" cy="105" r="8" fill="#FCD34D" />
      <rect x="38" y="113" width="8" height="18" rx="3" fill="#2563EB" />
      {/* Sparkle */}
      <path d="M155 50 L157 55 L162 57 L157 59 L155 64 L153 59 L148 57 L153 55Z" fill="#FBBF24" />
      {/* Heart */}
      <path d="M38 85 C38 82, 42 80, 44 83 C46 80, 50 82, 50 85 C50 90, 44 93, 44 93 C44 93, 38 90, 38 85Z" fill="#F87171" opacity="0.7" />
    </svg>
  );
}

function IllustrationLouer() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-40">
      {/* Ground */}
      <ellipse cx="100" cy="145" rx="70" ry="8" fill="#D1FAE5" />
      {/* Building */}
      <rect x="55" y="45" width="90" height="95" rx="4" fill="#D1FAE5" stroke="#6EE7B7" strokeWidth="1.5" />
      {/* Building top detail */}
      <rect x="55" y="45" width="90" height="12" rx="4" fill="#059669" />
      {/* Windows row 1 */}
      <rect x="65" y="65" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      <rect x="85" y="65" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      <rect x="105" y="65" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      <rect x="125" y="65" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      {/* Windows row 2 */}
      <rect x="65" y="87" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      <rect x="85" y="87" width="14" height="14" rx="2" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="0.8" />
      <rect x="105" y="87" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      <rect x="125" y="87" width="14" height="14" rx="2" fill="#ECFDF5" stroke="#6EE7B7" strokeWidth="0.8" />
      {/* Door */}
      <rect x="88" y="115" width="24" height="25" rx="3" fill="#059669" />
      <circle cx="107" cy="128" r="2" fill="#D1FAE5" />
      {/* Key */}
      <g transform="translate(155, 70) rotate(25)">
        <circle cx="0" cy="0" r="10" fill="none" stroke="#FBBF24" strokeWidth="2.5" />
        <rect x="8" y="-2" width="22" height="4" rx="1.5" fill="#FBBF24" />
        <rect x="24" y="2" width="4" height="6" rx="1" fill="#FBBF24" />
        <rect x="18" y="2" width="4" height="5" rx="1" fill="#FBBF24" />
      </g>
      {/* Person with box */}
      <circle cx="35" cy="107" r="8" fill="#C084FC" />
      <rect x="31" y="115" width="8" height="16" rx="3" fill="#7C3AED" />
      <rect x="22" y="120" width="12" height="10" rx="2" fill="#FCD34D" stroke="#F59E0B" strokeWidth="0.8" />
      {/* Plant */}
      <rect x="148" y="125" width="5" height="12" rx="1" fill="#A78BFA" />
      <circle cx="150" cy="120" r="8" fill="#86EFAC" />
    </svg>
  );
}

function IllustrationEstimer() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-40">
      {/* Ground */}
      <ellipse cx="100" cy="145" rx="70" ry="8" fill="#FEF3C7" />
      {/* House silhouette */}
      <rect x="45" y="75" width="65" height="60" rx="3" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="1.5" />
      <path d="M38 80 L77.5 48 L117 80" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Door */}
      <rect x="68" y="105" width="18" height="30" rx="2" fill="#D97706" />
      {/* Window */}
      <rect x="52" y="87" width="12" height="12" rx="2" fill="#FFFBEB" stroke="#FCD34D" strokeWidth="0.8" />
      {/* Chart / Graph */}
      <g transform="translate(118, 55)">
        <rect x="0" y="0" width="65" height="80" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="1" />
        {/* Grid lines */}
        <line x1="10" y1="20" x2="55" y2="20" stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1="10" y1="35" x2="55" y2="35" stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1="10" y1="50" x2="55" y2="50" stroke="#F3F4F6" strokeWidth="0.5" />
        {/* Chart line going up */}
        <polyline points="12,58 22,48 32,42 42,30 52,15" stroke="#059669" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Area fill */}
        <path d="M12,58 L22,48 L32,42 L42,30 L52,15 L52,65 L12,65Z" fill="#059669" opacity="0.1" />
        {/* Dot at top */}
        <circle cx="52" cy="15" r="3.5" fill="#059669" />
        {/* CHF label */}
        <text x="32" y="73" textAnchor="middle" fontSize="7" fill="#6B7280" fontWeight="500">CHF</text>
      </g>
      {/* Arrow up */}
      <path d="M152 45 L158 35 L164 45" stroke="#059669" strokeWidth="2" fill="none" strokeLinecap="round" />
      <line x1="158" y1="35" x2="158" y2="50" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      {/* Person */}
      <circle cx="30" cy="107" r="8" fill="#FCD34D" />
      <rect x="26" y="115" width="8" height="16" rx="3" fill="#D97706" />
      {/* Magnifying glass */}
      <circle cx="22" cy="123" r="5" fill="none" stroke="#2563EB" strokeWidth="1.5" />
      <line x1="25.5" y1="126.5" x2="30" y2="131" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const CARDS = [
  {
    illustration: IllustrationAcheter,
    title: 'Acheter',
    description: 'Trouvez votre bien idéal parmi des milliers d\'annonces vérifiées à travers toute la Suisse.',
    cta: 'Rechercher un bien',
    href: '/acheter',
  },
  {
    illustration: IllustrationLouer,
    title: 'Louer',
    description: 'Appartements, maisons, colocations — parcourez les offres de location disponibles maintenant.',
    cta: 'Voir les locations',
    href: '/louer',
  },
  {
    illustration: IllustrationEstimer,
    title: 'Estimer',
    description: 'Obtenez une estimation de votre bien en quelques secondes grâce à notre analyse de marché.',
    cta: 'Estimer mon bien',
    href: '/estimations',
  },
] as const;

export default function BentoCards() {
  return (
    <section className="py-12 md:py-16 bg-[var(--color-bg-section)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {CARDS.map((card) => {
            const Illustration = card.illustration;
            return (
              <a
                key={card.title}
                href={card.href}
                className="group bg-white rounded-2xl p-6 md:p-8 border border-gray-100 hover:border-gray-200 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 text-center flex flex-col items-center"
              >
                <Illustration />
                <h3 className="text-xl font-bold text-gray-900 mt-4">
                  {card.title}
                </h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-[260px]">
                  {card.description}
                </p>
                <button className="mt-5 px-6 py-2.5 text-sm font-semibold text-[#2563EB] border-2 border-[#2563EB] rounded-full hover:bg-[#2563EB] hover:text-white transition-all group-hover:bg-[#2563EB] group-hover:text-white cursor-pointer">
                  {card.cta}
                </button>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
