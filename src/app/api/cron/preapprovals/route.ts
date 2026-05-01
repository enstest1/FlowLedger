import { NextRequest, NextResponse } from 'next/server'
import { checkPreApprovals } from '@/lib/canton/preapproval-monitor'

// GET /api/cron/preapprovals
//
// Called by Vercel Cron (configure in vercel.json) or any external scheduler.
// Checks all vendor pre-approvals, auto-marks expired ones, logs a summary.
//
// Vercel Cron config (vercel.json):
// {
//   "crons": [{ "path": "/api/cron/preapprovals", "schedule": "0 9 * * *" }]
// }
//
// Protected by CRON_SECRET — Vercel sets Authorization: Bearer <CRON_SECRET>
// automatically. Set CRON_SECRET in your Vercel environment variables.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In production, require the Vercel cron secret
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const report = await checkPreApprovals()

    console.log('[Cron] Pre-approval check complete:', {
      active: report.active,
      expiringWithin14Days: report.expiringWithin14Days,
      expired: report.expired,
    })

    if (report.expiringWithin14Days > 0) {
      const expiring = report.vendors
        .filter((v) => v.daysUntilExpiry !== null && v.daysUntilExpiry <= 14 && v.daysUntilExpiry >= 0)
        .map((v) => `${v.name} (${v.orgName}) — ${v.daysUntilExpiry}d`)
      console.warn('[Cron] Pre-approvals expiring soon:', expiring.join(', '))
    }

    if (report.expired > 0) {
      const expired = report.vendors
        .filter((v) => v.preApprovalStatus === 'EXPIRED' || (v.daysUntilExpiry !== null && v.daysUntilExpiry < 0))
        .map((v) => `${v.name} (${v.orgName})`)
      console.warn('[Cron] Expired pre-approvals (batch execution blocked):', expired.join(', '))
    }

    return NextResponse.json({
      ok: true,
      active: report.active,
      expiringWithin14Days: report.expiringWithin14Days,
      expired: report.expired,
      checkedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Cron] Pre-approval check failed:', err)
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }
}
