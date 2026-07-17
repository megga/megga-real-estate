// MEGGA CRM — KYC · dérivation « Vigie » (0 mock)
// ─────────────────────────────────────────────────────────────────────────
// Le prototype de la Vigie (KYP_VIGIE / KYP_MANY_*) était entièrement mocké.
// Ici on DÉRIVE deux flux depuis les vrais dossiers (`kyc_cases` + contact +
// catégories de checklist) :
//   • Côté client       → pièces à collecter (id / domicile / fonds manquants,
//                          dossier jamais démarré).
//   • Côté conformité    → contrôles & échéances (match à trancher = dossier
//                          `failed`, re-screening à l'approche de l'échéance).
// Aucune donnée hardcodée : tout provient de Supabase.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import type { KycRiskLevel, PepStatus, SanctionsStatus } from '@/lib/constants'

export interface KycVigieItem {
  key: string
  dossierId: string
  contactId: string
  firstName: string
  lastName: string
  nature: 'client' | 'agent'
  late: boolean
  whenLabel: string
  title: string
  meta: string
  cta: string
}

export interface KycVigie {
  client: KycVigieItem[]
  agent: KycVigieItem[]
  nLate: number
}

interface RawChecklistItem {
  category: string | null
  is_completed: boolean
  is_required: boolean
}

interface RawDecision {
  id: string
  decision_target: 'pep' | 'sanctions'
  decision: 'false_positive' | 'true_match' | 'escalated' | 'awaiting_evidence'
  decided_at: string
  supersedes_id: string | null
}

interface RawVigieRow {
  id: string
  contact_id: string
  dossier_status: KycDossierStatus
  risk_level: KycRiskLevel
  pep_status: PepStatus | null
  sanctions_status: SanctionsStatus | null
  expires_at: string | null
  created_at: string
  last_screening_at: string | null
  contact: { first_name: string; last_name: string } | null
  checks: RawChecklistItem[]
  decisions: RawDecision[]
}

/** Décision la plus récente NON supersedée pour une cible (pep/sanctions). */
function latestDecision(decisions: RawDecision[], target: 'pep' | 'sanctions'): RawDecision | null {
  const superseded = new Set(decisions.map((d) => d.supersedes_id).filter(Boolean))
  const candidates = decisions
    .filter((d) => d.decision_target === target && !superseded.has(d.id))
    .sort((a, b) => new Date(b.decided_at).getTime() - new Date(a.decided_at).getTime())
  return candidates[0] ?? null
}

const DAY = 24 * 3600 * 1000
const EXPIRY_WINDOW_DAYS = 60

/** Nombre de jours entiers écoulés depuis `iso` ; null si la date est absente. */
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY)
}

/** « il y a N j » / « jamais » selon l'ancienneté. */
function relLabel(iso: string | null): string {
  const d = daysSince(iso)
  if (d == null) return 'jamais'
  if (d <= 0) return "aujourd'hui"
  if (d === 1) return 'hier'
  if (d < 30) return `il y a ${d} j`
  const m = Math.round(d / 30)
  return `il y a ${m} mois`
}

/** « mars 2027 » pour une échéance. */
function monthYear(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', { month: 'short', year: 'numeric' })
}

const MANUAL_ORDER: KycCheckCategory[] = ['id', 'address', 'funds']
const MISSING_META: Record<'id' | 'address' | 'funds', { title: string; cta: string }> = {
  id: { title: "Pièce d'identité à téléverser", cta: 'Téléverser' },
  address: { title: 'Justificatif de domicile manquant', cta: 'Relancer le client' },
  funds: { title: 'Attestation de source des fonds attendue', cta: 'Relancer le client' },
}

/**
 * Dérive les deux flux Vigie depuis les dossiers KYC bruts : pièces à collecter
 * côté client, contrôles & échéances côté conformité. Compte au passage le nombre
 * d'items en retard (`nLate`).
 */
