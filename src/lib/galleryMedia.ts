export interface GalleryMediaItem {
  type: 'photo' | 'video'
  url: string
}

/**
 * Build an ordered media list from photos + optional video.
 * Video is inserted after the 3rd photo (position 3) for natural flow.
 */
export function buildGalleryMedia(photos: string[], videoUrl?: string): GalleryMediaItem[] {
  const items: GalleryMediaItem[] = photos.map(url => ({ type: 'photo' as const, url }))
  if (videoUrl) {
    const insertAt = Math.min(3, items.length)
    items.splice(insertAt, 0, { type: 'video' as const, url: videoUrl })
  }
  return items
}
