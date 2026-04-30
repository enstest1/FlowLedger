import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { InviteMemberForm } from './invite-member-form'
import { Users } from 'lucide-react'

export default async function MembersPage({
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

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: membership.organizationId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })

  const isAdmin = membership.role === 'ADMIN'

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-[#d6dcd2] text-[#234740]',
    TREASURY: 'bg-sky-100 text-sky-700',
    APPROVER: 'bg-amber-100 text-amber-700',
    ACCOUNTANT: 'bg-zinc-100 text-zinc-700',
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Team Members</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Members list */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Member
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-zinc-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center">
                      <Users size={14} className="text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {m.user.name || m.user.email}
                        {m.user.id === session.user.id && (
                          <span className="text-xs text-zinc-400 ml-1.5">
                            (you)
                          </span>
                        )}
                      </p>
                      {m.user.name && (
                        <p className="text-xs text-zinc-400">{m.user.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      roleColors[m.role] ?? 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-500">
                  {format(new Date(m.createdAt), 'MMM d, yyyy')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite form */}
      {isAdmin && (
        <InviteMemberForm orgId={membership.organizationId} slug={slug} />
      )}
    </div>
  )
}
