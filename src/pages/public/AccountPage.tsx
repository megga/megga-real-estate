import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFavorites } from '@/hooks/useFavorites'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { useMessaging } from '@/hooks/useMessaging'
import { useVendorDossiers, type VendorDossier } from '@/hooks/useVendorDossiers'
import { useAuth } from '@/hooks/useAuth'
import AccountLayout from '@/components/account/AccountLayout'
import AccountTabHeader from '@/components/account/AccountTabHeader'
import LogoutModal from '@/components/account/LogoutModal'
import { MandateSignModal, type MandateListing } from '@/components/seller-portal/MandateSignModal'
import ListingStatsDrawer from '@/components/account/ListingStatsDrawer'
import ListingsSection from '@/components/account/sections/ListingsSection'
import SearchesSection from '@/components/account/sections/SearchesSection'
import FavoritesSection from '@/components/account/sections/FavoritesSection'
import MessagesSection from '@/components/account/sections/MessagesSection'
import ProfileSection from '@/components/account/sections/ProfileSection'
import type { SectionKey } from '@/components/account/AccountRail'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { SearchIcon } from '@/components/account/icons'

const VALID_KEYS = new Set<SectionKey>(['listings', 'searches', 'favorites', 'messages', 'profile'])

function readHashSection(): SectionKey {
  if (typeof window === 'undefined') return 'profile'
  const raw = window.location.hash.toLowerCase().replace('#', '')
  return VALID_KEYS.has(raw as SectionKey) ? (raw as SectionKey) : 'profile'
}

function useManropeFont() {
  useEffect(() => {
    const id = 'megga-account-manrope'
    if (document.getElementById(id)) return

    const preconnect1 = document.createElement('link')
    preconnect1.rel = 'preconnect'
    preconnect1.href = 'https://fonts.googleapis.com'
    preconnect1.id = `${id}-pc1`

    const preconnect2 = document.createElement('link')
    preconnect2.rel = 'preconnect'
    preconnect2.href = 'https://fonts.gstatic.com'
    preconnect2.crossOrigin = 'anonymous'
    preconnect2.id = `${id}-pc2`

    const stylesheet = document.createElement('link')
    stylesheet.rel = 'stylesheet'
    stylesheet.href =
      'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
    stylesheet.id = id

    document.head.appendChild(preconnect1)
    document.head.appendChild(preconnect2)
    document.head.appendChild(stylesheet)
  }, [])
}

// Mapping VendorDossier → MandateListing pour le MandateSignModal Swisscom QES.
// Les champs manquants côté VendorDossier (firstName, lastName, email, phone,
// city/npa/canton détaillés) sont reconstruits à partir du profil utilisateur
// + parsing best-effort de l'adresse libre.
function vendorDossierToMandateListing(
  d: VendorDossier,
  userMeta?: { firstName?: string; lastName?: string; email?: string; phone?: string }
): MandateListing {
  // Best-effort parsing of "Rue X 12, 1227 Carouge" → { addr, npa, city }
  const parts = d.address.split(',').map(s => s.trim())
  const street = parts[0] || d.address
  const tail = parts[1] || ''
  const npaMatch = tail.match(/(\d{4})/)
  const npa = npaMatch ? npaMatch[1] : ''
  const city = tail.replace(/\d{4}/, '').trim() || ''

  return {
    id: d.id,
    dossier: {
      firstName: userMeta?.firstName || '',
      lastName: userMeta?.lastName || '',
      email: userMeta?.email || '',
      phone: userMeta?.phone || '',
      address: street,
      city,
      npa,
      surface: typeof d.surface === 'number' ? d.surface : Number(d.surface) || 0,
    },
    estimation: d.estimation
      ? {
          low: d.estimation.low,
          mid: d.estimation.mid,
          high: d.estimation.high,
          isRent: d.estimation.isRent,
        }
      : undefined,
    agent: {
      name: d.agent.name,
      agency: d.agent.role,
    },
  }
}

