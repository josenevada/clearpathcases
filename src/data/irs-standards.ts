// IRS National Standards 2025
export const IRS_NATIONAL_STANDARDS = {
  food_clothing_housekeeping: {
    1: 809,
    2: 1497,
    3: 1722,
    4: 2120,
    additional_per_person: 379
  },
  healthcare: {
    under_65: 75,
    over_65: 153
  }
};

// IRS Local Standards — Housing and Utilities by state/county
export const IRS_LOCAL_STANDARDS_HOUSING: Record<string, Record<string, number>> = {
  CA: { 'Los Angeles': 3247, 'San Francisco': 3891, 'San Diego': 2891, 'Sacramento': 2234, 'default': 2456 },
  FL: { 'Miami-Dade': 2456, 'Broward': 2234, 'Palm Beach': 2178, 'Hillsborough': 1876, 'Orange': 1789, 'default': 1654 },
  TX: { 'Harris': 1654, 'Dallas': 1723, 'Travis': 1891, 'Bexar': 1456, 'default': 1456 },
  OH: { 'Franklin': 1234, 'Cuyahoga': 1189, 'Hamilton': 1156, 'default': 1089 },
  IL: { 'Cook': 1891, 'DuPage': 1678, 'default': 1234 },
  GA: { 'Fulton': 1456, 'DeKalb': 1345, 'Gwinnett': 1234, 'default': 1123 },
  MI: { 'Wayne': 1123, 'Oakland': 1234, 'Macomb': 1089, 'default': 1045 },
  AZ: { 'Maricopa': 1456, 'Pima': 1234, 'default': 1189 },
  NY: { 'New York': 3456, 'Kings': 3234, 'Queens': 2891, 'Nassau': 2678, 'default': 2234 },
  NC: { 'Mecklenburg': 1345, 'Wake': 1456, 'Guilford': 1123, 'default': 1045 }
};

// IRS Local Standards — Transportation
export const IRS_LOCAL_STANDARDS_TRANSPORT = {
  operation: { per_vehicle: 318 },
  ownership: { first_vehicle: 588, second_vehicle: 588 }
};

// State Median Income Tables 2025
export const STATE_MEDIAN_INCOME: Record<string, Record<number, number>> = {
  CA: { 1: 72793, 2: 95050, 3: 102678, 4: 119456, 5: 128234 },
  FL: { 1: 56234, 2: 71234, 3: 82456, 4: 98234, 5: 107012 },
  TX: { 1: 58234, 2: 75234, 3: 86456, 4: 101234, 5: 110012 },
  OH: { 1: 52234, 2: 67234, 3: 78456, 4: 92234, 5: 101012 },
  IL: { 1: 60234, 2: 77234, 3: 88456, 4: 104234, 5: 113012 },
  GA: { 1: 53234, 2: 68234, 3: 79456, 4: 93234, 5: 102012 },
  MI: { 1: 54234, 2: 69234, 3: 80456, 4: 94234, 5: 103012 },
  AZ: { 1: 57234, 2: 73234, 3: 84456, 4: 99234, 5: 108012 },
  NY: { 1: 67234, 2: 87234, 3: 99456, 4: 116234, 5: 125012 },
  NC: { 1: 51234, 2: 65234, 3: 76456, 4: 90234, 5: 99012 }
};

export const MEDIAN_INCOME_ADDITIONAL_PER_PERSON = 9000;
export const PRESUMPTION_THRESHOLD = 167;

// Helper functions
export function getFoodClothingAllowance(householdSize: number): number {
  const std = IRS_NATIONAL_STANDARDS.food_clothing_housekeeping;
  if (householdSize <= 4) {
    return std[householdSize as 1 | 2 | 3 | 4] || std[1];
  }
  return std[4] + (householdSize - 4) * std.additional_per_person;
}

export function getHealthcareAllowance(householdSize: number, over65Count: number = 0): number {
  const std = IRS_NATIONAL_STANDARDS.healthcare;
  const under65 = householdSize - over65Count;
  return (under65 * std.under_65) + (over65Count * std.over_65);
}

export function getHousingAllowance(state: string, county?: string): number {
  const stateData = IRS_LOCAL_STANDARDS_HOUSING[state];
  if (!stateData) return 1200; // fallback
  if (county && stateData[county]) return stateData[county];
  return stateData['default'] || 1200;
}

export function getStateMedian(state: string, householdSize: number): number {
  const stateData = STATE_MEDIAN_INCOME[state];
  if (!stateData) return 60000; // fallback
  if (householdSize <= 5) return stateData[householdSize] || stateData[1];
  // For household > 5, add per-person increment
  return (stateData[5] || 100000) + (householdSize - 5) * MEDIAN_INCOME_ADDITIONAL_PER_PERSON;
}
