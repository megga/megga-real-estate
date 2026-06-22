// MEGGA CRM Sugar v2 — Settings Privacy & nLPD/RGPD section (wired).
//
// Actions câblées :
//   - Supprimer mon compte → Edge Function delete-account (existante, conforme
//     nLPD art. 32 droit à l'effacement + LBA conservation 10 ans pour KYC).
//   - Politique de confidentialité → lien externe vers /privacy.
//   - Exporter mes données / Demander une rectification → mailto privacy@megga.ch
//     (DSAR export Edge Function = chip dédié quand le format ZIP+JSON+PDF sera spec).
//
// Retirés (chip dédié) :
//   - Bloc consentements (analytics/aiTraining/marketing/cookies) : besoin de
//     colonnes profiles.consent_* + cookie banner unifié.
//   - Bloc visibilité/partage (annuaire/share/encryption) : besoin colonnes
//     dédiées + flow chiffrement client-side.
//   - Bloc rétention (autoArchiveLeads, dataRetentionMonths) : besoin policies
//     Postgres pg_cron + RPC.
//   Le sticky save bar disparaît avec eux — plus rien à "enregistrer".

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import {
  ConfirmModal,
  SectionHeader,
  SetCard,
  SetGhostBtn,
  SetIcon,
} from './atoms'
import { SET_PALETTE, type SettingsIconName } from './data'

const SET = SET_PALETTE

const SUPPORT_EMAIL = 'privacy@megga.ch'

interface RightCardProps {
  icon: SettingsIconName
  title: string
  desc: string
  cta: string
  onClick: () => void
  danger?: boolean
  loading?: boolean
}

function RightCard({ icon, title, desc, cta, onClick, danger, loading }: RightCardProps) {
  const { t } = useTranslation('settings')
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '18px 20px',
        borderRadius: 16,
        background: hover ? SET.card : SET.cardSubtle,
        boxShadow: hover
          ? '0 12px 28px rgba(11,12,14,0.08), inset 0 0 0 1px rgba(15,23,42,0.04)'
          : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all .15s',
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: danger ? `${SET.bad}18` : SET.card,
          color: danger ? SET.bad : SET.ink,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <SetIcon name={icon} size={18} stroke={danger ? SET.bad : SET.ink} />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.1,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: SET.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={loading}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 14px',
          borderRadius: 999,
          border: 0,
          background: danger ? SET.bad : SET.black,
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? t('privacy.sending') : cta}
      </button>
    </div>
  )
}

export function PrivacySection() {
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: {},
      })
      if (error) {
        // Edge Function HTTP error (network / 500)
        toast.error(t('privacy.deleteError', { message: error.message }))
        setDeleteOpen(false)
        return
      }
      // Edge Function may return business-error JSON with 400
      const payload = data as { error?: string; message?: string } | null
      if (payload?.error) {
        toast.error(payload.message || t('privacy.deleteRefused'))
        setDeleteOpen(false)
        return
      }
      // Success — session is invalidated server-side. Sign out client-side and redirect.
      await supabase.auth.signOut()
      toast.success(t('privacy.deleteSuccess'), { duration: 4000 })
      navigate('/auth/login', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('privacy.unknownError')
      toast.error(t('privacy.deleteError', { message: msg }))
    } finally {
      setDeleting(false)
    }
  }

  // mailto: ouvre le client mail de l'utilisateur — solution intérim avant
  // l'Edge Function dsar-export dédiée.
  const handleExportData = () => {
    const subject = encodeURIComponent(t('privacy.export.mailSubject'))
    const body = encodeURIComponent(
      t('privacy.export.mailBody', { account: user?.email ?? t('privacy.notIdentified') }),
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  const handleRectification = () => {
    const subject = encodeURIComponent(t('privacy.rectification.mailSubject'))
    const body = encodeURIComponent(
      t('privacy.rectification.mailBody', { account: user?.email ?? t('privacy.notIdentified') }),
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  const handleViewPolicy = () => {
    window.open('https://megga.ch/legal/privacy', '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker={t('privacy.header.kicker')}
          title={t('privacy.header.title')}
          sub={t('privacy.header.sub')}
        />

        {/* Bandeau conformité — informationnel uniquement */}
        <SetCard padding={0}>
          <div
            style={{
              padding: '22px 28px',
              background: `linear-gradient(135deg, ${SET.cardSubtle} 0%, ${SET.card} 100%)`,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              borderRadius: 24,
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                background: `${SET.ok}18`,
                color: SET.ok,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <SetIcon name="shield" size={26} stroke={SET.ok} sw={1.8} />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: -0.1,
                  marginBottom: 3,
                }}
              >
                {t('privacy.banner.title')}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {t('privacy.banner.desc')}
              </div>
            </div>
            <SetGhostBtn
              size="sm"
              onClick={handleViewPolicy}
              icon={<SetIcon name="external" size={13} stroke={SET.inkSoft} />}
            >
              {t('privacy.banner.policyCta')}
            </SetGhostBtn>
          </div>
        </SetCard>

        {/* Mes droits RGPD / nLPD */}
        <SetCard
          title={t('privacy.rights.title')}
          sub={t('privacy.rights.sub')}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
            }}
          >
            <RightCard
              icon="download"
              title={t('privacy.cards.export.title')}
              desc={t('privacy.cards.export.desc')}
              cta={t('privacy.cards.export.cta')}
              onClick={handleExportData}
            />
            <RightCard
              icon="doc"
              title={t('privacy.cards.policy.title')}
              desc={t('privacy.cards.policy.desc')}
              cta={t('privacy.cards.policy.cta')}
              onClick={handleViewPolicy}
            />
            <RightCard
              icon="alert"
              title={t('privacy.cards.rectification.title')}
              desc={t('privacy.cards.rectification.desc')}
              cta={t('privacy.cards.rectification.cta')}
              onClick={handleRectification}
            />
            <RightCard
              icon="trash"
              title={t('privacy.cards.delete.title')}
              desc={t('privacy.cards.delete.desc')}
              cta={t('privacy.cards.delete.cta')}
              danger
              loading={deleting}
              onClick={() => setDeleteOpen(true)}
            />
          </div>
        </SetCard>

        {/* Note sur les obligations légales */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 12,
            background: `${SET.warn}10`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <SetIcon name="info" size={14} stroke={SET.warn} sw={2.2} />
          <span style={{ fontSize: 12.5, color: SET.inkSoft, lineHeight: 1.55, fontWeight: 500 }}>
            {t('privacy.legalNote.before')}{' '}
            <strong style={{ color: SET.ink }}>{t('privacy.legalNote.duration')}</strong>{' '}
            {t('privacy.legalNote.after')}
          </span>
        </div>
      </div>

      {deleteOpen && (
        <ConfirmModal
          title={t('privacy.deleteModal.title')}
          desc={t('privacy.deleteModal.desc')}
          danger={t('privacy.deleteModal.confirm')}
          onCancel={() => !deleting && setDeleteOpen(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </>
  )
}