export default function AccountPage() {
  useManropeFont()
  const { t } = useTranslation('compte')
  const { user, profile } = useAuth()

  const [section, setSection] = useState<SectionKey>(readHashSection)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [signingDossier, setSigningDossier] = useState<VendorDossier | null>(null)
  const [statsDossier, setStatsDossier] = useState<VendorDossier | null>(null)

  const { favoriteIds } = useFavorites()
  const { searches } = useSavedSearches()
  const { threads } = useMessaging(null)
  const { dossiers, advance } = useVendorDossiers()

  // Listen for hash changes (e.g. clicking a link from Navbar with /account#favorites)
  useEffect(() => {
    const onHash = () => setSection(readHashSection())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Push hash on tab click
  const handleSelect = (key: SectionKey) => {
    if (window.location.hash !== `#${key}`) {
      window.location.hash = key
    }
    setSection(key)
  }

  const unreadMessages = threads.filter((t) => t.unread_count > 0).length

  const counts: Record<SectionKey, number> = useMemo(
    () => ({
      listings: dossiers.length,
      searches: searches.length,
      favorites: favoriteIds.length,
      messages: unreadMessages,
      profile: 0,
    }),
    [dossiers.length, searches.length, favoriteIds.length, unreadMessages]
  )

  const meta: Record<SectionKey, { title: string; subtitle: string }> = {
    listings: {
      title: t('tabs.listings.title'),
      subtitle:
        counts.listings === 0
          ? t('tabs.listings.subtitle_empty')
          : t('tabs.listings.subtitle_count', { count: counts.listings }),
    },
    searches: {
      title: t('tabs.searches.title'),
      subtitle:
        counts.searches === 0
          ? t('tabs.searches.subtitle_empty')
          : t('tabs.searches.subtitle_count', { count: counts.searches }),
    },
    favorites: {
      title: t('tabs.favorites.title'),
      subtitle:
        counts.favorites === 0
          ? t('tabs.favorites.subtitle_empty')
          : t('tabs.favorites.subtitle_count', { count: counts.favorites }),
    },
    messages: {
      title: t('tabs.messages.title'),
      subtitle:
        threads.length === 0
          ? t('tabs.messages.subtitle_empty')
          : t('tabs.messages.subtitle_count', { count: threads.length }) +
            (unreadMessages > 0 ? t('tabs.messages.subtitle_unread', { count: unreadMessages }) : ''),
    },
    profile: {
      title: t('tabs.profile.title'),
      subtitle: t('tabs.profile.subtitle'),
    },
  }

  const action = (() => {
    if (section === 'listings') {
      return (
        <a
          href="/sell"
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: 999,
            background: T.ink,
            color: '#fff',
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {t('tabs.listings.cta_submit')}
        </a>
      )
    }
    if (section === 'searches') {
      return (
        <a
          href="/rent"
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: 999,
            background: T.ink,
            color: '#fff',
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <SearchIcon size={15} /> {t('tabs.searches.cta_new')}
        </a>
      )
    }
    if (section === 'favorites' && counts.favorites > 0) {
      return (
        <a
          href="/rent"
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: 999,
            background: '#fff',
            color: T.ink,
            border: `1px solid ${T.border}`,
            fontFamily: T.fontStack,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          {t('tabs.favorites.cta_more')}
        </a>
      )
    }
    return null
  })()

  return (
    <>
      <AccountLayout
        section={section}
        counts={counts}
        onSelect={handleSelect}
        onLogout={() => setLogoutOpen(true)}
      >
        <AccountTabHeader
          title={meta[section].title}
          subtitle={meta[section].subtitle}
          action={action}
        />
        {section === 'listings' && (
          <ListingsSection
            onSign={(d) => setSigningDossier(d)}
            onOpenStats={(d) => setStatsDossier(d)}
          />
        )}
        {section === 'searches' && <SearchesSection />}
        {section === 'favorites' && <FavoritesSection />}
        {section === 'messages' && <MessagesSection />}
        {section === 'profile' && <ProfileSection onLogout={() => setLogoutOpen(true)} />}
      </AccountLayout>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
      {signingDossier && (() => {
        // Split user.full_name → firstName + lastName best-effort.
        const nameParts = (profile?.full_name || '').trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ') || ''
        return (
          <MandateSignModal
            listing={vendorDossierToMandateListing(signingDossier, {
              firstName,
              lastName,
              email: user?.email || undefined,
            })}
            open={!!signingDossier}
            onClose={() => setSigningDossier(null)}
            onSigned={() => {
              if (signingDossier) {
                advance(signingDossier.id, 'mandate')
                setSigningDossier(null)
              }
            }}
          />
        )
      })()}
      <ListingStatsDrawer
        open={!!statsDossier}
        dossier={statsDossier}
        onClose={() => setStatsDossier(null)}
      />
    </>
  )
}
