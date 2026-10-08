// Tools the AI assistant can call. Every number comes from the app's own costing
// engine (never from the language model), so AI answers always match the tabs and PDFs.
import { getState, actions } from '../store'
import { computeModule, FIXED_COST_FIELDS, round, num } from '../calculations'
import { COSTING_TYPES } from '../costingTypes'
import { createReport, fetchCloudHistory, recheckRecord, loadRecordSnapshot } from '../reports'
import { cloudConfigured } from '../cloud'
import { blankProduct } from '../store'

const TYPE = { type: 'string', enum: ['moulding', 'welding'], description: 'Costing module: moulding or welding' }

const PRODUCT_PROPS = {
  type: TYPE,
  product_id: { type: 'string', description: 'Existing product id (from get_costing_data). Omit to create a new product.' },
  product_name: { type: 'string', description: 'Product / body name' },
  weight_g: { type: 'number', description: 'Weight per unit in grams (body weight for moulding, consumable weight for welding)' },
  rate_per_kg: { type: 'number', description: 'Raw material / consumable rate per KG in rupees' },
  raw_qty_kg: { type: 'number', description: 'Raw material stock quantity in KG (reference only)' },
  gst_percent: { type: 'number', description: 'GST percent, usually 18' },
  avg_production: { type: 'number', description: 'Average production per machine per day (units)' },
  selling_price: { type: 'number', description: 'Selling price per unit in rupees' },
  additional_cost: { type: 'number', description: 'Optional additional cost per unit (packing, gas, etc.)' },
  final_cost_override: { type: 'number', description: 'Optional manual final cost per unit. Use -1 to remove an override.' },
  date: { type: 'string', description: 'Costing date YYYY-MM-DD' },
  notes: { type: 'string', description: 'Optional notes' },
}

export const TOOL_DEFS = [
  {
    name: 'get_costing_data',
    description:
      'Get current fixed costs, machine setup, all products and their calculated costs for moulding and/or welding. Call this before answering questions about existing products or totals.',
    parameters: { type: 'object', properties: { type: { type: 'string', enum: ['moulding', 'welding', 'all'], description: 'Module to read, default all' } } },
  },
  {
    name: 'calculate_costing',
    description:
      'What-if calculation WITHOUT saving. Either start from an existing product (product_id or product_name) and override some inputs, or give all inputs for a new item. Can also override fixed cost inputs for the scenario.',
    parameters: {
      type: 'object',
      properties: {
        ...PRODUCT_PROPS,
        number_of_machines: { type: 'number', description: 'Scenario override: number of machines' },
        working_days: { type: 'number', description: 'Scenario override: working days per month' },
        total_monthly_fixed_cost: { type: 'number', description: 'Scenario override: total monthly fixed cost' },
      },
      required: ['type'],
    },
  },
  {
    name: 'save_product',
    description:
      'Create a new product or update an existing one in the Moulding or Welding tab. To update, pass product_id (or an exact existing product_name) plus only the fields to change.',
    parameters: { type: 'object', properties: PRODUCT_PROPS, required: ['type'] },
  },
  {
    name: 'delete_product',
    description: 'Delete a product. Only call after the user has clearly asked or confirmed deletion.',
    parameters: { type: 'object', properties: { type: TYPE, product_id: { type: 'string' }, product_name: { type: 'string' } }, required: ['type'] },
  },
  {
    name: 'update_fixed_costs',
    description: 'Update monthly fixed costs of a module (only the fields given are changed). Amounts in rupees per month.',
    parameters: {
      type: 'object',
      properties: {
        type: TYPE,
        electricity: { type: 'number' },
        rent: { type: 'number' },
        operator_salary: { type: 'number' },
        labour: { type: 'number' },
        misc: { type: 'number' },
        other_fixed: { type: 'number' },
      },
      required: ['type'],
    },
  },
  {
    name: 'update_machine_setup',
    description: 'Update number of machines and/or working days per month for a module.',
    parameters: { type: 'object', properties: { type: TYPE, number_of_machines: { type: 'number' }, working_days: { type: 'number' } }, required: ['type'] },
  },
  {
    name: 'create_pdf_report',
    description:
      'Create the standard costing PDF report for a module (all products, or only product_ids / product_names). The PDF is downloaded, uploaded to Google Drive and logged in the History sheet.',
    parameters: {
      type: 'object',
      properties: {
        type: TYPE,
        product_ids: { type: 'array', items: { type: 'string' } },
        product_names: { type: 'array', items: { type: 'string' } },
        title: { type: 'string', description: 'Optional custom report title' },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_product_pdf',
    description: 'Create a detailed single-product costing sheet PDF with step-by-step calculation (downloaded, saved to Drive and History).',
    parameters: { type: 'object', properties: { type: TYPE, product_id: { type: 'string' }, product_name: { type: 'string' } }, required: ['type'] },
  },
  {
    name: 'create_custom_pdf',
    description:
      'Create a custom PDF for any analysis the user asks for (comparisons, what-if scenarios, price lists, quotations). First compute every number with calculate_costing / get_costing_data, then pass the finished tables here. Saved to Drive and History.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subtitle: { type: 'string' },
        summary: { type: 'string', description: 'Short professional summary paragraph' },
        highlights: {
          type: 'array',
          description: 'Up to 5 key figures',
          items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] },
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              text: { type: 'string' },
              columns: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
          },
        },
        notes: { type: 'array', items: { type: 'string' } },
      },
      required: ['title'],
    },
  },
  {
    name: 'search_history',
    description: 'Search saved reports (History). Returns report id, date, type, products, PDF link.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search in product names, titles, report ids' },
        type: { type: 'string', enum: ['moulding', 'welding', 'custom', 'any'] },
        from: { type: 'string', description: 'From date YYYY-MM-DD' },
        to: { type: 'string', description: 'To date YYYY-MM-DD' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'recheck_report',
    description: 'Re-check a saved report: recalculate its saved inputs and compare with saved results and with current costs.',
    parameters: { type: 'object', properties: { report_id: { type: 'string' } }, required: ['report_id'] },
  },
  {
    name: 'open_screen',
    description: 'Navigate the app to a screen.',
    parameters: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: ['moulding', 'welding', 'history', 'settings', 'help', 'assistant'] },
        section: { type: 'string', enum: ['products', 'fixed', 'machine', 'report'], description: 'Section inside moulding/welding' },
      },
      required: ['screen'],
    },
  },
  {
    name: 'update_company_details',
    description: 'Update company details printed on PDFs.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' }, subtitle: { type: 'string' }, address: { type: 'string' }, gstin: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' } },
    },
  },
]

