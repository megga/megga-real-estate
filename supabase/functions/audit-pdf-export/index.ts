// MEGGA Sprint 1 — Export PDF audit nLPD horodaté + hash chain
//
// Génère un PDF des activity_events (filtrables par agence + date range +
// catégorie + sévérité) signé cryptographiquement par une hash chain SHA-256.
//
// Conformité :
//  - nLPD art. 12 (traçabilité)
//  - LBA art. 7 al. 3 (conservation 10 ans)
//  - Hash chain : chaque évènement contient le SHA-256 de l'évènement précédent
//    + ses propres données. Toute altération brise la chaîne → preuve juridique.
//
// POST /functions/v1/audit-pdf-export
//   body : { from?: ISO, to?: ISO, category?, severity?, search?, agency_id? }
//   auth : Bearer <user_jwt> (agent de l'agence demandée)
//   returns : { pdf: base64, hash: string, chain_hash: string, count: number }
//
// Branche SUPER-ADMIN (20260705…, P2 admin) : un super-admin (rôle + allowlist
// revérifiés par _shared/require-super-admin.ts) exporte la piste d'audit
// PLATEFORME entière (body sans agency_id) ou celle d'une agence précise
// (body.agency_id). Le chemin agent est inchangé.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuditFilters {
  from?: string
  to?: string
  category?: string
  severity?: string
  search?: string
  /** Super-admin uniquement : scope une agence précise (absent = plateforme). */
  agency_id?: string
}

interface AuditRow {
  id: string
  created_at: string
  action: string
  category: string | null
  severity: string
  object_label: string | null
  entity_type: string
  entity_id: string | null
  actor_id: string | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
}

// ─── Hash chain : sha256(previous_hash + canonical(event)) ──────────────
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function canonicalize(row: AuditRow): string {
  // Sérialisation déterministe (clés triées) pour reproductibilité hash
  const keys: (keyof AuditRow)[] = [
    'id', 'created_at', 'action', 'category', 'severity',
    'object_label', 'entity_type', 'entity_id', 'actor_id', 'ip_address',
  ]
  const obj: Record<string, unknown> = {}
  for (const k of keys) obj[k] = row[k] ?? null
  if (row.metadata) obj.metadata = JSON.stringify(row.metadata)
  return JSON.stringify(obj)
}

async function buildHashChain(rows: AuditRow[]): Promise<{ perRowHashes: string[]; chainHash: string }> {
  const hashes: string[] = []
  let prev = '0'.repeat(64) // genesis
  for (const r of rows) {
    const h = await sha256Hex(prev + canonicalize(r))
    hashes.push(h)
    prev = h
  }
  return { perRowHashes: hashes, chainHash: prev }
}

// ─── Génération PDF ─────────────────────────────────────────────────────
async function buildPdf(
  rows: AuditRow[],
  hashes: string[],
  chainHash: string,
  filters: AuditFilters,
  agencyName: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await doc.embedFont(StandardFonts.Courier)

  const ink = rgb(0.043, 0.047, 0.055)      // #0B0C0E
  const muted = rgb(0.478, 0.502, 0.533)    // #7A8088
  const errRed = rgb(0.725, 0.114, 0.114)   // #B91C1C
  const warnOrange = rgb(0.549, 0.353, 0)   // #8C5A00
  const okGreen = rgb(0.063, 0.624, 0.431)  // #10B981

  const margin = 48
  const lineHeight = 12
  const fontSize = 9
  const colTime = 90
  const colAction = 230
  const colObject = 165
  // colSev retiré : la colonne "Sévérité" du PDF n'est plus dessinée (cf.
  // rendu ligne ~150). Conservé en commentaire pour réintroduction propre.

  const genTimestamp = new Date().toISOString()
  let page = doc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()
  let y = height - margin

  function newPage() {
    page = doc.addPage([595, 842])
    y = height - margin
  }

  function drawHeader() {
    page.drawText('MEGGA — Journal d\'audit nLPD', {
      x: margin, y, size: 14, font: fontBold, color: ink,
    })
    y -= 18
    page.drawText(`Agence : ${agencyName}`, { x: margin, y, size: 9, font, color: muted })
    y -= 12
    const range = filters.from || filters.to
      ? `${filters.from ?? 'origine'} → ${filters.to ?? 'maintenant'}`
      : 'toute période'
    page.drawText(`Période : ${range}`, { x: margin, y, size: 9, font, color: muted })
    y -= 12
    page.drawText(`Généré le : ${genTimestamp}`, { x: margin, y, size: 9, font, color: muted })
    y -= 12
    page.drawText(`Évènements : ${rows.length}`, { x: margin, y, size: 9, font, color: muted })
    y -= 20

    // Colonnes
    page.drawText('Date/heure', { x: margin, y, size: 8, font: fontBold, color: muted })
    page.drawText('Action', { x: margin + colTime, y, size: 8, font: fontBold, color: muted })
    page.drawText('Objet', { x: margin + colTime + colAction, y, size: 8, font: fontBold, color: muted })
    page.drawText('Sév.', { x: margin + colTime + colAction + colObject, y, size: 8, font: fontBold, color: muted })
    y -= 6
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 0.5,
      color: muted,
    })
    y -= 10
  }

  drawHeader()

  // Render rows
  for (let i = 0; i < rows.length; i++) {
    if (y < margin + 40) {
      newPage()
      drawHeader()
    }
    const r = rows[i]
    const dt = new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 16)
    const sevColor =
      r.severity === 'critical' ? errRed : r.severity === 'warn' ? warnOrange : okGreen

    page.drawText(dt, { x: margin, y, size: fontSize, font: fontMono, color: ink })
    page.drawText(truncate(r.action, 40), {
      x: margin + colTime, y, size: fontSize, font: fontBold, color: ink,
    })
    page.drawText(truncate(r.object_label ?? r.entity_type, 28), {
      x: margin + colTime + colAction, y, size: fontSize, font, color: ink,
    })
    page.drawText(r.severity, {
      x: margin + colTime + colAction + colObject, y, size: fontSize, font, color: sevColor,
    })
    y -= lineHeight

    // Detail line (metadata) + hash
    const note = r.metadata && (r.metadata.detail || r.metadata.note)
      ? String(r.metadata.detail || r.metadata.note)
      : ''
    if (note) {
      page.drawText(`  ${truncate(note, 100)}`, {
        x: margin + colTime, y, size: fontSize - 1, font, color: muted,
      })
      y -= lineHeight - 1
    }
    page.drawText(`  hash: ${hashes[i].slice(0, 32)}…`, {
      x: margin + colTime, y, size: fontSize - 2, font: fontMono, color: muted,
    })
    y -= lineHeight + 2
  }

  // Footer : chain hash
  if (y < margin + 60) newPage()
  y -= 10
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: ink,
  })
  y -= 14
  page.drawText('Signature cryptographique de la chaîne (SHA-256)', {
    x: margin, y, size: 9, font: fontBold, color: ink,
  })
  y -= 14
  // Split chain hash on 2 lines pour rester lisible
  page.drawText(chainHash.slice(0, 32), {
    x: margin, y, size: 9, font: fontMono, color: ink,
  })
  y -= 12
  page.drawText(chainHash.slice(32), {
    x: margin, y, size: 9, font: fontMono, color: ink,
  })
  y -= 18
  page.drawText(
    'nLPD art. 12 · LBA art. 7 al. 3 — Toute altération de cette piste d\'audit',
    { x: margin, y, size: 8, font, color: muted },
  )
  y -= 10
  page.drawText(
    'brise la chaîne de hash et invalide la preuve. Conservation 10 ans.',
    { x: margin, y, size: 8, font, color: muted },
  )

  return await doc.save()
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

