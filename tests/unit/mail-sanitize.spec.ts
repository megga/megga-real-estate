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
import { readFileSync } from 'node:fs'
import { sanitizeMailHtml, buildBodySrcdoc } from '@/lib/mail/sanitize'
import { repoPath } from './helpers/fs-scan'

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

/**
 * ⛔ LA HAUTEUR DU CORPS SE MESURE SUR LE `body`, ET LA SRCDOC EST CE QUI REND
 * CETTE MESURE JUSTE. Les deux pièces vivent dans deux fichiers et rien ne les
 * reliait ; c'est ce qui a laissé passer le défaut du 05.09.2026.
 *
 * `documentElement.scrollHeight` ne descend JAMAIS sous la hauteur de l'iframe :
 * le lire, c'est relire la hauteur qu'on vient d'écrire, et le `+ MESURE_MARGE`
 * devient une boucle. Mesuré sur `/dev/messagerie` : 96 px de contenu réel
 * rendus dans une trame qui montait 128 → 176 px par pas de 8 px toutes les
 * 500 ms — 80 px de vide, et davantage à chaque re-rendu (224 px, 256 px après
 * deux bascules de thème).
 *
 * ⚠ Ce test est une clause de SOURCE, faute de mieux : jsdom ne dispose rien,
 * `scrollHeight` y vaut 0 partout, donc aucune assertion de comportement ne
 * pourrait distinguer les deux nœuds. Elle aurait quand même rougi sur le
 * défaut, ce qu'aucune garde du dépôt ne faisait.
 */
describe('Mesure de la hauteur du corps rendu', () => {
  // ⚠ Commentaires retirés : le commentaire qui EXPLIQUE le défaut le nomme, et
  // sans ce blanchiment la clause rougirait sur sa propre justification.
  const frame = readFileSync(repoPath('src/components/crm/messagerie/MailBodyFrame.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')

  it('lit le corps du document, jamais son élément racine', () => {
    expect(frame).toMatch(/contentDocument\?\.body\?\.scrollHeight/)
    expect(
      frame,
      'documentElement.scrollHeight se relit lui-même — la trame enfle de 8 px par mesure',
    ).not.toMatch(/documentElement\??\.scrollHeight/)
  })

  it('la srcdoc annule les marges, ce qui rend la mesure du corps exacte', () => {
    // Sans `margin:0`, la marge du body tomberait HORS de son scrollHeight et le
    // corps serait tronqué — la clause précédente deviendrait un défaut.
    expect(buildBodySrcdoc('<p>x</p>', { ink: '#111', font: 'Inter Tight', remoteImages: false }))
      .toContain('html,body{margin:0;padding:0')
  })
})
