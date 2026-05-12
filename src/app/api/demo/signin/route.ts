import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEMO_EMAILS: Record<string, string> = {
  admin: 'admin@flowledger.io',
  approver: 'approver@flowledger.io',
}

// One-click demo login. Enabled only when DEMO_MODE=true is set in env.
// Set this in Vercel → Project Settings → Environment Variables.
export async function GET(request: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 })
  }

  const role = request.nextUrl.searchParams.get('role') ?? 'admin'
  const email = DEMO_EMAILS[role]
  if (!email) {
    return NextResponse.json({ error: 'Unknown demo role' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json(
      { error: `Demo user ${email} not found — run: npx prisma db seed` },
      { status: 404 }
    )
  }

  const sessionToken = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } })

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  })

  const redirectTo = membership
    ? `/${membership.organization.slug}/dashboard`
    : '/onboarding'

  const response = NextResponse.redirect(new URL(redirectTo, request.url))
  const useSecurePrefix = request.nextUrl.protocol === 'https:'
  const cookieName = useSecurePrefix ? '__Secure-authjs.session-token' : 'authjs.session-token'
  response.cookies.set(cookieName, sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: useSecurePrefix,
  })

  return response
}
