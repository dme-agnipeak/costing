// Core costing engine — mirrors the EXACT logic of the AgniPeak Excel costing sheet,
// cell-by-cell, as confirmed against the original sheet:
//
//   FIXED COST SETUP:
//     B11 = SUM(B5:B10)                    -> Total Monthly Fixed Cost
//     D   = B / Number of Machines          -> "Machine Wise" fixed cost
//     D11 = SUM(D5:D10) = B11 / Machines
//     H11 = D11 / Working Days              -> Fixed cost / machine / day
//
//   PER PRODUCT ROW:
//     F = E * 1000                          -> Raw Qty (Gram)
//     G = D / F * E  (= D / 1000)           -> Rate / Gram
//     I = G * C                             -> Amount (₹)  = material cost of ONE body (Body Weight × Rate/Gram)
//     J = I * GST%                          -> GST Amount
//     K = I + J                             -> Material Total incl. GST (₹) = material cost/body incl GST
//
//   FINAL CALCULATIONS (per product, using its own Avg Production):
//     J11 = H11 / Avg Production            -> Fixed Cost / Body
//     K11 = J11 + K15                       -> Cost Total Price  = FINAL COST / BODY
//     L11 = J15 + J11                       -> GST Price
//     M11 = J11 + I15                       -> Without GST Price
//     N11 = SellingPrice(L15) - K11         -> Final Profit

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? 0 : n
}

export function computeTotalFixedCost(fixedCosts) {
  const { electricity = 0, rent = 0, operatorSalary = 0, labour = 0, misc = 0, otherFixed = 0 } = fixedCosts
  return num(electricity) + num(rent) + num(operatorSalary) + num(labour) + num(misc) + num(otherFixed)
}

// "Machine Wise" — total fixed cost divided across the number of machines
export function computeFixedCostPerMachine(fixedCosts, machineSetup) {
  const total = computeTotalFixedCost(fixedCosts)
  const machines = num(machineSetup.numberOfMachines)
  if (!machines) return 0
  return total / machines
}

// Fixed cost per machine, per working day
export function computeFixedCostPerMachinePerDay(fixedCosts, machineSetup) {
  const perMachine = computeFixedCostPerMachine(fixedCosts, machineSetup)
  const days = num(machineSetup.workingDays)
  if (!days) return 0
  return perMachine / days
}

// Computes every derived field for a single product row — matches sheet columns exactly.
export function computeProduct(product, fixedCostPerMachinePerDay) {
  const ratePerKg = num(product.ratePerKg)
  const rawQtyKg = num(product.rawQtyKg)
  const gstPercent = num(product.gstPercent)
  const bodyWeightGram = num(product.bodyWeightGram)
  const sellingPrice = num(product.sellingPrice)
  const avgProduction = num(product.avgProduction)

  const rawQtyGram = rawQtyKg * 1000
  // G = D / F * E  → algebraically simplifies to D/1000, computed literally for transparency
  const ratePerGram = rawQtyGram > 0 ? (ratePerKg / rawQtyGram) * rawQtyKg : 0

  // I = G * C  -> material cost of ONE body (before GST)
  const materialAmountPerBody = ratePerGram * bodyWeightGram
  // J = I * GST%
  const gstAmount = materialAmountPerBody * (gstPercent / 100)
  // K = I + J -> material cost per body incl. GST
  const materialTotalInclGst = materialAmountPerBody + gstAmount

  // J11 = H11 / Avg Production
  const fixedCostPerBody = avgProduction > 0 ? fixedCostPerMachinePerDay / avgProduction : 0

  // K11 = J11 + K15 -> auto FINAL COST / BODY
  const autoFinalCostPerBody = fixedCostPerBody + materialTotalInclGst

  const hasOverride =
    product.finalCostOverride !== '' && product.finalCostOverride !== null && product.finalCostOverride !== undefined
  const finalCostPerBody = hasOverride ? num(product.finalCostOverride) : autoFinalCostPerBody

  // L11 = J15 + J11 -> "GST Price"
  const gstPriceDisplay = gstAmount + fixedCostPerBody
  // M11 = J11 + I15 -> "Without GST Price"
  const withoutGstPrice = fixedCostPerBody + materialAmountPerBody

  // N11 = SellingPrice - K11
  const profitPerBody = sellingPrice > 0 ? sellingPrice - finalCostPerBody : 0
  const marginPercent = sellingPrice > 0 ? (profitPerBody / sellingPrice) * 100 : 0

  return {
    rawQtyGram,
    ratePerGram,
    materialAmountPerBody,
    gstAmount,
    materialTotalInclGst,
    fixedCostPerBody,
    autoFinalCostPerBody,
    hasOverride,
    finalCostPerBody,
    gstPriceDisplay,
    withoutGstPrice,
    sellingPrice,
    profitPerBody,
    marginPercent,
  }
}

export function currency(n) {
  const v = num(n)
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function num2(n, digits = 2) {
  const v = num(n)
  return v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export { num }
