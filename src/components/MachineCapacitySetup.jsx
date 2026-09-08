import Field from './Field'
import { currency, num2, computeFixedCostPerMachine, computeFixedCostPerMachinePerDay } from '../lib/calculations'
import { Lock, Unlock } from 'lucide-react'
import { useState } from 'react'

export default function MachineCapacitySetup({ machineCapacity, setMachineCapacity, fixedCosts }) {
  const [locked, setLocked] = useState(true)
  const perMachine = computeFixedCostPerMachine(fixedCosts, machineCapacity)
  const perMachinePerDay = computeFixedCostPerMachinePerDay(fixedCosts, machineCapacity)

  const update = (key, val) => setMachineCapacity({ ...machineCapacity, [key]: val })

  return (
    <div className="bg-navy-800/40 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-slate-100 font-semibold">Machine Setup</h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Total Fixed Cost yahan se machines aur working days ke hisaab se baant kar per-machine-per-day rate banta hai.
          </p>
        </div>
        <button
          onClick={() => setLocked((l) => !l)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
            locked
              ? 'border-slate-700 text-slate-400 hover:text-slate-200'
              : 'border-gold-500 text-gold-400 bg-gold-500/10'
          }`}
        >
          {locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {locked ? 'Locked' : 'Editing'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
        <Field
          label="Number of Machines"
          value={machineCapacity.numberOfMachines}
          disabled={locked}
          onChange={(v) => update('numberOfMachines', v)}
        />
        <Field
          label="Working Days in Month"
          value={machineCapacity.workingDays}
          disabled={locked}
          onChange={(v) => update('workingDays', v)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between bg-navy-900 border border-slate-700 rounded-xl px-4 py-3.5">
          <span className="text-slate-400 text-sm">Fixed Cost / Machine (Monthly)</span>
          <span className="text-slate-100 font-semibold">{currency(perMachine)}</span>
        </div>
        <div className="flex items-center justify-between bg-navy-900 border border-gold-500/30 rounded-xl px-4 py-3.5">
          <span className="text-slate-300 text-sm font-medium">Fixed Cost / Machine / Day</span>
          <span className="text-gold-400 font-bold">{currency(perMachinePerDay)}</span>
        </div>
      </div>

      <p className="text-slate-500 text-xs mt-4">
        Har product ke apna "Avg Production" number hoga (Products tab me) — usi se is machine/day fixed cost ko us product ke har body par baanta jaata hai.
      </p>
    </div>
  )
}
