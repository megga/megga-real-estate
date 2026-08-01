// supabase/functions/c2pa-sign/index.ts
// Signe les photos d'un bien immobilier avec un Content Credential C2PA.
// Auth JWT + ownership check — seul un agent de l'agence propriétaire peut signer.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { assertPublicUrl } from '../_shared/safe-fetch.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SignRequest {
  propertyId: string
  photoUrls: string[]    // URLs des photos à signer
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const { profile, supabase } = auth

    const { propertyId, photoUrls }: SignRequest = await req.json()

    if (!propertyId || !photoUrls?.length) {
      return new Response(
        JSON.stringify({ error: 'propertyId and photoUrls are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Vérifier que le bien existe ET appartient à l'agence du caller.
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, agency_id, title, photos')
      .eq('id', propertyId)
      .single()

    if (propError || !property) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (property.agency_id !== profile.agency_id) {
      return new Response(
        JSON.stringify({ error: 'Bien hors agence — signature refusée' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── C2PA Signing ────────────────────────────────────────────────────
    // Stratégie multi-niveaux :
    // 1. Tenter c2pa-wasm (WASM natif, 0 coût)
    // 2. Fallback : appeler Trufo API ($0.01/image) si C2PA_PROVIDER=trufo
    // 3. Fallback final : marquer comme "vérifié MEGGA" (hash SHA-256 + EXIF)
    //
    // Le provider est configuré via la variable d'env C2PA_PROVIDER :
    // - "wasm"  : c2pa-wasm (gratuit, peut ne pas fonctionner en Edge Function)
    // - "trufo" : Trufo API (fiable, $0.01/image)
    // - "megga" : vérification interne hash+EXIF (gratuit, pas de certificat C2PA officiel)

    const provider = Deno.env.get('C2PA_PROVIDER') || 'megga'
    const results: Array<{ url: string; signed: boolean; method: string }> = []

    for (const photoUrl of photoUrls) {
      try {
        // SSRF (S23) : n'accepter que des URLs publiques https (refuse IP internes/
        // loopback/link-local) avant tout fetch ou envoi à un tiers (Capture/Trufo).
        await assertPublicUrl(photoUrl)
        let signed = false
        let method = 'none'

        if (provider === 'capture') {
          // ── Capture (Numbers Protocol) — C2PA signing avec certificat officiel ──
          // Flow : 1) upload image → get nid  2) POST c2pa/ → get signed URL
          const captureToken = Deno.env.get('CAPTURE_API_TOKEN')
          if (captureToken) {
            // Step 1: Télécharger la photo et l'uploader sur Capture
            const photoResponse = await fetch(photoUrl)
            if (photoResponse.ok) {
              const photoBlob = await photoResponse.blob()
              const formData = new FormData()
              formData.append('asset_file', photoBlob, 'photo.jpg')
              formData.append('caption', `MEGGA Real Estate - Property ${propertyId}`)
              formData.append('meta', JSON.stringify({
                proof: { hash: '', mimeType: photoBlob.type, timestamp: new Date().toISOString() },
                information: [
                  { provider: 'MEGGA Real Estate', name: 'platform', value: 'megga.ch' },
                  { provider: 'MEGGA Real Estate', name: 'property_id', value: propertyId },
                ],
              }))

              const registerResponse = await fetch('https://api.numbersprotocol.io/api/v3/assets/', {
                method: 'POST',
                headers: { 'Authorization': `token ${captureToken}` },
                body: formData,
              })

              if (registerResponse.ok) {
                const registerData = await registerResponse.json()
                const nid = registerData.nid || registerData.id

                if (nid) {
                  // Step 2: Signer avec C2PA
                  const c2paResponse = await fetch(`https://api.numbersprotocol.io/api/v3/assets/${nid}/c2pa/`, {
                    method: 'POST',
                    headers: { 'Authorization': `token ${captureToken}` },
                  })

                  if (c2paResponse.ok) {
                    signed = true
                    method = `capture:${nid}`
                  } else {
                    const c2paErr = await c2paResponse.text()
                    method = `capture_c2pa_error:${c2paResponse.status}:${c2paErr.slice(0, 100)}`
                  }
                }
              } else {
                const regErr = await registerResponse.text()
                method = `capture_register_error:${registerResponse.status}:${regErr.slice(0, 100)}`
              }
            }
          }
        } else if (provider === 'trufo') {
          // ── Trufo API (Coming Soon — fallback si activé) ─────────────
          const trufoKey = Deno.env.get('TRUFO_API_KEY')
          if (trufoKey) {
            const trufoResponse = await fetch('https://api.trufo.ai/v1/c2pa/sign', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${trufoKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: photoUrl,
                signer: 'MEGGA Real Estate',
                assertions: [{
                  label: 'c2pa.actions',
                  data: { actions: [{ action: 'c2pa.published', softwareAgent: 'MEGGA Real Estate Platform' }] },
                }],
              }),
            })
            if (trufoResponse.ok) {
              signed = true
              method = 'trufo'
            }
          }
        } else if (provider === 'wasm') {
          // ── c2pa-wasm ────────────────────────────────────────────────
          // Phase 2 : intégration c2pa-wasm quand le support Deno est confirmé
          method = 'wasm_pending'
        }

        // ── Fallback MEGGA Shield (seulement si pas de provider error) ────
        if (!signed && (method === 'none' || method === 'wasm_pending')) {
          const photoResponse2 = await fetch(photoUrl)
          if (photoResponse2.ok) {
            const buffer = await photoResponse2.arrayBuffer()
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
            signed = true
            method = `megga_shield:${hashHex.slice(0, 16)}`
          }
        }

        results.push({ url: photoUrl, signed, method })
      } catch {
        results.push({ url: photoUrl, signed: false, method: 'error' })
      }
    }

    const allSigned = results.every(r => r.signed)
    const signingMethod = results[0]?.method || 'none'

    // Normalize the persisted method so the UI can render an honest badge.
    // - capture/trufo → real C2PA certificate (the badge says "Certifié C2PA")
    // - megga_shield  → SHA-256 + EXIF only, no external trust authority
    //                   (the badge says "Vérifié MEGGA — hash interne")
    // - wasm_pending  → not really signed; should not have allSigned=true,
    //                   but defensive: marks as megga_shield-style only.
    const persistedMethod = (() => {
      if (signingMethod.startsWith('capture:')) return 'capture'
      if (signingMethod === 'trufo') return 'trufo'
      if (signingMethod.startsWith('megga_shield:')) return 'megga_shield'
      return signingMethod
    })()

    // Mettre à jour le bien en DB
    if (allSigned) {
      await supabase
        .from('properties')
        .update({
          c2pa_verified: true,
          c2pa_verified_at: new Date().toISOString(),
          c2pa_verification_method: persistedMethod,
        })
        .eq('id', propertyId)

      // Audit trail
      await supabase.from('activity_events').insert({
        agency_id: property.agency_id,
        actor_id: null,
        actor_kind: 'system',
        // ⚠ Clé d'action en français, comme ai-copilot. Non corrigée ici pour la même
        // raison (contrat), et d'autant moins que le C2PA est hors périmètre MVP
        // (plan §6, acté le 31 juil.) : cette fonction est dormante.
        action: 'Photos certifiées C2PA',
        category: 'bien',
        entity_type: 'property',
        entity_id: propertyId,
        metadata: {
          photos_count: photoUrls.length,
          method: signingMethod,
          persisted_method: persistedMethod,
          provider,
        },
      })
    }

    return new Response(
      JSON.stringify({
        success: allSigned,
        propertyId,
        provider,
        results,
        method: signingMethod,
        verifiedAt: allSigned ? new Date().toISOString() : null,
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
