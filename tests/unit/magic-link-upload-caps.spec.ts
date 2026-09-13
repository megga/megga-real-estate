/**
 * Plafonds et cycle de vie d'un lien magique KYC — les copies ne divergent pas, et les
 * contrôles sont AU BON ENDROIT (audit S10, 13.09.2026).
 *
 * TROIS COPIES D'UNE MÊME RÈGLE : le trigger `enforce_kyc_magic_link_upload_caps` (qui fait
 * foi), `_shared/magic-link-limits.ts` (l'edge refuse tôt) et `KycPublicPage` (la page
 * prévient avant l'envoi). Le front ne peut pas importer un module edge, et une migration ne
 * s'importe pas du tout : c'est ce fichier qui les confronte.
 *
 * ET L'ORDRE COMPTE : un plafond vérifié APRÈS l'écriture en stockage laisse l'objet
 * orphelin ; une expiration testée AVANT la soumission réécrit un dossier soumis. Les
 * ancrages portent sur l'USAGE (`>= MAX_FILES_PER_LINK`), jamais sur la première mention
 * d'un nom — celle de l'import, en tête de fichier, rendrait l'assertion toujours vraie.
 * Chaque ancrage est d'abord éprouvé sur un extrait écrit comme le code d'AVANT.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import {
  ALLOWED_UPLOAD_MIME,
  MAGIC_LINK_OPEN_STATUSES,
  MAX_BYTES_PER_LINK,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LINK,
} from '../../supabase/functions/_shared/magic-link-limits'

const lire = (chemin: string) => readFileSync(repoPath(chemin), 'utf-8')
const sansCommentairesTs = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, ' ')
const sansCommentairesSql = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

/** `10 * 1024 * 1024` → 10485760. Rend null si l'expression n'est pas un produit d'entiers. */
function produit(expr: string): number | null {
  const propre = expr.replace(/[()\s_]/g, '')
  if (!/^\d+(\*\d+)*$/.test(propre)) return null
  return propre.split('*').reduce((acc, n) => acc * Number(n), 1)
}

/** Vrai si `a` et `b` sont tous deux trouvés, et `a` AVANT `b`. */
function avant(code: string, a: RegExp | string, b: RegExp | string): boolean {
  const pos = (m: RegExp | string) => (typeof m === 'string' ? code.indexOf(m) : code.search(m))
  const ia = pos(a)
  const ib = pos(b)
  return ia !== -1 && ib !== -1 && ia < ib
}

/**
 * Chaque chaîne d'appels qui commence à `.from('<table>')` : l'appel lui-même puis chaque
 * `.méthode(…)` enchaîné, parenthèses équilibrées. Lit une requête supabase-js entière,
 * quelle que soit sa mise en page.
 */
function chaines(code: string, table: string): string[] {
  const depart = `.from('${table}')`
  const out: string[] = []
  let i = code.indexOf(depart)
  while (i !== -1) {
    let j = i + depart.length
    for (;;) {
      let k = j
      while (k < code.length && /\s/.test(code[k])) k++
      if (code[k] !== '.') break
      k++
      const nom = /^[A-Za-z_$][\w$]*/.exec(code.slice(k))
      if (!nom) break
      k += nom[0].length
      while (k < code.length && /\s/.test(code[k])) k++
      if (code[k] === '(') {
        let profondeur = 0
        for (; k < code.length; k++) {
          if (code[k] === '(') profondeur++
          else if (code[k] === ')' && --profondeur === 0) { k++; break }
        }
      }
      j = k
    }
    out.push(code.slice(i, j))
    i = code.indexOf(depart, j)
  }
  return out
}

/**
 * Les écritures sur `kyc_magic_links` qui ne filtrent PAS sur le statut courant. Un `.neq`
 * compte comme un filtre ici : la transition de la confirmation, qui en portait un trop
 * lâche, a sa propre assertion plus bas.
 */