// ---------------------------------------------------------------- helpers
function findProduct(type, id, name) {
  const list = getState().data.modules[type].products
  if (id) {
    const p = list.find((x) => x.id === id)
    if (p) return p
  }
  if (name) {
    const n = String(name).trim().toLowerCase()
    return list.find((x) => (x.name || '').trim().toLowerCase() === n) || list.find((x) => (x.name || '').toLowerCase().includes(n)) || null
  }
  return null
}

function figures(p, c) {
  return {
    id: p.id,
    name: p.name,
    date: p.date,
    inputs: {
      weight_g: num(p.bodyWeightGram),
      rate_per_kg: num(p.ratePerKg),
      raw_qty_kg: num(p.rawQtyKg),
      gst_percent: num(p.gstPercent),
      avg_production: num(p.avgProduction),
      selling_price: num(p.sellingPrice),
      additional_cost: num(p.additionalCost),
      final_cost_override: c.hasOverride ? num(p.finalCostOverride) : null,
    },
    results: {
      material_cost_ex_gst: round(c.materialAmountPerBody, 4),
      gst_amount: round(c.gstAmount, 4),
      material_cost_incl_gst: round(c.materialTotalInclGst, 4),
      fixed_cost_per_unit: round(c.fixedCostPerBody, 4),
      final_cost_per_unit: round(c.finalCostPerBody, 4),
      auto_final_cost_per_unit: round(c.autoFinalCostPerBody, 4),
      manual_override: c.hasOverride,
      profit_per_unit: c.hasSellingPrice ? round(c.profitPerBody, 4) : null,
      margin_percent: c.hasSellingPrice ? round(c.marginPercent, 2) : null,
      profit_per_machine_per_day: c.hasSellingPrice ? round(c.profitPerMachinePerDay, 2) : null,
      profit_per_machine_per_month: c.hasSellingPrice ? round(c.profitPerMachinePerMonth, 2) : null,
      units_from_raw_qty: c.unitsFromRawQty || null,
    },
  }
}

function moduleView(type) {
  const mod = getState().data.modules[type]
  const s = computeModule(mod)
  return {
    module: type,
    fixed_costs_monthly: Object.fromEntries(FIXED_COST_FIELDS.map((f) => [f.key, num(mod.fixedCosts[f.key])])),
    total_monthly_fixed_cost: round(s.totalFixed, 2),
    number_of_machines: num(mod.machine.numberOfMachines),
    working_days: num(mod.machine.workingDays),
    fixed_cost_per_machine_per_month: round(s.perMachine, 2),
    fixed_cost_per_machine_per_day: round(s.perMachinePerDay, 4),
    product_count: s.rows.length,
    average_margin_percent: s.pricedCount ? round(s.avgMargin, 2) : null,
    products: s.rows.map((r) => figures(r.product, r.calc)),
  }
}

