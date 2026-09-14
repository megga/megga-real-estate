import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'
import { disconnectMailAccount } from '../_shared/mail/disconnect.ts'

// delete-account — nLPD art. 32 (right to erasure) compliant account deletion.
//
// Behaviour:
// - Authenticates the caller via Bearer JWT.
// - Refuses deletion if: KYC cases still in_progress/review, or user is the
//   sole admin of an agency.
// - Anonymises profiles and contacts. activity_events: ONLY the account_deleted
//   trace is written (step 5); the FK detaches the user's lines when step 11
//   deletes the auth user — no applicative UPDATE, the journal is append-only.
// - Disconnects every mailbox the user owns (step 5c, 13.09.2026): Google grant
//   revoked, Vault secret erased, box deleted — the cascade never reached Vault.
// - Anonymises the director's KYB identity (agency_related_persons) and the
//   onboarding call (onboarding_calls) — added 07.08.2026, see below.
// - Deletes the agent's own profile card (agent_profiles) — added 14.09.2026.
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
// ⚠ LES CASCADES JOUENT, MAIS À LA FIN. L'étape 6 anonymise le profil ; l'étape
// 11 (deleteUser, suppression DURE) supprime sa ligne par `profiles_id_fkey` ON
// DELETE CASCADE, et déclenche alors chaque FK vers `profiles`. Une FK `on delete
// set null` coupe le lien SANS retirer la PII de la ligne fille : elle doit être
// traitée AVANT (8b), sinon elle survit, orpheline. C'est ce qui aurait laissé la
// date de naissance et le numéro de pièce du dirigeant intacts après une
// suppression. ⛔ Ce paragraphe affirmait l'inverse (« elle ne supprime jamais sa
// ligne … reste DORMANT ») : tests/backend/activity-events-actor-detach.spec.ts
// prouve la cascade.

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
    /** Le super-admin qui supprime un compte TIERS (branche admin) ; `null` pour une auto-suppression. */
    let operator: { id: string; email: string } | null = null

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
      operator = adminAuth.user
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

    // 5. Trace de la suppression, AVANT toute destruction. C'est la seule preuve que lit la
    //    console (useAccountDeletions) : si elle ne s'écrit pas, on s'arrête — rien n'est
    //    encore détruit. ⚠ Son résultat était JETÉ : supabase-js résout une erreur
    //    PostgREST, il ne la lève pas, et la suppression continuait sans trace.
    //
    //    L'ACTEUR est celui qui agit : le compte lui-même (branche self — la FK le
    //    détachera à l'étape 11), ou le super-admin opérateur (branche admin — la cible
    //    reste l'entité). La trace nommait la CIBLE dans les deux cas : un compte supprimé
    //    depuis la console n'avait d'auteur nulle part.
    const { error: traceErr } = await admin.from('activity_events').insert({
      agency_id: profile.agency_id,
      actor_id: operator?.id ?? userId,
      action: 'account_deleted',
      category: 'auth',
      entity_type: 'profile',
      entity_id: userId,
      metadata: {
        reason: operator ? 'admin_request' : 'user_request',
        initiated_by: operator ? 'admin' : 'user',
        timestamp: now,
        email_hash: profile.email ? `sha256:${profile.email.length}` : null,
      },
    })
    if (traceErr) {
      return json({ error: `Audit log failed: ${traceErr.message}` }, 500)
    }

    // 5b. Branche ADMIN : le registre MEGGA aussi (famille `lifecycle`), comme
    //     admin-user-lifecycle — et son échec se lit AVANT toute destruction.
    //     Clé de service ⇒ `auth.uid()` NULL ⇒ admin_log_write force « Système » ;
    //     l'opérateur est donc dans la première paire. ⛔ Ni l'e-mail ni le nom de la
    //     cible : le registre est append-only et gardé dix ans, il ne réintroduit pas
    //     la donnée dont il consigne l'effacement — `entity_id` suffit à la retrouver.
    if (operator) {
      const { error: registryErr } = await admin.rpc('admin_log_write', {
        p_family: 'lifecycle',
        p_action: 'account_deleted',
        p_severity: 'warn',
        p_entity_type: 'profile',
        p_entity_id: userId,
        p_agency_id: profile.agency_id ?? null,
        p_metadata: [
          { l: 'Opérateur', v: operator.email || operator.id },
          { l: 'Compte cible', v: userId },
          { l: 'Action', v: 'Suppression de compte (nLPD art. 32)' },
        ],
      })
      if (registryErr) {
        return json({ error: `Registry log failed: ${registryErr.message}` }, 500)
      }
    }

    // 5c. Boîtes connectées : révoquer le jeton, effacer le secret, supprimer la boîte —
    //     par le MÊME chemin que « Déconnecter » (disconnectMailAccount), et AVANT toute
    //     autre destruction.
    //
    //     La cascade de l'étape 11 (mail_accounts.owner_id → profiles ON DELETE CASCADE)
    //     emportait bien les boîtes, leurs fils et leurs messages — mais PAS le secret :
    //     Vault n'est la cible d'aucune clé étrangère. Le jeton de rafraîchissement
    //     survivait au compte, NON révoqué chez Google, et la seule ligne qui le désignait
    //     disparaissait avec le compte : MEGGA gardait de quoi lire la boîte d'une personne
    //     qui venait d'exercer son droit à l'effacement, sans plus rien pour le retrouver.
    //
    //     Un échec ARRÊTE la suppression, avant l'étape 6 : la boîte reste, en `disabled`,
    //     avec son pointeur, et la suppression se rejoue. Ne compte pas comme échec un
    //     jeton que Google tient déjà pour révoqué (`invalid_token`), ni un secret déjà
    //     absent — sans quoi le compte deviendrait insupprimable.
    const { data: boites, error: boitesErr } = await admin
      .from('mail_accounts')
      .select('id, provider, vault_secret_id')
      .eq('owner_id', userId)
    if (boitesErr) {
      return json({ error: `Mailbox lookup failed: ${boitesErr.message}` }, 500)
    }
    for (const boite of boites ?? []) {
      const r = await disconnectMailAccount(admin, boite)
      if (!r.ok) {
        return json(
          {
            error: 'MAILBOX_DISCONNECT_FAILED',
            message:
              "Une boîte mail connectée n'a pas pu être déconnectée. Le compte n'a pas été supprimé : réessayez dans quelques minutes.",
            reason: r.reason,
          },
          r.reason === 'secret_unreadable' || r.reason === 'provider_refused' ? 502 : 500
        )
      }
    }

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

    // 8. activity_events : AUCUNE écriture ici, et c'est voulu.
    //
    // Le journal est append-only (enforce_activity_events_immutability, dernière
    // définition 20260801420000). La dissociation est faite par la BASE à l'étape 11 :
    // deleteUser supprime auth.users → profiles_id_fkey (ON DELETE CASCADE) emporte le
    // profil → activity_events_actor_id_fkey (ON DELETE SET NULL) passe actor_id à NULL
    // sur TOUTES les lignes de l'agent, dans la transaction de la suppression, sans
    // plafond max_rows. La branche « détachement d'acteur » du trigger garde
    // actor_kind = 'user' (une personne a agi, on a perdu son nom) et dépose
    // actor_detached_at / _from / _reason. Et cette trace n'existe que si le profil a
    // réellement disparu : une estampille applicative posée ici affirmerait un
    // effacement que l'échec de l'étape 11 démentirait.
    //
    // ⛔ Ne pas réintroduire d'UPDATE. L'ancienne étape écrivait actor_id = 'deleted_user' :
    // refusé par le type uuid (22P02) avant même le trigger, erreur jamais lue — zéro ligne
    // modifiée en production. Les deux UPDATE que le trigger admettrait mentiraient :
    // actor_id = NULL seul ferait écrire « profile deleted (FK on delete set null) » avant
    // que le profil soit supprimé ; actor_kind = 'system' attribuerait à la machine le
    // geste d'un agent. Garde : tests/unit/activity-events-append-only.spec.ts.

    // 8b. Identité KYB du dirigeant (agency_related_persons).
    //
    // POURQUOI EXPLICITEMENT, alors qu'une FK existe. `profile_id` est
    // `on delete set null` : la cascade ne joue qu'à l'étape 11, et ne fait que
    // couper le lien. Sans ce traitement, la date de naissance, la nationalité et
    // le NUMÉRO DE PIÈCE survivraient au compte — intacts, orphelins, donc pires.
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
    // responsable, pas sous-traitante. ⚠ `booked_by` est `on delete cascade`
    // (20260803214105) : la ligne est SUPPRIMÉE à l'étape 11, avec le compte. Ce
    // retrait n'a donc d'effet que si l'étape 11 échoue — auquel cas les deux seules
    // colonnes propres au rendez-vous (« seuls un téléphone facultatif et une note
    // libre », migration d'origine) ne survivent pas au compte. Que le rendez-vous
    // doive, lui, survivre comme historique de l'agence est une décision à part :
    // elle passerait par la FK, pas par cette étape.
    const { error: callErr } = await admin
      .from('onboarding_calls')
      .update({ attendee_phone: null, attendee_note: null })
      .eq('booked_by', userId)
    if (callErr) {
      console.warn('onboarding_calls anonymisation warning:', callErr.message)
    }

    // 8d. Fiche de l'agent (agent_profiles) : bio, langues, spécialités, liens.
    //
    // L'agent la crée lui-même depuis le 14.09.2026 (ensure_my_agent_profile).
    // `profile_id` est `on delete cascade` depuis la même migration : l'étape 11
    // l'emporterait de toute façon. La suppression explicite garde la règle de ce
    // fichier — ce qui est déclaré effaçable l'est par une requête qu'on peut lire
    // (personal-data-estate.spec.ts) — et vaut aussi si l'étape 11 échoue.
    // ⚠ Avant cette migration, la FK était NO ACTION : une fiche aurait fait échouer
    // l'étape 11, et le compte serait devenu indestructible.
    const { error: cardErr } = await admin
      .from('agent_profiles')
      .delete()
      .eq('profile_id', userId)
    if (cardErr) {
      console.warn('agent_profiles deletion warning:', cardErr.message)
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
