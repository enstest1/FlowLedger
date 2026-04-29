'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteMember } from '@/app/actions/org'
import { Loader2, Plus } from 'lucide-react'

interface Props {
  orgId: string
  slug: string
}

export function InviteMemberForm({ orgId, slug }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('APPROVER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const result = await inviteMember(orgId, email, role)
    if (result?.error) {
      setError(result.error)
    } else {
      setSuccess(`${email} has been added as ${role}`)
      setEmail('')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-card border border-border p-6">
      <h2 className="font-semibold text-foreground mb-4">Invite Team Member</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg mb-4">
          {success}
        </p>
      )}

      <form onSubmit={handleInvite} className="flex gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
          className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="APPROVER">Approver</option>
          <option value="TREASURY">Treasury</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading || !email}
          className="flex items-center gap-1.5 bg-purple-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {loading ? 'Adding...' : 'Add'}
        </button>
      </form>
    </div>
  )
}
