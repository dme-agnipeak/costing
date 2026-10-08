// Verifies the costing engine against hand-calculated values from the original Excel sheet.
// Run: npm test
import assert from 'node:assert/strict'
import { computeModule, computeProduct, computeTotalFixedCost, computeFixedCostPerMachinePerDay } from '../src/lib/calculations.js'

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: expected ${b}, got ${a}`)

const fixed = { electricity: 350000, rent: 140000, operatorSalary: 204000, labour: 120000, misc: 100000, otherFixed: 0 }
const machine = { numberOfMachines: 6, workingDays: 26 }

close(computeTotalFixedCost(fixed), 914000, 'Total fixed cost')
const perDay = computeFixedCostPerMachinePerDay(fixed, machine)
close(perDay, 914000 / 6 / 26, 'Fixed cost / machine / day')

const p = { name: '63 mm Body', bodyWeightGram: 42, ratePerKg: 118, rawQtyKg: 25, gstPercent: 18, avgProduction: 2400, sellingPrice: 12 }
const c = computeProduct(p, perDay, 26)
const material = (118 / 1000) * 42
const gst = material * 0.18
const fixedUnit = perDay / 2400
close(c.materialAmountPerBody, material, 'Material amount')
close(c.gstAmount, gst, 'GST amount')
close(c.materialTotalInclGst, material + gst, 'Material incl GST')
close(c.fixedCostPerBody, fixedUnit, 'Fixed cost / body')
close(c.finalCostPerBody, fixedUnit + material + gst, 'Final cost / body (K11)')
close(c.gstPriceDisplay, gst + fixedUnit, 'GST price (L11)')
close(c.withoutGstPrice, fixedUnit + material, 'Without GST price (M11)')
close(c.profitPerBody, 12 - (fixedUnit + material + gst), 'Profit (N11)')
close(c.profitPerMachinePerMonth, c.profitPerBody * 2400 * 26, 'Profit / machine / month')
assert.equal(c.unitsFromRawQty, Math.floor(25000 / 42))

// Bug fix: blank Raw Qty must NOT zero the material cost (v2 returned 0)
const noRaw = computeProduct({ ...p, rawQtyKg: '' }, perDay, 26)
close(noRaw.materialAmountPerBody, material, 'Material with blank raw qty')

// Manual override + additional cost
const ov = computeProduct({ ...p, finalCostOverride: '9.5' }, perDay, 26)
close(ov.finalCostPerBody, 9.5, 'Override')
assert.equal(ov.hasOverride, true)
const add = computeProduct({ ...p, additionalCost: 0.5 }, perDay, 26)
close(add.finalCostPerBody, fixedUnit + material + gst + 0.5, 'Additional cost')

// Edge cases: zero machines / days / production never produce Infinity or NaN
const z = computeModule({ fixedCosts: fixed, machine: { numberOfMachines: 0, workingDays: 0 }, products: [{ ...p, avgProduction: 0 }] })
assert.ok(Number.isFinite(z.rows[0].calc.finalCostPerBody))
close(z.perMachinePerDay, 0, 'Zero machines')

console.log('All costing checks passed ✔')
console.log({ perDay: perDay.toFixed(4), material: material.toFixed(4), final: c.finalCostPerBody.toFixed(4), profit: c.profitPerBody.toFixed(4), margin: c.marginPercent.toFixed(2) + '%' })
