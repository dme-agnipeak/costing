import { computeProduct, currency, num2 } from '../lib/calculations'
import { Pencil, Trash2 } from 'lucide-react'

export default function ProductTable({ products, fixedCostPerMachineHour, onEdit, onDelete }) {
  if (!products.length) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
        Koi product add nahi hua abhi tak. Upar se "Add Product" karo.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="bg-navy-900 text-slate-400 text-xs uppercase tracking-wide">
            <th className="text-left px-3 py-3">Product</th>
            <th className="text-right px-3 py-3">Rate/KG</th>
            <th className="text-right px-3 py-3">Raw Qty</th>
            <th className="text-right px-3 py-3">Material Total</th>
            <th className="text-right px-3 py-3">Good Bodies</th>
            <th className="text-right px-3 py-3">Material/Body</th>
            <th className="text-right px-3 py-3">Fixed/Body</th>
            <th className="text-right px-3 py-3 text-gold-400">Final Cost/Body</th>
            <th className="text-right px-3 py-3">Profit/Body</th>
            <th className="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {products.map((p) => {
            const c = computeProduct(p, fixedCostPerMachineHour)
            return (
              <tr key={p.id} className="hover:bg-navy-800/40 transition">
                <td className="px-3 py-3 text-slate-200 font-medium">{p.name || '—'}</td>
                <td className="px-3 py-3 text-right text-slate-400">₹{num2(p.ratePerKg)}</td>
                <td className="px-3 py-3 text-right text-slate-400">{num2(p.rawQtyKg)} kg</td>
                <td className="px-3 py-3 text-right text-slate-300">{currency(c.materialTotalInclGst)}</td>
                <td className="px-3 py-3 text-right text-slate-300">{num2(c.bodiesForCosting, 0)}</td>
                <td className="px-3 py-3 text-right text-slate-300">{currency(c.materialCostPerBody)}</td>
                <td className="px-3 py-3 text-right text-slate-300">{currency(c.fixedCostPerBody)}</td>
                <td className="px-3 py-3 text-right font-bold text-gold-400">{currency(c.finalCostPerBody)}</td>
                <td className={`px-3 py-3 text-right font-medium ${c.profitPerBody >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {p.sellingPrice ? currency(c.profitPerBody) : '—'}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => onEdit(p)} className="text-slate-500 hover:text-gold-400 transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="text-slate-500 hover:text-red-400 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
