// MEGGA CRM Sugar v2 — Settings Privacy & RGPD section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step4.jsx` (SettingsPrivacySection + helpers).

import { useState } from 'react'
import {
  ConfirmModal,
  SectionHeader,
  SetCard,
  SetGhostBtn,
  SetIcon,
  StickySaveBar,
  Toast,
  ToggleRow,
} from './atoms'
import { SET_PALETTE, type SettingsIconName } from './data'

const SET = SET_PALETTE

interface PrivacyData {
  analyticsConsent: boolean
  aiTraining: boolean
  marketingConsent: boolean
  dataRetentionMonths: number
  autoArchiveLeads: number
  cookieMarketing: boolean
  cookiePerformance: boolean
  showInAgentDirectory: boolean
  shareWithAgency: boolean
  encryptDocuments: boolean
}

const DEFAULT_PRIVACY: PrivacyData = {
  analyticsConsent: true,
  aiTraining: false,
  marketingConsent: false,
  dataRetentionMonths: 36,
  autoArchiveLeads: 12,
  cookieMarketing: false,
  cookiePerformance: true,
  showInAgentDirectory: true,
  shareWithAgency: true,
  encryptDocuments: true,
}

interface RightCardProps {
  icon: SettingsIconName
  title: string
  desc: string
  cta: string
  onClick?: () => void
  danger?: boolean
}

function RightCard({ icon, title, desc, cta, onClick, danger }: RightCardProps) {
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
          boxShadow: danger ? 'none' : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
        }}
      >
        <SetIcon name={icon} size={17} stroke={danger ? SET.bad : SET.ink} />
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
        style={{
          alignSelf: 'flex-start',
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 700,
          color: danger ? SET.bad : SET.ink,
          letterSpacing: -0.1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {cta}
        <SetIcon name="arrowR" size={12} stroke={danger ? SET.bad : SET.ink} sw={2.4} />
      </button>
    </div>
  )
}

interface RetentionFieldProps {
  label: string
  value: number
  onChange: (v: number) => void
  options: number[]
  unit: string
  hint?: string
}

