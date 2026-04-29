import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Email from 'next-auth/providers/nodemailer'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Email({
      server: {
        host: process.env.EMAIL_SERVER_HOST || 'smtp.example.com',
        port: Number(process.env.EMAIL_SERVER_PORT || 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER || '',
          pass: process.env.EMAIL_SERVER_PASSWORD || '',
        },
      },
      from: process.env.EMAIL_FROM || 'noreply@flowledger.app',
      sendVerificationRequest: async ({ identifier, url }) => {
        // In dev mode with no email server, just log the magic link
        if (!process.env.EMAIL_SERVER_HOST || process.env.EMAIL_SERVER_HOST === 'smtp.example.com') {
          console.log('\n========== MAGIC LINK ==========')
          console.log(`Email: ${identifier}`)
          console.log(`URL: ${url}`)
          console.log('Use /api/dev/signin?email=<email> for instant dev login')
          console.log('================================\n')
          return
        }
        // Real email send
        const nodemailer = await import('nodemailer')
        const transport = nodemailer.createTransport({
          host: process.env.EMAIL_SERVER_HOST,
          port: Number(process.env.EMAIL_SERVER_PORT),
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        })
        await transport.sendMail({
          to: identifier,
          from: process.env.EMAIL_FROM,
          subject: 'Sign in to FlowLedger',
          text: `Click here to sign in: ${url}`,
          html: `<p>Click <a href="${url}">here</a> to sign in to FlowLedger.</p>`,
        })
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify',
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session({ session, user }: { session: any; user: { id: string } }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id
      }
      return session
    },
  },
})
