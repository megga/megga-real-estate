// MEGGA CRM — KYC Pager · Liseuse de document (overlay dans le bento)
// Port de `KypDocViewer` (kyc-pager-proto.jsx) mais avec le VRAI fichier :
// URL signée du bucket `kyc-documents` (comme KycDossierDetail), rendue en
// <iframe> (PDF) ou <img> (image). Bouton « Télécharger » = URL signée + download.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { KycDocument } from '@/types/kyc'
import { type KypSurf } from './kypTokens'
import { KypIcon } from './kypAtoms'

function humanSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

interface Props {
  doc: KycDocument
  sp: SugarPalette
  surf: KypSurf
  onClose: () => void
}

export function KycDocViewer({ doc, sp, surf, onClose }: Props) {
  const dark = surf.dark
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Les uploads KYC portent `type:'kyc'` (pas le MIME) : on détecte l'image par
  // extension/MIME et on rend tout le reste en PDF (cas par défaut du bucket).
  const isImage = /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(doc.name) || (doc.type?.startsWith('image/') ?? false)
  const isPdf = !isImage

  useEffect(() => {
    let alive = true
    setUrl(null)
    setError(null)
    supabase.storage
      .from('kyc-documents')
      .createSignedUrl(doc.storage_path, 120)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) setError('Aperçu indisponible.')
        else setUrl(data.signedUrl)
      })
    return () => {
      alive = false
    }
  }, [doc.storage_path])

  const download = async () => {
    const { data } = await supabase.storage
      .from('kyc-documents')
      .createSignedUrl(doc.storage_path, 60, { download: doc.name })
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        background: dark ? 'rgba(0,0,4,.72)' : 'rgba(14,20,16,.42)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '22px 0',
        boxSizing: 'border-box',
        animation: 'kypDocFade .25s ease both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: 'calc(100% - 60px)',
          height: '100%',
          minHeight: 0,
          background: surf.card,
          borderRadius: 22,
          boxShadow: '0 40px 100px rgba(15,23,42,0.30), 0 8px 24px rgba(15,23,42,0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'kypDocUp .32s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Barre de la liseuse */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${surf.hairline}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: surf.cardSub,
              color: sp.ink,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <KypIcon name="doc" size={15} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: sp.ink,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {doc.name}
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
              {humanSize(doc.size_bytes)}
            </div>
          </div>
          <button
            onClick={download}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 13px',
              borderRadius: 999,
              border: 0,
              background: surf.cardSub,
              color: sp.ink,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <KypIcon name="download" size={13} />
            Télécharger
          </button>
          <button
            onClick={onClose}
            title="Fermer"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              background: sp.focusBg,
              color: sp.focusInk,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <KypIcon name="close" size={14} sw={2.2} />
          </button>
        </div>

        {/* Contenu */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            background: dark ? 'rgba(255,255,255,0.03)' : '#E8EBF0',
            display: 'grid',
            placeItems: 'center',
            padding: isPdf ? 0 : 24,
          }}
        >
          {error && <div style={{ fontSize: 13, color: sp.sub, fontWeight: 500 }}>{error}</div>}
          {!error && !url && <div style={{ fontSize: 13, color: sp.sub, fontWeight: 500 }}>Chargement de l'aperçu…</div>}
          {!error && url && isPdf && (
            <iframe
              title={doc.name}
              src={url}
              // Défense en profondeur : bloque scripts/formulaires d'un document
              // servi avec un content-type inattendu (le PDF natif rend sans JS).
              sandbox="allow-same-origin"
              style={{ width: '100%', height: '100%', border: 0 }}
            />
          )}
          {!error && url && !isPdf && (
            <img src={url} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 6 }} />
          )}
        </div>
      </div>
    </div>
  )
}
