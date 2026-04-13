import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type SearchMode = 'biens' | 'agents' | 'agences';

const MODES: { value: SearchMode; label: string; placeholder: string; path: string }[] = [
  { value: 'biens', label: 'Biens', placeholder: 'Genève, 4 pièces, vue lac...', path: '/acheter' },
  { value: 'agents', label: 'Agents', placeholder: 'Nom, ville, spécialité...', path: '/agents' },
  { value: 'agences', label: 'Agences', placeholder: 'Nom ou ville de l\'agence...', path: '/agents' },
];

export default function HeroSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('biens');

  const activeMode = MODES.find((m) => m.value === mode)!;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      navigate(activeMode.path);
      return;
    }
    navigate(`${activeMode.path}?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="w-full flex justify-center md:justify-end">
      <div className="flex flex-col items-center md:items-start w-full max-w-2xl">
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-wide text-center md:text-left"
          style={{ lineHeight: '1.12', textShadow: '0 2px 20px rgba(0,0,0,0.6), 0 1px 6px rgba(0,0,0,0.4)' }}
        >
          Trouvez votre bien. Partout&nbsp;en&nbsp;Suisse.
        </h1>

        {/* Search input */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 w-full max-w-md relative"
        >
          <label htmlFor="hero-search" className="sr-only">
            {activeMode.placeholder}
          </label>
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-full">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              id="hero-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeMode.placeholder}
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none focus:outline-none focus:ring-0 min-w-0"
            />
          </div>
        </form>

        {/* Mode links */}
        <div
          className="mt-3 flex items-center gap-1 text-sm"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => { setMode(m.value); setQuery(''); }}
              className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                mode === m.value
                  ? 'text-white font-medium'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
