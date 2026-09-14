/**
 * `useFermetureMenu` — un menu contextuel se referme au clic DEHORS et à Échap,
 * pas à un clic DANS le menu (choisir un item).
 *
 * ⚠ CE QUI N'EST PAS PROUVÉ ICI : qu'il SURVIVE au clic droit qui l'ouvre. Un test
 * jsdom de ce cas restait vert sur l'ancien code (vérifié en réintroduisant le
 * défaut) — jsdom ne délivre pas l'événement comme Chromium. Cette preuve-là vit
 * dans `tests/e2e/menus-clic-droit.spec.ts`, en navigateur réel, et elle rougit
 * sur l'ancien code (vérifié aussi).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { useFermetureMenu } from '@/hooks/useFermetureMenu'

let racine: Root | null = null
afterEach(() => { racine?.unmount(); racine = null; document.body.innerHTML = '' })

function Menu({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFermetureMenu(ref, onClose)
  return <div ref={ref} data-menu="">menu</div>
}
function Banc() {
  const [ouvert, setOuvert] = useState(true)
  return ouvert ? <Menu onClose={() => setOuvert(false)} /> : null
}
function monter() {
  const hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  flushSync(() => racine!.render(<Banc />))
}
const menu = () => document.querySelector('[data-menu]')
/** L'écouteur « dehors » s'arme au tick suivant l'ouverture. */
const armer = () => new Promise((r) => setTimeout(r, 20))

describe('useFermetureMenu', () => {
  it('un clic DANS le menu ne le referme pas, un clic dehors si', async () => {
    monter()
    await armer()
    flushSync(() => { menu()!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(menu(), 'choisir un item ne doit pas fermer le menu avant son geste').not.toBeNull()
    flushSync(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })) })
    expect(menu()).toBeNull()
  })

  it('un clic droit dehors le referme aussi', async () => {
    monter()
    await armer()
    flushSync(() => { document.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })) })
    expect(menu()).toBeNull()
  })

  it('Échap le referme — et ne ferme QUE lui', async () => {
    // Un écouteur Échap posé AVANT, comme celui de la bulle d'un événement du
    // Calendrier : il ne doit pas recevoir la touche qui ferme le menu.
    let bulleFermee = false
    const bulle = (e: KeyboardEvent) => { if (e.key === 'Escape') bulleFermee = true }
    window.addEventListener('keydown', bulle)
    try {
      monter()
      await armer()
      flushSync(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
      expect(menu()).toBeNull()
      expect(bulleFermee, 'Échap a traversé le menu jusqu’à la bulle').toBe(false)
    } finally {
      window.removeEventListener('keydown', bulle)
    }
  })
})
