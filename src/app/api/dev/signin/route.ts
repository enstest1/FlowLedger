import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DEV ONLY: bypass email auth, create a session directly
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json(
      { error: 'email param required' },
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
  response.cookies.set('authjs.session-token', sessionToken, {
    expires,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  return response
}
