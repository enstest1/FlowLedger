import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEMO_EMAILS: Record<string, string> = {
  admin: 'admin@flowledger.io',
  approver: 'approver@flowledger.io',
}

// DEV ONLY: bypass email auth, create a session directly
// Usage: ?email=someone@example.com  OR  ?role=admin  OR  ?role=approver
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const role = request.nextUrl.searchParams.get('role')
  const emailParam = request.nextUrl.searchParams.get('email')
  const email = role ? (DEMO_EMAILS[role] ?? null) : emailParam

  if (!email) {
    return NextResponse.json(
      { error: 'Provide ?email=... or ?role=admin|approver' },
      { status: 400 }
    )
  }

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })

  // Create session
  const sessionToken = crypto.randomUUID()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  })

  // Find the user's org to redirect there directly
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
