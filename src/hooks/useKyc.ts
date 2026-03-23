import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  KycCase, KycCaseWithChecklist, KycChecklistItem,
  KycDocument, KycAuditEvent, KycStatus, ScreeningResult,
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
        .select('*')
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
      const { data, error } = await supabase
        .from('activity_events')
        .select('*')
        .eq('entity_type', 'kyc')
        .eq('entity_id', kycCaseId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as KycAuditEvent[]
    },
    enabled: !!kycCaseId,
  })
}

// ─── Toggle checklist item ─────────────────────────────────────────────────

export function useUpdateKycItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const updates: Record<string, unknown> = { is_completed }
      if (is_completed) {
        updates.completed_at = new Date().toISOString()
      } else {
        updates.completed_at = null
        updates.completed_by = null
      }

      const { data, error } = await supabase
        .from('kyc_checklist_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as KycChecklistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
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

// ─── Update notes ──────────────────────────────────────────────────────────

export function useUpdateKycNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .update({ notes })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as KycCase
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.id] })
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
      // Upload to storage
      const filePath = `${agencyId}/${kycCaseId}/${Date.now()}_${file.name}`
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
      if (error) throw error
      return data as ScreeningResult
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kycCaseId] })
      queryClient.invalidateQueries({ queryKey: ['kyc-cases'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kycCaseId] })
    },
  })
}
