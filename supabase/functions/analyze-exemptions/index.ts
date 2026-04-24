import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Federal exemption amounts (April 2025)
const FEDERAL = {
  homestead: { amount: 27900, statute: '11 U.S.C. § 522(d)(1)', name: 'Homestead Exemption' },
  motor_vehicle: { amount: 4450, statute: '11 U.S.C. § 522(d)(2)', name: 'Motor Vehicle Exemption' },
  household_goods: { amount: 14875, statute: '11 U.S.C. § 522(d)(3)', name: 'Household Goods & Furnishings' },
  jewelry: { amount: 1875, statute: '11 U.S.C. § 522(d)(4)', name: 'Jewelry Exemption' },
  wildcard: { amount: 1475, bonus: 13950, statute: '11 U.S.C. § 522(d)(5)', name: 'Wildcard Exemption' },
  tools_of_trade: { amount: 2800, statute: '11 U.S.C. § 522(d)(6)', name: 'Tools of the Trade' },
  retirement: { amount: null, statute: '11 U.S.C. § 522(d)(10)(E)', name: 'Retirement Accounts' },
  bank_accounts: { amount: 0, statute: '', name: 'Bank Accounts' },
}

// State exemption amounts
const STATE_DATA: Record<string, any> = {
  CA: {
    allows_federal: false, has_two_systems: true,
    system1: {
      name: 'California System 1 (CCP § 704)',
      homestead: { amount: 300000, statute: 'CCP § 704.730' },
      motor_vehicle: { amount: 3325, statute: 'CCP § 704.010' },
      household_goods: { amount: 999999, statute: 'CCP § 704.020' },
      jewelry: { amount: 8725, statute: 'CCP § 704.040' },
      wildcard: { amount: 0, bonus: 0, statute: '' },
      tools_of_trade: { amount: 8725, statute: 'CCP § 704.060' },
      retirement: { amount: null, statute: 'CCP § 704.115' },
      bank_accounts: { amount: 500, statute: 'CCP § 704.080' },
    },
    system2: {
      name: 'California System 2 (CCP § 703)',
      homestead: { amount: 29275, statute: 'CCP § 703.140(b)(1)' },
      motor_vehicle: { amount: 5850, statute: 'CCP § 703.140(b)(2)' },
      household_goods: { amount: 14600, statute: 'CCP § 703.140(b)(3)' },
      jewelry: { amount: 1750, statute: 'CCP § 703.140(b)(4)' },
      wildcard: { amount: 1550, bonus: 14600, statute: 'CCP § 703.140(b)(5)' },
      tools_of_trade: { amount: 2925, statute: 'CCP § 703.140(b)(6)' },
      retirement: { amount: null, statute: 'CCP § 703.140(b)(10)' },
      bank_accounts: { amount: 0, statute: '' },
    }
  },
  FL: {
    allows_federal: false,
    homestead: { amount: 999999, statute: 'Art. X § 4, FL Const.' },
    motor_vehicle: { amount: 1000, statute: 'Fla. Stat. § 222.25(1)' },
    household_goods: { amount: 1000, statute: 'Art. X § 4(a)(2)' },
    jewelry: { amount: 0, statute: '' },
    wildcard: { amount: 4000, bonus: 0, statute: 'Fla. Stat. § 222.25(4)' },
    tools_of_trade: { amount: 0, statute: '' },
    retirement: { amount: null, statute: 'Fla. Stat. § 222.21' },
    bank_accounts: { amount: 0, statute: '' },
  },
  TX: {
    allows_federal: false,
    homestead: { amount: 999999, statute: 'Tex. Prop. Code § 41.001' },
    motor_vehicle: { amount: 999999, statute: 'Tex. Prop. Code § 42.002(a)(9)' },
    household_goods: { amount: 50000, statute: 'Tex. Prop. Code § 42.001' },
    jewelry: { amount: 50000, statute: 'Tex. Prop. Code § 42.001' },
    wildcard: { amount: 0, bonus: 0, statute: '' },
    tools_of_trade: { amount: 50000, statute: 'Tex. Prop. Code § 42.001' },
    retirement: { amount: null, statute: 'Tex. Prop. Code § 42.0021' },
    bank_accounts: { amount: 0, statute: '' },
  },
  OH: {
    allows_federal: false,
    homestead: { amount: 136925, statute: 'Ohio Rev. Code § 2329.66(A)(1)' },
    motor_vehicle: { amount: 4450, statute: 'Ohio Rev. Code § 2329.66(A)(2)' },
    household_goods: { amount: 14875, statute: 'Ohio Rev. Code § 2329.66(A)(3)' },
    jewelry: { amount: 1875, statute: 'Ohio Rev. Code § 2329.66(A)(4)' },
    wildcard: { amount: 1475, bonus: 13950, statute: 'Ohio Rev. Code § 2329.66(A)(18)' },
    tools_of_trade: { amount: 2800, statute: 'Ohio Rev. Code § 2329.66(A)(5)' },
    retirement: { amount: null, statute: 'Ohio Rev. Code § 2329.66(A)(10)' },
    bank_accounts: { amount: 500, statute: 'Ohio Rev. Code § 2329.66(A)(3)' },
  },
  IL: {
    allows_federal: false,
    homestead: { amount: 15000, statute: '735 ILCS 5/12-901' },
    motor_vehicle: { amount: 2400, statute: '735 ILCS 5/12-1001(c)' },
    household_goods: { amount: 4000, statute: '735 ILCS 5/12-1001(b)' },
    jewelry: { amount: 0, statute: '' },
    wildcard: { amount: 4000, bonus: 0, statute: '735 ILCS 5/12-1001(b)' },
    tools_of_trade: { amount: 1500, statute: '735 ILCS 5/12-1001(d)' },
    retirement: { amount: null, statute: '735 ILCS 5/12-1006' },
    bank_accounts: { amount: 0, statute: '' },
  },
  GA: {
    allows_federal: false,
    homestead: { amount: 21500, statute: 'O.C.G.A. § 44-13-100(a)(1)' },
    motor_vehicle: { amount: 5000, statute: 'O.C.G.A. § 44-13-100(a)(3)' },
    household_goods: { amount: 5000, statute: 'O.C.G.A. § 44-13-100(a)(4)' },
    jewelry: { amount: 500, statute: 'O.C.G.A. § 44-13-100(a)(5)' },
    wildcard: { amount: 1200, bonus: 10000, statute: 'O.C.G.A. § 44-13-100(a)(6)' },
    tools_of_trade: { amount: 1500, statute: 'O.C.G.A. § 44-13-100(a)(7)' },
    retirement: { amount: null, statute: 'O.C.G.A. § 44-13-100(a)(2.1)' },
    bank_accounts: { amount: 0, statute: '' },
  },
  MI: {
    allows_federal: true,
    homestead: { amount: 40475, statute: 'MCL § 600.5451(1)(n)' },
    motor_vehicle: { amount: 3725, statute: 'MCL § 600.5451(1)(e)' },
    household_goods: { amount: 1000, statute: 'MCL § 600.5451(1)(a)' },
    jewelry: { amount: 0, statute: '' },
    wildcard: { amount: 1000, bonus: 0, statute: 'MCL § 600.5451(1)(o)' },
    tools_of_trade: { amount: 2500, statute: 'MCL § 600.5451(1)(d)' },
    retirement: { amount: null, statute: 'MCL § 600.5451(1)(k)' },
    bank_accounts: { amount: 0, statute: '' },
  },
  AZ: {
    allows_federal: false,
    homestead: { amount: 400000, statute: 'A.R.S. § 33-1101' },
    motor_vehicle: { amount: 6000, statute: 'A.R.S. § 33-1125(8)' },
    household_goods: { amount: 15000, statute: 'A.R.S. § 33-1123' },
    jewelry: { amount: 2000, statute: 'A.R.S. § 33-1125(4)' },
    wildcard: { amount: 0, bonus: 0, statute: '' },
    tools_of_trade: { amount: 5000, statute: 'A.R.S. § 33-1130' },
    retirement: { amount: null, statute: 'A.R.S. § 33-1126(B)' },
    bank_accounts: { amount: 300, statute: 'A.R.S. § 33-1126(A)(9)' },
  },
  NY: {
    allows_federal: false,
    homestead: { amount: 170825, statute: 'CPLR § 5206' },
    motor_vehicle: { amount: 4550, statute: 'CPLR § 5205(a)(8)' },
    household_goods: { amount: 11975, statute: 'CPLR § 5205(a)(5)' },
    jewelry: { amount: 1175, statute: 'CPLR § 5205(a)(6)' },
    wildcard: { amount: 1175, bonus: 0, statute: 'CPLR § 5205(a)(9)' },
    tools_of_trade: { amount: 3600, statute: 'CPLR § 5205(a)(7)' },
    retirement: { amount: null, statute: 'CPLR § 5205(c)' },
    bank_accounts: { amount: 3000, statute: 'CPLR § 5205(d)(2)' },
  },
  NC: {
    allows_federal: false,
    homestead: { amount: 35000, statute: 'N.C.G.S. § 1C-1601(a)(1)' },
    motor_vehicle: { amount: 3500, statute: 'N.C.G.S. § 1C-1601(a)(2)' },
    household_goods: { amount: 5000, statute: 'N.C.G.S. § 1C-1601(a)(4)' },
    jewelry: { amount: 0, statute: '' },
    wildcard: { amount: 5000, bonus: 0, statute: 'N.C.G.S. § 1C-1601(a)(2)' },
    tools_of_trade: { amount: 2000, statute: 'N.C.G.S. § 1C-1601(a)(5)' },
    retirement: { amount: null, statute: 'N.C.G.S. § 1C-1601(a)(9)' },
    bank_accounts: { amount: 0, statute: '' },
  },
}

