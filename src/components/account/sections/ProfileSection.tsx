import { useState } from 'react'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useAuth } from '@/hooks/useAuth'
import { useFavorites } from '@/hooks/useFavorites'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { useVendorDossiers } from '@/hooks/useVendorDossiers'
import { useUserActivity } from '@/hooks/useUserActivity'
import { useProfileMeta } from '@/hooks/useProfileMeta'
import { useIsMobile } from '@/hooks/useMediaQuery'
import ProfileHero from '../profile/ProfileHero'
import ProfileSideNav, { type SideNavSection } from '../profile/ProfileSideNav'
import SectionShell from '../profile/SectionShell'
import MyListingsRow from '../profile/MyListingsRow'
import MySearchRow from '../profile/MySearchRow'
import VisitsRow from '../profile/VisitsRow'
import C2PASignatureGallery, { type Signature } from '../profile/C2PASignatureGallery'
import ActivityTimeline from '../profile/ActivityTimeline'
import ProfileSettingsDrawer from '../profile/ProfileSettingsDrawer'

interface Props {
  onLogout: () => void
}

function GuestPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <div
        style={{
          padding: 32,
          borderRadius: 18,
          background: T.accentSoft,
          border: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 22,
            fontWeight: 700,
            color: T.ink,
            marginBottom: 10,
            letterSpacing: -0.4,
          }}
        >
          Créez votre compte MEGGA
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 14,
            color: T.soft,
            lineHeight: 1.55,
            marginBottom: 22,
            maxWidth: 520,
          }}
        >
          Synchronisez vos favoris, recevez des alertes sur vos recherches sauvegardées, et échangez
          avec les agents directement depuis votre tableau de bord.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="/login"
            style={{
              height: 44,
              padding: '0 22px',
              borderRadius: 999,
              background: T.ink,
              color: '#fff',
              textDecoration: 'none',
              fontFamily: T.fontStack,
              fontSize: 14,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Créer un compte
          </a>
          <a
            href="/login"
            style={{
              height: 44,
              padding: '0 18px',
              borderRadius: 999,
              background: 'transparent',
              color: T.soft,
              textDecoration: 'none',
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Se connecter
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ProfileSection({ onLogout }: Props) {
  const { user, profile } = useAuth()
  const { meta, update } = useProfileMeta()
  const { favoriteIds } = useFavorites()
  const { searches } = useSavedSearches()
  const { dossiers } = useVendorDossiers()
  const { events } = useUserActivity()
  const isMobile = useIsMobile()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPage, setSettingsPage] = useState<'info' | 'preferences' | 'notifications' | 'security' | 'privacy'>('info')

  if (!user || !profile) return <GuestPanel />

  const joinedDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
    : '—'

  // Mock C2PA signatures (will be wired to real data when staging studio writes them)
  const mockSignatures: Signature[] = []

  const stats = [
    { label: dossiers.length > 1 ? 'annonces' : 'annonce', value: dossiers.length },
    { label: 'favoris', value: favoriteIds.length },
    { label: 'recherches', value: searches.length },
    { label: 'signatures', value: mockSignatures.length },
  ]

  const showSeller = meta.mode === 'seller' || meta.mode === 'mixed'
  const showBuyer = meta.mode === 'buyer' || meta.mode === 'mixed'

  const navItems: SideNavSection[] = [
    { id: 'profile-hero', label: 'Identité' },
    { id: 'profile-c2pa', label: 'Signatures C2PA', count: mockSignatures.length },
    ...(showSeller ? [{ id: 'profile-listings', label: 'Mes annonces', count: dossiers.length }] : []),
    ...(showBuyer
      ? [{ id: 'profile-search', label: 'Ma recherche', count: searches.length + favoriteIds.length }]
      : []),
    { id: 'profile-activity', label: 'Activité', count: events.length },
    { id: 'profile-settings', label: 'Confiance & sécurité' },
  ]

  const openSettings = (page: typeof settingsPage) => {
    setSettingsPage(page)
    setSettingsOpen(true)
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 200px',
          gap: isMobile ? 16 : 40,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section id="profile-hero" style={{ scrollMarginTop: 96 }}>
            <ProfileHero
              stats={stats}
              joinedDate={joinedDate}
              city={profile.canton}
              onUpgradeId={() => update({ verifications: { id: true } })}
            />
          </section>

          <C2PASignatureGallery signatures={mockSignatures} />

          {showSeller && <MyListingsRow />}

          {showBuyer && <MySearchRow />}

          {showBuyer && <VisitsRow />}

          <ActivityTimeline events={events} />

          <SectionShell
            id="profile-settings"
            title="Confiance & sécurité"
            subtitle="Vérification, confidentialité, accès aux données"
            action={
              <button
                onClick={() => openSettings('info')}
                style={{
                  height: 30,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${T.accent}`,
                  background: T.accent,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                }}
              >
                Ouvrir les réglages
              </button>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                padding: '10px 0 14px',
              }}
            >
              {[
                { label: 'E-mail', value: user.email ?? '—' },
                { label: 'Téléphone', value: profile.phone ?? '—' },
                { label: 'Canton', value: profile.canton ?? '—' },
                { label: 'Langues', value: meta.preferences.languages.join(' · ') },
              ].map((c) => (
                <div key={c.label} style={{ padding: '10px 0' }}>
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 10,
                      fontWeight: 700,
                      color: T.muted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      fontFamily: T.fontStack,
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.ink,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${T.border}` }}>
              {[
                { key: 'info', label: 'Informations personnelles', sub: 'Nom, e-mail, téléphone, ville' },
                { key: 'preferences', label: 'Préférences', sub: 'Langues, devise, surfaces, tri' },
                {
                  key: 'notifications',
                  label: 'Notifications',
                  sub: 'E-mail, push, SMS, fréquence',
                  status: { label: `${[meta.notifications.email, meta.notifications.push, meta.notifications.sms].filter(Boolean).length}/3 canaux`, tone: 'muted' as const },
                },
                {
                  key: 'security',
                  label: 'Sécurité',
                  sub: 'Mot de passe, 2FA, sessions',
                  status: meta.security.twoFactor
                    ? { label: '2FA actif', tone: 'ok' as const }
                    : { label: '2FA non actif', tone: 'warn' as const },
                },
                {
                  key: 'privacy',
                  label: 'Confidentialité & données',
                  sub: 'Visibilité, export, suppression',
                  status: meta.privacy.profilePublic
                    ? { label: 'Profil visible', tone: 'muted' as const }
                    : { label: 'Profil privé', tone: 'ok' as const },
                },
              ].map((p, i, arr) => {
                const tone =
                  p.status?.tone === 'ok'
                    ? { bg: T.greenSoft, fg: T.green }
                    : p.status?.tone === 'warn'
                    ? { bg: T.warningSoft, fg: T.warning }
                    : { bg: '#F2F4F8', fg: T.soft }
                return (
                  <button
                    key={p.key}
                    onClick={() => openSettings(p.key as typeof settingsPage)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 0',
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : 'none',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: T.fontStack,
                          fontSize: 13,
                          fontWeight: 700,
                          color: T.ink,
                          marginBottom: 4,
                          lineHeight: 1.3,
                        }}
                      >
                        {p.label}
                      </div>
                      <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                        {p.sub}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {p.status && (
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: 999,
                            background: tone.bg,
                            color: tone.fg,
                            fontFamily: T.fontStack,
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {p.status.label}
                        </span>
                      )}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.muted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 3l4 4-4 4" />
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 10,
                background: T.page,
                border: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: '#fff',
                    border: `1px solid ${T.border}`,
                    color: T.soft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="12" height="8" rx="1.5" />
                    <path d="M5 13h6" />
                  </svg>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontStack, fontSize: 12, fontWeight: 700, color: T.ink }}>
                    {meta.sessions.find((s) => s.current)?.device || 'Cet appareil'}
                  </div>
                  <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>
                    Session active · {meta.sessions.filter((s) => !s.current).length} autre
                    {meta.sessions.filter((s) => !s.current).length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${T.border}`,
                  background: '#fff',
                  color: T.ink,
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Se déconnecter
              </button>
            </div>
          </SectionShell>
        </div>

        {!isMobile && <ProfileSideNav sections={navItems} />}
      </div>

      <ProfileSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialPage={settingsPage}
      />
    </>
  )
}
