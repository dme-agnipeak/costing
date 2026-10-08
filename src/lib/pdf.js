// Professional PDF reports (jsPDF + AutoTable).
// Standard PDF fonts cannot draw the ₹ glyph, so amounts are printed as "Rs.".
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computeModule, computeProduct, FIXED_COST_FIELDS, num, num2, rs } from './calculations'
import { COSTING_TYPES } from './costingTypes'
import { safeFileName, fmtDate, fmtDateTime } from './util'

const NAVY = [15, 23, 42]
const BLUE = [47, 111, 237]
const GREY = [100, 116, 139]
const LIGHT = [241, 245, 249]
const GREEN = [22, 130, 74]
const RED = [200, 40, 40]

function clean(s) {
  // keep PDF text within WinAnsi; replace common unicode
  return String(s ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, 'x')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}

function header(doc, { company, title, reportId, generatedAt, preparedBy }) {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 74, 'F')
  doc.setFillColor(...BLUE)
  doc.rect(0, 74, W, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(clean(company?.name || 'Vinayak AgniPeak LLP'), 30, 30)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const line2 = [company?.address, company?.gstin ? 'GSTIN: ' + company.gstin : '', company?.phone, company?.email].filter(Boolean).join('  |  ')
  doc.setTextColor(203, 213, 225)
  doc.text(doc.splitTextToSize(clean(line2 || company?.subtitle || 'Product Costing System'), W / 2 - 40).slice(0, 2), 30, 46)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(doc.splitTextToSize(clean(title), W / 2 - 20)[0], W - 30, 28, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Report No: ${clean(reportId)}`, W - 30, 44, { align: 'right' })
  doc.text(`Generated: ${fmtDateTime(generatedAt)}${preparedBy ? '   |   Prepared by: ' + clean(preparedBy) : ''}`, W - 30, 57, { align: 'right' })
}

function footers(doc, company) {
  const n = doc.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(30, H - 28, W - 30, H - 28)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GREY)
    doc.text(clean(`${company?.name || ''} - Confidential. System-generated costing report for internal use.`), 30, H - 16)
    doc.text(`Page ${i} of ${n}`, W - 30, H - 16, { align: 'right' })
  }
}

function sectionTitle(doc, text, y) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...NAVY)
  doc.text(clean(text), 30, y)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(1.2)
  doc.line(30, y + 4, 60, y + 4)
  doc.setLineWidth(0.5)
  return y + 12
}

function ensureSpace(doc, y, need) {
  const H = doc.internal.pageSize.getHeight()
  if (y + need > H - 40) {
    doc.addPage()
    return 50
  }
  return y
}

function statBoxes(doc, y, items) {
  const W = doc.internal.pageSize.getWidth()
  const gap = 8
  const w = (W - 60 - gap * (items.length - 1)) / items.length
  items.forEach((it, i) => {
    const x = 30 + i * (w + gap)
    doc.setFillColor(...(it.highlight ? [232, 240, 254] : LIGHT))
    doc.setDrawColor(...(it.highlight ? BLUE : [226, 232, 240]))
    doc.roundedRect(x, y, w, 40, 4, 4, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...GREY)
    doc.text(clean(it.label.toUpperCase()), x + 8, y + 14, { maxWidth: w - 12 })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...(it.color || NAVY))
    doc.text(clean(it.value), x + 8, y + 31)
  })
  return y + 52
}

function signatures(doc, y) {
  const W = doc.internal.pageSize.getWidth()
  y = ensureSpace(doc, y, 60)
  const labels = ['Prepared by', 'Checked by', 'Approved by']
  const w = (W - 60) / 3
  doc.setDrawColor(148, 163, 184)
  doc.setFontSize(8)
  doc.setTextColor(...GREY)
  doc.setFont('helvetica', 'normal')
  labels.forEach((l, i) => {
    const x = 30 + i * w
    doc.line(x + 10, y + 30, x + w - 20, y + 30)
    doc.text(l, x + 10, y + 42)
  })
  return y + 50
}

const tableBase = {
  theme: 'grid',
  headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold', valign: 'middle' },
  bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
  alternateRowStyles: { fillColor: [248, 250, 252] },
  styles: { cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.5, overflow: 'linebreak' },
}

function finish(doc, fileName) {
  const dataUri = doc.output('datauristring')
  const base64 = dataUri.split(',')[1]
  return { doc, fileName, base64, blob: doc.output('blob') }
}

// ---------------- Module report (all / selected products) ----------------
export function buildModuleReport({ type, data, productIds, reportId, preparedBy, title }) {
  const T = COSTING_TYPES[type]
  const L = T.labels
  const mod = data.modules[type]
  const selected = productIds?.length ? { ...mod, products: mod.products.filter((p) => productIds.includes(p.id)) } : mod
  const s = computeModule(selected)
  const now = new Date()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const reportTitle = title || T.reportTitle
  header(doc, { company: data.company, title: reportTitle, reportId, generatedAt: now, preparedBy })

  let y = 98
  y = statBoxes(doc, y, [
    { label: 'Total Monthly Fixed Cost', value: rs(s.totalFixed) },
    { label: 'Fixed Cost / Machine / Day', value: rs(s.perMachinePerDay), highlight: true },
    { label: 'Products Costed', value: String(s.rows.length) },
    { label: `Avg ${L.finalCost}`, value: rs(s.avgFinalCost) },
    {
      label: 'Average Margin',
      value: s.pricedCount ? num2(s.avgMargin, 1) + '%' : 'N/A',
      color: s.pricedCount ? (s.avgMargin >= 0 ? GREEN : RED) : NAVY,
    },
  ])

  // Fixed cost + machine setup side by side
  y = sectionTitle(doc, 'Fixed Cost Basis', y + 4)
  const half = (W - 60 - 16) / 2
  autoTable(doc, {
    ...tableBase,
    startY: y,
    margin: { left: 30 },
    tableWidth: half,
    head: [['Monthly Fixed Cost Head', 'Amount']],
    body: [
      ...FIXED_COST_FIELDS.map((f) => [f.label, rs(mod.fixedCosts[f.key])]),
      [{ content: 'Total Monthly Fixed Cost', styles: { fontStyle: 'bold' } }, { content: rs(s.totalFixed), styles: { fontStyle: 'bold' } }],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })
  const leftEnd = doc.lastAutoTable.finalY
  autoTable(doc, {
    ...tableBase,
    startY: y,
    margin: { left: 30 + half + 16 },
    tableWidth: half,
    head: [['Machine Setup & Allocation', 'Value']],
    body: [
      ['Number of Machines', num2(mod.machine.numberOfMachines, 0)],
      ['Working Days per Month', num2(mod.machine.workingDays, 0)],
      ['Fixed Cost / Machine (Monthly)', rs(s.perMachine)],
      [{ content: 'Fixed Cost / Machine / Day', styles: { fontStyle: 'bold' } }, { content: rs(s.perMachinePerDay), styles: { fontStyle: 'bold' } }],
    ],
    columnStyles: { 1: { halign: 'right' } },
  })
  y = Math.max(leftEnd, doc.lastAutoTable.finalY) + 22

  // Product table
  y = ensureSpace(doc, y, 80)
  y = sectionTitle(doc, `${T.short} Costing - Product Summary (amounts in Rs.)`, y)
  const body = s.rows.map(({ product: p, calc: c }, i) => [
    i + 1,
    clean(p.name || '-'),
    p.date ? fmtDate(p.date) : '-',
    num2(p.bodyWeightGram, 2),
    num2(p.ratePerKg, 2),
    num2(p.gstPercent, 1) + '%',
    num2(p.avgProduction, 0),
    num2(c.materialAmountPerBody, 2),
    num2(c.gstAmount, 2),
    num2(c.materialTotalInclGst, 2),
    num2(c.fixedCostPerBody, 2),
    c.additionalCost ? num2(c.additionalCost, 2) : '-',
    num2(c.finalCostPerBody, 2) + (c.hasOverride ? ' *' : ''),
    c.hasSellingPrice ? num2(c.sellingPrice, 2) : '-',
    c.hasSellingPrice ? num2(c.profitPerBody, 2) : '-',
    c.hasSellingPrice ? num2(c.marginPercent, 1) + '%' : '-',
    c.hasSellingPrice ? num2(c.profitPerMachinePerMonth, 0) : '-',
  ])
  if (!body.length) body.push([{ content: 'No products in this report.', colSpan: 17, styles: { halign: 'center', textColor: GREY } }])
  autoTable(doc, {
    ...tableBase,
    startY: y,
    margin: { left: 30, right: 30, top: 50 },
    head: [[
      '#', 'Product', 'Date', 'Wt (g)', 'Rate/KG', 'GST', 'Avg Prod/ Day', 'Material (ex GST)', 'GST Amt', 'Material incl GST',
      'Fixed/ Unit', 'Addl/ Unit', 'FINAL COST/ UNIT', 'Selling Price', 'Profit/ Unit', 'Margin', 'Profit/ Machine/ Month',
    ]],
    body,
    headStyles: { ...tableBase.headStyles, fontSize: 6.8, halign: 'center' },
    bodyStyles: { ...tableBase.bodyStyles, fontSize: 7.3, halign: 'right' },
    columnStyles: { 0: { halign: 'center', cellWidth: 18 }, 1: { halign: 'left', cellWidth: 92 }, 2: { halign: 'left', cellWidth: 50 }, 12: { fontStyle: 'bold', fillColor: [232, 240, 254] } },
    didParseCell: (d) => {
      if (d.section !== 'body' || !s.rows[d.row.index]) return
      const c = s.rows[d.row.index].calc
      if ([14, 15, 16].includes(d.column.index) && c.hasSellingPrice) d.cell.styles.textColor = c.profitPerBody >= 0 ? GREEN : RED
    },
  })
  y = doc.lastAutoTable.finalY + 14

  y = ensureSpace(doc, y, 70)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  const notes = [
    'Formula: Final Cost / Unit = (Fixed Cost per Machine per Day / Avg Production per Day) + Material Cost incl. GST + Additional Cost per Unit.',
    'Material Cost = Rate per KG / 1000 x Weight per Unit (g). Profit per Machine per Month = Profit per Unit x Avg Production x Working Days.',
    s.rows.some((r) => r.calc.hasOverride) ? '* Final cost entered manually (override) - automatic formula bypassed for this product.' : '',
    s.lossMaking ? `Attention: ${s.lossMaking} product(s) are priced below cost.` : '',
  ].filter(Boolean)
  notes.forEach((n) => {
    doc.text(clean(n), 30, y, { maxWidth: W - 60 })
    y += 11
  })
  signatures(doc, y + 6)
  footers(doc, data.company)
  const fileName = `${safeFileName(T.short + '_Costing_' + reportId)}.pdf`
  return finish(doc, fileName)
}

// ---------------- Single product costing sheet ----------------
export function buildProductSheet({ type, data, productId, reportId, preparedBy }) {
  const T = COSTING_TYPES[type]
  const L = T.labels
  const mod = data.modules[type]
  const s = computeModule(mod)
  const p = mod.products.find((x) => x.id === productId)
  if (!p) throw new Error('Product not found')
  const c = computeProduct(p, s.perMachinePerDay, s.workingDays)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const now = new Date()
  header(doc, { company: data.company, title: `${T.short} Costing Sheet`, reportId, generatedAt: now, preparedBy })
  let y = 104
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...NAVY)
  doc.text(clean(p.name || 'Unnamed product'), 30, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GREY)
  doc.text(`Costing date: ${p.date ? fmtDate(p.date) : '-'}`, 30, y + 15)
  y += 30
  y = statBoxes(doc, y, [
    { label: L.finalCost + (c.hasOverride ? ' (manual)' : ''), value: rs(c.finalCostPerBody), highlight: true },
    { label: 'Selling Price', value: c.hasSellingPrice ? rs(c.sellingPrice) : 'N/A' },
    { label: 'Profit / ' + L.perUnit, value: c.hasSellingPrice ? rs(c.profitPerBody) : 'N/A', color: c.profitPerBody >= 0 ? GREEN : RED },
    { label: 'Margin', value: c.hasSellingPrice ? num2(c.marginPercent, 1) + '%' : 'N/A', color: c.marginPercent >= 0 ? GREEN : RED },
  ])
  y = sectionTitle(doc, 'Inputs', y + 4)
  autoTable(doc, {
    ...tableBase,
    startY: y,
    margin: { left: 30, right: 30 },
    head: [['Parameter', 'Value']],
    body: [
      [L.bodyWeightGram, num2(p.bodyWeightGram, 2) + ' g'],
      [L.ratePerKg, rs(p.ratePerKg)],
      [L.rawQtyKg, p.rawQtyKg ? num2(p.rawQtyKg, 2) + ' KG' + (c.unitsFromRawQty ? `  (enough for ~${num2(c.unitsFromRawQty, 0)} ${T.units})` : '') : '-'],
      [L.gstPercent, num2(p.gstPercent, 2) + '%'],
      [L.avgProduction, num2(p.avgProduction, 0) + ' ' + T.units],
      [L.additionalCost.replace(' (optional)', ''), c.additionalCost ? rs(c.additionalCost) : '-'],
      [L.sellingPrice, c.hasSellingPrice ? rs(c.sellingPrice) : '-'],
      ...(p.notes ? [['Notes', clean(p.notes)]] : []),
    ],
    columnStyles: { 0: { cellWidth: 220 }, 1: { halign: 'right' } },
  })
  y = doc.lastAutoTable.finalY + 20
  y = sectionTitle(doc, 'Step-by-step Cost Build-up', y)
  autoTable(doc, {
    ...tableBase,
    startY: y,
    margin: { left: 30, right: 30 },
    head: [['Step', 'Calculation', 'Result']],
    body: [
      ['Total monthly fixed cost', 'Sum of all fixed cost heads', rs(s.totalFixed)],
      ['Fixed cost / machine / month', `${rs(s.totalFixed)} / ${num2(mod.machine.numberOfMachines, 0)} machines`, rs(s.perMachine)],
      ['Fixed cost / machine / day', `${rs(s.perMachine)} / ${num2(mod.machine.workingDays, 0)} days`, rs(s.perMachinePerDay)],
      ['Fixed cost / ' + L.perUnit.toLowerCase(), `${rs(s.perMachinePerDay)} / ${num2(p.avgProduction, 0)} ${T.units}`, rs(c.fixedCostPerBody)],
      ['Rate per gram', `${rs(p.ratePerKg)} / 1000`, 'Rs. ' + num2(c.ratePerGram, 4)],
      ['Material cost (before GST)', `Rs. ${num2(c.ratePerGram, 4)} x ${num2(p.bodyWeightGram, 2)} g`, rs(c.materialAmountPerBody)],
      ['GST amount', `${rs(c.materialAmountPerBody)} x ${num2(p.gstPercent, 2)}%`, rs(c.gstAmount)],
      ['Material cost incl. GST', 'Material + GST', rs(c.materialTotalInclGst)],
      ['Additional cost / ' + L.perUnit.toLowerCase(), 'As entered', rs(c.additionalCost)],
      [
        { content: L.finalCost + ' (auto)', styles: { fontStyle: 'bold' } },
        'Fixed/unit + Material incl. GST + Additional',
        { content: rs(c.autoFinalCostPerBody), styles: { fontStyle: 'bold' } },
      ],
      ...(c.hasOverride ? [[{ content: L.finalCost + ' (manual override)', styles: { fontStyle: 'bold' } }, 'Entered manually - used for profit', { content: rs(c.finalCostPerBody), styles: { fontStyle: 'bold' } }]] : []),
      ['GST price (sheet metric)', 'GST amount + Fixed/unit', rs(c.gstPriceDisplay)],
      ['Without GST price', 'Fixed/unit + Material (ex GST) + Additional', rs(c.withoutGstPrice)],
      ...(c.hasSellingPrice
        ? [
            ['Profit / ' + L.perUnit.toLowerCase(), `${rs(c.sellingPrice)} - ${rs(c.finalCostPerBody)}`, rs(c.profitPerBody)],
            ['Margin', 'Profit / Selling price', num2(c.marginPercent, 2) + '%'],
            ['Profit / machine / day', `${rs(c.profitPerBody)} x ${num2(p.avgProduction, 0)}`, rs(c.profitPerMachinePerDay)],
            ['Profit / machine / month', `x ${num2(s.workingDays, 0)} working days`, rs(c.profitPerMachinePerMonth)],
          ]
        : []),
    ],
    columnStyles: { 0: { cellWidth: 170 }, 2: { halign: 'right', cellWidth: 110 } },
  })
  signatures(doc, doc.lastAutoTable.finalY + 20)
  footers(doc, data.company)
  return finish(doc, `${safeFileName(T.short + '_' + (p.name || 'Product') + '_' + reportId)}.pdf`)
}

// ---------------- Custom report (built by the AI assistant) ----------------
// spec: { title, subtitle, summary, highlights:[{label,value}], sections:[{heading, text, table:{columns:[], rows:[[]]}}], notes:[] }
export function buildCustomReport({ spec, data, reportId, preparedBy }) {
  const cols = Math.max(0, ...(spec.sections || []).map((s) => s.table?.columns?.length || 0))
  const landscape = cols > 6
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  header(doc, { company: data.company, title: spec.title || 'Costing Report', reportId, generatedAt: new Date(), preparedBy })
  let y = 102
  if (spec.subtitle) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...NAVY)
    doc.text(clean(spec.subtitle), 30, y)
    y += 16
  }
  if (spec.highlights?.length) y = statBoxes(doc, y, spec.highlights.slice(0, 5).map((h) => ({ label: String(h.label), value: String(h.value) })))
  if (spec.summary) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(30, 41, 59)
    const lines = doc.splitTextToSize(clean(spec.summary), W - 60)
    y = ensureSpace(doc, y, lines.length * 12)
    doc.text(lines, 30, y + 4)
    y += lines.length * 12 + 12
  }
  for (const sec of spec.sections || []) {
    y = ensureSpace(doc, y, 60)
    if (sec.heading) y = sectionTitle(doc, sec.heading, y + 4)
    if (sec.text) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(30, 41, 59)
      const lines = doc.splitTextToSize(clean(sec.text), W - 60)
      y = ensureSpace(doc, y, lines.length * 11)
      doc.text(lines, 30, y + 4)
      y += lines.length * 11 + 8
    }
    if (!sec.table && sec.columns?.length) sec.table = { columns: sec.columns, rows: sec.rows || [] }
    if (sec.table?.columns?.length) {
      autoTable(doc, {
        ...tableBase,
        startY: y,
        margin: { left: 30, right: 30, top: 50 },
        head: [sec.table.columns.map(clean)],
        body: (sec.table.rows || []).map((r) => r.map((v) => clean(typeof v === 'number' ? num2(v, 2) : v))),
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index > 0 && /^[+-]?(Rs\. )?[\d,.]+%?$/.test(String(d.cell.raw).trim())) d.cell.styles.halign = 'right'
        },
      })
      y = doc.lastAutoTable.finalY + 16
    }
  }
  if (spec.notes?.length) {
    y = ensureSpace(doc, y, 40)
    doc.setFontSize(7.5)
    doc.setTextColor(...GREY)
    for (const n of spec.notes) {
      const lines = doc.splitTextToSize(clean('- ' + n), W - 60)
      doc.text(lines, 30, y)
      y += lines.length * 10
    }
  }
  signatures(doc, y + 10)
  footers(doc, data.company)
  return finish(doc, `${safeFileName((spec.title || 'Custom_Report') + '_' + reportId)}.pdf`)
}

export function downloadPdf({ doc, blob, fileName }) {
  try {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (iOS && standalone) {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      return
    }
    doc.save(fileName)
  } catch {
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }
}

export function base64ToBlob(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'application/pdf' })
}

export { num }
