/**
 * Garde : le matching reste chez l'agent (décision de Julien, 21.09.2026). Rien de ce qu'il produit
 * ne part vers l'acheteur par le CRM — ni lien de réception, ni e-mail de bien ou de relance, ni
 * message WhatsApp. Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md.
 *
 * Mesuré en production le 21.09.2026 : 0 lien de réception, 0 match envoyé, 0 événement d'envoi.
 * Les gestes de l'agent (« Je l'ai proposé », « J'ai relancé », « Pas intéressé ») CONSIGNENT ;
 * c'est l'agent qui présente les biens, par ses propres moyens.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const R = process.cwd()

/**
 * Le code du matching, côté agent. Relevé le 21.09.2026 sur les fichiers réels : les dossiers
 * couvrent `MmProposeModal` (ex-`MmSendModal`) sans avoir à le nommer ; les hooks sont ceux de
 * `src/hooks/*Matching*` plus les trois du fil et de la Recherche (`useMatchingFil`,
 * `useSelectionMarche`, `useAjouterSelection`). `useExternalMatching.ts` n'y est pas : malgré son
 * nom, il ne porte plus qu'un type de fiche d'annonce (sa logique de matching est morte en mai 2026).
 */
const MATCHING = [
  'src/components/matching-atelier',
  'src/components/matching-fil',
  'src/components/matching-recherche',
  'src/components/crm-mobile/matching',
  'src/hooks/useAtelierMatching.ts',
  'src/hooks/useMatching.ts',
  'src/hooks/useMatchingFil.ts',
  'src/hooks/useMatchingRecherche.ts',
  'src/hooks/useSelectionMarche.ts',
  'src/hooks/useAjouterSelection.ts',
  'src/hooks/useContactSentMatches.ts',
  'src/pages/agent/MatchingPage.tsx',
  'src/pages/agent/MatchingAtelierPage.tsx',
  'src/pages/agent/ExternalListingDetailPage.tsx',
  'src/components/crm/today/PageCatalogue.tsx',
  'src/components/crm/today/useFocusMatches.ts',
]

/**
 * Sections du matching logées dans un fichier qui n'en est pas. La fiche contact reste HORS du
 * périmètre : son bouton « Joindre » (`buildWaMeUrl(fiche.phone)`) écrit au contact pour tout
 * motif, et c'est légitime. Seule sa section « Sa boucle » relève du matching : on ne lit qu'elle,
 * de sa déclaration à la déclaration de premier niveau suivante.
 */
