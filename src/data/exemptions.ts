// ─── Bankruptcy Exemption Data ──────────────────────────────────────────
// Amounts reflect April 2025 figures. Verify current amounts before filing.

export interface ExemptionEntry {
  amount: number | null;
  note: string;
  aggregate?: number;
  unused_homestead_bonus?: number;
  cash_value?: number;
  ira_cap?: number;
}

export interface StateExemptionSystem {
  name: string;
  homestead?: ExemptionEntry;
  motor_vehicle?: ExemptionEntry;
  household_goods?: ExemptionEntry;
  jewelry?: ExemptionEntry;
  wildcard?: ExemptionEntry;
  tools_of_trade?: ExemptionEntry;
  retirement?: ExemptionEntry;
  life_insurance?: ExemptionEntry;
  wages?: ExemptionEntry;
  bank_accounts?: ExemptionEntry;
  cash?: ExemptionEntry;
  personal_property?: ExemptionEntry;
  college_savings?: ExemptionEntry;
}

export interface StateExemptions {
  name: string;
  allows_federal_election: boolean;
  has_two_systems?: boolean;
  note?: string;
  system1?: StateExemptionSystem;
  system2?: StateExemptionSystem;
  homestead?: ExemptionEntry;
  motor_vehicle?: ExemptionEntry;
  household_goods?: ExemptionEntry;
  jewelry?: ExemptionEntry;
  wildcard?: ExemptionEntry;
  tools_of_trade?: ExemptionEntry;
  retirement?: ExemptionEntry;
  life_insurance?: ExemptionEntry;
  wages?: ExemptionEntry;
  bank_accounts?: ExemptionEntry;
  cash?: ExemptionEntry;
  personal_property?: ExemptionEntry;
  college_savings?: ExemptionEntry;
}

export const FEDERAL_EXEMPTIONS = {
  homestead: {
    name: "Homestead Exemption",
    statute: "11 U.S.C. § 522(d)(1)",
    amount: 27900,
    description: "Primary residence equity"
  },
  motor_vehicle: {
    name: "Motor Vehicle Exemption",
    statute: "11 U.S.C. § 522(d)(2)",
    amount: 4450,
    description: "One motor vehicle"
  },
  household_goods: {
    name: "Household Goods & Furnishings",
    statute: "11 U.S.C. § 522(d)(3)",
    amount: 700,
    aggregate: 14875,
    description: "Household goods, furnishings, clothing, appliances"
  },
  jewelry: {
    name: "Jewelry Exemption",
    statute: "11 U.S.C. § 522(d)(4)",
    amount: 1875,
    description: "Jewelry held primarily for personal use"
  },
  wildcard: {
    name: "Wildcard Exemption",
    statute: "11 U.S.C. § 522(d)(5)",
    amount: 1475,
    unused_homestead_bonus: 13950,
    description: "Any property — plus unused homestead exemption up to $13,950"
  },
  tools_of_trade: {
    name: "Tools of the Trade",
    statute: "11 U.S.C. § 522(d)(6)",
    amount: 2800,
    description: "Tools, implements, books used in trade or profession"
  },
  life_insurance: {
    name: "Life Insurance",
    statute: "11 U.S.C. § 522(d)(7)(8)",
    amount: null as number | null,
    cash_value: 14875,
    description: "Unmatured life insurance contract; cash value up to $14,875"
  },
  retirement: {
    name: "Retirement Accounts",
    statute: "11 U.S.C. § 522(d)(10)(E) + § 522(n)",
    amount: null as number | null,
    ira_cap: 1512350,
    description: "401k, 403b, pension — unlimited. IRA/Roth IRA — up to $1,512,350"
  },
  health_aids: {
    name: "Professionally Prescribed Health Aids",
    statute: "11 U.S.C. § 522(d)(9)",
    amount: null as number | null,
    description: "Unlimited"
  },
  social_security: {
    name: "Social Security & Public Benefits",
    statute: "11 U.S.C. § 522(d)(10)",
    amount: null as number | null,
    description: "Social Security, unemployment, disability, alimony, support"
  }
};

