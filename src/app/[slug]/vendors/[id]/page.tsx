import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { PartyId } from '@/components/party-id'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { renewPreApproval } from '@/app/actions/vendor'
import { formatAmount } from '@/lib/utils'

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id, organization: { slug } },
  })
  if (!membership) redirect('/')

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!vendor || vendor.organizationId !== membership.organizationId) notFound()

  const canManage = ['ADMIN', 'TREASURY'].includes(membership.role)
  const isExpired = vendor.preApprovalStatus === 'EXPIRED'

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${slug}/vendors`}
          className="text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{vendor.name}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{vendor.email}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-4">
            Vendor Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-zinc-400">Canton Party ID</dt>
              <dd className="mt-0.5">
                <PartyId id={vendor.cantonPartyId} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Preferred Asset</dt>
              <dd className="text-sm font-medium text-zinc-900 mt-0.5">
                {vendor.preferredAsset}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={vendor.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Added</dt>
              <dd className="text-sm text-zinc-700 mt-0.5">
                {format(new Date(vendor.createdAt), 'MMMM d, yyyy')}
              </dd>
            </div>
            {vendor.notes && (
              <div>
                <dt className="text-xs text-zinc-400">Notes</dt>
                <dd className="text-sm text-zinc-700 mt-0.5">{vendor.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-700">
              Canton Pre-Approval
            </h2>
            {isExpired && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                EXPIRED
              </span>
            )}
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-zinc-400">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={vendor.preApprovalStatus} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-400">Expires</dt>
              <dd className="text-sm text-zinc-700 mt-0.5">
                {vendor.preApprovalExpiry
                  ? format(new Date(vendor.preApprovalExpiry), 'MMMM d, yyyy')
                  : '—'}
              </dd>
            </div>
          </dl>
          {canManage && isExpired && (
            <form
              action={async () => {
                'use server'
                await renewPreApproval(id)
              }}
            >
              <button
                type="submit"
                className="mt-4 w-full flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 py-2 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
              >
                <RefreshCw size={13} />
                Renew Pre-Approval
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Invoice History */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="p-5 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Invoice History</h2>
        </div>
        {vendor.invoices.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-zinc-400">No invoices yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {vendor.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-zinc-50 hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/invoices/${inv.id}`}
                      className="text-sm font-medium text-[#2d5a4f] hover:text-[#234740]"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-xs text-zinc-400 mt-0.5 max-w-xs truncate">
                      {inv.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-900">
                    {formatAmount(inv.amount, inv.assetId)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">
                    {format(new Date(inv.dueDate), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
