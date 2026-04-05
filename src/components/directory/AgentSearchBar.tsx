import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DirectoryFilters } from '@/hooks/useAgentDirectory'

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']

const SPECIALTIES = ['residential', 'commercial', 'luxury', 'new', 'rental'] as const
const LANGUAGES = ['fr', 'de', 'en', 'it'] as const

interface AgentSearchBarProps {
  filters: DirectoryFilters
  onChange: (filters: Partial<DirectoryFilters>) => void
}

export default function AgentSearchBar({ filters, onChange }: AgentSearchBarProps) {
  const { t } = useTranslation('directory')

  function toggleInArray<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
        <input
          type="text"
          value={filters.query}
          onChange={e => onChange({ query: e.target.value, page: 0 })}
          placeholder={t('searchPlaceholder')}
          className="w-full h-11 pl-10 pr-4 text-sm bg-transparent border border-theme-border rounded-xl text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
      </div>

      {/* Type toggle */}
      <div className="flex items-center gap-2">
        {(['agents', 'agencies'] as const).map(type => (
          <button
            key={type}
            onClick={() => onChange({ type, page: 0 })}
            className={cn(
              'h-9 px-4 rounded-lg text-sm transition-colors',
              filters.type === type
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            {type === 'agents' ? t('toggleAgents') : t('toggleAgencies')}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2">
        {/* Canton */}
        <select
          value={filters.canton ?? ''}
          onChange={e => onChange({ canton: e.target.value || null, page: 0 })}
          className="h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none appearance-none"
        >
          <option value="">{t('filterAllSwitzerland')}</option>
          {CANTONS.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Specialties */}
        {SPECIALTIES.map(s => (
          <button
            key={s}
            onClick={() => onChange({ specialties: toggleInArray(filters.specialties, s), page: 0 })}
            className={cn(
              'h-9 px-3 rounded-lg text-xs transition-colors',
              filters.specialties.includes(s)
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
            )}
          >
            {t(`specialty.${s}`)}
          </button>
        ))}

        {/* Languages */}
        {LANGUAGES.map(l => (
          <button
            key={l}
            onClick={() => onChange({ languages: toggleInArray(filters.languages, l), page: 0 })}
            className={cn(
              'h-9 px-3 rounded-lg text-xs uppercase transition-colors',
              filters.languages.includes(l)
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
            )}
          >
            {l}
          </button>
        ))}

        {/* Verified toggle */}
        <button
          onClick={() => onChange({ verifiedOnly: !filters.verifiedOnly, page: 0 })}
          className={cn(
            'h-9 px-3 rounded-lg text-xs transition-colors',
            filters.verifiedOnly
              ? 'bg-accent/10 text-accent font-medium'
              : 'border border-theme-border text-theme-secondary hover:text-theme-primary'
          )}
        >
          {t('filterVerified')}
        </button>
      </div>
    </div>
  )
}
