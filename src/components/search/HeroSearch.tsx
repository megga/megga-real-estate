import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Search,
  MapPin,
  MessageSquare,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContextTab = 'acheter' | 'louer' | 'estimer';
type ModeTab = 'libre' | 'filtres' | 'adresse';

const SUGGESTIONS: Record<ContextTab, Record<ModeTab, { text: string; sparkle?: boolean }[]>> = {
  acheter: {
    libre: [
      { text: "3 pièces à Champel, max 800K", sparkle: true },
      { text: "Maison avec jardin, 20min de Genève", sparkle: true },
      { text: "Attique vue lac", sparkle: true },
    ],
    filtres: [
      { text: "3+ pièces" },
      { text: "Terrasse" },
      { text: "Vue lac" },
      { text: "Parking" },
      { text: "Neuf / rénové" },
    ],
    adresse: [
      { text: "Genève" },
      { text: "Lausanne" },
      { text: "Zurich" },
      { text: "Bâle" },
      { text: "Berne" },
      { text: "Lugano" },
    ],
  },
  louer: {
    libre: [
      { text: "Studio meublé centre-ville, max 1'500/mois", sparkle: true },
      { text: "4 pièces familial près d'une école", sparkle: true },
      { text: "Coloc Plainpalais, 800/mois", sparkle: true },
    ],
    filtres: [
      { text: "Meublé" },
      { text: "Animaux acceptés" },
      { text: "Balcon" },
      { text: "Parking" },
      { text: "Disponible maintenant" },
    ],
    adresse: [
      { text: "Genève" },
      { text: "Lausanne" },
      { text: "Zurich" },
      { text: "Bâle" },
      { text: "Berne" },
      { text: "Lugano" },
    ],
  },
  estimer: {
    libre: [],
    filtres: [],
    adresse: [
      { text: "Genève" },
      { text: "Lausanne" },
      { text: "Zurich" },
      { text: "Bâle" },
      { text: "Berne" },
      { text: "Lugano" },
      { text: "Montreux" },
      { text: "Nyon" },
    ],
  },
};

function SearchBarLibre({ context }: { context: ContextTab }) {
  const [query, setQuery] = useState('');
  const placeholder =
    context === 'louer'
      ? 'Décrivez le logement que vous recherchez...'
      : 'Décrivez le bien que vous recherchez...';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <div className="flex items-center justify-center w-11 h-11 shrink-0">
        <MessageSquare className="w-5 h-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-[15px] text-gray-900 placeholder-gray-400 font-normal bg-transparent outline-none min-w-0"
      />
      <button
        type="submit"
        className="w-11 h-11 bg-accent hover:bg-accent/90 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
      >
        <ArrowRight className="w-5 h-5 text-white" />
      </button>
    </form>
  );
}

function SearchBarFiltres({ context }: { context: ContextTab }) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
  }

  const budgetLabel = context === 'louer' ? 'Loyer max' : 'Budget';

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <div className="flex items-center justify-center w-11 h-11 shrink-0">
        <Search className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 flex items-center">
        <button type="button" className="flex-1 text-sm text-gray-400 hover:bg-gray-50 rounded-lg px-3 py-2 transition text-left cursor-pointer">
          Localisation
        </button>
        <div className="w-px h-7 bg-gray-200 shrink-0" />
        <button type="button" className="flex-1 text-sm text-gray-400 hover:bg-gray-50 rounded-lg px-3 py-2 transition text-left cursor-pointer hidden md:block">
          Type
        </button>
        <div className="w-px h-7 bg-gray-200 shrink-0 hidden md:block" />
        <button type="button" className="flex-1 text-sm text-gray-400 hover:bg-gray-50 rounded-lg px-3 py-2 transition text-left cursor-pointer">
          {budgetLabel}
        </button>
        <div className="w-px h-7 bg-gray-200 shrink-0 hidden md:block" />
        <button type="button" className="flex-1 text-sm text-gray-400 hover:bg-gray-50 rounded-lg px-3 py-2 transition text-left cursor-pointer hidden md:block">
          Pièces
        </button>
      </div>
      <button
        type="submit"
        className="w-11 h-11 bg-accent hover:bg-accent/90 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
      >
        <Search className="w-5 h-5 text-white" />
      </button>
    </form>
  );
}

