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
        {loading ? 'Envoi…' : cta}
      </button>
    </div>
  )
}

export function PrivacySection() {
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
        toast.error(`Échec suppression : ${error.message}`)
        setDeleteOpen(false)
        return
      }
      // Edge Function may return business-error JSON with 400
      const payload = data as { error?: string; message?: string } | null
      if (payload?.error) {
        toast.error(payload.message || 'Suppression refusée')
        setDeleteOpen(false)
        return
      }
      // Success — session is invalidated server-side. Sign out client-side and redirect.
      await supabase.auth.signOut()
      toast.success('Compte supprimé. À bientôt.', { duration: 4000 })
      navigate('/auth/login', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec suppression : ${msg}`)
    } finally {
      setDeleting(false)
    }
  }

  // mailto: ouvre le client mail de l'utilisateur — solution intérim avant
  // l'Edge Function dsar-export dédiée.
  const handleExportData = () => {
    const subject = encodeURIComponent('Demande d\'export de mes données (RGPD art. 15)')
    const body = encodeURIComponent(
      `Bonjour,\n\nConformément à l'article 15 du RGPD, je demande une copie de toutes mes données personnelles traitées par MEGGA.\n\nMon compte : ${user?.email ?? '(non identifié)'}\n\nMerci.`,
    )
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
  }

  const handleRectification = () => {
    const subject = encodeURIComponent('Demande de rectification de mes données (RGPD art. 16)')
    const body = encodeURIComponent(
      `Bonjour,\n\nConformément à l'article 16 du RGPD, je demande la rectification des données suivantes :\n\n[Décrivez ici les données à corriger]\n\nMon compte : ${user?.email ?? '(non identifié)'}\n\nMerci.`,
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
          kicker="Confidentialité & RGPD"
          title="Vos données, vos règles"
          sub="MEGGA est conforme au RGPD européen et à la nLPD suisse. Exercez vos droits à tout moment, sans frais."
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
                Compte conforme · RGPD · nLPD suisse
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                Données hébergées en Europe (eu-west-1) · Chiffrement AES-256 au repos et TLS 1.3 en transit
              </div>
            </div>
            <SetGhostBtn
              size="sm"
              onClick={handleViewPolicy}
              icon={<SetIcon name="external" size={13} stroke={SET.inkSoft} />}
            >
              Politique
            </SetGhostBtn>
          </div>
        </SetCard>

        {/* Mes droits RGPD / nLPD */}
        <SetCard
          title="Mes droits"
          sub="Articles 15 à 21 du règlement européen — exerçables à tout moment, sans frais."
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
              title="Exporter mes données"
              desc="Demande d'export ZIP (JSON + PDF). Délai légal : 30 jours."
              cta="Envoyer la demande"
              onClick={handleExportData}
            />
            <RightCard
              icon="doc"
              title="Politique de confidentialité"
              desc="Détail des traitements, sous-traitants et durées de conservation."
              cta="Lire la politique"
              onClick={handleViewPolicy}
            />
            <RightCard
              icon="alert"
              title="Demander une rectification"
              desc="Corriger ou compléter une information personnelle inexacte."
              cta="Envoyer la demande"
              onClick={handleRectification}
            />
            <RightCard
              icon="trash"
              title="Supprimer mon compte"
              desc="Effacement définitif. Conservation légale de 10 ans pour pièces comptables (LBA art. 7 al. 3)."
              cta="Supprimer mon compte"
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
            Les pièces comptables et mandats signés sont conservés{' '}
            <strong style={{ color: SET.ink }}>10 ans</strong> indépendamment de votre
            choix — obligation légale CO art. 958f et LBA art. 7 al. 3.
          </span>
        </div>
      </div>

      {deleteOpen && (
        <ConfirmModal
          title="Supprimer définitivement votre compte ?"
          desc="Vos contacts et profil seront anonymisés, vos documents non-KYC supprimés. Les dossiers KYC en cours doivent être finalisés avant. Cette action est irréversible."
          danger="Supprimer définitivement"
          onCancel={() => !deleting && setDeleteOpen(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </>
  )
}
