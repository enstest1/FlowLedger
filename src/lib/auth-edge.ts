// Edge-compatible auth configuration (no nodemailer/prisma)
import NextAuth from 'next-auth'

export const { auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify',
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth
    },
  },
})
