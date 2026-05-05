// MEGGA CRM Sugar v2 — Documents (Tier 3.j)
// 1:1 port from the Claude Design bundle (`crm-documents-sugar.jsx`).
// Modals NewDoc + TemplateEditor stubbées (toast "à venir") pour rester réaliste.

import { useState } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  DocGridView, DocTemplatesView,
} from '@/components/crm-sugar/documents/DocViews'
import { DocStudioModal } from '@/components/crm-sugar/documents/DocStudioModal'
import {
  DOC_FOLDERS, DOC_TEMPLATES,
  type DocItem, type DocTemplate,
} from '@/components/crm-sugar/documents/data'

const DARK_TONE: DarkTone = 'meggaAi'

export default function DocumentsSugarV2Page() {
  const navigate = useNavigate()

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

  const [view, setView] = useState<DocViewId>('living')
  const [filter, setFilter] = useState<DocFilterId>('active')
  const [query, setQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>(DOC_FOLDERS[0].id)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [studioState, setStudioState] = useState<{
    doc: DocItem
    folder: typeof DOC_FOLDERS[number]
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  const folder = DOC_FOLDERS.find(f => f.id === selectedFolder) || DOC_FOLDERS[0]
  const doc: DocItem | null = selectedDoc
    ? folder.docs.find(d => d.id === selectedDoc) || null
    : null

  const handleGridSelect = (folderId: string, docId: string) => {
    setSelectedFolder(folderId)
    setSelectedDoc(docId)
    setView('living')
  }

  const handleNewDocClick = () => setToast('Création de document — à venir')
  const handleEditTemplate = (_tpl: DocTemplate | null) =>
    setToast('Éditeur de modèles — à venir')

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
      case 'parcours': navigate('/dashboard/parcours'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'docs': break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'auto': navigate('/dashboard/automation'); break
      case 'chat': navigate('/dashboard/messages'); break
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
                {DOC_FOLDERS.filter(f => !f.isArchived).length} dossiers actifs
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
            {view === 'living' && (
              <>
                <DocLeftColumn
                  sp={sp}
                  folders={DOC_FOLDERS}
                  selected={selectedFolder}
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
                  onOpenStudio={d => setStudioState({ doc: d, folder })}
                />
              </>
            )}

            {view === 'grid' && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <DocGridView
                  folders={DOC_FOLDERS}
                  sp={sp}
                  onSelectDoc={handleGridSelect}
                />
              </div>
            )}

            {view === 'templates' && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <DocTemplatesView
                  templates={DOC_TEMPLATES}
                  sp={sp}
                  onEditTemplate={handleEditTemplate}
                />
              </div>
            )}
          </div>

          {/* Floating IA bar */}
          <div
            style={{
              position: 'sticky',
              bottom: 14,
              marginTop: 'auto',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                pointerEvents: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 8px 8px 16px',
                borderRadius: 999,
                background: sp.cardBg,
                border: `1px solid ${sp.cardBorder}`,
                boxShadow: sp.shadow,
                minWidth: 360,
              }}
            >
              <DocIcon name="sparkles" size={14} color={sp.ink} />
              <input
                placeholder="Demande à l'IA — « génère un compromis pour Loft Pâquis »"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: sp.ink,
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                }}
              />
              <button
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: sp.ink,
                  color: sp.pageBg,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <DocIcon name="arrowR" size={13} color={sp.pageBg} />
              </button>
            </div>
          </div>
        </main>
      </div>

      {studioState && (
        <DocStudioModal
          doc={studioState.doc}
          folder={studioState.folder}
          dark={dark}
          onClose={() => setStudioState(null)}
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
