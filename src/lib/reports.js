// Report pipeline: build PDF → download → upload to Google Drive folder →
// log in Google Sheet → keep a local history copy (with a full snapshot so any
// report can be re-checked or regenerated later).
import { getState, actions } from './store'
import { buildModuleReport, buildProductSheet, buildCustomReport, downloadPdf } from './pdf'
import { computeModule, computeProduct, round } from './calculations'
import { COSTING_TYPES } from './costingTypes'
import { callCloud, cloudConfigured } from './cloud'
import { reportId as makeId, clone } from './util'

function resultFigures(calc) {
  return {
    materialAmount: round(calc.materialAmountPerBody, 4),
    gstAmount: round(calc.gstAmount, 4),
    materialInclGst: round(calc.materialTotalInclGst, 4),
    fixedPerUnit: round(calc.fixedCostPerBody, 4),
    additionalCost: round(calc.additionalCost, 4),
    finalCost: round(calc.finalCostPerBody, 4),
    profit: round(calc.profitPerBody, 4),
    margin: round(calc.marginPercent, 4),
    profitPerMachineMonth: round(calc.profitPerMachinePerMonth, 2),
  }
}

function buildSnapshot({ kind, type, productIds, spec }) {
  const data = getState().data
  if (kind === 'custom') return { kind, spec: clone(spec), company: clone(data.company) }
  const mod = data.modules[type]
  const products = productIds?.length ? mod.products.filter((p) => productIds.includes(p.id)) : mod.products
  const sub = { fixedCosts: clone(mod.fixedCosts), machine: clone(mod.machine), products: clone(products) }
  const s = computeModule(sub)
  return {
    kind,
    type,
    company: clone(data.company),
    module: sub,
    results: Object.fromEntries(s.rows.map((r) => [r.product.id, resultFigures(r.calc)])),
    totals: { totalFixed: round(s.totalFixed, 2), perMachinePerDay: round(s.perMachinePerDay, 4), avgFinalCost: round(s.avgFinalCost, 4), avgMargin: round(s.avgMargin, 2) },
  }
}

function dataFromSnapshot(snap) {
  const base = clone(getState().data)
  base.company = snap.company || base.company
  if (snap.type && snap.module) base.modules[snap.type] = clone(snap.module)
  return base
}

export function pdfFromRecord(record) {
  const snap = record.snapshot
  const data = dataFromSnapshot(snap)
  const opts = { data, reportId: record.reportId, preparedBy: record.savedBy }
  if (snap.kind === 'custom') return buildCustomReport({ ...opts, spec: snap.spec })
  if (snap.kind === 'product') return buildProductSheet({ ...opts, type: snap.type, productId: snap.module.products[0]?.id })
  return buildModuleReport({ ...opts, type: snap.type, title: record.title })
}

function historyLines(record) {
  const snap = record.snapshot
  if (!snap.module) return []
  const s = computeModule(snap.module)
  return s.rows.map(({ product: p, calc: c }) => ({
    productName: p.name || '',
    costingDate: p.date || '',
    weightGram: p.bodyWeightGram,
    ratePerKg: p.ratePerKg,
    rawQtyKg: p.rawQtyKg,
    gstPercent: p.gstPercent,
    avgProduction: p.avgProduction,
    fixedPerMachineDay: round(s.perMachinePerDay, 2),
    materialAmount: round(c.materialAmountPerBody, 2),
    gstAmount: round(c.gstAmount, 2),
    materialInclGst: round(c.materialTotalInclGst, 2),
    fixedPerUnit: round(c.fixedCostPerBody, 2),
    additionalCost: round(c.additionalCost, 2),
    finalCost: round(c.finalCostPerBody, 2),
    manualOverride: c.hasOverride ? 'Yes' : 'No',
    sellingPrice: c.hasSellingPrice ? round(c.sellingPrice, 2) : '',
    profit: c.hasSellingPrice ? round(c.profitPerBody, 2) : '',
    margin: c.hasSellingPrice ? round(c.marginPercent, 2) : '',
    profitPerMachineMonth: c.hasSellingPrice ? round(c.profitPerMachinePerMonth, 2) : '',
  }))
}

async function uploadRecord(record, pdf) {
  const res = await callCloud(
    'saveReport',
    {
      report: {
        reportId: record.reportId,
        kind: record.kind,
        type: record.type,
        title: record.title,
        productNames: record.productNames,
        productCount: record.productCount,
        summary: record.summary,
        source: record.source,
        fileName: pdf.fileName,
        pdfBase64: pdf.base64,
        snapshot: record.snapshot,
        lines: historyLines(record),
      },
    },
    { timeoutMs: 120000 }
  )
  return { pdfUrl: res.pdfUrl, fileId: res.fileId }
}

/**
 * Create a report.
 * kind: 'module' (all or selected products), 'product' (single sheet), 'custom' (AI-defined spec)
 */
