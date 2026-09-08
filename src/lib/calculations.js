// Core costing engine — mirrors the logic of the AgniPeak Excel costing sheet.

export function computeTotalFixedCost(fixedCosts) {
  const { electricity = 0, rent = 0, operatorSalary = 0, labour = 0, misc = 0, otherFixed = 0 } = fixedCosts
  return num(electricity) + num(rent) + num(operatorSalary) + num(labour) + num(misc) + num(otherFixed)
}

export function computePlannedMachineHours(machineCapacity) {
  const { workingDays = 0, avgMachinesPerDay = 0, avgHoursPerMachine = 0 } = machineCapacity
  return num(workingDays) * num(avgMachinesPerDay) * num(avgHoursPerMachine)
}

export function computeFixedCostPerMachineHour(fixedCosts, machineCapacity) {
  const total = computeTotalFixedCost(fixedCosts)
  const hours = computePlannedMachineHours(machineCapacity)
  if (!hours) return 0
  return total / hours
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? 0 : n
}

// Computes every derived field for a single product row.
export function computeProduct(product, fixedCostPerMachineHour) {
  const ratePerKg = num(product.ratePerKg)
  const rawQtyKg = num(product.rawQtyKg)
  const gstPercent = num(product.gstPercent)
  const bodyWeightGram = num(product.bodyWeightGram)
  const wastagePercent = num(product.wastagePercent)
  const machinesRun = num(product.machinesRun)
  const runHoursPerMachine = num(product.runHoursPerMachine)
  const sellingPrice = num(product.sellingPrice)

  const rawQtyGram = rawQtyKg * 1000
  const ratePerGram = rawQtyGram ? ratePerKg / 1000 : 0

  const materialAmount = ratePerKg * rawQtyKg // before GST
  const gstAmount = materialAmount * (gstPercent / 100)
  const materialTotalInclGst = materialAmount + gstAmount

  const netMaterialKg = rawQtyKg * (1 - wastagePercent / 100)
  const netMaterialGram = netMaterialKg * 1000

  const theoreticalBodies = bodyWeightGram > 0 ? netMaterialGram / bodyWeightGram : 0

  const actualGoodBodies =
    product.actualGoodBodies !== '' && product.actualGoodBodies !== null && product.actualGoodBodies !== undefined
      ? num(product.actualGoodBodies)
      : theoreticalBodies

  const bodiesForCosting = actualGoodBodies > 0 ? actualGoodBodies : theoreticalBodies

  const totalMachineHours = machinesRun * runHoursPerMachine
  const allocatedFixedCost = totalMachineHours * fixedCostPerMachineHour

  const materialCostPerBody = bodiesForCosting > 0 ? materialTotalInclGst / bodiesForCosting : 0
  const fixedCostPerBody = bodiesForCosting > 0 ? allocatedFixedCost / bodiesForCosting : 0

  const autoFinalCostPerBody = materialCostPerBody + fixedCostPerBody

  const hasOverride =
    product.finalCostOverride !== '' && product.finalCostOverride !== null && product.finalCostOverride !== undefined
  const finalCostPerBody = hasOverride ? num(product.finalCostOverride) : autoFinalCostPerBody

  const profitPerBody = sellingPrice > 0 ? sellingPrice - finalCostPerBody : 0
  const marginPercent = sellingPrice > 0 ? (profitPerBody / sellingPrice) * 100 : 0

  return {
    rawQtyGram,
    ratePerGram,
    materialAmount,
    gstAmount,
    materialTotalInclGst,
    netMaterialKg,
    theoreticalBodies,
    actualGoodBodies,
    bodiesForCosting,
    totalMachineHours,
    fixedCostPerMachineHour,
    allocatedFixedCost,
    materialCostPerBody,
    fixedCostPerBody,
    autoFinalCostPerBody,
    hasOverride,
    finalCostPerBody,
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
