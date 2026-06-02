import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Invariant règle d'or : la SEULE ÉCRITURE de dossier_status='verified' vit dans la
// fonction trigger auto_verify_kyc_dossier (baseline). Tout autre WRITE = bug LBA.
// On ne flague QUE les écritures — jamais les comparaisons (===, WHERE, CHECK, IS DISTINCT
// FROM) ni les CHECK d'enum — sinon le guard 20260522_003 (qui lit 'verified') ferait un
// faux positif.
const ROOTS = ['supabase/functions', 'supabase/migrations', 'src']
const TS_WRITE = /dossier_status\s*:\s*['"]verified['"]/      // .update({ dossier_status: 'verified' })
const SQL_SET = /set\s+dossier_status\s*=\s*'verified'/i      // UPDATE ... SET dossier_status='verified'
const SQL_ASSIGN = /dossier_status\s*:=\s*'verified'/i        // affectation plpgsql

function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return out }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '_archived') continue
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx|sql)$/.test(entry)) out.push(p)
  }
  return out
}

describe("KYC règle d'or — dossier_status=verified", () => {
  it("n'est écrit nulle part hors la fonction auto_verify_kyc_dossier", () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8')
        const writes = TS_WRITE.test(src) || SQL_SET.test(src) || SQL_ASSIGN.test(src)
        if (!writes) continue
        // Allowlist : tout fichier qui mentionne la fonction trigger légitime, sous
        // TOUTES ses formes — le baseline l'écrit en identifiant quoté
        // "public"."auto_verify_kyc_dossier"(), le guard 20260522_003 la cite en commentaire.
        // Un writer rogue (edge/app) ne référencerait jamais ce trigger SQL.
        if (src.includes('auto_verify_kyc_dossier')) continue
        offenders.push(file)
      }
    }
    expect(offenders, `Writers verified interdits: ${offenders.join(', ')}`).toEqual([])
  })
})
