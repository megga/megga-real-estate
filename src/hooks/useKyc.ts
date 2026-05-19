import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  KycCase, KycCaseWithChecklist, KycChecklistItem,
  KycDocument, KycAuditEvent, KycStatus, ScreeningResult,
  KycScreeningDecision, KycLatestScreeningDecision,
  ScreeningDecisionTarget, ScreeningDecisionVerdict,
  KycSourceOfFundsType,
} from '@/types/kyc'

interface KycFilters {
  status?: KycStatus
}

// ─── List all KYC cases ────────────────────────────────────────────────────

export function useKycCases(filters?: KycFilters) {
  return useQuery({
    queryKey: ['kyc-cases', filters],
    queryFn: async () => {
      let query = supabase
        .from('kyc_cases')
        .select('*, contact:contacts(first_name, last_name)')

      if (filters?.status) query = query.eq('status', filters.status)

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) throw error
      return data as KycCase[]
    },
  })
}

// ─── Single KYC case with checklist ────────────────────────────────────────

export function useKycCase(id: string | undefined) {
  return useQuery({
    queryKey: ['kyc-case', id],
    queryFn: async () => {
      if (!id) throw new Error('No KYC case ID')
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('*, contact:contacts(first_name, last_name), checklist:kyc_checklist_items(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as KycCaseWithChecklist
    },
    enabled: !!id,
  })
}

// ─── Documents for a KYC case ──────────────────────────────────────────────

export function useKycDocuments(kycCaseId: string | undefined) {
  return useQuery({
    queryKey: ['kyc-documents', kycCaseId],
    queryFn: async () => {
      if (!kycCaseId) throw new Error('No KYC case ID')
      const { data, error } = await supabase
        .from('documents')
        .select('id, kyc_case_id, name, type, storage_path, size_bytes, status, document_category, issued_at, expires_at, uploaded_by, created_at, sha256_hash')
        .eq('kyc_case_id', kycCaseId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as KycDocument[]
    },
    enabled: !!kycCaseId,
  })
}

// ─── Audit events for a KYC case ───────────────────────────────────────────

export function useKycAuditEvents(kycCaseId: string | undefined) {
  return useQuery({
    queryKey: ['kyc-audit', kycCaseId],
    queryFn: async () => {
      if (!kycCaseId) throw new Error('No KYC case ID')
      // entity_type peut être 'kyc' (legacy) ou 'kyc_case' (triggers SQL Sprint 1)
      // — on accepte les deux pour ne pas perdre les events.
      const { data, error } = await supabase
        .from('activity_events')
        .select(
          'id, agency_id, actor_id, actor_kind, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)'
        )
        .in('entity_type', ['kyc', 'kyc_case', 'kyc_check'])
        .eq('entity_id', kycCaseId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as KycAuditEvent[]
    },
    enabled: !!kycCaseId,
  })
}

// ─── Toggle checklist item ─────────────────────────────────────────────────
// WCAG/LBA compliance: every checklist toggle is logged in activity_events
// (LBA art. 7 — documentation obligation, fix for audit trail violation M2).

export function useUpdateKycItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      is_completed,
      actorId,
    }: {
      id: string
      is_completed: boolean
      actorId: string
    }) => {
      const updates: Record<string, unknown> = { is_completed }
      if (is_completed) {
        updates.completed_at = new Date().toISOString()
        updates.completed_by = actorId
      } else {
        updates.completed_at = null
        updates.completed_by = null
      }

      const { data, error } = await supabase
        .from('kyc_checklist_items')
        .update(updates)
        .eq('id', id)
        .select('*, kyc_case:kyc_cases(id, agency_id)')
        .single()
      if (error) throw error

      // Log checklist action (LBA audit trail)
      const kycCase = (data as KycChecklistItem & { kyc_case?: { id: string; agency_id: string } }).kyc_case
      if (kycCase) {
        await supabase.from('activity_events').insert({
          agency_id: kycCase.agency_id,
          actor_id: actorId,
          action: is_completed ? 'Item KYC complété' : 'Item KYC décoché',
          entity_type: 'kyc',
          entity_id: kycCase.id,
          metadata: { item_id: id, item_label: (data as KycChecklistItem).label, is_completed },
        })
      }

      return data as KycChecklistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit'] })
    },
  })
}

