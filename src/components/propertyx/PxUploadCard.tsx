// MEGGA Marketplace — Property X upload card.
// Atome du composant 📨 Inputs Figma (carte d'upload de fichier).
//
// Anatomie :
// - Min-height 290, padding 48, radius 24 (large)
// - Variant "filled" : bg ink + border dashed neutral 100 + texte clair
// - Variant "outline" : bg neutral 200 + border dashed neutral 500 + texte ink
// - Contenu centré : icône carrée + titre + sous-titre + PxButton "Téléverser"
// - Drag & drop natif HTML5 supporté

import { useRef, useState, type DragEvent, type ChangeEvent, type ReactNode } from 'react'
import { PX } from './tokens'
import PxButton from './PxButton'
import PxIcon from './PxIcon'

export type PxUploadCardVariant = 'filled' | 'outline'

interface PxUploadCardProps {
  variant?: PxUploadCardVariant
  accept?: string                       // ex: 'image/*,application/pdf'
  multiple?: boolean
  title?: string
  hint?: string
  buttonLabel?: string
  icon?: ReactNode                      // override icône par défaut
  onFiles?: (files: FileList) => void
  className?: string
}

export default function PxUploadCard({
  variant = 'outline',
  accept,
  multiple = false,
  title = 'Sélectionner un fichier à téléverser',
  hint = 'ou glissez-déposez ici',
  buttonLabel = 'Téléverser',
  icon,
  onFiles,
  className,
}: PxUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const isFilled = variant === 'filled'
  const bg = isFilled ? PX.neutral700 : PX.neutral200
  const borderColor = isFilled ? PX.neutral100 : PX.neutral500
  const titleColor = isFilled ? PX.neutral100 : PX.neutral700
  const hintColor = isFilled ? PX.neutral400 : PX.neutral500
  const iconBg = isFilled ? PX.neutral100 : PX.neutral100
  const iconColor = PX.neutral700

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFiles) {
      onFiles(e.dataTransfer.files)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleClick() {
    inputRef.current?.click()
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0 && onFiles) {
      onFiles(e.target.files)
    }
  }

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        background: bg,
        border: `1.5px dashed ${borderColor}`,
        borderRadius: PX.radius.large,
        minHeight: 290,
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        boxShadow: PX.shadow.regular,
        opacity: isDragging ? 0.85 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: `transform ${PX.duration.fast} ${PX.ease}, opacity ${PX.duration.fast} ${PX.ease}`,
        outline: 'none',
        textAlign: 'center',
      }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {/* Icône carrée */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: PX.radius.tiny,
        background: iconBg,
        border: `1.5px solid ${PX.neutral500}`,
        display: 'grid',
        placeItems: 'center',
        marginBottom: 4,
      }}>
        {icon ?? <PxIcon name="gallery" size={20} color={iconColor} strokeWidth={1.7} />}
      </div>

      {/* Titre */}
      <p style={{
        margin: 0,
        fontFamily: PX.font.sans,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: titleColor,
      }}>{title}</p>

      {/* Sous-titre */}
      <p style={{
        margin: 0,
        fontFamily: PX.font.sans,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: '-0.42px',
        color: hintColor,
        marginBottom: 8,
      }}>{hint}</p>

      {/* CTA */}
      <PxButton
        type="button"
        variant={isFilled ? 'invert' : 'primary'}
        size="sm"
        onClick={(e) => { e.stopPropagation(); handleClick() }}>
        {buttonLabel}
      </PxButton>
    </div>
  )
}
