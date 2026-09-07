import { computeProduct, computeTotalFixedCost, computePlannedMachineHours, currency, num2 } from '../lib/calculations'
import { exportFinalReportPdf } from '../lib/pdfExport'
import { FileDown } from 'lucide-react'

export default function FinalReport({ companyInfo, fixedCosts, machineCapacity, products, fixedCostPerMachineHour }) {
  const totalFixed = computeTotalFixedCost(fixedCosts)
  const plannedHours = computePlannedMachineHours(machineCapacity)

  const totals = products.reduce(
    (acc, p) => {
      const c = computeProduct(p, fixedCostPerMachineHour)
      acc.material += c.materialTotalInclGst
      acc.allocatedFixed += c.allocatedFixedCost
      acc.bodies += c.bodiesForCosting
      if (p.sellingPrice) acc.revenue += Number(p.sellingPrice) * c.bodiesForCosting
      acc.cost += c.finalCostPerBody * c.bodiesForCosting
      return acc
    },
    { material: 0, allocatedFixed: 0, bodies: 0, revenue: 0, cost: 0 }
  )
  const totalProfit = totals.revenue - totals.cost

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-slate-100 font-semibold">Final Costing Report</h2>
          <p className="text-slate-500 text-xs mt-0.5">{companyInfo.name} — {new Date().toLocaleDateString('en-IN')}</p>
        </div>
        <button
          onClick={() => exportFinalReportPdf({ companyInfo, fixedCosts, machineCapacity, products })}
          disabled={!products.length}
          className="flex items-center gap-2 bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-navy-950 font-semibold text-sm px-4 py-2.5 rounded-lg transition shrink-0"
        >
          <FileDown className="w-4 h-4" />
          Download PDF Report
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Monthly Fixed Cost" value={currency(totalFixed)} />
        <Stat label="Planned Machine Hours" value={num2(plannedHours, 0)} />
        <Stat label="Total Good Bodies (all products)" value={num2(totals.bodies, 0)} />
        <Stat label="Total Est. Profit" value={currency(totalProfit)} highlight={totalProfit >= 0} negative={totalProfit < 0} />
      </div>

      {!products.length ? (
        <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
          Report ke liye pehle "Products" tab me kam se kam ek product add karo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="bg-navy-900 text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-3">Product</th>
                <th className="text-right px-3 py-3">Body Wt(g)</th>
                <th className="text-right px-3 py-3">Material Total</th>
                <th className="text-right px-3 py-3">Good Bodies</th>
                <th className="text-right px-3 py-3">Material/Body</th>
                <th className="text-right px-3 py-3">Fixed/Body</th>
                <th className="text-right px-3 py-3 text-gold-400">Final Cost/Body</th>
                <th className="text-right px-3 py-3">Selling Price</th>
                <th className="text-right px-3 py-3">Profit/Body</th>
                <th className="text-right px-3 py-3">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {products.map((p) => {
                const c = computeProduct(p, fixedCostPerMachineHour)
                return (
                  <tr key={p.id} className="hover:bg-navy-800/40 transition">
                    <td className="px-3 py-3 text-slate-200 font-medium">{p.name || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-400">{num2(p.bodyWeightGram, 1)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{currency(c.materialTotalInclGst)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{num2(c.bodiesForCosting, 0)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{currency(c.materialCostPerBody)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{currency(c.fixedCostPerBody)}</td>
                    <td className="px-3 py-3 text-right font-bold text-gold-400">{currency(c.finalCostPerBody)}</td>
                    <td className="px-3 py-3 text-right text-slate-300">{p.sellingPrice ? currency(p.sellingPrice) : '—'}</td>
                    <td className={`px-3 py-3 text-right font-medium ${c.profitPerBody >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.sellingPrice ? currency(c.profitPerBody) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium ${c.marginPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.sellingPrice ? num2(c.marginPercent, 1) + '%' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight, negative }) {
  return (
    <div
      className={`rounded-xl px-4 py-3.5 border ${
        negative
          ? 'bg-red-500/10 border-red-500/30'
          : highlight
          ? 'bg-gold-500/10 border-gold-500/40'
          : 'bg-navy-900 border-slate-700'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-bold mt-0.5 ${negative ? 'text-red-400' : highlight ? 'text-gold-400' : 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  )
}