// ─── Validate KYC case (human-in-the-loop) ─────────────────────────────────

export function useValidateKycCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, validated_by }: { id: string; validated_by: string }) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .update({
          status: 'validated' as KycStatus,
          validated_by,
          validated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Log validation event
      const kycCase = data as KycCase
      await supabase.from('activity_events').insert({
        agency_id: kycCase.agency_id,
        actor_id: validated_by,
        action: 'Dossier KYC validé',
        entity_type: 'kyc',
        entity_id: id,
        metadata: { validated_by },
      })

      return data as KycCase
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.id] })
    },
  })
}

// ─── Update KYC status ─────────────────────────────────────────────────────
// LBA compliance: every status change is logged in activity_events.
// Refuses 'validated' status — use useValidateKycCase() instead (human-in-the-loop
// with explicit confirmation modal). Fix for LBA-C3.

export function useUpdateKycStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      actorId,
    }: {
      id: string
      status: KycStatus
      actorId: string
    }) => {
      // Safeguard: 'validated' must go through useValidateKycCase (LBA-C3)
      if (status === 'validated') {
        throw new Error(
          'Le statut "validated" doit passer par useValidateKycCase (human-in-the-loop obligatoire).'
        )
      }

      const { data, error } = await supabase
        .from('kyc_cases')
        .update({ status })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Log status change (LBA audit trail)
      const kycCase = data as KycCase
      await supabase.from('activity_events').insert({
        agency_id: kycCase.agency_id,
        actor_id: actorId,
        action: `Statut KYC modifié → ${status}`,
        entity_type: 'kyc',
        entity_id: id,
        metadata: { new_status: status },
      })

      return kycCase
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.id] })
    },
  })
}

// ─── Update notes ──────────────────────────────────────────────────────────
// LBA compliance: note changes are logged (without the note content to avoid
// leaking sensitive data in audit trail — just a marker that notes were edited).

export function useUpdateKycNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      notes,
      actorId,
    }: {
      id: string
      notes: string
      actorId: string
    }) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .update({ notes })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Log note change (LBA audit trail) — content NOT logged (sensitive)
      const kycCase = data as KycCase
      await supabase.from('activity_events').insert({
        agency_id: kycCase.agency_id,
        actor_id: actorId,
        action: 'Notes KYC modifiées',
        entity_type: 'kyc',
        entity_id: id,
        metadata: { notes_length: notes.length },
      })

      return kycCase
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.id] })
    },
  })
}

// ─── Update KYC document status (validate/reject) ──────────────────────────
// LBA compliance: document validation is a compliance decision — audit trail
// mandatory (LBA art. 7). Fix for LBA-C2.

export function useUpdateKycDocumentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      documentId,
      status,
      actorId,
    }: {
      documentId: string
      status: 'pending' | 'validated' | 'rejected'
      actorId: string
    }) => {
      // Fetch current state for audit metadata
      const { data: currentDoc, error: fetchError } = await supabase
        .from('documents')
        .select('id, agency_id, kyc_case_id, name, status')
        .eq('id', documentId)
        .single()
      if (fetchError) throw fetchError

      const { error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)
      if (error) throw error

      // Log the compliance decision
      await supabase.from('activity_events').insert({
        agency_id: currentDoc.agency_id,
        actor_id: actorId,
        action:
          status === 'validated'
            ? 'Document KYC validé'
            : status === 'rejected'
            ? 'Document KYC rejeté'
            : 'Statut document KYC modifié',
        entity_type: 'kyc',
        entity_id: currentDoc.kyc_case_id ?? documentId,
        metadata: {
          document_id: documentId,
          document_name: currentDoc.name,
          previous_status: currentDoc.status,
          new_status: status,
        },
      })

      return { documentId, status }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-documents'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit'] })
    },
  })
}

