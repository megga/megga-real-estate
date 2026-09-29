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
 *
 * ⛔ Les pages qui HÉBERGENT une surface de matching (« Aujourd'hui », les fiches, « Nouveau bien »,
 * Mes biens) restent HORS du périmètre : elles ne font que naviguer — en gabarit ANCRÉ — ou monter des
 * modules déjà couverts ci-dessus. Tout geste qui toucherait l'acheteur depuis une surface de matching
 * doit vivre dans un module DU périmètre, jamais dans la page qui l'héberge. `ContactDetailPage` ne
 * peut pas y entrer pour cette raison précise : elle porte aussi le `mailto:` de son en-tête et le lien
 * vers le composeur de la Messagerie, légitimes pour LA FICHE (écrire au contact, pour tout motif), pas
 * pour le matching. Ne pas ajouter de page hôte ici.
 */
const MATCHING = [
  'src/components/matching-atelier',
  'src/components/matching-fil',
  'src/components/matching-recherche',
  'src/components/crm-mobile/matching',
  'src/hooks/useAtelierMatching.ts',
  // Lot E1 : les exécuteurs des gestes et la file d'annulation, que partagent le fil et le mobile, et la règle du deal
  // auquel un geste se rattache (`dealOuvert`), que lit aussi la fiche d'un mandat.
  'src/lib/matchingGestes.ts',
  'src/lib/matchingAnnulation.ts',
  'src/lib/dealOuvert.ts',
  // Lot E1 : le jeton d'arrivée — sa règle et son crochet —, que lisent le fil, le pager et les fiches (`?qui=1`).
  'src/lib/jetonArrivee.ts',
  'src/hooks/useArrivee.ts',
  'src/hooks/useMatching.ts',
  'src/hooks/useMatchingFil.ts',
  'src/hooks/useMatchingRecherche.ts',
  'src/hooks/useSelectionMarche.ts',
  'src/hooks/useAjouterSelection.ts',
  'src/hooks/useAnciensProspects.ts',
  'src/hooks/useContactSentMatches.ts',
  // Lot D1 (23.09.2026) : les surfaces qui montrent la boucle hors du fil. `src/components/matching-fil` couvre déjà
  // `filLiens`, `filQuiPour`, `QuiPourCeBien` et `QuiPourFiche`.
  'src/hooks/useQuiPourCeBien.ts',
  'src/hooks/usePigeAcheteurs.ts',
  'src/hooks/useAcquereursNouveauMandat.ts',
  'src/components/crm/today/matchingDuJour.ts',
  'src/components/crm/today/useMatchingDuJour.ts',
  'src/components/crm/today/HlMatching.tsx',
  'src/components/crm/today/useAbsenceSignals.ts',
  // La traduction pure ligne → signal de « Pendant ton absence », sortie de useAbsenceSignals.ts : c'est elle
  // qui reconnaît une relance de proposition (retoursDe).
  'src/components/crm/today/absenceSignaux.ts',
  'src/components/crm/contacts-pager/saBoucle.ts',
  'src/components/crm/biens/nouveau/acquereurs.ts',
  'src/components/crm/biens/nouveau/LigneAcquereurs.tsx',
  // Lot E1 : les règles de « Planifier une visite » sur la fiche d'un mandat, dont celle qui refuse le message pré-rempli
  // à un acquéreur du matching (`preRemplissagePermis`). Le formulaire (`PlanifierVisite`) reste hors du périmètre, comme
  // une page hôte : il prépare ce message pour un acheteur en deal ouvert, et c'est cette règle qui en décide.
  'src/components/crm/biens/fiche/visiteurs.ts',
  'src/pages/agent/MatchingPage.tsx',
  'src/pages/agent/MatchingAtelierPage.tsx',
  'src/pages/agent/ExternalListingDetailPage.tsx',
  'src/components/crm/today/PageCatalogue.tsx',
  'src/components/crm/today/useFocusMatches.ts',
  // Lot D2 (24.09.2026) : le copilote WhatsApp du matching — ses règles pures et ses outils. Le point du matin écrit à
  // l'AGENT : seuls ses blocs Matching sont lus (SECTIONS) — `ligneMatching`, `ligneInteresses`, le bloc Matching de
  // `composeMorningBrief` et l'objet `matching` de `composeBriefDetail`.
  'supabase/functions/_shared/whatsapp-matching.ts',
  'supabase/functions/_shared/whatsapp-matching-outils.ts',
]

