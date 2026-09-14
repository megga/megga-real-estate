/**
 * Libellés du Calendrier (13.09.2026) — ce qui se prouve sans base : la
 * résolution d'un libellé sur un événement, la couleur qu'il donne au bloc, le
 * contrat de la migration et les écritures du banc. La fermeture d'un menu
 * contextuel : `fermeture-menu.spec.tsx` ; son OUVERTURE au clic droit, en
 * navigateur réel : `tests/e2e/menus-clic-droit.spec.ts`. Le comportement en base (RLS, clé composite, SET NULL) est éprouvé par
 * `tests/backend/calendar-labels.spec.ts`, contre `supabase start`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { calAppliquerLibelles, calCompteParLibelle, calTypeStyle, buildCalPalette, type CalEvent, type CalEventLabel } from '@/components/crm/calendar/data'
import { SUPABASE_FUNCTIONS_URL } from '@/lib/supabase'
import { installerBanc, desinstallerBanc, reglerBanc } from '@/pages/dev/bancSupabase'

const ev = (id: string, extra: Partial<CalEvent> = {}): CalEvent => ({
  id, type: 'visite', title: id, start: new Date('2026-09-15T10:00:00'), end: new Date('2026-09-15T11:00:00'), origin: 'visit', ...extra,
})
const URGENT: CalEventLabel = { id: 'l1', name: 'Urgent', color: '#fe566b' }

/** Contraste WCAG entre deux couleurs hexadécimales. */
function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