// ─── Upload document to Supabase Storage ───────────────────────────────────

export function useUploadKycDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      kycCaseId,
      agencyId,
      file,
      documentCategory,
      uploadedBy,
    }: {
      kycCaseId: string
      agencyId: string
      file: File
      documentCategory: 'identity' | 'domicile' | 'financial' | 'compliance' | 'other'
      uploadedBy: string
    }) => {
      // Defensive : sanitize filename pour bloquer path traversal et caractères
      // problématiques même si l'UI le filtre déjà. Sprint 2 red-team #C4.
      const safeName = file.name
        .replace(/[\\/]/g, '_')
        .replace(/\.\.+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 200)

      // SHA-256 hash du contenu (Sprint 3, Roger #5 — intégrité preuve LBA art. 7).
      // Calculé AVANT upload, stocké en colonne documents.sha256_hash. Permet de
      // prouver à un auditeur FINMA que le doc n'a pas été altéré post-upload.
      let sha256Hex: string | null = null
      try {
        const buf = await file.arrayBuffer()
        const digest = await crypto.subtle.digest('SHA-256', buf)
        sha256Hex = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      } catch {
        // Si Web Crypto indisponible (navigateur ancien), continue sans hash.
        // Le hash sera NULL, traçable via la colonne (documents legacy).
        sha256Hex = null
      }

      // Upload to storage
      const filePath = `${agencyId}/${kycCaseId}/${Date.now()}_${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('kyc-documents')
        .upload(filePath, file)
      if (uploadError) throw uploadError

      // Insert document record
      const { data, error } = await supabase
        .from('documents')
        .insert({
          agency_id: agencyId,
          kyc_case_id: kycCaseId,
          name: file.name,
          type: 'kyc',
          storage_path: filePath,
          size_bytes: file.size,
          uploaded_by: uploadedBy,
          status: 'pending',
          document_category: documentCategory,
          sha256_hash: sha256Hex,
        })
        .select()
        .single()
      if (error) throw error

      // Log upload event
      await supabase.from('activity_events').insert({
        agency_id: agencyId,
        actor_id: uploadedBy,
        action: `Document téléversé : ${file.name}`,
        entity_type: 'kyc',
        entity_id: kycCaseId,
        metadata: { document_name: file.name, document_category: documentCategory, size_bytes: file.size },
      })

      return data as KycDocument
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-documents', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kycCaseId] })
    },
  })
}

// ─── Create KYC case ───────────────────────────────────────────────────────

export function useCreateKycCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      agencyId: string
      contactId: string
      transactionId?: string
      type: 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
      contactNationality?: string
      transactionAmount?: number
    }) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .insert({
          agency_id: input.agencyId,
          contact_id: input.contactId,
          transaction_id: input.transactionId || null,
          type: input.type,
          risk_level: 'unassessed',
          status: 'pending',
          completion_pct: 0,
          pep_status: 'not_checked',
          sanctions_status: 'not_checked',
          contact_nationality: input.contactNationality || null,
          transaction_amount: input.transactionAmount || null,
        })
        .select()
        .single()
      if (error) throw error

      // Create default checklist items
      const isPM = input.type.includes('_pm')
      const defaultItems = [
        { label: isPM ? 'Extrait du Registre du Commerce' : 'Pièce d\'identité (passeport ou CI)', category: 'Identité', is_required: true },
        { label: isPM ? 'Statuts de la société' : 'Extrait du registre des poursuites', category: 'Identité', is_required: true },
        ...(isPM ? [{ label: 'Identification des ayants droit économiques (UBO)', category: 'Identité', is_required: true }] : []),
        { label: isPM ? 'Attestation de domicile du siège' : 'Attestation de domicile', category: 'Domicile', is_required: true },
        { label: isPM ? 'Rapport de révision / comptes annuels' : 'Dernière déclaration fiscale', category: 'Revenus', is_required: true },
        { label: isPM ? 'Bilan et compte de résultat' : 'Attestation bancaire (preuve de fonds)', category: 'Revenus', is_required: false },
        { label: 'Déclaration d\'origine des fonds', category: 'Origine des fonds', is_required: true },
        ...(isPM ? [{ label: 'Formulaire A / T', category: 'Origine des fonds', is_required: true }] : []),
        { label: 'Screening PEP/Sanctions effectué', category: 'Compliance', is_required: true },
      ]

      const kycCase = data as KycCase
      await supabase.from('kyc_checklist_items').insert(
        defaultItems.map(item => ({
          kyc_case_id: kycCase.id,
          label: item.label,
          category: item.category,
          is_required: item.is_required,
          is_completed: false,
        }))
      )

      return kycCase
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
    },
  })
}

// ─── Screen KYC case via dilisense Edge Function ───────────────────────────

export function useScreenKycCase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      kycCaseId,
      contactName,
      contactNationality,
      entityType,
    }: {
      kycCaseId: string
      contactName: string
      contactNationality: string
      entityType: 'individual' | 'entity'
    }) => {
      const { data, error } = await supabase.functions.invoke('kyc-screening', {
        body: {
          kyc_case_id: kycCaseId,
          contact_name: contactName,
          contact_nationality: contactNationality,
          entity_type: entityType,
        },
      })
      if (error) {
        // L'EF a renvoyé un status non-2xx (ex : 429 idempotence,
        // 401 auth, 500 Dilisense KO). Tentons de lire le body pour
        // remonter le message d'erreur clair au lieu du
        // "Edge Function returned a non-2xx status code" générique.
        let serverMessage: string | null = null
        try {
          const errWithContext = error as { context?: Response }
          if (errWithContext.context && typeof errWithContext.context.clone === 'function') {
            const body = (await errWithContext.context.clone().json()) as {
              error?: string
              retry_after_ms?: number
            }
            if (typeof body.error === 'string' && body.error.trim().length > 0) {
              serverMessage = body.error
            }
          }
        } catch {
          // body non-JSON ou déjà consommé — on garde le message générique
        }
        throw new Error(serverMessage ?? error.message)
      }
      return data as ScreeningResult
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kycCaseId] })
    },
  })
}

// ─── Sprint 3 — Source of funds (LBA art. 6 al. 1 lit. b) ─────────────────

export function useUpdateKycSourceOfFunds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      kycCaseId: string
      agencyId: string
      actorId: string
      sourceType: KycSourceOfFundsType
      description: string | null
      docId: string | null
    }) => {
      const requiresDescription =
        input.sourceType === 'crypto' ||
        input.sourceType === 'mixed' ||
        input.sourceType === 'other'
      if (requiresDescription) {
        const desc = (input.description ?? '').trim()
        if (desc.length < 20) {
          throw new Error(
            'Description requise (minimum 20 caractères) pour les types crypto / mixed / other (LBA art. 6 al. 1 lit. b).'
          )
        }
      }
      const { data, error } = await supabase
        .from('kyc_cases')
        .update({
          source_of_funds_type: input.sourceType,
          source_of_funds_description: input.description?.trim() || null,
          source_of_funds_doc_id: input.docId,
        })
        .eq('id', input.kycCaseId)
        .select()
        .single()
      if (error) throw error

      await supabase.from('activity_events').insert({
        agency_id: input.agencyId,
        actor_id: input.actorId,
        action: 'Origine des fonds renseignée',
        entity_type: 'kyc_case',
        entity_id: input.kycCaseId,
        category: 'kyc',
        severity: input.sourceType === 'crypto' || input.sourceType === 'mixed' ? 'warn' : 'info',
        actor_kind: 'user',
        metadata: {
          source_of_funds_type: input.sourceType,
          has_description: !!input.description,
          has_doc: !!input.docId,
          lba_article: 'art. 6 al. 1 lit. b',
        },
      })

      return data as KycCase
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kycCaseId] })
    },
  })
}

// ─── Sprint 3 — Log READ access (nLPD art. 12) ─────────────────────────────
// Trace chaque consultation d'un dossier KYC. Roger #1 — la nLPD exige un
// journal des accès aux données sensibles (PEP, sanctions). On déduplique
// côté client : un log par mount, pas par re-render.

export function useLogKycRead() {
  return useMutation({
    mutationFn: async (input: {
      kycCaseId: string
      agencyId: string
      actorId: string
    }) => {
      const { error } = await supabase.from('activity_events').insert({
        agency_id: input.agencyId,
        actor_id: input.actorId,
        action: 'Consultation dossier KYC',
        entity_type: 'kyc_case',
        entity_id: input.kycCaseId,
        category: 'kyc',
        severity: 'info',
        actor_kind: 'user',
        metadata: { read_at: new Date().toISOString() },
      })
      if (error) throw error
    },
  })
}

// ─── Sprint 2 — Workflow décision compliance (kyc_screening_decisions) ─────
// Documente humainement chaque match Dilisense (faux positif / vrai match /
// escalade / en attente d'éléments). Append-only, immuable, audit trail.

export function useKycScreeningDecisions(kycCaseId: string | undefined) {
  return useQuery({
    queryKey: ['kyc-screening-decisions', kycCaseId],
    queryFn: async () => {
      if (!kycCaseId) throw new Error('No KYC case ID')
      const { data, error } = await supabase
        .from('kyc_screening_decisions')
        .select('*, decider:profiles!decided_by(full_name)')
        .eq('kyc_case_id', kycCaseId)
        .order('decided_at', { ascending: false })
      if (error) throw error
      return data as unknown as (KycScreeningDecision & {
        decider: { full_name: string | null } | null
      })[]
    },
    enabled: !!kycCaseId,
  })
}

/** Récupère la décision la plus récente non-supersedée pour une cible donnée. */
export function useLatestKycScreeningDecision(
  kycCaseId: string | undefined,
  target: ScreeningDecisionTarget
) {
  return useQuery({
    queryKey: ['kyc-screening-decision-latest', kycCaseId, target],
    queryFn: async () => {
      if (!kycCaseId) throw new Error('No KYC case ID')
      const { data, error } = await supabase.rpc('kyc_latest_screening_decision', {
        p_kyc_case_id: kycCaseId,
        p_target: target,
      })
      if (error) throw error
      const rows = (data ?? []) as KycLatestScreeningDecision[]
      return rows[0] ?? null
    },
    enabled: !!kycCaseId,
  })
}

export function useCreateKycScreeningDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      kycCaseId: string
      agencyId: string
      decidedBy: string
      target: ScreeningDecisionTarget
      decision: ScreeningDecisionVerdict
      justification: string
      screeningSnapshot: Record<string, unknown>
      supersedesId?: string | null
    }) => {
      if (input.justification.trim().length < 30) {
        throw new Error(
          'Justification requise (minimum 30 caractères, LBA art. 7 al. 1 lit. b).'
        )
      }
      const { data, error } = await supabase
        .from('kyc_screening_decisions')
        .insert({
          agency_id: input.agencyId,
          kyc_case_id: input.kycCaseId,
          decision_target: input.target,
          decision: input.decision,
          justification: input.justification.trim(),
          decided_by: input.decidedBy,
          screening_snapshot: input.screeningSnapshot,
          supersedes_id: input.supersedesId ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as KycScreeningDecision
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-screening-decisions', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-screening-decision-latest', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kycCaseId] })
    },
  })
}
