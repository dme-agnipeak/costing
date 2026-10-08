// Field labels for each costing module. Both modules share the same columns and
// formulas; only the wording differs so each screen reads naturally.

export const COSTING_TYPES = {
  moulding: {
    id: 'moulding',
    label: 'Moulding Costing',
    short: 'Moulding',
    unit: 'body',
    units: 'bodies',
    reportTitle: 'Moulding Costing Report',
    labels: {
      name: 'Product / Body Name',
      namePlaceholder: 'e.g. 63 mm Body',
      bodyWeightGram: 'Body Weight',
      ratePerKg: 'Raw Material Rate per KG',
      rawQtyKg: 'Raw Material Qty',
      gstPercent: 'GST %',
      avgProduction: 'Avg Production / Machine / Day',
      sellingPrice: 'Selling Price / Body',
      additionalCost: 'Additional Cost / Body (optional)',
      additionalHint: 'Packing, inserts, colour master batch, etc. Leave blank if not used.',
      finalCost: 'Final Cost / Body',
      perUnit: 'Body',
    },
  },
  welding: {
    id: 'welding',
    label: 'Welding Costing',
    short: 'Welding',
    unit: 'unit',
    units: 'units',
    reportTitle: 'Welding Costing Report',
    labels: {
      name: 'Product / Assembly Name',
      namePlaceholder: 'e.g. 63 mm Body Weld Joint',
      bodyWeightGram: 'Consumable Weight / Unit',
      ratePerKg: 'Consumable Rate per KG',
      rawQtyKg: 'Consumable Stock Qty',
      gstPercent: 'GST %',
      avgProduction: 'Avg Output / Machine / Day',
      sellingPrice: 'Selling Price / Unit',
      additionalCost: 'Gas & Other Cost / Unit (optional)',
      additionalHint: 'Shielding gas, tips, grinding discs, etc. Leave blank if not used.',
      finalCost: 'Final Cost / Unit',
      perUnit: 'Unit',
    },
  },
}

export const TYPE_IDS = Object.keys(COSTING_TYPES)

export function typeLabel(id) {
  return COSTING_TYPES[id]?.label || id
}