function productFromArgs(a, base = {}) {
  const p = { ...base }
  const map = {
    product_name: 'name',
    weight_g: 'bodyWeightGram',
    rate_per_kg: 'ratePerKg',
    raw_qty_kg: 'rawQtyKg',
    gst_percent: 'gstPercent',
    avg_production: 'avgProduction',
    selling_price: 'sellingPrice',
    additional_cost: 'additionalCost',
    date: 'date',
    notes: 'notes',
  }
  for (const [k, v] of Object.entries(map)) if (a[k] !== undefined && a[k] !== null) p[v] = a[k]
  if (a.final_cost_override !== undefined && a.final_cost_override !== null) p.finalCostOverride = Number(a.final_cost_override) < 0 ? '' : a.final_cost_override
  return p
}

function checkType(t) {
  if (!COSTING_TYPES[t]) throw new Error('type must be "moulding" or "welding"')
}

function reportResult(rec) {
  return {
    report_id: rec.reportId,
    title: rec.title,
    file_name: rec.fileName,
    google_drive_link: rec.pdfUrl || null,
    saved_to_drive: rec.status === 'synced',
    status:
      rec.status === 'synced'
        ? 'PDF downloaded, saved to Google Drive and logged in History sheet.'
        : rec.status === 'pending'
          ? 'PDF downloaded. Google Drive upload is pending (offline or not signed in to cloud) — will sync from History.'
          : cloudConfigured()
            ? 'PDF downloaded and saved in local History.'
            : 'PDF downloaded and saved in local History (Google Drive is not connected yet).',
  }
}

