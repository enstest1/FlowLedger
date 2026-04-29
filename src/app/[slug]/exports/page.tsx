'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { exportInvoicesCSV, exportReceiptsCSV } from '@/app/actions/export'
import { Download, FileText, Receipt } from 'lucide-react'

export default function ExportsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  // We need orgId — fetch it
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgIdLoading, setOrgIdLoading] = useState(false)

  const getOrgId = async (): Promise<string | null> => {
    if (orgId) return orgId
    setOrgIdLoading(true)
    const res = await fetch(`/api/orgs/${slug}/meta`)
    const data = await res.json()
    setOrgIdLoading(false)
    if (data.id) {
      setOrgId(data.id)
      return data.id
    }
    return null
  }

  const handleExportInvoices = async () => {
    setLoading('invoices')
    setError('')
    try {
      const id = await getOrgId()
      if (!id) {
        setError('Could not determine organization')
        setLoading(null)
        return
      }
      const result = await exportInvoicesCSV(id, {})
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        downloadCSV(result.data.csv, 'invoices.csv')
      }
    } catch {
      setError('Export failed')
    }
    setLoading(null)
  }

  const handleExportReceipts = async () => {
    setLoading('receipts')
    setError('')
    try {
      const id = await getOrgId()
      if (!id) {
        setError('Could not determine organization')
        setLoading(null)
        return
      }
      const result = await exportReceiptsCSV(id)
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        downloadCSV(result.data.csv, 'receipts.csv')
      }
    } catch {
      setError('Export failed')
    }
    setLoading(null)
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Exports</h1>
        <p className="text-zinc-500 text-sm mt-0.5">
          Export your data as CSV files
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900 mb-1">Invoices CSV</h2>
              <p className="text-sm text-zinc-500 mb-4">
                Export all invoices with vendor, amount, status, and date
                information.
              </p>
              <button
                onClick={handleExportInvoices}
                disabled={loading === 'invoices' || orgIdLoading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {loading === 'invoices' ? 'Exporting...' : 'Export Invoices'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
              <Receipt size={18} className="text-teal-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900 mb-1">Receipts CSV</h2>
              <p className="text-sm text-zinc-500 mb-4">
                Export all payment receipts with Canton Update IDs and party
                information.
              </p>
              <button
                onClick={handleExportReceipts}
                disabled={loading === 'receipts' || orgIdLoading}
                className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                <Download size={14} />
                {loading === 'receipts' ? 'Exporting...' : 'Export Receipts'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
