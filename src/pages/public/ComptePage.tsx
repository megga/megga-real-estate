import { useEffect, useMemo, useState } from 'react'
import { useFavorites } from '@/hooks/useFavorites'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { useMessaging } from '@/hooks/useMessaging'
import { useVendorDossiers, type VendorDossier } from '@/hooks/useVendorDossiers'
import AccountLayout from '@/components/account/AccountLayout'
import AccountTabHeader from '@/components/account/AccountTabHeader'
import LogoutModal from '@/components/account/LogoutModal'
import MandateSigningModal from '@/components/account/MandateSigningModal'
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

export default function ComptePage() {
  useManropeFont()

  const [section, setSection] = useState<SectionKey>(readHashSection)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [signingDossier, setSigningDossier] = useState<VendorDossier | null>(null)
  const [statsDossier, setStatsDossier] = useState<VendorDossier | null>(null)

  const { favoriteIds } = useFavorites()
  const { searches } = useSavedSearches()
  const { threads } = useMessaging(null)
  const { dossiers, advance } = useVendorDossiers()

  // Listen for hash changes (e.g. clicking a link from Navbar with /compte#favorites)
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
      title: 'Mes annonces',
      subtitle:
        counts.listings === 0
          ? 'Soumettez un dossier pour suivre la mise en vente ici.'
          : `${counts.listings} dossier${counts.listings > 1 ? 's' : ''} en cours`,
    },
    searches: {
      title: 'Mes recherches',
      subtitle:
        counts.searches === 0
          ? 'Sauvegardez une recherche pour recevoir des alertes.'
          : `${counts.searches} recherche${counts.searches > 1 ? 's' : ''} sauvegardée${counts.searches > 1 ? 's' : ''}`,
    },
    favorites: {
      title: 'Favoris',
      subtitle:
        counts.favorites === 0
          ? 'Les biens que vous aimez apparaîtront ici.'
          : `${counts.favorites} bien${counts.favorites > 1 ? 's' : ''} enregistré${counts.favorites > 1 ? 's' : ''}`,
    },
    messages: {
      title: 'Messagerie',
      subtitle:
        threads.length === 0
          ? 'Vos conversations avec les agents apparaîtront ici.'
          : `${threads.length} conversation${threads.length > 1 ? 's' : ''}${unreadMessages > 0 ? ` · ${unreadMessages} non lu${unreadMessages > 1 ? 's' : ''}` : ''}`,
    },
    profile: {
      title: 'Profil',
      subtitle: 'Gérez votre compte et vos préférences.',
    },
  }

  const action = (() => {
    if (section === 'listings') {
      return (
        <a
          href="/vendre"
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
          + Soumettre un bien
        </a>
      )
    }
    if (section === 'searches') {
      return (
        <a
          href="/louer"
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
          <SearchIcon size={15} /> Nouvelle recherche
        </a>
      )
    }
    if (section === 'favorites' && counts.favorites > 0) {
      return (
        <a
          href="/louer"
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
          Voir plus de biens
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
      <MandateSigningModal
        open={!!signingDossier}
        dossier={signingDossier}
        onClose={() => setSigningDossier(null)}
        onConfirm={() => {
          if (signingDossier) {
            advance(signingDossier.id, 'mandate')
            setSigningDossier(null)
          }
        }}
      />
      <ListingStatsDrawer
        open={!!statsDossier}
        dossier={statsDossier}
        onClose={() => setStatsDossier(null)}
      />
    </>
  )
}
