const KEYS = {
  fixedCosts: 'agnipeak_fixed_costs_v1',
  machineCapacity: 'agnipeak_machine_capacity_v1',
  products: 'agnipeak_products_v1',
  companyInfo: 'agnipeak_company_info_v1',
}

export const DEFAULT_FIXED_COSTS = {
  electricity: 350000,
  rent: 140000,
  operatorSalary: 204000,
  labour: 120000,
  misc: 100000,
  otherFixed: 0,
}

export const DEFAULT_MACHINE_CAPACITY = {
  workingDays: 26,
  avgMachinesPerDay: 22,
  avgHoursPerMachine: 23,
}

export const DEFAULT_COMPANY_INFO = {
  name: 'Vinayak AgniPeak LLP',
  subtitle: 'Daily Product Body Costing',
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

export const storage = {
  getFixedCosts: () => load(KEYS.fixedCosts, DEFAULT_FIXED_COSTS),
  setFixedCosts: (v) => save(KEYS.fixedCosts, v),

  getMachineCapacity: () => load(KEYS.machineCapacity, DEFAULT_MACHINE_CAPACITY),
  setMachineCapacity: (v) => save(KEYS.machineCapacity, v),

  getProducts: () => load(KEYS.products, []),
  setProducts: (v) => save(KEYS.products, v),

  getCompanyInfo: () => load(KEYS.companyInfo, DEFAULT_COMPANY_INFO),
  setCompanyInfo: (v) => save(KEYS.companyInfo, v),
}
