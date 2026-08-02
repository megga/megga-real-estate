/**
 * Tag `surface` des événements Sentry — ce qui rend mesurable le critère G4
 * « 48 h en prod sans erreur Sentry console ».
 *
 * Ce qui est éprouvé ici est la seule partie qui puisse se tromper : la DÉRIVATION
 * du tag depuis une URL. Un faux négatif est pire qu'une absence de tag — il ferait
 * signer un gate que des erreurs de console ont pourtant traversé.
 */
import { describe, it, expect } from 'vitest'
import { pathnameOfEventUrl, surfaceFromPath, tagEventSurface } from '@/lib/sentry'

describe('surfaceFromPath', () => {
  it('reconnaît la console et ses sous-écrans', () => {
    expect(surfaceFromPath('/dashboard/admin')).toBe('console')
    expect(surfaceFromPath('/dashboard/admin/')).toBe('console')
    expect(surfaceFromPath('/dashboard/admin/monitoring')).toBe('console')
    expect(surfaceFromPath('/dashboard/admin/agencies/42/usage')).toBe('console')
  })

  it('ne se laisse PAS avoir par un préfixe qui n\'est pas un segment', () => {
    // Le piège du `startsWith` nu : ces routes n'appartiennent pas à la console, et
    // les compter ferait échouer un gate que rien ne devrait bloquer.
    expect(surfaceFromPath('/dashboard/administration')).toBe('crm')
    expect(surfaceFromPath('/dashboard/admins')).toBe('crm')
  })

  it('range le reste du CRM et les routes publiques dans `crm`', () => {
    expect(surfaceFromPath('/dashboard')).toBe('crm')
    expect(surfaceFromPath('/dashboard/contacts')).toBe('crm')
    expect(surfaceFromPath('/admin')).toBe('crm')
    expect(surfaceFromPath('/')).toBe('crm')
    expect(surfaceFromPath('')).toBe('crm')
  })
})

describe('pathnameOfEventUrl', () => {
  it('extrait le chemin d\'une URL absolue', () => {
    expect(pathnameOfEventUrl('https://app.megga.ch/dashboard/admin/monitoring')).toBe('/dashboard/admin/monitoring')
  })

  it('ignore la query et le fragment', () => {
    expect(pathnameOfEventUrl('https://app.megga.ch/dashboard/admin?tab=crons#x')).toBe('/dashboard/admin')
  })

  it('accepte un chemin déjà relatif', () => {
    expect(pathnameOfEventUrl('/dashboard/admin/users')).toBe('/dashboard/admin/users')
  })

  it('rend null sur ce qui n\'est pas exploitable, pour laisser jouer le repli', () => {
    expect(pathnameOfEventUrl(undefined)).toBeNull()
    expect(pathnameOfEventUrl('')).toBeNull()
    expect(pathnameOfEventUrl('pas une url')).toBeNull()
  })

  it('survit à une URL déjà expurgée par le scrub S27', () => {
    // `beforeSend` expurge les jetons ; la dérivation doit tenir sur les deux formes,
    // sinon le tag dépendrait de l'ORDRE des traitements.
    expect(pathnameOfEventUrl('https://app.megga.ch/kyc/[redacted]')).toBe('/kyc/[redacted]')
    expect(surfaceFromPath('/kyc/[redacted]')).toBe('crm')
  })
})

describe('tagEventSurface', () => {
  it("tague depuis l'URL de l'événement", () => {
    const e = tagEventSurface({ request: { url: 'https://app.megga.ch/dashboard/admin/security' } })
    expect(e.tags?.surface).toBe('console')
  })

  it('CONSERVE les tags déjà posés', () => {
    // Remplacer l'objet au lieu de le fusionner effacerait les tags de Sentry et de
    // toute intégration — un défaut invisible tant qu'on ne regarde que `surface`.
    const e = tagEventSurface({ tags: { release: 'v1', surfaceOfSomethingElse: 'x' }, request: { url: '/dashboard/contacts' } })
    expect(e.tags).toEqual({ release: 'v1', surfaceOfSomethingElse: 'x', surface: 'crm' })
  })

  it("retombe sur l'emplacement courant quand l'événement ne porte pas d'URL", () => {
    window.history.pushState({}, '', '/dashboard/admin/monitoring')
    expect(tagEventSurface({}).tags?.surface).toBe('console')
    window.history.pushState({}, '', '/dashboard/pipeline')
    expect(tagEventSurface({}).tags?.surface).toBe('crm')
  })

  it("préfère l'URL de l'événement à l'emplacement courant", () => {
    // Le cas qui compte : l'erreur est née dans la console, elle remonte après la sortie.
    window.history.pushState({}, '', '/dashboard/pipeline')
    expect(tagEventSurface({ request: { url: '/dashboard/admin/users' } }).tags?.surface).toBe('console')
  })
})
