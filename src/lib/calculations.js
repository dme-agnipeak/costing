// AgniPeak costing engine.
//
// Mirrors the original AgniPeak Excel costing sheet, cell by cell. The same engine
// powers both the Moulding and the Welding modules (each module keeps its own
// fixed costs, machine setup and product list).
//
//   FIXED COST SETUP
//     Total Monthly Fixed Cost      = Electricity + Rent + Operator Salary + Labour + Misc + Other
//     Fixed Cost / Machine (Month)  = Total Monthly Fixed Cost / Number of Machines
//     Fixed Cost / Machine / Day    = Fixed Cost / Machine (Month) / Working Days
//
//   PER PRODUCT
//     Rate / Gram          = Rate per KG / 1000
//     Material Amount      = Rate / Gram x Weight per Unit (g)        (before GST)
//     GST Amount           = Material Amount x GST %
//     Material incl. GST   = Material Amount + GST Amount
//     Fixed Cost / Unit    = Fixed Cost / Machine / Day / Avg Production per Machine per Day
//     FINAL COST / UNIT    = Fixed Cost / Unit + Material incl. GST + Additional Cost / Unit
//     GST Price            = GST Amount + Fixed Cost / Unit                (as in the sheet)
//     Without GST Price    = Fixed Cost / Unit + Material Amount + Additional Cost / Unit
//     Profit / Unit        = Selling Price - Final Cost / Unit
//     Margin %             = Profit / Unit / Selling Price x 100
//     Profit / Machine / Day   = Profit / Unit x Avg Production
//     Profit / Machine / Month = Profit / Machine / Day x Working Days
//
// "Additional Cost / Unit" is optional (blank = 0), so results are identical to the
// original sheet when it is not used.

export function num(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const FIXED_COST_FIELDS = [
  { key: 'electricity', label: 'Electricity Cost' },
  { key: 'rent', label: 'Factory Rent' },
  { key: 'operatorSalary', label: 'Operator Salary' },
  { key: 'labour', label: 'Labour Cost' },
  { key: 'misc', label: 'Miscellaneous (MSC)' },
  { key: 'otherFixed', label: 'Other Fixed Cost' },
]

export function computeTotalFixedCost(fixedCosts = {}) {
  return FIXED_COST_FIELDS.reduce((sum, f) => sum + num(fixedCosts[f.key]), 0)
}

export function computeFixedCostPerMachine(fixedCosts = {}, machine = {}) {
  const machines = num(machine.numberOfMachines)
  if (machines <= 0) return 0
  return computeTotalFixedCost(fixedCosts) / machines
}

export function computeFixedCostPerMachinePerDay(fixedCosts = {}, machine = {}) {
  const days = num(machine.workingDays)
  if (days <= 0) return 0
  return computeFixedCostPerMachine(fixedCosts, machine) / days
}

export function hasValue(v) {
  return v !== '' && v !== null && v !== undefined && Number.isFinite(parseFloat(v))
}

// Computes every derived figure for one product.
export function computeProduct(product = {}, fixedCostPerMachinePerDay = 0, workingDays = 0) {
  const ratePerKg = num(product.ratePerKg)
  const rawQtyKg = num(product.rawQtyKg)
  const gstPercent = num(product.gstPercent)
  const weightGram = num(product.bodyWeightGram)
  const sellingPrice = num(product.sellingPrice)
  const avgProduction = num(product.avgProduction)
  const additionalCost = num(product.additionalCost)

  const rawQtyGram = rawQtyKg * 1000
  const ratePerGram = ratePerKg / 1000
  const materialAmountPerBody = ratePerGram * weightGram
  const gstAmount = materialAmountPerBody * (gstPercent / 100)
  const materialTotalInclGst = materialAmountPerBody + gstAmount

  const fixedCostPerBody = avgProduction > 0 ? num(fixedCostPerMachinePerDay) / avgProduction : 0
  const autoFinalCostPerBody = fixedCostPerBody + materialTotalInclGst + additionalCost

  const hasOverride = hasValue(product.finalCostOverride)
  const finalCostPerBody = hasOverride ? num(product.finalCostOverride) : autoFinalCostPerBody

  const gstPriceDisplay = gstAmount + fixedCostPerBody
  const withoutGstPrice = fixedCostPerBody + materialAmountPerBody + additionalCost

  const hasSellingPrice = sellingPrice > 0
  const profitPerBody = hasSellingPrice ? sellingPrice - finalCostPerBody : 0
  const marginPercent = hasSellingPrice ? (profitPerBody / sellingPrice) * 100 : 0
  const profitPerMachinePerDay = hasSellingPrice ? profitPerBody * avgProduction : 0
  const profitPerMachinePerMonth = profitPerMachinePerDay * num(workingDays)
  // Raw material stock (Raw Qty) is enough for this many units
  const unitsFromRawQty = weightGram > 0 && rawQtyGram > 0 ? Math.floor(rawQtyGram / weightGram) : 0

  return {
    rawQtyGram,
    ratePerGram,
    materialAmountPerBody,
    gstAmount,
    materialTotalInclGst,
    fixedCostPerBody,
    additionalCost,
    autoFinalCostPerBody,
    hasOverride,
    finalCostPerBody,
    gstPriceDisplay,
    withoutGstPrice,
    sellingPrice,
    hasSellingPrice,
    profitPerBody,
    marginPercent,
    profitPerMachinePerDay,
    profitPerMachinePerMonth,
    unitsFromRawQty,
  }
}

// Full module summary used by screens, PDF, history and the AI assistant.
export function computeModule(mod = {}) {
  const fixedCosts = mod.fixedCosts || {}
  const machine = mod.machine || {}
  const totalFixed = computeTotalFixedCost(fixedCosts)
  const perMachine = computeFixedCostPerMachine(fixedCosts, machine)
  const perMachinePerDay = computeFixedCostPerMachinePerDay(fixedCosts, machine)
  const workingDays = num(machine.workingDays)
  const rows = (mod.products || []).map((p) => ({ product: p, calc: computeProduct(p, perMachinePerDay, workingDays) }))
  const priced = rows.filter((r) => r.calc.hasSellingPrice)
  const avgMargin = priced.length ? priced.reduce((s, r) => s + r.calc.marginPercent, 0) / priced.length : 0
  const avgFinalCost = rows.length ? rows.reduce((s, r) => s + r.calc.finalCostPerBody, 0) / rows.length : 0
  const lossMaking = priced.filter((r) => r.calc.profitPerBody < 0).length
  return { totalFixed, perMachine, perMachinePerDay, workingDays, rows, avgMargin, avgFinalCost, pricedCount: priced.length, lossMaking }
}

export function round(n, d = 2) {
  const f = 10 ** d
  return Math.round(num(n) * f) / f
}

export function currency(n) {
  return '₹' + num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// PDF-safe currency (standard PDF fonts cannot render the ₹ glyph)
export function rs(n) {
  const v = num(n)
  const s = Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (v < 0 ? '-Rs. ' : 'Rs. ') + s
}

export function num2(n, digits = 2) {
  return num(n).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
