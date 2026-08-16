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
import { describe, it, expect, vi, afterEach } from 'vitest'
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

/**
 * ⛔ CE QUE CE BLOC GARDE EST UNE ÉCRITURE, PAS UNE FONCTION.
 *
 * La langue traversait déjà de la vitrine au CRM par `?lang=` — mais elle s'arrêtait à la
 * clé du détecteur : `persisterLangueDeCorrespondance` n'était appelée que par
 * `switchLanguage`. Une langue venue de megga.ch n'atteignait donc jamais
 * `profiles.language`, et rien ne le signalait. Un test qui vérifierait seulement que la
 * fonction existe ne verrait pas ce trou : c'est l'APPEL en base qu'il faut constater.
 *
 * Le module s'initialise à l'import, d'où le `resetModules` + import dynamique : c'est le
 * seul moyen de le faire démarrer avec une URL choisie.
 */
afterEach(() => { vi.resetModules(); vi.doUnmock('@/lib/supabase') })

describe('la langue arrivée de la vitrine rejoint profiles.language', () => {
  const montrer = async (search: string, session: { user: { id: string } } | null) => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    vi.resetModules()
    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session } }) },
        from: vi.fn().mockReturnValue({ update }),
      },
    }))
    window.history.replaceState({}, '', `/dashboard${search}`)
    await import('@/i18n')
    // L'écriture n'est jamais attendue (le premier rendu ne dépend pas du réseau) :
    // on laisse la micro-tâche se vider avant de constater.
    await new Promise((r) => setTimeout(r, 0))
    return update
  }

  it('⛔ ÉCRIT la langue quand elle arrive par ?lang= et qu’une session existe', async () => {
    const update = await montrer('?lang=de', { user: { id: 'u-1' } })
    expect(update).toHaveBeenCalledWith({ language: 'de' })
  })

  it('n’écrit RIEN sans session — un visiteur anonyme n’a pas de profil', async () => {
    const update = await montrer('?lang=de', null)
    expect(update).not.toHaveBeenCalled()
  })

  it('n’écrit RIEN sans ?lang= — arriver ne vaut pas choisir', async () => {
    // Sinon chaque chargement réinscrirait la langue détectée, y compris un repli,
    // et écraserait une préférence réelle depuis un autre poste.
    const update = await montrer('', { user: { id: 'u-1' } })
    expect(update).not.toHaveBeenCalled()
  })

  it('n’écrit RIEN pour une langue hors du produit', async () => {
    const update = await montrer('?lang=ru', { user: { id: 'u-1' } })
    expect(update).not.toHaveBeenCalled()
  })
})