const ecrituresSansFiltre = (code: string): string[] =>
  chaines(code, 'kyc_magic_links')
    .filter((c) => c.includes('.update('))
    .filter((c) => !/\.(in|eq|neq)\(\s*'status'/.test(c))

// ─── Extraits écrits comme le code d'AVANT le correctif ────────────────────

const AVANT_UPLOAD = `
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
const MAX_SIZE = 10 * 1024 * 1024
  form = await req.formData()
  const { error: storageErr } = await supabase.storage
    .from('kyc-magic-link')
    .upload(path, new Uint8Array(buf), { contentType: file.type, upsert: false })
  await supabase.from('kyc_magic_links').update(updateData).eq('id', link.id)
`
const AVANT_CONFIRM = `
  if (new Date(link.expires_at) <= new Date()) {
    await supabase.from('kyc_magic_links').update({ status: 'expired' }).eq('id', magicLinkId)
  }
  if (link.status === 'submitted') { return idempotent }
  await supabase.from('kyc_magic_links').update({ status: 'submitted' }).eq('id', link.id).neq('status', 'submitted')
`

describe('ancrages — éprouvés sur le code d’avant le correctif', () => {
  it('le comptage des pièces AVANT le stockage : faux sur l’ancien code (aucun comptage)', () => {
    expect(avant(AVANT_UPLOAD, />=\s*MAX_FILES_PER_LINK/, ".from('kyc-magic-link')")).toBe(false)
  })

  it('le tri du Content-Length AVANT le formData : faux sur l’ancien code', () => {
    expect(avant(AVANT_UPLOAD, 'screenUploadRequest(', 'req.formData()')).toBe(false)
  })

  it('l’écriture de statut sans filtre est vue (dépôt et confirmation d’avant)', () => {
    expect(ecrituresSansFiltre(AVANT_UPLOAD)).toHaveLength(1)
    expect(ecrituresSansFiltre(AVANT_CONFIRM)).toHaveLength(1) // l'expiration ; la transition a son `.neq`
  })

  it('« soumis avant expiré » : faux sur l’ancienne confirmation', () => {
    expect(avant(AVANT_CONFIRM, "link.status === 'submitted'", 'new Date(link.expires_at)')).toBe(false)
  })

  it('produit() lit les littéraux du dépôt, et refuse le reste', () => {
    expect(produit('10 * 1024 * 1024')).toBe(10_485_760)
    expect(produit('((10 * 1024) * 1024)')).toBe(10_485_760)
    expect(produit('MAX * 2')).toBeNull()
  })
})

describe('plafonds — trois copies, une valeur', () => {
  const migrations = readdirSync(repoPath('supabase/migrations')).filter((f) => f.endsWith('_kyc_magic_link_caps.sql'))
  const sql = migrations.length === 1 ? sansCommentairesSql(lire(`supabase/migrations/${migrations[0]}`)) : ''

  it('la migration des plafonds existe, une seule fois', () => {
    expect(migrations).toHaveLength(1)
  })

  it('le trigger porte les MÊMES plafonds que _shared/magic-link-limits.ts', () => {
    const fichiers = /c_max_files\s+constant\s+integer\s*:=\s*(\d+)/.exec(sql)
    const octets = /c_max_bytes\s+constant\s+bigint\s*:=\s*(\d+)/.exec(sql)
    expect(fichiers, 'c_max_files introuvable dans la migration').not.toBeNull()
    expect(octets, 'c_max_bytes introuvable dans la migration').not.toBeNull()
    expect(Number(fichiers![1])).toBe(MAX_FILES_PER_LINK)
    expect(Number(octets![1])).toBe(MAX_BYTES_PER_LINK)
  })

  it('le trigger refuse exactement les deux statuts terminaux, et l’enum n’en a pas d’autre', () => {
    expect(sql).toMatch(/v_status\s+in\s*\(\s*'submitted'\s*,\s*'expired'\s*\)/)
    const baseline = lire('supabase/migrations/00000000000000_baseline_remote_schema.sql')
    const enumSql = /TYPE\s+"public"\."kyc_magic_link_status"\s+AS\s+ENUM\s*\(([^)]*)\)/.exec(baseline)
    expect(enumSql, 'enum kyc_magic_link_status introuvable dans la baseline').not.toBeNull()
    const valeurs = [...enumSql![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    expect(valeurs).toEqual([...MAGIC_LINK_OPEN_STATUSES, 'submitted', 'expired'].sort())
  })

  it('le trigger couvre l’INSERT ET l’UPDATE des colonnes qu’il gouverne, et l’écriture client est retirée', () => {
    expect(sql).toMatch(/before\s+insert\s+or\s+update\s+of\s+magic_link_id\s*,\s*size_bytes\s*,\s*agency_id/i)
    expect(sql).toMatch(/revoke\s+insert\s*,\s*update\s*,\s*delete\s+on\s+table\s+public\.kyc_magic_link_uploads\s+from\s+authenticated/i)
    expect(sql).toMatch(/magic_link_agency_mismatch/)
  })

  it('le plafond unitaire est celui du CHECK de la table', () => {
    const baseline = lire('supabase/migrations/00000000000000_baseline_remote_schema.sql')
    const check = /kyc_magic_link_uploads_size_bytes_check"\s+CHECK\s*\(\(\("size_bytes"\s*>\s*0\)\s+AND\s+\("size_bytes"\s*<=\s*([()\d\s*]+?)\)\)\)/.exec(baseline)
    expect(check, 'CHECK de taille introuvable dans la baseline').not.toBeNull()
    expect(produit(check![1])).toBe(MAX_FILE_BYTES)
  })

  it('la page publique recopie les mêmes plafonds et les mêmes formats', () => {
    const page = sansCommentairesTs(lire('src/pages/public/KycPublicPage.tsx'))
    const lu = (nom: string) => {
      const m = new RegExp(`const\\s+${nom}\\s*=\\s*([\\d\\s*()_]+)\\n`).exec(page)
      expect(m, `${nom} introuvable dans KycPublicPage`).not.toBeNull()
      return produit(m![1])
    }
    expect(lu('MAX_FILES')).toBe(MAX_FILES_PER_LINK)
    expect(lu('MAX_FILE_BYTES')).toBe(MAX_FILE_BYTES)
    expect(lu('MAX_TOTAL_BYTES')).toBe(MAX_BYTES_PER_LINK)
    const mime = /const\s+ALLOWED_MIME\s*=\s*\[([^\]]*)\]/.exec(page)
    expect(mime, 'ALLOWED_MIME introuvable dans KycPublicPage').not.toBeNull()
    expect([...mime![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual([...ALLOWED_UPLOAD_MIME].sort())
  })
})

describe('magic-link-upload — les contrôles précèdent la lecture et l’écriture', () => {
  const code = sansCommentairesTs(lire('supabase/functions/magic-link-upload/index.ts'))

  it('le Content-Length est trié AVANT `req.formData()`', () => {
    expect(avant(code, 'screenUploadRequest(', 'req.formData()')).toBe(true)
  })

  it('le plafond de pièces est vérifié AVANT le formData ET avant l’écriture en stockage', () => {
    expect(avant(code, />=\s*MAX_FILES_PER_LINK/, 'req.formData()')).toBe(true)
    expect(avant(code, />=\s*MAX_FILES_PER_LINK/, ".from('kyc-magic-link')")).toBe(true)
  })

  it('le plafond de volume est vérifié AVANT l’écriture en stockage', () => {
    expect(avant(code, 'exceedsLinkCaps(', ".from('kyc-magic-link')")).toBe(true)
  })

  it('les refus du trigger sont traduits en 409, jamais recopiés', () => {
    expect(code).toMatch(/includes\('magic_link_upload_limit'\)/)
    expect(code).toMatch(/includes\('magic_link_not_uploadable'\)/)
    expect(code).not.toMatch(/\bdetails\s*:/)
  })

  it('toute écriture de statut filtre sur le statut courant', () => {
    expect(chaines(code, 'kyc_magic_links').filter((c) => c.includes('.update('))).toHaveLength(2)
    expect(ecrituresSansFiltre(code)).toEqual([])
  })
})

describe('magic-link-get et magic-link-confirm — cycle de vie à sens unique', () => {
  const get = sansCommentairesTs(lire('supabase/functions/magic-link-get/index.ts'))
  const confirm = sansCommentairesTs(lire('supabase/functions/magic-link-confirm/index.ts'))

  it('magic-link-get : chaque écriture de statut filtre (expiration ET ouverture)', () => {
    expect(chaines(get, 'kyc_magic_links').filter((c) => c.includes('.update('))).toHaveLength(2)
    expect(ecrituresSansFiltre(get)).toEqual([])
  })

  it('magic-link-confirm : « soumis » AVANT « expiré », et le statut `expired` refuse', () => {
    expect(avant(confirm, "link.status === 'submitted'", 'new Date(link.expires_at)')).toBe(true)
    expect(confirm).toContain("link.status === 'expired'")
  })

  it('magic-link-confirm : la transition part d’un statut OUVERT, jamais de `neq(submitted)`', () => {
    const transitions = chaines(confirm, 'kyc_magic_links').filter((c) => /status:\s*'submitted'/.test(c))
    expect(transitions).toHaveLength(1)
    expect(transitions[0]).toMatch(/\.in\(\s*'status'\s*,\s*\[\.\.\.MAGIC_LINK_OPEN_STATUSES\]\s*\)/)
    expect(confirm).not.toMatch(/\.neq\(\s*'status'\s*,\s*'submitted'\s*\)/)
    expect(ecrituresSansFiltre(confirm)).toEqual([])
    expect(confirm).not.toMatch(/\bdetails\s*:/)
  })
})
