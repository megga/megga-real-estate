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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Editorial title */}
      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center tracking-wide"
        style={{ lineHeight: '1.12' }}
      >
        Trouvez votre bien.
        <br />
        <span className="font-bold">Partout en Suisse.</span>
      </h1>

      {/* Minimal search input */}
      <form
        onSubmit={handleSubmit}
        className="mt-10 md:mt-12 w-full max-w-md relative"
      >
        <label htmlFor="hero-search" className="sr-only">
          Rechercher un bien immobilier
        </label>
        <div
          className={`
            flex items-center gap-3 px-5 py-3.5
            bg-white/[0.08] backdrop-blur-md
            border border-white/[0.12]
            rounded-full
            transition-all duration-300
            ${isFocused ? 'bg-white/[0.12] border-white/[0.22]' : 'hover:bg-white/[0.10] hover:border-white/[0.16]'}
          `}
        >
          <Search className="w-4.5 h-4.5 text-white/40 shrink-0" />
          <input
            id="hero-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Genève, 4 pièces, vue lac..."
            className="flex-1 text-sm md:text-base text-white placeholder-white/35 font-light bg-transparent outline-none min-w-0 tracking-wide"
          />
        </div>
      </form>
    </div>
  );
}
