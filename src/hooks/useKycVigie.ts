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
}

const DAY = 24 * 3600 * 1000
const EXPIRY_WINDOW_DAYS = 60

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
    if (r.dossier_status === 'failed') {
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
          checks:kyc_checklist_items(category, is_completed, is_required)
        `,
        )
        .order('created_at', { ascending: false })
      if (error) throw error
      return deriveVigie((data ?? []) as unknown as RawVigieRow[])
    },
  })
}
