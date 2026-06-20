import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, UserCog, Home, ShoppingCart, X } from 'lucide-react'
import Fuse from 'fuse.js'
import { ALL_ARTICLES, type HelpArticle } from '@/lib/helpArticles'

const CATEGORY_ICONS: Record<HelpArticle['category'], typeof UserCog> = {
  agent: UserCog,
  vendeur: Home,
  acheteur: ShoppingCart,
}

const CATEGORY_LABEL_KEYS: Record<HelpArticle['category'], string> = {
  agent: 'help.categoryAgentShort',
  vendeur: 'help.categorySellerShort',
  acheteur: 'help.categoryBuyerShort',
}

export default function HelpSearchBar() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fuse = useMemo(
    () =>
      new Fuse(ALL_ARTICLES, {
        threshold: 0.4,
        keys: ['title', 'description', 'keywords'],
      }),
    []
  )

  const results = useMemo(() => {
    if (!query.trim()) return []
    return fuse.search(query).slice(0, 6).map(r => r.item)
  }, [fuse, query])

  // Sync derived state from query — intentional setState on query change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setActiveIndex(-1)
    setOpen(query.trim().length > 0)
  }, [query])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const goToArticle = useCallback(
    (article: HelpArticle) => {
      setOpen(false)
      setQuery('')
      navigate(`/help/${article.category}/${article.slug}`)
    },
    [navigate]
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault()
      goToArticle(results[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t('help.searchPlaceholder')}
          className="w-full h-11 pl-10 pr-10 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {results.length > 0 ? (
            <ul>
              {results.map((article, i) => {
                const Icon = CATEGORY_ICONS[article.category]
                return (
                  <li key={article.slug}>
                    <button
                      onClick={() => goToArticle(article)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        i === activeIndex ? 'bg-gray-50' : ''
                      }`}
                    >
                      <Icon className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{article.title}</p>
                        <p className="text-xs text-gray-500 truncate">{t(CATEGORY_LABEL_KEYS[article.category])} &middot; {article.description}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center">
              <img src="/illustrations/maggy/LookingFor.svg" alt="" className="w-40 h-32 mx-auto mb-3" loading="lazy" decoding="async" />
              <p className="text-sm text-gray-500 mb-3">{t('help.noResults', { query })}</p>
              <div className="flex items-center justify-center gap-3">
                <a
                  href="/dashboard/julien"
                  className="text-xs text-accent hover:underline"
                >
                  {t('help.askMeggaAi')}
                </a>
                <span className="text-gray-500">|</span>
                <a
                  href="mailto:support@megga.ch"
                  className="text-xs text-accent hover:underline"
                >
                  {t('help.sendTicket')}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
