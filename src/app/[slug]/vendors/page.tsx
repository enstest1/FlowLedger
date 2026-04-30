import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { PartyId } from '@/components/party-id'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, Users, RefreshCw } from 'lucide-react'

export default async function VendorsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
    include: { organization: true },
  })
  if (!membership) redirect('/')

  const vendors = await prisma.vendor.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: 'desc' },
  })

  const canManage = ['ADMIN', 'TREASURY'].includes(membership.role)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Vendors</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        {canManage && (
          <Link
            href={`/${slug}/vendors/new`}
            className="flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#234740] transition-colors"
          >
            <Plus size={14} />
            Add Vendor
          </Link>
        )}
      </div>

      {vendors.length === 0 ? (
        <div className="bg-white rounded-xl border border-zinc-200 p-16 text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={20} className="text-zinc-400" />
          </div>
          <h3 className="font-semibold text-zinc-900 mb-2">No vendors yet</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Add your first vendor to start creating invoices.
          </p>
          {canManage && (
            <Link
              href={`/${slug}/vendors/new`}
              className="inline-flex items-center gap-1.5 bg-[#2d5a4f] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#234740] transition-colors"
            >
              <Plus size={14} />
              Add Vendor
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Canton Party ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Pre-Approval
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {vendor.name}
                      </p>
                      <p className="text-xs text-zinc-400">{vendor.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PartyId id={vendor.cantonPartyId} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={vendor.preApprovalStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={vendor.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-500">
                      {vendor.preApprovalExpiry
                        ? format(new Date(vendor.preApprovalExpiry), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/${slug}/vendors/${vendor.id}`}
                        className="text-xs text-[#2d5a4f] hover:text-[#234740] font-medium"
                      >
                        View
                      </Link>
                      {canManage && vendor.preApprovalStatus === 'EXPIRED' && (
                        <Link
                          href={`/${slug}/vendors/${vendor.id}`}
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          <RefreshCw size={11} />
                          Renew
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