const SECTIONS: { fichier: string; debut: string }[] = [
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBoucle(' },
]

/**
 * Ce qui, appelé depuis le matching, écrirait à l'acheteur.
 *
 * Le motif WhatsApp vaut pour TOUT le périmètre, sans exception. Mesuré le 21.09.2026 : aucun
 * fichier du périmètre ne contient `wa.me`. `MrhExtDetail.tsx`, qu'on soupçonnait d'écrire à
 * l'agence qui vend, n'ouvre que l'annonce sur son portail (`window.open`) et le téléphone de la
 * régie (`tel:`), comme `AtlAnnonceVue.tsx` : joindre l'agence vendeuse est le travail de l'agent,
 * et `tel:` n'est pas dans le motif. Le jour où le matching voudrait écrire à une AGENCE par
 * WhatsApp, restreindre ce motif au fichier concerné, avec son motif écrit ; ne pas vider la règle.
 * `PxWhatsAppButton` est nommé parce qu'il bâtit le lien `wa.me` lui-même : l'importer
 * contournerait le motif sans l'écrire.
 */
const INTERDITS: [RegExp, string][] = [
  [/send-property-email/, 'e-mail « fiche bien »'],
  [/send-relance-email/, 'e-mail de relance'],
  [/buyer-reception-/, 'lien de réception'],
  [/useCreateReceptionLink|useSendReceptionSelection|useReceptionLinks|useBuyerReception/, 'hook de réception'],
  [/buildWaMeUrl|PxWhatsAppButton|wa\.me\/|api\.whatsapp\.com\/send|whatsapp:\/\/send/, 'message WhatsApp à l’acheteur'],
]

/**
 * Les SEULES fonctions serveur que le matching a le droit d'appeler. Une liste d'interdits ne
 * connaît que les envois d'hier ; une fonction d'envoi née demain lui échapperait. Toute nouvelle
 * entrée ici doit prouver qu'elle n'écrit à personne. `matching-engine` calcule les matchs.
 */
const FONCTIONS_PERMISES = new Set(['matching-engine'])

function fichiers(chemin: string): string[] {
  const abs = join(R, chemin)
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [chemin]
  return readdirSync(abs).flatMap((f) => fichiers(join(chemin, f)))
}

function section({ fichier, debut }: { fichier: string; debut: string }): string {
  const texte = readFileSync(join(R, fichier), 'utf8')
  const i = texte.indexOf(debut)
  if (i < 0) return ''
  const suite = texte.slice(i + debut.length).search(/\n(?:export |function |const |let |class )/)
  return suite < 0 ? texte.slice(i) : texte.slice(i, i + debut.length + suite)
}

describe('le matching n’écrit jamais à l’acheteur', () => {
  const tous = MATCHING.flatMap(fichiers).filter((f) => /\.(ts|tsx)$/.test(f))
  const sources: { ou: string; texte: string }[] = [
    ...tous.map((f) => ({ ou: f, texte: readFileSync(join(R, f), 'utf8') })),
    ...SECTIONS.map((s) => ({ ou: `${s.fichier} (${s.debut})`, texte: section(s) })),
  ]

  it('le périmètre est lu (une garde vide ne garde rien)', () => {
    expect(tous.length).toBeGreaterThan(20)
    for (const chemin of MATCHING) expect(fichiers(chemin).length, `${chemin} introuvable`).toBeGreaterThan(0)
    for (const s of SECTIONS) expect(section(s).length, `${s.debut} introuvable dans ${s.fichier}`).toBeGreaterThan(200)
  })

  it.each(INTERDITS)('aucun fichier du matching n’appelle %s', (motif, quoi) => {
    const fautifs = sources.filter((s) => motif.test(s.texte)).map((s) => s.ou)
    expect(fautifs, `${quoi} appelé depuis le matching`).toEqual([])
  })

  it('le matching n’appelle que des fonctions serveur qui n’écrivent à personne', () => {
    const appels = /(?:functions\.invoke|urlFonction)\(\s*['"`]([^'"`]+)['"`]/g
    const hors: string[] = []
    for (const s of sources) {
      for (const m of s.texte.matchAll(appels)) {
        if (!FONCTIONS_PERMISES.has(m[1])) hors.push(`${s.ou} → ${m[1]}`)
      }
    }
    expect(hors).toEqual([])
  })

  it('les fonctions serveur qui écrivaient à l’acheteur n’existent plus', () => {
    for (const f of ['buyer-reception-create', 'buyer-reception-get', 'buyer-reception-react', 'send-property-email']) {
      expect(existsSync(join(R, 'supabase/functions', f)), f).toBe(false)
    }
  })

  it('la page publique de réception n’existe plus', () => {
    expect(readFileSync(join(R, 'src/App.tsx'), 'utf8')).not.toMatch(/\/reception\//)
  })

  it('le copilote WhatsApp n’a plus d’outil pour envoyer des biens au client', () => {
    expect(readFileSync(join(R, 'supabase/functions/_shared/whatsapp-tools.ts'), 'utf8')).not.toMatch(/['"]send_listings['"]/)
  })

  /**
   * Les copilotes écrivent au client par DEUX chemins, et chacun passe par la garde déterministe
   * « aucun bien » (`_shared/message-sans-bien.ts`) AVANT d'envoyer, même sur demande de l'agent :
   *   · WhatsApp — l'exécuteur du « oui » à `send_client_message` (whatsapp-webhook) ;
   *   · e-mail — `sendRelanceEmail`, que partagent `send_client_email` et la relance d'« Aujourd'hui »
   *     (brouillon de l'action `draft_email` du copilote web).
   * Lu dans la source, entre l'entrée du chemin et son envoi : une garde appelée APRÈS l'envoi, ou
   * dans une autre branche, ne garderait rien.
   */
  it('les deux chemins d’envoi au client appellent la garde « aucun bien » avant d’envoyer', () => {
    const lire = (f: string) => readFileSync(join(R, f), 'utf8')
    const entre = (texte: string, debut: string, fin: string) => {
      const i = texte.indexOf(debut)
      expect(i, `${debut} introuvable`).toBeGreaterThanOrEqual(0)
      const j = texte.indexOf(fin, i)
      expect(j, `${fin} introuvable après ${debut}`).toBeGreaterThan(i)
      return texte.slice(i, j)
    }

    const webhook = lire('supabase/functions/whatsapp-webhook/index.ts')
    expect(webhook).toMatch(/import \{ bienDansMessage, refusBienDansMessage \} from '\.\.\/_shared\/message-sans-bien\.ts'/)
    expect(entre(webhook, "if (pending.tool === 'send_client_message')", 'sendOutboundGuarded(')).toMatch(/if \(bienDansMessage\(text\)\) return refusBienDansMessage\(lang\)/)

    const relance = lire('supabase/functions/_shared/relance-email-send.ts')
    expect(relance).toMatch(/import \{ bienDansMessage \} from '\.\/message-sans-bien\.ts'/)
    expect(entre(relance, 'export async function sendRelanceEmail', "fetch('https://api.resend.com/emails'")).toMatch(/if \(bienDansMessage\(relance\.subject, relance\.body\)\)/)

    // `send_client_email` n'envoie QUE par `sendRelanceEmail` ; les deux préparations refusent dès avant le « oui ».
    const actions = lire('supabase/functions/_shared/whatsapp-actions.ts')
    expect(entre(actions, 'export async function executeSendClientEmail', '\n}\n')).toMatch(/await sendRelanceEmail\(/)
    expect(entre(actions, 'export async function prepareSendClientMessage', '\n}\n')).toMatch(/bienDansMessage\(body\)/)
    expect(entre(actions, 'export async function prepareSendClientEmail', '\n}\n')).toMatch(/bienDansMessage\(subject, body\)/)
  })
})
