import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computeProduct, computeTotalFixedCost, computeFixedCostPerMachine, computeFixedCostPerMachinePerDay, currency, num2 } from './calculations'

export function exportFinalReportPdf({ companyInfo, fixedCosts, machineCapacity, products }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  const blueRGB = [47, 111, 237]
  const navyRGB = [15, 23, 42]

  // Header
  doc.setFillColor(...navyRGB)
  doc.rect(0, 0, pageWidth, 70, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(companyInfo?.name || 'Vinayak AgniPeak LLP', 30, 30)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(companyInfo?.subtitle || 'Product Body Costing — Final Report', 30, 48)

  const now = new Date()
  doc.setFontSize(9)
  doc.setTextColor(200, 200, 200)
  doc.text('Generated: ' + now.toLocaleString('en-IN'), pageWidth - 220, 48)

  let y = 90
  doc.setTextColor(...navyRGB)

  const totalFixed = computeTotalFixedCost(fixedCosts)
  const perMachine = computeFixedCostPerMachine(fixedCosts, machineCapacity)
  const perMachinePerDay = computeFixedCostPerMachinePerDay(fixedCosts, machineCapacity)

  // Fixed cost summary table
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Monthly Fixed Cost Setup', 30, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: 30, right: 30 },
    head: [['Electricity', 'Factory Rent', 'Operator Salary', 'Labour', 'Misc (MSC)', 'Other Fixed', 'TOTAL FIXED COST']],
    body: [[
      currency(fixedCosts.electricity),
      currency(fixedCosts.rent),
      currency(fixedCosts.operatorSalary),
      currency(fixedCosts.labour),
      currency(fixedCosts.misc),
      currency(fixedCosts.otherFixed),
      currency(totalFixed),
    ]],
    theme: 'grid',
    headStyles: { fillColor: navyRGB, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 9, halign: 'right' },
    styles: { cellPadding: 5 },
  })

  y = doc.lastAutoTable.finalY + 20

  doc.setFont('helvetica', 'bold')
  doc.text('Machine Setup & Fixed Cost Allocation', 30, y)
  y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: 30, right: 30 },
    head: [['Number of Machines', 'Working Days/Month', 'Fixed Cost / Machine (Monthly)', 'Fixed Cost / Machine / Day']],
    body: [[
      machineCapacity.numberOfMachines,
      machineCapacity.workingDays,
      currency(perMachine),
      currency(perMachinePerDay),
    ]],
    theme: 'grid',
    headStyles: { fillColor: navyRGB, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 9, halign: 'right' },
    styles: { cellPadding: 5 },
  })

  y = doc.lastAutoTable.finalY + 20

  doc.setFont('helvetica', 'bold')
  doc.text('Product / Body — Final Costing', 30, y)
  y += 8

  const rows = products.map((p) => {
    const c = computeProduct(p, perMachinePerDay)
    return [
      p.name || '-',
      num2(p.bodyWeightGram, 1),
      p.ratePerKg,
      p.gstPercent + '%',
      num2(p.avgProduction, 0),
      num2(c.materialTotalInclGst),
      num2(c.fixedCostPerBody),
      num2(c.finalCostPerBody),
      num2(c.gstPriceDisplay),
      num2(c.withoutGstPrice),
      p.sellingPrice ? num2(p.sellingPrice) : '-',
      p.sellingPrice ? num2(c.profitPerBody) : '-',
    ]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: 30, right: 30 },
    head: [[
      'Product', 'Body Wt(g)', 'Rate/KG', 'GST%', 'Avg Production',
      'Material Total incl.GST', 'Fixed Cost/Body',
      'FINAL COST/BODY', 'GST Price', 'Without GST Price', 'Selling Price', 'Profit/Body',
    ]],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: navyRGB, textColor: [255, 255, 255], fontSize: 7 },
    bodyStyles: { fontSize: 8, halign: 'right' },
    columnStyles: { 0: { halign: 'left' } },
    styles: { cellPadding: 4 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = navyRGB
      }
    },
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.setFont('helvetica', 'italic')
  doc.text('This is a system-generated costing report for internal use.', 30, finalY)

  const filename = `AgniPeak_Costing_Report_${now.toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