export const STATE_EXEMPTIONS: Record<string, StateExemptions> = {
  CA: {
    name: "California",
    allows_federal_election: false,
    has_two_systems: true,
    note: "California does not allow federal exemptions. Choose System 1 or System 2.",
    system1: {
      name: "California System 1 (CCP § 704)",
      homestead: { amount: 300000, note: "Primary residence. Up to $600,000 in high-cost counties. CCP § 704.730" },
      motor_vehicle: { amount: 3325, note: "CCP § 704.010" },
      household_goods: { amount: null, note: "Ordinary household furnishings — unlimited if ordinary. CCP § 704.020" },
      retirement: { amount: null, note: "Public retirement unlimited. Private retirement reasonably necessary. CCP § 704.115" },
      wildcard: { amount: 0, note: "No wildcard in System 1" },
      tools_of_trade: { amount: 8725, note: "CCP § 704.060" },
      jewelry: { amount: 8725, note: "Heirlooms and art. CCP § 704.040" },
      bank_accounts: { amount: 500, note: "CCP § 704.080" }
    },
    system2: {
      name: "California System 2 (CCP § 703)",
      homestead: { amount: 29275, note: "CCP § 703.140(b)(1)" },
      motor_vehicle: { amount: 5850, note: "CCP § 703.140(b)(2)" },
      household_goods: { amount: 700, aggregate: 14600, note: "CCP § 703.140(b)(3)" },
      jewelry: { amount: 1750, note: "CCP § 703.140(b)(4)" },
      wildcard: { amount: 1550, unused_homestead_bonus: 14600, note: "CCP § 703.140(b)(5)" },
      tools_of_trade: { amount: 2925, note: "CCP § 703.140(b)(6)" },
      retirement: { amount: null, note: "Unlimited qualified plans. IRA up to $1,512,350. CCP § 703.140(b)(10)" }
    }
  },
  FL: {
    name: "Florida",
    allows_federal_election: false,
    homestead: { amount: null, note: "UNLIMITED for property up to 0.5 acres in municipality, 160 acres rural. Art. X § 4, FL Const." },
    motor_vehicle: { amount: 1000, note: "Fla. Stat. § 222.25(1)" },
    personal_property: { amount: 1000, note: "Art. X § 4(a)(2), FL Const. — OR up to $4,000 if no homestead claimed" },
    wildcard: { amount: 4000, note: "Only if homestead exemption NOT claimed. Fla. Stat. § 222.25(4)" },
    retirement: { amount: null, note: "Unlimited — IRAs, 401k, pension, profit sharing. Fla. Stat. § 222.21" },
    wages: { amount: null, note: "Head of family — unlimited disposable income exemption. Fla. Stat. § 222.11" },
    life_insurance: { amount: null, note: "Cash surrender value unlimited. Fla. Stat. § 222.14" },
    note: "Florida has extremely strong homestead and retirement protections. Wildcard only available if homestead not claimed."
  },
  TX: {
    name: "Texas",
    allows_federal_election: false,
    homestead: { amount: null, note: "UNLIMITED urban (up to 10 acres), rural (up to 100 acres single, 200 acres family). Tex. Prop. Code § 41.001" },
    motor_vehicle: { amount: null, note: "One vehicle per licensed household member — unlimited value. Tex. Prop. Code § 42.002(a)(9)" },
    personal_property: { amount: 50000, note: "$50,000 single, $100,000 family. Tex. Prop. Code § 42.001" },
    retirement: { amount: null, note: "Unlimited — all qualified retirement plans. Tex. Prop. Code § 42.0021" },
    wages: { amount: null, note: "Current wages for personal services exempt. Tex. Prop. Code § 42.001(b)(1)" },
    wildcard: { amount: 0, note: "No specific wildcard — personal property allowance serves this function" },
    note: "Texas has some of the strongest exemptions in the country. Homestead and vehicle are essentially unlimited."
  },
  OH: {
    name: "Ohio",
    allows_federal_election: false,
    homestead: { amount: 136925, note: "Ohio Rev. Code § 2329.66(A)(1)" },
    motor_vehicle: { amount: 4450, note: "Ohio Rev. Code § 2329.66(A)(2)" },
    household_goods: { amount: 14875, note: "Aggregate. Ohio Rev. Code § 2329.66(A)(3)" },
    jewelry: { amount: 1875, note: "Ohio Rev. Code § 2329.66(A)(4)" },
    wildcard: { amount: 1475, unused_homestead_bonus: 13950, note: "Plus up to $13,950 of unused homestead. Ohio Rev. Code § 2329.66(A)(18)" },
    tools_of_trade: { amount: 2800, note: "Ohio Rev. Code § 2329.66(A)(5)" },
    retirement: { amount: null, note: "Unlimited qualified plans. IRA up to $1,512,350. Ohio Rev. Code § 2329.66(A)(10)" },
    cash: { amount: 500, note: "Ohio Rev. Code § 2329.66(A)(3)" },
    note: "Ohio follows federal exemption amounts closely but does not allow federal election."
  },
  IL: {
    name: "Illinois",
    allows_federal_election: false,
    homestead: { amount: 15000, note: "735 ILCS 5/12-901" },
    motor_vehicle: { amount: 2400, note: "735 ILCS 5/12-1001(c)" },
    household_goods: { amount: 4000, note: "735 ILCS 5/12-1001(b)" },
    wildcard: { amount: 4000, note: "735 ILCS 5/12-1001(b) — personal property wildcard" },
    tools_of_trade: { amount: 1500, note: "735 ILCS 5/12-1001(d)" },
    retirement: { amount: null, note: "Unlimited qualified plans. 735 ILCS 5/12-1006" },
    wages: { amount: null, note: "85% of disposable wages or 45× federal minimum wage. 735 ILCS 5/12-803" },
    note: "Illinois has relatively low homestead exemption compared to other states."
  },
  GA: {
    name: "Georgia",
    allows_federal_election: false,
    homestead: { amount: 21500, note: "O.C.G.A. § 44-13-100(a)(1)" },
    motor_vehicle: { amount: 5000, note: "O.C.G.A. § 44-13-100(a)(3)" },
    household_goods: { amount: 5000, note: "Aggregate. O.C.G.A. § 44-13-100(a)(4)" },
    jewelry: { amount: 500, note: "O.C.G.A. § 44-13-100(a)(5)" },
    wildcard: { amount: 1200, unused_homestead_bonus: 10000, note: "O.C.G.A. § 44-13-100(a)(6)" },
    tools_of_trade: { amount: 1500, note: "O.C.G.A. § 44-13-100(a)(7)" },
    retirement: { amount: null, note: "Unlimited qualified plans. O.C.G.A. § 44-13-100(a)(2.1)" },
    note: "Georgia has moderate exemptions. Wildcard plus unused homestead can provide significant additional protection."
  },
  MI: {
    name: "Michigan",
    allows_federal_election: true,
    homestead: { amount: 40475, note: "MCL § 600.5451(1)(n)" },
    motor_vehicle: { amount: 3725, note: "MCL § 600.5451(1)(e)" },
    household_goods: { amount: 1000, note: "Per item up to $500. MCL § 600.5451(1)(a)" },
    wildcard: { amount: 1000, note: "MCL § 600.5451(1)(o)" },
    tools_of_trade: { amount: 2500, note: "MCL § 600.5451(1)(d)" },
    retirement: { amount: null, note: "Unlimited qualified plans. MCL § 600.5451(1)(k)" },
    note: "Michigan allows federal exemption election — always compare both systems for best result."
  },
  AZ: {
    name: "Arizona",
    allows_federal_election: false,
    homestead: { amount: 400000, note: "A.R.S. § 33-1101" },
    motor_vehicle: { amount: 6000, note: "A.R.S. § 33-1125(8)" },
    household_goods: { amount: 15000, note: "Aggregate. A.R.S. § 33-1123" },
    jewelry: { amount: 2000, note: "A.R.S. § 33-1125(4)" },
    wildcard: { amount: 0, note: "No wildcard in Arizona" },
    tools_of_trade: { amount: 5000, note: "A.R.S. § 33-1130" },
    retirement: { amount: null, note: "Unlimited qualified plans. A.R.S. § 33-1126(B)" },
    bank_accounts: { amount: 300, note: "A.R.S. § 33-1126(A)(9)" },
    note: "Arizona has a very strong homestead exemption at $400,000. No wildcard available."
  },
  NY: {
    name: "New York",
    allows_federal_election: false,
    homestead: { amount: 170825, note: "CPLR § 5206. Amount varies by county — up to $170,825 in NYC area." },
    motor_vehicle: { amount: 4550, note: "CPLR § 5205(a)(8)" },
    household_goods: { amount: 11975, note: "Aggregate. CPLR § 5205(a)(5)" },
    jewelry: { amount: 1175, note: "CPLR § 5205(a)(6)" },
    wildcard: { amount: 1175, note: "CPLR § 5205(a)(9)" },
    tools_of_trade: { amount: 3600, note: "CPLR § 5205(a)(7)" },
    retirement: { amount: null, note: "Unlimited qualified plans. CPLR § 5205(c)" },
    cash: { amount: 3000, note: "CPLR § 5205(d)(2)" },
    note: "New York homestead varies significantly by county. NYC/Long Island/Westchester up to $170,825."
  },
  NC: {
    name: "North Carolina",
    allows_federal_election: false,
    homestead: { amount: 35000, note: "N.C.G.S. § 1C-1601(a)(1). $60,000 if 65+ and married." },
    motor_vehicle: { amount: 3500, note: "N.C.G.S. § 1C-1601(a)(2)" },
    household_goods: { amount: 5000, note: "Aggregate. N.C.G.S. § 1C-1601(a)(4)" },
    wildcard: { amount: 5000, note: "N.C.G.S. § 1C-1601(a)(2) — unused homestead portion" },
    tools_of_trade: { amount: 2000, note: "N.C.G.S. § 1C-1601(a)(5)" },
    retirement: { amount: null, note: "Unlimited qualified plans. N.C.G.S. § 1C-1601(a)(9)" },
    college_savings: { amount: null, note: "Unlimited 529 plan contributions made 2+ years before filing. N.C.G.S. § 1C-1601(a)(10)" },
    note: "North Carolina has moderate exemptions. Strong retirement protection."
  }
};
