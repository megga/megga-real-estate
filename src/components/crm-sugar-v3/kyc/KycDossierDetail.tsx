// MEGGA CRM Sugar v3 — Vue détail dossier (orchestrateur)
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 587-646 (KycDossierDetail).
//
// Structure : Hero + 5 KycCheckCard (grid 2x) + 2 cards (Docs + AuditTrail) + bottom actions

import { useMemo } from 'react'
import { SugarV3 } from '../tokens'
import { KycBlackPill, KycGhostPill } from '../primitives'
import { SgIcon } from '../icons'
import { KycDossierHero } from './KycDossierHero'
import { KycCheckCard } from './KycCheckCard'
import { KycDocsSection } from './KycDocsSection'
import { KycAuditTrail } from './KycAuditTrail'
import {
  useKycCase,
  useKycDocuments,
  useKycAuditEvents,
} from '@/hooks/useKyc'
import {
  useMarkKycCheck,
  useMarkAllChecksCompleted,
} from '@/hooks/useKycDossier'
import type {
  AuditEvent,
  KycCheckCategory,
  KycChecklistItem,
  KycCaseWithChecklist,
} from '@/types/kyc'

interface Props {
  dossierId: string
  agentId: string
  onBack: () => void
}

const CHECK_KEYS: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

export function KycDossierDetail({ dossierId, agentId, onBack }: Props) {
  const { data: dossier, isLoading } = useKycCase(dossierId)
  const { data: docs = [] } = useKycDocuments(dossierId)
  const { data: auditEvents = [] } = useKycAuditEvents(dossierId)
  const markCheck = useMarkKycCheck()
  const markAll = useMarkAllChecksCompleted()

  // Index des checklist items par catégorie LBA
  const checksByCategory = useMemo<Record<KycCheckCategory, KycChecklistItem | null>>(() => {
    const map: Record<KycCheckCategory, KycChecklistItem | null> = {
      id: null,
      address: null,
      pep: null,
      sanctions: null,
      funds: null,
    }
    const items = (dossier as KycCaseWithChecklist | undefined)?.checklist ?? []
    items.forEach((c) => {
      if ((CHECK_KEYS as string[]).includes(c.category)) {
        map[c.category as KycCheckCategory] = c
      }
    })
    return map
  }, [dossier])

  if (isLoading || !dossier) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '60px 0', textAlign: 'center', color: SugarV3.muted, fontSize: 14, fontWeight: 500 }}>
        Chargement du dossier…
      </div>
    )
  }

  const pct =
    Object.values(checksByCategory).filter((c) => c?.is_completed || c?.is_required === false).length /
      CHECK_KEYS.length *
    100

  const handleMarkVerified = (category: KycCheckCategory) => {
    const item = checksByCategory[category]
    if (!item) return
    markCheck.mutate({ checkId: item.id, is_completed: true, actorId: agentId })
  }

  const handleMarkAll = () => {
    markAll.mutate({ kycCaseId: dossierId, actorId: agentId })
  }

  const isVerified = dossier.dossier_status === 'verified'

  // Coerce KycAuditEvent → AuditEvent for the timeline (compat shape)
  const timelineEvents: AuditEvent[] = (auditEvents ?? []).map((e) => ({
    id: e.id,
    agency_id: e.agency_id,
    actor_id: e.actor_id,
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    metadata: e.metadata,
    created_at: e.created_at,
    severity: 'info',
    category: 'kyc',
    object_label: null,
    ip_address: null,
  }))

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <KycDossierHero
        dossier={dossier}
        contact={
          dossier.contact
            ? { first_name: dossier.contact.first_name, last_name: dossier.contact.last_name }
            : null
        }
        pct={Math.round(pct)}
        onBack={onBack}
      />

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: SugarV3.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        5 contrôles obligatoires (LBA art. 3-7)
      </div>

      <div
        className="sg-grid-2"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {CHECK_KEYS.map((k) => (
          <KycCheckCard
            key={k}
            category={k}
            check={checksByCategory[k]}
            onMarkVerified={() => handleMarkVerified(k)}
          />
        ))}
      </div>

      <div className="sg-grid-detail-bottom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <KycDocsSection docs={docs} />
        <KycAuditTrail events={timelineEvents} />
      </div>

      {/* Actions principales bas de page */}
      <div
        style={{
          marginTop: 32,
          padding: '24px 32px',
          background: SugarV3.card,
          borderRadius: 22,
          boxShadow: SugarV3.shadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: SugarV3.ink }}>
            {isVerified
              ? 'Dossier vérifié — transaction autorisée'
              : 'Compléter pour débloquer les étapes du pipeline'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: SugarV3.muted,
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {isVerified
              ? 'Un re-screening est conseillé dans les 12 mois.'
              : "Le contact ne pourra pas passer en « Intérêt confirmé » tant que ce dossier n'est pas validé."}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <KycGhostPill
            icon={<SgIcon name="refresh" size={14} stroke={SugarV3.inkSoft} />}
          >
            Re-screener
          </KycGhostPill>
          {!isVerified ? (
            <KycBlackPill
              size="md"
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              icon={<SgIcon name="checkAll" size={14} stroke="#fff" />}
            >
              {markAll.isPending ? 'Validation…' : 'Tout marquer vérifié'}
            </KycBlackPill>
          ) : (
            <KycBlackPill
              size="md"
              icon={<SgIcon name="download" size={14} stroke="#fff" />}
            >
              Exporter dossier complet
            </KycBlackPill>
          )}
        </div>
      </div>
    </div>
  )
}