export async function createReport({ kind = 'module', type, productIds, productId, spec, title, source = 'manual', download = true, upload = true }) {
  const state = getState()
  const id = makeId(kind === 'custom' ? 'custom' : type)
  const ids = kind === 'product' ? [productId] : productIds
  const snapshot = buildSnapshot({ kind, type, productIds: ids, spec })
  const T = type ? COSTING_TYPES[type] : null
  const names = snapshot.module ? snapshot.module.products.map((p) => p.name || 'Unnamed') : []
  if (kind !== 'custom' && !names.length) throw new Error('There are no products to include in this report.')
  const record = {
    reportId: id,
    kind,
    type: type || 'custom',
    title: title || (kind === 'custom' ? spec?.title || 'Custom Report' : kind === 'product' ? `${T.short} Costing Sheet - ${names[0]}` : T.reportTitle),
    savedAt: new Date().toISOString(),
    savedBy: state.session?.username || '',
    source,
    productCount: names.length,
    productNames: names.join(', '),
    summary: snapshot.totals || {},
    snapshot,
    pdfUrl: '',
    fileId: '',
    status: 'local',
  }
  const pdf = pdfFromRecord(record)
  record.fileName = pdf.fileName
  if (download) downloadPdf(pdf)

  const canUpload = upload && cloudConfigured() && state.session?.mode === 'cloud'
  if (canUpload) {
    try {
      const r = await uploadRecord(record, pdf)
      Object.assign(record, r, { status: 'synced' })
    } catch (e) {
      record.status = 'pending'
      record.error = e.message
    }
  } else if (upload && cloudConfigured()) {
    record.status = 'pending'
  }
  actions.addHistory(record)
  return record
}

export async function syncPending() {
  const pending = getState().history.filter((h) => h.status === 'pending')
  let ok = 0
  for (const rec of pending) {
    try {
      const pdf = pdfFromRecord(rec)
      const r = await uploadRecord(rec, pdf)
      actions.updateHistory(rec.reportId, { ...r, status: 'synced', error: '' })
      ok++
    } catch (e) {
      actions.updateHistory(rec.reportId, { error: e.message })
      if (e.code === 'NETWORK' || e.code === 'AUTH') break
    }
  }
  return { total: pending.length, ok }
}

export async function fetchCloudHistory(filters = {}) {
  const res = await callCloud('listReports', filters)
  const local = getState().history
  const map = new Map(local.map((h) => [h.reportId, h]))
  for (const r of res.reports || []) {
    const ex = map.get(r.reportId)
    map.set(r.reportId, { ...r, ...(ex || {}), pdfUrl: r.pdfUrl || ex?.pdfUrl, status: 'synced', snapshot: ex?.snapshot || null })
  }
  const merged = [...map.values()].sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
  actions.setHistory(merged)
  return merged
}

export async function loadRecordSnapshot(record) {
  if (record.snapshot) return record
  const res = await callCloud('getReport', { reportId: record.reportId })
  const full = { ...record, ...res.report }
  actions.updateHistory(record.reportId, { snapshot: full.snapshot })
  return full
}

// Re-check: recompute the saved inputs with the costing engine and compare against
// the results stored at save time; also compare with today's master data.
export function recheckRecord(record) {
  const snap = record.snapshot
  if (!snap) throw new Error('Snapshot not available for this report.')
  if (snap.kind === 'custom') return { kind: 'custom', items: [], verified: true, note: 'Custom reports contain AI-prepared tables; open the PDF to review.' }
  const s = computeModule(snap.module)
  const current = getState().data.modules[snap.type]
  const curSummary = computeModule(current)
  const items = s.rows.map(({ product: p, calc }) => {
    const saved = snap.results?.[p.id]
    const now = resultFigures(calc)
    const fields = ['materialInclGst', 'fixedPerUnit', 'finalCost', 'profit', 'margin']
    const mismatches = saved ? fields.filter((f) => Math.abs((saved[f] ?? 0) - now[f]) > 0.01) : []
    const live = current.products.find((x) => x.id === p.id) || current.products.find((x) => x.name && x.name === p.name)
    const liveCalc = live ? computeProduct(live, curSummary.perMachinePerDay, curSummary.workingDays) : null
    return {
      id: p.id,
      name: p.name,
      saved: saved || now,
      recomputed: now,
      verified: !!saved && mismatches.length === 0,
      mismatches,
      liveFinalCost: liveCalc ? round(liveCalc.finalCostPerBody, 4) : null,
      liveChange: liveCalc ? round(liveCalc.finalCostPerBody - now.finalCost, 4) : null,
      product: p,
    }
  })
  return {
    kind: snap.kind,
    type: snap.type,
    items,
    verified: items.every((i) => i.verified),
    fixedNow: round(curSummary.perMachinePerDay, 4),
    fixedThen: round(s.perMachinePerDay, 4),
  }
}

export async function deleteRecord(record) {
  if (record.status === 'synced' && cloudConfigured()) await callCloud('deleteReport', { reportId: record.reportId })
  actions.removeHistory(record.reportId)
}

// Restore products from a saved report into the live module (for editing/re-costing)
export function restoreFromRecord(record, { includeSetup = false } = {}) {
  const snap = record.snapshot
  if (!snap?.module) throw new Error('This report has no product data to restore.')
  for (const p of snap.module.products) actions.upsertProduct(snap.type, p)
  if (includeSetup) {
    actions.setFixedCosts(snap.type, snap.module.fixedCosts)
    actions.setMachine(snap.type, snap.module.machine)
  }
  return snap.module.products.length
}
