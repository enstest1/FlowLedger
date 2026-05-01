import { redirect } from 'next/navigation'

// CC rewards are FlowLedger's earnings, not the customer's.
// Operator console lives at /admin/rewards.
export default async function RewardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/${slug}/dashboard`)
}
