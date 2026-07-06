// MEGGA CRM Sugar v3 — Fiche détail Contact (livrable Sprint 1)
// Port pixel-près de crm-screen-contact-detail-sugar.jsx (CRMScreenContactDetailSugar).
//
// Structure :
//   - CdKycBanner (top, si KYC ≠ verified)
//   - CdHero (avatar 96px + meta + actions)
//   - Grid 1.6fr / 1fr :
//      Main : CdTimelineCard + CdNotesCard
//      Sidebar : CdKycCard + CdCriteriaCard + CdDocsCard
//
// Deep-link contact → KYC : window.location → /dashboard/kyc?openContactId=<id>

import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import {
  SugarV3,
  SUGAR_V3_KEYFRAMES,
} from '@/components/crm-sugar-v3/tokens'
import { CdKycBanner } from '@/components/crm-sugar-v3/contact-detail/CdKycBanner'
import { CdHero } from '@/components/crm-sugar-v3/contact-detail/CdHero'
import { CdKycCard } from '@/components/crm-sugar-v3/contact-detail/CdKycCard'
import { CdTimelineCard } from '@/components/crm-sugar-v3/contact-detail/CdTimelineCard'
import { CdNotesCard } from '@/components/crm-sugar-v3/contact-detail/CdNotesCard'
import { CdDocsCard } from '@/components/crm-sugar-v3/contact-detail/CdDocsCard'
import { CdSignatureCard } from '@/components/crm-sugar-v3/contact-detail/CdSignatureCard'
import { CdCriteriaCard } from '@/components/crm-sugar-v3/contact-detail/CdCriteriaCard'
import { CdWhatsAppCard } from '@/components/crm-sugar-v3/contact-detail/CdWhatsAppCard'
import { CdConversationInsight } from '@/components/crm-sugar-v3/contact-detail/CdConversationInsight'
import { CdFollowupSuggestions } from '@/components/crm-sugar-v3/contact-detail/CdFollowupSuggestions'
import { CdToTraitInbox } from '@/components/crm-sugar-v3/contact-detail/CdToTraitInbox'
import { CdFilDuDossier } from '@/components/crm-sugar-v3/contact-detail/CdFilDuDossier'
import { useContact } from '@/hooks/useContacts'
import { useContactSentMatches } from '@/hooks/useContactSentMatches'
import { useKycDossierByContact } from '@/hooks/useKycDossier'
import { useAuditEvents } from '@/hooks/useAuditLog'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

const DARK_TONE: DarkTone = 'meggaAi'

export default function ContactDetailSugarV3Page() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  // `t` est déjà pris par les tokens de thème (CRM_TOKENS) plus bas → alias `tr`.
  const { t: tr } = useTranslation('contacts')

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = useMemo(() => crmSugarPalette(t, dark, DARK_TONE), [t, dark])

  const { data: contact, isLoading, isError, refetch } = useContact(id)
  const { data: dossier } = useKycDossierByContact(id)
  // Boucle de match : dossiers transmis + réactions acheteur (live, realtime).
  const loop = useContactSentMatches(id)
  const openAtelierForBuyer = () => id && navigate(`/dashboard/matching?contact=${id}`)

  // Activity events filtrés sur cet entity_id
  const { data: allEvents = [] } = useAuditEvents({ days: 90 })
  const contactEvents = useMemo(
    () => allEvents.filter((e) => e.entity_id === id || (e.entity_type === 'contact' && e.entity_id === id)),
    [allEvents, id],
  )

  // Documents pour ce contact
  const { data: docs = [] } = useQuery({
    queryKey: ['contact-docs', id, profile?.agency_id],
    queryFn: async () => {
      if (!id || !profile?.agency_id) return []
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: !!id && !!profile?.agency_id,
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const onNavigate = (screenId: SugarScreenId | string) => {
    switch (screenId) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'audit': navigate('/dashboard/audit'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onCmd = () => {}

  const onOpenKyc = () => {
    // Deep-link via query param (KYC_ENRICHISSEMENTS §6)
    if (id) navigate(`/dashboard/kyc?openContactId=${encodeURIComponent(id)}`)
  }

  if (isError && !contact) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          fontFamily: SugarV3.font,
          color: SugarV3.muted,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div style={{ textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: SugarV3.ink, marginBottom: 6 }}>{tr('cd.error.title')}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>{tr('cd.error.message')}</div>
          <button
            onClick={() => refetch()}
            style={{ height: 34, padding: '0 16px', borderRadius: 999, background: 'transparent', color: SugarV3.ink, border: `1px solid ${SugarV3.muted}`, cursor: 'pointer', fontFamily: SugarV3.font, fontSize: 12.5, fontWeight: 700 }}
          >
            {tr('cd.error.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !contact) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          fontFamily: SugarV3.font,
          color: SugarV3.muted,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {tr('cd.loading')}
      </div>
    )
  }

  return (
    <div
      data-screen-label="CRM Contact détail (sugar v3)"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: SugarV3.bgGradient,
        fontFamily: SugarV3.font,
        color: SugarV3.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{SUGAR_V3_KEYFRAMES}</style>

      <SugarTopNav
        active={'contacts' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="contacts"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main className="sg-main-padded" style={{ flex: 1, minWidth: 0, padding: '100px 40px 120px 40px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <CdKycBanner dossier={dossier ?? null} onOpenKyc={onOpenKyc} />
            <CdHero
              contact={contact}
              onBack={() => navigate('/dashboard/contacts')}
              agentName={profile?.full_name ?? undefined}
              onSchedule={() => navigate('/dashboard/calendar')}
              onNewAction={() => navigate('/dashboard/visits/new')}
            />

            {/* Boucle de match — F : inbox « À traiter » (likes acheteur non traités) */}
            <CdToTraitInbox pendingLikes={loop.pendingLikes} onProposeVisit={openAtelierForBuyer} />

            <div className="sg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
              {/* COLONNE PRINCIPALE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Boucle de match — E : fil du dossier (état de réception) */}
                <CdFilDuDossier loop={loop} onOpenAtelier={openAtelierForBuyer} />
                <CdTimelineCard events={contactEvents} />
                <CdNotesCard key={contact.id} contactId={contact.id} notes={contact.notes} />
                <CdWhatsAppCard contactId={contact.id} />
                <CdConversationInsight contactId={contact.id} />
                <CdFollowupSuggestions contactId={contact.id} />
              </div>

              {/* COLONNE LATÉRALE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <CdKycCard dossier={dossier ?? null} onOpenKyc={onOpenKyc} />
                {contact.search_criteria && (
                  <CdCriteriaCard criteria={contact.search_criteria} />
                )}
                <CdDocsCard docs={docs} />
                <CdSignatureCard contact={contact} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