interface Asset {
  type: string;
  description: string;
  value: number;
}

interface LineItem {
  asset_type: string;
  asset_description: string;
  asset_value: number;
  exemption_system: string;
  exemption_name: string;
  exemption_statute: string;
  exemption_amount: number;
  protected_amount: number;
  exposed_amount: number;
  status: string;
}

function analyzeWithSystem(assets: Asset[], system: any, systemLabel: string): { items: LineItem[]; total_protected: number; total_exposed: number } {
  const items: LineItem[] = [];
  let total_protected = 0;
  let total_exposed = 0;
  let usedHomestead = 0;

  for (const asset of assets) {
    const key = asset.type;
    const exemption = system[key];

    if (!exemption || (!exemption.amount && exemption.amount !== 0)) {
      // Retirement / unlimited
      if (key === 'retirement') {
        items.push({
          asset_type: key,
          asset_description: asset.description,
          asset_value: asset.value,
          exemption_system: systemLabel,
          exemption_name: exemption?.name || 'Retirement Accounts',
          exemption_statute: exemption?.statute || '',
          exemption_amount: asset.value,
          protected_amount: asset.value,
          exposed_amount: 0,
          status: 'fully_protected',
        });
        total_protected += asset.value;
        continue;
      }
      // Unknown exemption for this asset type
      items.push({
        asset_type: key,
        asset_description: asset.description,
        asset_value: asset.value,
        exemption_system: systemLabel,
        exemption_name: 'No specific exemption',
        exemption_statute: '',
        exemption_amount: 0,
        protected_amount: 0,
        exposed_amount: asset.value,
        status: asset.value > 0 ? 'unprotected' : 'unknown',
      });
      total_exposed += asset.value;
      continue;
    }

    const exemptionLimit = exemption.amount >= 999999 ? asset.value : exemption.amount;
    const protectedAmt = Math.min(asset.value, exemptionLimit);
    const exposedAmt = Math.max(0, asset.value - exemptionLimit);

    if (key === 'homestead') {
      usedHomestead = protectedAmt;
    }

    items.push({
      asset_type: key,
      asset_description: asset.description,
      asset_value: asset.value,
      exemption_system: systemLabel,
      exemption_name: exemption.name || key,
      exemption_statute: exemption.statute || '',
      exemption_amount: exemptionLimit,
      protected_amount: protectedAmt,
      exposed_amount: exposedAmt,
      status: exposedAmt === 0 ? 'fully_protected' : (protectedAmt > 0 ? 'partially_protected' : 'unprotected'),
    });
    total_protected += protectedAmt;
    total_exposed += exposedAmt;
  }

  // Apply wildcard to remaining exposed assets
  const wildcard = system.wildcard;
  if (wildcard && (wildcard.amount > 0 || (wildcard.bonus && wildcard.bonus > 0))) {
    const homesteadLimit = system.homestead?.amount >= 999999 ? 999999 : (system.homestead?.amount || 0);
    const unusedHomestead = Math.max(0, homesteadLimit - usedHomestead);
    const wildcardTotal = (wildcard.amount || 0) + Math.min(unusedHomestead, wildcard.bonus || 0);

    let remaining = wildcardTotal;
    for (const item of items) {
      if (remaining <= 0) break;
      if (item.exposed_amount > 0) {
        const cover = Math.min(item.exposed_amount, remaining);
        item.protected_amount += cover;
        item.exposed_amount -= cover;
        total_protected += cover;
        total_exposed -= cover;
        remaining -= cover;
        item.status = item.exposed_amount === 0 ? 'fully_protected' : 'partially_protected';
      }
    }
  }

  return { items, total_protected, total_exposed };
}