/**
 * Sections du matching logées dans un fichier qui n'en est pas. La fiche contact reste HORS du
 * périmètre : son bouton « Joindre » (`buildWaMeUrl(fiche.phone)`) écrit au contact pour tout
 * motif, et c'est légitime. Seule sa section « Sa boucle » relève du matching : on ne lit qu'elle,
 * de sa déclaration à la déclaration de premier niveau suivante.
 */
const SECTIONS: { fichier: string; debut: string }[] = [
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBoucle(' },
  // Ses deux atomes (lot D1) : une ligne « À traiter » et un bien de la boucle.
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdATraiter(' },
  { fichier: 'src/components/crm/contacts-pager/ContactDetailPager.tsx', debut: 'function CdBienBoucle(' },
  // Lot D2 : les lignes de matching du point du matin (`_shared/morning-brief.ts`), dont le reste écrit à l'agent.
  { fichier: 'supabase/functions/_shared/morning-brief.ts', debut: 'function ligneMatching(' },
  // Lot D2 : la ligne des acheteurs intéressés qui attendent une visite, dans le même fichier — elle aussi nomme
  // des acheteurs.
  { fichier: 'supabase/functions/_shared/morning-brief.ts', debut: 'function ligneInteresses(' },
  // Lot D2 : le bloc Matching de `composeMorningBrief` (point poussé), et l'objet `matching` de `composeBriefDetail`
  // (le détail) — leurs lignes propres (en-tête, « …et N autres »).
  { fichier: 'supabase/functions/_shared/morning-brief.ts', debut: 'if (m && !sansMatching) {' },
  { fichier: 'supabase/functions/_shared/morning-brief.ts', debut: '...(data.matching ? {' },
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
  // Lot D1 (23.09.2026) : la fiche peut ouvrir un e-mail, un SMS ou le composeur de la Messagerie pour LE
  // CONTACT — légitime hors du matching (`ContactDetailPage`). Depuis une surface DU matching, ce sont trois
  // autres façons d'écrire à l'acheteur.
  [/mailto:/, 'lien mailto: à l’acheteur'],
  [/sms:/, 'lien sms: à l’acheteur'],
  [/\/dashboard\/messagerie\?ecrire/, 'composeur de la Messagerie sur l’acheteur'],
  // Lot D2 : côté serveur, les chemins d'envoi du copilote — un message ou un modèle WhatsApp, un e-mail. Aucun n'a de
  // place dans le matching. (Les fonctions serveur, `send-visit-email` compris, sont gardées par « le copilote
  // WhatsApp du matching n'appelle aucune fonction serveur, ni aucun réseau », plus bas.)
  [/sendOutboundGuarded|buildTemplateMessage|sendRelanceEmail/, 'envoi WhatsApp, modèle ou e-mail depuis le matching'],
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

  /**
   * Les deux modules du copilote du matching n'importent QUE ceci, nommément. Une liste d'interdits ne connaît que les
   * envois d'hier (cf. FONCTIONS_PERMISES) : `executeSendClientEmail`, `sendResendEmail`, `sendOptinInvite`,
   * `getProvider(…).send`… lui échappent. Tout import neuf doit prouver qu'il n'écrit à personne. `'*'` : un module
   * de phrases ou de règles pures.
   */
  const COPILOTE = ['supabase/functions/_shared/whatsapp-matching.ts', 'supabase/functions/_shared/whatsapp-matching-outils.ts']
  const IMPORTS_PERMIS: Record<string, readonly string[] | '*'> = {
    'https://esm.sh/@supabase/supabase-js@2': ['SupabaseClient'],
    './whatsapp-actions.ts': ['ActionCtx', 'Prepared', 'frDateTime', 'recordAutoUndo'],
    './contact-memory.ts': ['touchHotContact'],
    './onboarding-slots.ts': ['wallTimeToInstant'],
    './morning-brief.ts': ['fmtCHF'],
    './whatsapp-i18n.ts': '*',
    './whatsapp-matching.ts': '*',
    './matching-normalize.ts': '*',
  }

  it('le copilote WhatsApp du matching n’appelle aucune fonction serveur, ni aucun réseau', () => {
    // Côté Deno, la forme est `urlFonction(base, 'nom')` : le motif d'au-dessus, écrit pour le bundle, ne la voit pas.
    // Commentaires blanchis (comme region-fonctions.spec.ts) : `outils` explique le `fetch()` de postgrest-js en prose.
    const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    for (const f of COPILOTE) {
      expect(readFileSync(join(R, f), 'utf8'), f).not.toMatch(/functions\.invoke|\burlFonction\b|function-url/)
      expect(sansCommentaires(readFileSync(join(R, f), 'utf8')), f).not.toMatch(/\bfetch\s*\(|\bimport\s*\(/)
    }
  })

  it('le copilote WhatsApp du matching n’importe que ce qui n’écrit à personne', () => {
    for (const f of COPILOTE) {
      const texte = readFileSync(join(R, f), 'utf8')
      for (const [, source] of texte.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) expect(IMPORTS_PERMIS[source], `${f} importe ${source}`).toBeDefined()
      expect(texte, f).not.toMatch(/^import\s+(?!type\s*\{|\{)/m)
      for (const [, noms, source] of texte.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
        const permis = IMPORTS_PERMIS[source]
        if (permis === '*') continue
        for (const nom of noms.split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean)) {
          expect(permis, `${f} importe ${nom} de ${source}`).toContain(nom)
        }
      }
    }
  })

  it('⛔ une visite planifiée par le copilote ne prévient pas le client : la base pose `reminder_sent`', () => {
    // `visit-reminders-j1` écrit au client la veille de toute visite `planned` dont le rappel n'est pas parti.
    const nom = readdirSync(join(R, 'supabase/migrations')).find((n) => n.endsWith('_matching_whatsapp.sql'))
    expect(nom, 'migration du lot D2').toBeTruthy()
    const sql = readFileSync(join(R, 'supabase/migrations', nom!), 'utf8').replace(/--[^\n]*/g, '')
    const i = sql.indexOf('create or replace function public.wa_matching_visite(')
    expect(i, 'wa_matching_visite').toBeGreaterThanOrEqual(0)
    const corps = sql.slice(i, sql.indexOf('$$;', i))
    const [, cols = '', vals = ''] = /insert into public\.visits\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\)\s*returning id into v_visite/.exec(corps) ?? []
    // La valeur À LA PLACE de `reminder_sent` — pas un `true` d'une autre colonne. Découpe au premier niveau : ni une
    // virgule entre parenthèses, ni une virgule dans une chaîne ne séparent deux valeurs.
    const valeurs: string[] = []
    let prof = 0, chaine = false, cur = ''
    for (const ch of vals) {
      if (ch === "'") chaine = !chaine
      if (!chaine && ch === '(') prof++
      if (!chaine && ch === ')') prof--
      if (!chaine && prof === 0 && ch === ',') { valeurs.push(cur.trim()); cur = '' } else cur += ch
    }
    valeurs.push(cur.trim())
    const colonnes = cols.split(',').map((c) => c.trim())
    expect(valeurs).toHaveLength(colonnes.length)
    expect(valeurs[colonnes.indexOf('reminder_sent')]).toBe('true')
    // Posé à l'insertion, jamais défait ensuite dans la même fonction.
    expect(corps.match(/reminder_sent/g)).toHaveLength(1)
    // Ni les outils du copilote ni whatsapp-actions.ts n'écrivent eux-mêmes dans `visits` : aucun `.insert`/`.upsert`,
    // même chaîné sur plusieurs lignes.
    for (const f of [...COPILOTE, 'supabase/functions/_shared/whatsapp-actions.ts']) {
      expect(readFileSync(join(R, f), 'utf8'), f).not.toMatch(/\.from\(\s*['"`]visits['"`]\s*\)\s*\.(?:insert|upsert)\b/)
    }
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
