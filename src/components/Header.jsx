import { Flame } from 'lucide-react'

export default function Header({ companyInfo }) {
  return (
    <header className="sticky top-0 z-20 bg-navy-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-gold-500 flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-gold-500" />
        </div>
        <div className="min-w-0">
          <h1 className="text-slate-100 font-semibold text-base leading-tight truncate">{companyInfo.name}</h1>
          <p className="text-slate-400 text-xs leading-tight truncate">{companyInfo.subtitle}</p>
        </div>
      </div>
    </header>
  )
}