function RetentionField({
  label,
  value,
  onChange,
  options,
  unit,
  hint,
}: RetentionFieldProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 48,
          padding: '0 16px',
          borderRadius: 14,
          border: 0,
          outline: 'none',
          background: SET.cardSubtle,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          color: SET.ink,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          appearance: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o} value={o}>
            {o} {unit}
          </option>
        ))}
      </select>
      {hint && (
        <div
          style={{
            fontSize: 11.5,
            color: SET.muted,
            fontWeight: 500,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

export function PrivacySection() {
  const [data, setData] = useState<PrivacyData>(DEFAULT_PRIVACY)
  const [saved, setSaved] = useState<PrivacyData>(DEFAULT_PRIVACY)
  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const set = <K extends keyof PrivacyData>(k: K, v: PrivacyData[K]) =>
    setData(d => ({ ...d, [k]: v }))

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaved(data)
      setSaving(false)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    }, 700)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Confidentialité & RGPD"
          title="Vos données, vos règles"
          sub="MEGGA est conforme au RGPD européen et à la nLPD suisse. Vous gardez le contrôle de ce qui est collecté, partagé, conservé."
        />

        {/* Bandeau conformité */}
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
                Compte conforme · RGPD · nLPD suisse · ISO 27001
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                Données hébergées en Suisse (Genève) · Chiffrement AES-256 au repos et TLS
                1.3 en transit · Audit annuel indépendant
              </div>
            </div>
            <SetGhostBtn
              size="sm"
              icon={<SetIcon name="doc" size={13} stroke={SET.inkSoft} />}
            >
              Voir le rapport
            </SetGhostBtn>
          </div>
        </SetCard>

        {/* Mes droits RGPD */}
        <SetCard
          title="Mes droits RGPD"
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
              desc="Toutes vos données dans un fichier ZIP (JSON + PDF). Délai : sous 24 h."
              cta="Demander l'export"
              onClick={() => setExportOpen(true)}
            />
            <RightCard
              icon="doc"
              title="Politique de confidentialité"
              desc="Détail des traitements, sous-traitants et durées de conservation."
              cta="Lire la politique"
            />
            <RightCard
              icon="alert"
              title="Demander une rectification"
              desc="Corriger ou compléter une information personnelle inexacte."
              cta="Faire une demande"
            />
            <RightCard
              icon="trash"
              title="Supprimer mon compte"
              desc="Effacement définitif. Conservation légale de 10 ans pour pièces comptables."
              cta="Supprimer mon compte"
              danger
              onClick={() => setDeleteOpen(true)}
            />
          </div>
        </SetCard>

        {/* Consentements */}
        <SetCard
          title="Consentements"
          sub="Vous pouvez retirer chacun de ces consentements à tout moment."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleRow
              label="Analytics produit"
              desc="Collecte anonymisée pour améliorer le CRM (Plausible, sans cookies tiers)."
              value={data.analyticsConsent}
              onChange={v => set('analyticsConsent', v)}
              emphasis
            />
            <ToggleRow
              label="Entraînement de Julien IA sur mes interactions"
              desc="Utiliser vos messages pour améliorer les suggestions. Données anonymisées avant traitement."
              value={data.aiTraining}
              onChange={v => set('aiTraining', v)}
              emphasis
            />
            <ToggleRow
              label="Communications marketing MEGGA"
              desc="Newsletter, nouveautés produit, événements partenaires (max 1 par mois)."
              value={data.marketingConsent}
              onChange={v => set('marketingConsent', v)}
              emphasis
            />
            <ToggleRow
              label="Cookies de performance"
              desc="Mesure de la rapidité du CRM, sans identification."
              value={data.cookiePerformance}
              onChange={v => set('cookiePerformance', v)}
              emphasis
            />
            <ToggleRow
              label="Cookies marketing"
              desc="Personnalisation des invitations à des événements MEGGA."
              value={data.cookieMarketing}
              onChange={v => set('cookieMarketing', v)}
              emphasis
            />
          </div>
        </SetCard>

        {/* Visibilité & partage */}
        <SetCard
          title="Visibilité & partage"
          sub="Qui peut voir quoi à propos de vous et de vos clients."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleRow
              label="Apparaître dans l'annuaire MEGGA"
              desc="Les autres agents peuvent vous trouver et vous contacter pour des biens partagés."
              value={data.showInAgentDirectory}
              onChange={v => set('showInAgentDirectory', v)}
              emphasis
            />
            <ToggleRow
              label="Partager les contacts avec mon agence"
              desc="Les co-équipiers de votre agence accèdent à votre carnet d'adresses (lecture seule)."
              value={data.shareWithAgency}
              onChange={v => set('shareWithAgency', v)}
              emphasis
            />
            <ToggleRow
              label="Chiffrement client-side des documents sensibles"
              desc="Mandats, pièces d'identité et offres : chiffrés par votre clé locale avant upload."
              value={data.encryptDocuments}
              onChange={v => set('encryptDocuments', v)}
              emphasis
            />
          </div>
        </SetCard>

        {/* Conservation */}
        <SetCard
          title="Conservation des données"
          sub="Les durées de conservation respectent l'OB-LBA (Ordonnance suisse) qui impose 10 ans pour les transactions abouties."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <RetentionField
              label="Conservation des leads inactifs"
              value={data.autoArchiveLeads}
              onChange={v => set('autoArchiveLeads', v)}
              options={[3, 6, 12, 24, 36]}
              unit="mois"
              hint="Leads sans interaction depuis cette durée → archivés automatiquement."
            />
            <RetentionField
              label="Conservation totale des dossiers"
              value={data.dataRetentionMonths}
              onChange={v => set('dataRetentionMonths', v)}
              options={[12, 24, 36, 60, 120]}
              unit="mois"
              hint="Au-delà : anonymisation, sauf transactions soumises à OB-LBA."
            />
          </div>
          <div
            style={{
              marginTop: 14,
              padding: '12px 16px',
              borderRadius: 12,
              background: `${SET.warn}10`,
              color: SET.warn,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <SetIcon name="info" size={14} stroke={SET.warn} sw={2.2} />
            <span style={{ color: SET.inkSoft }}>
              Les pièces comptables et mandats signés sont conservés{' '}
              <strong style={{ color: SET.ink }}>10 ans</strong> indépendamment de ces
              réglages — obligation légale CO art. 958f.
            </span>
          </div>
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setData(saved)}
      />
      <Toast open={toast} label="Confidentialité enregistrée" />

      {exportOpen && (
        <ConfirmModal
          title="Demander l'export de vos données"
          desc="Vous recevrez un email avec un lien sécurisé sous 24 h. Le ZIP contient tous vos contacts, biens, mandats, documents et journal d'activité."
          confirm="Demander l'export"
          onCancel={() => setExportOpen(false)}
          onConfirm={() => setExportOpen(false)}
          icon="download"
          tone="ok"
        />
      )}
      {deleteOpen && (
        <ConfirmModal
          title="Supprimer définitivement votre compte ?"
          desc="Tous vos contacts, biens et mandats actifs seront transférés à l'agence ou supprimés. Cette action est irréversible. Les pièces comptables sont conservées 10 ans selon l'obligation légale suisse."
          danger="Supprimer mon compte"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => setDeleteOpen(false)}
        />
      )}
    </>
  )
}
