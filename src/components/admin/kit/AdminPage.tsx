/**
 * Enveloppe commune des pages de la console : en-tête + largeur + animation.
 *
 * Avant l'alignement, chacune des 17 pages recopiait son propre bloc « pastille
 * violette + badge Admin + titre », avec deux tailles de `h1` (10 en `text-2xl`,
 * 7 en `text-xl`) et quatre largeurs de conteneur. La pastille de contexte vit
 * désormais dans le rail, une seule fois : la page n'a plus qu'un titre.
 *
 * Le titre est à 22/800/-0.6 — la taille des en-têtes de bento des Réglages, pas
 * celle du titre d'écran (31/800/-1.1), qui appartient au rail.
 */
import type { ReactNode } from 'react'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'

/**
 * Page de la console.
 *
 * `width` borne la colonne de lecture. Les pages denses (tableaux, monitoring)
 * passent `wide` ; le défaut convient aux pages de réglage.
 */
export default function AdminPage({ title, subtitle, actions, children, width = 'normal' }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  width?: 'normal' | 'wide' | 'full'
}) {
  const { sp } = useAdminSurfaces()
  const maxWidth = width === 'full' ? 'none' : width === 'wide' ? 1240 : 940

  return (
    <div
      className="adm-fade-up"
      style={{
        maxWidth, margin: '0 auto', padding: '28px 32px 40px',
        animation: 'admFadeUp .32s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-3xl)', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: -0.6, color: sp.ink, lineHeight: 1.15 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: '5px 0 0', fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: sp.sub, lineHeight: 1.45 }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexShrink: 0 }}>{actions}</div>
        )}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>{children}</div>
    </div>
  )
}
