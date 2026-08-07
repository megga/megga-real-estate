import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

// delete-account — nLPD art. 32 (right to erasure) compliant account deletion.
//
// Behaviour:
// - Authenticates the caller via Bearer JWT.
// - Refuses deletion if: KYC cases still in_progress/review, or user is the
//   sole admin of an agency.
// - Anonymises profiles, contacts and activity_events (audit trail preserved).
// - Anonymises the director's KYB identity (agency_related_persons) and the
//   onboarding call (onboarding_calls) — added 07.08.2026, see below.
// - Keeps kyc_cases + KYC-linked documents untouched (LBA art. 7 al. 3 — 10y).
// - Deletes non-KYC documents from Storage + DB.
// - Deletes the Supabase Auth user via admin API (service role).
//
// PÉRIMÈTRE DÉCLARÉ AILLEURS. Ce que MEGGA détient sur une personne, et ce que
// chacun des deux droits en fait, vit dans `_shared/personal-data-estate.ts`,
// partagé avec `admin-dsar-export`. Les deux fonctions avaient DIVERGÉ en
// silence : elles ne se recoupaient plus que sur `profiles` et
// `activity_events`, si bien qu'on pouvait exporter ce qui n'était jamais
// effacé, et inversement.
//
// ⚠ LES CASCADES NE SAUVENT RIEN ICI. Cette fonction ANONYMISE le profil
// (étape 6), elle ne supprime jamais sa ligne. Tout `on delete cascade` ou
// `on delete set null` pointant vers `profiles` reste donc DORMANT : les tables
// filles doivent être traitées à la main, sans quoi leur PII survit au compte.
// C'est ce qui laissait la date de naissance et le numéro de pièce du dirigeant
// intacts après une suppression.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // 1. Authenticate — extract user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing Authorization header' }, 401)
    }
    const jwt = authHeader.slice('Bearer '.length)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
    if (userError || !userData?.user) {
      return json({ error: 'Invalid or expired session' }, 401)
    }
    let userId = userData.user.id
    let initiatedByAdmin = false

    // Service role client — bypasses RLS
    const admin = createClient(supabaseUrl, supabaseServiceKey)

    // Branche ADMIN (P4) : un super-admin (rôle + allowlist revérifiés) peut
    // supprimer un compte tiers — le pipeline et TOUS ses garde-fous (KYC en
    // cours, dernier admin d'agence, rétention LBA) s'appliquent tels quels.
    const body = await req.clone().json().catch(() => ({})) as { target_user_id?: string }
    if (body.target_user_id && body.target_user_id !== userId) {
      const adminAuth = await requireSuperAdmin(req, corsHeaders)
      if (adminAuth instanceof Response) return adminAuth
      const { data: targetAllowlisted } = await admin.rpc('super_admin_allowlist_match', {
        p_email: (await admin.auth.admin.getUserById(body.target_user_id)).data.user?.email ?? '',
      })
      if (targetAllowlisted === true) {
        return json({ error: 'refused: cannot delete an allowlisted admin account' }, 403)
      }
      userId = body.target_user_id
      initiatedByAdmin = true
    }

    // 2. Load profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, agency_id, role, email')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) {
      return json({ error: `Profile lookup failed: ${profileError.message}` }, 500)
    }
    if (!profile) {
      return json({ error: 'Profile not found' }, 404)
    }

    // 3. Preflight — KYC cases still open
    // kyc_cases has no direct user_id. Use contacts linked to this user
    // (contacts.user_id OR contacts.assigned_to) -> their kyc_cases.
    // Fallback: check activity_events actor_id for in_progress kyc workflows.
    const { data: openCases, error: kycError } = await admin
      .from('kyc_cases')
      .select('id, status')
      .in('status', ['in_progress', 'review'])
      .eq('agency_id', profile.agency_id ?? '00000000-0000-0000-0000-000000000000')
      // filter by validated_by being this user if present — best-effort
      .or(`validated_by.eq.${userId}`)
    if (kycError) {
      // Non-fatal for missing column — log and continue
      console.warn('kyc_cases preflight warning:', kycError.message)
    }
    if (openCases && openCases.length > 0) {
      return json(
        {
          error: 'KYC_PENDING',
          message: `Vous avez ${openCases.length} dossier(s) KYC en cours. Attendez leur finalisation ou contactez le support.`,
          count: openCases.length,
        },
        400
      )
    }

    // 4. Preflight — sole admin of agency
    if (profile.agency_id && (profile.role === 'admin' || profile.role === 'manager')) {
      const { data: admins, error: adminErr } = await admin
        .from('profiles')
        .select('id')
        .eq('agency_id', profile.agency_id)
        .in('role', ['admin', 'manager'])
        .is('deleted_at', null)
      if (adminErr) {
        console.warn('sole-admin preflight warning:', adminErr.message)
      }
      if (admins && admins.length <= 1) {
        return json(
          {
            error: 'SOLE_ADMIN',
            message:
              'Vous êtes le seul administrateur de votre agence. Transférez vos droits avant de supprimer votre compte.',
            agency_id: profile.agency_id,
          },
          400
        )
      }
    }

    const now = new Date().toISOString()

    // 5. Log deletion event (BEFORE anonymising — keep actor_id = real userId)
    await admin.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: userId,
      action: 'account_deleted',
      category: 'auth',
      entity_type: 'profile',
      entity_id: userId,
      metadata: {
        reason: initiatedByAdmin ? 'admin_request' : 'user_request',
        initiated_by: initiatedByAdmin ? 'admin' : 'user',
        timestamp: now,
        email_hash: profile.email ? `sha256:${profile.email.length}` : null,
      },
    })

    // 6. Anonymise profile
    const anonEmail = `deleted+${userId}@megga.deleted`
    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({
        email: anonEmail,
        full_name: 'Utilisateur supprimé',
        avatar_url: null,
        phone: null,
        deleted_at: now,
      })
      .eq('id', userId)
    if (profileUpdateError) {
      return json(
        { error: `Profile anonymisation failed: ${profileUpdateError.message}` },
        500
      )
    }

    // 7. Anonymise contacts owned by this user (best-effort — schema varies)
    // Try user_id first, fall back to assigned_to.
    for (const ownerCol of ['user_id', 'assigned_to', 'created_by']) {
      const { error: contactsErr } = await admin
        .from('contacts')
        .update({
          first_name: 'Supprimé',
          last_name: '',
          email: null,
          phone: null,
          notes: null,
          deleted_user_id: userId,
        })
        .eq(ownerCol, userId)
      if (contactsErr && !/column .* does not exist/i.test(contactsErr.message)) {
        console.warn(`contacts[${ownerCol}] anonymisation warning:`, contactsErr.message)
      }
    }

    // 8. Anonymise activity_events actor_id — preserve audit trail, strip PII
    // We rewrite actor_id to the sentinel 'deleted_user' and store the old id
    // in metadata for forensic reference (LBA compliant).
    const { data: ownedEvents, error: eventsFetchErr } = await admin
      .from('activity_events')
      .select('id, metadata')
      .eq('actor_id', userId)
    if (eventsFetchErr) {
      console.warn('activity_events fetch warning:', eventsFetchErr.message)
    }
    if (ownedEvents && ownedEvents.length > 0) {
      // Bulk update per event to preserve existing metadata
      for (const ev of ownedEvents) {
        const mergedMeta = {
          ...(ev.metadata as Record<string, unknown> | null),
          deleted_user_id: userId,
        }
        await admin
          .from('activity_events')
          .update({ actor_id: 'deleted_user', metadata: mergedMeta })
          .eq('id', ev.id)
      }
    }

    // 8b. Identité KYB du dirigeant (agency_related_persons).
    //
    // POURQUOI EXPLICITEMENT, alors qu'une FK existe. `profile_id` est
    // `on delete set null`, mais le compte est ANONYMISÉ et jamais supprimé
    // (étape 6) : la cascade ne se déclenche donc JAMAIS. Sans ce traitement, la
    // date de naissance, la nationalité et le NUMÉRO DE PIÈCE survivraient au
    // compte — et si la cascade se déclenchait un jour, elle les laisserait
    // intacts en coupant seulement le lien : orphelins, donc pires.
    //
    // CE QU'ON RETIRE ET CE QU'ON GARDE. Partent les données de la PIÈCE
    // (naissance, nationalité, type et numéro) : leur finalité s'éteint quand la
    // vérification est tranchée — même raisonnement que la purge de l'image
    // (20260807101554). Restent le nom et le verdict : le dossier KYB de
    // l'agence doit continuer de dire QUI a été vérifié et avec quelle issue,
    // sans quoi on efface la conformité de l'agence en même temps que la donnée
    // du dirigeant. `id_document_read` ne porte que des verdicts de comparaison,
    // jamais les valeurs lues — rien à y retirer.
    const { error: kybErr } = await admin
      .from('agency_related_persons')
      .update({
        date_of_birth: null,
        nationality: null,
        id_document_type: null,
        id_document_number: null,
      })
      .eq('profile_id', userId)
    if (kybErr) {
      console.warn('agency_related_persons anonymisation warning:', kybErr.message)
    }

    // 8c. Appel d'accueil (onboarding_calls).
    //
    // Objet de PLATEFORME (MEGGA ↔ agence), hors tenant : MEGGA en est
    // responsable, pas sous-traitante. `booked_by` est `on delete cascade` et,
    // pour la même raison qu'en 8b, la cascade ne joue pas. La migration
    // d'origine avait déjà minimisé la table — « seuls un téléphone facultatif
    // et une note libre sont propres au rendez-vous » : ce sont exactement les
    // deux colonnes à retirer. Le rendez-vous lui-même reste, il appartient à
    // l'historique de l'agence autant qu'à la personne.
    const { error: callErr } = await admin
      .from('onboarding_calls')
      .update({ attendee_phone: null, attendee_note: null })
      .eq('booked_by', userId)
    if (callErr) {
      console.warn('onboarding_calls anonymisation warning:', callErr.message)
    }

    // 9. Touch KYC cases linked to this user — add a retention note, do NOT delete
    // (LBA art. 7 al. 3 — 10-year retention obligation)
    if (profile.agency_id) {
      const retentionNote = `\n[${now}] Utilisateur ${userId} supprimé — dossier conservé 10 ans conformément à LBA art. 7 al. 3.`
      // best-effort: append to kyc_cases.notes when column exists
      const { data: relatedCases } = await admin
        .from('kyc_cases')
        .select('id, notes')
        .eq('validated_by', userId)
      if (relatedCases) {
        for (const kc of relatedCases) {
          const newNotes = ((kc.notes as string | null) ?? '') + retentionNote
          await admin.from('kyc_cases').update({ notes: newNotes }).eq('id', kc.id)
        }
      }
    }

    // 10. Delete non-KYC documents from Storage + DB
    const { data: nonKycDocs, error: docsErr } = await admin
      .from('documents')
      .select('id, storage_path')
      .is('kyc_case_id', null)
      .eq('uploaded_by', userId)
    if (docsErr) {
      console.warn('documents fetch warning:', docsErr.message)
    }
    if (nonKycDocs && nonKycDocs.length > 0) {
      const paths = nonKycDocs
        .map((d) => (d as { storage_path: string | null }).storage_path)
        .filter((p): p is string => !!p)
      if (paths.length > 0) {
        // Infer bucket from path prefix or default — best-effort
        await admin.storage.from('documents').remove(paths).catch(() => {})
      }
      await admin
        .from('documents')
        .delete()
        .in(
          'id',
          nonKycDocs.map((d) => (d as { id: string }).id)
        )
    }

    // 11. Delete Supabase Auth user (prevents re-login)
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return json(
        {
          error: `Auth user deletion failed: ${authDeleteError.message}. Data was anonymised but the auth record remains — contact support.`,
        },
        500
      )
    }

    return json({
      success: true,
      message: 'Votre compte a été supprimé. Vous pouvez fermer cette page.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('delete-account fatal:', message)
    return json({ error: message }, 500)
  }
})
