import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'megga-avatar-url'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 Mo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Resize to max 256x256 and convert to data URL
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const { width, height } = img

        // Crop to square (center crop)
        const size = Math.min(width, height)
        const sx = (width - size) / 2
        const sy = (height - size) / 2

        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas context failed')); return }

        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

export interface AvatarValidationError {
  type: 'size' | 'format'
  message: string
}

export function useAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  // Sync across tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setAvatarUrl(e.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const validateFile = useCallback((file: File): AvatarValidationError | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { type: 'format', message: 'Format accepté : JPG, PNG, GIF ou WebP' }
    }
    if (file.size > MAX_SIZE_BYTES) {
      return { type: 'size', message: 'Taille maximale : 2 Mo' }
    }
    return null
  }, [])

  const uploadAvatar = useCallback(async (file: File): Promise<AvatarValidationError | null> => {
    const error = validateFile(file)
    if (error) return error

    try {
      const dataUrl = await resizeImage(file, 256)
      localStorage.setItem(STORAGE_KEY, dataUrl)
      setAvatarUrl(dataUrl)
      return null
    } catch {
      return { type: 'format', message: 'Impossible de traiter cette image' }
    }
  }, [validateFile])

  const saveDataUrl = useCallback((dataUrl: string) => {
    localStorage.setItem(STORAGE_KEY, dataUrl)
    setAvatarUrl(dataUrl)
  }, [])

  const removeAvatar = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setAvatarUrl(null)
  }, [])

  return { avatarUrl, uploadAvatar, saveDataUrl, removeAvatar, validateFile }
}
