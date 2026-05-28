// MEGGA CRM Sugar v2 — Documents (Tier 3.j)
// 1:1 port from the Claude Design bundle (`crm-documents-sugar.jsx`).

import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { DocIcon, DocViewToggle, type DocViewId } from '@/components/crm-sugar/documents/atoms'
import { DocLeftColumn, type DocFilterId } from '@/components/crm-sugar/documents/DocLeftColumn'
import { DocLivingColumn } from '@/components/crm-sugar/documents/DocLivingColumn'
import { DocRightColumn } from '@/components/crm-sugar/documents/DocRightColumn'
import { DocGridView } from '@/components/crm-sugar/documents/DocViews'
import { NewDocModal, type NewDocPayload } from '@/components/crm-sugar/documents/NewDocModal'
import type { DocItem, DocFolder } from '@/components/crm-sugar/documents/data'
import { useDocumentsSugar } from '@/hooks/useDocumentsSugar'

const DARK_TONE: DarkTone = 'meggaAi'

export default function DocumentsSugarV2Page() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  // Source de vérité : transactions actives Supabase (un dossier = une transaction)
  // + documents Supabase joints.
  const { folders } = useDocumentsSugar()

  const [view, setView] = useState<DocViewId>('living')
  const [filter, setFilter] = useState<DocFilterId>('active')
  const [query, setQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  // Sélection courante : celui de l'état si trouvé, sinon le premier dossier
  const folder: DocFolder | null = useMemo(() => {
    if (folders.length === 0) return null
    if (selectedFolder) {
      const match = folders.find(f => f.id === selectedFolder)
      if (match) return match
    }
    return folders[0]
  }, [folders, selectedFolder])

  const doc: DocItem | null = selectedDoc && folder
    ? folder.docs.find(d => d.id === selectedDoc) || null
    : null

  const handleGridSelect = (folderId: string, docId: string) => {
    setSelectedFolder(folderId)
    setSelectedDoc(docId)
    setView('living')
  }

  const handleNewDocClick = () => setShowNewDoc(true)

  // Upload réel : storage 'documents' + insert documents row.
  // Le mode 'template' (PDF gen depuis modèle) n'est pas encore wired — chip séparée.
  const handleCreateDoc = async (payload: NewDocPayload) => {
    if (payload.mode !== 'upload' || !payload.file) return
    if (!profile?.agency_id || !user?.id) {
      setToast('Session expirée — reconnectez-vous')
      return
    }

    const target = folders.find(f => f.id === payload.folderId)
    if (!target) {
      setToast('Dossier introuvable')
      return
    }

    setUploading(true)
    try {
      const ext = payload.file.name.match(/\.[^.]+$/)?.[0] ?? ''
      const baseName = payload.docName?.trim() || payload.file.name.replace(/\.[^.]+$/, '')
      const storagePath = `${profile.agency_id}/${target.id}/${Date.now()}-${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, payload.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: payload.file.type || 'application/octet-stream',
        })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase.from('documents').insert({
        agency_id: profile.agency_id,
        transaction_id: target.id,
        name: baseName,
        type: 'import',
        storage_path: storagePath,
        size_bytes: payload.file.size,
        status: 'pending',
        uploaded_by: user.id,
      })
      if (insertErr) {
        // Best-effort rollback of the uploaded blob.
        await supabase.storage.from('documents').remove([storagePath]).catch(() => {})
        throw insertErr
      }

      await queryClient.invalidateQueries({ queryKey: ['documents-sugar-documents'] })
      setToast(`Document importé dans ${target.title}`)
      setShowNewDoc(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setToast(`Échec import : ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'reseau': navigate('/dashboard/network'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: sp.pageBg, fontFamily: 'inherit' }}>
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav
        active="docs"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="docs"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '100px 40px 24px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            maxWidth: 1480,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: sp.cardBg,
              borderRadius: 18,
              padding: '12px 16px',
              boxShadow: sp.shadowSm,
              border: `1px solid ${sp.cardBorder}`,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: sp.sub,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Documents
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: sp.ink,
                  letterSpacing: -0.4,
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {folders.filter(f => !f.isArchived).length} dossiers actifs
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 32,
                background: sp.cardBorder,
                marginLeft: 4,
              }}
            />

            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <DocViewToggle value={view} onChange={setView} sp={sp} />
            </div>

            <button
              onClick={handleNewDocClick}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: sp.ink,
                color: sp.pageBg,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 6px 18px rgba(11,12,14,0.18)',
                flexShrink: 0,
              }}
            >
              <DocIcon name="plus" size={14} color={sp.pageBg} strokeWidth={2.4} />
              Nouveau document
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            {view === 'living' && folder && (
              <>
                <DocLeftColumn
                  sp={sp}
                  folders={folders}
                  selected={folder.id}
                  onSelect={id => {
                    setSelectedFolder(id)
                    setSelectedDoc(null)
                  }}
                  filter={filter}
                  setFilter={setFilter}
                  query={query}
                  setQuery={setQuery}
                />
                <DocLivingColumn
                  folder={folder}
                  sp={sp}
                  selectedDoc={selectedDoc}
                  onSelectDoc={setSelectedDoc}
                />
                <DocRightColumn
                  folder={folder}
                  doc={doc}
                  sp={sp}
                />
              </>
            )}
            {view === 'living' && !folder && (
              <div style={{
                flex: 1, minWidth: 0, padding: '60px 20px', textAlign: 'center',
                color: sp.sub, fontSize: 13.5,
              }}>
                Aucun dossier actif. Créez une transaction depuis le Pipeline pour démarrer un dossier ici.
              </div>
            )}

            {view === 'grid' && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <DocGridView
                  folders={folders}
                  sp={sp}
                  onSelectDoc={handleGridSelect}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {showNewDoc && (
        <NewDocModal
          folders={folders}
          dark={dark}
          uploading={uploading}
          onClose={() => setShowNewDoc(false)}
          onCreate={handleCreateDoc}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: sp.ink,
            color: sp.pageBg,
            padding: '12px 22px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: sp.focusShadow,
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
