import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Avatar — local-first with Supabase Storage sync when authenticated.
//
// Anonymous : data URL en localStorage (pas d'upload network).
// Connecté : upload vers le bucket `avatars` (path {userId}/avatar.jpg),
// publicUrl mémoïsé en localStorage pour rendu instantané.
// Au login, on lit `profiles.avatar_url` ; au logout, on garde le cache.

const STORAGE_KEY = 'megga-avatar-url'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 Mo
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Resize to max NxN and convert to data URL. Used for both local fallback
// and as the source for Storage upload (so we always store ≤256px).
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const { width, height } = img
        const size = Math.min(width, height)
        const sx = (width - size) / 2
        const sy = (height - size) / 2
        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context failed'))
          return
        }
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

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export interface AvatarValidationError {
  type: 'size' | 'format'
  message: string
}

// Singleton state
let globalUrl: string | null = typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

function setGlobal(url: string | null) {
  globalUrl = url
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem(STORAGE_KEY, url)
    else localStorage.removeItem(STORAGE_KEY)
  }
  notify()
}

async function uploadToStorage(dataUrl: string, userId: string): Promise<string | null> {
  try {
    const blob = dataUrlToBlob(dataUrl)
    const path = `${userId}/avatar.jpg`
    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600',
    })
    if (error) return null
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    // Cache-bust to force the new image to load (browsers cache by URL)
    return `${data.publicUrl}?v=${Date.now()}`
  } catch {
    return null
  }
}

async function deleteFromStorage(userId: string) {
  try {
    await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`])
  } catch {
    /* silent */
  }
}

async function syncAvatarUrlToProfile(userId: string, url: string | null) {
  try {
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  } catch {
    /* silent */
  }
}

async function fetchProfileAvatar(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()
    if (error || !data) return null
    return (data.avatar_url as string | null) ?? null
  } catch {
    return null
  }
}

/** Avatar utilisateur : état global partagé (localStorage + sync Storage/profil), upload avec redimensionnement 256px, suppression et validation de fichier. */
export function useAvatar() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  // Cross-tab sync via storage event
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        globalUrl = e.newValue
        notify()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Hydrate from profile.avatar_url on first auth
  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.auth.getUser()
      if (cancelled || !data.user) return
      const remote = await fetchProfileAvatar(data.user.id)
      if (cancelled) return
      if (remote && remote !== globalUrl) {
        setGlobal(remote)
      }
    }
    run()
    return () => {
      cancelled = true
    }
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

  const uploadAvatar = useCallback(
    async (file: File): Promise<AvatarValidationError | null> => {
      const error = validateFile(file)
      if (error) return error
      try {
        const dataUrl = await resizeImage(file, 256)
        await persistDataUrl(dataUrl)
        return null
      } catch {
        return { type: 'format', message: 'Impossible de traiter cette image' }
      }
    },
    [validateFile]
  )

  const saveDataUrl = useCallback(async (dataUrl: string) => {
    await persistDataUrl(dataUrl)
  }, [])

  const removeAvatar = useCallback(async () => {
    setGlobal(null)
    const { data } = await supabase.auth.getUser()
    if (data.user) {
      await Promise.all([
        deleteFromStorage(data.user.id),
        syncAvatarUrlToProfile(data.user.id, null),
      ])
    }
  }, [])

  return {
    avatarUrl: globalUrl,
    uploadAvatar,
    saveDataUrl,
    removeAvatar,
    validateFile,
  }
}

// Persist a data URL — local for anonymous, Storage + profile for authed.
async function persistDataUrl(dataUrl: string) {
  // Optimistic local update for instant UI
  setGlobal(dataUrl)
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    const publicUrl = await uploadToStorage(dataUrl, data.user.id)
    if (publicUrl) {
      setGlobal(publicUrl)
      void syncAvatarUrlToProfile(data.user.id, publicUrl)
    }
    // If upload fails, keep the local data URL — the user still sees their photo
  }
}
