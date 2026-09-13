/**
 * Avatar de l'agent — cache local + synchronisation Supabase Storage.
 *
 * Upload vers le bucket `avatars` (chemin {userId}/avatar.jpg) ; l'URL publique
 * est mise en cache en localStorage pour un rendu instantané, et
 * `profiles.avatar_url` fait foi à chaque connexion.
 *
 * ⚠ Le cache est rangé PAR COMPTE (`megga-avatar-url:<uid>`, audit S11). Il
 * vivait sous une clé fixe, lue au CHARGEMENT DU MODULE — avant toute purge, avant
 * même de savoir qui est connecté : la photo de A (parfois une data URL de son
 * visage) s'affichait au compte suivant, et y restait tant que la relecture du
 * profil ne rendait pas une AUTRE photo — un compte sans photo gardait celle de A.
 * D'où : aucune lecture sans compte, et une relecture qui fait foi, absence
 * comprise, dès qu'elle a abouti.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cleDuCompte } from '@/lib/stockageParCompte'

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

// État partagé : la chaîne rangée sous la clé DU COMPTE est la seule source —
// le cliché est une chaîne, donc stable d'un rendu à l'autre.
const abonnes = new Set<() => void>()
const notifier = () => { for (const f of abonnes) f() }

function abonner(f: () => void): () => void {
  abonnes.add(f)
  // Synchronisation entre onglets : une photo changée ailleurs se voit ici.
  const surStockage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(`${STORAGE_KEY}:`)) f()
  }
  window.addEventListener('storage', surStockage)
  return () => {
    abonnes.delete(f)
    window.removeEventListener('storage', surStockage)
  }
}

function lireStockee(uid: string): string | null {
  try {
    return localStorage.getItem(cleDuCompte(STORAGE_KEY, uid))
  } catch {
    return null
  }
}

function ecrireStockee(uid: string, url: string | null) {
  try {
    if (url) localStorage.setItem(cleDuCompte(STORAGE_KEY, uid), url)
    else localStorage.removeItem(cleDuCompte(STORAGE_KEY, uid))
  } catch { /* quota ou stockage refusé : la photo reviendra à la prochaine relecture */ }
  notifier()
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

/**
 * `profiles.avatar_url` du compte. `ok: false` distingue une lecture ÉCHOUÉE de
 * « pas de photo » : la première ne doit rien effacer, la seconde doit effacer.
 */
async function fetchProfileAvatar(userId: string): Promise<{ ok: boolean; url: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single()
    if (error || !data) return { ok: false, url: null }
    return { ok: true, url: (data.avatar_url as string | null) ?? null }
  } catch {
    return { ok: false, url: null }
  }
}

/** Avatar utilisateur : état partagé par compte (localStorage + sync Storage/profil), upload avec redimensionnement 256px, suppression et validation de fichier. */
export function useAvatar() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const avatarUrl = useSyncExternalStore(abonner, () => (uid ? lireStockee(uid) : null), () => null)

  // Relecture de profiles.avatar_url à chaque compte : elle FAIT FOI dès qu'elle
  // aboutit, y compris pour dire « pas de photo ».
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    void fetchProfileAvatar(uid).then((res) => {
      if (cancelled || !res.ok) return
      if (res.url !== lireStockee(uid)) ecrireStockee(uid, res.url)
    })
    return () => {
      cancelled = true
    }
  }, [uid])

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
      if (!uid) return { type: 'format', message: 'Connectez-vous pour changer de photo' }
      try {
        const dataUrl = await resizeImage(file, 256)
        await persistDataUrl(uid, dataUrl)
        return null
      } catch {
        return { type: 'format', message: 'Impossible de traiter cette image' }
      }
    },
    [validateFile, uid]
  )

  const saveDataUrl = useCallback(async (dataUrl: string) => {
    if (uid) await persistDataUrl(uid, dataUrl)
  }, [uid])

  const removeAvatar = useCallback(async () => {
    if (!uid) return
    ecrireStockee(uid, null)
    await Promise.all([
      deleteFromStorage(uid),
      syncAvatarUrlToProfile(uid, null),
    ])
  }, [uid])

  return {
    avatarUrl,
    uploadAvatar,
    saveDataUrl,
    removeAvatar,
    validateFile,
  }
}

// Persiste une data URL : affichage immédiat, puis Storage + profil.
async function persistDataUrl(uid: string, dataUrl: string) {
  ecrireStockee(uid, dataUrl)
  const publicUrl = await uploadToStorage(dataUrl, uid)
  if (publicUrl) {
    ecrireStockee(uid, publicUrl)
    void syncAvatarUrlToProfile(uid, publicUrl)
  }
  // Si l'upload échoue, la data URL reste affichée — l'agent voit sa photo.
}