describe('Calendrier — un libellé sur un événement', () => {
  it('par l’identifiant MAÎTRE : une occurrence porte le libellé de sa série', () => {
    const [serie, occurrence] = calAppliquerLibelles(
      [ev('v1'), ev('v1@2026-09-22', { masterId: 'v1', isOccurrence: true })],
      new Map([['v1', 'l1']]), new Map([['l1', URGENT]]),
    )
    expect(serie!.label).toEqual(URGENT)
    expect(occurrence!.label).toEqual(URGENT)
  })

  it('un créneau externe « Occupé » n’en porte jamais, même affecté', () => {
    const [externe] = calAppliquerLibelles([ev('g1', { external: true })], new Map([['g1', 'l1']]), new Map([['l1', URGENT]]))
    expect(externe!.label).toBeUndefined()
  })

  it('une affectation vers un libellé disparu ne peint rien', () => {
    const [e] = calAppliquerLibelles([ev('v1', { label: URGENT })], new Map([['v1', 'l9']]), new Map([['l1', URGENT]]))
    expect(e!.label, 'un libellé supprimé ne doit pas rester peint sur le bloc').toBeNull()
  })

  it('compte les événements par libellé, externes exclus', () => {
    const n = calCompteParLibelle([ev('a', { label: URGENT }), ev('b', { label: URGENT }), ev('c'), ev('d', { external: true, label: URGENT })])
    expect(n.get('l1')).toBe(2)
  })

  it('le libellé donne sa couleur au bloc, et le type reste le type', () => {
    const st = calTypeStyle(ev('v1', { label: URGENT }), buildCalPalette(false))
    expect(st.bg).toBe(URGENT.color)
    expect(st.label, 'le TYPE reste lisible (en-tête de la bulle)').toBe(calTypeStyle(ev('v1'), buildCalPalette(false)).label)
  })

  // La couleur est SAISIE : l'encre doit se calculer, jamais un blanc en dur.
  for (const couleur of ['#efc42c', '#adecbb', '#fe566b', '#424bfb', '#1a1a1a', '#8dc1ff']) {
    it(`encre lisible sur ${couleur} (≥ 4,5:1)`, () => {
      const st = calTypeStyle(ev('v1', { label: { id: 'x', name: 'x', color: couleur } }), buildCalPalette(false))
      expect(contraste(st.ink, couleur)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('Calendrier — le contrat de la migration', () => {
  const sql = readFileSync('supabase/migrations/20260914213550_calendar_labels.sql', 'utf-8')

  it('RLS posée, anonyme révoqué, policy bornée à l’agence', () => {
    expect(sql).toMatch(/alter table public\.calendar_labels enable row level security/)
    expect(sql).toMatch(/revoke all on public\.calendar_labels from anon, authenticated/)
    expect(sql).toMatch(/using \(agency_id = public\.get_my_agency_id\(\)\)\s*with check \(agency_id = public\.get_my_agency_id\(\)\)/)
  })

  it('les TROIS tables d’événements portent la clé composite, SET NULL sur la seule colonne du libellé', () => {
    for (const t of ['visits', 'reminders', 'appointments']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+add column if not exists calendar_label_id uuid`))
      expect(sql).toMatch(new RegExp(
        `alter table public\\.${t} add constraint ${t}_calendar_label_id_agency_id_fkey\\s+` +
        'foreign key \\(calendar_label_id, agency_id\\) references public\\.calendar_labels \\(id, agency_id\\)\\s+' +
        'on delete set null \\(calendar_label_id\\)'))
    }
  })

  it('les deux RPC : SECURITY DEFINER, search_path vide, fermées à l’anonyme', () => {
    for (const f of ['calendar_label_assignments', 'calendar_set_event_label']) {
      const corps = sql.slice(sql.indexOf(`create or replace function public.${f}(`))
      expect(corps.slice(0, 400)).toMatch(/security definer set search_path = ''/)
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon`))
    }
  })

  it('omettre le libellé le retire : le paramètre a une valeur par défaut', () => {
    expect(sql).toMatch(/calendar_set_event_label\(p_source text, p_event_id uuid, p_label_id uuid default null\)/)
  })
})

describe('Banc — les tables écrivables retiennent les écritures, les autres non', () => {
  const REST = `${SUPABASE_FUNCTIONS_URL.replace(/\/functions\/v1$/, '')}/rest/v1/`
  const libelles = [{ id: 'l1', name: 'Urgent' }]
  const autres = [{ id: 'a1', name: 'Fixe' }]
  beforeAll(() => {
    installerBanc()
    reglerBanc({ etat: 'nominal', tables: { libelles, autres }, rpc: {}, rpcVide: {}, session: null, ecrivables: ['libelles'] })
  })
  afterAll(() => { reglerBanc({ ecrivables: [] }); desinstallerBanc() })
  const lire = async (t: string) => (await (await window.fetch(`${REST}${t}?select=*`)).json()) as { id: string; name: string }[]

  it('POST insère, PATCH modifie la ligne visée, DELETE la retire', async () => {
    await window.fetch(`${REST}libelles`, { method: 'POST', body: JSON.stringify({ name: 'Nouveau' }) })
    const apresPost = await lire('libelles')
    expect(apresPost.map((l) => l.name)).toEqual(['Urgent', 'Nouveau'])
    const nouveau = apresPost[1]!
    expect(nouveau.id, 'un identifiant est posé').toBeTruthy()
    await window.fetch(`${REST}libelles?id=eq.${nouveau.id}`, { method: 'PATCH', body: JSON.stringify({ name: 'Renommé' }) })
    expect((await lire('libelles')).map((l) => l.name)).toEqual(['Urgent', 'Renommé'])
    await window.fetch(`${REST}libelles?id=eq.l1`, { method: 'DELETE' })
    expect((await lire('libelles')).map((l) => l.name), 'seule la ligne du prédicat part').toEqual(['Renommé'])
  })

  it('une table NON déclarée garde le comportement d’avant : rien ne s’écrit', async () => {
    // ⚠ Contre une COPIE figée : comparer à `autres` lui-même passerait à vide —
    // c'est ce tableau-là que le banc muterait.
    const avant = structuredClone(autres)
    await window.fetch(`${REST}autres`, { method: 'POST', body: JSON.stringify({ name: 'Intrus' }) })
    await window.fetch(`${REST}autres?id=eq.a1`, { method: 'DELETE' })
    expect(await lire('autres')).toEqual(avant)
    expect(autres, 'la fixture elle-même est intacte').toEqual(avant)
  })
})
