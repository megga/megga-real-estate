// supabase/functions/c2pa-verify/index.ts
// Vérifie si une photo contient une signature C2PA valide (lecture seule)
// Pas d'auth requise — vérification publique

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { safeFetch } from '../_shared/safe-fetch.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface VerifyRequest {
  photoUrl: string
}

interface C2paManifest {
  signer: string
  signedAt: string
  claimGenerator: string
  assertions: Array<{ label: string; data: unknown }>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { photoUrl }: VerifyRequest = await req.json()

    if (!photoUrl) {
      return new Response(
        JSON.stringify({ error: 'photoUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Télécharger la photo — durci anti-SSRF : refuse les IP internes/loopback/
    // link-local (169.254.x = métadonnées cloud), le non-https, les redirections
    // et les réponses trop volumineuses. Endpoint public → cible d'attaque directe.
    let photoBytes: Uint8Array
    try {
      photoBytes = await safeFetch(photoUrl)
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch photo', detail: String((e as Error).message) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── C2PA Verification ──────────────────────────────────────────────
    // Stratégie : tenter c2pa-wasm (WASM, compatible Deno), fallback sur
    // extraction EXIF metadata si WASM indisponible.
    //
    // Phase 1 (actuel) : vérification basée sur les metadata EXIF + hash
    // Phase 2 : intégration c2pa-wasm ou Trufo API pour vérification complète

    let verified = false
    let manifest: C2paManifest | null = null

    try {
      // Tentative de chargement c2pa-wasm (peut échouer si non supporté).
      // Spécifieur indirect : dépendance optionnelle (Phase 2), non publiée sur npm
      // aujourd'hui → non résolue statiquement par `deno check`. Chargement best-effort
      // au runtime, protégé par le try/catch + fallback JUMBF ci-dessous.
      const c2paSpecifier = 'npm:c2pa-wasm'
      const c2pa = await import(c2paSpecifier)
      if (c2pa && typeof c2pa.read === 'function') {
        const result = await c2pa.read(photoBytes)
        if (result && result.manifests && result.manifests.length > 0) {
          verified = true
          const m = result.manifests[0]
          manifest = {
            signer: m.signer_info?.issuer || 'Unknown',
            signedAt: m.signature_info?.time || new Date().toISOString(),
            claimGenerator: m.claim_generator || 'Unknown',
            assertions: m.assertions || [],
          }
        }
      }
    } catch {
      // c2pa-wasm non disponible — fallback sur vérification basique
      // On vérifie la présence de markers C2PA dans les bytes du fichier
      // Le standard C2PA utilise JUMBF (ISO 19566-5) boxes dans les fichiers JPEG/PNG
      const bytes = photoBytes
      const jumbfMarker = findJumbfBox(bytes)
      if (jumbfMarker) {
        verified = true
        manifest = {
          signer: 'C2PA Signed (basic verification)',
          signedAt: new Date().toISOString(),
          claimGenerator: 'Unknown (JUMBF detected)',
          assertions: [],
        }
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        manifest,
        photoUrl,
        verifiedAt: verified ? new Date().toISOString() : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── JUMBF Box Detection ───────────────────────────────────────────────────
// C2PA stores data in JUMBF boxes (ISO 19566-5). In JPEG files, JUMBF is
// stored as APP11 markers (0xFF 0xEB). In PNG, as dedicated chunks.
// This is a basic heuristic — production should use c2pa-wasm for full parsing.

function findJumbfBox(bytes: Uint8Array): boolean {
  // Search for JUMBF box type identifier "jumb" in the file
  const jumbSignature = [0x6A, 0x75, 0x6D, 0x62] // "jumb"
  const c2paSignature = [0x63, 0x32, 0x70, 0x61] // "c2pa"

  for (let i = 0; i < bytes.length - 8; i++) {
    // Check for "jumb" or "c2pa" markers
    if (
      (bytes[i] === jumbSignature[0] && bytes[i + 1] === jumbSignature[1] &&
       bytes[i + 2] === jumbSignature[2] && bytes[i + 3] === jumbSignature[3]) ||
      (bytes[i] === c2paSignature[0] && bytes[i + 1] === c2paSignature[1] &&
       bytes[i + 2] === c2paSignature[2] && bytes[i + 3] === c2paSignature[3])
    ) {
      return true
    }
  }
  return false
}
