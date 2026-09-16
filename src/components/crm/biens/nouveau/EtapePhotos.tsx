/**
 * « Nouveau bien » · étape 2 — Photos : déposer, réordonner, choisir la couverture.
 *
 * ⚠ Les photos restent dans le navigateur (`previewUrl`) jusqu'à l'enregistrement : leur
 * envoi exige l'id du bien, et c'est `usePublierWizard` qui les téléverse. Aucune tuile
 * sans fichier réel n'est jamais persistée.
 *
 * La PREMIÈRE photo est la couverture — celle de la carte dans « Mes biens ». La changer,
 * c'est la glisser en tête (ou « Mettre en couverture »).
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { WizardData, WizardPhoto } from '@/components/crm-wizard/tokens'
import { NbBloc, NbPuce } from './atomes'
import { PHOTOS_MIN_PUBLICATION } from './completude'

export function EtapePhotos({ data, set, sp }: { data: WizardData; set: (p: Partial<WizardData>) => void; sp: CrmPalette }) {
  const { t } = useTranslation('listings')
  const fichierRef = useRef<HTMLInputElement>(null)
  const [survol, setSurvol] = useState(false)
  const [glisse, setGlisse] = useState<number | null>(null)
  const photos = data.photos

  const ajouter = (fichiers: FileList | null) => {
    if (!fichiers) return
    const images = [...fichiers].filter((f) => f.type.startsWith('image/'))
    const nouvelles: WizardPhoto[] = images.map((f) => ({
      id: crypto.randomUUID(), label: f.name, kind: 'interior', tone: '', file: f, previewUrl: URL.createObjectURL(f),
    }))
    set({ photos: [...photos, ...nouvelles] })
  }
  const retirer = (id: string) => {
    const p = photos.find((x) => x.id === id)
    if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl)
    set({ photos: photos.filter((x) => x.id !== id) })
  }
  const deplacer = (de: number, vers: number) => {
    if (de === vers) return
    const l = [...photos]
    const [p] = l.splice(de, 1)
    l.splice(vers, 0, p)
    set({ photos: l })
  }
  const manque = Math.max(0, PHOTOS_MIN_PUBLICATION - photos.length)

  // Pleine largeur : la grille de photos profite de toute la place, sur un grand écran aussi.
  return (
    <div className="nb-plein">
    <NbBloc sp={sp} titre={t('nouveauBien.photos.titre')}
      droite={photos.length > 0 ? <NbPuce sp={sp} on={false} icon="plus" onClick={() => fichierRef.current?.click()}>{t('nouveauBien.photos.ajouter')}</NbPuce> : undefined}>
      <input ref={fichierRef} type="file" accept="image/*" multiple hidden onChange={(e) => { ajouter(e.target.files); e.target.value = '' }} />

      {photos.length === 0 ? (
        <button type="button" onClick={() => fichierRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)}
          onDrop={(e) => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files) }}
          style={{
            display: 'grid', placeItems: 'center', gap: 'var(--crm-space-lg)', minHeight: 280, padding: 'var(--crm-space-6xl)',
            borderRadius: 'var(--crm-radius-xl)', border: `2px dashed ${survol ? sp.accent : sp.cardBorder}`,
            background: survol ? sp.focusSurface : 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: sp.sub, textAlign: 'center',
          }}>
          <span style={{ display: 'grid', justifyItems: 'center', gap: 'var(--crm-space-lg)' }}>
            <span style={{ width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', background: sp.focusSurface, color: sp.ink, display: 'grid', placeItems: 'center' }}>
              <MEIcon name="camera" size={24} />
            </span>
            <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink }}>{t('nouveauBien.photos.deposer')}</span>
            <span style={{ fontSize: 'var(--crm-text-md)' }}>{t('nouveauBien.photos.deposerAide')}</span>
          </span>
        </button>
      ) : (
        <>
          <div className="nb-photos"
            onDragOver={(e) => { if (glisse == null) { e.preventDefault(); setSurvol(true) } }} onDragLeave={() => setSurvol(false)}
            onDrop={(e) => { if (glisse == null) { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files) } }}>
            {photos.map((p, i) => (
              <div key={p.id} draggable onDragStart={() => setGlisse(i)} onDragEnd={() => setGlisse(null)}
                onDragOver={(e) => { if (glisse != null) e.preventDefault() }}
                onDrop={(e) => { if (glisse != null) { e.preventDefault(); deplacer(glisse, i); setGlisse(null) } }}
                className="nb-photo"
                style={{
                  position: 'relative', aspectRatio: '4 / 3', borderRadius: 'var(--crm-radius-lg)', overflow: 'hidden', cursor: 'grab',
                  gridColumn: i === 0 ? 'span 2' : undefined, gridRow: i === 0 ? 'span 2' : undefined,
                  opacity: glisse === i ? 0.4 : 1, background: sp.focusSurface,
                }}>
                <img src={p.previewUrl ?? p.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {i === 0 && (
                  <span style={{ position: 'absolute', top: 'var(--crm-space-md)', left: 'var(--crm-space-md)', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
                    {t('nouveauBien.photos.couverture')}
                  </span>
                )}
                <div className="nb-photo-actions" style={{ position: 'absolute', top: 'var(--crm-space-md)', right: 'var(--crm-space-md)', display: 'flex', gap: 'var(--crm-space-xs)' }}>
                  {i > 0 && (
                    <button type="button" onClick={() => deplacer(i, 0)} title={t('nouveauBien.photos.mettreEnCouverture')} aria-label={t('nouveauBien.photos.mettreEnCouverture')} style={boutonPhoto(sp)}>
                      <MEIcon name="star" size={13} />
                    </button>
                  )}
                  <button type="button" onClick={() => retirer(p.id)} title={t('nouveauBien.photos.retirer')} aria-label={t('nouveauBien.photos.retirer')} style={boutonPhoto(sp)}>
                    <MEIcon name="trash" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: manque ? sp.sub : sp.ink }}>
            <MEIcon name={manque ? 'info' : 'check-circle'} size={14} />
            {manque ? t('nouveauBien.photos.encore', { count: manque }) : t('nouveauBien.photos.assez', { count: photos.length })}
            <span style={{ fontWeight: 500, color: sp.sub }}>· {t('nouveauBien.photos.glisser')}</span>
          </div>
        </>
      )}
    </NbBloc>
    </div>
  )
}

const boutonPhoto = (sp: CrmPalette) => ({
  width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, padding: 0, cursor: 'pointer',
  display: 'grid', placeItems: 'center', background: sp.solidBg, color: sp.ink,
})
