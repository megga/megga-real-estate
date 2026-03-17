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
      { text: "3 pièces lumineux à Champel, max 800K", sparkle: true },
      { text: "Maison avec jardin, 20min de Genève", sparkle: true },
      { text: "Attique vue lac, standing", sparkle: true },
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
    // TODO: navigate to search
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
        className="w-11 h-11 bg-accent hover:bg-accent-hover rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
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
        className="w-11 h-11 bg-accent hover:bg-accent-hover rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
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
        className="w-11 h-11 bg-accent hover:bg-accent-hover rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-[1.03] cursor-pointer"
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
      {/* Title block */}
      <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white text-center leading-[1.2] tracking-tight">
        Votre prochain chez-vous,
        <br />
        en quelques mots
      </h1>
      <p className="text-base text-white/65 font-normal text-center mt-2">
        Recherche intelligente parmi des milliers de biens à travers toute la Suisse
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-sm text-white/40">12&apos;500+ biens</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="text-sm text-white/40">26 cantons</span>
        <span className="w-1 h-1 rounded-full bg-white/30" />
        <span className="text-sm text-white/40">Mis à jour en continu</span>
      </div>

      {/* Context tabs (Acheter / Louer / Estimer) */}
      <div className="mt-8 inline-flex gap-0.5 p-1 rounded-xl bg-white/8 backdrop-blur-xl border border-white/10">
        {contextTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleContextChange(tab.value)}
            className={cn(
              'px-4 md:px-6 py-2 md:py-2.5 rounded-lg text-sm md:text-base font-medium transition-all cursor-pointer',
              contextTab === tab.value
                ? 'bg-white/95 text-gray-900 shadow-md'
                : 'text-white/50 hover:text-white/80 hover:bg-white/6'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mode tabs (Recherche libre / Filtres / Adresse) */}
      <div className="mt-5 inline-flex gap-4">
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
                'flex items-center gap-1.5 text-xs font-medium pb-1 border-b-2 transition-all cursor-pointer',
                isDisabled && 'opacity-30 pointer-events-none cursor-default',
                isActive
                  ? 'text-white/90 border-white/90'
                  : 'text-white/35 border-transparent hover:text-white/60'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="mt-4 w-full bg-white/97 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 transition-all focus-within:ring-2 focus-within:ring-accent/30 focus-within:shadow-lg"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}
      >
        {modeTab === 'libre' && <SearchBarLibre context={contextTab} />}
        {modeTab === 'filtres' && <SearchBarFiltres context={contextTab} />}
        {modeTab === 'adresse' && <SearchBarAdresse context={contextTab} />}
      </div>

      {/* Suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {activeSuggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium bg-white/8 backdrop-blur-sm border border-white/12 text-white/55 hover:border-white/30 hover:text-white/85 hover:bg-white/12 transition-all cursor-pointer"
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