function SearchBarAdresse({ context }: { context: ContextTab }) {
  const [query, setQuery] = useState('');
  const placeholder =
    context === 'estimer'
      ? "Entrez l'adresse du bien à estimer..."
      : 'Entrez une adresse, un quartier ou un code postal...';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <div className="flex items-center justify-center w-11 h-11 shrink-0">
        <MapPin className="w-5 h-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-[15px] text-gray-900 placeholder-gray-400 font-normal bg-transparent outline-none min-w-0"
      />
      <button
        type="submit"
        className="w-11 h-11 bg-accent hover:bg-accent/90 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
      >
        <Search className="w-5 h-5 text-white" />
      </button>
    </form>
  );
}

export default function HeroSearch() {
  const [contextTab, setContextTab] = useState<ContextTab>('acheter');
  const [modeTab, setModeTab] = useState<ModeTab>('libre');

  const contextTabs: { value: ContextTab; label: string }[] = [
    { value: 'acheter', label: 'Acheter' },
    { value: 'louer', label: 'Louer' },
    { value: 'estimer', label: 'Estimer' },
  ];

  const modeTabs: { value: ModeTab; label: string; icon: typeof MessageSquare }[] = [
    { value: 'libre', label: 'Recherche libre', icon: MessageSquare },
    { value: 'filtres', label: 'Filtres', icon: SlidersHorizontal },
    { value: 'adresse', label: 'Adresse', icon: MapPin },
  ];

  function handleContextChange(tab: ContextTab) {
    setContextTab(tab);
    if (tab === 'estimer') {
      setModeTab('adresse');
    }
  }

  const isEstimer = contextTab === 'estimer';
  const activeSuggestions = SUGGESTIONS[contextTab][modeTab] ?? SUGGESTIONS[contextTab].adresse;

  return (
    <div className="flex flex-col items-center w-full max-w-[600px] mx-auto">
      {/* Title block — CRITIQUE #1: text-shadow for readability */}
      <h1
        className="text-3xl md:text-4xl lg:text-5xl font-bold text-white text-center tracking-[-0.025em]"
        style={{ lineHeight: '1.15', textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)' }}
      >
        Votre prochain chez-vous,
        <br />
        en quelques mots
      </h1>
      <p
        className="text-base text-white/70 font-normal text-center mt-3"
        style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
      >
        Recherche intelligente parmi des milliers de biens à travers toute la Suisse
      </p>
      <div
        className="flex items-center gap-2 mt-2"
        style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}
      >
        <span className="text-sm text-white/45">12&apos;500+ biens</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="text-sm text-white/45">26 cantons</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="text-sm text-white/45">Mis à jour en continu</span>
      </div>

      {/* Context tabs — CRITIQUE #2: stronger glassmorphism */}
      <div className="mt-10 inline-flex gap-0.5 p-1.5 rounded-full bg-black/30 backdrop-blur-xl border border-white/15">
        {contextTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleContextChange(tab.value)}
            className={cn(
              'px-5 md:px-6 py-2 md:py-2.5 rounded-full text-sm md:text-base transition-all cursor-pointer',
              contextTab === tab.value
                ? 'bg-white text-gray-900 font-semibold shadow-lg'
                : 'text-white/75 hover:text-white hover:bg-white/10 font-medium'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mode tabs — CRITIQUE #3: bg-based instead of underline */}
      <div className="mt-6 inline-flex gap-1">
        {modeTabs.map((tab) => {
          const Icon = tab.icon;
          const isDisabled = isEstimer && tab.value !== 'adresse';
          const isActive = modeTab === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => !isDisabled && setModeTab(tab.value)}
              disabled={isDisabled}
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 transition-all cursor-pointer',
                isDisabled && 'opacity-30 pointer-events-none cursor-default',
                isActive
                  ? 'text-white bg-white/10'
                  : 'text-white/60 hover:text-white/80 hover:bg-white/5'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="mt-5 w-full bg-white/[0.97] backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 transition-all focus-within:ring-2 focus-within:ring-accent/30 focus-within:shadow-lg"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}
      >
        {modeTab === 'libre' && <SearchBarLibre context={contextTab} />}
        {modeTab === 'filtres' && <SearchBarFiltres context={contextTab} />}
        {modeTab === 'adresse' && <SearchBarAdresse context={contextTab} />}
      </div>

      {/* Suggestions — MAJEUR #4: more padding/contrast, sparkle only on libre */}
      {activeSuggestions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {activeSuggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-white/10 backdrop-blur-sm border border-white/15 text-white/60 hover:bg-white/15 hover:border-white/25 hover:text-white/85 transition-all cursor-pointer"
            >
              {suggestion.sparkle && (
                <Sparkles className="w-3 h-3 opacity-60" />
              )}
              {suggestion.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
