import { supabase } from '@/lib/supabase'
import type { TablesInsert } from '@/types/database'

const DEMO_TAG = '_demo'

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ── Seed function ──────────────────────────────────────────────────────────

export async function seedDemoData(agencyId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // ── 1. Contacts ──
    const { data: contacts, error: contactsErr } = await supabase
      .from('contacts')
      .insert(([
        {
          agency_id: agencyId,
          first_name: 'Marc',
          last_name: 'Dupont',
          email: 'marc.dupont@example.ch',
          phone: '+41 79 123 45 67',
          type: 'buyer',
          score: 'hot',
          source: 'website',
          budget_announced: 850000,
          budget_estimated_ai: 920000,
          search_zones: ['GE'],
          search_criteria: { type: 'apartment', budget_min: 700000, budget_max: 850000, zones: ['Eaux-Vives', 'Plainpalais'], rooms_min: 3 },
          ai_seriousness_score: 88,
          ai_purchase_probability: 75,
          ai_timing: 'immediate',
          ai_engagement_level: 'very_high',
          tags: [DEMO_TAG, 'prioritaire'],
          notes: 'Lead démo — budget solide, recherche active',
          created_at: daysAgo(28),
        },
        {
          agency_id: agencyId,
          first_name: 'Sophie',
          last_name: 'Müller',
          email: 'sophie.muller@example.ch',
          phone: '+41 76 234 56 78',
          type: 'buyer',
          score: 'warm',
          source: 'referral',
          budget_announced: 1200000,
          budget_estimated_ai: 1350000,
          search_zones: ['GE'],
          search_criteria: { type: 'villa', budget_min: 1000000, budget_max: 1200000, zones: ['Cologny', 'Vandoeuvres'], rooms_min: 5 },
          ai_seriousness_score: 72,
          ai_purchase_probability: 60,
          ai_timing: '1-3_months',
          ai_engagement_level: 'high',
          tags: [DEMO_TAG],
          notes: 'Recherche villa avec vue lac',
          created_at: daysAgo(21),
        },
        {
          agency_id: agencyId,
          first_name: 'Jean-Pierre',
          last_name: 'Favre',
          email: 'jp.favre@example.ch',
          phone: '+41 78 345 67 89',
          type: 'seller',
          score: 'hot',
          source: 'walk_in',
          ai_tension_level: 'moderate',
          ai_price_reduction_probability: 30,
          ai_engagement_level: 'high',
          tags: [DEMO_TAG, 'vendeur'],
          notes: 'Vendeur appart 4p Carouge — motivé',
          created_at: daysAgo(2),
        },
        {
          agency_id: agencyId,
          first_name: 'Elena',
          last_name: 'Rossi',
          email: 'elena.rossi@example.ch',
          phone: '+41 79 456 78 90',
          type: 'buyer',
          score: 'cold',
          source: 'website',
          budget_announced: 500000,
          search_zones: ['VD'],
          search_criteria: { type: 'apartment', budget_min: 400000, budget_max: 500000, zones: ['Lausanne'], rooms_min: 1 },
          ai_seriousness_score: 25,
          ai_purchase_probability: 20,
          ai_timing: '6-12_months',
          ai_engagement_level: 'low',
          tags: [DEMO_TAG],
          created_at: daysAgo(45),
        },
        {
          agency_id: agencyId,
          first_name: 'Thomas',
          last_name: 'Weber',
          email: 'thomas.weber@example.ch',
          phone: '+41 79 567 89 01',
          type: 'buyer',
          score: 'hot',
          source: 'referral',
          budget_announced: 2000000,
          budget_estimated_ai: 2200000,
          search_zones: ['GE', 'VD'],
          search_criteria: { type: 'apartment', budget_min: 1800000, budget_max: 2000000, zones: ['Rive droite', 'Rive gauche'], rooms_min: 5 },
          ai_seriousness_score: 91,
          ai_purchase_probability: 80,
          ai_timing: 'immediate',
          ai_engagement_level: 'very_high',
          tags: [DEMO_TAG, 'VIP'],
          notes: 'Budget premium, vue lac obligatoire',
          created_at: daysAgo(14),
        },
        {
          agency_id: agencyId,
          first_name: 'Nathalie',
          last_name: 'Bonvin',
          email: 'nathalie.bonvin@example.ch',
          phone: '+41 76 678 90 12',
          type: 'seller',
          score: 'warm',
          source: 'walk_in',
          ai_tension_level: 'calm',
          ai_price_reduction_probability: 15,
          tags: [DEMO_TAG, 'vendeur'],
          notes: 'Villa 6p Nyon, pas pressée',
          created_at: daysAgo(10),
        },
        {
          agency_id: agencyId,
          first_name: 'Patrick',
          last_name: 'Schneider',
          email: 'p.schneider@example.ch',
          phone: '+41 79 789 01 23',
          type: 'investor',
          score: 'warm',
          source: 'referral',
          budget_announced: 3000000,
          search_zones: ['GE', 'VD', 'ZH'],
          ai_seriousness_score: 65,
          ai_purchase_probability: 55,
          ai_timing: '3-6_months',
          ai_engagement_level: 'medium',
          tags: [DEMO_TAG, 'investisseur'],
          notes: 'Cible rendement locatif 4%+',
          created_at: daysAgo(18),
        },
        {
          agency_id: agencyId,
          first_name: 'Marie-Claire',
          last_name: 'Jolivet',
          email: 'mc.jolivet@example.ch',
          phone: '+41 78 890 12 34',
          type: 'buyer',
          score: 'warm',
          source: 'website',
          budget_announced: 650000,
          budget_estimated_ai: 700000,
          search_zones: ['GE'],
          search_criteria: { type: 'apartment', budget_min: 550000, budget_max: 650000, zones: ['Centre-ville'], rooms_min: 2 },
          ai_seriousness_score: 58,
          ai_purchase_probability: 45,
          ai_timing: '3-6_months',
          ai_engagement_level: 'medium',
          tags: [DEMO_TAG],
          created_at: daysAgo(22),
        },
        {
          agency_id: agencyId,
          first_name: 'Alessandro',
          last_name: 'Bianchi',
          email: 'a.bianchi@example.ch',
          phone: '+41 79 901 23 45',
          type: 'both',
          score: 'warm',
          source: 'referral',
          budget_announced: 900000,
          search_zones: ['GE'],
          ai_tension_level: 'moderate',
          ai_seriousness_score: 62,
          ai_engagement_level: 'medium',
          tags: [DEMO_TAG, 'permutation'],
          notes: 'Permutation — vend pour acheter plus grand',
          created_at: daysAgo(7),
        },
        {
          agency_id: agencyId,
          first_name: 'Isabelle',
          last_name: 'Keller',
          email: 'isabelle.keller@example.ch',
          phone: '+41 76 012 34 56',
          type: 'tenant',
          score: 'cold',
          source: 'website',
          budget_announced: 30000, // CHF 2500/mois × 12
          search_zones: ['VD'],
          search_criteria: { type: 'apartment', budget_max: 30000, zones: ['Lausanne'], rooms_min: 3 },
          ai_engagement_level: 'low',
          tags: [DEMO_TAG],
          notes: 'Cherche location 3p Lausanne CHF 2500/mois',
          created_at: daysAgo(30),
        },
      ] as unknown as TablesInsert<'contacts'>[]))
      .select('id, first_name, last_name')

    if (contactsErr) throw contactsErr

    // Refetch avec search_criteria pour pouvoir alimenter client_searches.
    // `.select('id, first_name, last_name')` ci-dessus ne renvoie pas search_criteria.
    const contactIds = (contacts ?? []).map(c => c.id)
    const { data: contactsFull } = contactIds.length > 0
      ? await supabase
          .from('contacts')
          .select('id, last_name, type, search_criteria')
          .in('id', contactIds)
      : { data: [] }

    const marcId   = contacts?.find(c => c.last_name === 'Dupont')?.id
    const sophieId = contacts?.find(c => c.last_name === 'Müller')?.id
    const jpId     = contacts?.find(c => c.last_name === 'Favre')?.id
    const thomasId = contacts?.find(c => c.last_name === 'Weber')?.id

    // ── 1b. Client searches ──
    // Le moteur de matching (Edge Function `matching-engine`) lit
    // `client_searches.criteria`, pas `contacts.search_criteria`. Sans cette
    // étape, "Relancer le matching" sur la page /dashboard/matching ne
    // trouvera rien après le seed (cf. handoff useMatchingSugar). On crée
    // un client_search actif par buyer ayant des critères.
    const buyerContacts = (contactsFull ?? []).filter(
      c =>
        (c.type === 'buyer' || c.type === 'both' || c.type === 'tenant' || c.type === 'investor') &&
        c.search_criteria != null,
    )
    if (buyerContacts.length > 0) {
      await supabase.from('client_searches').insert(
        buyerContacts.map(c => ({
          agency_id: agencyId,
          contact_id: c.id,
          label: 'Recherche initiale (démo)',
          criteria: c.search_criteria,
          is_active: true,
        })),
      )
    }

    // ── 2. Properties ──
    const { data: properties, error: propsErr } = await supabase
      .from('properties')
      .insert(([
        {
          agency_id: agencyId,
          title: 'Appartement 3 pièces — Rue de la Fontaine',
          description: 'Bel appartement lumineux en plein cœur de Genève. Double vitrage, parquet chêne, cave.',
          type: 'apartment',
          status: 'active',
          price: 850000,
          currency: 'CHF',
          rooms: 3,
          bedrooms: 2,
          bathrooms: 1,
          surface_m2: 75,
          floor: 3,
          address: 'Rue de la Fontaine 12',
          city: 'Genève',
          canton: 'GE',
          postal_code: '1204',
          lat: 46.2021,
          lng: 6.1481,
          has_outdoor: false,
          has_parking: false,
          year_built: 1985,
          condition: 'good',
          photos: ['https://img.realadvisor.ch/v7/https%3A%2F%2Fapi.realadvisor.ch%2Fpictures%2Fdb_listing_pictures%2Foriginal%2F01959fd3-a85a-7df4-b3c0-2e4c11374f5c.jpg'],
          created_by: userId,
          published_at: daysAgo(20),
        },
        {
          agency_id: agencyId,
          title: 'Villa contemporaine avec vue lac — Cologny',
          description: 'Somptueuse villa contemporaine, 6 pièces, jardin paysager, piscine, vue panoramique sur le lac.',
          type: 'villa',
          status: 'active',
          price: 2800000,
          currency: 'CHF',
          rooms: 6,
          bedrooms: 4,
          bathrooms: 3,
          surface_m2: 220,
          address: 'Chemin du Lac 8',
          city: 'Cologny',
          canton: 'GE',
          postal_code: '1223',
          lat: 46.2284,
          lng: 6.1952,
          has_outdoor: true,
          has_parking: true,
          year_built: 2015,
          condition: 'new',
          photos: ['https://img.realadvisor.ch/v7/https%3A%2F%2Fapi.realadvisor.ch%2Fpictures%2Fdb_listing_pictures%2Foriginal%2F01959f3b-c49a-72e0-b4a1-51d7fc3dbb98.jpg'],
          created_by: userId,
          published_at: daysAgo(15),
        },
        {
          agency_id: agencyId,
          title: 'Appartement 4 pièces — Carouge',
          description: 'Spacieux 4 pièces au cœur de Carouge. Cuisine équipée, balcon, cave et parking.',
          type: 'apartment',
          status: 'active',
          price: 720000,
          currency: 'CHF',
          rooms: 4,
          bedrooms: 3,
          bathrooms: 1,
          surface_m2: 95,
          floor: 2,
          address: 'Avenue de Carouge 45',
          city: 'Carouge',
          canton: 'GE',
          postal_code: '1227',
          lat: 46.1853,
          lng: 6.1385,
          has_outdoor: true,
          has_parking: true,
          year_built: 1992,
          condition: 'renovated',
          photos: ['https://img.realadvisor.ch/v7/https%3A%2F%2Fapi.realadvisor.ch%2Fpictures%2Fdb_listing_pictures%2Foriginal%2F01959c19-da26-7d50-a302-b9f17cf0c7e1.jpg'],
          created_by: userId,
          published_at: daysAgo(25),
        },
        {
          agency_id: agencyId,
          title: 'Maison familiale — Route de Suisse, Nyon',
          description: 'Charmante maison familiale 5 pièces avec jardin. Proche gare, école, commerces.',
          type: 'house',
          status: 'active',
          price: 1100000,
          currency: 'CHF',
          rooms: 5,
          bedrooms: 3,
          bathrooms: 2,
          surface_m2: 150,
          address: 'Route de Suisse 23',
          city: 'Nyon',
          canton: 'VD',
          postal_code: '1260',
          lat: 46.3822,
          lng: 6.2398,
          has_outdoor: true,
          has_parking: true,
          year_built: 2001,
          condition: 'good',
          photos: ['https://img.realadvisor.ch/v7/https%3A%2F%2Fapi.realadvisor.ch%2Fpictures%2Fdb_listing_pictures%2Foriginal%2F01959da3-80e5-7e22-b97b-a7c4e0fb8e0f.jpg'],
          created_by: userId,
          published_at: daysAgo(18),
        },
        {
          agency_id: agencyId,
          title: 'Studio — Rue du Mont-Blanc',
          description: 'Studio idéalement situé face à la gare Cornavin. Idéal investissement locatif.',
          type: 'apartment',
          status: 'draft',
          price: 480000,
          currency: 'CHF',
          rooms: 1,
          bedrooms: 0,
          bathrooms: 1,
          surface_m2: 35,
          floor: 4,
          address: 'Rue du Mont-Blanc 5',
          city: 'Genève',
          canton: 'GE',
          postal_code: '1201',
          lat: 46.2101,
          lng: 6.1426,
          has_outdoor: false,
          has_parking: false,
          year_built: 1970,
          condition: 'to_renovate',
          photos: [],
          created_by: userId,
        },
      ] as unknown as TablesInsert<'properties'>[]))
      .select('id, title')

    if (propsErr) throw propsErr

    const propCarougeId = properties?.find(p => p.title.includes('Carouge'))?.id
    const propVillaId   = properties?.find(p => p.title.includes('Cologny'))?.id

    // ── 3. Transactions ──
    if (marcId && propCarougeId) {
      await supabase.from('transactions').insert({
        agency_id: agencyId,
        property_id: propCarougeId,
        contact_buyer_id: marcId,
        stage: 'visit_done',
        status: 'active',
        price_offered: 700000,
        notes: DEMO_TAG,
      })
    }
    if (sophieId && propVillaId) {
      await supabase.from('transactions').insert({
        agency_id: agencyId,
        property_id: propVillaId,
        contact_buyer_id: sophieId,
        stage: 'active_search',
        status: 'active',
        notes: DEMO_TAG,
      })
    }
    if (jpId && propCarougeId) {
      await supabase.from('transactions').insert({
        agency_id: agencyId,
        property_id: propCarougeId,
        contact_seller_id: jpId,
        stage: 'new_lead',
        status: 'active',
        notes: DEMO_TAG,
      })
    }

    // ── 4. KYC case for Marc Dupont ──
    if (marcId) {
      const { data: kycCase } = await supabase
        .from('kyc_cases')
        .insert({
          agency_id: agencyId,
          contact_id: marcId,
          type: 'buyer_pp',
          risk_level: 'low',
          status: 'in_progress',
          completion_pct: 40,
        })
        .select('id')
        .single()

      if (kycCase) {
        await supabase.from('kyc_checklist_items').insert([
          { kyc_case_id: kycCase.id, label: "Pièce d'identité (passeport/CI)", category: 'identity', is_required: true, is_completed: true, completed_at: daysAgo(10) },
          { kyc_case_id: kycCase.id, label: "Justificatif de domicile", category: 'domicile', is_required: true, is_completed: true, completed_at: daysAgo(10) },
          { kyc_case_id: kycCase.id, label: "Justificatif de revenus (3 derniers bulletins)", category: 'income', is_required: true, is_completed: false },
          { kyc_case_id: kycCase.id, label: "Déclaration d'origine des fonds", category: 'funds', is_required: true, is_completed: false },
        ])
      }
    }

    // ── 5. Activity events ──
    const events = []
    if (marcId && propCarougeId) {
      events.push({ agency_id: agencyId, actor_id: userId, action: 'visit_done', entity_type: 'contact', entity_id: marcId, metadata: { property_title: 'Appartement 4 pièces — Carouge', _demo: true }, created_at: daysAgo(3) })
      events.push({ agency_id: agencyId, actor_id: userId, action: 'kyc_created', entity_type: 'contact', entity_id: marcId, metadata: { type: 'buyer_pp', _demo: true }, created_at: daysAgo(10) })
    }
    if (sophieId) {
      events.push({ agency_id: agencyId, actor_id: userId, action: 'property_sent', entity_type: 'contact', entity_id: sophieId, metadata: { property_title: 'Villa contemporaine avec vue lac — Cologny', _demo: true }, created_at: daysAgo(5) })
    }
    if (jpId) {
      events.push({ agency_id: agencyId, actor_id: userId, action: 'seller_lead_created', entity_type: 'contact', entity_id: jpId, metadata: { city: 'Carouge', _demo: true }, created_at: daysAgo(1) })
    }
    if (thomasId) {
      events.push({ agency_id: agencyId, actor_id: userId, action: 'email_sent', entity_type: 'contact', entity_id: thomasId, metadata: { subject: 'Sélection de biens — vue lac', _demo: true }, created_at: daysAgo(7) })
    }
    if (events.length > 0) {
      await supabase.from('activity_events').insert(events)
    }

    // ── 6. Seller lead ──
    await supabase.from('seller_leads').insert({
      property_data: {
        address: 'Avenue de Carouge 45',
        city: 'Carouge',
        canton: 'GE',
        postalCode: '1227',
        type: 'apartment',
        rooms: '4',
        bedrooms: '3',
        surface: 95,
        condition: 'good',
        yearBuilt: '1992',
        photos: [],
      },
      estimation_min: 700000,
      estimation_max: 780000,
      estimation_median: 740000,
      estimation_price_per_m2: 7789,
      estimation_confidence: 'high',
      comparable_count: 12,
      contact_name: 'Jean-Pierre Favre',
      contact_email: 'jp.favre@example.ch',
      contact_phone: '+41 78 345 67 89',
      motivation: 'immediate',
      status: 'new',
      source: 'demo',
    })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Clear demo data ────────────────────────────────────────────────────────

export async function clearDemoData(agencyId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete contacts with _demo tag (cascades to transactions, matches, etc.)
    await supabase
      .from('contacts')
      .delete()
      .eq('agency_id', agencyId)
      .contains('tags', [DEMO_TAG])

    // Delete properties created by demo
    await supabase
      .from('properties')
      .delete()
      .eq('agency_id', agencyId)
      .like('notes', `%${DEMO_TAG}%`)

    // Delete seller leads from demo
    await supabase
      .from('seller_leads')
      .delete()
      .eq('source', 'demo')

    // Delete activity events with _demo in metadata
    await supabase
      .from('activity_events')
      .delete()
      .eq('agency_id', agencyId)
      .contains('metadata', { _demo: true })

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