const getField = (data: any[], key: string): string =>
  data?.find((d: any) => d.field_key === key)?.field_value ?? '0';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { case_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch case + client info
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('*, client_info(*)')
      .eq('id', case_id)
      .single();

    if (caseError || !caseData) {
      return new Response(JSON.stringify({ error: 'Case not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine client state from district or extracted data
    const { data: extractedData } = await supabase
      .from('case_extracted_data')
      .select('*')
      .eq('case_id', case_id);

    const stateFromDistrict = caseData.district?.split(' ')[0]?.toUpperCase() || '';
    const stateFromExtracted = getField(extractedData || [], 'client_state')?.toUpperCase() || '';
    const clientState = stateFromExtracted && stateFromExtracted !== '0' ? stateFromExtracted : (stateFromDistrict || 'OH');

    // Build asset list from extracted data
    const propValue = parseFloat(getField(extractedData || [], 'mortgage_property_value')) || 0;
    const mortBalance = parseFloat(getField(extractedData || [], 'mortgage_balance')) || 0;
    const homeEquity = Math.max(0, propValue - mortBalance);

    const vehicle1Value = parseFloat(getField(extractedData || [], 'vehicle_value')) || 0;
    const vehicle2Value = parseFloat(getField(extractedData || [], 'vehicle_2_value')) || 0;
    const bankBalance = parseFloat(getField(extractedData || [], 'bank_balance')) || 0;
    const retirementBalance = parseFloat(getField(extractedData || [], 'retirement_1_balance')) || 0;
    const jewelryValue = parseFloat(getField(extractedData || [], 'jewelry_value')) || 0;
    const toolsValue = parseFloat(getField(extractedData || [], 'tools_value')) || 0;
    const householdValue = parseFloat(getField(extractedData || [], 'household_goods_value')) || 0;

    const assets: Asset[] = [
      { type: 'homestead', description: 'Primary Residence Equity', value: homeEquity },
      { type: 'motor_vehicle', description: 'Vehicle 1', value: vehicle1Value },
      ...(vehicle2Value > 0 ? [{ type: 'motor_vehicle', description: 'Vehicle 2', value: vehicle2Value }] : []),
      { type: 'bank_accounts', description: 'Bank Accounts', value: bankBalance },
      { type: 'retirement', description: 'Retirement Accounts', value: retirementBalance },
      { type: 'jewelry', description: 'Jewelry', value: jewelryValue },
      { type: 'tools_of_trade', description: 'Tools of the Trade', value: toolsValue },
      { type: 'household_goods', description: 'Household Goods & Furnishings', value: householdValue },
    ];

    const totalAssets = assets.reduce((s, a) => s + a.value, 0);

    const stateInfo = STATE_DATA[clientState];
    if (!stateInfo) {
      return new Response(JSON.stringify({ error: `State ${clientState} not supported` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let recommended: string;
    let federalResult = { items: [] as LineItem[], total_protected: 0, total_exposed: 0 };
    let stateResult = { items: [] as LineItem[], total_protected: 0, total_exposed: 0 };
    let state2Result = { items: [] as LineItem[], total_protected: 0, total_exposed: 0 };
    let selectedItems: LineItem[];

    if (stateInfo.has_two_systems) {
      // California — compare System 1 vs System 2
      stateResult = analyzeWithSystem(assets, stateInfo.system1, 'state_system1');
      state2Result = analyzeWithSystem(assets, stateInfo.system2, 'state_system2');
      recommended = stateResult.total_protected >= state2Result.total_protected ? 'state_system1' : 'state_system2';
      selectedItems = recommended === 'state_system1' ? stateResult.items : state2Result.items;
    } else if (stateInfo.allows_federal) {
      // Compare state vs federal
      stateResult = analyzeWithSystem(assets, stateInfo, 'state');
      federalResult = analyzeWithSystem(assets, FEDERAL, 'federal');
      recommended = stateResult.total_protected >= federalResult.total_protected ? 'state' : 'federal';
      selectedItems = recommended === 'state' ? stateResult.items : federalResult.items;
    } else {
      // State only
      stateResult = analyzeWithSystem(assets, stateInfo, 'state');
      recommended = 'state';
      selectedItems = stateResult.items;
    }

    const bestProtected = recommended === 'federal' ? federalResult.total_protected :
      recommended === 'state_system2' ? state2Result.total_protected : stateResult.total_protected;
    const bestExposed = recommended === 'federal' ? federalResult.total_exposed :
      recommended === 'state_system2' ? state2Result.total_exposed : stateResult.total_exposed;

    // Build analysis notes
    let notes = '';
    if (stateInfo.has_two_systems) {
      notes = `${clientState} has two exemption systems. System 1 protects $${stateResult.total_protected.toLocaleString()}, System 2 protects $${state2Result.total_protected.toLocaleString()}. Recommended: ${recommended === 'state_system1' ? 'System 1' : 'System 2'}.`;
    } else if (stateInfo.allows_federal) {
      notes = `${clientState} allows federal exemption election. State protects $${stateResult.total_protected.toLocaleString()}, Federal protects $${federalResult.total_protected.toLocaleString()}. Recommended: ${recommended}.`;
    } else {
      notes = `${clientState} does not allow federal exemption election. State exemptions protect $${stateResult.total_protected.toLocaleString()} of $${totalAssets.toLocaleString()} in total assets.`;
    }

    // Upsert analysis
    const { data: analysis, error: upsertError } = await supabase
      .from('exemption_analyses')
      .upsert({
        case_id,
        client_state: clientState,
        recommended_system: recommended,
        federal_total_protected: federalResult.total_protected,
        state_total_protected: stateInfo.has_two_systems
          ? Math.max(stateResult.total_protected, state2Result.total_protected)
          : stateResult.total_protected,
        total_assets: totalAssets,
        total_exposed: bestExposed,
        analysis_notes: notes,
        attorney_approved: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'case_id' })
      .select()
      .single();

    if (upsertError || !analysis) {
      return new Response(JSON.stringify({ error: 'Failed to save analysis', details: upsertError }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Delete old line items and insert new
    await supabase.from('exemption_line_items').delete().eq('analysis_id', analysis.id);

    // Insert items for ALL systems analyzed (for comparison UI)
    const allItems: any[] = [];
    if (stateInfo.has_two_systems) {
      allItems.push(...stateResult.items.map(i => ({ ...i, analysis_id: analysis.id, exemption_system: 'state_system1' })));
      allItems.push(...state2Result.items.map(i => ({ ...i, analysis_id: analysis.id, exemption_system: 'state_system2' })));
    } else {
      allItems.push(...stateResult.items.map(i => ({ ...i, analysis_id: analysis.id })));
      if (stateInfo.allows_federal) {
        allItems.push(...federalResult.items.map(i => ({ ...i, analysis_id: analysis.id })));
      }
    }

    if (allItems.length > 0) {
      await supabase.from('exemption_line_items').insert(allItems);
    }

    // Log activity
    await supabase.from('activity_log').insert({
      case_id,
      event_type: 'exemption_analysis_run',
      description: `Exemption analysis completed. Recommended: ${recommended}. Total protected: $${bestProtected.toLocaleString()}. Total exposed: $${bestExposed.toLocaleString()}.`,
      actor_role: 'system',
    });

    return new Response(JSON.stringify({
      success: true,
      analysis_id: analysis.id,
      recommended,
      federal_allowed: stateInfo.allows_federal || false,
      has_two_systems: stateInfo.has_two_systems || false,
      federal_protected: federalResult.total_protected,
      state_protected: stateResult.total_protected,
      state2_protected: state2Result.total_protected,
      total_exposed: bestExposed,
      total_assets: totalAssets,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
