import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function HeroSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      navigate('/acheter');
      return;
    }
    navigate(`/acheter?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="w-full flex justify-center md:justify-end">
      {/* Text block — left-aligned text, positioned right on desktop */}
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
          className="mt-6 w-full relative"
        >
          <label htmlFor="hero-search" className="sr-only">
            Rechercher un bien immobilier
          </label>
          <div
            className={`
              flex items-center gap-3 px-4 py-3
              bg-white rounded-full
              transition-all duration-300
              ${isFocused ? '' : ''}
            `}
          >
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              id="hero-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Genève, 4 pièces, vue lac..."
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none min-w-0"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