// ---------------------------------------------------------------- executor
export async function runTool(name, args = {}) {
  const st = getState()
  switch (name) {
    case 'get_costing_data': {
      const t = args.type && args.type !== 'all' ? [args.type] : ['moulding', 'welding']
      return { company: st.data.company.name, today: new Date().toISOString().slice(0, 10), modules: t.map(moduleView) }
    }
    case 'calculate_costing': {
      checkType(args.type)
      const mod = st.data.modules[args.type]
      const base = findProduct(args.type, args.product_id, args.product_id ? null : args.product_name) || {}
      const p = productFromArgs(args, { ...blankProduct(), ...base })
      const machine = { ...mod.machine }
      if (args.number_of_machines) machine.numberOfMachines = args.number_of_machines
      if (args.working_days) machine.workingDays = args.working_days
      let fixed = { ...mod.fixedCosts }
      if (args.total_monthly_fixed_cost !== undefined) fixed = { electricity: args.total_monthly_fixed_cost }
      const s = computeModule({ fixedCosts: fixed, machine, products: [p] })
      const c = s.rows[0].calc
      return {
        scenario_only_not_saved: true,
        based_on_existing_product: base.id ? base.name : null,
        fixed_cost_per_machine_per_day: round(s.perMachinePerDay, 4),
        ...figures(p, c),
      }
    }
    case 'save_product': {
      checkType(args.type)
      const existing = findProduct(args.type, args.product_id, args.product_id ? null : args.product_name)
      const isUpdate = !!existing && (!!args.product_id || existing.name?.trim().toLowerCase() === String(args.product_name || '').trim().toLowerCase())
      const p = productFromArgs(args, isUpdate ? existing : blankProduct())
      if (!p.name) throw new Error('product_name is required for a new product')
      const saved = actions.upsertProduct(args.type, p)
      const s = computeModule(getState().data.modules[args.type])
      const row = s.rows.find((r) => r.product.id === saved.id)
      return { action: isUpdate ? 'updated' : 'created', module: args.type, ...figures(row.product, row.calc) }
    }
    case 'delete_product': {
      checkType(args.type)
      const p = findProduct(args.type, args.product_id, args.product_name)
      if (!p) throw new Error('Product not found')
      actions.deleteProduct(args.type, p.id)
      return { deleted: p.name, module: args.type }
    }
    case 'update_fixed_costs': {
      checkType(args.type)
      const map = { electricity: 'electricity', rent: 'rent', operator_salary: 'operatorSalary', labour: 'labour', misc: 'misc', other_fixed: 'otherFixed' }
      const patch = {}
      for (const [k, v] of Object.entries(map)) if (args[k] !== undefined && args[k] !== null) patch[v] = args[k]
      actions.setFixedCosts(args.type, patch)
      const v = moduleView(args.type)
      return { updated: Object.keys(patch), fixed_costs_monthly: v.fixed_costs_monthly, total_monthly_fixed_cost: v.total_monthly_fixed_cost, fixed_cost_per_machine_per_day: v.fixed_cost_per_machine_per_day }
    }
    case 'update_machine_setup': {
      checkType(args.type)
      const patch = {}
      if (args.number_of_machines !== undefined) patch.numberOfMachines = args.number_of_machines
      if (args.working_days !== undefined) patch.workingDays = args.working_days
      actions.setMachine(args.type, patch)
      const v = moduleView(args.type)
      return { number_of_machines: v.number_of_machines, working_days: v.working_days, fixed_cost_per_machine_per_day: v.fixed_cost_per_machine_per_day }
    }
    case 'create_pdf_report': {
      checkType(args.type)
      let ids = args.product_ids || []
      if (args.product_names?.length) {
        ids = [...ids, ...args.product_names.map((n) => findProduct(args.type, null, n)?.id).filter(Boolean)]
        if (!ids.length) throw new Error('None of the named products were found')
      }
      const rec = await createReport({ kind: 'module', type: args.type, productIds: ids.length ? ids : undefined, title: args.title, source: 'ai' })
      return reportResult(rec)
    }
    case 'create_product_pdf': {
      checkType(args.type)
      const p = findProduct(args.type, args.product_id, args.product_name)
      if (!p) throw new Error('Product not found')
      const rec = await createReport({ kind: 'product', type: args.type, productId: p.id, source: 'ai' })
      return reportResult(rec)
    }
    case 'create_custom_pdf': {
      const spec = {
        title: args.title,
        subtitle: args.subtitle,
        summary: args.summary,
        highlights: args.highlights || [],
        sections: (args.sections || []).map((s) => ({ heading: s.heading, text: s.text, table: s.columns?.length ? { columns: s.columns, rows: s.rows || [] } : null })),
        notes: args.notes || [],
      }
      const rec = await createReport({ kind: 'custom', spec, title: args.title, source: 'ai' })
      return reportResult(rec)
    }
    case 'search_history': {
      let list = st.history
      if (cloudConfigured() && st.session?.mode === 'cloud') {
        try {
          list = await fetchCloudHistory({})
        } catch {
          /* fall back to local */
        }
      }
      const q = (args.query || '').toLowerCase()
      const from = args.from ? new Date(args.from).getTime() : 0
      const to = args.to ? new Date(args.to).getTime() + 86400000 : Infinity
      const out = list
        .filter((h) => !args.type || args.type === 'any' || h.type === args.type)
        .filter((h) => !q || `${h.reportId} ${h.title} ${h.productNames}`.toLowerCase().includes(q))
        .filter((h) => {
          const t = new Date(h.savedAt).getTime()
          return t >= from && t <= to
        })
        .slice(0, args.limit || 15)
        .map((h) => ({ report_id: h.reportId, saved_at: h.savedAt, type: h.type, title: h.title, products: h.productNames, saved_by: h.savedBy, pdf_link: h.pdfUrl || null, status: h.status }))
      return { count: out.length, reports: out }
    }
    case 'recheck_report': {
      const rec = getState().history.find((h) => h.reportId === args.report_id)
      if (!rec) throw new Error('Report not found in History. Use search_history first.')
      const full = await loadRecordSnapshot(rec)
      const r = recheckRecord(full)
      return {
        report_id: rec.reportId,
        all_figures_verified: r.verified,
        fixed_cost_per_machine_day_then: r.fixedThen,
        fixed_cost_per_machine_day_now: r.fixedNow,
        items: (r.items || []).map((i) => ({
          product: i.name,
          verified: i.verified,
          mismatched_fields: i.mismatches,
          saved_final_cost: i.saved.finalCost,
          recalculated_final_cost: i.recomputed.finalCost,
          current_final_cost_today: i.liveFinalCost,
          change_since_saved: i.liveChange,
        })),
      }
    }
    case 'open_screen': {
      const map = { assistant: 'assistant', moulding: 'moulding', welding: 'welding', history: 'history', settings: 'settings', help: 'help' }
      if ((args.screen === 'moulding' || args.screen === 'welding') && args.section) actions.setSub(args.screen, args.section)
      // stay on the assistant screen on phones; the user can tap the tab
      actions.setTab(map[args.screen] || 'moulding')
      return { opened: args.screen, section: args.section || null }
    }
    case 'update_company_details': {
      const patch = {}
      for (const k of ['name', 'subtitle', 'address', 'gstin', 'phone', 'email']) if (args[k] !== undefined) patch[k] = args[k]
      actions.setCompany(patch)
      return { company: getState().data.company }
    }
    default:
      throw new Error('Unknown tool ' + name)
  }
}

export const TOOL_LABELS = {
  get_costing_data: 'Reading costing data',
  calculate_costing: 'Calculating',
  save_product: 'Saving product',
  delete_product: 'Deleting product',
  update_fixed_costs: 'Updating fixed costs',
  update_machine_setup: 'Updating machine setup',
  create_pdf_report: 'Creating PDF report',
  create_product_pdf: 'Creating product PDF',
  create_custom_pdf: 'Creating custom PDF',
  search_history: 'Searching history',
  recheck_report: 'Re-checking report',
  open_screen: 'Opening screen',
  update_company_details: 'Updating company details',
}