function deriveVigie(rows: RawVigieRow[]): KycVigie {
  const client: KycVigieItem[] = []
  const agent: KycVigieItem[] = []

  for (const r of rows) {
    if (!r.contact) continue
    const base = {
      dossierId: r.id,
      contactId: r.contact_id,
      firstName: r.contact.first_name,
      lastName: r.contact.last_name,
    }
    const done = (cat: KycCheckCategory) =>
      r.checks.some((c) => c.category === cat && (c.is_completed || c.is_required === false))
    const hasCheck = (cat: KycCheckCategory) => r.checks.some((c) => c.category === cat)
    const age = daysSince(r.created_at) ?? 0

    // ── Côté client — pièces à collecter ─────────────────────────────────
    if (r.dossier_status === 'none') {
      const high = r.risk_level === 'high'
      client.push({
        ...base,
        key: `${r.id}-none`,
        nature: 'client',
        late: high || age > 7,
        whenLabel: relLabel(r.created_at),
        title: high ? 'Dossier jamais démarré — vigilance accrue' : 'Dossier jamais démarré',
        meta: high ? 'risque élevé, à ouvrir en priorité' : 'aucune démarche engagée',
        cta: 'Ouvrir le dossier',
      })
    } else if (r.dossier_status !== 'verified') {
      const missing = MANUAL_ORDER.find((cat) => hasCheck(cat) && !done(cat))
      if (missing) {
        const meta = MISSING_META[missing as 'id' | 'address' | 'funds']
        client.push({
          ...base,
          key: `${r.id}-${missing}`,
          nature: 'client',
          late: age > 14,
          whenLabel: relLabel(r.created_at),
          title: meta.title,
          meta: 'pièce attendue du client',
          cta: meta.cta,
        })
      }
    }

    // ── Côté conformité — contrôles & échéances ──────────────────────────
    // Une correspondance PEP/sanctions se lit avec sa DÉCISION la plus récente
    // (kyc_cases.pep_status reste 'match' en base même après décision) :
    //   · sans décision (ou en attente d'éléments) → « à trancher » ;
    //   · faux positif écarté → plus une alerte (on passe aux échéances) ;
    //   · confirmée / escaladée → dossier sous surveillance (décision consignée).
    const matchTargets = (['pep', 'sanctions'] as const).filter(
      (tgt) => (tgt === 'pep' ? r.pep_status : r.sanctions_status) === 'match',
    )
    const openTarget = matchTargets.find((tgt) => {
      const d = latestDecision(r.decisions ?? [], tgt)
      return !d || d.decision === 'awaiting_evidence'
    })
    const decidedTarget = matchTargets.find((tgt) => {
      const d = latestDecision(r.decisions ?? [], tgt)
      return d?.decision === 'true_match' || d?.decision === 'escalated'
    })
    if (r.dossier_status !== 'verified' && openTarget) {
      agent.push({
        ...base,
        key: `${r.id}-match`,
        nature: 'agent',
        late: true,
        whenLabel: relLabel(r.last_screening_at ?? r.created_at),
        title: 'Correspondance à trancher',
        meta: 'match PEP / sanctions signalé, décision attendue',
        cta: 'Trancher',
      })
    } else if (decidedTarget) {
      const d = latestDecision(r.decisions ?? [], decidedTarget)
      agent.push({
        ...base,
        key: `${r.id}-match-decided`,
        nature: 'agent',
        late: false,
        whenLabel: relLabel(d?.decided_at ?? r.last_screening_at),
        title: 'Match confirmé — dossier sous surveillance',
        meta: 'décision consignée, ré-examen possible depuis la fiche',
        cta: 'Ouvrir le dossier',
      })
    } else if (r.expires_at) {
      const dLeft = Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / DAY)
      if (dLeft <= EXPIRY_WINDOW_DAYS) {
        const expired = dLeft < 0
        agent.push({
          ...base,
          key: `${r.id}-expiry`,
          nature: 'agent',
          late: expired,
          whenLabel: monthYear(r.expires_at),
          title: expired ? 'Dossier expiré — à re-screener' : "Échéance de dossier approche",
          meta: 'vérification annuelle à renouveler',
          cta: 'Re-screener',
        })
      }
    }
  }

  const nLate = client.filter((i) => i.late).length + agent.filter((i) => i.late).length
  return { client, agent, nLate }
}

/** Charge les `kyc_cases` (contact + checklist + décisions) et en dérive la Vigie. */
export function useKycVigie() {
  return useQuery<KycVigie>({
    queryKey: ['kyc-vigie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .select(
          `
          id, contact_id, dossier_status, risk_level, pep_status, sanctions_status,
          expires_at, created_at, last_screening_at,
          contact:contacts(first_name, last_name),
          checks:kyc_checklist_items(category, is_completed, is_required),
          decisions:kyc_screening_decisions(id, decision_target, decision, decided_at, supersedes_id)
        `,
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return deriveVigie((data ?? []) as unknown as RawVigieRow[])
    },
  })
}
