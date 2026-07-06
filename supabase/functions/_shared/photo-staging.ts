// Garde SSRF pour les photos jointes au CHAT du copilote web.
//
// Le frontend stage chaque photo dans le bucket public property-photos, préfixe
// {agencyId}/chat-staging/ (imposé par la policy d'insertion : foldername[1] == agency).
// Puis il passe les URLs publiques à l'edge, qui les fait traiter par photo-processor
// (service role → fetch de l'URL). Une URL ARBITRAIRE serait une SSRF ; une URL d'une
// AUTRE agence, une fuite cross-tenant. Cette fonction PURE ne garde donc QUE les URLs
// d'objets property-photos situées dans le préfixe staging de l'agence de l'agent.
//
// Module isolé (0 import Deno) → testable en vitest.
export function stagedPhotoUrlsForAgency(
  baseUrl: string,
  agencyId: string | null | undefined,
  urls: unknown,
): string[] {
  if (!baseUrl || !agencyId) return []
  const prefix = `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/property-photos/${agencyId}/chat-staging/`
  const list = Array.isArray(urls) ? urls : []
  return list.filter(
    (u): u is string =>
      typeof u === 'string' &&
      u.length > prefix.length &&
      u.startsWith(prefix) &&
      !u.includes('..'),
  )
}
