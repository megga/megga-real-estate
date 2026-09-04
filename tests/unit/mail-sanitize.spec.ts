/**
 * Le rendu d'un corps de mail REÇU (D9) : ce qui arrive dans l'écran est écrit
 * par un tiers, et c'est la seule surface du CRM où c'est le cas.
 *
 * Deux choses se gardent ici, et elles ne se recouvrent pas : DOMPurify retire
 * ce qui exécute, la CSP de l'iframe interdit ce qui SORT (une image distante
 * est un traqueur d'ouverture, une connexion est une fuite). Une seule des deux
 * laisserait l'autre porte ouverte.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeMailHtml, buildBodySrcdoc } from '@/lib/mail/sanitize'

describe('sanitizeMailHtml', () => {
  it('retire scripts, handlers, iframes, et les images distantes par défaut', () => {
    const out = sanitizeMailHtml('<p onclick="x()">a</p><script>x()</script><iframe src="https://e.x"></iframe><img src="https://t.example/p.gif"><img src="cid:logo">', { remoteImages: false })
    expect(out).not.toContain('<script')
    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<iframe')
    // ⛔ L'URL SURVIT, et c'est le but : « Afficher les images » la restaure. Ce qui
    // doit disparaître est l'attribut CHARGEABLE, pas la chaîne — le plan demandait
    // `not.toContain('https://t.example')`, ce que la ligne suivante contredit mot
    // pour mot. ⚠ Et la borne ne peut pas être `src="` nu : `data-blocked-src="` le
    // contient littéralement. C'est l'espace qui sépare l'attribut de son voisin.
    expect(out).not.toMatch(/\ssrc="https?:/)
    expect(out).toContain('data-blocked-src="https://t.example/p.gif"')
  })
  it('garde les images distantes quand on les a demandées', () => {
    expect(sanitizeMailHtml('<img src="https://t.example/p.gif">', { remoteImages: true })).toContain('src="https://t.example/p.gif"')
  })
  it('les liens s ouvrent hors de l app, sans opener', () => {
    const out = sanitizeMailHtml('<a href="https://ex.ch">x</a>', { remoteImages: false })
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
  })
})
describe('buildBodySrcdoc', () => {
  it('porte une CSP qui interdit script et connexions, et la typographie de la maquette', () => {
    const doc = buildBodySrcdoc('<p>x</p>', { ink: '#111', font: 'Inter Tight', remoteImages: false })
    expect(doc).toContain("default-src 'none'")
    expect(doc).toContain('img-src data: cid:')
    expect(doc).toContain('line-height:1.75')
  })
})
