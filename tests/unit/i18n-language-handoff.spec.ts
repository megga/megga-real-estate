/**
 * Reprise de la langue transmise par la vitrine (`?lang=`).
 *
 * megga.ch et app.megga.ch ne partagent pas leur stockage local : la langue
 * voyage par l'URL de reprise. Ce qui se teste ici, c'est le tri à l'entrée —
 * une valeur venue de l'URL n'est jamais appliquée telle quelle.
 *
 * L'application (écriture dans la clé du détecteur AVANT `init()`) n'est pas
 * testable ici : le module s'initialise à l'import, donc une fois pour toute la
 * suite. Elle est vérifiée sur l'app buildée, dans un navigateur.
 */
import { describe, it, expect } from 'vitest'
import { languageFromUrl } from '@/i18n'

describe('languageFromUrl', () => {
  it.each([
    ['?lang=de', 'de'],
    ['?lang=fr', 'fr'],
    ['?lang=it', 'it'],
    ['?lang=EN', 'en'],
    ['?lang=de-CH', 'de'],
    ['?autre=1&lang=it', 'it'],
  ])('%s → %s', (search, attendu) => {
    expect(languageFromUrl(search)).toBe(attendu)
  })

  it.each(['?lang=xx', '?lang=ru', '?lang=../fr', '?lang=<script>', '?lang=', '?autre=1', ''])(
    'ignore %s',
    (search) => {
      expect(languageFromUrl(search)).toBeNull()
    },
  )
})
