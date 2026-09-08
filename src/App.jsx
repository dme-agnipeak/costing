import { useState, useEffect } from 'react'
import Header from './components/Header'
import Tabs from './components/Tabs'
import FixedCostSetup from './components/FixedCostSetup'
import MachineCapacitySetup from './components/MachineCapacitySetup'
import ProductForm, { blankProduct } from './components/ProductForm'
import ProductTable from './components/ProductTable'
import FinalReport from './components/FinalReport'
import { storage } from './lib/storage'
import { computeFixedCostPerMachinePerDay } from './lib/calculations'
import { Settings2, Gauge, Package, FileBarChart, Plus } from 'lucide-react'

const TABS = [
  { id: 'fixed', label: 'Fixed Costs', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'machine', label: 'Machine Setup', icon: <Gauge className="w-4 h-4" /> },
  { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
  { id: 'report', label: 'Final Report', icon: <FileBarChart className="w-4 h-4" /> },
]

export default function App() {
  const [companyInfo] = useState(storage.getCompanyInfo())
  const [fixedCosts, setFixedCostsState] = useState(storage.getFixedCosts())
  const [machineCapacity, setMachineCapacityState] = useState(storage.getMachineCapacity())
  const [products, setProductsState] = useState(storage.getProducts())
  const [tab, setTab] = useState('fixed')
  const [editingProduct, setEditingProduct] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => storage.setFixedCosts(fixedCosts), [fixedCosts])
  useEffect(() => storage.setMachineCapacity(machineCapacity), [machineCapacity])
  useEffect(() => storage.setProducts(products), [products])

  const fixedCostPerMachinePerDay = computeFixedCostPerMachinePerDay(fixedCosts, machineCapacity)

  const saveProduct = (product) => {
    setProductsState((prev) => {
      const exists = prev.some((p) => p.id === product.id)
      if (exists) return prev.map((p) => (p.id === product.id ? product : p))
      return [...prev, product]
    })
    setShowForm(false)
    setEditingProduct(null)
  }

  const deleteProduct = (id) => {
    if (confirm('Ye product delete karna hai?')) {
      setProductsState((prev) => prev.filter((p) => p.id !== id))
    }
  }

  return (
    <div className="min-h-screen pb-16">
      <Header companyInfo={companyInfo} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {tab === 'fixed' && <FixedCostSetup fixedCosts={fixedCosts} setFixedCosts={setFixedCostsState} />}

        {tab === 'machine' && (
          <MachineCapacitySetup
            machineCapacity={machineCapacity}
            setMachineCapacity={setMachineCapacityState}
            fixedCosts={fixedCosts}
          />
        )}

        {tab === 'products' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-slate-100 font-semibold">Product / Body Costing</h2>
                <p className="text-slate-500 text-xs mt-0.5">Har product ke liye raw material aur machine data daalo.</p>
              </div>
              {!showForm && (
                <button
                  onClick={() => {
                    setEditingProduct(null)
                    setShowForm(true)
                  }}
                  className="flex items-center gap-1.5 bg-gold-500 hover:bg-gold-400 text-white font-semibold text-sm px-3.5 py-2.5 rounded-lg transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              )}
            </div>

            {showForm && (
              <ProductForm
                initial={editingProduct}
                fixedCostPerMachinePerDay={fixedCostPerMachinePerDay}
                onSave={saveProduct}
                onCancel={() => {
                  setShowForm(false)
                  setEditingProduct(null)
                }}
              />
            )}

            <ProductTable
              products={products}
              fixedCostPerMachinePerDay={fixedCostPerMachinePerDay}
              onEdit={(p) => {
                setEditingProduct(p)
                setShowForm(true)
              }}
              onDelete={deleteProduct}
            />
          </div>
        )}

        {tab === 'report' && (
          <FinalReport
            companyInfo={companyInfo}
            fixedCosts={fixedCosts}
            machineCapacity={machineCapacity}
            products={products}
            fixedCostPerMachinePerDay={fixedCostPerMachinePerDay}
          />
        )}
      </main>
    </div>
  )
}