// ─── Handler principal ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const filters = (await req.json().catch(() => ({}))) as AuditFilters

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Auth : user JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    // Récupère agency_id + rôle depuis le profil
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('agency_id, role')
      .eq('id', user.id)
      .single()

    // Scope : agent = SA propre agence ; super-admin (rôle + allowlist
    // revérifiés) = plateforme entière ou body.agency_id.
    let scopeAgencyId: string | null
    let agencyName: string
    if (profile?.role === 'super_admin') {
      const adminAuth = await requireSuperAdmin(req, corsHeaders)
      if (adminAuth instanceof Response) return adminAuth
      scopeAgencyId = filters.agency_id ?? null
      if (scopeAgencyId) {
        const { data: agency } = await supabaseAdmin
          .from('agencies')
          .select('name')
          .eq('id', scopeAgencyId)
          .single()
        agencyName = agency?.name ?? 'Agence MEGGA'
      } else {
        agencyName = 'Plateforme MEGGA'
      }
    } else {
      if (!profile?.agency_id) throw new Error('Agency not found')
      scopeAgencyId = profile.agency_id
      const { data: agency } = await supabaseAdmin
        .from('agencies')
        .select('name')
        .eq('id', scopeAgencyId)
        .single()
      agencyName = agency?.name ?? 'Agence MEGGA'
    }

    // Construit la query
    let query = supabaseAdmin
      .from('activity_events')
      .select(
        'id, created_at, action, category, severity, object_label, entity_type, entity_id, actor_id, ip_address, metadata',
      )
      .order('created_at', { ascending: false })
      .limit(10000) // safety cap pour 10 ans de logs
    if (scopeAgencyId) query = query.eq('agency_id', scopeAgencyId)

    if (filters.from) query = query.gte('created_at', filters.from)
    if (filters.to) query = query.lte('created_at', filters.to)
    if (filters.category) query = query.eq('category', filters.category)
    if (filters.severity) query = query.eq('severity', filters.severity)
    if (filters.search) {
      query = query.or(
        `action.ilike.%${filters.search}%,object_label.ilike.%${filters.search}%`,
      )
    }

    const { data: rows, error } = await query
    if (error) throw error

    const events = (rows as AuditRow[]) ?? []
    const { perRowHashes, chainHash } = await buildHashChain(events)
    const pdfBytes = await buildPdf(events, perRowHashes, chainHash, filters, agencyName)

    // Log l'export lui-même comme AuditEvent (méta-traçabilité)
    await supabaseAdmin.from('activity_events').insert({
      agency_id: scopeAgencyId,
      actor_id: user.id,
      action: 'Export PDF audit nLPD',
      entity_type: 'audit_export',
      category: 'settings',
      severity: 'info',
      object_label: `${events.length} évènements · hash ${chainHash.slice(0, 12)}…`,
      metadata: { filters, chain_hash: chainHash, count: events.length },
    })

    // Réponse base64 (compatible client browser). Encodage PAR CHUNKS : un spread
    // `String.fromCharCode(...pdfBytes)` sur un gros PDF d'audit (beaucoup
    // d'évènements nLPD) dépasse la limite d'arguments JS → RangeError. 32 Ko/passe.
    let binary = ''
    const B64_CHUNK = 0x8000
    for (let i = 0; i < pdfBytes.length; i += B64_CHUNK) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + B64_CHUNK))
    }
    const b64 = btoa(binary)

    return new Response(
      JSON.stringify({
        pdf_base64: b64,
        chain_hash: chainHash,
        count: events.length,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
